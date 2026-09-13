package com.readora.domain.scanlation;

import com.readora.domain.common.DomainValidationException;
import java.io.Serializable;
import java.util.Objects;
import java.util.UUID;

public record TaskId(UUID value) implements Serializable {
    public TaskId {
        Objects.requireNonNull(value, "TaskId cannot be null");
    }

    public static TaskId of(UUID value) {
        return new TaskId(value);
    }

    public static TaskId fromString(String value) {
        try {
            return new TaskId(UUID.fromString(value));
        } catch (IllegalArgumentException e) {
            throw new DomainValidationException("Invalid TaskId UUID format: " + value, e);
        }
    }

    public static TaskId generate() {
        return new TaskId(UUID.randomUUID());
    }

    @Override
    public String toString() {
        return value.toString();
    }
}
