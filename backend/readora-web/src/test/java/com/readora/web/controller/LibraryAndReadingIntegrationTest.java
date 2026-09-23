package com.readora.web.controller;

import com.readora.application.port.out.ChapterRepositoryPort;
import com.readora.application.port.out.WorkRepositoryPort;
import com.readora.domain.common.UserId;
import com.readora.domain.work.*;
import com.readora.web.ReadoraApplication;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.http.MediaType;
import org.springframework.test.context.ActiveProfiles;

import java.util.List;
import java.util.Set;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/// US-05 library and US-07 history / read markers through real HTTP, real auth and the real database.
@SpringBootTest(classes = ReadoraApplication.class)
@AutoConfigureMockMvc
@ActiveProfiles("test")
class LibraryAndReadingIntegrationTest extends AuthTestSupport {

    @Autowired
    private WorkRepositoryPort workRepository;

    @Autowired
    private ChapterRepositoryPort chapterRepository;

    private Work work;
    private Chapter one;
    private Chapter two;
    private Chapter draft;

    @BeforeEach
    void setup() {
        work = workRepository.save(Work.create("Library Work", "S", WorkType.MANHWA, "c.webp", Set.of("Action")));
        one = publish("1");
        two = publish("2");
        draft = chapterRepository.save(Chapter.createDraft(work.getId(), ChapterNumber.of("3"), "Draft", anyTeam()));
    }

    private Chapter publish(String number) {
        Chapter chapter = Chapter.createDraft(work.getId(), ChapterNumber.of(number), "Ch " + number, anyTeam());
        chapter.updatePages(List.of(PageAsset.create(1, "l/p1.webp", "https://cdn.readora.com/l/p1.webp")));
        chapter.publish(UserId.of("publisher1"));
        return chapterRepository.save(chapter);
    }

    @Test
    @DisplayName("A free reader adds, re-labels, lists and removes a series; the library is private")
    void freeReaderManagesTheirLibrary() throws Exception {
        Session kenji = register();
        String entry = "/api/v1/library/" + work.getId().value();

        mockMvc.perform(put(entry).header("Authorization", kenji.bearer()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.status").value("READING"));
        mockMvc.perform(put(entry).header("Authorization", kenji.bearer())
                        .contentType(MediaType.APPLICATION_JSON).content("{\"status\":\"PLAN_TO_READ\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.status").value("PLAN_TO_READ"));

        mockMvc.perform(get("/api/v1/library").param("status", "PLAN_TO_READ").header("Authorization", kenji.bearer()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.length()").value(1))
                .andExpect(jsonPath("$.data[0].work.title").value("Library Work"))
                .andExpect(jsonPath("$.data[0].newChapters").value(0));
        mockMvc.perform(get("/api/v1/library").param("status", "READING").header("Authorization", kenji.bearer()))
                .andExpect(jsonPath("$.data.length()").value(0));

        Session aoi = register();
        mockMvc.perform(get("/api/v1/library").header("Authorization", aoi.bearer()))
                .andExpect(jsonPath("$.data.length()").value(0));
        mockMvc.perform(get(entry).header("Authorization", aoi.bearer()))
                .andExpect(status().isNotFound());

        mockMvc.perform(delete(entry).header("Authorization", kenji.bearer()))
                .andExpect(status().isNoContent());
        mockMvc.perform(delete(entry).header("Authorization", kenji.bearer()))
                .andExpect(status().isNotFound());
    }

    @Test
    @DisplayName("Library rejects anonymous users, unknown series and unknown statuses")
    void libraryErrors() throws Exception {
        mockMvc.perform(get("/api/v1/library")).andExpect(status().isUnauthorized());

        Session kenji = register();
        mockMvc.perform(put("/api/v1/library/" + WorkId.generate().value()).header("Authorization", kenji.bearer()))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.success").value(false));
        mockMvc.perform(put("/api/v1/library/" + work.getId().value()).header("Authorization", kenji.bearer())
                        .contentType(MediaType.APPLICATION_JSON).content("{\"status\":\"BINGING\"}"))
                .andExpect(status().isBadRequest());
    }

    @Test
    @DisplayName("Reading marks chapters, fills the history and shows the next chapter; drafts can't be marked")
    void readingHistoryAndMarkers() throws Exception {
        Session kenji = register();

        mockMvc.perform(put("/api/v1/reading/chapters/" + one.getId().value()).header("Authorization", kenji.bearer())
                        .contentType(MediaType.APPLICATION_JSON).content("{\"finished\":true}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.finished").value(true))
                .andExpect(jsonPath("$.data.chapterNumber").value("1"));
        mockMvc.perform(put("/api/v1/reading/chapters/" + one.getId().value()).header("Authorization", kenji.bearer())
                        .contentType(MediaType.APPLICATION_JSON).content("{\"finished\":false}"))
                .andExpect(jsonPath("$.data.finished").value(true));
        mockMvc.perform(put("/api/v1/reading/chapters/" + draft.getId().value()).header("Authorization", kenji.bearer())
                        .contentType(MediaType.APPLICATION_JSON).content("{\"finished\":true}"))
                .andExpect(status().isNotFound());

        mockMvc.perform(get("/api/v1/reading/works/" + work.getId().value()).header("Authorization", kenji.bearer()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.finishedChapterIds[0]").value(one.getId().value().toString()))
                .andExpect(jsonPath("$.data.nextChapterId").value(two.getId().value().toString()));

        mockMvc.perform(get("/api/v1/reading/history").header("Authorization", kenji.bearer()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data[0].work.title").value("Library Work"))
                .andExpect(jsonPath("$.data[0].lastRead.chapterId").value(one.getId().value().toString()));
    }

    @Test
    @DisplayName("'Mark all previous as read' finishes the earlier chapters and makes this one the next to read")
    void markAllPreviousAsRead() throws Exception {
        Chapter three = publish("3.5");
        Session kenji = register();

        mockMvc.perform(post("/api/v1/reading/chapters/" + three.getId().value() + "/read-up-to"))
                .andExpect(status().isUnauthorized());
        mockMvc.perform(post("/api/v1/reading/chapters/" + three.getId().value() + "/read-up-to").header("Authorization", kenji.bearer()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.finishedChapterIds.length()").value(2))
                .andExpect(jsonPath("$.data.nextChapterId").value(three.getId().value().toString()));
        mockMvc.perform(get("/api/v1/reading/history").header("Authorization", kenji.bearer()))
                .andExpect(jsonPath("$.data[0].lastRead.chapterId").value(two.getId().value().toString()));
        mockMvc.perform(post("/api/v1/reading/chapters/" + draft.getId().value() + "/read-up-to").header("Authorization", kenji.bearer()))
                .andExpect(status().isNotFound());
    }

    @Test
    @DisplayName("The library counts chapters published after my last read")
    void newChapterBadge() throws Exception {
        Session kenji = register();
        mockMvc.perform(put("/api/v1/library/" + work.getId().value()).header("Authorization", kenji.bearer()))
                .andExpect(status().isOk());
        mockMvc.perform(put("/api/v1/reading/chapters/" + two.getId().value()).header("Authorization", kenji.bearer())
                        .contentType(MediaType.APPLICATION_JSON).content("{\"finished\":true}"))
                .andExpect(status().isOk());
        Thread.sleep(5);
        publish("4");
        publish("5");

        mockMvc.perform(get("/api/v1/library").header("Authorization", kenji.bearer()))
                .andExpect(jsonPath("$.data[0].newChapters").value(2));
    }
}
