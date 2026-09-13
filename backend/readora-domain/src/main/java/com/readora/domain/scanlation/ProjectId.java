package com.readora.domain.scanlation;

import com.readora.domain.common.DomainValidationException;
import java.io.Serializable;
import java.util.Objects;
import java.util.UUID;

public record ProjectId(UUID value) implements Serializable {
    public ProjectId {
        Objects.requireNonNull(value, "ProjectId cannot be null");
    }

    public static ProjectId of(UUID value) {
        return new ProjectId(value);
    }

    public static ProjectId fromString(String value) {
        try {
            return new ProjectId(UUID.fromString(value));
        } catch (IllegalArgumentException e) {
            throw new DomainValidationException("Invalid ProjectId UUID format: " + value, e);
        }
    }

    public static ProjectId generate() {
        return new ProjectId(UUID.randomUUID());
    }

    @Override
    public String toString() {
        return value.toString();
    }
}
