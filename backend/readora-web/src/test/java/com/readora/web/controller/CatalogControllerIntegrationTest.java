package com.readora.web.controller;

import com.readora.application.port.out.ChapterRepositoryPort;
import com.readora.application.port.out.WorkRepositoryPort;
import com.readora.domain.work.*;
import com.readora.web.ReadoraApplication;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;

import java.util.List;
import java.util.Set;

import static org.hamcrest.Matchers.greaterThanOrEqualTo;
import static org.hamcrest.Matchers.hasItem;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest(classes = ReadoraApplication.class)
@AutoConfigureMockMvc
@ActiveProfiles("test")
class CatalogControllerIntegrationTest {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private WorkRepositoryPort workRepository;

    @Autowired
    private ChapterRepositoryPort chapterRepository;

    private Work work;
    private Chapter published;

    @BeforeEach
    void setup() {
        work = workRepository.save(Work.create("Berserk", "Dark fantasy", WorkType.MANGA, "berserk.webp", Set.of("Dark Fantasy", "Seinen")));

        published = Chapter.createDraft(work.getId(), ChapterNumber.of("1"), "The Black Swordsman", null);
        published.updatePages(List.of(PageAsset.create(1, "b/p1.webp", "https://cdn.readora.com/b/p1.webp")));
        published.publish(UserId.of("publisher1"));
        published = chapterRepository.save(published);

        Chapter draft = Chapter.createDraft(work.getId(), ChapterNumber.of("2"), "Draft", null);
        chapterRepository.save(draft);
    }

    @Test
    @DisplayName("GET /api/v1/works is public, paginated and contains the created work")
    void listWorksIsPublicAndPaginated() throws Exception {
        mockMvc.perform(get("/api/v1/works").param("page", "0").param("size", "50"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success").value(true))
                .andExpect(jsonPath("$.data.page").value(0))
                .andExpect(jsonPath("$.data.size").value(50))
                .andExpect(jsonPath("$.data.totalElements").value(greaterThanOrEqualTo(1)))
                .andExpect(jsonPath("$.data.items[*].title", hasItem("Berserk")));
    }

    @Test
    @DisplayName("GET /api/v1/works/{id} returns work details, unknown id returns 404")
    void getWorkDetails() throws Exception {
        mockMvc.perform(get("/api/v1/works/" + work.getId().value()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.title").value("Berserk"))
                .andExpect(jsonPath("$.data.type").value("MANGA"))
                .andExpect(jsonPath("$.data.genres.length()").value(2));

        mockMvc.perform(get("/api/v1/works/" + WorkId.generate().value()))
                .andExpect(status().isNotFound());
    }

    @Test
    @DisplayName("GET /api/v1/works/{id}/chapters lists only published chapters")
    void listPublishedChaptersOnly() throws Exception {
        mockMvc.perform(get("/api/v1/works/" + work.getId().value() + "/chapters"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.length()").value(1))
                .andExpect(jsonPath("$.data[0].id").value(published.getId().value().toString()))
                .andExpect(jsonPath("$.data[0].status").value("PUBLISHED"))
                .andExpect(jsonPath("$.data[0].pageCount").value(1));
    }
}
