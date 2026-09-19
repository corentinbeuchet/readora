package com.readora.web.controller;

import com.readora.web.ReadoraApplication;
import com.readora.web.dto.LoginRequest;
import com.readora.web.dto.RegisterRequest;
import jakarta.servlet.http.Cookie;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.http.MediaType;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MvcResult;

import static org.assertj.core.api.Assertions.assertThat;
import static org.hamcrest.Matchers.containsInAnyOrder;
import static org.hamcrest.Matchers.containsString;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.cookie;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest(classes = ReadoraApplication.class)
@AutoConfigureMockMvc
@ActiveProfiles("test")
class AuthControllerIntegrationTest extends AuthTestSupport {

    @Test
    @DisplayName("Register returns 201 with access token, READER permissions and an HttpOnly refresh cookie")
    void registerIssuesTokensAndCookie() throws Exception {
        String email = "kenji_" + System.nanoTime() + "@readora.test";
        mockMvc.perform(post("/api/v1/auth/register")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(new RegisterRequest(email, "kenji_" + System.nanoTime() % 100000, PASSWORD))))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.success").value(true))
                .andExpect(jsonPath("$.data.accessToken").isNotEmpty())
                .andExpect(jsonPath("$.data.tokenType").value("Bearer"))
                .andExpect(jsonPath("$.data.user.email").value(email))
                .andExpect(jsonPath("$.data.user.roles[0]").value("READER"))
                .andExpect(jsonPath("$.data.user.permissions", containsInAnyOrder("COMMENT_WRITE", "COMMENT_UPVOTE", "LIBRARY_USE", "PAGE_REPORT", "RATE_WORK", "COMMENT_REPORT")))
                .andExpect(jsonPath("$.data.user.subscription.plan").value("FREE"))
                .andExpect(cookie().exists(REFRESH_COOKIE))
                .andExpect(cookie().httpOnly(REFRESH_COOKIE, true))
                .andExpect(cookie().path(REFRESH_COOKIE, "/api/v1/auth"))
                .andExpect(header().string("Set-Cookie", containsString("SameSite=Lax")));
    }

    @Test
    @DisplayName("Duplicate email on register returns 409")
    void duplicateEmailIsConflict() throws Exception {
        Session first = register();
        mockMvc.perform(post("/api/v1/auth/register")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(new RegisterRequest(first.email(), "another_name", PASSWORD))))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.success").value(false))
                .andExpect(jsonPath("$.error", containsString("already")));
    }

    @Test
    @DisplayName("Login with wrong password returns 401 JSON; correct password returns token; /me returns profile")
    void loginAndMe() throws Exception {
        Session registered = register();

        mockMvc.perform(post("/api/v1/auth/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(new LoginRequest(registered.email(), "wrong-password"))))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.success").value(false));

        Session logged = login(registered.email());
        assertThat(logged.accessToken()).isNotBlank();

        mockMvc.perform(get("/api/v1/auth/me").header("Authorization", logged.bearer()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.id").value(registered.userId()))
                .andExpect(jsonPath("$.data.username").value(registered.username()))
                .andExpect(jsonPath("$.data.permissions", containsInAnyOrder("COMMENT_WRITE", "COMMENT_UPVOTE", "LIBRARY_USE", "PAGE_REPORT", "RATE_WORK", "COMMENT_REPORT")));
    }

    @Test
    @DisplayName("Refresh rotates the cookie and returns a new access token; old cookie is rejected; logout revokes")
    void refreshRotatesAndLogoutRevokes() throws Exception {
        Session session = register();
        Cookie originalCookie = session.refreshCookie();
        assertThat(originalCookie).isNotNull();

        MvcResult refreshed = mockMvc.perform(post("/api/v1/auth/refresh").cookie(originalCookie))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.accessToken").isNotEmpty())
                .andExpect(cookie().exists(REFRESH_COOKIE))
                .andReturn();
        Cookie rotatedCookie = refreshed.getResponse().getCookie(REFRESH_COOKIE);
        assertThat(rotatedCookie.getValue()).isNotEqualTo(originalCookie.getValue());

        // The previous refresh token has been revoked by rotation.
        mockMvc.perform(post("/api/v1/auth/refresh").cookie(originalCookie))
                .andExpect(status().isUnauthorized());

        mockMvc.perform(post("/api/v1/auth/logout").cookie(rotatedCookie))
                .andExpect(status().isOk())
                .andExpect(cookie().maxAge(REFRESH_COOKIE, 0));

        mockMvc.perform(post("/api/v1/auth/refresh").cookie(rotatedCookie))
                .andExpect(status().isUnauthorized());
    }

    @Test
    @DisplayName("Refresh without cookie returns 401")
    void refreshWithoutCookieIsUnauthorized() throws Exception {
        mockMvc.perform(post("/api/v1/auth/refresh"))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.success").value(false));
    }

    @Test
    @DisplayName("Replaying a rotated refresh token revokes every session of that user (theft detection)")
    void refreshTokenReuseRevokesAllSessions() throws Exception {
        Session session = register();
        Cookie stolen = session.refreshCookie();

        MvcResult rotated = mockMvc.perform(post("/api/v1/auth/refresh").cookie(stolen))
                .andExpect(status().isOk())
                .andReturn();
        Cookie legitimate = rotated.getResponse().getCookie(REFRESH_COOKIE);

        // The attacker replays the old token (grace period is 0 in tests) ...
        mockMvc.perform(post("/api/v1/auth/refresh").cookie(stolen))
                .andExpect(status().isUnauthorized());

        // ... which also invalidates the legitimate, newer session.
        mockMvc.perform(post("/api/v1/auth/refresh").cookie(legitimate))
                .andExpect(status().isUnauthorized());
    }
}
