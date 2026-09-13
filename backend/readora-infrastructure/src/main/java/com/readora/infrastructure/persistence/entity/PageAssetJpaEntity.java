package com.readora.infrastructure.persistence.entity;

import jakarta.persistence.*;
import java.util.UUID;

@Entity
@Table(name = "page_assets")
public class PageAssetJpaEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.AUTO)
    private UUID id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "chapter_id", nullable = false)
    private ChapterJpaEntity chapter;

    @Column(name = "page_number", nullable = false)
    private int pageNumber;

    @Column(name = "storage_key", nullable = false)
    private String storageKey;

    @Column(name = "cdn_url")
    private String cdnUrl;

    private int width;
    private int height;

    public PageAssetJpaEntity() {}

    public PageAssetJpaEntity(ChapterJpaEntity chapter, int pageNumber, String storageKey, String cdnUrl, int width, int height) {
        this.chapter = chapter;
        this.pageNumber = pageNumber;
        this.storageKey = storageKey;
        this.cdnUrl = cdnUrl;
        this.width = width;
        this.height = height;
    }

    public UUID getId() { return id; }
    public ChapterJpaEntity getChapter() { return chapter; }
    public void setChapter(ChapterJpaEntity chapter) { this.chapter = chapter; }
    public int getPageNumber() { return pageNumber; }
    public void setPageNumber(int pageNumber) { this.pageNumber = pageNumber; }
    public String getStorageKey() { return storageKey; }
    public void setStorageKey(String storageKey) { this.storageKey = storageKey; }
    public String getCdnUrl() { return cdnUrl; }
    public void setCdnUrl(String cdnUrl) { this.cdnUrl = cdnUrl; }
    public int getWidth() { return width; }
    public void setWidth(int width) { this.width = width; }
    public int getHeight() { return height; }
    public void setHeight(int height) { this.height = height; }
}
