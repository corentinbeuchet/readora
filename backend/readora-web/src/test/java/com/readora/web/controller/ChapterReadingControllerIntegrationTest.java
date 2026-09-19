package com.readora.web.controller;

import com.readora.domain.common.UserId;
import com.readora.application.port.out.ChapterRepositoryPort;
import com.readora.application.port.out.WorkRepositoryPort;
import com.readora.domain.work.*;
import com.readora.web.ReadoraApplication;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;

import java.time.Instant;
import java.util.List;
import java.util.Set;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest(classes = ReadoraApplication.class)
@AutoConfigureMockMvc
@ActiveProfiles("test")
class ChapterReadingControllerIntegrationTest {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private WorkRepositoryPort workRepository;

    @Autowired
    private ChapterRepositoryPort chapterRepository;

    private Work work;
    private Chapter chapter;

    @BeforeEach
    void setup() {
        work = workRepository.save(Work.create("Solo Leveling", "Synopsis", WorkType.MANHWA, "cover.webp", Set.of("Action")));
        chapter = Chapter.createDraft(work.getId(), ChapterNumber.of("1"), "Chapter 1", null);
        chapter.updatePages(List.of(
                PageAsset.create(1, "scans/solo/1/p1.webp", "https://cdn.readora.com/scans/solo/1/p1.webp"),
                PageAsset.create(2, "scans/solo/1/p2.webp", "https://cdn.readora.com/scans/solo/1/p2.webp")
        ));
        chapter.publish(UserId.of("publisher1"));
        chapter = chapterRepository.save(chapter);
    }

    @Test
    @DisplayName("GET /api/v1/chapters/{id} should return 200 and chapter metadata with pages")
    void getPublishedChapterReturnsSuccess() throws Exception {
        mockMvc.perform(get("/api/v1/chapters/" + chapter.getId().value()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success").value(true))
                .andExpect(jsonPath("$.data.title").value("Chapter 1"))
                .andExpect(jsonPath("$.data.status").value("PUBLISHED"))
                .andExpect(jsonPath("$.data.pages.length()").value(2));
    }

    @Test
    @DisplayName("The reader view carries the series (for the default reading mode) and its published neighbours")
    void chapterViewHasSeriesAndNeighbours() throws Exception {
        Chapter second = publish("2");
        chapterRepository.save(Chapter.createDraft(work.getId(), ChapterNumber.of("3"), "Draft", null));
        Chapter tenth = publish("10");

        mockMvc.perform(get("/api/v1/chapters/" + second.getId().value()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.work.title").value("Solo Leveling"))
                .andExpect(jsonPath("$.data.work.type").value("MANHWA"))
                .andExpect(jsonPath("$.data.scanlationProjectId").doesNotExist())
                .andExpect(jsonPath("$.data.previousChapterId").value(chapter.getId().value().toString()))
                .andExpect(jsonPath("$.data.nextChapterId").value(tenth.getId().value().toString()));

        mockMvc.perform(get("/api/v1/chapters/" + chapter.getId().value()))
                .andExpect(jsonPath("$.data.previousChapterId").doesNotExist())
                .andExpect(jsonPath("$.data.nextChapterId").value(second.getId().value().toString()));
        mockMvc.perform(get("/api/v1/chapters/" + tenth.getId().value()))
                .andExpect(jsonPath("$.data.nextChapterId").doesNotExist());
    }

    private Chapter publish(String number) {
        Chapter next = Chapter.createDraft(work.getId(), ChapterNumber.of(number), "Chapter " + number, null);
        next.updatePages(List.of(PageAsset.create(1, "scans/solo/" + number + "/p1.webp", "https://cdn.readora.com/p.webp")));
        next.publish(UserId.of("publisher1"));
        return chapterRepository.save(next);
    }
}
