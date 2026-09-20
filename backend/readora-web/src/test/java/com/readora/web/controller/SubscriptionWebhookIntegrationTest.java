package com.readora.web.controller;

import com.readora.domain.common.UserId;
import com.readora.application.exception.WebhookVerificationException;
import com.readora.application.port.out.ChapterRepositoryPort;
import com.readora.application.port.out.PaymentPort;
import com.readora.application.port.out.PaymentPort.PaymentEvent;
import com.readora.application.port.out.PaymentPort.PaymentEventType;
import com.readora.application.port.out.WorkRepositoryPort;
import com.readora.domain.identity.SubscriptionPlan;
import com.readora.domain.identity.SubscriptionStatus;
import com.readora.domain.work.*;
import com.readora.web.ReadoraApplication;
import com.readora.web.dto.CheckoutRequest;
import com.readora.web.dto.UpdateProgressRequest;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.http.MediaType;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.bean.override.mockito.MockitoBean;

import java.time.Duration;
import java.time.Instant;
import java.util.List;
import java.util.Set;

import static org.assertj.core.api.Assertions.assertThat;
import static org.hamcrest.Matchers.hasItem;
import static org.hamcrest.Matchers.not;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest(classes = ReadoraApplication.class)
@AutoConfigureMockMvc
@ActiveProfiles("test")
class SubscriptionWebhookIntegrationTest extends AuthTestSupport {

    private static final String WEBHOOK = "/api/v1/subscriptions/stripe/webhook";
    private static final String VALID_SIGNATURE = "t=1,v1=valid";

    @MockitoBean
    private PaymentPort paymentPort;

    @Autowired
    private WorkRepositoryPort workRepository;

    @Autowired
    private ChapterRepositoryPort chapterRepository;

    private Work work;
    private Chapter chapter;

    @BeforeEach
    void setup() {
        work = workRepository.save(Work.create("Vinland Saga", "Synopsis", WorkType.MANGA, "cover.webp", Set.of("Historical")));
        chapter = Chapter.createDraft(work.getId(), ChapterNumber.of("1"), "Chapter 1", anyTeam());
        chapter.updatePages(List.of(PageAsset.create(1, "v/p1.webp", "https://cdn.readora.com/v/p1.webp")));
        chapter.publish(UserId.of("publisher1"));
        chapter = chapterRepository.save(chapter);
    }

    @Test
    @DisplayName("checkout.session.completed activates PREMIUM and grants BOOKMARK_WRITE; subscription.deleted revokes it")
    void webhookActivatesThenCancelsPremium() throws Exception {
        Session reader = register();
        String progressUrl = "/api/v1/bookmarks/" + work.getId().value() + "/progress";
        String progressBody = objectMapper.writeValueAsString(new UpdateProgressRequest(chapter.getId().value(), 2));

        // Before payment: FREE plan -> 403 on bookmarks
        mockMvc.perform(put(progressUrl).header("Authorization", reader.bearer())
                        .contentType(MediaType.APPLICATION_JSON).content(progressBody))
                .andExpect(status().isForbidden());

        // Stripe sends checkout.session.completed with client_reference_id = our user id
        PaymentEvent completed = new PaymentEvent("evt_1", PaymentEventType.CHECKOUT_COMPLETED, UserId.of(reader.userId()),
                "cus_123", "sub_123", SubscriptionPlan.PREMIUM, SubscriptionStatus.ACTIVE, Instant.now().plus(Duration.ofDays(30)), Instant.now(), false);
        when(paymentPort.parseWebhook(anyString(), eq(VALID_SIGNATURE))).thenReturn(completed);

        mockMvc.perform(post(WEBHOOK).header("Stripe-Signature", VALID_SIGNATURE)
                        .contentType(MediaType.APPLICATION_JSON).content("{\"id\":\"evt_1\"}"))
                .andExpect(status().isOk());

        // The old JWT still lacks the permission (stale until refresh) ...
        mockMvc.perform(put(progressUrl).header("Authorization", reader.bearer())
                        .contentType(MediaType.APPLICATION_JSON).content(progressBody))
                .andExpect(status().isForbidden());

        // ... a fresh token carries the new permissions
        Session premium = login(reader.email());
        mockMvc.perform(get("/api/v1/subscriptions/me").header("Authorization", premium.bearer()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.plan").value("PREMIUM"))
                .andExpect(jsonPath("$.data.status").value("ACTIVE"))
                .andExpect(jsonPath("$.data.active").value(true))
                .andExpect(jsonPath("$.data.planPermissions", hasItem("BOOKMARK_WRITE")));

        mockMvc.perform(put(progressUrl).header("Authorization", premium.bearer())
                        .contentType(MediaType.APPLICATION_JSON).content(progressBody))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.lastReadPageIndex").value(2));

        // Replaying the same event id is idempotent
        mockMvc.perform(post(WEBHOOK).header("Stripe-Signature", VALID_SIGNATURE)
                        .contentType(MediaType.APPLICATION_JSON).content("{\"id\":\"evt_1\"}"))
                .andExpect(status().isOk());
        mockMvc.perform(get("/api/v1/subscriptions/me").header("Authorization", premium.bearer()))
                .andExpect(jsonPath("$.data.status").value("ACTIVE"));

        // customer.subscription.deleted, matched by external subscription id only
        PaymentEvent deleted = new PaymentEvent("evt_2", PaymentEventType.SUBSCRIPTION_DELETED, null,
                "cus_123", "sub_123", SubscriptionPlan.PREMIUM, SubscriptionStatus.CANCELED, null, Instant.now(), false);
        when(paymentPort.parseWebhook(anyString(), eq(VALID_SIGNATURE))).thenReturn(deleted);
        mockMvc.perform(post(WEBHOOK).header("Stripe-Signature", VALID_SIGNATURE)
                        .contentType(MediaType.APPLICATION_JSON).content("{\"id\":\"evt_2\"}"))
                .andExpect(status().isOk());

        Session canceled = login(reader.email());
        mockMvc.perform(get("/api/v1/auth/me").header("Authorization", canceled.bearer()))
                .andExpect(jsonPath("$.data.subscription.status").value("CANCELED"))
                .andExpect(jsonPath("$.data.subscription.active").value(false))
                .andExpect(jsonPath("$.data.permissions", not(hasItem("BOOKMARK_WRITE"))));
        mockMvc.perform(put(progressUrl).header("Authorization", canceled.bearer())
                        .contentType(MediaType.APPLICATION_JSON).content(progressBody))
                .andExpect(status().isForbidden());
    }

    @Test
    @DisplayName("invoice.payment_failed marks the subscription PAST_DUE but keeps access until the period ends")
    void paymentFailedMarksPastDue() throws Exception {
        Session reader = register();
        when(paymentPort.parseWebhook(anyString(), eq(VALID_SIGNATURE))).thenReturn(
                new PaymentEvent("evt_a", PaymentEventType.CHECKOUT_COMPLETED, UserId.of(reader.userId()),
                        "cus_9", "sub_9", SubscriptionPlan.PREMIUM, SubscriptionStatus.ACTIVE, Instant.now().plus(Duration.ofDays(10)), Instant.now(), false));
        mockMvc.perform(post(WEBHOOK).header("Stripe-Signature", VALID_SIGNATURE).content("{}")).andExpect(status().isOk());

        when(paymentPort.parseWebhook(anyString(), eq(VALID_SIGNATURE))).thenReturn(
                new PaymentEvent("evt_b", PaymentEventType.PAYMENT_FAILED, null, "cus_9", "sub_9", null, SubscriptionStatus.PAST_DUE, null, Instant.now(), false));
        mockMvc.perform(post(WEBHOOK).header("Stripe-Signature", VALID_SIGNATURE).content("{}")).andExpect(status().isOk());

        Session session = login(reader.email());
        mockMvc.perform(get("/api/v1/subscriptions/me").header("Authorization", session.bearer()))
                .andExpect(jsonPath("$.data.status").value("PAST_DUE"))
                .andExpect(jsonPath("$.data.active").value(true));
    }

    @Test
    @DisplayName("Webhook with bad or missing signature returns 400 and does not change state")
    void invalidSignatureIsRejected() throws Exception {
        when(paymentPort.parseWebhook(anyString(), eq("bad")))
                .thenThrow(new WebhookVerificationException("Invalid Stripe webhook signature", null));

        mockMvc.perform(post(WEBHOOK).header("Stripe-Signature", "bad").content("{}"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.success").value(false));

        mockMvc.perform(post(WEBHOOK).content("{}"))
                .andExpect(status().isBadRequest());
        verify(paymentPort, never()).parseWebhook(anyString(), eq(""));
    }

    @Test
    @DisplayName("POST /checkout creates a Stripe session with frontend success/cancel URLs; FREE plan is rejected")
    void checkoutCreatesSession() throws Exception {
        Session reader = register();
        when(paymentPort.createCheckoutSession(any(), anyString(), eq(SubscriptionPlan.PREMIUM), anyString(), anyString()))
                .thenReturn(new PaymentPort.CheckoutSession("cs_test_1", "https://checkout.stripe.com/c/pay/cs_test_1"));

        mockMvc.perform(post("/api/v1/subscriptions/checkout").header("Authorization", reader.bearer())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(new CheckoutRequest("premium"))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.sessionId").value("cs_test_1"))
                .andExpect(jsonPath("$.data.url").value("https://checkout.stripe.com/c/pay/cs_test_1"));

        ArgumentCaptor<String> successUrl = ArgumentCaptor.forClass(String.class);
        ArgumentCaptor<String> cancelUrl = ArgumentCaptor.forClass(String.class);
        verify(paymentPort).createCheckoutSession(eq(UserId.of(reader.userId())), eq(reader.email()), eq(SubscriptionPlan.PREMIUM),
                successUrl.capture(), cancelUrl.capture());
        assertThat(successUrl.getValue()).startsWith("http://localhost:4200/subscription/success");
        assertThat(cancelUrl.getValue()).isEqualTo("http://localhost:4200/subscription/cancel");

        mockMvc.perform(post("/api/v1/subscriptions/checkout").header("Authorization", reader.bearer())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(new CheckoutRequest("FREE"))))
                .andExpect(status().isBadRequest());

        mockMvc.perform(post("/api/v1/subscriptions/checkout")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(new CheckoutRequest("PREMIUM"))))
                .andExpect(status().isUnauthorized());
    }

    @Test
    @DisplayName("POST /cancel schedules cancellation at period end; cancelling without a subscription or twice is 400")
    void cancelSubscription() throws Exception {
        Session reader = register();
        mockMvc.perform(post("/api/v1/subscriptions/cancel").header("Authorization", reader.bearer()))
                .andExpect(status().isBadRequest());

        when(paymentPort.parseWebhook(anyString(), eq(VALID_SIGNATURE))).thenReturn(
                new PaymentEvent("evt_c", PaymentEventType.CHECKOUT_COMPLETED, UserId.of(reader.userId()),
                        "cus_c", "sub_c", SubscriptionPlan.PREMIUM, SubscriptionStatus.ACTIVE, Instant.now().plus(Duration.ofDays(30)), Instant.now(), false));
        mockMvc.perform(post(WEBHOOK).header("Stripe-Signature", VALID_SIGNATURE).content("{}")).andExpect(status().isOk());

        Session premium = login(reader.email());
        // Cancelling stops renewal at Stripe; access continues until the paid period ends.
        mockMvc.perform(post("/api/v1/subscriptions/cancel").header("Authorization", premium.bearer()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.status").value("ACTIVE"))
                .andExpect(jsonPath("$.data.active").value(true))
                .andExpect(jsonPath("$.data.cancelAtPeriodEnd").value(true));
        verify(paymentPort).cancelSubscriptionAtPeriodEnd("sub_c");

        mockMvc.perform(post("/api/v1/subscriptions/cancel").header("Authorization", premium.bearer()))
                .andExpect(status().isBadRequest());
    }

    @Test
    @DisplayName("An out-of-order 'updated' event older than the deletion cannot resurrect a cancelled subscription")
    void staleEventIsIgnored() throws Exception {
        Session reader = register();
        Instant t0 = Instant.now().minus(Duration.ofMinutes(10));
        deliver(new PaymentEvent("evt_s1", PaymentEventType.CHECKOUT_COMPLETED, UserId.of(reader.userId()), "cus_s", "sub_s",
                SubscriptionPlan.PREMIUM, SubscriptionStatus.ACTIVE, Instant.now().plus(Duration.ofDays(30)), t0, false));
        deliver(new PaymentEvent("evt_s3", PaymentEventType.SUBSCRIPTION_DELETED, null, "cus_s", "sub_s",
                SubscriptionPlan.PREMIUM, SubscriptionStatus.CANCELED, null, t0.plusSeconds(120), false));
        // Delivered late, but created before the deletion:
        deliver(new PaymentEvent("evt_s2", PaymentEventType.SUBSCRIPTION_UPDATED, null, "cus_s", "sub_s",
                SubscriptionPlan.PREMIUM, SubscriptionStatus.ACTIVE, Instant.now().plus(Duration.ofDays(30)), t0.plusSeconds(60), false));

        Session session = login(reader.email());
        mockMvc.perform(get("/api/v1/subscriptions/me").header("Authorization", session.bearer()))
                .andExpect(jsonPath("$.data.status").value("CANCELED"))
                .andExpect(jsonPath("$.data.active").value(false));
    }

    @Test
    @DisplayName("A subscription event with an unrecognised price (no plan) never grants PREMIUM")
    void unknownPlanDoesNotGrantAccess() throws Exception {
        Session reader = register();
        deliver(new PaymentEvent("evt_u1", PaymentEventType.SUBSCRIPTION_UPDATED, UserId.of(reader.userId()), "cus_u", "sub_u",
                null, SubscriptionStatus.ACTIVE, Instant.now().plus(Duration.ofDays(30)), Instant.now(), false));

        Session session = login(reader.email());
        mockMvc.perform(get("/api/v1/subscriptions/me").header("Authorization", session.bearer()))
                .andExpect(jsonPath("$.data.plan").value("FREE"))
                .andExpect(jsonPath("$.data.active").value(false));
    }

    private void deliver(PaymentEvent event) throws Exception {
        when(paymentPort.parseWebhook(anyString(), eq(VALID_SIGNATURE))).thenReturn(event);
        mockMvc.perform(post(WEBHOOK)
                        .header("Stripe-Signature", VALID_SIGNATURE).content("{}"))
                .andExpect(status().isOk());
    }
}
