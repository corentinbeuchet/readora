package com.readora.web.controller;

import com.readora.web.ReadoraApplication;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.http.MediaType;
import org.springframework.test.context.ActiveProfiles;

import java.util.UUID;

import static org.hamcrest.Matchers.startsWith;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/// US-10 end to end: a publish commits, the after-commit listener creates notifications in its own transaction.
@SpringBootTest(classes = ReadoraApplication.class)
@AutoConfigureMockMvc
@ActiveProfiles("test")
class NotificationIntegrationTest extends AuthTestSupport {

    private static final String PAGE = "{\"pageNumber\":1,\"storageKey\":\"n/p1.webp\",\"cdnUrl\":\"https://cdn.readora.com/n/p1.webp\",\"width\":800,\"height\":1200}";

    @Test
    @DisplayName("Publishing a chapter notifies library readers (not muted ones); the bell counts and clears")
    void newChapterNotifications() throws Exception {
        Session team = register();
        String workId = createWork(team);
        Session kenji = register();
        Session muted = register();
        for (Session reader : new Session[]{kenji, muted}) {
            mockMvc.perform(put("/api/v1/library/" + workId).header("Authorization", reader.bearer())).andExpect(status().isOk());
        }
        mockMvc.perform(put("/api/v1/library/" + workId + "/notifications").header("Authorization", muted.bearer())
                .contentType(MediaType.APPLICATION_JSON).content("{\"enabled\":false}")).andExpect(status().isOk());

        String chapterId = publish(team, workId, "7");

        mockMvc.perform(get("/api/v1/notifications/unread-count").header("Authorization", kenji.bearer()))
                .andExpect(jsonPath("$.data.count").value(1));
        mockMvc.perform(get("/api/v1/notifications").header("Authorization", kenji.bearer()))
                .andExpect(jsonPath("$.data[0].type").value("NEW_CHAPTER"))
                .andExpect(jsonPath("$.data[0].message", startsWith("Notified Work")))
                .andExpect(jsonPath("$.data[0].link").value("/read/" + chapterId));
        mockMvc.perform(get("/api/v1/notifications").header("Authorization", muted.bearer()))
                .andExpect(jsonPath("$.data.length()").value(0));

        mockMvc.perform(post("/api/v1/notifications/read-all").header("Authorization", kenji.bearer())).andExpect(status().isOk());
        mockMvc.perform(get("/api/v1/notifications/unread-count").header("Authorization", kenji.bearer()))
                .andExpect(jsonPath("$.data.count").value(0));
    }

    @Test
    @DisplayName("A reply notifies the parent comment's author, never yourself; muting needs the series in the library")
    void replyNotifications() throws Exception {
        Session team = register();
        String workId = createWork(team);
        String chapterId = publish(team, workId, "1");
        Session kenji = register();
        Session aoi = register();

        var comment = mockMvc.perform(post("/api/v1/comments/chapter/" + chapterId).header("Authorization", kenji.bearer())
                        .contentType(MediaType.APPLICATION_JSON).content("{\"content\":\"What a chapter\",\"isSpoiler\":false}"))
                .andExpect(status().isOk()).andReturn();
        String commentId = json(comment).path("data").path("id").asString();
        mockMvc.perform(post("/api/v1/comments/chapter/" + chapterId).header("Authorization", kenji.bearer())
                        .contentType(MediaType.APPLICATION_JSON).content("{\"content\":\"Replying to myself\",\"isSpoiler\":false,\"parentId\":\"" + commentId + "\"}"))
                .andExpect(status().isOk());
        mockMvc.perform(post("/api/v1/comments/chapter/" + chapterId).header("Authorization", aoi.bearer())
                        .contentType(MediaType.APPLICATION_JSON).content("{\"content\":\"Totally agree\",\"isSpoiler\":false,\"parentId\":\"" + commentId + "\"}"))
                .andExpect(status().isOk());

        mockMvc.perform(get("/api/v1/notifications").header("Authorization", kenji.bearer()))
                .andExpect(jsonPath("$.data.length()").value(1))
                .andExpect(jsonPath("$.data[0].type").value("COMMENT_REPLY"))
                .andExpect(jsonPath("$.data[0].message").value(aoi.username() + " replied to your comment"))
                .andExpect(jsonPath("$.data[0].link", startsWith("/read/" + chapterId + "?comment=")));

        mockMvc.perform(put("/api/v1/library/" + workId + "/notifications").header("Authorization", aoi.bearer())
                        .contentType(MediaType.APPLICATION_JSON).content("{\"enabled\":false}"))
                .andExpect(status().isNotFound());
        mockMvc.perform(get("/api/v1/notifications")).andExpect(status().isUnauthorized());
    }

    private String createWork(Session team) throws Exception {
        var work = mockMvc.perform(post("/api/v1/works").header("Authorization", team.bearer())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"title\":\"Notified Work " + UUID.randomUUID() + "\",\"type\":\"MANHWA\",\"genres\":[\"Action\"]}"))
                .andExpect(status().isCreated()).andReturn();
        return json(work).path("data").path("id").asString();
    }

    private String publish(Session team, String workId, String number) throws Exception {
        var chapter = mockMvc.perform(post("/api/v1/works/" + workId + "/chapters/direct").header("Authorization", team.bearer())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"teamId\":\"" + teamOf(team, workId) + "\",\"chapterNumber\":\"" + number + "\",\"title\":\"Ch\",\"pages\":[" + PAGE + "]}"))
                .andExpect(status().isCreated()).andReturn();
        return json(chapter).path("data").path("id").asString();
    }
}
