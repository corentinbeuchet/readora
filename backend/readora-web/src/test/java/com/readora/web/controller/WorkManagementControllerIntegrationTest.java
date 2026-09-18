package com.readora.web.controller;

import com.readora.application.port.out.ChapterRepositoryPort;
import com.readora.application.port.out.ScanlationProjectRepositoryPort;
import com.readora.application.port.out.WorkRepositoryPort;
import com.readora.domain.scanlation.ScanlationProject;
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
    @DisplayName("SCANLATOR creates a new Work, which auto-creates a ScanlationProject and appears in catalog")
    void createWorkSuccess() throws Exception {
        Session scanlator = registerScanlator();

        CreateWorkRequest request = new CreateWorkRequest(
                "Chainsaw Man",
                "Denji is a young boy...",
                WorkType.MANGA,
                WorkStatus.ONGOING,
                "https://cdn.readora.com/covers/csm.webp",
                Set.of("Action", "Horror")
        );

        var result = mockMvc.perform(post("/api/v1/works")
                        .header("Authorization", scanlator.bearer())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.success").value(true))
                .andExpect(jsonPath("$.data.title").value("Chainsaw Man"))
                .andExpect(jsonPath("$.data.type").value("MANGA"))
                .andReturn();

        String workIdStr = json(result).path("data").path("id").asString();
        WorkId workId = WorkId.fromString(workIdStr);

        // Verify project created
        List<ScanlationProject> projects = projectRepository.findByWorkId(workId);
        assertThat(projects).isNotEmpty();
        assertThat(projects.get(0).getName()).isEqualTo("Chainsaw Man Workspace");

        // Verify work accessible via GET /api/v1/works/{id}
        mockMvc.perform(get("/api/v1/works/" + workIdStr))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.title").value("Chainsaw Man"));
    }

    @Test
    @DisplayName("Unauthenticated or READER user without WORK_CREATE permission receives 403 on create work")
    void readerCannotCreateWork() throws Exception {
        Session reader = register();

        CreateWorkRequest request = new CreateWorkRequest(
                "Unauthorized Manga",
                "Synopsis",
                WorkType.MANGA,
                WorkStatus.ONGOING,
                null,
                Set.of("Action")
        );

        mockMvc.perform(post("/api/v1/works")
                        .header("Authorization", reader.bearer())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isForbidden());
    }

    @Test
    @DisplayName("Direct publish chapter with pages creates published chapter and is viewable in reader")
    void directPublishChapterFlow() throws Exception {
        Session scanlator = registerScanlator();

        // 1. Create work
        CreateWorkRequest createWorkReq = new CreateWorkRequest(
                "Tower of God",
                "What do you desire?",
                WorkType.MANHWA,
                WorkStatus.ONGOING,
                "https://cdn.readora.com/covers/tog.webp",
                Set.of("Fantasy", "Adventure")
        );

        var createWorkRes = mockMvc.perform(post("/api/v1/works")
                        .header("Authorization", scanlator.bearer())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(createWorkReq)))
                .andExpect(status().isCreated())
                .andReturn();

        String workId = json(createWorkRes).path("data").path("id").asString();

        // 2. Direct publish chapter
        DirectPublishChapterRequest directReq = new DirectPublishChapterRequest(
                "1",
                "Headon's Floor",
                List.of(
                        new PageAssetDto(1, "tog/c1/p1.webp", "https://cdn.readora.com/tog/c1/p1.webp", 800, 1200),
                        new PageAssetDto(2, "tog/c1/p2.webp", "https://cdn.readora.com/tog/c1/p2.webp", 800, 1200)
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
                .andReturn();

        String chapterId = json(directRes).path("data").path("id").asString();

        // 3. Verify chapter is readable through ChapterReadingController
        mockMvc.perform(get("/api/v1/chapters/" + chapterId))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.chapterNumber").value("1"))
                .andExpect(jsonPath("$.data.pages[0].pageNumber").value(1))
                .andExpect(jsonPath("$.data.pages[0].cdnUrl", equalTo("https://cdn.readora.com/tog/c1/p1.webp")));
    }

    @Test
    @DisplayName("A scanlator cannot directly publish a chapter into another scanlator's work")
    void directPublishIntoForeignWorkIsForbidden() throws Exception {
        Session owner = registerScanlator();
        Session intruder = registerScanlator();

        CreateWorkRequest createWorkReq = new CreateWorkRequest(
                "The Beginning After The End", "Reincarnation.", WorkType.MANHWA, WorkStatus.ONGOING, null, Set.of("Fantasy"));
        var createWorkRes = mockMvc.perform(post("/api/v1/works")
                        .header("Authorization", owner.bearer())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(createWorkReq)))
                .andExpect(status().isCreated())
                .andReturn();
        String workId = json(createWorkRes).path("data").path("id").asString();

        DirectPublishChapterRequest directReq = new DirectPublishChapterRequest(
                "1", "Hijacked", List.of(new PageAssetDto(1, "x/p1.webp", "https://cdn.readora.com/x/p1.webp", 800, 1200)));

        mockMvc.perform(post("/api/v1/works/" + workId + "/chapters/direct")
                        .header("Authorization", intruder.bearer())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(directReq)))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.success").value(false));
    }

    @Test
    @DisplayName("Create work followed by scanlation chapter task creation succeeds without unique constraint violations")
    void createWorkAndUploadScanlationTaskFlow() throws Exception {
        Session scanlator = registerScanlator();

        // 1. Create work (creates default project with scanlator as LEADER member)
        CreateWorkRequest createWorkReq = new CreateWorkRequest(
                "Omniscient Reader",
                "Only I know the end of this world.",
                WorkType.MANHWA,
                WorkStatus.ONGOING,
                "https://cdn.readora.com/covers/orv.webp",
                Set.of("Action", "Fantasy")
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

        // 2. Upload chapter task into created project
        var taskReq = new com.readora.web.dto.CreateTaskRequest(java.math.BigDecimal.valueOf(1), "scans/orv/c1.zip", 20);
        mockMvc.perform(post("/api/v1/scanlation/projects/" + projectId + "/tasks")
                        .header("Authorization", scanlator.bearer())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(taskReq)))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.success").value(true))
                .andExpect(jsonPath("$.data.chapterNumber").value("1"))
                .andExpect(jsonPath("$.data.stage").value("RAW_UPLOADED"));

        // 3. Upload second chapter task into same project to verify consecutive saves
        var task2Req = new com.readora.web.dto.CreateTaskRequest(java.math.BigDecimal.valueOf(2), "scans/orv/c2.zip", 18);
        mockMvc.perform(post("/api/v1/scanlation/projects/" + projectId + "/tasks")
                        .header("Authorization", scanlator.bearer())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(task2Req)))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.success").value(true))
                .andExpect(jsonPath("$.data.chapterNumber").value("2"));
    }
}
