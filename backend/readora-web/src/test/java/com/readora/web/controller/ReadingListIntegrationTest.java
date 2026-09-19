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
import java.util.UUID;

import static org.hamcrest.Matchers.hasItem;
import static org.hamcrest.Matchers.not;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/// US-05 public lists through real HTTP and the real database.
@SpringBootTest(classes = ReadoraApplication.class)
@AutoConfigureMockMvc
@ActiveProfiles("test")
class ReadingListIntegrationTest extends AuthTestSupport {

    @Autowired
    private WorkRepositoryPort workRepository;

    @Test
    @DisplayName("Drafts are private; published lists are public and upvoted once per reader, never by the owner")
    void listsFlow() throws Exception {
        String solo = workRepository.save(Work.create("List Solo", "", WorkType.MANHWA, "c.webp", Set.of("Action"))).getId().value().toString();
        String omni = workRepository.save(Work.create("List Omni", "", WorkType.MANHWA, "c.webp", Set.of("Action"))).getId().value().toString();
        Session kenji = register();
        Session aoi = register();
        String title = "Peak Webtoons " + UUID.randomUUID();

        var created = mockMvc.perform(post("/api/v1/lists").header("Authorization", kenji.bearer()).contentType(MediaType.APPLICATION_JSON)
                        .content("{\"title\":\"" + title + "\",\"description\":\"The finest\",\"published\":false,"
                                + "\"items\":[{\"workId\":\"" + solo + "\",\"note\":\"Masterpiece dungeon art\"}]}"))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.data.items[0].note").value("Masterpiece dungeon art"))
                .andReturn();
        String listId = json(created).path("data").path("id").asString();

        mockMvc.perform(get("/api/v1/lists/" + listId)).andExpect(status().isNotFound());
        mockMvc.perform(get("/api/v1/lists/" + listId).header("Authorization", kenji.bearer())).andExpect(status().isOk());
        mockMvc.perform(get("/api/v1/lists")).andExpect(jsonPath("$.data[*].title", not(hasItem(title))));
        mockMvc.perform(post("/api/v1/lists/" + listId + "/items").header("Authorization", aoi.bearer())
                        .contentType(MediaType.APPLICATION_JSON).content("{\"workId\":\"" + omni + "\"}"))
                .andExpect(status().isForbidden());

        mockMvc.perform(post("/api/v1/lists/" + listId + "/items").header("Authorization", kenji.bearer())
                        .contentType(MediaType.APPLICATION_JSON).content("{\"workId\":\"" + omni + "\",\"note\":\"Unbeatable\"}"))
                .andExpect(jsonPath("$.data.items.length()").value(2));
        mockMvc.perform(put("/api/v1/lists/" + listId).header("Authorization", kenji.bearer()).contentType(MediaType.APPLICATION_JSON)
                        .content("{\"title\":\"" + title + "\",\"published\":true,\"items\":[{\"workId\":\"" + solo + "\"},{\"workId\":\"" + omni + "\"}]}"))
                .andExpect(jsonPath("$.data.published").value(true));

        mockMvc.perform(get("/api/v1/lists/" + listId)).andExpect(status().isOk()).andExpect(jsonPath("$.data.items.length()").value(2));
        mockMvc.perform(get("/api/v1/lists")).andExpect(jsonPath("$.data[*].title", hasItem(title)));
        mockMvc.perform(post("/api/v1/lists/" + listId + "/upvote").header("Authorization", kenji.bearer())).andExpect(status().isBadRequest());
        mockMvc.perform(post("/api/v1/lists/" + listId + "/upvote").header("Authorization", aoi.bearer())).andExpect(jsonPath("$.data.upvotes").value(1));
        mockMvc.perform(post("/api/v1/lists/" + listId + "/upvote").header("Authorization", aoi.bearer())).andExpect(jsonPath("$.data.upvotes").value(1));
        mockMvc.perform(get("/api/v1/lists/mine").header("Authorization", kenji.bearer())).andExpect(jsonPath("$.data[0].upvotes").value(1));
        mockMvc.perform(get("/api/v1/lists/mine")).andExpect(status().isUnauthorized());

        mockMvc.perform(post("/api/v1/lists").header("Authorization", kenji.bearer()).contentType(MediaType.APPLICATION_JSON)
                        .content("{\"title\":\"Bad\",\"published\":true,\"items\":[{\"workId\":\"" + UUID.randomUUID() + "\"}]}"))
                .andExpect(status().isNotFound());
    }
}
