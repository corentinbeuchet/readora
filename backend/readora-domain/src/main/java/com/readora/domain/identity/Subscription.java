package com.readora.domain.identity;

import org.jspecify.annotations.Nullable;

import java.io.Serializable;
import java.time.Instant;
import java.util.Objects;

/// A user's plan. Without a payment provider (payments were removed on 2026-09-23), Premium is granted with a period end.
///
/// A paid plan is active only while its status is `ACTIVE` **and** a known period end lies in the future: an unknown
/// (`null`) period end never grants access.
public final class Subscription implements Serializable {
    private final SubscriptionPlan plan;
    private final SubscriptionStatus status;
    private final @Nullable Instant currentPeriodEnd;
    private final Instant updatedAt;

    public Subscription(SubscriptionPlan plan, SubscriptionStatus status, @Nullable Instant currentPeriodEnd, @Nullable Instant updatedAt) {
        this.plan = Objects.requireNonNull(plan, "SubscriptionPlan cannot be null");
        this.status = Objects.requireNonNull(status, "SubscriptionStatus cannot be null");
        this.currentPeriodEnd = currentPeriodEnd;
        this.updatedAt = updatedAt != null ? updatedAt : Instant.now();
    }

    public static Subscription free() {
        return new Subscription(SubscriptionPlan.FREE, SubscriptionStatus.CANCELED, null, Instant.now());
    }

    public static Subscription active(SubscriptionPlan plan, @Nullable Instant currentPeriodEnd) {
        return new Subscription(plan, SubscriptionStatus.ACTIVE, currentPeriodEnd, Instant.now());
    }

    public boolean isActive(Instant now) {
        if (plan == SubscriptionPlan.FREE || currentPeriodEnd == null) {
            return false;
        }
        return status == SubscriptionStatus.ACTIVE && currentPeriodEnd.isAfter(now);
    }

    public SubscriptionPlan getPlan() {
        return plan;
    }

    public SubscriptionStatus getStatus() {
        return status;
    }

    public @Nullable Instant getCurrentPeriodEnd() {
        return currentPeriodEnd;
    }

    public Instant getUpdatedAt() {
        return updatedAt;
    }
}
