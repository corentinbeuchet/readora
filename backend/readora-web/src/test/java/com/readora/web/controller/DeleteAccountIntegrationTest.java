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
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.ResultActions;

import java.util.List;
import java.util.Set;

import static org.assertj.core.api.Assertions.assertThat;
import static org.hamcrest.Matchers.startsWith;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/// US-15 through real HTTP and the real erasure SQL (H2): what only the reader had is gone, comments stay under a
/// placeholder name, the account can't be used again.
@SpringBootTest(classes = ReadoraApplication.class)
@AutoConfigureMockMvc
@ActiveProfiles("test")
class DeleteAccountIntegrationTest extends AuthTestSupport {

    @Autowired
    private WorkRepositoryPort workRepository;

    @Autowired
    private ChapterRepositoryPort chapterRepository;

    @Autowired
    private JdbcClient jdbc;

    @Test
    @DisplayName("Deleting my account erases what was only mine, keeps my comment under a placeholder and signs me out")
    void deleteAccount() throws Exception {
        Session camille = register();
        Work work = workRepository.save(Work.create("Erased Work", "", WorkType.MANGA, "c.webp", Set.of("Action")));
        String chapterId = aPublishedChapterOf(work);
        mockMvc.perform(put("/api/v1/library/" + work.getId().value()).header("Authorization", camille.bearer())).andExpect(status().isOk());
        String commentId = json(mockMvc.perform(post("/api/v1/comments/chapter/" + chapterId).header("Authorization", camille.bearer())
                        .contentType(MediaType.APPLICATION_JSON).content("{\"content\":\"What a chapter\",\"isSpoiler\":false}"))
                .andExpect(status().isOk()).andReturn()).path("data").path("id").asString();
        Session aoi = register();
        String aoiComment = json(mockMvc.perform(post("/api/v1/comments/chapter/" + chapterId).header("Authorization", aoi.bearer())
                        .contentType(MediaType.APPLICATION_JSON).content("{\"content\":\"Agreed\",\"isSpoiler\":false}"))
                .andExpect(status().isOk()).andReturn()).path("data").path("id").asString();
        mockMvc.perform(post("/api/v1/comments/" + aoiComment + "/upvote").header("Authorization", camille.bearer()))
                .andExpect(status().isOk()).andExpect(jsonPath("$.data.upvotes").value(1));

        mockMvc.perform(post("/api/v1/auth/delete-account").contentType(MediaType.APPLICATION_JSON).content("{\"password\":\"" + PASSWORD + "\"}"))
                .andExpect(status().isUnauthorized());
        whenIDeleteMyAccount(camille, "not-the-password").andExpect(status().isBadRequest()).andExpect(jsonPath("$.code").value("WRONG_PASSWORD"));

        whenIDeleteMyAccount(camille, PASSWORD)
                .andExpect(status().isOk())
                .andExpect(header().string("Set-Cookie", org.hamcrest.Matchers.containsString("Max-Age=0")));

        assertThat(rowsOf("library_entries", "user_id", camille.userId())).isZero();
        assertThat(rowsOf("comment_upvotes", "user_id", camille.userId())).isZero();
        mockMvc.perform(get("/api/v1/comments/chapter/" + chapterId))
                .andExpect(jsonPath("$.data[?(@.id == '" + aoiComment + "')].upvotes").value(org.hamcrest.Matchers.everyItem(org.hamcrest.Matchers.is(0))));
        mockMvc.perform(get("/api/v1/comments/chapter/" + chapterId))
                .andExpect(jsonPath("$.data[?(@.id == '" + commentId + "')].authorUsername").value(org.hamcrest.Matchers.everyItem(startsWith("deleted_"))));
        mockMvc.perform(get("/api/v1/users/" + camille.username() + "/profile")).andExpect(status().isNotFound());
        mockMvc.perform(post("/api/v1/auth/refresh").cookie(camille.refreshCookie())).andExpect(status().isUnauthorized());
        mockMvc.perform(post("/api/v1/auth/login").contentType(MediaType.APPLICATION_JSON)
                        .content("{\"email\":\"" + camille.email() + "\",\"password\":\"" + PASSWORD + "\"}"))
                .andExpect(status().isUnauthorized());
    }

    @Test
    @DisplayName("The only leader of a team is asked to name another one first, and nothing is deleted")
    void onlyLeaderIsRefused() throws Exception {
        Session mina = register();
        aTeamLedBy(mina);

        whenIDeleteMyAccount(mina, PASSWORD).andExpect(status().isBadRequest()).andExpect(jsonPath("$.code").value("LAST_LEADER"));

        mockMvc.perform(get("/api/v1/users/" + mina.username() + "/profile")).andExpect(status().isOk());
    }

    private ResultActions whenIDeleteMyAccount(Session session, String password) throws Exception {
        return mockMvc.perform(post("/api/v1/auth/delete-account").header("Authorization", session.bearer())
                .contentType(MediaType.APPLICATION_JSON).content("{\"password\":\"" + password + "\"}"));
    }

    private String aPublishedChapterOf(Work work) {
        Chapter chapter = Chapter.createDraft(work.getId(), ChapterNumber.of("1"), "Ch 1", anyTeam());
        chapter.updatePages(List.of(PageAsset.create(1, "d/p1.webp", null)));
        chapter.publish(UserId.of("publisher"));
        return chapterRepository.save(chapter).getId().value().toString();
    }

    private long rowsOf(String table, String column, String userId) {
        return jdbc.sql("SELECT COUNT(*) FROM " + table + " WHERE " + column + " = ?").param(userId).query(Long.class).single();
    }
}
