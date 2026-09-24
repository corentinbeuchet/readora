package com.readora.web.controller;

import com.readora.application.port.out.MailPort;
import com.readora.web.ReadoraApplication;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.http.MediaType;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.bean.override.mockito.MockitoBean;

import java.util.regex.Matcher;
import java.util.regex.Pattern;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/// US-15 forgotten password through real HTTP: the same answer for any address, a link in French for the French site,
/// and a link that works once and ends every session.
@SpringBootTest(classes = ReadoraApplication.class)
@AutoConfigureMockMvc
@ActiveProfiles("test")
class PasswordResetIntegrationTest extends AuthTestSupport {

    @MockitoBean
    private MailPort mail;

    @Test
    @DisplayName("An unknown address gets the same answer and no email")
    void unknownAddress() throws Exception {
        whenIAskForALink("nobody-" + System.nanoTime() + "@readora.test", "en")
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data").value("If an account uses this email, a reset link is on its way"));

        verify(mail, never()).send(any());
    }

    @Test
    @DisplayName("The link from the email sets a new password once, ends every session, and speaks the site's language")
    void resetFlow() throws Exception {
        Session session = register();

        whenIAskForALink(session.email(), "fr")
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data").value("If an account uses this email, a reset link is on its way"));

        MailPort.Email email = theEmailSent();
        assertThat(email.to()).isEqualTo(session.email());
        assertThat(email.subject()).isEqualTo("Choisissez un nouveau mot de passe Readora");
        String token = tokenIn(email.text(), "http://localhost:4200/fr/reset-password?token=");

        whenIResetWith(token, "Brand-new-pass1").andExpect(status().isOk());
        whenIResetWith(token, "Another-pass2").andExpect(status().isBadRequest()).andExpect(jsonPath("$.code").value("RESET_LINK_INVALID"));
        whenIResetWith("not-a-token", "Another-pass2").andExpect(status().isBadRequest()).andExpect(jsonPath("$.code").value("RESET_LINK_INVALID"));

        mockMvc.perform(post("/api/v1/auth/refresh").cookie(session.refreshCookie())).andExpect(status().isUnauthorized());
        mockMvc.perform(post("/api/v1/auth/login").contentType(MediaType.APPLICATION_JSON)
                        .content("{\"email\":\"" + session.email() + "\",\"password\":\"Brand-new-pass1\"}"))
                .andExpect(status().isOk());
    }

    private org.springframework.test.web.servlet.ResultActions whenIAskForALink(String email, String language) throws Exception {
        return mockMvc.perform(post("/api/v1/auth/password-reset").contentType(MediaType.APPLICATION_JSON)
                .content("{\"email\":\"" + email + "\",\"language\":\"" + language + "\"}"));
    }

    private org.springframework.test.web.servlet.ResultActions whenIResetWith(String token, String password) throws Exception {
        return mockMvc.perform(post("/api/v1/auth/password-reset/confirm").contentType(MediaType.APPLICATION_JSON)
                .content("{\"token\":\"" + token + "\",\"newPassword\":\"" + password + "\"}"));
    }

    private MailPort.Email theEmailSent() {
        ArgumentCaptor<MailPort.Email> sent = ArgumentCaptor.forClass(MailPort.Email.class);
        verify(mail).send(sent.capture());
        return sent.getValue();
    }

    private static String tokenIn(String text, String linkStart) {
        Matcher link = Pattern.compile(Pattern.quote(linkStart) + "(\\S+)").matcher(text);
        assertThat(link.find()).as("the email holds a link starting with %s", linkStart).isTrue();
        return link.group(1);
    }
}
