package com.readora.domain.work;

import com.readora.domain.common.DomainValidationException;
import java.io.Serializable;
import java.util.Objects;

public record ChapterNumber(String value) implements Serializable, Comparable<ChapterNumber> {
    public ChapterNumber {
        Objects.requireNonNull(value, "Chapter number must not be null");
        String trimmed = value.trim();
        if (trimmed.isEmpty()) {
            throw new DomainValidationException("Chapter number cannot be blank");
        }
    }

    public static ChapterNumber of(String value) {
        return new ChapterNumber(value);
    }

    public static ChapterNumber of(double number) {
        if (number == (long) number) {
            return new ChapterNumber(String.valueOf((long) number));
        }
        return new ChapterNumber(String.valueOf(number));
    }

    public double asDouble() {
        try {
            return Double.parseDouble(value.replaceAll("[^0-9.]", ""));
        } catch (NumberFormatException e) {
            return 0.0;
        }
    }

    @Override
    public int compareTo(ChapterNumber other) {
        return Double.compare(this.asDouble(), other.asDouble());
    }

    @Override
    public String toString() {
        return value;
    }
}
