package com.readora.domain.work;

import com.readora.domain.common.DomainValidationException;
import java.io.Serializable;
import java.util.Objects;
import java.util.UUID;

public record ChapterId(UUID value) implements Serializable {
    public ChapterId {
        Objects.requireNonNull(value, "ChapterId cannot be null");
    }

    public static ChapterId of(UUID value) {
        return new ChapterId(value);
    }

    public static ChapterId fromString(String value) {
        try {
            return new ChapterId(UUID.fromString(value));
        } catch (IllegalArgumentException e) {
            throw new DomainValidationException("Invalid ChapterId UUID format: " + value, e);
        }
    }

    public static ChapterId generate() {
        return new ChapterId(UUID.randomUUID());
    }

    @Override
    public String toString() {
        return value.toString();
    }
}
