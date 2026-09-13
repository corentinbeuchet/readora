package com.readora.domain.social;

import com.readora.domain.common.DomainValidationException;
import java.io.Serializable;
import java.util.Objects;
import java.util.UUID;

public record CommentId(UUID value) implements Serializable {
    public CommentId {
        Objects.requireNonNull(value, "CommentId cannot be null");
    }

    public static CommentId of(UUID value) {
        return new CommentId(value);
    }

    public static CommentId fromString(String value) {
        try {
            return new CommentId(UUID.fromString(value));
        } catch (IllegalArgumentException e) {
            throw new DomainValidationException("Invalid CommentId UUID format: " + value, e);
        }
    }

    public static CommentId generate() {
        return new CommentId(UUID.randomUUID());
    }

    @Override
    public String toString() {
        return value.toString();
    }
}
