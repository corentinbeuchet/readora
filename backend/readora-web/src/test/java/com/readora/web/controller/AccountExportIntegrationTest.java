package com.readora.web.controller;

import com.readora.application.port.out.ChapterRepositoryPort;
import com.readora.application.port.out.WorkRepositoryPort;
import com.readora.domain.common.UserId;
import com.readora.domain.work.Chapter;
import com.readora.domain.work.ChapterNumber;
import com.readora.domain.work.PageAsset;
import com.readora.domain.work.Work;
import com.readora.domain.work.WorkType;
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
import java.util.UUID;

import static org.hamcrest.Matchers.containsString;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/// US-15 through real HTTP and the real export queries (H2): one downloadable JSON file with the account and what the
/// reader has, and only theirs.
@SpringBootTest(classes = ReadoraApplication.class)
@AutoConfigureMockMvc
@ActiveProfiles("test")
class AccountExportIntegrationTest extends AuthTestSupport {

    @Autowired
    private WorkRepositoryPort workRepository;

    @Autowired
    private ChapterRepositoryPort chapterRepository;

    @Test
    @DisplayName("The export holds my account, library, reading, comments, ratings and teams, and nobody else's")
    void exportHoldsWhatIsMine() throws Exception {
        Session camille = register();
        Session other = register();
        String title = "Exported Work " + UUID.randomUUID();
        Work work = workRepository.save(Work.create(title, "", WorkType.MANGA, "c.webp", Set.of("Action")));
        String chapterId = aPublishedChapterOf(work);
        String teamName = "Export Team " + UUID.randomUUID();
        aTeamLedBy(camille, teamName);
        mockMvc.perform(put("/api/v1/library/" + work.getId().value()).header("Authorization", camille.bearer())).andExpect(status().isOk());
        mockMvc.perform(put("/api/v1/reading/chapters/" + chapterId).header("Authorization", camille.bearer())
                .contentType(MediaType.APPLICATION_JSON).content("{\"finished\":true}")).andExpect(status().isOk());
        mockMvc.perform(post("/api/v1/comments/chapter/" + chapterId).header("Authorization", camille.bearer())
                .contentType(MediaType.APPLICATION_JSON).content("{\"content\":\"What a chapter\",\"isSpoiler\":false}")).andExpect(status().isOk());
        mockMvc.perform(post("/api/v1/comments/chapter/" + chapterId).header("Authorization", other.bearer())
                .contentType(MediaType.APPLICATION_JSON).content("{\"content\":\"Not Camille's\",\"isSpoiler\":false}")).andExpect(status().isOk());
        mockMvc.perform(put("/api/v1/works/" + work.getId().value() + "/rating").header("Authorization", camille.bearer())
                .contentType(MediaType.APPLICATION_JSON).content("{\"score\":9}")).andExpect(status().isOk());

        mockMvc.perform(get("/api/v1/account/export")).andExpect(status().isUnauthorized());
        mockMvc.perform(get("/api/v1/account/export").header("Authorization", camille.bearer()))
                .andExpect(status().isOk())
                .andExpect(header().string("Content-Disposition", containsString("readora-account.json")))
                .andExpect(jsonPath("$.username").value(camille.username()))
                .andExpect(jsonPath("$.email").value(camille.email()))
                .andExpect(jsonPath("$.passwordHash").doesNotExist())
                .andExpect(jsonPath("$.data.library[0].series").value(title))
                .andExpect(jsonPath("$.data.readingHistory[0].chapterNumber").value("1"))
                .andExpect(jsonPath("$.data.readingHistory[0].finished").value(true))
                .andExpect(jsonPath("$.data.comments.length()").value(1))
                .andExpect(jsonPath("$.data.comments[0].content").value("What a chapter"))
                .andExpect(jsonPath("$.data.ratings[0].score").value(9))
                .andExpect(jsonPath("$.data.teams[0].team").value(teamName))
                .andExpect(jsonPath("$.data.teams[0].roles[0]").value("LEADER"));
    }

    private String aPublishedChapterOf(Work work) {
        Chapter chapter = Chapter.createDraft(work.getId(), ChapterNumber.of("1"), "Ch 1", anyTeam());
        chapter.updatePages(List.of(PageAsset.create(1, "x/p1.webp", null)));
        chapter.publish(UserId.of("publisher"));
        return chapterRepository.save(chapter).getId().value().toString();
    }
}
