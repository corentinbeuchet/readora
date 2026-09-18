package com.readora.acceptance.fakes;

import com.readora.application.port.out.RatingRepositoryPort;
import com.readora.domain.common.UserId;
import com.readora.domain.rating.RatingId;
import com.readora.domain.rating.WorkRating;
import com.readora.domain.work.WorkId;

import java.util.Comparator;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import java.util.concurrent.ConcurrentHashMap;
import java.util.stream.Collectors;

/// Same semantics as `RatingRepositoryAdapter`; the author's username is the user id here.
public class InMemoryRatingRepository implements RatingRepositoryPort {

    private final Map<RatingId, WorkRating> ratings = new ConcurrentHashMap<>();
    private final Map<RatingId, Set<UserId>> helpful = new ConcurrentHashMap<>();

    @Override
    public Optional<WorkRating> find(UserId userId, WorkId workId) {
        return ratings.values().stream().filter(r -> r.getUserId().equals(userId) && r.getWorkId().equals(workId)).findFirst();
    }

    @Override
    public Optional<WorkRating> findById(RatingId id) {
        return Optional.ofNullable(ratings.get(id));
    }

    @Override
    public WorkRating save(WorkRating rating) {
        ratings.put(rating.getId(), rating);
        return rating;
    }

    @Override
    public RatingSummary summary(WorkId workId) {
        var scores = ratings.values().stream().filter(r -> r.getWorkId().equals(workId)).mapToInt(WorkRating::getScore).summaryStatistics();
        return new RatingSummary(scores.getCount() == 0 ? 0 : scores.getAverage(), scores.getCount());
    }

    @Override
    public List<ReviewRow> findReviews(WorkId workId, int limit) {
        return ratings.values().stream()
                .filter(r -> r.getWorkId().equals(workId) && r.getReview() != null)
                .map(r -> new ReviewRow(r, r.getUserId().value(), votes(r.getId())))
                .sorted(Comparator.comparingLong(ReviewRow::helpfulVotes).reversed())
                .limit(limit)
                .toList();
    }

    @Override
    public long addHelpfulVote(RatingId ratingId, UserId voterId) {
        helpful.computeIfAbsent(ratingId, id -> ConcurrentHashMap.newKeySet()).add(voterId);
        return votes(ratingId);
    }

    @Override
    public List<RankedWork> findTopRated(int minRatings, int limit) {
        return ratings.values().stream()
                .collect(Collectors.groupingBy(WorkRating::getWorkId, Collectors.summarizingInt(WorkRating::getScore)))
                .entrySet().stream()
                .filter(e -> e.getValue().getCount() >= minRatings)
                .map(e -> new RankedWork(e.getKey(), e.getValue().getAverage(), e.getValue().getCount()))
                .sorted(Comparator.comparingDouble(RankedWork::average).reversed())
                .limit(limit)
                .toList();
    }

    private long votes(RatingId id) {
        return helpful.getOrDefault(id, Set.of()).size();
    }
}
