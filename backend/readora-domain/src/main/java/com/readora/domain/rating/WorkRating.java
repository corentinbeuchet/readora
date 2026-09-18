package com.readora.domain.rating;

import com.readora.domain.common.DomainValidationException;
import com.readora.domain.common.UserId;
import com.readora.domain.work.WorkId;
import org.jspecify.annotations.Nullable;

import java.time.Instant;
import java.util.Objects;

/// A reader's score for a series (1 to 10), optionally with a review. One per reader and series: rating again
/// changes it.
public class WorkRating {
    public static final int MIN_SCORE = 1;
    public static final int MAX_SCORE = 10;

    private final RatingId id;
    private final UserId userId;
    private final WorkId workId;
    private int score;
    private @Nullable Review review;
    private final Instant ratedAt;
    private Instant updatedAt;

    public WorkRating(RatingId id, UserId userId, WorkId workId, int score, @Nullable Review review, Instant ratedAt, Instant updatedAt) {
        this.id = Objects.requireNonNull(id, "RatingId cannot be null");
        this.userId = Objects.requireNonNull(userId, "UserId cannot be null");
        this.workId = Objects.requireNonNull(workId, "WorkId cannot be null");
        this.score = validScore(score);
        this.review = review;
        this.ratedAt = Objects.requireNonNull(ratedAt, "ratedAt cannot be null");
        this.updatedAt = Objects.requireNonNull(updatedAt, "updatedAt cannot be null");
    }

    public static WorkRating rate(UserId userId, WorkId workId, int score, Instant now) {
        return new WorkRating(RatingId.generate(), userId, workId, score, null, now, now);
    }

    public void changeScore(int newScore, Instant now) {
        this.score = validScore(newScore);
        this.updatedAt = now;
    }

    public void writeReview(Review newReview, Instant now) {
        this.review = Objects.requireNonNull(newReview, "Review cannot be null");
        this.updatedAt = now;
    }

    private static int validScore(int score) {
        if (score < MIN_SCORE || score > MAX_SCORE) {
            throw new DomainValidationException("A rating is between " + MIN_SCORE + " and " + MAX_SCORE);
        }
        return score;
    }

    public RatingId getId() { return id; }
    public UserId getUserId() { return userId; }
    public WorkId getWorkId() { return workId; }
    public int getScore() { return score; }
    public @Nullable Review getReview() { return review; }
    public Instant getRatedAt() { return ratedAt; }
    public Instant getUpdatedAt() { return updatedAt; }
}
