package com.readora.application.service;

import com.readora.application.port.in.RateWorkUseCase;
import com.readora.application.port.out.RatingRepositoryPort;
import com.readora.application.port.out.WorkRepositoryPort;
import com.readora.domain.common.DomainValidationException;
import com.readora.domain.common.ErrorCodes;
import com.readora.domain.common.NotFoundException;
import com.readora.domain.common.UserId;
import com.readora.domain.rating.RatingId;
import com.readora.domain.rating.Review;
import com.readora.domain.rating.WorkRating;
import com.readora.domain.work.WorkId;

import java.time.Clock;
import java.util.List;
import java.util.Objects;
import java.util.Optional;

public class RatingService implements RateWorkUseCase {
    /// Reviews shown on a series page.
    public static final int MAX_REVIEWS = 50;

    private final RatingRepositoryPort ratingRepository;
    private final WorkRepositoryPort workRepository;
    private final Clock clock;

    public RatingService(RatingRepositoryPort ratingRepository, WorkRepositoryPort workRepository, Clock clock) {
        this.ratingRepository = Objects.requireNonNull(ratingRepository, "RatingRepositoryPort cannot be null");
        this.workRepository = Objects.requireNonNull(workRepository, "WorkRepositoryPort cannot be null");
        this.clock = Objects.requireNonNull(clock, "Clock cannot be null");
    }

    @Override
    public WorkRating rate(UserId userId, WorkId workId, int score) {
        return ratingRepository.save(withScore(userId, workId, score));
    }

    @Override
    public WorkRating review(UserId userId, WorkId workId, int score, Review review) {
        WorkRating rating = withScore(userId, workId, score);
        rating.writeReview(review, clock.instant());
        return ratingRepository.save(rating);
    }

    @Override
    public Optional<WorkRating> myRating(UserId userId, WorkId workId) {
        return ratingRepository.find(userId, workId);
    }

    @Override
    public RatingSummary summary(WorkId workId) {
        var summary = ratingRepository.summary(workId);
        return new RatingSummary(summary.average(), summary.count());
    }

    @Override
    public List<ReviewItem> reviews(WorkId workId) {
        return ratingRepository.findReviews(workId, MAX_REVIEWS).stream()
                .map(row -> new ReviewItem(row.rating(), row.authorUsername(), row.helpfulVotes()))
                .toList();
    }

    @Override
    public long markHelpful(UserId voterId, RatingId reviewId) {
        WorkRating rating = ratingRepository.findById(reviewId)
                .filter(r -> r.getReview() != null)
                .orElseThrow(() -> new NotFoundException("Review", reviewId));
        if (rating.getUserId().equals(voterId)) {
            throw DomainValidationException.withCode(ErrorCodes.OWN_CONTENT, "You cannot mark your own review as helpful");
        }
        return ratingRepository.addHelpfulVote(reviewId, voterId);
    }

    private WorkRating withScore(UserId userId, WorkId workId, int score) {
        if (workRepository.findById(workId).isEmpty()) {
            throw new NotFoundException("Work", workId);
        }
        return ratingRepository.find(userId, workId)
                .map(existing -> {
                    existing.changeScore(score, clock.instant());
                    return existing;
                })
                .orElseGet(() -> WorkRating.rate(userId, workId, score, clock.instant()));
    }
}
