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
import static org.hamcrest.Matchers.not;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest(classes = ReadoraApplication.class)
@AutoConfigureMockMvc
@ActiveProfiles("test")
class ErrorHandlingIntegrationTest extends AuthTestSupport {

    @Test
    @DisplayName("An unknown chapter id returns 404 with the JSON error envelope")
    void unknownChapterIsNotFound() throws Exception {
        mockMvc.perform(get("/api/v1/chapters/" + UUID.randomUUID()))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.success").value(false));
    }

    @Test
    @DisplayName("Claiming a task in an unknown project returns 404")
    void unknownProjectIsNotFound() throws Exception {
        Session scanlator = registerScanlator();

        mockMvc.perform(post("/api/v1/scanlation/projects/" + UUID.randomUUID() + "/tasks/" + UUID.randomUUID() + "/claim")
                        .header("Authorization", scanlator.bearer()))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.error", containsString("not found")))
                .andExpect(jsonPath("$.code").value("NOT_FOUND"));
    }

    @Test
    @DisplayName("A non-UUID path variable returns 400, not 500")
    void malformedPathVariableIsBadRequest() throws Exception {
        mockMvc.perform(get("/api/v1/chapters/not-a-uuid"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.success").value(false));
    }

    @Test
    @DisplayName("Malformed JSON returns 400 without echoing parser internals")
    void malformedJsonIsBadRequest() throws Exception {
        Session user = register();

        mockMvc.perform(put("/api/v1/profile")
                        .header("Authorization", user.bearer())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"displayName\": "))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.error").value("Malformed or invalid request"))
                .andExpect(jsonPath("$.code").value("MALFORMED_REQUEST"))
                .andExpect(jsonPath("$.error", not(containsString("Jackson"))));
    }

    @Test
    @DisplayName("An unknown URL returns 404 instead of a 500")
    void unknownUrlIsNotFound() throws Exception {
        Session user = register();

        mockMvc.perform(get("/api/v1/does-not-exist").header("Authorization", user.bearer()))
                .andExpect(status().isNotFound());
    }

    @Test
    @DisplayName("The health endpoint and its liveness probe are public and report UP")
    void healthIsPublic() throws Exception {
        mockMvc.perform(get("/actuator/health"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("UP"));
        mockMvc.perform(get("/actuator/health/liveness"))
                .andExpect(status().isOk());
    }

    @Test
    @DisplayName("An unsupported HTTP method returns 405")
    void unsupportedMethodIsMethodNotAllowed() throws Exception {
        Session user = register();

        mockMvc.perform(put("/api/v1/works").header("Authorization", user.bearer()))
                .andExpect(status().isMethodNotAllowed());
    }
}
