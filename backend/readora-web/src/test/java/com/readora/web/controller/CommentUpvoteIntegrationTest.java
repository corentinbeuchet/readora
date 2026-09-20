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

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
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
        Chapter draft = Chapter.createDraft(work.getId(), ChapterNumber.of("1"), "Chapter 1", anyTeam());
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
        Chapter draft = chapterRepository.save(Chapter.createDraft(chapter.getWorkId(), ChapterNumber.of("2"), "Draft", anyTeam()));
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

    @Test
    @DisplayName("Top comments (public) are the most upvoted ones without spoilers or replies")
    void topCommentsSkipSpoilersAndReplies() throws Exception {
        Session author = register();
        Session voter = register();
        String plain = postComment(author);
        String liked = postComment(author, "Loved it", null, false);
        String spoiler = postComment(author, "He dies!", null, true);
        String reply = postComment(author, "Same", liked, false);
        for (String id : List.of(liked, spoiler, reply)) {
            mockMvc.perform(post("/api/v1/comments/" + id + "/upvote").header("Authorization", voter.bearer())).andExpect(status().isOk());
        }

        mockMvc.perform(get("/api/v1/comments/chapter/" + chapter.getId().value() + "/top"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.length()").value(2))
                .andExpect(jsonPath("$.data[0].id").value(liked))
                .andExpect(jsonPath("$.data[1].id").value(plain));
        mockMvc.perform(get("/api/v1/comments/chapter/" + chapter.getId().value() + "/top").param("limit", "1"))
                .andExpect(jsonPath("$.data.length()").value(1));
    }

    private String postComment(Session author) throws Exception {
        return postComment(author, "Great chapter", null, false);
    }

    private String postComment(Session author, String text, String parentId, boolean spoiler) throws Exception {
        var result = mockMvc.perform(post("/api/v1/comments/chapter/" + chapter.getId().value())
                        .header("Authorization", author.bearer())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(new CreateCommentRequest(text, null,
                                parentId == null ? null : java.util.UUID.fromString(parentId), spoiler))))
                .andExpect(status().is2xxSuccessful())
                .andReturn();
        return json(result).path("data").path("id").asString();
    }
}
