package com.readora.domain.rating;

import com.readora.domain.common.DomainValidationException;
import org.jspecify.annotations.Nullable;

/// A written review: what the reader liked, what they didn't, and a verdict (required).
public record Review(@Nullable String liked, @Nullable String disliked, String verdict) {
    public static final int MAX_LENGTH = 2000;

    public Review {
        liked = optional(liked, "What you liked");
        disliked = optional(disliked, "What you didn't like");
        if (verdict == null || verdict.isBlank()) {
            throw new DomainValidationException("A review needs a verdict");
        }
        verdict = verdict.trim();
        if (verdict.length() > MAX_LENGTH) {
            throw new DomainValidationException("The verdict cannot exceed " + MAX_LENGTH + " characters");
        }
    }

    private static @Nullable String optional(@Nullable String text, String label) {
        if (text == null || text.isBlank()) {
            return null;
        }
        String trimmed = text.trim();
        if (trimmed.length() > MAX_LENGTH) {
            throw new DomainValidationException(label + " cannot exceed " + MAX_LENGTH + " characters");
        }
        return trimmed;
    }
}
