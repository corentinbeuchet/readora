package com.readora.web.controller;

import com.readora.domain.common.UserId;
import com.readora.application.port.out.ChapterRepositoryPort;
import com.readora.application.port.out.WorkRepositoryPort;
import com.readora.domain.work.*;
import com.readora.web.ReadoraApplication;
import com.readora.web.dto.UpdateProgressRequest;
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

import static org.hamcrest.Matchers.hasItem;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest(classes = ReadoraApplication.class)
@AutoConfigureMockMvc
@ActiveProfiles("test")
class BookmarkControllerIntegrationTest extends AuthTestSupport {

    @Autowired
    private WorkRepositoryPort workRepository;

    @Autowired
    private ChapterRepositoryPort chapterRepository;

    private Work work;
    private Chapter chapter;

    @BeforeEach
    void setup() {
        work = workRepository.save(Work.create("Omniscient Reader", "Synopsis", WorkType.MANHWA, "cover.webp", Set.of("Action")));
        chapter = Chapter.createDraft(work.getId(), ChapterNumber.of("1"), "Chapter 1", anyTeam());
        chapter.updatePages(List.of(PageAsset.create(1, "o/p1.webp", "https://cdn.readora.com/o/p1.webp")));
        chapter.publish(UserId.of("publisher1"));
        chapter = chapterRepository.save(chapter);
    }

    @Test
    @DisplayName("A signed-in reader can save progress twice (upsert), read it back and list bookmarks")
    void readerSavesAndListsBookmarks() throws Exception {
        Session reader = register();

        mockMvc.perform(get("/api/v1/auth/me").header("Authorization", reader.bearer()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.permissions", hasItem("LIBRARY_USE")));

        String progressUrl = "/api/v1/bookmarks/" + work.getId().value() + "/progress";
        mockMvc.perform(put(progressUrl)
                        .header("Authorization", reader.bearer())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(new UpdateProgressRequest(chapter.getId().value(), 3))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.lastReadPageIndex").value(3));

        mockMvc.perform(put(progressUrl)
                        .header("Authorization", reader.bearer())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(new UpdateProgressRequest(chapter.getId().value(), 7))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.lastReadPageIndex").value(7));

        mockMvc.perform(get("/api/v1/bookmarks/" + work.getId().value()).header("Authorization", reader.bearer()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.workId").value(work.getId().value().toString()))
                .andExpect(jsonPath("$.data.lastReadChapterId").value(chapter.getId().value().toString()))
                .andExpect(jsonPath("$.data.lastReadPageIndex").value(7));

        mockMvc.perform(get("/api/v1/bookmarks").header("Authorization", reader.bearer()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.length()").value(1))
                .andExpect(jsonPath("$.data[0].status").value("READING"));
    }

    @Test
    @DisplayName("Bookmark for a work never read returns 404")
    void unknownBookmarkIsNotFound() throws Exception {
        Session reader = register();
        mockMvc.perform(get("/api/v1/bookmarks/" + WorkId.generate().value()).header("Authorization", reader.bearer()))
                .andExpect(status().isNotFound());
    }

    @Test
    @DisplayName("Progress pointing at a chapter of another work is rejected with 400; an unknown chapter with 404")
    void progressMustReferenceAChapterOfThatWork() throws Exception {
        Session reader = register();
        Work otherWork = workRepository.save(Work.create("Other", "Synopsis", WorkType.MANGA, "c.webp", Set.of("Action")));

        mockMvc.perform(put("/api/v1/bookmarks/" + otherWork.getId().value() + "/progress")
                        .header("Authorization", reader.bearer())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(new UpdateProgressRequest(chapter.getId().value(), 2))))
                .andExpect(status().isBadRequest());

        mockMvc.perform(put("/api/v1/bookmarks/" + work.getId().value() + "/progress")
                        .header("Authorization", reader.bearer())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(new UpdateProgressRequest(java.util.UUID.randomUUID(), 2))))
                .andExpect(status().isNotFound());
    }

    @Test
    @DisplayName("Invalid progress payload returns 400")
    void invalidPayloadIsBadRequest() throws Exception {
        Session reader = register();
        mockMvc.perform(put("/api/v1/bookmarks/" + work.getId().value() + "/progress")
                        .header("Authorization", reader.bearer())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"chapterId\":null,\"pageIndex\":0}"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.success").value(false));
    }
}
