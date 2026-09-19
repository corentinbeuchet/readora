package com.readora.infrastructure.persistence.entity;

import jakarta.persistence.*;

import java.io.Serializable;
import java.time.Instant;
import java.util.Objects;
import java.util.UUID;

/// A reader follows a scanlation team (project): its chapters appear in their "My library" updates (US-12, US-08).
@Entity
@Table(name = "team_follows")
public class TeamFollowJpaEntity {

    @EmbeddedId
    private Key id;

    @Column(name = "followed_at", nullable = false)
    private Instant followedAt;

    protected TeamFollowJpaEntity() {
    }

    public TeamFollowJpaEntity(String userId, UUID projectId, Instant followedAt) {
        this.id = new Key(userId, projectId);
        this.followedAt = followedAt;
    }

    public Key getId() { return id; }
    public Instant getFollowedAt() { return followedAt; }

    @Embeddable
    public static class Key implements Serializable {
        @Column(name = "user_id", nullable = false, length = 100)
        private String userId;

        @Column(name = "project_id", nullable = false)
        private UUID projectId;

        protected Key() {
        }

        public Key(String userId, UUID projectId) {
            this.userId = userId;
            this.projectId = projectId;
        }

        public String getUserId() { return userId; }
        public UUID getProjectId() { return projectId; }

        @Override
        public boolean equals(Object o) {
            return o instanceof Key other && Objects.equals(userId, other.userId) && Objects.equals(projectId, other.projectId);
        }

        @Override
        public int hashCode() {
            return Objects.hash(userId, projectId);
        }
    }
}
