package com.readora.web.dto;

import com.readora.domain.rating.Review;
import com.readora.domain.rating.WorkRating;
import org.jspecify.annotations.Nullable;

import java.time.Instant;
import java.util.UUID;

public record RatingDto(UUID id, UUID workId, int score, @Nullable String liked, @Nullable String disliked, @Nullable String verdict,
                        Instant updatedAt) {
    public static RatingDto fromDomain(WorkRating rating) {
        Review review = rating.getReview();
        return new RatingDto(rating.getId().value(), rating.getWorkId().value(), rating.getScore(),
                review != null ? review.liked() : null, review != null ? review.disliked() : null, review != null ? review.verdict() : null,
                rating.getUpdatedAt());
    }
}
