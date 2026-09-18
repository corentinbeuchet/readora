package com.readora.domain.work;

import com.readora.domain.common.DomainValidationException;

import java.io.Serializable;
import java.math.BigDecimal;
import java.util.Objects;
import java.util.regex.Pattern;

/// A chapter's number as shown to readers: numeric (`1`, `10.5`) or a label (`Extra`, `Prologue`).
///
/// Numeric values are stored in canonical form so `"1"`, `"01"` and `"1.0"` are the same chapter (equality and the
/// database's unique constraint agree). Ordering is numeric first, then labels alphabetically.
public record ChapterNumber(String value) implements Serializable, Comparable<ChapterNumber> {
    public static final int MAX_LENGTH = 50;
    private static final Pattern NUMERIC = Pattern.compile("\\d+(\\.\\d+)?");

    public ChapterNumber {
        Objects.requireNonNull(value, "Chapter number must not be null");
        String trimmed = value.trim();
        if (trimmed.isEmpty()) {
            throw new DomainValidationException("Chapter number cannot be blank");
        }
        value = NUMERIC.matcher(trimmed).matches()
                ? new BigDecimal(trimmed).stripTrailingZeros().toPlainString()
                : trimmed;
        if (value.length() > MAX_LENGTH) {
            throw new DomainValidationException("Chapter number must not exceed " + MAX_LENGTH + " characters");
        }
    }

    public static ChapterNumber of(String value) {
        return new ChapterNumber(value);
    }

    public static ChapterNumber of(double number) {
        return new ChapterNumber(BigDecimal.valueOf(number).toPlainString());
    }

    public boolean isNumeric() {
        return NUMERIC.matcher(value).matches();
    }

    @Override
    public int compareTo(ChapterNumber other) {
        boolean numeric = isNumeric();
        boolean otherNumeric = other.isNumeric();
        if (numeric && otherNumeric) {
            return new BigDecimal(value).compareTo(new BigDecimal(other.value));
        }
        if (numeric != otherNumeric) {
            return numeric ? -1 : 1;
        }
        return value.compareToIgnoreCase(other.value);
    }

    @Override
    public String toString() {
        return value;
    }
}
