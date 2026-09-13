package com.readora.domain.work;

import com.readora.domain.common.AggregateRoot;
import com.readora.domain.common.DomainValidationException;

import java.time.Instant;
import java.util.Collections;
import java.util.HashSet;
import java.util.Objects;
import java.util.Set;

public class Work extends AggregateRoot<WorkId> {
    private String title;
    private String synopsis;
    private WorkType type;
    private WorkStatus status;
    private String coverImageUrl;
    private Set<String> genres;
    private final Instant createdAt;
    private Instant updatedAt;

    public Work(WorkId id, String title, String synopsis, WorkType type, WorkStatus status, String coverImageUrl, Set<String> genres, Instant createdAt, Instant updatedAt) {
        super(id);
        this.title = validateTitle(title);
        this.synopsis = synopsis != null ? synopsis : "";
        this.type = Objects.requireNonNull(type, "WorkType cannot be null");
        this.status = Objects.requireNonNull(status, "WorkStatus cannot be null");
        this.coverImageUrl = coverImageUrl;
        this.genres = genres != null ? new HashSet<>(genres) : new HashSet<>();
        this.createdAt = createdAt != null ? createdAt : Instant.now();
        this.updatedAt = updatedAt != null ? updatedAt : this.createdAt;
    }

    public static Work create(String title, String synopsis, WorkType type, String coverImageUrl, Set<String> genres) {
        Instant now = Instant.now();
        return new Work(WorkId.generate(), title, synopsis, type, WorkStatus.ONGOING, coverImageUrl, genres, now, now);
    }

    private static String validateTitle(String title) {
        if (title == null || title.trim().isEmpty()) {
            throw new DomainValidationException("Work title cannot be empty");
        }
        return title.trim();
    }

    public String getTitle() {
        return title;
    }

    public String getSynopsis() {
        return synopsis;
    }

    public WorkType getType() {
        return type;
    }

    public WorkStatus getStatus() {
        return status;
    }

    public String getCoverImageUrl() {
        return coverImageUrl;
    }

    public Set<String> getGenres() {
        return Collections.unmodifiableSet(genres);
    }

    public Instant getCreatedAt() {
        return createdAt;
    }

    public Instant getUpdatedAt() {
        return updatedAt;
    }
}
