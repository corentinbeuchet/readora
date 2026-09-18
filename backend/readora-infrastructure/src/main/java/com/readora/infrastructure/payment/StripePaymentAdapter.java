package com.readora.infrastructure.payment;

import com.readora.application.exception.PaymentProviderException;
import com.readora.application.exception.WebhookVerificationException;
import com.readora.application.port.out.PaymentPort;
import com.readora.domain.identity.SubscriptionPlan;
import com.readora.domain.identity.SubscriptionStatus;
import com.readora.domain.common.UserId;
import com.readora.infrastructure.config.StripeProperties;
import com.stripe.StripeClient;
import com.stripe.exception.SignatureVerificationException;
import com.stripe.exception.StripeException;
import com.stripe.model.Event;
import com.stripe.model.Invoice;
import com.stripe.model.StripeObject;
import com.stripe.model.Subscription;
import com.stripe.model.SubscriptionItem;
import com.stripe.model.checkout.Session;
import com.stripe.param.SubscriptionUpdateParams;
import com.stripe.param.checkout.SessionCreateParams;
import org.jspecify.annotations.Nullable;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.resilience.annotation.ConcurrencyLimit;
import org.springframework.stereotype.Component;

import java.time.Instant;
import java.util.Optional;

@Component
public class StripePaymentAdapter implements PaymentPort {

    private static final Logger log = LoggerFactory.getLogger(StripePaymentAdapter.class);
    private static final String METADATA_USER_ID = "readora_user_id";
    private static final String METADATA_PLAN = "readora_plan";

    private final StripeProperties properties;
    private final StripeClient client;

    public StripePaymentAdapter(StripeProperties properties) {
        this.properties = properties;
        this.client = new StripeClient(properties.secretKey().isBlank() ? "sk_test_unconfigured" : properties.secretKey());
        if (!properties.isConfigured()) {
            log.warn("Stripe is not configured (readora.stripe.secret-key / premium-price-id missing): checkout will fail until it is.");
        }
    }

    /// Not retried: creating a checkout session is not idempotent.
    @Override
    @ConcurrencyLimit(16)
    public CheckoutSession createCheckoutSession(UserId userId, String customerEmail, SubscriptionPlan plan, String successUrl, String cancelUrl) {
        if (!properties.isConfigured()) {
            throw new PaymentProviderException("Stripe is not configured on this server", null);
        }
        SessionCreateParams params = SessionCreateParams.builder()
                .setMode(SessionCreateParams.Mode.SUBSCRIPTION)
                .setClientReferenceId(userId.value())
                .setCustomerEmail(customerEmail)
                .setSuccessUrl(successUrl)
                .setCancelUrl(cancelUrl)
                .putMetadata(METADATA_USER_ID, userId.value())
                .putMetadata(METADATA_PLAN, plan.name())
                .setSubscriptionData(SessionCreateParams.SubscriptionData.builder()
                        .putMetadata(METADATA_USER_ID, userId.value())
                        .putMetadata(METADATA_PLAN, plan.name())
                        .build())
                .addLineItem(SessionCreateParams.LineItem.builder()
                        .setPrice(priceIdFor(plan))
                        .setQuantity(1L)
                        .build())
                .build();
        try {
            Session session = client.checkout().sessions().create(params);
            return new CheckoutSession(session.getId(), session.getUrl());
        } catch (StripeException e) {
            log.error("Could not create Stripe Checkout session", e);
            throw new PaymentProviderException("Could not start the checkout with the payment provider", e);
        }
    }

    @Override
    public PaymentEvent parseWebhook(String payload, String signature) {
        if (properties.webhookSecret() == null || properties.webhookSecret().isBlank()) {
            log.error("Stripe webhook received but readora.stripe.webhook-secret is not configured; rejecting it");
            throw new WebhookVerificationException("Webhook verification is not configured", null);
        }
        Event event;
        try {
            event = client.constructEvent(payload, signature, properties.webhookSecret());
        } catch (SignatureVerificationException e) {
            throw new WebhookVerificationException("Invalid Stripe webhook signature", e);
        }

        Optional<StripeObject> object = event.getDataObjectDeserializer().getObject();
        String type = event.getType();
        String eventId = event.getId();
        Instant occurredAt = event.getCreated() != null ? Instant.ofEpochSecond(event.getCreated()) : null;
        log.debug("Stripe webhook received: {} ({})", type, eventId);

        @Nullable PaymentEvent translated = switch (type) {
            case "checkout.session.completed" -> object
                    .filter(Session.class::isInstance).map(Session.class::cast)
                    .map(session -> fromCheckoutSession(eventId, occurredAt, session))
                    .orElse(null);
            case "customer.subscription.created", "customer.subscription.updated" -> object
                    .filter(Subscription.class::isInstance).map(Subscription.class::cast)
                    .map(sub -> fromSubscription(eventId, occurredAt, PaymentEventType.SUBSCRIPTION_UPDATED, sub))
                    .orElse(null);
            case "customer.subscription.deleted" -> object
                    .filter(Subscription.class::isInstance).map(Subscription.class::cast)
                    .map(sub -> fromSubscription(eventId, occurredAt, PaymentEventType.SUBSCRIPTION_DELETED, sub))
                    .orElse(null);
            case "invoice.payment_failed" -> object
                    .filter(Invoice.class::isInstance).map(Invoice.class::cast)
                    .map(invoice -> fromFailedInvoice(eventId, occurredAt, invoice))
                    .orElse(null);
            default -> ignored(eventId);
        };
        if (translated == null) {
            // A handled event type whose payload could not be read (typically an API-version mismatch): make it visible.
            log.warn("Stripe event {} ({}) could not be deserialized; check the webhook API version", eventId, type);
            return ignored(eventId);
        }
        return translated;
    }

    @Override
    @ConcurrencyLimit(16)
    public void cancelSubscriptionAtPeriodEnd(String externalSubscriptionId) {
        try {
            client.subscriptions().update(externalSubscriptionId,
                    SubscriptionUpdateParams.builder().setCancelAtPeriodEnd(true).build());
        } catch (StripeException e) {
            log.error("Could not schedule cancellation of Stripe subscription {}", externalSubscriptionId, e);
            throw new PaymentProviderException("Could not cancel the subscription with the payment provider", e);
        }
    }

    private PaymentEvent fromCheckoutSession(String eventId, @Nullable Instant occurredAt, Session session) {
        UserId userId = session.getClientReferenceId() != null ? UserId.of(session.getClientReferenceId()) : null;
        return new PaymentEvent(
                eventId,
                PaymentEventType.CHECKOUT_COMPLETED,
                userId,
                session.getCustomer(),
                session.getSubscription(),
                planFromMetadata(session.getMetadata() != null ? session.getMetadata().get(METADATA_PLAN) : null),
                SubscriptionStatus.ACTIVE,
                periodEndOf(session.getSubscription()),
                occurredAt,
                false
        );
    }

    /// The session itself carries no billing period; read it from the subscription so access has a real end date.
    private @Nullable Instant periodEndOf(@Nullable String subscriptionId) {
        if (subscriptionId == null) {
            return null;
        }
        try {
            return currentPeriodEnd(client.subscriptions().retrieve(subscriptionId));
        } catch (StripeException e) {
            log.warn("Could not read period end of Stripe subscription {}: {}", subscriptionId, e.getMessage());
            return null;
        }
    }

    private static @Nullable Instant currentPeriodEnd(Subscription subscription) {
        SubscriptionItem firstItem = firstItem(subscription);
        return firstItem != null && firstItem.getCurrentPeriodEnd() != null
                ? Instant.ofEpochSecond(firstItem.getCurrentPeriodEnd()) : null;
    }

    private static @Nullable SubscriptionItem firstItem(Subscription subscription) {
        return subscription.getItems() != null && subscription.getItems().getData() != null
                && !subscription.getItems().getData().isEmpty() ? subscription.getItems().getData().getFirst() : null;
    }

    private PaymentEvent fromSubscription(String eventId, @Nullable Instant occurredAt, PaymentEventType type, Subscription subscription) {
        String rawUserId = subscription.getMetadata() != null ? subscription.getMetadata().get(METADATA_USER_ID) : null;
        UserId userId = rawUserId != null && !rawUserId.isBlank() ? UserId.of(rawUserId) : null;

        SubscriptionItem firstItem = firstItem(subscription);
        Instant periodEnd = currentPeriodEnd(subscription);
        String priceId = firstItem != null && firstItem.getPrice() != null ? firstItem.getPrice().getId() : null;

        return new PaymentEvent(
                eventId,
                type,
                userId,
                subscription.getCustomer(),
                subscription.getId(),
                planFor(priceId),
                type == PaymentEventType.SUBSCRIPTION_DELETED ? SubscriptionStatus.CANCELED : mapStatus(subscription.getStatus()),
                periodEnd,
                occurredAt,
                Boolean.TRUE.equals(subscription.getCancelAtPeriodEnd())
        );
    }

    private PaymentEvent fromFailedInvoice(String eventId, @Nullable Instant occurredAt, Invoice invoice) {
        String subscriptionId = invoice.getParent() != null && invoice.getParent().getSubscriptionDetails() != null
                ? invoice.getParent().getSubscriptionDetails().getSubscription() : null;
        return new PaymentEvent(
                eventId,
                PaymentEventType.PAYMENT_FAILED,
                null,
                invoice.getCustomer(),
                subscriptionId,
                null,
                SubscriptionStatus.PAST_DUE,
                null,
                occurredAt,
                false
        );
    }

    private static PaymentEvent ignored(String eventId) {
        return new PaymentEvent(eventId, PaymentEventType.IGNORED, null, null, null, null, null, null, null, false);
    }

    private String priceIdFor(SubscriptionPlan plan) {
        if (plan == SubscriptionPlan.PREMIUM) {
            return properties.premiumPriceId();
        }
        throw new PaymentProviderException("No Stripe price configured for plan " + plan, null);
    }

    /// Fail closed: only the configured PREMIUM price maps to a plan; anything else yields `null` (no access).
    @Nullable SubscriptionPlan planFor(@Nullable String priceId) {
        if (priceId != null && priceId.equals(properties.premiumPriceId())) {
            return SubscriptionPlan.PREMIUM;
        }
        log.warn("Stripe price {} is not a configured Readora price; no plan granted", priceId);
        return null;
    }

    private static @Nullable SubscriptionPlan planFromMetadata(@Nullable String rawPlan) {
        if (rawPlan == null || rawPlan.isBlank()) {
            return null;
        }
        try {
            SubscriptionPlan plan = SubscriptionPlan.valueOf(rawPlan);
            return plan == SubscriptionPlan.FREE ? null : plan;
        } catch (IllegalArgumentException e) {
            log.warn("Unknown plan '{}' in Stripe checkout metadata; no plan granted", rawPlan);
            return null;
        }
    }

    /// Fail closed: statuses Stripe may add in the future map to `INCOMPLETE` (no access), never to `ACTIVE`.
    static SubscriptionStatus mapStatus(@Nullable String stripeStatus) {
        if (stripeStatus == null) {
            return SubscriptionStatus.INCOMPLETE;
        }
        return switch (stripeStatus) {
            case "active", "trialing" -> SubscriptionStatus.ACTIVE;
            case "past_due", "unpaid" -> SubscriptionStatus.PAST_DUE;
            case "canceled", "incomplete_expired" -> SubscriptionStatus.CANCELED;
            case "incomplete", "paused" -> SubscriptionStatus.INCOMPLETE;
            default -> {
                log.warn("Unknown Stripe subscription status '{}'; treating it as INCOMPLETE", stripeStatus);
                yield SubscriptionStatus.INCOMPLETE;
            }
        };
    }
}
