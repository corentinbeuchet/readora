package com.readora.domain.report;

import com.readora.domain.common.DomainValidationException;

import java.io.Serializable;
import java.util.Objects;
import java.util.UUID;

public record PageReportId(UUID value) implements Serializable {
    public PageReportId {
        Objects.requireNonNull(value, "PageReportId cannot be null");
    }

    public static PageReportId of(UUID value) {
        return new PageReportId(value);
    }

    public static PageReportId fromString(String value) {
        try {
            return new PageReportId(UUID.fromString(value));
        } catch (IllegalArgumentException e) {
            throw new DomainValidationException("Invalid PageReportId UUID format: " + value, e);
        }
    }

    public static PageReportId generate() {
        return new PageReportId(UUID.randomUUID());
    }

    @Override
    public String toString() {
        return value.toString();
    }
}
