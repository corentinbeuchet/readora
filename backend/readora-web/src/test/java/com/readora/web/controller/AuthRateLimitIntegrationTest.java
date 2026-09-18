package com.readora.web.controller;

import com.readora.web.ReadoraApplication;
import com.readora.web.dto.LoginRequest;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.http.MediaType;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.TestPropertySource;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest(classes = ReadoraApplication.class)
@AutoConfigureMockMvc
@ActiveProfiles("test")
@TestPropertySource(properties = {"readora.security.rate-limit.enabled=true", "readora.security.rate-limit.max-attempts=3"})
class AuthRateLimitIntegrationTest extends AuthTestSupport {

    @Test
    @DisplayName("Repeated failed logins from one client are throttled with 429 and Retry-After")
    void loginIsRateLimited() throws Exception {
        String body = objectMapper.writeValueAsString(new LoginRequest("nobody@readora.test", "wrong-password"));
        for (int i = 0; i < 3; i++) {
            mockMvc.perform(post("/api/v1/auth/login").contentType(MediaType.APPLICATION_JSON).content(body))
                    .andExpect(status().isUnauthorized());
        }

        mockMvc.perform(post("/api/v1/auth/login").contentType(MediaType.APPLICATION_JSON).content(body))
                .andExpect(status().isTooManyRequests())
                .andExpect(header().exists("Retry-After"))
                .andExpect(jsonPath("$.success").value(false));
    }
}
