package com.readora.infrastructure.payment;

import com.readora.application.port.out.PaymentPort.WebhookVerificationException;
import com.readora.domain.identity.SubscriptionPlan;
import com.readora.domain.identity.SubscriptionStatus;
import com.readora.infrastructure.config.StripeProperties;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class StripePaymentAdapterTest {

    private final StripePaymentAdapter adapter =
            new StripePaymentAdapter(new StripeProperties("sk_test_123", "whsec_123", "price_premium"));

    @Test
    @DisplayName("Known Stripe statuses map to Readora statuses; unknown or missing ones fail closed to INCOMPLETE")
    void statusMappingFailsClosed() {
        assertThat(StripePaymentAdapter.mapStatus("active")).isEqualTo(SubscriptionStatus.ACTIVE);
        assertThat(StripePaymentAdapter.mapStatus("trialing")).isEqualTo(SubscriptionStatus.ACTIVE);
        assertThat(StripePaymentAdapter.mapStatus("past_due")).isEqualTo(SubscriptionStatus.PAST_DUE);
        assertThat(StripePaymentAdapter.mapStatus("canceled")).isEqualTo(SubscriptionStatus.CANCELED);
        assertThat(StripePaymentAdapter.mapStatus("some_future_status")).isEqualTo(SubscriptionStatus.INCOMPLETE);
        assertThat(StripePaymentAdapter.mapStatus(null)).isEqualTo(SubscriptionStatus.INCOMPLETE);
    }

    @Test
    @DisplayName("Only the configured PREMIUM price grants PREMIUM; any other price grants no plan")
    void planMappingFailsClosed() {
        assertThat(adapter.planFor("price_premium")).isEqualTo(SubscriptionPlan.PREMIUM);
        assertThat(adapter.planFor("price_someone_else")).isNull();
        assertThat(adapter.planFor(null)).isNull();
    }

    @Test
    @DisplayName("A webhook is rejected with a verification error (not a 500) when no webhook secret is configured")
    void missingWebhookSecretIsAVerificationError() {
        StripePaymentAdapter unconfigured = new StripePaymentAdapter(new StripeProperties("sk_test_123", "", "price_premium"));

        assertThatThrownBy(() -> unconfigured.parseWebhook("{}", "t=1,v1=abc"))
                .isInstanceOf(WebhookVerificationException.class);
    }

    @Test
    @DisplayName("A webhook with an invalid signature is rejected")
    void invalidSignatureIsRejected() {
        assertThatThrownBy(() -> adapter.parseWebhook("{\"id\":\"evt_1\"}", "t=1,v1=bad"))
                .isInstanceOf(WebhookVerificationException.class);
    }
}
