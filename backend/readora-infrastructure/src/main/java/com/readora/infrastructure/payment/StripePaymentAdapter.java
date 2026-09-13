package com.readora.infrastructure.payment;

import com.readora.application.port.out.PaymentPort;
import com.readora.domain.identity.SubscriptionPlan;
import com.readora.domain.identity.SubscriptionStatus;
import com.readora.domain.work.UserId;
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
import com.stripe.param.checkout.SessionCreateParams;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;

import java.time.Instant;
import java.util.Optional;

@Component
public class StripePaymentAdapter implements PaymentPort {

    private static final Logger log = LoggerFactory.getLogger(StripePaymentAdapter.class);
    private static final String METADATA_USER_ID = "readora_user_id";

    private final StripeProperties properties;
    private final StripeClient client;

    public StripePaymentAdapter(StripeProperties properties) {
        this.properties = properties;
        this.client = new StripeClient(properties.secretKey().isBlank() ? "sk_test_unconfigured" : properties.secretKey());
        if (!properties.isConfigured()) {
            log.warn("Stripe is not configured (readora.stripe.secret-key / premium-price-id missing): checkout will fail until it is.");
        }
    }

    @Override
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
                .setSubscriptionData(SessionCreateParams.SubscriptionData.builder()
                        .putMetadata(METADATA_USER_ID, userId.value())
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
            throw new PaymentProviderException("Could not create Stripe Checkout session: " + e.getMessage(), e);
        }
    }

    @Override
    public PaymentEvent parseWebhook(String payload, String signature) {
        Event event;
        try {
            event = client.constructEvent(payload, signature, properties.webhookSecret());
        } catch (SignatureVerificationException e) {
            throw new WebhookVerificationException("Invalid Stripe webhook signature", e);
        }

        Optional<StripeObject> object = event.getDataObjectDeserializer().getObject();
        String type = event.getType();
        log.debug("Stripe webhook received: {} ({})", type, event.getId());

        return switch (type) {
            case "checkout.session.completed" -> object
                    .filter(Session.class::isInstance).map(Session.class::cast)
                    .map(session -> fromCheckoutSession(event.getId(), session))
                    .orElseGet(() -> ignored(event.getId()));
            case "customer.subscription.created", "customer.subscription.updated" -> object
                    .filter(Subscription.class::isInstance).map(Subscription.class::cast)
                    .map(sub -> fromSubscription(event.getId(), PaymentEventType.SUBSCRIPTION_UPDATED, sub))
                    .orElseGet(() -> ignored(event.getId()));
            case "customer.subscription.deleted" -> object
                    .filter(Subscription.class::isInstance).map(Subscription.class::cast)
                    .map(sub -> fromSubscription(event.getId(), PaymentEventType.SUBSCRIPTION_DELETED, sub))
                    .orElseGet(() -> ignored(event.getId()));
            case "invoice.payment_failed" -> object
                    .filter(Invoice.class::isInstance).map(Invoice.class::cast)
                    .map(invoice -> fromFailedInvoice(event.getId(), invoice))
                    .orElseGet(() -> ignored(event.getId()));
            default -> ignored(event.getId());
        };
    }

    @Override
    public void cancelSubscription(String externalSubscriptionId) {
        try {
            client.subscriptions().cancel(externalSubscriptionId);
        } catch (StripeException e) {
            throw new PaymentProviderException("Could not cancel Stripe subscription " + externalSubscriptionId + ": " + e.getMessage(), e);
        }
    }

    private PaymentEvent fromCheckoutSession(String eventId, Session session) {
        UserId userId = session.getClientReferenceId() != null ? UserId.of(session.getClientReferenceId()) : null;
        return new PaymentEvent(
                eventId,
                PaymentEventType.CHECKOUT_COMPLETED,
                userId,
                session.getCustomer(),
                session.getSubscription(),
                SubscriptionPlan.PREMIUM,
                SubscriptionStatus.ACTIVE,
                null
        );
    }

    private PaymentEvent fromSubscription(String eventId, PaymentEventType type, Subscription subscription) {
        String rawUserId = subscription.getMetadata() != null ? subscription.getMetadata().get(METADATA_USER_ID) : null;
        UserId userId = rawUserId != null && !rawUserId.isBlank() ? UserId.of(rawUserId) : null;

        SubscriptionItem firstItem = subscription.getItems() != null && subscription.getItems().getData() != null
                && !subscription.getItems().getData().isEmpty() ? subscription.getItems().getData().get(0) : null;
        Instant periodEnd = firstItem != null && firstItem.getCurrentPeriodEnd() != null
                ? Instant.ofEpochSecond(firstItem.getCurrentPeriodEnd()) : null;
        String priceId = firstItem != null && firstItem.getPrice() != null ? firstItem.getPrice().getId() : null;

        return new PaymentEvent(
                eventId,
                type,
                userId,
                subscription.getCustomer(),
                subscription.getId(),
                planFor(priceId),
                type == PaymentEventType.SUBSCRIPTION_DELETED ? SubscriptionStatus.CANCELED : mapStatus(subscription.getStatus()),
                periodEnd
        );
    }

    private PaymentEvent fromFailedInvoice(String eventId, Invoice invoice) {
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
                null
        );
    }

    private static PaymentEvent ignored(String eventId) {
        return new PaymentEvent(eventId, PaymentEventType.IGNORED, null, null, null, null, null, null);
    }

    private String priceIdFor(SubscriptionPlan plan) {
        if (plan == SubscriptionPlan.PREMIUM) {
            return properties.premiumPriceId();
        }
        throw new PaymentProviderException("No Stripe price configured for plan " + plan, null);
    }

    private SubscriptionPlan planFor(String priceId) {
        if (priceId != null && !priceId.equals(properties.premiumPriceId())) {
            log.warn("Stripe price {} does not match the configured PREMIUM price; defaulting to PREMIUM", priceId);
        }
        // PREMIUM is the only paid plan for now.
        return SubscriptionPlan.PREMIUM;
    }

    static SubscriptionStatus mapStatus(String stripeStatus) {
        if (stripeStatus == null) {
            return SubscriptionStatus.ACTIVE;
        }
        return switch (stripeStatus) {
            case "active", "trialing" -> SubscriptionStatus.ACTIVE;
            case "past_due", "unpaid" -> SubscriptionStatus.PAST_DUE;
            case "canceled", "incomplete_expired" -> SubscriptionStatus.CANCELED;
            case "incomplete", "paused" -> SubscriptionStatus.INCOMPLETE;
            default -> SubscriptionStatus.ACTIVE;
        };
    }
}
