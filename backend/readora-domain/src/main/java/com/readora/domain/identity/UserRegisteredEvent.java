package com.readora.domain.identity;

import com.readora.domain.common.DomainEvent;
import com.readora.domain.work.UserId;

import java.time.Instant;

public record UserRegisteredEvent(
        UserId userId,
        Email email,
        Instant occurredOn
) implements DomainEvent {
    public static UserRegisteredEvent now(UserId userId, Email email) {
        return new UserRegisteredEvent(userId, email, Instant.now());
    }
}
