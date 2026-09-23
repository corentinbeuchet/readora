package com.readora.web.controller;

import com.readora.web.ReadoraApplication;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.http.MediaType;
import org.springframework.test.context.ActiveProfiles;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/// A reader's plan without a payment provider: Free by default, Premium when granted; buying and cancelling are gone.
@SpringBootTest(classes = ReadoraApplication.class)
@AutoConfigureMockMvc
@ActiveProfiles("test")
class SubscriptionControllerIntegrationTest extends AuthTestSupport {

    @Test
    @DisplayName("A new reader is on the Free plan, a Premium reader on an active Premium plan")
    void myPlan() throws Exception {
        Session reader = register();
        Session premium = registerPremium();

        mockMvc.perform(get("/api/v1/subscriptions/me").header("Authorization", reader.bearer()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.plan").value("FREE"));
        mockMvc.perform(get("/api/v1/subscriptions/me").header("Authorization", premium.bearer()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.plan").value("PREMIUM"))
                .andExpect(jsonPath("$.data.active").value(true));
    }

    @Test
    @DisplayName("My plan needs a signed-in reader")
    void myPlanNeedsASignedInReader() throws Exception {
        mockMvc.perform(get("/api/v1/subscriptions/me")).andExpect(status().isUnauthorized());
    }

    @Test
    @DisplayName("Checkout and cancellation no longer exist without a payment provider")
    void noCheckoutWithoutPayments() throws Exception {
        Session reader = register();

        mockMvc.perform(post("/api/v1/subscriptions/checkout").header("Authorization", reader.bearer())
                        .contentType(MediaType.APPLICATION_JSON).content("{\"plan\":\"PREMIUM\"}"))
                .andExpect(status().isNotFound());
        mockMvc.perform(post("/api/v1/subscriptions/cancel").header("Authorization", reader.bearer()))
                .andExpect(status().isNotFound());
    }
}
