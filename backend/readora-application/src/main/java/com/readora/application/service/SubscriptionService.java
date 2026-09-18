package com.readora.application.service;

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
import com.readora.domain.work.UserId;

import java.time.Instant;
import java.util.Objects;
import java.util.Optional;

public class SubscriptionService implements ManageSubscriptionUseCase {
    private final UserAccountRepositoryPort userRepository;
    private final PaymentPort paymentPort;
    private final EventPublisherPort eventPublisher;

    public SubscriptionService(UserAccountRepositoryPort userRepository, PaymentPort paymentPort, EventPublisherPort eventPublisher) {
        this.userRepository = Objects.requireNonNull(userRepository, "UserAccountRepositoryPort cannot be null");
        this.paymentPort = Objects.requireNonNull(paymentPort, "PaymentPort cannot be null");
        this.eventPublisher = Objects.requireNonNull(eventPublisher, "EventPublisherPort cannot be null");
    }

    @Override
    public PaymentPort.CheckoutSession startCheckout(UserId userId, SubscriptionPlan plan, String successUrl, String cancelUrl) {
        if (plan == null || plan == SubscriptionPlan.FREE) {
            throw new DomainValidationException("Only paid plans can be purchased");
        }
        UserAccount account = requireAccount(userId);
        if (account.getSubscription().getPlan() == plan && account.getSubscription().isActive(Instant.now())) {
            throw new DomainValidationException("Subscription to " + plan + " is already active");
        }
        return paymentPort.createCheckoutSession(userId, account.getEmail().value(), plan, successUrl, cancelUrl);
    }

    @Override
    public void handlePaymentEvent(PaymentPort.PaymentEvent event) {
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
            // Idempotency: this event has already been applied.
            return;
        }

        switch (event.type()) {
            case CHECKOUT_COMPLETED -> {
                SubscriptionPlan plan = event.plan() != null ? event.plan() : SubscriptionPlan.PREMIUM;
                Subscription activated = Subscription.active(plan, event.currentPeriodEnd(), event.customerId(), event.subscriptionId())
                        .withLastEventId(event.eventId());
                account.activateSubscription(activated);
            }
            case SUBSCRIPTION_UPDATED -> {
                SubscriptionStatus status = event.status() != null ? event.status() : SubscriptionStatus.ACTIVE;
                if (current.getPlan() == SubscriptionPlan.FREE) {
                    SubscriptionPlan plan = event.plan() != null ? event.plan() : SubscriptionPlan.PREMIUM;
                    account.activateSubscription(new Subscription(plan, status, event.currentPeriodEnd(),
                            event.customerId(), event.subscriptionId(), event.eventId(), null));
                } else {
                    Subscription updated = current.withStatus(status)
                            .withPeriodEnd(event.currentPeriodEnd() != null ? event.currentPeriodEnd() : current.getCurrentPeriodEnd())
                            .withLastEventId(event.eventId());
                    if (event.customerId() != null || event.subscriptionId() != null) {
                        updated = updated.withExternalIds(
                                event.customerId() != null ? event.customerId() : current.getExternalCustomerId(),
                                event.subscriptionId() != null ? event.subscriptionId() : current.getExternalSubscriptionId());
                    }
                    account.updateSubscription(updated);
                }
            }
            case SUBSCRIPTION_DELETED -> {
                account.cancelSubscription();
                account.updateSubscription(account.getSubscription().withLastEventId(event.eventId()));
            }
            case PAYMENT_FAILED -> account.updateSubscription(
                    current.withStatus(SubscriptionStatus.PAST_DUE).withLastEventId(event.eventId()));
            case IGNORED -> { }
        }

        userRepository.save(account);
        account.pollDomainEvents().forEach(eventPublisher::publish);
    }

    @Override
    public Subscription getCurrent(UserId userId) {
        return requireAccount(userId).getSubscription();
    }

    @Override
    public Subscription cancel(UserId userId) {
        UserAccount account = requireAccount(userId);
        Subscription current = account.getSubscription();
        if (current.getPlan() == SubscriptionPlan.FREE || current.getStatus() == SubscriptionStatus.CANCELED) {
            throw new DomainValidationException("No active subscription to cancel");
        }
        if (current.getExternalSubscriptionId() != null) {
            paymentPort.cancelSubscription(current.getExternalSubscriptionId());
        }
        account.cancelSubscription();
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
