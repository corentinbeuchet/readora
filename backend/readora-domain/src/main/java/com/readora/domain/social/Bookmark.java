package com.readora.domain.social;

import com.readora.domain.work.ChapterId;
import com.readora.domain.common.UserId;
import com.readora.domain.work.WorkId;

import java.io.Serializable;
import java.time.Instant;
import java.util.Objects;

public class Bookmark implements Serializable {
    private final UserId userId;
    private final WorkId workId;
    private ChapterId lastReadChapterId;
    private int lastReadPageIndex;
    private ReadingStatus status;
    private Instant updatedAt;

    public Bookmark(UserId userId, WorkId workId, ChapterId lastReadChapterId, int lastReadPageIndex, ReadingStatus status, Instant updatedAt) {
        this.userId = Objects.requireNonNull(userId, "UserId cannot be null");
        this.workId = Objects.requireNonNull(workId, "WorkId cannot be null");
        this.lastReadChapterId = lastReadChapterId;
        this.lastReadPageIndex = Math.max(1, lastReadPageIndex);
        this.status = status != null ? status : ReadingStatus.READING;
        this.updatedAt = updatedAt != null ? updatedAt : Instant.now();
    }

    public static Bookmark startReading(UserId userId, WorkId workId, ChapterId chapterId, int pageIndex) {
        return new Bookmark(userId, workId, chapterId, pageIndex, ReadingStatus.READING, Instant.now());
    }

    public void updateProgress(ChapterId chapterId, int pageIndex) {
        this.lastReadChapterId = chapterId;
        this.lastReadPageIndex = pageIndex;
        this.status = ReadingStatus.READING;
        this.updatedAt = Instant.now();
    }

    public void setStatus(ReadingStatus status) {
        this.status = status;
        this.updatedAt = Instant.now();
    }

    public UserId getUserId() {
        return userId;
    }

    public WorkId getWorkId() {
        return workId;
    }

    public ChapterId getLastReadChapterId() {
        return lastReadChapterId;
    }

    public int getLastReadPageIndex() {
        return lastReadPageIndex;
    }

    public ReadingStatus getStatus() {
        return status;
    }

    public Instant getUpdatedAt() {
        return updatedAt;
    }
}
