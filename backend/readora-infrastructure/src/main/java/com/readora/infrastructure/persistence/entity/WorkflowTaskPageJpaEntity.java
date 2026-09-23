package com.readora.infrastructure.persistence.entity;

import jakarta.persistence.*;

import java.util.UUID;

@Entity
@Table(name = "workflow_task_pages")
public class WorkflowTaskPageJpaEntity {

    @Id
    private UUID id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "task_id", nullable = false)
    private WorkflowTaskJpaEntity task;

    @Column(name = "page_number", nullable = false)
    private int pageNumber;

    @Column(name = "storage_key", nullable = false, length = 1024)
    private String storageKey;

    @Column(name = "cdn_url", length = 1024)
    private String cdnUrl;

    @Column(name = "lite_cdn_url", length = 1024)
    private String liteCdnUrl;

    @Column(nullable = false)
    private int width;

    @Column(nullable = false)
    private int height;

    @Column(length = 500)
    private String description;

    protected WorkflowTaskPageJpaEntity() {
    }

    public WorkflowTaskPageJpaEntity(WorkflowTaskJpaEntity task, int pageNumber) {
        this.id = UUID.randomUUID();
        this.task = task;
        this.pageNumber = pageNumber;
    }

    public int getPageNumber() { return pageNumber; }
    public String getStorageKey() { return storageKey; }
    public void setStorageKey(String storageKey) { this.storageKey = storageKey; }
    public String getCdnUrl() { return cdnUrl; }
    public void setCdnUrl(String cdnUrl) { this.cdnUrl = cdnUrl; }
    public String getLiteCdnUrl() { return liteCdnUrl; }
    public void setLiteCdnUrl(String liteCdnUrl) { this.liteCdnUrl = liteCdnUrl; }
    public int getWidth() { return width; }
    public void setWidth(int width) { this.width = width; }
    public int getHeight() { return height; }
    public void setHeight(int height) { this.height = height; }
    public String getDescription() { return description; }
    public void setDescription(String description) { this.description = description; }
}
