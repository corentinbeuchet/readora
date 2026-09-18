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

import static org.hamcrest.Matchers.hasItem;
import static org.hamcrest.Matchers.not;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
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

    @ParameterizedTest(name = "{0} can log in and has {1}")
    @CsvSource({
            "reader,      COMMENT_WRITE,   BOOKMARK_WRITE",
            "premium,     BOOKMARK_WRITE,  TASK_CLAIM",
            "admin,       USER_MANAGE,     NONE",
            "leader,      TASK_CLAIM,      USER_MANAGE",
            "cleaner,     TASK_CLAIM,      USER_MANAGE",
            "translator,  TASK_SUBMIT,     USER_MANAGE",
            "typesetter,  TASK_SUBMIT,     USER_MANAGE",
            "proofreader, TASK_SUBMIT,     USER_MANAGE",
            "quality,     CHAPTER_PUBLISH, USER_MANAGE"
    })
    @DisplayName("Every seeded account logs in with the dev password and gets its role's permissions")
    void seededAccountsLogIn(String username, String expectedPermission, String absentPermission) throws Exception {
        String token = loginAs(username);

        var me = mockMvc.perform(get("/api/v1/auth/me").header("Authorization", "Bearer " + token))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.username").value(username))
                .andExpect(jsonPath("$.data.permissions", hasItem(expectedPermission)));
        if (!"NONE".equals(absentPermission)) {
            me.andExpect(jsonPath("$.data.permissions", not(hasItem(absentPermission))));
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

    private String loginAs(String username) throws Exception {
        var result = mockMvc.perform(post("/api/v1/auth/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(new LoginRequest(username + "@readora.local", PASSWORD))))
                .andExpect(status().isOk())
                .andReturn();
        return json(result).path("data").path("accessToken").asString();
    }
}
