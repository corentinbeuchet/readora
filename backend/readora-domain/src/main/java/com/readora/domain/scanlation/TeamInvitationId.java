package com.readora.domain.scanlation;

import com.readora.domain.common.DomainValidationException;

import java.io.Serializable;
import java.util.Objects;
import java.util.UUID;

public record TeamInvitationId(UUID value) implements Serializable {
    public TeamInvitationId {
        Objects.requireNonNull(value, "TeamInvitationId cannot be null");
    }

    public static TeamInvitationId of(UUID value) {
        return new TeamInvitationId(value);
    }

    public static TeamInvitationId fromString(String value) {
        try {
            return new TeamInvitationId(UUID.fromString(value));
        } catch (IllegalArgumentException e) {
            throw new DomainValidationException("Invalid TeamInvitationId UUID format: " + value, e);
        }
    }

    public static TeamInvitationId generate() {
        return new TeamInvitationId(UUID.randomUUID());
    }

    @Override
    public String toString() {
        return value.toString();
    }
}
