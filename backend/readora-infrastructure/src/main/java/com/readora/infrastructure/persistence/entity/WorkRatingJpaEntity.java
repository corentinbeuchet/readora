package com.readora.infrastructure.persistence.entity;

import jakarta.persistence.*;

import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name = "work_ratings")
public class WorkRatingJpaEntity {

    @Id
    private UUID id;

    @Column(name = "user_id", nullable = false, length = 100)
    private String userId;

    @Column(name = "work_id", nullable = false)
    private UUID workId;

    @Column(nullable = false)
    private int score;

    @Column(length = 2000)
    private String liked;

    @Column(length = 2000)
    private String disliked;

    @Column(length = 2000)
    private String verdict;

    @Column(name = "rated_at", nullable = false)
    private Instant ratedAt;

    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt;

    protected WorkRatingJpaEntity() {
    }

    public WorkRatingJpaEntity(UUID id, String userId, UUID workId, Instant ratedAt) {
        this.id = id;
        this.userId = userId;
        this.workId = workId;
        this.ratedAt = ratedAt;
    }

    public UUID getId() { return id; }
    public String getUserId() { return userId; }
    public UUID getWorkId() { return workId; }
    public int getScore() { return score; }
    public void setScore(int score) { this.score = score; }
    public String getLiked() { return liked; }
    public void setLiked(String liked) { this.liked = liked; }
    public String getDisliked() { return disliked; }
    public void setDisliked(String disliked) { this.disliked = disliked; }
    public String getVerdict() { return verdict; }
    public void setVerdict(String verdict) { this.verdict = verdict; }
    public Instant getRatedAt() { return ratedAt; }
    public Instant getUpdatedAt() { return updatedAt; }
    public void setUpdatedAt(Instant updatedAt) { this.updatedAt = updatedAt; }
}
