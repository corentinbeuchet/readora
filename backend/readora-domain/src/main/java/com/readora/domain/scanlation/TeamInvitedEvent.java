package com.readora.domain.scanlation;

import com.readora.domain.common.DomainEvent;

import java.time.Instant;

/// A reader was invited to a team; the listener tells them (US-12).
public record TeamInvitedEvent(TeamInvitationId invitationId, Instant occurredOn) implements DomainEvent {
    public static TeamInvitedEvent now(TeamInvitationId invitationId) {
        return new TeamInvitedEvent(invitationId, Instant.now());
    }
}
