package com.readora.infrastructure.persistence.entity;

import jakarta.persistence.*;
import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name = "bookmarks")
public class BookmarkJpaEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.AUTO)
    private UUID id;

    @Column(name = "user_id", nullable = false)
    private String userId;

    @Column(name = "work_id", nullable = false)
    private UUID workId;

    @Column(name = "last_read_chapter_id")
    private UUID lastReadChapterId;

    @Column(name = "last_read_page_index", nullable = false)
    private int lastReadPageIndex;

    @Column(nullable = false)
    private String status;

    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt;

    public BookmarkJpaEntity() {}

    public BookmarkJpaEntity(String userId, UUID workId, UUID lastReadChapterId, int lastReadPageIndex, String status, Instant updatedAt) {
        this.userId = userId;
        this.workId = workId;
        this.lastReadChapterId = lastReadChapterId;
        this.lastReadPageIndex = lastReadPageIndex;
        this.status = status;
        this.updatedAt = updatedAt;
    }

    public UUID getId() { return id; }
    public String getUserId() { return userId; }
    public void setUserId(String userId) { this.userId = userId; }
    public UUID getWorkId() { return workId; }
    public void setWorkId(UUID workId) { this.workId = workId; }
    public UUID getLastReadChapterId() { return lastReadChapterId; }
    public void setLastReadChapterId(UUID lastReadChapterId) { this.lastReadChapterId = lastReadChapterId; }
    public int getLastReadPageIndex() { return lastReadPageIndex; }
    public void setLastReadPageIndex(int lastReadPageIndex) { this.lastReadPageIndex = lastReadPageIndex; }
    public String getStatus() { return status; }
    public void setStatus(String status) { this.status = status; }
    public Instant getUpdatedAt() { return updatedAt; }
    public void setUpdatedAt(Instant updatedAt) { this.updatedAt = updatedAt; }
}
