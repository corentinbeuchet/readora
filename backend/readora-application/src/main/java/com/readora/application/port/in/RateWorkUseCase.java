package com.readora.application.port.in;

import com.readora.domain.common.UserId;
import com.readora.domain.rating.RatingId;
import com.readora.domain.rating.Review;
import com.readora.domain.rating.WorkRating;
import com.readora.domain.work.WorkId;

import java.util.List;
import java.util.Optional;

/// Ratings and reviews (US-09).
public interface RateWorkUseCase {

    record ReviewItem(WorkRating rating, String authorUsername, long helpfulVotes) {
    }

    /// `average` is `0` when `count` is 0.
    record RatingSummary(double average, long count) {
    }

    /// Rates the series, or changes the reader's rating.
    ///
    /// @throws com.readora.domain.common.NotFoundException if the work doesn't exist
    WorkRating rate(UserId userId, WorkId workId, int score);

    /// Sets the score and the review together.
    ///
    /// @throws com.readora.domain.common.NotFoundException if the work doesn't exist
    WorkRating review(UserId userId, WorkId workId, int score, Review review);

    Optional<WorkRating> myRating(UserId userId, WorkId workId);

    RatingSummary summary(WorkId workId);

    List<ReviewItem> reviews(WorkId workId);

    /// @return the review's helpful votes
    /// @throws com.readora.domain.common.NotFoundException if there is no such review
    /// @throws com.readora.domain.common.DomainValidationException on the reader's own review
    long markHelpful(UserId voterId, RatingId reviewId);
}
