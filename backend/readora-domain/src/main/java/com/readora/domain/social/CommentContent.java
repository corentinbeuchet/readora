package com.readora.domain.social;

import com.readora.domain.common.DomainValidationException;
import java.io.Serializable;
import java.util.Objects;

public record CommentContent(String value) implements Serializable {
    public static final int MAX_LENGTH = 2000;

    public CommentContent {
        Objects.requireNonNull(value, "Comment content cannot be null");
        String trimmed = value.trim();
        if (trimmed.isEmpty()) {
            throw new DomainValidationException("Comment content cannot be empty");
        }
        if (trimmed.length() > MAX_LENGTH) {
            throw new DomainValidationException("Comment content cannot exceed " + MAX_LENGTH + " characters");
        }
    }

    public static CommentContent of(String value) {
        return new CommentContent(value);
    }

    @Override
    public String toString() {
        return value;
    }
}
