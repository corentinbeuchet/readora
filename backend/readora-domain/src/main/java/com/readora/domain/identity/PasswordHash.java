package com.readora.domain.identity;

import com.readora.domain.common.DomainValidationException;

import java.io.Serializable;
import java.util.Objects;

public record PasswordHash(String value) implements Serializable {
    public PasswordHash {
        Objects.requireNonNull(value, "PasswordHash cannot be null");
        if (value.trim().isEmpty()) {
            throw new DomainValidationException("PasswordHash cannot be blank");
        }
    }

    public static PasswordHash of(String value) {
        return new PasswordHash(value);
    }

    @Override
    public String toString() {
        return "PasswordHash[****]";
    }
}
