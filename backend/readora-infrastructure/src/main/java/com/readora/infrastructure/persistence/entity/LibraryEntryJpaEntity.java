package com.readora.infrastructure.persistence.entity;

import jakarta.persistence.*;

import java.io.Serializable;
import java.time.Instant;
import java.util.Objects;
import java.util.UUID;

/// One row per (reader, series): the primary key keeps a series once in a library.
@Entity
@Table(name = "library_entries")
public class LibraryEntryJpaEntity {

    @EmbeddedId
    private Key id;

    @Column(nullable = false, length = 20)
    private String status;

    @Column(name = "added_at", nullable = false)
    private Instant addedAt;

    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt;

    @Column(nullable = false)
    private boolean notify = true;

    protected LibraryEntryJpaEntity() {
    }

    public LibraryEntryJpaEntity(String userId, UUID workId, String status, Instant addedAt, Instant updatedAt) {
        this.id = new Key(userId, workId);
        this.status = status;
        this.addedAt = addedAt;
        this.updatedAt = updatedAt;
    }

    public Key getId() { return id; }
    public String getStatus() { return status; }
    public void setStatus(String status) { this.status = status; }
    public Instant getAddedAt() { return addedAt; }
    public Instant getUpdatedAt() { return updatedAt; }
    public void setUpdatedAt(Instant updatedAt) { this.updatedAt = updatedAt; }
    public boolean isNotify() { return notify; }
    public void setNotify(boolean notify) { this.notify = notify; }

    @Embeddable
    public static class Key implements Serializable {
        @Column(name = "user_id", nullable = false, length = 100)
        private String userId;

        @Column(name = "work_id", nullable = false)
        private UUID workId;

        protected Key() {
        }

        public Key(String userId, UUID workId) {
            this.userId = userId;
            this.workId = workId;
        }

        public String getUserId() { return userId; }
        public UUID getWorkId() { return workId; }

        @Override
        public boolean equals(Object o) {
            return o instanceof Key other && Objects.equals(userId, other.userId) && Objects.equals(workId, other.workId);
        }

        @Override
        public int hashCode() {
            return Objects.hash(userId, workId);
        }
    }
}
