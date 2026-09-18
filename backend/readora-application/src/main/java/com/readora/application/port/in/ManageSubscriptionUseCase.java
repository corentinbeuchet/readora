package com.readora.application.port.in;

import com.readora.domain.identity.Subscription;
import com.readora.domain.identity.SubscriptionPlan;
import com.readora.domain.work.UserId;

public interface ManageSubscriptionUseCase {
    CheckoutRedirect startCheckout(UserId userId, SubscriptionPlan plan, String successUrl, String cancelUrl);

    /// Verifies and applies a payment-provider webhook.
    ///
    /// @throws com.readora.application.exception.WebhookVerificationException if the signature is missing or invalid
    void handleWebhook(String payload, String signature);
    Subscription getCurrent(UserId userId);
    Subscription cancel(UserId userId);

    /// Where to send the user to pay.
    record CheckoutRedirect(String sessionId, String url) {}
}
