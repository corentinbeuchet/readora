package com.readora.application.service;

import com.readora.application.exception.WebhookVerificationException;
import com.readora.application.port.in.ManageSubscriptionUseCase;
import com.readora.application.port.out.EventPublisherPort;
import com.readora.application.port.out.PaymentPort;
import com.readora.application.port.out.UserAccountRepositoryPort;
import com.readora.domain.common.DomainValidationException;
import com.readora.domain.common.NotFoundException;
import com.readora.domain.identity.Subscription;
import com.readora.domain.identity.SubscriptionPlan;
import com.readora.domain.identity.SubscriptionStatus;
import com.readora.domain.identity.UserAccount;
import com.readora.domain.common.UserId;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.jspecify.annotations.Nullable;

import java.time.Instant;
import java.util.Objects;
import java.util.Optional;

public class SubscriptionService implements ManageSubscriptionUseCase {
    private static final Logger log = LoggerFactory.getLogger(SubscriptionService.class);

    private final UserAccountRepositoryPort userRepository;
    private final PaymentPort paymentPort;
    private final EventPublisherPort eventPublisher;

    public SubscriptionService(UserAccountRepositoryPort userRepository, PaymentPort paymentPort, EventPublisherPort eventPublisher) {
        this.userRepository = Objects.requireNonNull(userRepository, "UserAccountRepositoryPort cannot be null");
        this.paymentPort = Objects.requireNonNull(paymentPort, "PaymentPort cannot be null");
        this.eventPublisher = Objects.requireNonNull(eventPublisher, "EventPublisherPort cannot be null");
    }

    @Override
    public CheckoutRedirect startCheckout(UserId userId, SubscriptionPlan plan, String successUrl, String cancelUrl) {
        if (plan == null || plan == SubscriptionPlan.FREE) {
            throw new DomainValidationException("Only paid plans can be purchased");
        }
        UserAccount account = requireAccount(userId);
        if (account.getSubscription().getPlan() == plan && account.getSubscription().isActive(Instant.now())) {
            throw new DomainValidationException("Subscription to " + plan + " is already active");
        }
        PaymentPort.CheckoutSession session = paymentPort.createCheckoutSession(userId, account.getEmail().value(), plan, successUrl, cancelUrl);
        return new CheckoutRedirect(session.sessionId(), session.url());
    }

    @Override
    public void handleWebhook(String payload, @Nullable String signature) {
        if (signature == null || signature.isBlank()) {
            throw new WebhookVerificationException("Missing webhook signature", null);
        }
        handlePaymentEvent(paymentPort.parseWebhook(payload, signature));
    }

    /// Applies a verified provider event. Events are idempotent (same id twice is a no-op), ordered (older than the
    /// last applied one: ignored, so a late "updated" can't resurrect a deleted subscription) and fail closed
    /// (an event without a recognised paid plan never grants access).
    void handlePaymentEvent(PaymentPort.PaymentEvent event) {
        Objects.requireNonNull(event, "PaymentEvent cannot be null");
        if (event.type() == PaymentPort.PaymentEventType.IGNORED) {
            return;
        }

        Optional<UserAccount> maybeAccount = resolveAccount(event);
        if (maybeAccount.isEmpty()) {
            // Event cannot be matched to any account (e.g. unknown customer); nothing to update.
            return;
        }
        UserAccount account = maybeAccount.get();
        Subscription current = account.getSubscription();
        if (event.eventId() != null && event.eventId().equals(current.getLastEventId())) {
            return;
        }
        if (current.isStale(event.occurredAt())) {
            log.info("Ignoring out-of-order payment event {} ({})", event.eventId(), event.type());
            return;
        }

        switch (event.type()) {
            case CHECKOUT_COMPLETED -> {
                if (event.plan() == null) {
                    log.warn("Checkout event {} has no recognised plan; not activating", event.eventId());
                    return;
                }
                boolean sameSubscription = Objects.equals(event.subscriptionId(), current.getExternalSubscriptionId());
                Instant periodEnd = event.currentPeriodEnd() != null ? event.currentPeriodEnd()
                        : sameSubscription ? current.getCurrentPeriodEnd() : null;
                account.activateSubscription(Subscription.active(event.plan(), periodEnd, event.customerId(), event.subscriptionId())
                        .withLastEvent(event.eventId(), event.occurredAt()));
            }
            case SUBSCRIPTION_UPDATED -> {
                SubscriptionStatus status = event.status() != null ? event.status() : SubscriptionStatus.INCOMPLETE;
                if (current.getPlan() == SubscriptionPlan.FREE || !Objects.equals(event.subscriptionId(), current.getExternalSubscriptionId())) {
                    if (event.plan() == null) {
                        log.warn("Subscription event {} has no recognised plan; not activating", event.eventId());
                        return;
                    }
                    account.activateSubscription(new Subscription(event.plan(), status, event.currentPeriodEnd(),
                            event.customerId(), event.subscriptionId(), null, null, event.cancelAtPeriodEnd(), null)
                            .withLastEvent(event.eventId(), event.occurredAt()));
                } else {
                    Subscription updated = current.withStatus(status)
                            .withPeriodEnd(event.currentPeriodEnd() != null ? event.currentPeriodEnd() : current.getCurrentPeriodEnd())
                            .withCancelAtPeriodEnd(event.cancelAtPeriodEnd())
                            .withLastEvent(event.eventId(), event.occurredAt());
                    if (event.customerId() != null) {
                        updated = updated.withExternalIds(event.customerId(), current.getExternalSubscriptionId());
                    }
                    account.updateSubscription(updated);
                }
            }
            case SUBSCRIPTION_DELETED -> {
                account.cancelSubscription();
                account.updateSubscription(account.getSubscription()
                        .withCancelAtPeriodEnd(false)
                        .withLastEvent(event.eventId(), event.occurredAt()));
            }
            case PAYMENT_FAILED -> account.updateSubscription(
                    current.withStatus(SubscriptionStatus.PAST_DUE).withLastEvent(event.eventId(), event.occurredAt()));
            case IGNORED -> { }
        }

        userRepository.save(account);
        account.pollDomainEvents().forEach(eventPublisher::publish);
    }

    @Override
    public Subscription getCurrent(UserId userId) {
        return requireAccount(userId).getSubscription();
    }

    /// Stops renewal. A provider-backed subscription stays active until the paid period ends (the provider's
    /// `deleted` event ends it); one without a provider subscription is cancelled immediately.
    @Override
    public Subscription cancel(UserId userId) {
        UserAccount account = requireAccount(userId);
        Subscription current = account.getSubscription();
        if (current.getPlan() == SubscriptionPlan.FREE || current.getStatus() == SubscriptionStatus.CANCELED) {
            throw new DomainValidationException("No active subscription to cancel");
        }
        if (current.isCancelAtPeriodEnd()) {
            throw new DomainValidationException("Cancellation is already scheduled for the end of the current period");
        }
        if (current.getExternalSubscriptionId() != null) {
            paymentPort.cancelSubscriptionAtPeriodEnd(current.getExternalSubscriptionId());
            account.scheduleSubscriptionCancellation();
        } else {
            account.cancelSubscription();
        }
        UserAccount saved = userRepository.save(account);
        account.pollDomainEvents().forEach(eventPublisher::publish);
        return saved.getSubscription();
    }

    private Optional<UserAccount> resolveAccount(PaymentPort.PaymentEvent event) {
        if (event.userId() != null) {
            Optional<UserAccount> byId = userRepository.findById(event.userId());
            if (byId.isPresent()) {
                return byId;
            }
        }
        if (event.subscriptionId() != null) {
            Optional<UserAccount> bySub = userRepository.findByExternalSubscriptionId(event.subscriptionId());
            if (bySub.isPresent()) {
                return bySub;
            }
        }
        if (event.customerId() != null) {
            return userRepository.findByExternalCustomerId(event.customerId());
        }
        return Optional.empty();
    }

    private UserAccount requireAccount(UserId userId) {
        return userRepository.findById(userId)
                .orElseThrow(() -> new NotFoundException("User", userId));
    }
}
