package com.readora.domain.work;

import com.readora.domain.common.DomainValidationException;
import java.io.Serializable;
import java.util.Objects;
import java.util.UUID;

public record WorkId(UUID value) implements Serializable {
    public WorkId {
        Objects.requireNonNull(value, "WorkId cannot be null");
    }

    public static WorkId of(UUID value) {
        return new WorkId(value);
    }

    public static WorkId fromString(String value) {
        try {
            return new WorkId(UUID.fromString(value));
        } catch (IllegalArgumentException e) {
            throw new DomainValidationException("Invalid WorkId UUID format: " + value, e);
        }
    }

    public static WorkId generate() {
        return new WorkId(UUID.randomUUID());
    }

    @Override
    public String toString() {
        return value.toString();
    }
}
