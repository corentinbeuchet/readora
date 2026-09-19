package com.readora.infrastructure.persistence.entity;

import jakarta.persistence.*;

import java.io.Serializable;
import java.time.Instant;
import java.util.Objects;
import java.util.UUID;

/// One row per (list, reader): the primary key makes list upvotes idempotent.
@Entity
@Table(name = "reading_list_upvotes")
public class ReadingListUpvoteJpaEntity {

    @EmbeddedId
    private Key id;

    @Column(name = "created_at", nullable = false)
    private Instant createdAt;

    protected ReadingListUpvoteJpaEntity() {
    }

    public ReadingListUpvoteJpaEntity(UUID listId, String userId, Instant createdAt) {
        this.id = new Key(listId, userId);
        this.createdAt = createdAt;
    }

    @Embeddable
    public static class Key implements Serializable {
        @Column(name = "list_id", nullable = false)
        private UUID listId;

        @Column(name = "user_id", nullable = false, length = 100)
        private String userId;

        protected Key() {
        }

        public Key(UUID listId, String userId) {
            this.listId = listId;
            this.userId = userId;
        }

        @Override
        public boolean equals(Object o) {
            return o instanceof Key other && Objects.equals(listId, other.listId) && Objects.equals(userId, other.userId);
        }

        @Override
        public int hashCode() {
            return Objects.hash(listId, userId);
        }
    }
}
