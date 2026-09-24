package com.readora.web.controller;

import com.readora.web.ReadoraApplication;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.http.MediaType;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.ResultActions;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/// US-16 through real HTTP: only admins look after accounts, and a decision reaches a token issued before it.
@SpringBootTest(classes = ReadoraApplication.class)
@AutoConfigureMockMvc
@ActiveProfiles("test")
class AdminIntegrationTest extends AuthTestSupport {

    @Test
    @DisplayName("An admin finds an account and names a moderator; a reader may not look after accounts; nobody administers themselves")
    void findAndNameAModerator() throws Exception {
        Session ada = anAdmin();
        Session kenji = register();

        mockMvc.perform(get("/api/v1/admin/accounts").param("q", kenji.username()).header("Authorization", kenji.bearer()))
                .andExpect(status().isForbidden());
        mockMvc.perform(get("/api/v1/admin/accounts").param("q", kenji.username()).header("Authorization", ada.bearer()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data[0].username").value(kenji.username()))
                .andExpect(jsonPath("$.data[0].roles[0]").value("READER"))
                .andExpect(jsonPath("$.data[0].standing").value("ACTIVE"));

        whenTheAdmin(ada, put("/api/v1/admin/accounts/" + kenji.userId() + "/role"), "{\"role\":\"MODERATOR\"}")
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.roles[0]").value("MODERATOR"));
        mockMvc.perform(get("/api/v1/moderation/reports").header("Authorization", login(kenji.email()).bearer())).andExpect(status().isOk());

        whenTheAdmin(ada, put("/api/v1/admin/accounts/" + ada.userId() + "/role"), "{\"role\":\"READER\"}")
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("SELF_ADMINISTRATION"));
    }

    @Test
    @DisplayName("A suspended reader's old token still reads but cannot write, login and refresh are refused, reinstating lets them back")
    void suspension() throws Exception {
        Session ada = anAdmin();
        Session kenji = register();

        whenTheAdmin(ada, post("/api/v1/admin/accounts/" + kenji.userId() + "/suspend"), "{\"days\":7}")
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.standing").value("SUSPENDED"))
                .andExpect(jsonPath("$.data.suspendedUntil").isNotEmpty());

        mockMvc.perform(get("/api/v1/library").header("Authorization", kenji.bearer())).andExpect(status().isOk());
        mockMvc.perform(put("/api/v1/profile").header("Authorization", kenji.bearer()).contentType(MediaType.APPLICATION_JSON)
                        .content("{\"displayName\":\"Still here\"}"))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.code").value("ACCOUNT_SUSPENDED"));
        mockMvc.perform(post("/api/v1/auth/refresh").cookie(kenji.refreshCookie())).andExpect(status().isUnauthorized());
        whenILogIn(kenji).andExpect(status().isForbidden()).andExpect(jsonPath("$.code").value("ACCOUNT_SUSPENDED"));

        whenTheAdmin(ada, post("/api/v1/admin/accounts/" + kenji.userId() + "/reinstate"), "").andExpect(status().isOk());
        whenILogIn(kenji).andExpect(status().isOk());
    }

    @Test
    @DisplayName("A banned reader cannot log in; a deleted account's old token cannot write")
    void banAndClosedAccount() throws Exception {
        Session ada = anAdmin();
        Session kenji = register();
        Session aoi = register();

        whenTheAdmin(ada, post("/api/v1/admin/accounts/" + kenji.userId() + "/ban"), "").andExpect(status().isOk());
        whenILogIn(kenji).andExpect(status().isForbidden()).andExpect(jsonPath("$.code").value("ACCOUNT_BANNED"));

        mockMvc.perform(post("/api/v1/auth/delete-account").header("Authorization", aoi.bearer()).contentType(MediaType.APPLICATION_JSON)
                .content("{\"password\":\"" + PASSWORD + "\"}")).andExpect(status().isOk());
        mockMvc.perform(put("/api/v1/profile").header("Authorization", aoi.bearer()).contentType(MediaType.APPLICATION_JSON)
                        .content("{\"displayName\":\"Ghost\"}"))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.code").value("ACCOUNT_CLOSED"));
    }

    private ResultActions whenTheAdmin(Session admin, org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder request,
                                       String body) throws Exception {
        return mockMvc.perform(request.header("Authorization", admin.bearer()).contentType(MediaType.APPLICATION_JSON)
                .content(body.isEmpty() ? "{}" : body));
    }

    private ResultActions whenILogIn(Session session) throws Exception {
        return mockMvc.perform(post("/api/v1/auth/login").contentType(MediaType.APPLICATION_JSON)
                .content("{\"email\":\"" + session.email() + "\",\"password\":\"" + PASSWORD + "\"}"));
    }
}
