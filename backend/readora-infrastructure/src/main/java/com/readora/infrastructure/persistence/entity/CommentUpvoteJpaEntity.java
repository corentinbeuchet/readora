package com.readora.infrastructure.persistence.entity;

import jakarta.persistence.*;

import java.io.Serializable;
import java.time.Instant;
import java.util.Objects;
import java.util.UUID;

/// One row per (comment, voter): the primary key makes upvotes idempotent per user.
@Entity
@Table(name = "comment_upvotes")
public class CommentUpvoteJpaEntity {

    @EmbeddedId
    private Key id;

    @Column(name = "created_at", nullable = false)
    private Instant createdAt;

    protected CommentUpvoteJpaEntity() {
    }

    public CommentUpvoteJpaEntity(UUID commentId, String userId, Instant createdAt) {
        this.id = new Key(commentId, userId);
        this.createdAt = createdAt;
    }

    public Key getId() {
        return id;
    }

    @Embeddable
    public static class Key implements Serializable {
        @Column(name = "comment_id", nullable = false)
        private UUID commentId;

        @Column(name = "user_id", nullable = false, length = 100)
        private String userId;

        protected Key() {
        }

        public Key(UUID commentId, String userId) {
            this.commentId = commentId;
            this.userId = userId;
        }

        @Override
        public boolean equals(Object o) {
            return o instanceof Key other && Objects.equals(commentId, other.commentId) && Objects.equals(userId, other.userId);
        }

        @Override
        public int hashCode() {
            return Objects.hash(commentId, userId);
        }
    }
}
