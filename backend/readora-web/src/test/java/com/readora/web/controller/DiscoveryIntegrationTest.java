package com.readora.web.controller;

import com.readora.application.port.out.ChapterRepositoryPort;
import com.readora.application.port.out.WorkRepositoryPort;
import com.readora.domain.common.UserId;
import com.readora.domain.work.*;
import com.readora.web.ReadoraApplication;
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

import static org.hamcrest.Matchers.everyItem;
import static org.hamcrest.Matchers.hasItem;
import static org.hamcrest.Matchers.is;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/// US-08 updates, rankings and random picks through real HTTP and the real database.
@SpringBootTest(classes = ReadoraApplication.class)
@AutoConfigureMockMvc
@ActiveProfiles("test")
class DiscoveryIntegrationTest extends AuthTestSupport {

    @Autowired
    private WorkRepositoryPort workRepository;

    @Autowired
    private ChapterRepositoryPort chapterRepository;

    private Chapter publish(Work work, String number) {
        Chapter chapter = Chapter.createDraft(work.getId(), ChapterNumber.of(number), "Ch " + number, anyTeam());
        chapter.updatePages(List.of(PageAsset.create(1, "d/p1.webp", "https://cdn.readora.com/d/p1.webp")));
        chapter.publish(UserId.of("publisher"));
        return chapterRepository.save(chapter);
    }

    @Test
    @DisplayName("Latest updates are public and newest first; 'mine' needs sign-in and shows only my library with read marks")
    void latestUpdates() throws Exception {
        String tag = "d-" + UUID.randomUUID();
        Work followed = workRepository.save(Work.create("Followed " + tag, "", WorkType.MANHWA, "c.webp", Set.of(tag)));
        Work other = workRepository.save(Work.create("Other " + tag, "", WorkType.MANGA, "c.webp", Set.of(tag)));
        Chapter first = publish(followed, "1");
        publish(followed, "2");
        Thread.sleep(5); // distinct publish times: "newest first" must not depend on a tie-break
        publish(other, "1");

        mockMvc.perform(get("/api/v1/updates"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data[0].work.title").value("Other " + tag))
                .andExpect(jsonPath("$.data[0].read").value(false));
        mockMvc.perform(get("/api/v1/updates").param("mine", "true"))
                .andExpect(status().isUnauthorized());

        Session kenji = register();
        mockMvc.perform(put("/api/v1/library/" + followed.getId().value()).header("Authorization", kenji.bearer())).andExpect(status().isOk());
        mockMvc.perform(put("/api/v1/reading/chapters/" + first.getId().value()).header("Authorization", kenji.bearer())
                .contentType(MediaType.APPLICATION_JSON).content("{\"finished\":true}")).andExpect(status().isOk());

        mockMvc.perform(get("/api/v1/updates").param("mine", "true").header("Authorization", kenji.bearer()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.length()").value(2))
                .andExpect(jsonPath("$.data[*].work.title", everyItem(is("Followed " + tag))))
                .andExpect(jsonPath("$.data[?(@.chapterNumber == '1')].read", everyItem(is(true))))
                .andExpect(jsonPath("$.data[?(@.chapterNumber == '2')].read", everyItem(is(false))));
    }

    @Test
    @DisplayName("Rankings are public; popular counts recent reads; top rated needs 5 ratings; random respects the genre")
    void rankingsAndRandom() throws Exception {
        String tag = "r-" + UUID.randomUUID();
        Work hot = workRepository.save(Work.create("Hot " + tag, "", WorkType.MANGA, "c.webp", Set.of(tag)));
        Chapter chapter = publish(hot, "1");
        Session reader = register();
        mockMvc.perform(put("/api/v1/reading/chapters/" + chapter.getId().value()).header("Authorization", reader.bearer())
                .contentType(MediaType.APPLICATION_JSON).content("{\"finished\":false}")).andExpect(status().isOk());

        mockMvc.perform(get("/api/v1/rankings/popular").param("period", "TODAY"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data[*].work.title", hasItem("Hot " + tag)));
        mockMvc.perform(get("/api/v1/rankings/popular").param("period", "DECADE"))
                .andExpect(status().isBadRequest());

        for (int i = 0; i < 5; i++) {
            Session rater = register();
            mockMvc.perform(put("/api/v1/works/" + hot.getId().value() + "/rating").header("Authorization", rater.bearer())
                    .contentType(MediaType.APPLICATION_JSON).content("{\"score\":10}")).andExpect(status().isOk());
        }
        mockMvc.perform(get("/api/v1/rankings/top-rated"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data[*].work.title", hasItem("Hot " + tag)));

        mockMvc.perform(get("/api/v1/works/random").param("genre", tag))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.title").value("Hot " + tag));
        mockMvc.perform(get("/api/v1/works/random").param("genre", "no-such-genre-" + tag))
                .andExpect(status().isNotFound());
    }
}
