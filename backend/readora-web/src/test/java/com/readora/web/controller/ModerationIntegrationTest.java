package com.readora.web.controller;

import com.readora.application.port.out.ChapterRepositoryPort;
import com.readora.application.port.out.WorkRepositoryPort;
import com.readora.domain.common.UserId;
import com.readora.domain.work.*;
import com.readora.web.ReadoraApplication;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.http.MediaType;
import org.springframework.test.context.ActiveProfiles;

import java.util.List;
import java.util.Set;

import static org.hamcrest.Matchers.hasItem;
import static org.hamcrest.Matchers.not;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/// US-11 comment reports and the moderation queue through real HTTP and the real database.
@SpringBootTest(classes = ReadoraApplication.class)
@AutoConfigureMockMvc
@ActiveProfiles("test")
class ModerationIntegrationTest extends AuthTestSupport {

    @Autowired
    private WorkRepositoryPort workRepository;

    @Autowired
    private ChapterRepositoryPort chapterRepository;

    @Test
    @DisplayName("Readers report, only moderators see the queue; hiding removes the comment, dismissing keeps it")
    void reportHideDismiss() throws Exception {
        String chapterId = chapter();
        Session aoi = register();
        Session kenji = register();
        Session mina = aModerator();
        String spoiler = comment(aoi, chapterId, "He dies in the end");
        String rant = comment(aoi, chapterId, "Just an opinion");

        String report = report(kenji, spoiler, "UNMARKED_SPOILER");
        mockMvc.perform(post("/api/v1/comments/" + spoiler + "/reports").header("Authorization", kenji.bearer())
                        .contentType(MediaType.APPLICATION_JSON).content("{\"reason\":\"SPAM\"}"))
                .andExpect(jsonPath("$.data.reportId").value(report));
        mockMvc.perform(post("/api/v1/comments/" + spoiler + "/reports").header("Authorization", aoi.bearer())
                        .contentType(MediaType.APPLICATION_JSON).content("{\"reason\":\"SPAM\"}"))
                .andExpect(status().isBadRequest());

        mockMvc.perform(get("/api/v1/moderation/reports").header("Authorization", kenji.bearer())).andExpect(status().isForbidden());
        mockMvc.perform(get("/api/v1/moderation/reports").header("Authorization", mina.bearer()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data[*].reportId", hasItem(report)))
                .andExpect(jsonPath("$.data[?(@.reportId == '" + report + "')].content", hasItem("He dies in the end")));

        mockMvc.perform(post("/api/v1/moderation/reports/" + report + "/hide").header("Authorization", mina.bearer())).andExpect(status().isOk());
        mockMvc.perform(get("/api/v1/comments/chapter/" + chapterId))
                .andExpect(jsonPath("$.data[*].id", not(hasItem(spoiler))))
                .andExpect(jsonPath("$.data[*].id", hasItem(rant)));
        mockMvc.perform(post("/api/v1/moderation/reports/" + report + "/hide").header("Authorization", mina.bearer()))
                .andExpect(status().isNotFound());
        mockMvc.perform(post("/api/v1/comments/chapter/" + chapterId).header("Authorization", kenji.bearer())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"content\":\"reply\",\"isSpoiler\":false,\"parentId\":\"" + spoiler + "\"}"))
                .andExpect(status().isNotFound());

        String second = report(kenji, rant, "HARASSMENT");
        mockMvc.perform(post("/api/v1/moderation/reports/" + second + "/dismiss").header("Authorization", mina.bearer())).andExpect(status().isOk());
        mockMvc.perform(get("/api/v1/comments/chapter/" + chapterId)).andExpect(jsonPath("$.data[*].id", hasItem(rant)));
    }

    private String chapter() {
        Work work = workRepository.save(Work.create("Moderated Work", "", WorkType.MANGA, "c.webp", Set.of("Action")));
        Chapter chapter = Chapter.createDraft(work.getId(), ChapterNumber.of("1"), "Ch 1", anyTeam());
        chapter.updatePages(List.of(PageAsset.create(1, "m/p1.webp", null)));
        chapter.publish(UserId.of("publisher"));
        return chapterRepository.save(chapter).getId().value().toString();
    }

    private String comment(Session author, String chapterId, String text) throws Exception {
        var result = mockMvc.perform(post("/api/v1/comments/chapter/" + chapterId).header("Authorization", author.bearer())
                        .contentType(MediaType.APPLICATION_JSON).content("{\"content\":\"" + text + "\",\"isSpoiler\":false}"))
                .andExpect(status().isOk()).andReturn();
        return json(result).path("data").path("id").asString();
    }

    private String report(Session reporter, String commentId, String reason) throws Exception {
        var result = mockMvc.perform(post("/api/v1/comments/" + commentId + "/reports").header("Authorization", reporter.bearer())
                        .contentType(MediaType.APPLICATION_JSON).content("{\"reason\":\"" + reason + "\"}"))
                .andExpect(status().isCreated()).andReturn();
        return json(result).path("data").path("reportId").asString();
    }
}
