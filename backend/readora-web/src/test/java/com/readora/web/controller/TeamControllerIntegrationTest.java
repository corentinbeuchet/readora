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
        Session mina = register();
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
        whenICreateTheTeam(register(), name.toUpperCase())
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("TEAM_NAME_TAKEN"));
    }

    @Test
    @DisplayName("Any reader can create a team; guests cannot, and 'my teams' needs a session")
    void anyReaderCreatesATeam() throws Exception {
        mockMvc.perform(post("/api/v1/teams").contentType(MediaType.APPLICATION_JSON).content("{\"name\":\"Nope\"}"))
                .andExpect(status().isUnauthorized());
        whenICreateTheTeam(register(), "Reader Scans " + UUID.randomUUID()).andExpect(status().isCreated());
        mockMvc.perform(get("/api/v1/teams/mine")).andExpect(status().isUnauthorized());
    }

    @Test
    @DisplayName("A leader adds an existing series to the team; another team's member cannot, and twice is refused")
    void leaderAddsAnExistingSeries() throws Exception {
        Session shadowLeader = register();
        String workId = givenASeriesCreatedBy(shadowLeader);
        Session mina = register();
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
                .andExpect(jsonPath("$.data.length()").value(1))
                .andExpect(jsonPath("$.data[0].teamId").value(moonScans));
        mockMvc.perform(get("/api/v1/teams/mine").header("Authorization", mina.bearer()))
                .andExpect(jsonPath("$.data[0].boards[0].work.id").value(workId))
                .andExpect(jsonPath("$.data[0].boards[0].work.title").isString())
                .andExpect(jsonPath("$.data[0].boards[0].work.coverImageUrl").doesNotExist())
                .andExpect(jsonPath("$.data[0].boards[0].work.genres").doesNotExist());
    }

    @Test
    @DisplayName("Only a leader changes the roster; a member (even a plain reader) may leave; the last leader cannot")
    void rosterRules() throws Exception {
        Session mina = register();
        Session bob = register();
        Session aoi = register();
        String team = givenATeamLedBy(mina);

        givenTheyJoinTheTeam(mina, team, bob, "TRANSLATOR");
        mockMvc.perform(get("/api/v1/teams/" + team)).andExpect(jsonPath("$.data.members.length()").value(2));
        whenIInvite(bob, team, aoi.username(), "PROOFREADER")
                .andExpect(status().isForbidden());
        whenIInvite(mina, team, "nobody-" + UUID.randomUUID(), "PROOFREADER")
                .andExpect(status().isNotFound());
        whenISetTheMember(mina, team, aoi.username(), "PROOFREADER")
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("NOT_ON_TEAM"));
        whenISetTheMember(mina, team, bob.username(), "PROOFREADER")
                .andExpect(status().isOk());
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
    }

    @Test
    @DisplayName("A member sees the open tasks their roles cover across their teams, and the ones they claimed first")
    void waitingForMe() throws Exception {
        Session mina = register();
        Session bob = register();
        String team = givenATeamLedBy(mina);
        var created = whenICreateASeriesFor(mina, team).andExpect(status().isCreated()).andReturn();
        String workId = json(created).path("data").path("id").asString();
        String project = json(mockMvc.perform(get("/api/v1/works/" + workId + "/projects").header("Authorization", mina.bearer())).andReturn())
                .path("data").path(0).path("id").asString();
        givenTheBoardIsOn(mina, project);
        for (String chapter : new String[] {"1", "2"}) {
            mockMvc.perform(post("/api/v1/scanlation/projects/" + project + "/tasks").header("Authorization", mina.bearer())
                            .contentType(MediaType.APPLICATION_JSON).content("{\"chapterNumber\":" + chapter + ",\"assetUrl\":\"https://cdn.test/raw.zip\",\"pageCount\":5}"))
                    .andExpect(status().isCreated());
        }
        givenTheyJoinTheTeam(mina, team, bob, "CLEANER_REDRAWER");
        String second = json(mockMvc.perform(get("/api/v1/teams/mine/tasks").header("Authorization", bob.bearer())).andReturn())
                .path("data").path(1).path("taskId").asString();
        mockMvc.perform(post("/api/v1/scanlation/projects/" + project + "/tasks/" + second + "/claim").header("Authorization", bob.bearer()))
                .andExpect(status().isOk());

        mockMvc.perform(get("/api/v1/teams/mine/tasks").header("Authorization", bob.bearer()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.length()").value(2))
                .andExpect(jsonPath("$.data[0].chapterNumber").value("2"))
                .andExpect(jsonPath("$.data[0].mine").value(true))
                .andExpect(jsonPath("$.data[0].projectId").value(project))
                .andExpect(jsonPath("$.data[1].chapterNumber").value("1"))
                .andExpect(jsonPath("$.data[1].mine").value(false))
                .andExpect(jsonPath("$.data[1].stage").value("RAW_UPLOADED"));
        mockMvc.perform(get("/api/v1/teams/mine/tasks")).andExpect(status().isUnauthorized());
    }

    @Test
    @DisplayName("Only a leader switches the task board of a series: a member or an outsider is refused, an unknown board is 404")
    void onlyALeaderSwitchesTheBoard() throws Exception {
        Session mina = register();
        Session bob = register();
        Session aoi = register();
        String team = givenATeamLedBy(mina);
        var created = whenICreateASeriesFor(mina, team).andExpect(status().isCreated()).andReturn();
        String workId = json(created).path("data").path("id").asString();
        String project = json(mockMvc.perform(get("/api/v1/works/" + workId + "/projects").header("Authorization", mina.bearer())).andReturn())
                .path("data").path(0).path("id").asString();
        givenTheyJoinTheTeam(mina, team, bob, "QUALITY_CHECKER");

        whenISwitchTheBoard(bob, project).andExpect(status().isForbidden());
        whenISwitchTheBoard(aoi, project).andExpect(status().isForbidden());
        whenISwitchTheBoard(mina, UUID.randomUUID().toString()).andExpect(status().isNotFound());
        whenISwitchTheBoard(mina, project).andExpect(status().isOk()).andExpect(jsonPath("$.data.boardEnabled").value(true));
    }

    @Test
    @DisplayName("A signed-in reader finds readers by the start of their username, to invite them; guests cannot")
    void findReadersByName() throws Exception {
        Session mina = register();
        Session bob = register();
        String start = bob.username().substring(0, 6);

        mockMvc.perform(get("/api/v1/users").param("q", start)).andExpect(status().isUnauthorized());
        mockMvc.perform(get("/api/v1/users").param("q", start.toUpperCase()).header("Authorization", mina.bearer()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data[*].username", org.hamcrest.Matchers.hasItem(bob.username())));
        mockMvc.perform(get("/api/v1/users").param("q", "e").header("Authorization", mina.bearer()))
                .andExpect(status().isBadRequest());
        mockMvc.perform(get("/api/v1/users").param("q", "%%").header("Authorization", mina.bearer()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.length()").value(0));
    }

    @Test
    @DisplayName("An invitation waits for the reader's answer: only they accept or decline it, the leader may cancel it")
    void invitationFlow() throws Exception {
        Session mina = register();
        Session bob = register();
        Session aoi = register();
        String team = givenATeamLedBy(mina);

        String invitation = invitationId(whenIInvite(mina, team, bob.username(), "TRANSLATOR")
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.data.invitee").value(bob.username()))
                .andExpect(jsonPath("$.data.status").value("PENDING")));
        whenIInvite(mina, team, bob.username(), "PROOFREADER")
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("INVITATION_PENDING"));
        mockMvc.perform(get("/api/v1/teams/" + team + "/invitations").header("Authorization", mina.bearer()))
                .andExpect(jsonPath("$.data.length()").value(1));
        mockMvc.perform(get("/api/v1/teams/" + team + "/invitations").header("Authorization", bob.bearer()))
                .andExpect(status().isForbidden());
        mockMvc.perform(get("/api/v1/invitations/mine").header("Authorization", bob.bearer()))
                .andExpect(jsonPath("$.data[0].id").value(invitation))
                .andExpect(jsonPath("$.data[0].teamName").isString())
                .andExpect(jsonPath("$.data[0].invitedBy").value(mina.username()));
        mockMvc.perform(get("/api/v1/notifications").header("Authorization", bob.bearer()))
                .andExpect(jsonPath("$.data[0].type").value("TEAM_INVITATION"));

        mockMvc.perform(post("/api/v1/invitations/" + invitation + "/accept").header("Authorization", aoi.bearer()))
                .andExpect(status().isForbidden());
        mockMvc.perform(post("/api/v1/invitations/" + invitation + "/accept").header("Authorization", bob.bearer()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.myRoles[0]").value("TRANSLATOR"));
        mockMvc.perform(post("/api/v1/invitations/" + invitation + "/decline").header("Authorization", bob.bearer()))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("ALREADY_HANDLED"));
        whenIInvite(mina, team, bob.username(), "PROOFREADER")
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("ALREADY_ON_TEAM"));

        String toAoi = invitationId(whenIInvite(mina, team, aoi.username(), "PROOFREADER").andExpect(status().isCreated()));
        mockMvc.perform(delete("/api/v1/teams/" + team + "/invitations/" + toAoi).header("Authorization", bob.bearer()))
                .andExpect(status().isForbidden());
        mockMvc.perform(delete("/api/v1/teams/" + team + "/invitations/" + toAoi).header("Authorization", mina.bearer()))
                .andExpect(status().isNoContent());
        mockMvc.perform(get("/api/v1/invitations/mine").header("Authorization", aoi.bearer()))
                .andExpect(jsonPath("$.data.length()").value(0));
    }

    @Test
    @DisplayName("A new series can belong to one of my teams; only its leaders may do that")
    void newSeriesForMyTeam() throws Exception {
        Session mina = register();
        Session bob = register();
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

    @Test
    @DisplayName("Two teams publish the same chapter: one row per version, next stays with the team, progress follows the number")
    void twoTeamsPublishTheSameChapter() throws Exception {
        Session shadowLeader = register();
        String workId = givenASeriesCreatedBy(shadowLeader);
        String shadow = teamOf(shadowLeader, workId);
        Session mina = register();
        String moon = givenATeamLedBy(mina);
        whenIAddTheSeries(mina, moon, workId).andExpect(status().isCreated());

        String shadow5 = whenIPublish(shadowLeader, workId, shadow, "5").andExpect(status().isCreated()).andReturn().getResponse().getContentAsString();
        String moon5 = idOf(whenIPublish(mina, workId, moon, "5").andExpect(status().isCreated()).andReturn());
        String moon6 = idOf(whenIPublish(mina, workId, moon, "6").andExpect(status().isCreated()).andReturn());
        whenIPublish(mina, workId, moon, "5")
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("CHAPTER_ALREADY_EXISTS"));

        mockMvc.perform(get("/api/v1/works/" + workId + "/chapters"))
                .andExpect(jsonPath("$.data.length()").value(3))
                .andExpect(jsonPath("$.data[0].chapterNumber").value("5"))
                .andExpect(jsonPath("$.data[0].team.id").value(shadow))
                .andExpect(jsonPath("$.data[1].chapterNumber").value("5"))
                .andExpect(jsonPath("$.data[1].team.id").value(moon))
                .andExpect(jsonPath("$.data[2].chapterNumber").value("6"));
        mockMvc.perform(get("/api/v1/chapters/" + moon5))
                .andExpect(jsonPath("$.data.versions.length()").value(2))
                .andExpect(jsonPath("$.data.versions[0].team.id").value(shadow))
                .andExpect(jsonPath("$.data.versions[1].chapterId").value(moon5))
                .andExpect(jsonPath("$.data.next.chapterNumber").value("6"))
                .andExpect(jsonPath("$.data.nextChapterId").value(moon6))
                .andExpect(jsonPath("$.data.previous").doesNotExist());
        org.assertj.core.api.Assertions.assertThat(shadow5).contains("\"chapterNumber\":\"5\"");

        Session kenji = register();
        mockMvc.perform(put("/api/v1/reading/chapters/" + moon5).header("Authorization", kenji.bearer())
                        .contentType(MediaType.APPLICATION_JSON).content("{\"finished\":true}"))
                .andExpect(status().isOk());
        mockMvc.perform(get("/api/v1/reading/works/" + workId).header("Authorization", kenji.bearer()))
                .andExpect(jsonPath("$.data.finishedChapterNumbers[0]").value("5"))
                .andExpect(jsonPath("$.data.finishedChapterNumbers.length()").value(1))
                .andExpect(jsonPath("$.data.nextChapterNumber").value("6"))
                .andExpect(jsonPath("$.data.nextChapterId").value(moon6));
    }

    private ResultActions whenIPublish(Session publisher, String workId, String teamId, String number) throws Exception {
        return mockMvc.perform(post("/api/v1/works/" + workId + "/chapters/direct").header("Authorization", publisher.bearer())
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"teamId\":\"" + teamId + "\",\"chapterNumber\":\"" + number + "\",\"title\":\"Ch\",\"pages\":"
                        + "[{\"pageNumber\":1,\"storageKey\":\"t/p1.webp\",\"cdnUrl\":\"https://cdn.readora.com/t/p1.webp\",\"width\":800,\"height\":1200}]}"));
    }

    private String idOf(org.springframework.test.web.servlet.MvcResult result) throws Exception {
        return json(result).path("data").path("id").asString();
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
                        .content("{\"title\":\"Solo Leveling " + UUID.randomUUID() + "\",\"type\":\"MANHWA\",\"genres\":[\"Action\"],\"teamId\":\""
                                + aTeamLedBy(scanlator) + "\"}"))
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

    private ResultActions whenIInvite(Session actor, String teamId, String username, String role) throws Exception {
        return mockMvc.perform(post("/api/v1/teams/" + teamId + "/invitations").header("Authorization", actor.bearer())
                .contentType(MediaType.APPLICATION_JSON).content("{\"username\":\"" + username + "\",\"roles\":[\"" + role + "\"]}"));
    }

    private ResultActions whenISwitchTheBoard(Session actor, String projectId) throws Exception {
        return mockMvc.perform(put("/api/v1/scanlation/projects/" + projectId + "/board").header("Authorization", actor.bearer())
                .contentType(MediaType.APPLICATION_JSON).content("{\"enabled\":true}"));
    }

    private String invitationId(ResultActions invited) throws Exception {
        return json(invited.andReturn()).path("data").path("id").asString();
    }

    private ResultActions whenISetTheMember(Session actor, String teamId, String username, String role) throws Exception {
        return mockMvc.perform(put("/api/v1/teams/" + teamId + "/members/" + username).header("Authorization", actor.bearer())
                .contentType(MediaType.APPLICATION_JSON).content("{\"roles\":[\"" + role + "\"]}"));
    }
}
