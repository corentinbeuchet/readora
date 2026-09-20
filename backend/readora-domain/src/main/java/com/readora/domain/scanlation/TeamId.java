package com.readora.domain.scanlation;

import com.readora.domain.common.DomainValidationException;
import java.io.Serializable;
import java.util.Objects;
import java.util.UUID;

public record TeamId(UUID value) implements Serializable {
    public TeamId {
        Objects.requireNonNull(value, "TeamId cannot be null");
    }

    public static TeamId of(UUID value) {
        return new TeamId(value);
    }

    public static TeamId fromString(String value) {
        try {
            return new TeamId(UUID.fromString(value));
        } catch (IllegalArgumentException e) {
            throw new DomainValidationException("Invalid TeamId UUID format: " + value, e);
        }
    }

    public static TeamId generate() {
        return new TeamId(UUID.randomUUID());
    }

    @Override
    public String toString() {
        return value.toString();
    }
}
