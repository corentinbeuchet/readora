package com.readora.application.port.out;

import com.readora.domain.identity.SubscriptionPlan;
import com.readora.domain.identity.SubscriptionStatus;
import com.readora.domain.common.UserId;

import java.time.Instant;

public interface PaymentPort {

    record CheckoutSession(String sessionId, String url) {}

    enum PaymentEventType {
        CHECKOUT_COMPLETED,
        SUBSCRIPTION_UPDATED,
        SUBSCRIPTION_DELETED,
        PAYMENT_FAILED,
        IGNORED
    }

    /// A provider event translated to Readora terms.
    ///
    /// @param occurredAt when the provider created the event; used to drop out-of-order deliveries
    /// @param plan       `null` when the provider's price is not one of ours — never guess a paid plan
    record PaymentEvent(
            String eventId,
            PaymentEventType type,
            UserId userId,
            String customerId,
            String subscriptionId,
            SubscriptionPlan plan,
            SubscriptionStatus status,
            Instant currentPeriodEnd,
            Instant occurredAt,
            boolean cancelAtPeriodEnd
    ) {}

    CheckoutSession createCheckoutSession(UserId userId, String customerEmail, SubscriptionPlan plan, String successUrl, String cancelUrl);

    PaymentEvent parseWebhook(String payload, String signature);

    /// Stops renewal; the provider ends the subscription (and sends a deletion event) when the paid period is over.
    void cancelSubscriptionAtPeriodEnd(String externalSubscriptionId);
}
