package com.readora.infrastructure.persistence.repository;

import com.readora.infrastructure.persistence.entity.ReviewHelpfulVoteJpaEntity;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.UUID;

@Repository
public interface SpringDataReviewHelpfulVoteRepository extends JpaRepository<ReviewHelpfulVoteJpaEntity, ReviewHelpfulVoteJpaEntity.Key> {

    @Query("select count(v) from ReviewHelpfulVoteJpaEntity v where v.id.ratingId = :ratingId")
    long countByRatingId(@Param("ratingId") UUID ratingId);
}
