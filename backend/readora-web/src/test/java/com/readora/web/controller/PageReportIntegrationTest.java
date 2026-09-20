package com.readora.web.controller;

import com.readora.application.port.out.ChapterRepositoryPort;
import com.readora.application.port.out.ScanlationProjectRepositoryPort;
import com.readora.application.port.out.TeamRepositoryPort;
import com.readora.application.port.out.WorkRepositoryPort;
import com.readora.domain.common.UserId;
import com.readora.domain.scanlation.ScanlationProject;
import com.readora.domain.scanlation.Team;
import com.readora.domain.work.*;
import com.readora.web.ReadoraApplication;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.DisplayName;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.http.MediaType;
import org.springframework.test.context.ActiveProfiles;

import java.util.List;
import java.util.Set;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/// US-06 broken-page reports through real HTTP, real auth and the real database.
@SpringBootTest(classes = ReadoraApplication.class)
@AutoConfigureMockMvc
@ActiveProfiles("test")
class PageReportIntegrationTest extends AuthTestSupport {

    @Autowired
    private WorkRepositoryPort workRepository;

    @Autowired
    private ChapterRepositoryPort chapterRepository;

    @Autowired
    private ScanlationProjectRepositoryPort projectRepository;

    @Autowired
    private TeamRepositoryPort teamRepository;

    private static final String BODY = "{\"reason\":\"IMAGE_CORRUPTED\"}";

    @Test
    @DisplayName("A reader reports a page once; the team sees it and marks it fixed; others are refused")
    void reportAndFix() throws Exception {
        Session leader = registerScanlator();
        Session outsider = registerScanlator();
        Session kenji = register();
        Work work = workRepository.save(Work.create("Report Work", "S", WorkType.MANHWA, "c.webp", Set.of("Action")));
        Team shadowScans = teamRepository.save(Team.create("Shadow Scans " + java.util.UUID.randomUUID(), null, UserId.of(leader.userId())));
        ScanlationProject team = projectRepository.save(ScanlationProject.create("Shadow Scans", work.getId(), shadowScans.getId()));
        Chapter chapter = Chapter.createDraft(work.getId(), ChapterNumber.of("1"), "Ch 1", team.getId());
        chapter.updatePages(List.of(PageAsset.create(1, "r/p1.webp", null), PageAsset.create(2, "r/p2.webp", null)));
        chapter.publish(UserId.of(leader.userId()));
        chapter = chapterRepository.save(chapter);
        String reportUrl = "/api/v1/chapters/" + chapter.getId().value() + "/pages/2/reports";

        var first = mockMvc.perform(post(reportUrl).header("Authorization", kenji.bearer())
                        .contentType(MediaType.APPLICATION_JSON).content(BODY))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.data.status").value("OPEN"))
                .andExpect(jsonPath("$.data.reporterId").doesNotExist())
                .andReturn();
        String reportId = json(first).path("data").path("id").asString();
        mockMvc.perform(post(reportUrl).header("Authorization", kenji.bearer())
                        .contentType(MediaType.APPLICATION_JSON).content(BODY))
                .andExpect(jsonPath("$.data.id").value(reportId));

        String listUrl = "/api/v1/scanlation/projects/" + team.getId().value() + "/page-reports";
        mockMvc.perform(get(listUrl).header("Authorization", outsider.bearer()))
                .andExpect(status().isForbidden());
        mockMvc.perform(get(listUrl).header("Authorization", kenji.bearer()))
                .andExpect(status().isForbidden());
        mockMvc.perform(get(listUrl).header("Authorization", leader.bearer()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.length()").value(1))
                .andExpect(jsonPath("$.data[0].pageNumber").value(2))
                .andExpect(jsonPath("$.data[0].chapterNumber").value("1"));

        mockMvc.perform(post("/api/v1/page-reports/" + reportId + "/resolve").header("Authorization", outsider.bearer()))
                .andExpect(status().isForbidden());
        mockMvc.perform(post("/api/v1/page-reports/" + reportId + "/resolve").header("Authorization", leader.bearer()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.status").value("RESOLVED"));
        mockMvc.perform(post("/api/v1/page-reports/" + reportId + "/resolve").header("Authorization", leader.bearer()))
                .andExpect(status().isBadRequest());
        mockMvc.perform(get(listUrl).header("Authorization", leader.bearer()))
                .andExpect(jsonPath("$.data.length()").value(0));
    }

    @Test
    @DisplayName("Reports need a signed-in reader, an existing page and a reason")
    void invalidReports() throws Exception {
        Session kenji = register();
        Work work = workRepository.save(Work.create("Report Work 2", "S", WorkType.MANGA, "c.webp", Set.of("Action")));
        Chapter chapter = Chapter.createDraft(work.getId(), ChapterNumber.of("1"), "Ch 1", null);
        chapter.updatePages(List.of(PageAsset.create(1, "r/p1.webp", null)));
        chapter.publish(UserId.of("publisher"));
        chapter = chapterRepository.save(chapter);
        String base = "/api/v1/chapters/" + chapter.getId().value() + "/pages/";

        mockMvc.perform(post(base + "1/reports").contentType(MediaType.APPLICATION_JSON).content(BODY))
                .andExpect(status().isUnauthorized());
        mockMvc.perform(post(base + "9/reports").header("Authorization", kenji.bearer())
                        .contentType(MediaType.APPLICATION_JSON).content(BODY))
                .andExpect(status().isBadRequest());
        mockMvc.perform(post(base + "1/reports").header("Authorization", kenji.bearer())
                        .contentType(MediaType.APPLICATION_JSON).content("{}"))
                .andExpect(status().isBadRequest());
        mockMvc.perform(post("/api/v1/chapters/" + ChapterId.generate().value() + "/pages/1/reports").header("Authorization", kenji.bearer())
                        .contentType(MediaType.APPLICATION_JSON).content(BODY))
                .andExpect(status().isNotFound());
    }
}
