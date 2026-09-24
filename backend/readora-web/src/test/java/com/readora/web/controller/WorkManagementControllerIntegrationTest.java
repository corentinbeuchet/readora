package com.readora.web.controller;

import com.readora.application.port.out.ChapterRepositoryPort;
import com.readora.application.port.out.ScanlationProjectRepositoryPort;
import com.readora.application.port.out.WorkRepositoryPort;
import com.readora.domain.scanlation.ScanlationProject;
import com.readora.domain.work.Demographic;
import com.readora.domain.work.WorkId;
import com.readora.domain.work.WorkStatus;
import com.readora.domain.work.WorkType;
import com.readora.web.ReadoraApplication;
import com.readora.web.dto.CreateWorkRequest;
import com.readora.web.dto.DirectPublishChapterRequest;
import com.readora.web.dto.PageAssetDto;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.http.MediaType;
import org.springframework.test.context.ActiveProfiles;

import java.util.List;
import java.util.Set;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.hamcrest.Matchers.equalTo;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest(classes = ReadoraApplication.class)
@AutoConfigureMockMvc
@ActiveProfiles("test")
class WorkManagementControllerIntegrationTest extends AuthTestSupport {

    @Autowired
    private WorkRepositoryPort workRepository;

    @Autowired
    private ChapterRepositoryPort chapterRepository;

    @Autowired
    private ScanlationProjectRepositoryPort projectRepository;

    @Test
    @DisplayName("A leader creates a new Work for their team, which gets a task board for it; the work appears in the catalog")
    void createWorkSuccess() throws Exception {
        Session scanlator = register();

        CreateWorkRequest request = new CreateWorkRequest(
                "Chainsaw Man",
                "Denji is a young boy...",
                WorkType.MANGA,
                WorkStatus.ONGOING, "Tatsuki Fujimoto", Demographic.SHOUNEN,
                "https://cdn.readora.com/covers/csm.webp",
                Set.of("Action", "Horror"),
                aTeamLedBy(scanlator, "Chainsaw Scans " + UUID.randomUUID())
        );

        var result = mockMvc.perform(post("/api/v1/works")
                        .header("Authorization", scanlator.bearer())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.success").value(true))
                .andExpect(jsonPath("$.data.title").value("Chainsaw Man"))
                .andExpect(jsonPath("$.data.type").value("MANGA"))
                .andExpect(jsonPath("$.data.author").value("Tatsuki Fujimoto"))
                .andExpect(jsonPath("$.data.demographic").value("SHOUNEN"))
                .andReturn();

        String workIdStr = json(result).path("data").path("id").asString();
        WorkId workId = WorkId.fromString(workIdStr);

        // Verify project created
        List<ScanlationProject> projects = projectRepository.findByWorkId(workId);
        assertThat(projects).isNotEmpty();
        assertThat(projects.get(0).getName()).startsWith("Chainsaw Scans ").endsWith(" - Chainsaw Man");

        // Verify work accessible via GET /api/v1/works/{id}
        mockMvc.perform(get("/api/v1/works/" + workIdStr))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.title").value("Chainsaw Man"));
    }

    @Test
    @DisplayName("A new Work without a team the creator leads is refused (TEAM_REQUIRED, 400)")
    void workWithoutATeamIsRefused() throws Exception {
        Session reader = register();

        mockMvc.perform(post("/api/v1/works")
                        .header("Authorization", reader.bearer())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(new CreateWorkRequest(
                                "No Team Manga", null, WorkType.MANGA, WorkStatus.ONGOING, null, null, null, Set.of("Action")))))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("TEAM_REQUIRED"));
    }

    @Test
    @DisplayName("A team's first chapter waits for a moderator, then is viewable in the reader")
    void directPublishChapterFlow() throws Exception {
        Session scanlator = register();

        // 1. Create work
        CreateWorkRequest createWorkReq = new CreateWorkRequest(
                "Tower of God",
                "What do you desire?",
                WorkType.MANHWA,
                WorkStatus.ONGOING, null, null,
                "https://cdn.readora.com/covers/tog.webp",
                Set.of("Fantasy", "Adventure"),
                aTeamLedBy(scanlator, "Tower of God Team " + UUID.randomUUID())
        );

        var createWorkRes = mockMvc.perform(post("/api/v1/works")
                        .header("Authorization", scanlator.bearer())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(createWorkReq)))
                .andExpect(status().isCreated())
                .andReturn();

        String workId = json(createWorkRes).path("data").path("id").asString();

        // 2. Direct publish chapter
        String teamId = teamOf(scanlator, workId);
        DirectPublishChapterRequest directReq = new DirectPublishChapterRequest(
                UUID.fromString(teamId),
                "1",
                "Headon's Floor",
                List.of(
                        new PageAssetDto(1, "tog/c1/p1.webp", "https://cdn.readora.com/tog/c1/p1.webp", 800, 1200),
                        new PageAssetDto(2, "tog/c1/p2.webp", "https://cdn.readora.com/tog/c1/p2.webp", 800, 1200,
                                "Bam looks up at the tower", "https://cdn.readora.com/tog/c1/p2.webp.lite.jpg")
                )
        );

        var directRes = mockMvc.perform(post("/api/v1/works/" + workId + "/chapters/direct")
                        .header("Authorization", scanlator.bearer())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(directReq)))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.success").value(true))
                .andExpect(jsonPath("$.data.chapterNumber").value("1"))
                .andExpect(jsonPath("$.data.pages.length()").value(2))
                .andExpect(jsonPath("$.data.status").value("PENDING_REVIEW"))
                .andReturn();

        String chapterId = json(directRes).path("data").path("id").asString();
        mockMvc.perform(get("/api/v1/chapters/" + chapterId))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("CHAPTER_NOT_PUBLISHED"));
        givenAModeratorApproves(chapterId);

        // 3. Verify chapter is readable through ChapterReadingController
        mockMvc.perform(get("/api/v1/chapters/" + chapterId))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.chapterNumber").value("1"))
                .andExpect(jsonPath("$.data.team.id").value(teamId))
                .andExpect(jsonPath("$.data.team.name", org.hamcrest.Matchers.startsWith("Tower of God Team")))
                .andExpect(jsonPath("$.data.pages[0].pageNumber").value(1))
                .andExpect(jsonPath("$.data.pages[0].cdnUrl", equalTo("https://cdn.readora.com/tog/c1/p1.webp")))
                .andExpect(jsonPath("$.data.pages[0].description").doesNotExist())
                .andExpect(jsonPath("$.data.pages[1].description").value("Bam looks up at the tower"))
                .andExpect(jsonPath("$.data.pages[0].liteCdnUrl").doesNotExist())
                .andExpect(jsonPath("$.data.pages[1].liteCdnUrl").value("https://cdn.readora.com/tog/c1/p2.webp.lite.jpg"));
    }

    @Test
    @DisplayName("A scanlator publishes neither for a team they are not on, nor for their own team into a series it does not work on")
    void directPublishIntoForeignWorkIsForbidden() throws Exception {
        Session owner = register();
        Session intruder = register();

        CreateWorkRequest createWorkReq = new CreateWorkRequest(
                "The Beginning After The End", "Reincarnation.", WorkType.MANHWA, WorkStatus.ONGOING, null, null, null, Set.of("Fantasy"),
                aTeamLedBy(owner));
        var createWorkRes = mockMvc.perform(post("/api/v1/works")
                        .header("Authorization", owner.bearer())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(createWorkReq)))
                .andExpect(status().isCreated())
                .andReturn();
        String workId = json(createWorkRes).path("data").path("id").asString();

        List<PageAssetDto> pages = List.of(new PageAssetDto(1, "x/p1.webp", "https://cdn.readora.com/x/p1.webp", 800, 1200));
        DirectPublishChapterRequest directReq = new DirectPublishChapterRequest(UUID.fromString(teamOf(owner, workId)), "1", "Hijacked", pages);

        mockMvc.perform(post("/api/v1/works/" + workId + "/chapters/direct")
                        .header("Authorization", intruder.bearer())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(directReq)))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.success").value(false));

        var ownTeam = mockMvc.perform(post("/api/v1/teams").header("Authorization", intruder.bearer())
                        .contentType(MediaType.APPLICATION_JSON).content("{\"name\":\"Intruders " + UUID.randomUUID() + "\"}"))
                .andExpect(status().isCreated()).andReturn();
        UUID intruders = UUID.fromString(json(ownTeam).path("data").path("id").asString());
        mockMvc.perform(post("/api/v1/works/" + workId + "/chapters/direct")
                        .header("Authorization", intruder.bearer())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(new DirectPublishChapterRequest(intruders, "1", "Hijacked", pages))))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("TEAM_NOT_ON_SERIES"));
    }

    @Test
    @DisplayName("Create work followed by scanlation chapter task creation succeeds without unique constraint violations")
    void createWorkAndUploadScanlationTaskFlow() throws Exception {
        Session scanlator = register();

        // 1. Create work (creates default project with scanlator as LEADER member)
        CreateWorkRequest createWorkReq = new CreateWorkRequest(
                "Omniscient Reader",
                "Only I know the end of this world.",
                WorkType.MANHWA,
                WorkStatus.ONGOING, null, null,
                "https://cdn.readora.com/covers/orv.webp",
                Set.of("Action", "Fantasy"),
                aTeamLedBy(scanlator)
        );

        var createWorkRes = mockMvc.perform(post("/api/v1/works")
                        .header("Authorization", scanlator.bearer())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(createWorkReq)))
                .andExpect(status().isCreated())
                .andReturn();

        String workId = json(createWorkRes).path("data").path("id").asString();
        List<ScanlationProject> projects = projectRepository.findByWorkId(WorkId.fromString(workId));
        assertThat(projects).isNotEmpty();
        String projectId = projects.get(0).getId().value().toString();

        // 2. A new series has no task board until the leader turns it on; then the chapter task goes on it
        var taskReq = new com.readora.web.dto.CreateTaskRequest(java.math.BigDecimal.valueOf(1), java.util.List.of(new com.readora.web.dto.PageAssetDto(1, "scans/orv/p1.webp", "https://cdn.test/p1.webp", 800, 1200)));
        mockMvc.perform(post("/api/v1/scanlation/projects/" + projectId + "/tasks")
                        .header("Authorization", scanlator.bearer())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(taskReq)))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("BOARD_OFF"));
        givenTheBoardIsOn(scanlator, projectId);
        mockMvc.perform(post("/api/v1/scanlation/projects/" + projectId + "/tasks")
                        .header("Authorization", scanlator.bearer())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(taskReq)))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.success").value(true))
                .andExpect(jsonPath("$.data.chapterNumber").value("1"))
                .andExpect(jsonPath("$.data.stage").value("RAW_UPLOADED"));

        // 3. Upload second chapter task into same project to verify consecutive saves
        var task2Req = new com.readora.web.dto.CreateTaskRequest(java.math.BigDecimal.valueOf(2), java.util.List.of(new com.readora.web.dto.PageAssetDto(1, "scans/orv/p1.webp", "https://cdn.test/p1.webp", 800, 1200)));
        mockMvc.perform(post("/api/v1/scanlation/projects/" + projectId + "/tasks")
                        .header("Authorization", scanlator.bearer())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(task2Req)))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.success").value(true))
                .andExpect(jsonPath("$.data.chapterNumber").value("2"));
    }
}
