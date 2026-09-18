package com.readora.application.port.out;

import com.readora.domain.common.UserId;
import com.readora.domain.rating.RatingId;
import com.readora.domain.rating.WorkRating;
import com.readora.domain.work.WorkId;

import java.util.List;
import java.util.Optional;

public interface RatingRepositoryPort {
    Optional<WorkRating> find(UserId userId, WorkId workId);

    Optional<WorkRating> findById(RatingId id);

    WorkRating save(WorkRating rating);

    /// `average` is `0` when `count` is 0.
    record RatingSummary(double average, long count) {
    }

    RatingSummary summary(WorkId workId);

    /// A rating that has a review, with the author's username and its helpful votes.
    record ReviewRow(WorkRating rating, String authorUsername, long helpfulVotes) {
    }

    /// Reviews of the work, most helpful first, then most recent.
    List<ReviewRow> findReviews(WorkId workId, int limit);

    /// Counts the vote once per voter (idempotent).
    ///
    /// @return the review's helpful votes after the call
    long addHelpfulVote(RatingId ratingId, UserId voterId);

    /// Series with at least `minRatings` ratings, best average first.
    record RankedWork(WorkId workId, double average, long count) {
    }

    List<RankedWork> findTopRated(int minRatings, int limit);
}
