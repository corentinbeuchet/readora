package com.readora.infrastructure.persistence.entity;

import jakarta.persistence.*;

import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name = "page_reports")
public class PageReportJpaEntity {

    @Id
    private UUID id;

    @Column(name = "chapter_id", nullable = false)
    private UUID chapterId;

    @Column(name = "work_id", nullable = false)
    private UUID workId;

    @Column(name = "project_id")
    private UUID projectId;

    @Column(name = "chapter_number", nullable = false, length = 50)
    private String chapterNumber;

    @Column(name = "page_number", nullable = false)
    private int pageNumber;

    @Column(nullable = false, length = 30)
    private String reason;

    @Column(name = "reporter_id", nullable = false, length = 100)
    private String reporterId;

    @Column(nullable = false, length = 20)
    private String status;

    @Column(name = "created_at", nullable = false)
    private Instant createdAt;

    @Column(name = "resolved_at")
    private Instant resolvedAt;

    @Column(name = "resolved_by", length = 100)
    private String resolvedBy;

    @Version
    @Column(nullable = false)
    private Long version;

    protected PageReportJpaEntity() {
    }

    public PageReportJpaEntity(UUID id, UUID chapterId, UUID workId, UUID projectId, String chapterNumber, int pageNumber,
                               String reason, String reporterId, String status, Instant createdAt) {
        this.id = id;
        this.chapterId = chapterId;
        this.workId = workId;
        this.projectId = projectId;
        this.chapterNumber = chapterNumber;
        this.pageNumber = pageNumber;
        this.reason = reason;
        this.reporterId = reporterId;
        this.status = status;
        this.createdAt = createdAt;
    }

    public UUID getId() { return id; }
    public UUID getChapterId() { return chapterId; }
    public UUID getWorkId() { return workId; }
    public UUID getProjectId() { return projectId; }
    public String getChapterNumber() { return chapterNumber; }
    public int getPageNumber() { return pageNumber; }
    public String getReason() { return reason; }
    public String getReporterId() { return reporterId; }
    public String getStatus() { return status; }
    public void setStatus(String status) { this.status = status; }
    public Instant getCreatedAt() { return createdAt; }
    public Instant getResolvedAt() { return resolvedAt; }
    public void setResolvedAt(Instant resolvedAt) { this.resolvedAt = resolvedAt; }
    public String getResolvedBy() { return resolvedBy; }
    public void setResolvedBy(String resolvedBy) { this.resolvedBy = resolvedBy; }
    public Long getVersion() { return version; }
}
