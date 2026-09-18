package com.readora.infrastructure.persistence.entity;

import jakarta.persistence.*;

import java.io.Serializable;
import java.time.Instant;
import java.util.Objects;
import java.util.UUID;

/// One row per (reader, chapter): the last visit and whether the chapter was ever finished.
@Entity
@Table(name = "chapter_reads")
public class ChapterReadJpaEntity {

    @EmbeddedId
    private Key id;

    @Column(name = "work_id", nullable = false)
    private UUID workId;

    @Column(name = "chapter_number", nullable = false, length = 50)
    private String chapterNumber;

    @Column(name = "read_at", nullable = false)
    private Instant readAt;

    @Column(nullable = false)
    private boolean finished;

    protected ChapterReadJpaEntity() {
    }

    public ChapterReadJpaEntity(String userId, UUID chapterId, UUID workId, String chapterNumber, Instant readAt, boolean finished) {
        this.id = new Key(userId, chapterId);
        this.workId = workId;
        this.chapterNumber = chapterNumber;
        this.readAt = readAt;
        this.finished = finished;
    }

    public Key getId() { return id; }
    public UUID getWorkId() { return workId; }
    public String getChapterNumber() { return chapterNumber; }
    public Instant getReadAt() { return readAt; }
    public void setReadAt(Instant readAt) { this.readAt = readAt; }
    public boolean isFinished() { return finished; }
    public void setFinished(boolean finished) { this.finished = finished; }

    @Embeddable
    public static class Key implements Serializable {
        @Column(name = "user_id", nullable = false, length = 100)
        private String userId;

        @Column(name = "chapter_id", nullable = false)
        private UUID chapterId;

        protected Key() {
        }

        public Key(String userId, UUID chapterId) {
            this.userId = userId;
            this.chapterId = chapterId;
        }

        public String getUserId() { return userId; }
        public UUID getChapterId() { return chapterId; }

        @Override
        public boolean equals(Object o) {
            return o instanceof Key other && Objects.equals(userId, other.userId) && Objects.equals(chapterId, other.chapterId);
        }

        @Override
        public int hashCode() {
            return Objects.hash(userId, chapterId);
        }
    }
}
