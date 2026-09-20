package com.readora.domain.work;

import com.readora.domain.common.AggregateRoot;
import com.readora.domain.common.DomainValidationException;
import org.jspecify.annotations.Nullable;

import java.time.Instant;
import java.util.Collections;
import java.util.HashSet;
import java.util.Objects;
import java.util.Set;

public class Work extends AggregateRoot<WorkId> {
    public static final int MAX_AUTHOR_LENGTH = 120;

    private String title;
    private String synopsis;
    private WorkType type;
    private WorkStatus status;
    private @Nullable String author;
    private @Nullable Demographic demographic;
    private @Nullable String coverImageUrl;
    private Set<String> genres;
    private WorkFacts facts;
    private final Instant createdAt;
    private Instant updatedAt;

    public Work(WorkId id, String title, @Nullable String synopsis, WorkType type, WorkStatus status,
                @Nullable String author, @Nullable Demographic demographic,
                @Nullable String coverImageUrl, Set<String> genres, WorkFacts facts, Instant createdAt, Instant updatedAt) {
        super(id);
        this.title = validateTitle(title);
        this.synopsis = synopsis != null ? synopsis : "";
        this.type = Objects.requireNonNull(type, "WorkType cannot be null");
        this.status = Objects.requireNonNull(status, "WorkStatus cannot be null");
        this.author = normaliseAuthor(author);
        this.demographic = demographic;
        this.coverImageUrl = coverImageUrl;
        this.genres = genres != null ? new HashSet<>(genres) : new HashSet<>();
        this.facts = Objects.requireNonNull(facts, "WorkFacts cannot be null");
        this.createdAt = createdAt != null ? createdAt : Instant.now();
        this.updatedAt = updatedAt != null ? updatedAt : this.createdAt;
    }

    public static Work create(String title, String synopsis, WorkType type, String coverImageUrl, Set<String> genres) {
        return create(title, synopsis, type, WorkStatus.ONGOING, coverImageUrl, genres);
    }

    public static Work create(String title, String synopsis, WorkType type, WorkStatus status, String coverImageUrl, Set<String> genres) {
        return create(title, synopsis, type, status, null, null, coverImageUrl, genres);
    }

    public static Work create(String title, @Nullable String synopsis, WorkType type, WorkStatus status,
                              @Nullable String author, @Nullable Demographic demographic,
                              @Nullable String coverImageUrl, Set<String> genres) {
        return create(title, synopsis, type, status, author, demographic, coverImageUrl, genres, WorkFacts.none());
    }

    public static Work create(String title, @Nullable String synopsis, WorkType type, WorkStatus status,
                              @Nullable String author, @Nullable Demographic demographic,
                              @Nullable String coverImageUrl, Set<String> genres, WorkFacts facts) {
        Instant now = Instant.now();
        return new Work(WorkId.generate(), title, synopsis, type, status != null ? status : WorkStatus.ONGOING,
                author, demographic, coverImageUrl, genres, facts, now, now);
    }

    /// Replaces how the series is described (everything its page shows about it). Validates before changing anything,
    /// so a refused description leaves the series as it was.
    ///
    /// @param now when the edit happens; becomes `updatedAt`, which orders the catalog
    /// @throws DomainValidationException if the title is empty or the author too long
    public void describe(String title, @Nullable String synopsis, WorkType type, WorkStatus status, @Nullable String author,
                         @Nullable Demographic demographic, @Nullable String coverImageUrl, Set<String> genres, WorkFacts facts,
                         Instant now) {
        String validTitle = validateTitle(title);
        String validAuthor = normaliseAuthor(author);
        Objects.requireNonNull(type, "WorkType cannot be null");
        Objects.requireNonNull(status, "WorkStatus cannot be null");
        Objects.requireNonNull(facts, "WorkFacts cannot be null");
        this.title = validTitle;
        this.synopsis = synopsis != null ? synopsis : "";
        this.type = type;
        this.status = status;
        this.author = validAuthor;
        this.demographic = demographic;
        this.coverImageUrl = coverImageUrl;
        this.genres = new HashSet<>(genres);
        this.facts = facts;
        this.updatedAt = Objects.requireNonNull(now, "now cannot be null");
    }

    /// Blank means unknown; otherwise trimmed and at most [#MAX_AUTHOR_LENGTH] characters.
    private static @Nullable String normaliseAuthor(@Nullable String author) {
        if (author == null || author.isBlank()) {
            return null;
        }
        String trimmed = author.trim();
        if (trimmed.length() > MAX_AUTHOR_LENGTH) {
            throw new DomainValidationException("Author cannot exceed " + MAX_AUTHOR_LENGTH + " characters");
        }
        return trimmed;
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

    public @Nullable String getAuthor() {
        return author;
    }

    public @Nullable Demographic getDemographic() {
        return demographic;
    }

    public @Nullable String getCoverImageUrl() {
        return coverImageUrl;
    }

    public Set<String> getGenres() {
        return Collections.unmodifiableSet(genres);
    }

    public WorkFacts getFacts() {
        return facts;
    }

    public Instant getCreatedAt() {
        return createdAt;
    }

    public Instant getUpdatedAt() {
        return updatedAt;
    }
}
