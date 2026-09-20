package com.readora.web.controller;

import com.readora.web.ReadoraApplication;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.http.MediaType;
import org.springframework.test.context.ActiveProfiles;

import java.util.UUID;

import static org.hamcrest.Matchers.containsString;
import static org.hamcrest.Matchers.hasItem;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.content;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/// US-12 public profiles, team pages, team follows and library export through real HTTP and the real database.
@SpringBootTest(classes = ReadoraApplication.class)
@AutoConfigureMockMvc
@ActiveProfiles("test")
class CommunityIntegrationTest extends AuthTestSupport {

    private static final String PAGE = "{\"pageNumber\":1,\"storageKey\":\"t/p1.webp\",\"cdnUrl\":\"https://cdn.readora.com/t/p1.webp\",\"width\":800,\"height\":1200}";

    @Test
    @DisplayName("Profiles and team pages are public; following a team feeds 'My library' updates; export is CSV or JSON")
    void communityFlow() throws Exception {
        Session leader = registerScanlator();
        String title = "Team Work, \"quoted\" " + UUID.randomUUID();
        var work = mockMvc.perform(post("/api/v1/works").header("Authorization", leader.bearer()).contentType(MediaType.APPLICATION_JSON)
                        .content("{\"title\":\"" + title.replace("\"", "\\\"") + "\",\"type\":\"MANHWA\",\"genres\":[\"Action\"]}"))
                .andExpect(status().isCreated()).andReturn();
        String workId = json(work).path("data").path("id").asString();
        var projects = mockMvc.perform(get("/api/v1/works/" + workId + "/projects").header("Authorization", leader.bearer())).andReturn();
        String teamId = json(projects).path("data").path(0).path("teamId").asString();
        var chapter = mockMvc.perform(post("/api/v1/works/" + workId + "/chapters/direct").header("Authorization", leader.bearer())
                        .contentType(MediaType.APPLICATION_JSON).content("{\"teamId\":\"" + teamId + "\",\"chapterNumber\":\"1\",\"title\":\"Ch\",\"pages\":[" + PAGE + "]}"))
                .andExpect(status().isCreated()).andReturn();
        String chapterId = json(chapter).path("data").path("id").asString();

        Session kenji = register();
        mockMvc.perform(put("/api/v1/teams/" + teamId + "/follow")).andExpect(status().isUnauthorized());
        mockMvc.perform(put("/api/v1/teams/" + teamId + "/follow").header("Authorization", kenji.bearer())).andExpect(status().isOk());
        mockMvc.perform(put("/api/v1/teams/" + teamId + "/follow").header("Authorization", kenji.bearer())).andExpect(status().isOk());
        mockMvc.perform(get("/api/v1/teams/" + teamId).header("Authorization", kenji.bearer()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.name").value(title + " Workspace"))
                .andExpect(jsonPath("$.data.series.length()").value(1))
                .andExpect(jsonPath("$.data.series[0].work.title").value(title))
                .andExpect(jsonPath("$.data.series[0].chapterCount").value(1))
                .andExpect(jsonPath("$.data.members[0].username").value(leader.username()))
                .andExpect(jsonPath("$.data.latestChapters[0].id").value(chapterId))
                .andExpect(jsonPath("$.data.followers").value(1))
                .andExpect(jsonPath("$.data.following").value(true));
        mockMvc.perform(get("/api/v1/teams/" + teamId)).andExpect(jsonPath("$.data.following").value(false));
        mockMvc.perform(get("/api/v1/chapters/" + chapterId))
                .andExpect(jsonPath("$.data.team.id").value(teamId))
                .andExpect(jsonPath("$.data.team.name").value(title + " Workspace"));
        mockMvc.perform(get("/api/v1/updates").param("mine", "true").header("Authorization", kenji.bearer()))
                .andExpect(jsonPath("$.data[*].chapterId", hasItem(chapterId)));

        mockMvc.perform(put("/api/v1/library/" + workId).header("Authorization", kenji.bearer())).andExpect(status().isOk());
        mockMvc.perform(put("/api/v1/reading/chapters/" + chapterId).header("Authorization", kenji.bearer())
                .contentType(MediaType.APPLICATION_JSON).content("{\"finished\":true}")).andExpect(status().isOk());
        mockMvc.perform(get("/api/v1/users/" + kenji.username() + "/profile"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.chaptersRead").value(1))
                .andExpect(jsonPath("$.data.favouriteGenres[0]").value("Action"));
        mockMvc.perform(get("/api/v1/users/no-such-reader-" + UUID.randomUUID() + "/profile")).andExpect(status().isNotFound());

        mockMvc.perform(get("/api/v1/library/export").header("Authorization", kenji.bearer()))
                .andExpect(status().isOk())
                .andExpect(header().string("Content-Disposition", containsString("readora-library.csv")))
                .andExpect(content().string(containsString("title,status,last_chapter_read")))
                .andExpect(content().string(containsString("\"" + title.replace("\"", "\"\"") + "\",READING,1")));
        mockMvc.perform(get("/api/v1/library/export").param("format", "json").header("Authorization", kenji.bearer()))
                .andExpect(jsonPath("$[0].title").value(title))
                .andExpect(jsonPath("$[0].lastChapterRead").value("1"));

        mockMvc.perform(delete("/api/v1/teams/" + teamId + "/follow").header("Authorization", kenji.bearer())).andExpect(status().isOk());
        mockMvc.perform(get("/api/v1/teams/" + teamId)).andExpect(jsonPath("$.data.followers").value(0));
        mockMvc.perform(put("/api/v1/teams/" + UUID.randomUUID() + "/follow").header("Authorization", kenji.bearer()))
                .andExpect(status().isNotFound());
    }
}
