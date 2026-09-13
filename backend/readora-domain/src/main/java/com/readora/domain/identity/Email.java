package com.readora.domain.identity;

import com.readora.domain.common.DomainValidationException;

import java.io.Serializable;
import java.util.Locale;
import java.util.Objects;
import java.util.regex.Pattern;

public record Email(String value) implements Serializable {
    private static final Pattern PATTERN = Pattern.compile("^[^@\\s]+@[^@\\s]+\\.[^@\\s]+$");

    public Email {
        Objects.requireNonNull(value, "Email cannot be null");
        String normalized = value.trim().toLowerCase(Locale.ROOT);
        if (normalized.isEmpty()) {
            throw new DomainValidationException("Email cannot be blank");
        }
        if (normalized.length() > 255 || !PATTERN.matcher(normalized).matches()) {
            throw new DomainValidationException("Email is not valid: " + value);
        }
        value = normalized;
    }

    public static Email of(String value) {
        return new Email(value);
    }

    @Override
    public String toString() {
        return value;
    }
}
