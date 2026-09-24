package com.readora.web.controller;

import com.readora.web.ReadoraApplication;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.http.MediaType;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.ResultActions;

import java.util.UUID;

import static org.hamcrest.Matchers.hasItem;
import static org.hamcrest.Matchers.not;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/// US-11: a team's first chapter waits for a moderator, through real HTTP, auth and the after-commit listener.
@SpringBootTest(classes = ReadoraApplication.class)
@AutoConfigureMockMvc
@ActiveProfiles("test")
class ChapterReviewIntegrationTest extends AuthTestSupport {

    private static final String PAGE = "{\"pageNumber\":1,\"storageKey\":\"r/p1.webp\",\"cdnUrl\":\"https://cdn.readora.com/r/p1.webp\",\"width\":800,\"height\":1200}";

    @Test
    @DisplayName("Moderators see a first chapter with its pages; readers may not review; sent back, the leaders are told and it can come again")
    void reviewFlow() throws Exception {
        Session leader = register();
        String workId = aSeriesLedBy(leader);
        String teamId = teamOf(leader, workId);
        String chapterId = idOf(whenIPublish(leader, workId, teamId, "1").andExpect(jsonPath("$.data.status").value("PENDING_REVIEW")));
        Session moderator = aModerator();

        mockMvc.perform(get("/api/v1/moderation/chapters").header("Authorization", moderator.bearer()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data[?(@.chapterId == '" + chapterId + "')].team.id").value(teamId))
                .andExpect(jsonPath("$.data[?(@.chapterId == '" + chapterId + "')].pages[0].cdnUrl").value("https://cdn.readora.com/r/p1.webp"));
        mockMvc.perform(get("/api/v1/moderation/chapters").header("Authorization", leader.bearer())).andExpect(status().isForbidden());
        mockMvc.perform(post("/api/v1/moderation/chapters/" + chapterId + "/approve").header("Authorization", leader.bearer()))
                .andExpect(status().isForbidden());

        mockMvc.perform(post("/api/v1/moderation/chapters/" + chapterId + "/send-back").header("Authorization", moderator.bearer()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.status").value("DRAFT"));
        mockMvc.perform(post("/api/v1/moderation/chapters/" + chapterId + "/approve").header("Authorization", moderator.bearer()))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("CHAPTER_NOT_WAITING"));
        mockMvc.perform(get("/api/v1/notifications").header("Authorization", leader.bearer()))
                .andExpect(jsonPath("$.data[0].type").value("CHAPTER_SENT_BACK"))
                .andExpect(jsonPath("$.data[0].link").value("/scanlation"));

        String again = idOf(whenIPublish(leader, workId, teamId, "1").andExpect(jsonPath("$.data.status").value("PENDING_REVIEW")));
        mockMvc.perform(post("/api/v1/moderation/chapters/" + again + "/approve").header("Authorization", moderator.bearer()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.status").value("PUBLISHED"));
        mockMvc.perform(get("/api/v1/chapters/" + again)).andExpect(status().isOk());
        mockMvc.perform(get("/api/v1/moderation/chapters").header("Authorization", moderator.bearer()))
                .andExpect(jsonPath("$.data[*].chapterId", not(hasItem(again))));
        whenIPublish(leader, workId, teamId, "2").andExpect(jsonPath("$.data.status").value("PUBLISHED"));
    }

    private String aSeriesLedBy(Session leader) throws Exception {
        var work = mockMvc.perform(post("/api/v1/works").header("Authorization", leader.bearer()).contentType(MediaType.APPLICATION_JSON)
                        .content("{\"title\":\"Reviewed Work " + UUID.randomUUID() + "\",\"type\":\"MANHWA\",\"genres\":[\"Action\"],\"teamId\":\""
                                + aTeamLedBy(leader) + "\"}"))
                .andExpect(status().isCreated()).andReturn();
        return json(work).path("data").path("id").asString();
    }

    private ResultActions whenIPublish(Session publisher, String workId, String teamId, String number) throws Exception {
        return mockMvc.perform(post("/api/v1/works/" + workId + "/chapters/direct").header("Authorization", publisher.bearer())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"teamId\":\"" + teamId + "\",\"chapterNumber\":\"" + number + "\",\"title\":\"Ch\",\"pages\":[" + PAGE + "]}"))
                .andExpect(status().isCreated());
    }

    private String idOf(ResultActions result) throws Exception {
        return json(result.andReturn()).path("data").path("id").asString();
    }
}
