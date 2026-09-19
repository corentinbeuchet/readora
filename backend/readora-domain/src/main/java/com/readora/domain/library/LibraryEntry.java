package com.readora.domain.library;

import com.readora.domain.common.UserId;
import com.readora.domain.social.ReadingStatus;
import com.readora.domain.work.WorkId;

import java.time.Instant;
import java.util.Objects;

/// A series in a reader's library, with where the reader stands on it. One entry per reader and series.
public class LibraryEntry {
    private final UserId userId;
    private final WorkId workId;
    private ReadingStatus status;
    private final Instant addedAt;
    private Instant updatedAt;
    private boolean notify;

    public LibraryEntry(UserId userId, WorkId workId, ReadingStatus status, Instant addedAt, Instant updatedAt) {
        this(userId, workId, status, addedAt, updatedAt, true);
    }

    /// @param notify whether the reader is told about new chapters of this series (US-10)
    public LibraryEntry(UserId userId, WorkId workId, ReadingStatus status, Instant addedAt, Instant updatedAt, boolean notify) {
        this.userId = Objects.requireNonNull(userId, "UserId cannot be null");
        this.workId = Objects.requireNonNull(workId, "WorkId cannot be null");
        this.status = Objects.requireNonNull(status, "ReadingStatus cannot be null");
        this.addedAt = Objects.requireNonNull(addedAt, "addedAt cannot be null");
        this.updatedAt = Objects.requireNonNull(updatedAt, "updatedAt cannot be null");
        this.notify = notify;
    }

    public static LibraryEntry add(UserId userId, WorkId workId, ReadingStatus status, Instant now) {
        return new LibraryEntry(userId, workId, status, now, now);
    }

    public void changeStatus(ReadingStatus newStatus, Instant now) {
        this.status = Objects.requireNonNull(newStatus, "ReadingStatus cannot be null");
        this.updatedAt = now;
    }

    public void setNotifications(boolean enabled, Instant now) {
        this.notify = enabled;
        this.updatedAt = now;
    }

    public boolean notifiesNewChapters() {
        return notify;
    }

    public UserId getUserId() {
        return userId;
    }

    public WorkId getWorkId() {
        return workId;
    }

    public ReadingStatus getStatus() {
        return status;
    }

    public Instant getAddedAt() {
        return addedAt;
    }

    public Instant getUpdatedAt() {
        return updatedAt;
    }
}
