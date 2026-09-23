package com.readora.web.controller;

import com.readora.web.ReadoraApplication;
import com.readora.web.dto.LoginRequest;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;
import org.junit.jupiter.api.Test;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.http.MediaType;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.TestPropertySource;

import static org.hamcrest.Matchers.endsWith;
import static org.hamcrest.Matchers.hasItem;
import static org.hamcrest.Matchers.hasItems;
import static org.hamcrest.Matchers.not;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.content;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/// The `local` profile's seed (db/seed-local) must give working logins for every role and a usable demo team.
@SpringBootTest(classes = ReadoraApplication.class)
@AutoConfigureMockMvc
@ActiveProfiles({"test", "local"})
@TestPropertySource(properties = "spring.datasource.url=jdbc:h2:mem:readora_local_seed;DB_CLOSE_DELAY=-1;DB_CLOSE_ON_EXIT=FALSE;MODE=PostgreSQL")
class LocalSeedIntegrationTest extends AuthTestSupport {

    private static final String PASSWORD = "readora-dev";
    private static final String DEMO_PROJECT = "00000000-0000-4000-9000-000000000101";
    private static final String SOLO_LEVELING_DEMO_TEAM_CHAPTER_1 = "00000000-0000-4000-b011-000000000001";

    @ParameterizedTest(name = "{0} can log in and has {1}")
    @CsvSource({
            "reader,      LIBRARY_USE,     TASK_CLAIM",
            "kenji,       LIBRARY_USE,     TASK_CLAIM",
            "admin,       USER_MANAGE,     NONE",
            "moderator,   COMMENT_MODERATE, USER_MANAGE",
            "leader,      TASK_CLAIM,      USER_MANAGE",
            "cleaner,     TASK_CLAIM,      USER_MANAGE",
            "translator,  TASK_SUBMIT,     USER_MANAGE",
            "typesetter,  TASK_SUBMIT,     USER_MANAGE",
            "proofreader, TASK_SUBMIT,     USER_MANAGE",
            "quality,     CHAPTER_PUBLISH, USER_MANAGE"
    })
    @DisplayName("Every seeded account logs in with the dev password and gets its role's permissions")
    void seededAccountsLogIn(String username, String expectedPermission, String absentPermission) throws Exception {
        var login = mockMvc.perform(post("/api/v1/auth/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(new LoginRequest(username + "@readora.local", PASSWORD))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.user.username").value(username))
                .andExpect(jsonPath("$.data.user.permissions", hasItem(expectedPermission)));
        if (!"NONE".equals(absentPermission)) {
            login.andExpect(jsonPath("$.data.user.permissions", not(hasItem(absentPermission))));
        }
    }

    @Test
    @DisplayName("The demo scanlation project has one member per team role and one open task per stage")
    void demoTeamIsSeeded() throws Exception {
        String token = loginAs("leader");

        mockMvc.perform(get("/api/v1/scanlation/projects/" + DEMO_PROJECT).header("Authorization", "Bearer " + token))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.name").value("Readora Demo Team"))
                .andExpect(jsonPath("$.data.members.length()").value(6))
                .andExpect(jsonPath("$.data.tasks.length()").value(5));
    }

    @Test
    @DisplayName("The seeded catalog answers the US-04 searches (genres wanted/excluded, author search)")
    void seededCatalogIsSearchable() throws Exception {
        mockMvc.perform(get("/api/v1/works").param("genre", "Action").param("excludeGenre", "Romance").param("q", "e"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.items[*].title", hasItems("Omniscient Reader", "Berserk")))
                .andExpect(jsonPath("$.data.items[*].title", not(hasItem("Horimiya"))));
        mockMvc.perform(get("/api/v1/works").param("q", "miura"))
                .andExpect(jsonPath("$.data.items[0].title").value("Berserk"))
                .andExpect(jsonPath("$.data.items[0].demographic").value("SEINEN"));
    }

    @Test
    @DisplayName("Seeded ratings put two series in the Top rated ranking (5 ratings each), with one written review")
    void seededRatingsFillTopRated() throws Exception {
        mockMvc.perform(get("/api/v1/rankings/top-rated"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data[0].work.title").value("Berserk"))
                .andExpect(jsonPath("$.data[1].work.title").value("Solo Leveling"));
        mockMvc.perform(get("/api/v1/works/00000000-0000-4000-9000-000000000014/reviews"))
                .andExpect(jsonPath("$.data[0].verdict").value("A dark masterpiece; the art alone is worth it."));
    }

    @Test
    @DisplayName("Seeded chapters can be read: their pages and the series covers are stored placeholder images")
    void seededChaptersHaveImages() throws Exception {
        mockMvc.perform(get("/api/v1/chapters/" + SOLO_LEVELING_DEMO_TEAM_CHAPTER_1))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.pages.length()").value(5));
        mockMvc.perform(get("/api/v1/storage/assets/seed/pages/" + SOLO_LEVELING_DEMO_TEAM_CHAPTER_1 + "/p1.png"))
                .andExpect(status().isOk())
                .andExpect(content().contentType(MediaType.IMAGE_PNG));
        mockMvc.perform(get("/api/v1/works/00000000-0000-4000-9000-000000000013"))
                .andExpect(jsonPath("$.data.coverImageUrl").value(endsWith("seed/covers/00000000-0000-4000-9000-000000000013.png")));
    }

    @Test
    @DisplayName("Seeded chapters come in two teams' versions of Solo Leveling")
    void seededChaptersHaveTwoVersions() throws Exception {
        mockMvc.perform(get("/api/v1/works/00000000-0000-4000-9000-000000000011/chapters"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.length()").value(12))
                .andExpect(jsonPath("$.data[*].team.name", hasItems("Readora Demo Team", "Moonlight Scans")));
    }

    @Test
    @DisplayName("The seeded reader finished Horimiya and is on chapter 4 of Solo Leveling")
    void seededReaderHasProgress() throws Exception {
        String token = loginAs("reader");

        mockMvc.perform(get("/api/v1/reading/works/00000000-0000-4000-9000-000000000013").header("Authorization", "Bearer " + token))
                .andExpect(jsonPath("$.data.finishedChapterNumbers.length()").value(5))
                .andExpect(jsonPath("$.data.nextChapterNumber").doesNotExist());
        mockMvc.perform(get("/api/v1/reading/works/00000000-0000-4000-9000-000000000011").header("Authorization", "Bearer " + token))
                .andExpect(jsonPath("$.data.nextChapterNumber").value("4"));
    }

    @Test
    @DisplayName("The seeded moderation queue has two open comment reports")
    void seededModerationQueue() throws Exception {
        mockMvc.perform(get("/api/v1/moderation/reports").header("Authorization", "Bearer " + loginAs("moderator")))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.length()").value(2));
    }

    private String loginAs(String username) throws Exception {
        var result = mockMvc.perform(post("/api/v1/auth/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(new LoginRequest(username + "@readora.local", PASSWORD))))
                .andExpect(status().isOk())
                .andReturn();
        return json(result).path("data").path("accessToken").asString();
    }
}
