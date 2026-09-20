package com.readora.web.controller;

import com.readora.application.port.out.TeamRepositoryPort;
import com.readora.application.port.out.UserAccountRepositoryPort;
import com.readora.domain.identity.Role;
import com.readora.domain.identity.Subscription;
import com.readora.domain.identity.SubscriptionPlan;
import com.readora.domain.identity.UserAccount;
import com.readora.domain.common.UserId;
import com.readora.domain.scanlation.Team;
import com.readora.domain.scanlation.TeamId;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.MediaType;
import org.springframework.mock.web.MockHttpServletResponse;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;

import java.time.Duration;
import java.time.Instant;
import java.util.UUID;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/// Shared helpers for controller integration tests: registers users through the real API
/// and returns their tokens; can promote users to `PREMIUM` / `SCANLATOR` through the repository port.
abstract class AuthTestSupport {

    static final String REFRESH_COOKIE = "readora_refresh";
    static final String PASSWORD = "Sup3rSecret!";

    @Autowired
    protected MockMvc mockMvc;

    @Autowired
    protected ObjectMapper objectMapper;

    @Autowired
    protected UserAccountRepositoryPort userAccountRepository;

    @Autowired
    private TeamRepositoryPort teamRepositoryForTests;

    record Session(String userId, String email, String username, String accessToken, jakarta.servlet.http.Cookie refreshCookie) {
        String bearer() {
            return "Bearer " + accessToken;
        }
    }

    protected Session register() throws Exception {
        String suffix = UUID.randomUUID().toString().substring(0, 8);
        return register("user_" + suffix + "@readora.test", "user_" + suffix);
    }

    protected Session register(String email, String username) throws Exception {
        MvcResult result = mockMvc.perform(post("/api/v1/auth/register")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(new com.readora.web.dto.RegisterRequest(email, username, PASSWORD))))
                .andExpect(status().isCreated())
                .andReturn();
        return toSession(result.getResponse(), email, username);
    }

    protected Session login(String email) throws Exception {
        MvcResult result = mockMvc.perform(post("/api/v1/auth/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(new com.readora.web.dto.LoginRequest(email, PASSWORD))))
                .andExpect(status().isOk())
                .andReturn();
        JsonNode user = objectMapper.readTree(result.getResponse().getContentAsString()).path("data").path("user");
        return toSession(result.getResponse(), email, user.path("username").asString());
    }

    protected Session registerPremium() throws Exception {
        Session reader = register();
        UserAccount account = userAccountRepository.findById(UserId.of(reader.userId())).orElseThrow();
        account.activateSubscription(Subscription.active(SubscriptionPlan.PREMIUM, Instant.now().plus(Duration.ofDays(30)), "cus_test", "sub_test_" + reader.username()));
        userAccountRepository.save(account);
        return login(reader.email());
    }

    protected Session registerScanlator() throws Exception {
        Session reader = register();
        UserAccount account = userAccountRepository.findById(UserId.of(reader.userId())).orElseThrow();
        account.grantRole(Role.SCANLATOR);
        userAccountRepository.save(account);
        return login(reader.email());
    }

    protected JsonNode json(MvcResult result) throws Exception {
        return objectMapper.readTree(result.getResponse().getContentAsString());
    }

    private Session toSession(MockHttpServletResponse response, String email, String username) throws Exception {
        JsonNode body = objectMapper.readTree(response.getContentAsString());
        String accessToken = body.path("data").path("accessToken").asString();
        String userId = body.path("data").path("user").path("id").asString();
        return new Session(userId, email, username, accessToken, response.getCookie(REFRESH_COOKIE));
    }

    /// The team created with a series (`POST /works` gives its creator a "<title> Workspace" team).
    protected String teamOf(Session member, String workId) throws Exception {
        var projects = mockMvc.perform(org.springframework.test.web.servlet.request.MockMvcRequestBuilders
                        .get("/api/v1/works/" + workId + "/projects").header("Authorization", member.bearer()))
                .andExpect(status().isOk()).andReturn();
        return json(projects).path("data").path(0).path("teamId").asString();
    }

    /// Every chapter is some team's version: a throwaway team for tests that are not about teams.
    protected TeamId anyTeam() {
        return teamRepositoryForTests.save(Team.create("Team " + java.util.UUID.randomUUID(), null, UserId.of("any-leader"))).getId();
    }
}
