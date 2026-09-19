package com.readora.infrastructure.persistence.entity;

import jakarta.persistence.*;

import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name = "comment_reports")
public class CommentReportJpaEntity {

    @Id
    private UUID id;

    @Column(name = "comment_id", nullable = false)
    private UUID commentId;

    @Column(name = "reporter_id", nullable = false, length = 100)
    private String reporterId;

    @Column(nullable = false, length = 30)
    private String reason;

    @Column(nullable = false, length = 20)
    private String status;

    @Column(name = "created_at", nullable = false)
    private Instant createdAt;

    @Column(name = "closed_at")
    private Instant closedAt;

    @Column(name = "closed_by", length = 100)
    private String closedBy;

    protected CommentReportJpaEntity() {
    }

    public CommentReportJpaEntity(UUID id, UUID commentId, String reporterId, String reason, Instant createdAt) {
        this.id = id;
        this.commentId = commentId;
        this.reporterId = reporterId;
        this.reason = reason;
        this.createdAt = createdAt;
    }

    public UUID getId() { return id; }
    public UUID getCommentId() { return commentId; }
    public String getReporterId() { return reporterId; }
    public String getReason() { return reason; }
    public String getStatus() { return status; }
    public void setStatus(String status) { this.status = status; }
    public Instant getCreatedAt() { return createdAt; }
    public Instant getClosedAt() { return closedAt; }
    public void setClosedAt(Instant closedAt) { this.closedAt = closedAt; }
    public String getClosedBy() { return closedBy; }
    public void setClosedBy(String closedBy) { this.closedBy = closedBy; }
}
