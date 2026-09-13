package com.readora.domain.identity;

import com.readora.domain.common.DomainEvent;
import com.readora.domain.work.UserId;

import java.time.Instant;

public record SubscriptionActivatedEvent(
        UserId userId,
        SubscriptionPlan plan,
        Instant currentPeriodEnd,
        Instant occurredOn
) implements DomainEvent {
    public static SubscriptionActivatedEvent now(UserId userId, SubscriptionPlan plan, Instant currentPeriodEnd) {
        return new SubscriptionActivatedEvent(userId, plan, currentPeriodEnd, Instant.now());
    }
}
