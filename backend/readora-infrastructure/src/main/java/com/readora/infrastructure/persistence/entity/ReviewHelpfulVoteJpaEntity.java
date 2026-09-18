package com.readora.infrastructure.persistence.entity;

import jakarta.persistence.*;

import java.io.Serializable;
import java.time.Instant;
import java.util.Objects;
import java.util.UUID;

/// One row per (review, voter): the primary key makes "helpful" votes idempotent.
@Entity
@Table(name = "review_helpful_votes")
public class ReviewHelpfulVoteJpaEntity {

    @EmbeddedId
    private Key id;

    @Column(name = "created_at", nullable = false)
    private Instant createdAt;

    protected ReviewHelpfulVoteJpaEntity() {
    }

    public ReviewHelpfulVoteJpaEntity(UUID ratingId, String voterId, Instant createdAt) {
        this.id = new Key(ratingId, voterId);
        this.createdAt = createdAt;
    }

    public Key getId() { return id; }

    @Embeddable
    public static class Key implements Serializable {
        @Column(name = "rating_id", nullable = false)
        private UUID ratingId;

        @Column(name = "voter_id", nullable = false, length = 100)
        private String voterId;

        protected Key() {
        }

        public Key(UUID ratingId, String voterId) {
            this.ratingId = ratingId;
            this.voterId = voterId;
        }

        @Override
        public boolean equals(Object o) {
            return o instanceof Key other && Objects.equals(ratingId, other.ratingId) && Objects.equals(voterId, other.voterId);
        }

        @Override
        public int hashCode() {
            return Objects.hash(ratingId, voterId);
        }
    }
}
