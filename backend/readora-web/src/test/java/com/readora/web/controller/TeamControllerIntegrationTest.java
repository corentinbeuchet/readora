package com.readora.web.controller;

import com.readora.web.ReadoraApplication;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.http.MediaType;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.ResultActions;

import java.util.UUID;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/// US-12 running a team through real HTTP, real auth and the real database: who may create a team, change its
/// roster and add a series to it.
@SpringBootTest(classes = ReadoraApplication.class)
@AutoConfigureMockMvc
@ActiveProfiles("test")
class TeamControllerIntegrationTest extends AuthTestSupport {

    @Test
    @DisplayName("A scanlator creates a team, becomes its leader and finds it under 'my teams'; the name is taken once")
    void scanlatorCreatesATeam() throws Exception {
        Session mina = registerScanlator();
        String name = "Moon Scans " + UUID.randomUUID();

        var created = whenICreateTheTeam(mina, name).andExpect(status().isCreated())
                .andExpect(jsonPath("$.data.name").value(name))
                .andExpect(jsonPath("$.data.myRoles[0]").value("LEADER"))
                .andReturn();
        String teamId = json(created).path("data").path("id").asString();

        mockMvc.perform(get("/api/v1/teams/mine").header("Authorization", mina.bearer()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data[0].id").value(teamId))
                .andExpect(jsonPath("$.data[0].boards.length()").value(0));
        mockMvc.perform(get("/api/v1/teams/" + teamId))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.members[0].username").value(mina.username()))
                .andExpect(jsonPath("$.data.series.length()").value(0));
        whenICreateTheTeam(registerScanlator(), name.toUpperCase())
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("TEAM_NAME_TAKEN"));
    }

    @Test
    @DisplayName("Readers and guests cannot create a team, and 'my teams' needs a session")
    void onlyScanlatorsCreateTeams() throws Exception {
        mockMvc.perform(post("/api/v1/teams").contentType(MediaType.APPLICATION_JSON).content("{\"name\":\"Nope\"}"))
                .andExpect(status().isUnauthorized());
        whenICreateTheTeam(register(), "Reader Scans " + UUID.randomUUID()).andExpect(status().isForbidden());
        mockMvc.perform(get("/api/v1/teams/mine")).andExpect(status().isUnauthorized());
    }

    @Test
    @DisplayName("A leader adds an existing series to the team; another team's member cannot, and twice is refused")
    void leaderAddsAnExistingSeries() throws Exception {
        Session shadowLeader = registerScanlator();
        String workId = givenASeriesCreatedBy(shadowLeader);
        Session mina = registerScanlator();
        String moonScans = givenATeamLedBy(mina);

        whenIAddTheSeries(shadowLeader, moonScans, workId)
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.code").value("FORBIDDEN"));
        whenIAddTheSeries(mina, moonScans, workId)
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.data.workId").value(workId))
                .andExpect(jsonPath("$.data.teamId").value(moonScans));
        whenIAddTheSeries(mina, moonScans, workId)
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("SERIES_ALREADY_IN_TEAM"));
        whenIAddTheSeries(mina, moonScans, UUID.randomUUID().toString()).andExpect(status().isNotFound());

        mockMvc.perform(get("/api/v1/teams/" + moonScans)).andExpect(jsonPath("$.data.series.length()").value(1));
        mockMvc.perform(get("/api/v1/works/" + workId + "/projects").header("Authorization", mina.bearer()))
                .andExpect(jsonPath("$.data.length()").value(2));
        mockMvc.perform(get("/api/v1/teams/mine").header("Authorization", mina.bearer()))
                .andExpect(jsonPath("$.data[0].boards[0].work.id").value(workId));
    }

    @Test
    @DisplayName("Only a leader changes the roster; a member (even a plain reader) may leave; the last leader cannot")
    void rosterRules() throws Exception {
        Session mina = registerScanlator();
        Session bob = registerScanlator();
        Session aoi = register();
        String team = givenATeamLedBy(mina);

        whenISetTheMember(mina, team, bob.username(), "TRANSLATOR")
                .andExpect(status().isOk());
        mockMvc.perform(get("/api/v1/teams/" + team)).andExpect(jsonPath("$.data.members.length()").value(2));
        whenISetTheMember(bob, team, aoi.username(), "PROOFREADER")
                .andExpect(status().isForbidden());
        whenISetTheMember(mina, team, "nobody-" + UUID.randomUUID(), "PROOFREADER")
                .andExpect(status().isNotFound());
        mockMvc.perform(put("/api/v1/teams/" + team + "/members/" + bob.username()).header("Authorization", mina.bearer())
                        .contentType(MediaType.APPLICATION_JSON).content("{\"roles\":[]}"))
                .andExpect(status().isBadRequest());

        whenISetTheMember(mina, team, mina.username(), "TRANSLATOR")
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("LAST_LEADER"));
        mockMvc.perform(delete("/api/v1/teams/" + team + "/members/" + mina.username()).header("Authorization", mina.bearer()))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("LAST_LEADER"));
        mockMvc.perform(delete("/api/v1/teams/" + team + "/members/" + mina.username()).header("Authorization", bob.bearer()))
                .andExpect(status().isForbidden());
        mockMvc.perform(delete("/api/v1/teams/" + team + "/members/" + bob.username()).header("Authorization", bob.bearer()))
                .andExpect(status().isOk());
        mockMvc.perform(get("/api/v1/teams/" + team)).andExpect(jsonPath("$.data.members.length()").value(1));

        whenISetTheMember(mina, team, aoi.username(), "PROOFREADER").andExpect(status().isOk());
        mockMvc.perform(delete("/api/v1/teams/" + team + "/members/" + aoi.username()).header("Authorization", aoi.bearer()))
                .andExpect(status().isOk());
    }

    @Test
    @DisplayName("A new series can belong to one of my teams; only its leaders may do that")
    void newSeriesForMyTeam() throws Exception {
        Session mina = registerScanlator();
        Session bob = registerScanlator();
        String moonScans = givenATeamLedBy(mina);

        whenICreateASeriesFor(bob, moonScans).andExpect(status().isForbidden());
        whenICreateASeriesFor(mina, UUID.randomUUID().toString()).andExpect(status().isNotFound());
        var created = whenICreateASeriesFor(mina, moonScans).andExpect(status().isCreated()).andReturn();
        String workId = json(created).path("data").path("id").asString();

        mockMvc.perform(get("/api/v1/works/" + workId + "/projects").header("Authorization", mina.bearer()))
                .andExpect(jsonPath("$.data.length()").value(1))
                .andExpect(jsonPath("$.data[0].teamId").value(moonScans));
        mockMvc.perform(get("/api/v1/teams/" + moonScans)).andExpect(jsonPath("$.data.series[0].work.id").value(workId));
    }

    private ResultActions whenICreateASeriesFor(Session scanlator, String teamId) throws Exception {
        return mockMvc.perform(post("/api/v1/works").header("Authorization", scanlator.bearer()).contentType(MediaType.APPLICATION_JSON)
                .content("{\"title\":\"Team Series " + UUID.randomUUID() + "\",\"type\":\"MANHWA\",\"genres\":[\"Action\"],\"teamId\":\"" + teamId + "\"}"));
    }

    private String givenATeamLedBy(Session leader) throws Exception {
        var created = whenICreateTheTeam(leader, "Team " + UUID.randomUUID()).andExpect(status().isCreated()).andReturn();
        return json(created).path("data").path("id").asString();
    }

    private String givenASeriesCreatedBy(Session scanlator) throws Exception {
        var work = mockMvc.perform(post("/api/v1/works").header("Authorization", scanlator.bearer()).contentType(MediaType.APPLICATION_JSON)
                        .content("{\"title\":\"Solo Leveling " + UUID.randomUUID() + "\",\"type\":\"MANHWA\",\"genres\":[\"Action\"]}"))
                .andExpect(status().isCreated()).andReturn();
        return json(work).path("data").path("id").asString();
    }

    private ResultActions whenICreateTheTeam(Session scanlator, String name) throws Exception {
        return mockMvc.perform(post("/api/v1/teams").header("Authorization", scanlator.bearer()).contentType(MediaType.APPLICATION_JSON)
                .content("{\"name\":\"" + name + "\",\"description\":\"We translate.\"}"));
    }

    private ResultActions whenIAddTheSeries(Session actor, String teamId, String workId) throws Exception {
        return mockMvc.perform(post("/api/v1/teams/" + teamId + "/series").header("Authorization", actor.bearer())
                .contentType(MediaType.APPLICATION_JSON).content("{\"workId\":\"" + workId + "\"}"));
    }

    private ResultActions whenISetTheMember(Session actor, String teamId, String username, String role) throws Exception {
        return mockMvc.perform(put("/api/v1/teams/" + teamId + "/members/" + username).header("Authorization", actor.bearer())
                .contentType(MediaType.APPLICATION_JSON).content("{\"roles\":[\"" + role + "\"]}"));
    }
}
