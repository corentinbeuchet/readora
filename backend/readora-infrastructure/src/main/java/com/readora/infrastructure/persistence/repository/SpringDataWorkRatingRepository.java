package com.readora.infrastructure.persistence.repository;

import com.readora.infrastructure.persistence.entity.WorkRatingJpaEntity;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Repository
public interface SpringDataWorkRatingRepository extends JpaRepository<WorkRatingJpaEntity, UUID> {

    Optional<WorkRatingJpaEntity> findByUserIdAndWorkId(String userId, UUID workId);

    /// One row `[average, count]` (average is null without ratings).
    @Query("select avg(r.score), count(r) from WorkRatingJpaEntity r where r.workId = :workId")
    List<Object[]> summary(@Param("workId") UUID workId);

    /// Rows of `[rating, authorUsername, helpfulVotes]`, most helpful first.
    @Query("""
            select r, u.username,
                   (select count(v) from ReviewHelpfulVoteJpaEntity v where v.id.ratingId = r.id) as votes
            from WorkRatingJpaEntity r, UserAccountJpaEntity u
            where u.id = r.userId and r.workId = :workId and r.verdict is not null
            order by votes desc, r.updatedAt desc
            """)
    List<Object[]> findReviews(@Param("workId") UUID workId, Pageable page);

    /// Rows of `[workId, average, count]` for works with at least `minRatings` ratings.
    @Query("""
            select r.workId, avg(r.score), count(r) from WorkRatingJpaEntity r
            group by r.workId having count(r) >= :minRatings
            order by avg(r.score) desc, count(r) desc
            """)
    List<Object[]> findTopRated(@Param("minRatings") long minRatings, Pageable page);
}
