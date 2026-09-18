package com.readora.web.controller;

import com.readora.domain.common.UserId;
import com.readora.application.port.out.ChapterRepositoryPort;
import com.readora.application.port.out.WorkRepositoryPort;
import com.readora.domain.work.*;
import com.readora.web.ReadoraApplication;
import com.readora.web.dto.CreateCommentRequest;
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

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest(classes = ReadoraApplication.class)
@AutoConfigureMockMvc
@ActiveProfiles("test")
class CommentUpvoteIntegrationTest extends AuthTestSupport {

    @Autowired
    private WorkRepositoryPort workRepository;

    @Autowired
    private ChapterRepositoryPort chapterRepository;

    private Chapter chapter;

    @BeforeEach
    void setup() {
        Work work = workRepository.save(Work.create("Lookism", "Synopsis", WorkType.MANHWA, "cover.webp", Set.of("Drama")));
        Chapter draft = Chapter.createDraft(work.getId(), ChapterNumber.of("1"), "Chapter 1", null);
        draft.updatePages(List.of(PageAsset.create(1, "l/p1.webp", "https://cdn.readora.com/l/p1.webp")));
        draft.publish(UserId.of("publisher1"));
        chapter = chapterRepository.save(draft);
    }

    @Test
    @DisplayName("A reader's upvote counts once; repeating it is a no-op that reports the unchanged total")
    void upvoteCountsOncePerUser() throws Exception {
        Session author = register();
        Session voter = register();
        String commentId = postComment(author);

        mockMvc.perform(post("/api/v1/comments/" + commentId + "/upvote").header("Authorization", voter.bearer()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.counted").value(true))
                .andExpect(jsonPath("$.data.upvotes").value(1));

        mockMvc.perform(post("/api/v1/comments/" + commentId + "/upvote").header("Authorization", voter.bearer()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.counted").value(false))
                .andExpect(jsonPath("$.data.upvotes").value(1));
    }

    @Test
    @DisplayName("Authors cannot upvote their own comment")
    void authorCannotUpvoteOwnComment() throws Exception {
        Session author = register();
        String commentId = postComment(author);

        mockMvc.perform(post("/api/v1/comments/" + commentId + "/upvote").header("Authorization", author.bearer()))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.success").value(false));
    }

    @Test
    @DisplayName("Commenting on a draft chapter is rejected with 400 and on an unknown chapter with 404")
    void commentsNeedAPublishedChapter() throws Exception {
        Session reader = register();
        Chapter draft = chapterRepository.save(Chapter.createDraft(chapter.getWorkId(), ChapterNumber.of("2"), "Draft", null));
        String body = objectMapper.writeValueAsString(new CreateCommentRequest("Early!", null, null, false));

        mockMvc.perform(post("/api/v1/comments/chapter/" + draft.getId().value())
                        .header("Authorization", reader.bearer())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(body))
                .andExpect(status().isBadRequest());

        mockMvc.perform(post("/api/v1/comments/chapter/" + java.util.UUID.randomUUID())
                        .header("Authorization", reader.bearer())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(body))
                .andExpect(status().isNotFound());
    }

    private String postComment(Session author) throws Exception {
        var result = mockMvc.perform(post("/api/v1/comments/chapter/" + chapter.getId().value())
                        .header("Authorization", author.bearer())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(new CreateCommentRequest("Great chapter", null, null, false))))
                .andExpect(status().is2xxSuccessful())
                .andReturn();
        return json(result).path("data").path("id").asString();
    }
}
