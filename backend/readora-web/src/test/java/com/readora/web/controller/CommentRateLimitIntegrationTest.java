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
import org.springframework.test.context.TestPropertySource;

import java.util.List;
import java.util.Set;

import static org.hamcrest.Matchers.containsString;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/// US-11 anti-spam: with the production interval, a second comment within 10 seconds is refused with 429.
@SpringBootTest(classes = ReadoraApplication.class)
@AutoConfigureMockMvc
@ActiveProfiles("test")
@TestPropertySource(properties = "readora.comments.min-interval=10s")
class CommentRateLimitIntegrationTest extends AuthTestSupport {

    @Autowired
    private WorkRepositoryPort workRepository;

    @Autowired
    private ChapterRepositoryPort chapterRepository;

    @Test
    @DisplayName("A second comment right after the first is refused with 429 and a wait message; other readers are not affected")
    void commentingTooFast() throws Exception {
        Work work = workRepository.save(Work.create("Rate Limited", "", WorkType.MANGA, "c.webp", Set.of("Action")));
        Chapter chapter = Chapter.createDraft(work.getId(), ChapterNumber.of("1"), "Ch 1", null);
        chapter.updatePages(List.of(PageAsset.create(1, "rl/p1.webp", null)));
        chapter.publish(UserId.of("publisher"));
        String url = "/api/v1/comments/chapter/" + chapterRepository.save(chapter).getId().value();
        String body = "{\"content\":\"First!\",\"isSpoiler\":false}";
        Session kenji = register();
        Session aoi = register();

        mockMvc.perform(post(url).header("Authorization", kenji.bearer()).contentType(MediaType.APPLICATION_JSON).content(body))
                .andExpect(status().isOk());
        mockMvc.perform(post(url).header("Authorization", kenji.bearer()).contentType(MediaType.APPLICATION_JSON).content(body))
                .andExpect(status().isTooManyRequests())
                .andExpect(jsonPath("$.error", containsString("seconds before commenting again")));
        mockMvc.perform(post(url).header("Authorization", aoi.bearer()).contentType(MediaType.APPLICATION_JSON).content(body))
                .andExpect(status().isOk());
    }
}
