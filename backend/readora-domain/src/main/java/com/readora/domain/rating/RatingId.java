package com.readora.domain.rating;

import com.readora.domain.common.DomainValidationException;

import java.io.Serializable;
import java.util.Objects;
import java.util.UUID;

public record RatingId(UUID value) implements Serializable {
    public RatingId {
        Objects.requireNonNull(value, "RatingId cannot be null");
    }

    public static RatingId of(UUID value) {
        return new RatingId(value);
    }

    public static RatingId fromString(String value) {
        try {
            return new RatingId(UUID.fromString(value));
        } catch (IllegalArgumentException e) {
            throw new DomainValidationException("Invalid RatingId UUID format: " + value, e);
        }
    }

    public static RatingId generate() {
        return new RatingId(UUID.randomUUID());
    }

    @Override
    public String toString() {
        return value.toString();
    }
}
