package com.readora.domain.moderation;

import com.readora.domain.common.DomainValidationException;
import com.readora.domain.common.UserId;
import com.readora.domain.social.CommentId;
import org.jspecify.annotations.Nullable;

import java.time.Instant;
import java.util.Objects;
import java.util.UUID;

/// A reader's report of a comment, waiting for a moderator.
public class CommentReport {
    private final UUID id;
    private final CommentId commentId;
    private final UserId reporterId;
    private final CommentReportReason reason;
    private CommentReportStatus status;
    private final Instant createdAt;
    private @Nullable Instant closedAt;
    private @Nullable UserId closedBy;

    public CommentReport(UUID id, CommentId commentId, UserId reporterId, CommentReportReason reason, CommentReportStatus status,
                         Instant createdAt, @Nullable Instant closedAt, @Nullable UserId closedBy) {
        this.id = Objects.requireNonNull(id, "id cannot be null");
        this.commentId = Objects.requireNonNull(commentId, "CommentId cannot be null");
        this.reporterId = Objects.requireNonNull(reporterId, "Reporter cannot be null");
        this.reason = Objects.requireNonNull(reason, "Reason cannot be null");
        this.status = Objects.requireNonNull(status, "Status cannot be null");
        this.createdAt = Objects.requireNonNull(createdAt, "createdAt cannot be null");
        this.closedAt = closedAt;
        this.closedBy = closedBy;
    }

    public static CommentReport open(CommentId commentId, UserId reporterId, CommentReportReason reason, Instant now) {
        return new CommentReport(UUID.randomUUID(), commentId, reporterId, reason, CommentReportStatus.OPEN, now, null, null);
    }

    /// Closes the report as `HIDDEN` or `DISMISSED`.
    ///
    /// @throws DomainValidationException if it is already closed, or `outcome` is `OPEN`
    public void close(CommentReportStatus outcome, UserId moderator, Instant now) {
        if (status != CommentReportStatus.OPEN) {
            throw new DomainValidationException("This report is already closed");
        }
        if (outcome == CommentReportStatus.OPEN) {
            throw new DomainValidationException("A report is closed as hidden or dismissed");
        }
        this.status = outcome;
        this.closedAt = now;
        this.closedBy = Objects.requireNonNull(moderator, "Moderator cannot be null");
    }

    public boolean isOpen() {
        return status == CommentReportStatus.OPEN;
    }

    public UUID getId() { return id; }
    public CommentId getCommentId() { return commentId; }
    public UserId getReporterId() { return reporterId; }
    public CommentReportReason getReason() { return reason; }
    public CommentReportStatus getStatus() { return status; }
    public Instant getCreatedAt() { return createdAt; }
    public @Nullable Instant getClosedAt() { return closedAt; }
    public @Nullable UserId getClosedBy() { return closedBy; }
}
