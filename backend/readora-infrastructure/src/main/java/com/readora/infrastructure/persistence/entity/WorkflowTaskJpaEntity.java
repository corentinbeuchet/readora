package com.readora.infrastructure.persistence.entity;

import jakarta.persistence.*;
import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name = "workflow_tasks")
public class WorkflowTaskJpaEntity {

    @Id
    private UUID id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "project_id", nullable = false)
    private ScanlationProjectJpaEntity project;

    @Column(name = "chapter_number", nullable = false)
    private String chapterNumber;

    @Column(nullable = false)
    private String stage;

    @Column(nullable = false)
    private String status;

    @Column(name = "assignee_id")
    private String assigneeId;

    @Column(name = "asset_package_url")
    private String assetPackageUrl;

    @Column(name = "page_count", nullable = false)
    private int pageCount;

    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt;

    public WorkflowTaskJpaEntity() {}

    public WorkflowTaskJpaEntity(UUID id, ScanlationProjectJpaEntity project, String chapterNumber, String stage, String status, String assigneeId, String assetPackageUrl, int pageCount, Instant updatedAt) {
        this.id = id;
        this.project = project;
        this.chapterNumber = chapterNumber;
        this.stage = stage;
        this.status = status;
        this.assigneeId = assigneeId;
        this.assetPackageUrl = assetPackageUrl;
        this.pageCount = pageCount;
        this.updatedAt = updatedAt;
    }

    public UUID getId() { return id; }
    public void setId(UUID id) { this.id = id; }
    public ScanlationProjectJpaEntity getProject() { return project; }
    public void setProject(ScanlationProjectJpaEntity project) { this.project = project; }
    public String getChapterNumber() { return chapterNumber; }
    public void setChapterNumber(String chapterNumber) { this.chapterNumber = chapterNumber; }
    public String getStage() { return stage; }
    public void setStage(String stage) { this.stage = stage; }
    public String getStatus() { return status; }
    public void setStatus(String status) { this.status = status; }
    public String getAssigneeId() { return assigneeId; }
    public void setAssigneeId(String assigneeId) { this.assigneeId = assigneeId; }
    public String getAssetPackageUrl() { return assetPackageUrl; }
    public void setAssetPackageUrl(String assetPackageUrl) { this.assetPackageUrl = assetPackageUrl; }
    public int getPageCount() { return pageCount; }
    public void setPageCount(int pageCount) { this.pageCount = pageCount; }
    public Instant getUpdatedAt() { return updatedAt; }
    public void setUpdatedAt(Instant updatedAt) { this.updatedAt = updatedAt; }
}
