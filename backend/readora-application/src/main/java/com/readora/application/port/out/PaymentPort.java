package com.readora.application.port.out;

import com.readora.domain.identity.SubscriptionPlan;
import com.readora.domain.identity.SubscriptionStatus;
import com.readora.domain.work.UserId;

import java.time.Instant;

public interface PaymentPort {

    class WebhookVerificationException extends RuntimeException {
        public WebhookVerificationException(String message, Throwable cause) {
            super(message, cause);
        }
    }

    class PaymentProviderException extends RuntimeException {
        public PaymentProviderException(String message, Throwable cause) {
            super(message, cause);
        }
    }

    record CheckoutSession(String sessionId, String url) {}

    enum PaymentEventType {
        CHECKOUT_COMPLETED,
        SUBSCRIPTION_UPDATED,
        SUBSCRIPTION_DELETED,
        PAYMENT_FAILED,
        IGNORED
    }

    record PaymentEvent(
            String eventId,
            PaymentEventType type,
            UserId userId,
            String customerId,
            String subscriptionId,
            SubscriptionPlan plan,
            SubscriptionStatus status,
            Instant currentPeriodEnd
    ) {}

    CheckoutSession createCheckoutSession(UserId userId, String customerEmail, SubscriptionPlan plan, String successUrl, String cancelUrl);

    PaymentEvent parseWebhook(String payload, String signature);

    void cancelSubscription(String externalSubscriptionId);
}
