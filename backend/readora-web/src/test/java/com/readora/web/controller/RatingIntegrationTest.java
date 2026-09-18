package com.readora.web.controller;

import com.readora.application.port.out.WorkRepositoryPort;
import com.readora.domain.work.Work;
import com.readora.domain.work.WorkType;
import com.readora.web.ReadoraApplication;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.http.MediaType;
import org.springframework.test.context.ActiveProfiles;

import java.util.Set;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/// US-09 ratings and reviews through real HTTP, real auth and the real database.
@SpringBootTest(classes = ReadoraApplication.class)
@AutoConfigureMockMvc
@ActiveProfiles("test")
class RatingIntegrationTest extends AuthTestSupport {

    @Autowired
    private WorkRepositoryPort workRepository;

    @Test
    @DisplayName("Readers rate once each, the average is public, reviews collect helpful votes from others only")
    void ratingsAndReviews() throws Exception {
        Work work = workRepository.save(Work.create("Rated Work", "", WorkType.MANGA, "c.webp", Set.of("Action")));
        String base = "/api/v1/works/" + work.getId().value();
        Session kenji = register();
        Session aoi = register();

        rate(kenji, base, 9);
        rate(kenji, base, 10);
        rate(aoi, base, 7);
        mockMvc.perform(get(base + "/ratings"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.average").value(8.5))
                .andExpect(jsonPath("$.data.count").value(2));
        mockMvc.perform(get(base + "/rating/mine").header("Authorization", kenji.bearer()))
                .andExpect(jsonPath("$.data.score").value(10));

        var review = mockMvc.perform(put(base + "/review").header("Authorization", kenji.bearer())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"score\":10,\"liked\":\"Art\",\"disliked\":\"Hiatus\",\"verdict\":\"A masterpiece\"}"))
                .andExpect(status().isOk())
                .andReturn();
        String reviewId = json(review).path("data").path("id").asString();

        mockMvc.perform(post("/api/v1/reviews/" + reviewId + "/helpful").header("Authorization", kenji.bearer()))
                .andExpect(status().isBadRequest());
        mockMvc.perform(post("/api/v1/reviews/" + reviewId + "/helpful").header("Authorization", aoi.bearer()))
                .andExpect(jsonPath("$.data.helpfulVotes").value(1));
        mockMvc.perform(post("/api/v1/reviews/" + reviewId + "/helpful").header("Authorization", aoi.bearer()))
                .andExpect(jsonPath("$.data.helpfulVotes").value(1));

        mockMvc.perform(get(base + "/reviews"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.length()").value(1))
                .andExpect(jsonPath("$.data[0].verdict").value("A masterpiece"))
                .andExpect(jsonPath("$.data[0].authorUsername").value(kenji.username()))
                .andExpect(jsonPath("$.data[0].helpfulVotes").value(1));
    }

    @Test
    @DisplayName("Ratings need a signed-in reader, a score from 1 to 10 and a verdict for reviews")
    void invalidRatings() throws Exception {
        Work work = workRepository.save(Work.create("Rated Work 2", "", WorkType.MANGA, "c.webp", Set.of("Action")));
        String base = "/api/v1/works/" + work.getId().value();
        Session kenji = register();

        mockMvc.perform(put(base + "/rating").contentType(MediaType.APPLICATION_JSON).content("{\"score\":5}"))
                .andExpect(status().isUnauthorized());
        mockMvc.perform(put(base + "/rating").header("Authorization", kenji.bearer())
                        .contentType(MediaType.APPLICATION_JSON).content("{\"score\":11}"))
                .andExpect(status().isBadRequest());
        mockMvc.perform(put(base + "/review").header("Authorization", kenji.bearer())
                        .contentType(MediaType.APPLICATION_JSON).content("{\"score\":5,\"verdict\":\" \"}"))
                .andExpect(status().isBadRequest());
        mockMvc.perform(get(base + "/rating/mine").header("Authorization", kenji.bearer()))
                .andExpect(status().isNotFound());
        mockMvc.perform(get(base + "/ratings"))
                .andExpect(jsonPath("$.data.count").value(0));
    }

    private void rate(Session session, String base, int score) throws Exception {
        mockMvc.perform(put(base + "/rating").header("Authorization", session.bearer())
                        .contentType(MediaType.APPLICATION_JSON).content("{\"score\":" + score + "}"))
                .andExpect(status().isOk());
    }
}
