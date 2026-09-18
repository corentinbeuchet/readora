package com.readora.web.dto;

import com.readora.application.port.in.RateWorkUseCase.ReviewItem;
import com.readora.domain.rating.Review;
import org.jspecify.annotations.Nullable;

import java.time.Instant;
import java.util.Objects;
import java.util.UUID;

public record ReviewDto(UUID id, String authorId, String authorUsername, int score, @Nullable String liked, @Nullable String disliked,
                        String verdict, long helpfulVotes, Instant updatedAt) {
    public static ReviewDto fromDomain(ReviewItem item) {
        Review review = Objects.requireNonNull(item.rating().getReview(), "only ratings with a review are listed");
        return new ReviewDto(item.rating().getId().value(), item.rating().getUserId().value(), item.authorUsername(), item.rating().getScore(),
                review.liked(), review.disliked(), review.verdict(), item.helpfulVotes(), item.rating().getUpdatedAt());
    }
}
