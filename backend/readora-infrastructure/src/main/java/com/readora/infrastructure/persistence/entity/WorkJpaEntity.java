package com.readora.infrastructure.persistence.entity;

import jakarta.persistence.*;
import org.hibernate.annotations.BatchSize;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

@Entity
@Table(name = "works")
public class WorkJpaEntity {

    @Id
    private UUID id;

    @Column(nullable = false)
    private String title;

    @Column(columnDefinition = "TEXT")
    private String synopsis;

    @Column(name = "work_type", nullable = false)
    private String workType;

    @Column(nullable = false)
    private String status;

    @Column(length = 120)
    private String author;

    @Column(length = 20)
    private String demographic;

    @Column(name = "cover_image_url")
    private String coverImageUrl;

    @ElementCollection(fetch = FetchType.LAZY)
    @BatchSize(size = 64)
    @CollectionTable(name = "work_genres", joinColumns = @JoinColumn(name = "work_id"))
    @Column(name = "genre")
    private List<String> genres;

    @ElementCollection(fetch = FetchType.LAZY)
    @BatchSize(size = 64)
    @CollectionTable(name = "work_alt_titles", joinColumns = @JoinColumn(name = "work_id"))
    @OrderColumn(name = "title_order")
    @Column(name = "title", nullable = false, length = 255)
    private List<String> alternativeTitles = new ArrayList<>();

    @Column(length = 120)
    private String artist;

    @Column(name = "release_year")
    private Integer releaseYear;

    @Column(name = "original_language", length = 20)
    private String originalLanguage;

    @Column(name = "content_rating", length = 20)
    private String contentRating;

    @Column(name = "created_at", nullable = false)
    private Instant createdAt;

    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt;

    @Version
    @Column(nullable = false)
    private Long version;

    public Long getVersion() {
        return version;
    }

    public WorkJpaEntity() {}

    public WorkJpaEntity(UUID id, String title, String synopsis, String workType, String status, String author, String demographic,
                         String coverImageUrl, List<String> genres, Instant createdAt, Instant updatedAt) {
        this.id = id;
        this.title = title;
        this.synopsis = synopsis;
        this.workType = workType;
        this.status = status;
        this.author = author;
        this.demographic = demographic;
        this.coverImageUrl = coverImageUrl;
        this.genres = genres;
        this.createdAt = createdAt;
        this.updatedAt = updatedAt;
    }

    public UUID getId() { return id; }
    public void setId(UUID id) { this.id = id; }
    public String getTitle() { return title; }
    public void setTitle(String title) { this.title = title; }
    public String getSynopsis() { return synopsis; }
    public void setSynopsis(String synopsis) { this.synopsis = synopsis; }
    public String getWorkType() { return workType; }
    public void setWorkType(String workType) { this.workType = workType; }
    public String getStatus() { return status; }
    public void setStatus(String status) { this.status = status; }
    public String getAuthor() { return author; }
    public void setAuthor(String author) { this.author = author; }
    public String getDemographic() { return demographic; }
    public void setDemographic(String demographic) { this.demographic = demographic; }
    public String getCoverImageUrl() { return coverImageUrl; }
    public void setCoverImageUrl(String coverImageUrl) { this.coverImageUrl = coverImageUrl; }
    public List<String> getGenres() { return genres; }
    public void setGenres(List<String> genres) { this.genres = genres; }
    public List<String> getAlternativeTitles() { return alternativeTitles; }
    public String getArtist() { return artist; }
    public void setArtist(String artist) { this.artist = artist; }
    public Integer getReleaseYear() { return releaseYear; }
    public void setReleaseYear(Integer releaseYear) { this.releaseYear = releaseYear; }
    public String getOriginalLanguage() { return originalLanguage; }
    public void setOriginalLanguage(String originalLanguage) { this.originalLanguage = originalLanguage; }
    public String getContentRating() { return contentRating; }
    public void setContentRating(String contentRating) { this.contentRating = contentRating; }
    public Instant getCreatedAt() { return createdAt; }
    public void setCreatedAt(Instant createdAt) { this.createdAt = createdAt; }
    public Instant getUpdatedAt() { return updatedAt; }
    public void setUpdatedAt(Instant updatedAt) { this.updatedAt = updatedAt; }
}
