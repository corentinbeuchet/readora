package com.readora.infrastructure.persistence.entity;

import jakarta.persistence.*;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

@Entity
@Table(name = "chapters")
public class ChapterJpaEntity {

    @Id
    private UUID id;

    @Column(name = "work_id", nullable = false)
    private UUID workId;

    @Column(name = "chapter_number", nullable = false)
    private String chapterNumber;

    private String title;

    @Column(nullable = false)
    private String status;

    @Column(name = "scanlation_project_id")
    private UUID scanlationProjectId;

    @OneToMany(mappedBy = "chapter", cascade = CascadeType.ALL, orphanRemoval = true, fetch = FetchType.EAGER)
    private List<PageAssetJpaEntity> pages = new ArrayList<>();

    @Column(name = "created_at", nullable = false)
    private Instant createdAt;

    @Column(name = "published_at")
    private Instant publishedAt;

    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt;

    public ChapterJpaEntity() {}

    public ChapterJpaEntity(UUID id, UUID workId, String chapterNumber, String title, String status, UUID scanlationProjectId, Instant createdAt, Instant publishedAt, Instant updatedAt) {
        this.id = id;
        this.workId = workId;
        this.chapterNumber = chapterNumber;
        this.title = title;
        this.status = status;
        this.scanlationProjectId = scanlationProjectId;
        this.createdAt = createdAt;
        this.publishedAt = publishedAt;
        this.updatedAt = updatedAt;
    }

    public UUID getId() { return id; }
    public void setId(UUID id) { this.id = id; }
    public UUID getWorkId() { return workId; }
    public void setWorkId(UUID workId) { this.workId = workId; }
    public String getChapterNumber() { return chapterNumber; }
    public void setChapterNumber(String chapterNumber) { this.chapterNumber = chapterNumber; }
    public String getTitle() { return title; }
    public void setTitle(String title) { this.title = title; }
    public String getStatus() { return status; }
    public void setStatus(String status) { this.status = status; }
    public UUID getScanlationProjectId() { return scanlationProjectId; }
    public void setScanlationProjectId(UUID scanlationProjectId) { this.scanlationProjectId = scanlationProjectId; }
    public List<PageAssetJpaEntity> getPages() { return pages; }
    public void setPages(List<PageAssetJpaEntity> pages) { this.pages = pages; }
    public Instant getCreatedAt() { return createdAt; }
    public void setCreatedAt(Instant createdAt) { this.createdAt = createdAt; }
    public Instant getPublishedAt() { return publishedAt; }
    public void setPublishedAt(Instant publishedAt) { this.publishedAt = publishedAt; }
    public Instant getUpdatedAt() { return updatedAt; }
    public void setUpdatedAt(Instant updatedAt) { this.updatedAt = updatedAt; }
}
