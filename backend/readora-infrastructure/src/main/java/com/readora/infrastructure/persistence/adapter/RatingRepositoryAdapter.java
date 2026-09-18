package com.readora.infrastructure.persistence.adapter;

import com.readora.application.port.out.RatingRepositoryPort;
import com.readora.domain.common.UserId;
import com.readora.domain.rating.RatingId;
import com.readora.domain.rating.Review;
import com.readora.domain.rating.WorkRating;
import com.readora.domain.work.WorkId;
import com.readora.infrastructure.persistence.entity.ReviewHelpfulVoteJpaEntity;
import com.readora.infrastructure.persistence.entity.WorkRatingJpaEntity;
import com.readora.infrastructure.persistence.repository.SpringDataReviewHelpfulVoteRepository;
import com.readora.infrastructure.persistence.repository.SpringDataWorkRatingRepository;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Component
public class RatingRepositoryAdapter implements RatingRepositoryPort {

    private final SpringDataWorkRatingRepository ratings;
    private final SpringDataReviewHelpfulVoteRepository votes;

    public RatingRepositoryAdapter(SpringDataWorkRatingRepository ratings, SpringDataReviewHelpfulVoteRepository votes) {
        this.ratings = ratings;
        this.votes = votes;
    }

    @Override
    @Transactional(readOnly = true)
    public Optional<WorkRating> find(UserId userId, WorkId workId) {
        return ratings.findByUserIdAndWorkId(userId.value(), workId.value()).map(this::toDomain);
    }

    @Override
    @Transactional(readOnly = true)
    public Optional<WorkRating> findById(RatingId id) {
        return ratings.findById(id.value()).map(this::toDomain);
    }

    @Override
    @Transactional
    public WorkRating save(WorkRating rating) {
        WorkRatingJpaEntity row = ratings.findById(rating.getId().value())
                .orElseGet(() -> new WorkRatingJpaEntity(rating.getId().value(), rating.getUserId().value(), rating.getWorkId().value(),
                        rating.getRatedAt()));
        row.setScore(rating.getScore());
        Review review = rating.getReview();
        row.setLiked(review != null ? review.liked() : null);
        row.setDisliked(review != null ? review.disliked() : null);
        row.setVerdict(review != null ? review.verdict() : null);
        row.setUpdatedAt(rating.getUpdatedAt());
        return toDomain(ratings.saveAndFlush(row));
    }

    @Override
    @Transactional(readOnly = true)
    public RatingSummary summary(WorkId workId) {
        Object[] row = ratings.summary(workId.value()).getFirst();
        long count = ((Number) row[1]).longValue();
        return new RatingSummary(count == 0 ? 0 : ((Number) row[0]).doubleValue(), count);
    }

    @Override
    @Transactional(readOnly = true)
    public List<ReviewRow> findReviews(WorkId workId, int limit) {
        return ratings.findReviews(workId.value(), PageRequest.of(0, limit)).stream()
                .map(row -> new ReviewRow(toDomain((WorkRatingJpaEntity) row[0]), (String) row[1], ((Number) row[2]).longValue()))
                .toList();
    }

    @Override
    @Transactional
    public long addHelpfulVote(RatingId ratingId, UserId voterId) {
        var key = new ReviewHelpfulVoteJpaEntity.Key(ratingId.value(), voterId.value());
        if (!votes.existsById(key)) {
            // A concurrent duplicate trips the (rating_id, voter_id) primary key instead of double counting.
            votes.saveAndFlush(new ReviewHelpfulVoteJpaEntity(ratingId.value(), voterId.value(), Instant.now()));
        }
        return votes.countByRatingId(ratingId.value());
    }

    @Override
    @Transactional(readOnly = true)
    public List<RankedWork> findTopRated(int minRatings, int limit) {
        return ratings.findTopRated(minRatings, PageRequest.of(0, limit)).stream()
                .map(row -> new RankedWork(WorkId.of((UUID) row[0]), ((Number) row[1]).doubleValue(), ((Number) row[2]).longValue()))
                .toList();
    }

    private WorkRating toDomain(WorkRatingJpaEntity row) {
        Review review = row.getVerdict() != null ? new Review(row.getLiked(), row.getDisliked(), row.getVerdict()) : null;
        return new WorkRating(RatingId.of(row.getId()), UserId.of(row.getUserId()), WorkId.of(row.getWorkId()), row.getScore(), review,
                row.getRatedAt(), row.getUpdatedAt());
    }
}
