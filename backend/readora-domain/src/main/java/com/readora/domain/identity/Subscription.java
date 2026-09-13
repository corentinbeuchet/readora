package com.readora.domain.identity;

import java.io.Serializable;
import java.time.Instant;
import java.util.Objects;

public final class Subscription implements Serializable {
    private final SubscriptionPlan plan;
    private final SubscriptionStatus status;
    private final Instant currentPeriodEnd;
    private final String externalCustomerId;
    private final String externalSubscriptionId;
    private final String lastEventId;
    private final Instant updatedAt;

    public Subscription(SubscriptionPlan plan, SubscriptionStatus status, Instant currentPeriodEnd,
                        String externalCustomerId, String externalSubscriptionId, String lastEventId, Instant updatedAt) {
        this.plan = Objects.requireNonNull(plan, "SubscriptionPlan cannot be null");
        this.status = Objects.requireNonNull(status, "SubscriptionStatus cannot be null");
        this.currentPeriodEnd = currentPeriodEnd;
        this.externalCustomerId = externalCustomerId;
        this.externalSubscriptionId = externalSubscriptionId;
        this.lastEventId = lastEventId;
        this.updatedAt = updatedAt != null ? updatedAt : Instant.now();
    }

    public static Subscription free() {
        return new Subscription(SubscriptionPlan.FREE, SubscriptionStatus.CANCELED, null, null, null, null, Instant.now());
    }

    public static Subscription active(SubscriptionPlan plan, Instant currentPeriodEnd, String externalCustomerId, String externalSubscriptionId) {
        return new Subscription(plan, SubscriptionStatus.ACTIVE, currentPeriodEnd, externalCustomerId, externalSubscriptionId, null, Instant.now());
    }

    public boolean isActive(Instant now) {
        if (plan == SubscriptionPlan.FREE) {
            return false;
        }
        boolean statusOk = status == SubscriptionStatus.ACTIVE || status == SubscriptionStatus.PAST_DUE;
        boolean notExpired = currentPeriodEnd == null || currentPeriodEnd.isAfter(now);
        return statusOk && notExpired;
    }

    public Subscription withStatus(SubscriptionStatus newStatus) {
        return new Subscription(plan, newStatus, currentPeriodEnd, externalCustomerId, externalSubscriptionId, lastEventId, Instant.now());
    }

    public Subscription withPeriodEnd(Instant newPeriodEnd) {
        return new Subscription(plan, status, newPeriodEnd, externalCustomerId, externalSubscriptionId, lastEventId, Instant.now());
    }

    public Subscription withLastEventId(String eventId) {
        return new Subscription(plan, status, currentPeriodEnd, externalCustomerId, externalSubscriptionId, eventId, Instant.now());
    }

    public Subscription withExternalIds(String customerId, String subscriptionId) {
        return new Subscription(plan, status, currentPeriodEnd, customerId, subscriptionId, lastEventId, Instant.now());
    }

    public SubscriptionPlan getPlan() {
        return plan;
    }

    public SubscriptionStatus getStatus() {
        return status;
    }

    public Instant getCurrentPeriodEnd() {
        return currentPeriodEnd;
    }

    public String getExternalCustomerId() {
        return externalCustomerId;
    }

    public String getExternalSubscriptionId() {
        return externalSubscriptionId;
    }

    public String getLastEventId() {
        return lastEventId;
    }

    public Instant getUpdatedAt() {
        return updatedAt;
    }
}
