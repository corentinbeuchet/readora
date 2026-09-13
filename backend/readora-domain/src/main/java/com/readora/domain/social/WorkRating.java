package com.readora.domain.social;

import com.readora.domain.common.DomainValidationException;
import com.readora.domain.work.UserId;
import com.readora.domain.work.WorkId;

import java.io.Serializable;
import java.time.Instant;
import java.util.Objects;

public record WorkRating(
        UserId userId,
        WorkId workId,
        int score,
        Instant ratedAt
) implements Serializable {
    public WorkRating {
        Objects.requireNonNull(userId, "UserId cannot be null");
        Objects.requireNonNull(workId, "WorkId cannot be null");
        if (score < 1 || score > 10) {
            throw new DomainValidationException("Rating score must be between 1 and 10");
        }
    }

    public static WorkRating rate(UserId userId, WorkId workId, int score) {
        return new WorkRating(userId, workId, score, Instant.now());
    }
}
