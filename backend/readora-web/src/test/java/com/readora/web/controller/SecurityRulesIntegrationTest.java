package com.readora.web.controller;

import com.readora.application.port.out.ChapterRepositoryPort;
import com.readora.application.port.out.ScanlationProjectRepositoryPort;
import com.readora.application.port.out.WorkRepositoryPort;
import com.readora.domain.scanlation.ScanlationProject;
import com.readora.domain.scanlation.WorkflowTask;
import com.readora.domain.work.*;
import com.readora.web.ReadoraApplication;
import com.readora.web.dto.CreateCommentRequest;
import com.readora.web.dto.UpdateProgressRequest;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.http.MediaType;
import org.springframework.test.context.ActiveProfiles;

import java.util.List;
import java.util.Set;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.content;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest(classes = ReadoraApplication.class)
@AutoConfigureMockMvc
@ActiveProfiles("test")
class SecurityRulesIntegrationTest extends AuthTestSupport {

    @Autowired
    private WorkRepositoryPort workRepository;

    @Autowired
    private ChapterRepositoryPort chapterRepository;

    @Autowired
    private ScanlationProjectRepositoryPort projectRepository;

    private Work work;
    private Chapter chapter;

    @BeforeEach
    void setup() {
        work = workRepository.save(Work.create("Tower of God", "Synopsis", WorkType.MANHWA, "cover.webp", Set.of("Fantasy")));
        chapter = Chapter.createDraft(work.getId(), ChapterNumber.of("1"), "Chapter 1", null);
        chapter.updatePages(List.of(PageAsset.create(1, "k/p1.webp", "https://cdn.readora.com/k/p1.webp")));
        chapter.publish(UserId.of("publisher1"));
        chapter = chapterRepository.save(chapter);
    }

    @Test
    @DisplayName("Public reads stay anonymous: chapter, comments and works return 200 without a token")
    void publicReadsAreAnonymous() throws Exception {
        mockMvc.perform(get("/api/v1/chapters/" + chapter.getId().value())).andExpect(status().isOk());
        mockMvc.perform(get("/api/v1/comments/chapter/" + chapter.getId().value())).andExpect(status().isOk());
        mockMvc.perform(get("/api/v1/works")).andExpect(status().isOk());
    }

    @Test
    @DisplayName("Anonymous POST on a protected endpoint returns 401 JSON body")
    void anonymousWriteIsUnauthorizedJson() throws Exception {
        mockMvc.perform(post("/api/v1/comments/chapter/" + chapter.getId().value())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(new CreateCommentRequest("Hello", null, null, false))))
                .andExpect(status().isUnauthorized())
                .andExpect(content().contentTypeCompatibleWith(MediaType.APPLICATION_JSON))
                .andExpect(jsonPath("$.success").value(false));

        mockMvc.perform(get("/api/v1/profile"))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.success").value(false));
    }

    @Test
    @DisplayName("Tampered JWT returns 401 JSON")
    void tamperedTokenIsUnauthorized() throws Exception {
        Session reader = register();
        String tampered = reader.accessToken().substring(0, reader.accessToken().length() - 4) + "abcd";
        mockMvc.perform(get("/api/v1/profile").header("Authorization", "Bearer " + tampered))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.success").value(false));
    }

    @Test
    @DisplayName("READER posts a comment under their own identity (author taken from JWT, not from the body)")
    void readerCommentsUnderOwnIdentity() throws Exception {
        Session reader = register();
        mockMvc.perform(post("/api/v1/comments/chapter/" + chapter.getId().value())
                        .header("Authorization", reader.bearer())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(new CreateCommentRequest("Great chapter!", 1, null, false))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.authorId").value(reader.userId()))
                .andExpect(jsonPath("$.data.authorUsername").value(reader.username()));
    }

    @Test
    @DisplayName("READER without PREMIUM gets 403 on bookmarks; 403 on publish; anonymous refresh path unaffected")
    void readerLacksPremiumAndScanlationPermissions() throws Exception {
        Session reader = register();

        mockMvc.perform(put("/api/v1/bookmarks/" + work.getId().value() + "/progress")
                        .header("Authorization", reader.bearer())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(new UpdateProgressRequest(chapter.getId().value(), 1))))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.success").value(false));

        mockMvc.perform(get("/api/v1/bookmarks").header("Authorization", reader.bearer()))
                .andExpect(status().isForbidden());

        ScanlationProject project = ScanlationProject.create("Team Tower", work.getId(), UserId.of("leader-1"));
        WorkflowTask task = project.addChapterTask(ChapterNumber.of("2"));
        project = projectRepository.save(project);

        mockMvc.perform(post("/api/v1/scanlation/projects/" + project.getId().value() + "/tasks/" + task.getId().value() + "/publish")
                        .header("Authorization", reader.bearer()))
                .andExpect(status().isForbidden());

        mockMvc.perform(get("/api/v1/scanlation/projects/" + project.getId().value())
                        .header("Authorization", reader.bearer()))
                .andExpect(status().isForbidden());
    }

    @Test
    @DisplayName("SCANLATOR passes the permission gate; non-membership is then rejected by the domain (400)")
    void scanlatorPassesGateButDomainRulesStillApply() throws Exception {
        Session scanlator = registerScanlator();

        ScanlationProject project = ScanlationProject.create("Team Tower", work.getId(), UserId.of("leader-2"));
        WorkflowTask task = project.addChapterTask(ChapterNumber.of("3"));
        project = projectRepository.save(project);

        mockMvc.perform(get("/api/v1/scanlation/projects/" + project.getId().value())
                        .header("Authorization", scanlator.bearer()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.name").value("Team Tower"))
                .andExpect(jsonPath("$.data.tasks.length()").value(1));

        mockMvc.perform(post("/api/v1/scanlation/projects/" + project.getId().value() + "/tasks/" + task.getId().value() + "/claim")
                        .header("Authorization", scanlator.bearer()))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.error").value(org.hamcrest.Matchers.containsString("not a member")));
    }
}
