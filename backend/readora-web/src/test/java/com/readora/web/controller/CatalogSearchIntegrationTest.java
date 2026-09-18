package com.readora.web.controller;

import com.readora.application.port.out.WorkRepositoryPort;
import com.readora.domain.work.Demographic;
import com.readora.domain.work.Work;
import com.readora.domain.work.WorkStatus;
import com.readora.domain.work.WorkType;
import com.readora.web.ReadoraApplication;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;

import java.util.HashSet;
import java.util.Set;
import java.util.UUID;

import static org.hamcrest.Matchers.containsInAnyOrder;
import static org.hamcrest.Matchers.hasItems;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/// US-04 catalog search through real HTTP and the real database. The test database is shared between tests, so every
/// work carries a genre unique to this test run and every query filters on it.
@SpringBootTest(classes = ReadoraApplication.class)
@AutoConfigureMockMvc
@ActiveProfiles("test")
class CatalogSearchIntegrationTest {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private WorkRepositoryPort workRepository;

    private String run;

    @BeforeEach
    void seedCatalog() {
        run = "run-" + UUID.randomUUID();
        save("Solo Leveling " + run, WorkType.MANHWA, WorkStatus.COMPLETED, Demographic.SHOUNEN, "Chugong", "Action", "Fantasy");
        save("Omniscient Reader " + run, WorkType.MANHWA, WorkStatus.ONGOING, Demographic.SHOUNEN, "Sing Shong", "Action", "Fantasy", "Apocalypse");
        save("Horimiya " + run, WorkType.MANGA, WorkStatus.COMPLETED, Demographic.SHOUNEN, "HERO", "Romance", "Comedy");
        save("Berserk 100% " + run, WorkType.MANGA, WorkStatus.HIATUS, Demographic.SEINEN, "Kentaro Miura", "Action", "Horror");
    }

    private void save(String title, WorkType type, WorkStatus status, Demographic demographic, String author, String... genres) {
        Set<String> allGenres = new HashSet<>(Set.of(genres));
        allGenres.add(run);
        workRepository.save(Work.create(title, "", type, status, author, demographic, null, allGenres));
    }

    @Test
    @DisplayName("Wanted genres must all be present and excluded genres absent, case-insensitively")
    void includeAndExcludeGenres() throws Exception {
        mockMvc.perform(get("/api/v1/works").param("genre", run, "action").param("excludeGenre", "ROMANCE", "apocalypse"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.totalElements").value(2))
                .andExpect(jsonPath("$.data.items[*].title", containsInAnyOrder("Solo Leveling " + run, "Berserk 100% " + run)));
    }

    @Test
    @DisplayName("Type, status and demographic filters combine; repeated values are alternatives")
    void facetFilters() throws Exception {
        mockMvc.perform(get("/api/v1/works").param("genre", run).param("type", "MANHWA").param("status", "COMPLETED", "HIATUS"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.items[*].title", containsInAnyOrder("Solo Leveling " + run)));

        mockMvc.perform(get("/api/v1/works").param("genre", run).param("demographic", "SEINEN"))
                .andExpect(jsonPath("$.data.items[*].title", containsInAnyOrder("Berserk 100% " + run)))
                .andExpect(jsonPath("$.data.items[0].author").value("Kentaro Miura"))
                .andExpect(jsonPath("$.data.items[0].demographic").value("SEINEN"));
    }

    @Test
    @DisplayName("Text search matches part of the title or the author, case-insensitively, with LIKE wildcards taken literally")
    void textSearch() throws Exception {
        mockMvc.perform(get("/api/v1/works").param("genre", run).param("q", "OMNI"))
                .andExpect(jsonPath("$.data.items[*].title", containsInAnyOrder("Omniscient Reader " + run)));

        mockMvc.perform(get("/api/v1/works").param("genre", run).param("q", "miura"))
                .andExpect(jsonPath("$.data.items[*].title", containsInAnyOrder("Berserk 100% " + run)));

        mockMvc.perform(get("/api/v1/works").param("genre", run).param("q", "0%"))
                .andExpect(jsonPath("$.data.items[*].title", containsInAnyOrder("Berserk 100% " + run)));
    }

    @Test
    @DisplayName("GET /api/v1/works/genres is public and lists the catalog genres")
    void listGenres() throws Exception {
        mockMvc.perform(get("/api/v1/works/genres"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data", hasItems("Action", "Apocalypse", run)));
    }

    @Test
    @DisplayName("Unknown filter values and over-long search text are rejected with 400")
    void invalidFilters() throws Exception {
        mockMvc.perform(get("/api/v1/works").param("type", "NOVEL"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.success").value(false));

        mockMvc.perform(get("/api/v1/works").param("q", "x".repeat(101)))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.success").value(false));
    }
}
