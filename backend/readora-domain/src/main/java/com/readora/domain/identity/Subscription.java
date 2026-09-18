package com.readora.domain.identity;

import org.jspecify.annotations.Nullable;

import java.io.Serializable;
import java.time.Instant;
import java.util.Objects;

/// A user's paid plan as last reported by the payment provider.
///
/// Rules that protect revenue and access:
/// - A paid plan is active only while its status is `ACTIVE`/`PAST_DUE` **and** a known period end lies in the
///   future. An unknown (`null`) period end never grants access.
/// - Provider events are applied in order: an event older than [#getLastEventAt()] is stale and must be ignored.
/// - A user-initiated cancellation keeps access until the paid period ends (`cancelAtPeriodEnd`).
public final class Subscription implements Serializable {
    private final SubscriptionPlan plan;
    private final SubscriptionStatus status;
    private final @Nullable Instant currentPeriodEnd;
    private final @Nullable String externalCustomerId;
    private final @Nullable String externalSubscriptionId;
    private final @Nullable String lastEventId;
    private final @Nullable Instant lastEventAt;
    private final boolean cancelAtPeriodEnd;
    private final Instant updatedAt;

    public Subscription(SubscriptionPlan plan, SubscriptionStatus status, @Nullable Instant currentPeriodEnd,
                        @Nullable String externalCustomerId, @Nullable String externalSubscriptionId, @Nullable String lastEventId,
                        @Nullable Instant lastEventAt, boolean cancelAtPeriodEnd, @Nullable Instant updatedAt) {
        this.plan = Objects.requireNonNull(plan, "SubscriptionPlan cannot be null");
        this.status = Objects.requireNonNull(status, "SubscriptionStatus cannot be null");
        this.currentPeriodEnd = currentPeriodEnd;
        this.externalCustomerId = externalCustomerId;
        this.externalSubscriptionId = externalSubscriptionId;
        this.lastEventId = lastEventId;
        this.lastEventAt = lastEventAt;
        this.cancelAtPeriodEnd = cancelAtPeriodEnd;
        this.updatedAt = updatedAt != null ? updatedAt : Instant.now();
    }

    public static Subscription free() {
        return new Subscription(SubscriptionPlan.FREE, SubscriptionStatus.CANCELED, null, null, null, null, null, false, Instant.now());
    }

    public static Subscription active(SubscriptionPlan plan, @Nullable Instant currentPeriodEnd, @Nullable String externalCustomerId,
                                      @Nullable String externalSubscriptionId) {
        return new Subscription(plan, SubscriptionStatus.ACTIVE, currentPeriodEnd, externalCustomerId, externalSubscriptionId,
                null, null, false, Instant.now());
    }

    public boolean isActive(Instant now) {
        if (plan == SubscriptionPlan.FREE || currentPeriodEnd == null) {
            return false;
        }
        boolean statusOk = status == SubscriptionStatus.ACTIVE || status == SubscriptionStatus.PAST_DUE;
        return statusOk && currentPeriodEnd.isAfter(now);
    }

    /// @return true if a provider event that happened at `eventAt` predates the last one applied
    public boolean isStale(@Nullable Instant eventAt) {
        return lastEventAt != null && eventAt != null && eventAt.isBefore(lastEventAt);
    }

    public Subscription withStatus(SubscriptionStatus newStatus) {
        return new Subscription(plan, newStatus, currentPeriodEnd, externalCustomerId, externalSubscriptionId, lastEventId,
                lastEventAt, cancelAtPeriodEnd, Instant.now());
    }

    public Subscription withPeriodEnd(@Nullable Instant newPeriodEnd) {
        return new Subscription(plan, status, newPeriodEnd, externalCustomerId, externalSubscriptionId, lastEventId,
                lastEventAt, cancelAtPeriodEnd, Instant.now());
    }

    /// Records the provider event just applied (idempotency by id, ordering by time).
    public Subscription withLastEvent(@Nullable String eventId, @Nullable Instant eventAt) {
        @Nullable Instant latest = lastEventAt == null || (eventAt != null && eventAt.isAfter(lastEventAt)) ? eventAt : lastEventAt;
        return new Subscription(plan, status, currentPeriodEnd, externalCustomerId, externalSubscriptionId, eventId,
                latest, cancelAtPeriodEnd, Instant.now());
    }

    public Subscription withExternalIds(@Nullable String customerId, @Nullable String subscriptionId) {
        return new Subscription(plan, status, currentPeriodEnd, customerId, subscriptionId, lastEventId,
                lastEventAt, cancelAtPeriodEnd, Instant.now());
    }

    public Subscription withCancelAtPeriodEnd(boolean cancel) {
        return new Subscription(plan, status, currentPeriodEnd, externalCustomerId, externalSubscriptionId, lastEventId,
                lastEventAt, cancel, Instant.now());
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

    public @Nullable String getExternalCustomerId() {
        return externalCustomerId;
    }

    public @Nullable String getExternalSubscriptionId() {
        return externalSubscriptionId;
    }

    public @Nullable String getLastEventId() {
        return lastEventId;
    }

    public @Nullable Instant getLastEventAt() {
        return lastEventAt;
    }

    public boolean isCancelAtPeriodEnd() {
        return cancelAtPeriodEnd;
    }

    public Instant getUpdatedAt() {
        return updatedAt;
    }
}
