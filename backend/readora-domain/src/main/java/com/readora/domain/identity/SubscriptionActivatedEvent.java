package com.readora.domain.identity;

import com.readora.domain.common.DomainEvent;
import com.readora.domain.common.UserId;
import org.jspecify.annotations.Nullable;

import java.time.Instant;

public record SubscriptionActivatedEvent(
        UserId userId,
        SubscriptionPlan plan,
        @Nullable Instant currentPeriodEnd,
        Instant occurredOn
) implements DomainEvent {
    public static SubscriptionActivatedEvent now(UserId userId, SubscriptionPlan plan, @Nullable Instant currentPeriodEnd) {
        return new SubscriptionActivatedEvent(userId, plan, currentPeriodEnd, Instant.now());
    }
}
