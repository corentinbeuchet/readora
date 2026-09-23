package com.readora.web.controller;

import com.readora.domain.work.WorkStatus;
import com.readora.domain.work.WorkType;
import com.readora.web.ReadoraApplication;
import com.readora.web.dto.CreateWorkRequest;
import com.readora.web.dto.DirectPublishChapterRequest;
import com.readora.web.dto.PageAssetDto;
import com.readora.web.dto.RegisterRequest;
import com.readora.web.dto.UpdateProfileRequest;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.http.MediaType;
import org.springframework.test.context.ActiveProfiles;

import java.util.List;
import java.util.Set;
import java.util.UUID;

import static org.hamcrest.Matchers.containsString;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/// Request limits must match the database column sizes, so oversized input is a 400 instead of a 500.
@SpringBootTest(classes = ReadoraApplication.class)
@AutoConfigureMockMvc
@ActiveProfiles("test")
class ValidationLimitsIntegrationTest extends AuthTestSupport {

    @Test
    @DisplayName("A javascript: avatar URL is rejected; http(s) and uploaded asset paths are accepted")
    void avatarUrlMustBeHttpOrAssetPath() throws Exception {
        Session user = register();

        mockMvc.perform(put("/api/v1/profile")
                        .header("Authorization", user.bearer())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(new UpdateProfileRequest("Kenji", null, "javascript:alert(1)"))))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.error", containsString("Avatar URL")))
                .andExpect(jsonPath("$.code").value("VALIDATION_FAILED"));

        mockMvc.perform(put("/api/v1/profile")
                        .header("Authorization", user.bearer())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(new UpdateProfileRequest("Kenji", null, "/api/v1/storage/assets/avatars/a.png"))))
                .andExpect(status().isOk());
    }

    @Test
    @DisplayName("Passwords longer than BCrypt's 72-byte limit are rejected with 400")
    void overlongPasswordIsRejected() throws Exception {
        String suffix = Long.toHexString(System.nanoTime());
        RegisterRequest request = new RegisterRequest("long" + suffix + "@readora.test", "long" + suffix, "a".repeat(73));

        mockMvc.perform(post("/api/v1/auth/register")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isBadRequest());
    }

    @Test
    @DisplayName("Direct publish rejects an over-long chapter number and duplicate page numbers with 400")
    void directPublishLimits() throws Exception {
        Session scanlator = register();
        var createWorkRes = mockMvc.perform(post("/api/v1/works")
                        .header("Authorization", scanlator.bearer())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(new CreateWorkRequest(
                                "Limits Work", "Synopsis", WorkType.MANGA, WorkStatus.ONGOING, null, null, null, Set.of("Action")))))
                .andExpect(status().isCreated())
                .andReturn();
        String workId = json(createWorkRes).path("data").path("id").asString();
        PageAssetDto page = new PageAssetDto(1, "w/p1.webp", "https://cdn.readora.com/w/p1.webp", 800, 1200);

        mockMvc.perform(post("/api/v1/works/" + workId + "/chapters/direct")
                        .header("Authorization", scanlator.bearer())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(new DirectPublishChapterRequest(UUID.fromString(teamOf(scanlator, workId)), "9".repeat(51), "T", List.of(page)))))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.error", containsString("Chapter number")));

        mockMvc.perform(post("/api/v1/works/" + workId + "/chapters/direct")
                        .header("Authorization", scanlator.bearer())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(new DirectPublishChapterRequest(UUID.fromString(teamOf(scanlator, workId)), "1", "T", List.of(page, page)))))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.error", containsString("unique")));
    }

    @Test
    @DisplayName("Each list element is validated: an over-long page description or list note is rejected with 400")
    void listElementsAreValidated() throws Exception {
        Session scanlator = register();
        var createWorkRes = mockMvc.perform(post("/api/v1/works")
                        .header("Authorization", scanlator.bearer())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(new CreateWorkRequest(
                                "Element Limits", "Synopsis", WorkType.MANGA, WorkStatus.ONGOING, null, null, null, Set.of("Action")))))
                .andExpect(status().isCreated())
                .andReturn();
        String workId = json(createWorkRes).path("data").path("id").asString();
        PageAssetDto described = new PageAssetDto(1, "w/p1.webp", "https://cdn.readora.com/w/p1.webp", 800, 1200, "x".repeat(501), null);

        mockMvc.perform(post("/api/v1/works/" + workId + "/chapters/direct")
                        .header("Authorization", scanlator.bearer())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(new DirectPublishChapterRequest(UUID.fromString(teamOf(scanlator, workId)), "1", "T", List.of(described)))))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.error", containsString("description")));

        mockMvc.perform(post("/api/v1/lists")
                        .header("Authorization", scanlator.bearer())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"title\":\"Mine\",\"published\":false,\"items\":[{\"workId\":\"" + workId
                                + "\",\"note\":\"" + "n".repeat(301) + "\"}]}"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.error", containsString("note")));
    }

    @Test
    @DisplayName("A work with a non-URL cover or a blank genre is rejected with 400")
    void createWorkLimits() throws Exception {
        Session scanlator = register();

        mockMvc.perform(post("/api/v1/works")
                        .header("Authorization", scanlator.bearer())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(new CreateWorkRequest(
                                "Bad Cover", null, WorkType.MANGA, WorkStatus.ONGOING, null, null, "file:///etc/passwd", Set.of("Action")))))
                .andExpect(status().isBadRequest());

        mockMvc.perform(post("/api/v1/works")
                        .header("Authorization", scanlator.bearer())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(new CreateWorkRequest(
                                "Bad Genre", null, WorkType.MANGA, WorkStatus.ONGOING, null, null, null, Set.of(" ")))))
                .andExpect(status().isBadRequest());
    }
}
