package com.readora.web.controller;

import com.readora.application.port.out.ChapterRepositoryPort;
import com.readora.application.port.out.ScanlationProjectRepositoryPort;
import com.readora.application.port.out.TeamRepositoryPort;
import com.readora.application.port.out.WorkRepositoryPort;
import com.readora.domain.scanlation.ScanlationProject;
import com.readora.domain.scanlation.Team;
import com.readora.domain.scanlation.ScanlationRole;
import com.readora.domain.scanlation.TeamMember;
import com.readora.domain.common.UserId;
import com.readora.domain.work.Work;
import com.readora.domain.work.WorkType;
import com.readora.web.ReadoraApplication;
import com.readora.web.dto.CreateTaskRequest;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.http.MediaType;
import org.springframework.test.context.ActiveProfiles;

import java.math.BigDecimal;
import java.util.Set;

import static org.hamcrest.Matchers.containsString;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest(classes = ReadoraApplication.class)
@AutoConfigureMockMvc
@ActiveProfiles("test")
class ScanlationTaskControllerIntegrationTest extends AuthTestSupport {

    @Autowired
    private WorkRepositoryPort workRepository;

    @Autowired
    private ChapterRepositoryPort chapterRepository;

    @Autowired
    private ScanlationProjectRepositoryPort projectRepository;

    @Autowired
    private TeamRepositoryPort teamRepository;

    private Work work;
    private Team team;
    private ScanlationProject project;

    @BeforeEach
    void setup() {
        work = workRepository.save(Work.create("Solo Leveling", "Hunter sung jin-woo", WorkType.MANHWA, "solo.webp", Set.of("Action")));
        team = teamRepository.save(Team.create("Asura Team " + java.util.UUID.randomUUID(), null, UserId.of("leader-init")));
        project = ScanlationProject.create("Asura Team", work.getId(), team.getId());
        project = projectRepository.save(project);
    }

    @Test
    @DisplayName("A team member can upload a chapter task and receives 201 Created")
    void scanlatorMemberUploadsChapterTask() throws Exception {
        Session scanlator = register();
        team.addMember(TeamMember.of(UserId.of(scanlator.userId()), ScanlationRole.CLEANER_REDRAWER));
        teamRepository.save(team);

        CreateTaskRequest request = new CreateTaskRequest(BigDecimal.valueOf(1), "scans/solo/1/raw.zip", 22);

        mockMvc.perform(post("/api/v1/scanlation/projects/" + project.getId().value() + "/tasks")
                        .header("Authorization", scanlator.bearer())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.success").value(true))
                .andExpect(jsonPath("$.data.chapterNumber").value("1"))
                .andExpect(jsonPath("$.data.stage").value("RAW_UPLOADED"))
                .andExpect(jsonPath("$.data.status").value("PENDING"))
                .andExpect(jsonPath("$.data.pageCount").value(22))
                .andExpect(jsonPath("$.data.assetPackageUrl").value("scans/solo/1/raw.zip"));
    }

    @Test
    @DisplayName("A reader outside the team receives 400 Bad Request when trying to upload")
    void scanlatorNonMemberRejectedByDomain() throws Exception {
        Session scanlator = register();
        CreateTaskRequest request = new CreateTaskRequest(BigDecimal.valueOf(1), "scans/solo/1/raw.zip", 22);

        mockMvc.perform(post("/api/v1/scanlation/projects/" + project.getId().value() + "/tasks")
                        .header("Authorization", scanlator.bearer())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.error", containsString("not a member")));
    }

    @Test
    @DisplayName("Duplicate chapter number upload returns 400 Bad Request")
    void duplicateChapterUploadReturnsBadRequest() throws Exception {
        Session scanlator = register();
        team.addMember(TeamMember.of(UserId.of(scanlator.userId()), ScanlationRole.LEADER));
        teamRepository.save(team);

        CreateTaskRequest request = new CreateTaskRequest(BigDecimal.valueOf(1), "scans/solo/1/raw.zip", 22);

        mockMvc.perform(post("/api/v1/scanlation/projects/" + project.getId().value() + "/tasks")
                        .header("Authorization", scanlator.bearer())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isCreated());

        mockMvc.perform(post("/api/v1/scanlation/projects/" + project.getId().value() + "/tasks")
                        .header("Authorization", scanlator.bearer())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.error", containsString("already exists")));
    }

    @Test
    @DisplayName("Invalid task payload returns 400 Bad Request")
    void invalidTaskPayloadReturnsBadRequest() throws Exception {
        Session scanlator = register();
        team.addMember(TeamMember.of(UserId.of(scanlator.userId()), ScanlationRole.LEADER));
        teamRepository.save(team);

        mockMvc.perform(post("/api/v1/scanlation/projects/" + project.getId().value() + "/tasks")
                        .header("Authorization", scanlator.bearer())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"chapterNumber\":-1,\"assetUrl\":\"\",\"pageCount\":0}"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.success").value(false));
    }
}
