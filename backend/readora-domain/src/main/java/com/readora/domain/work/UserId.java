package com.readora.domain.work;

import com.readora.domain.common.DomainValidationException;
import java.io.Serializable;
import java.util.Objects;

public record UserId(String value) implements Serializable {
    public UserId {
        Objects.requireNonNull(value, "UserId cannot be null");
        if (value.trim().isEmpty()) {
            throw new DomainValidationException("UserId cannot be blank");
        }
    }

    public static UserId of(String value) {
        return new UserId(value);
    }

    @Override
    public String toString() {
        return value;
    }
}
