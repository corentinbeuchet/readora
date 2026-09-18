package com.readora.domain.identity;

import com.readora.domain.common.DomainEvent;
import com.readora.domain.common.UserId;

import java.time.Instant;

public record SubscriptionCanceledEvent(
        UserId userId,
        SubscriptionPlan previousPlan,
        Instant occurredOn
) implements DomainEvent {
    public static SubscriptionCanceledEvent now(UserId userId, SubscriptionPlan previousPlan) {
        return new SubscriptionCanceledEvent(userId, previousPlan, Instant.now());
    }
}
