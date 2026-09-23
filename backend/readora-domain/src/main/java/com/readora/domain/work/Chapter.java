package com.readora.domain.work;

import com.readora.domain.common.UserId;
import com.readora.domain.common.AggregateRoot;
import com.readora.domain.common.DomainValidationException;
import com.readora.domain.scanlation.TeamId;
import org.jspecify.annotations.Nullable;

import java.time.Instant;
import java.util.ArrayList;
import java.util.Collections;
import java.util.List;
import java.util.Objects;

public class Chapter extends AggregateRoot<ChapterId> {
    private final WorkId workId;
    private final ChapterNumber chapterNumber;
    private String title;
    private ChapterStatus status;
    private final List<PageAsset> pages = new ArrayList<>();
    private final TeamId teamId;
    private final Instant createdAt;
    private @Nullable Instant publishedAt;
    private Instant updatedAt;

    public Chapter(ChapterId id, WorkId workId, ChapterNumber chapterNumber, @Nullable String title, ChapterStatus status,
                   @Nullable List<PageAsset> pages, TeamId teamId, @Nullable Instant createdAt,
                   @Nullable Instant publishedAt, @Nullable Instant updatedAt) {
        super(id);
        this.workId = Objects.requireNonNull(workId, "WorkId cannot be null");
        this.chapterNumber = Objects.requireNonNull(chapterNumber, "ChapterNumber cannot be null");
        this.title = title != null ? title : "";
        this.status = Objects.requireNonNull(status, "ChapterStatus cannot be null");
        if (pages != null) {
            this.pages.addAll(pages);
        }
        this.teamId = Objects.requireNonNull(teamId, "TeamId cannot be null");
        this.createdAt = createdAt != null ? createdAt : Instant.now();
        this.publishedAt = publishedAt;
        this.updatedAt = updatedAt != null ? updatedAt : this.createdAt;
    }

    public static Chapter createDraft(WorkId workId, ChapterNumber chapterNumber, @Nullable String title, TeamId teamId) {
        Instant now = Instant.now();
        return new Chapter(ChapterId.generate(), workId, chapterNumber, title, ChapterStatus.DRAFT, List.of(), teamId, now, null, now);
    }

    public static Chapter createPublished(WorkId workId, ChapterNumber chapterNumber, @Nullable String title,
                                          @Nullable List<PageAsset> pages, TeamId teamId, UserId publisherId) {
        if (pages == null || pages.isEmpty()) {
            throw new DomainValidationException("Cannot publish chapter with zero pages.");
        }
        requireUniquePageNumbers(pages);
        Instant now = Instant.now();
        Chapter chapter = new Chapter(ChapterId.generate(), workId, chapterNumber, title, ChapterStatus.PUBLISHED, pages, teamId, now, now, now);
        chapter.registerEvent(ChapterPublishedEvent.now(chapter.getId(), workId, chapterNumber));
        return chapter;
    }

    public void updatePages(List<PageAsset> newPages) {
        requireUniquePageNumbers(newPages);
        this.pages.clear();
        if (newPages != null) {
            this.pages.addAll(newPages);
        }
        this.updatedAt = Instant.now();
    }

    public void publish(UserId publisherId) {
        if (isPublished()) {
            throw new DomainValidationException("Chapter " + this.chapterNumber + " is already published.");
        }
        if (this.pages.isEmpty()) {
            throw new DomainValidationException("Cannot publish chapter with zero pages.");
        }
        this.status = ChapterStatus.PUBLISHED;
        this.publishedAt = Instant.now();
        this.updatedAt = this.publishedAt;
        registerEvent(ChapterPublishedEvent.now(this.id, this.workId, this.chapterNumber));
    }

    private static void requireUniquePageNumbers(List<PageAsset> pages) {
        if (pages == null) {
            return;
        }
        long distinct = pages.stream().mapToInt(PageAsset::pageNumber).distinct().count();
        if (distinct != pages.size()) {
            throw new DomainValidationException("Page numbers must be unique within a chapter");
        }
    }

    public boolean isPublished() {
        return this.status == ChapterStatus.PUBLISHED;
    }

    public WorkId getWorkId() {
        return workId;
    }

    public ChapterNumber getChapterNumber() {
        return chapterNumber;
    }

    public String getTitle() {
        return title;
    }

    public ChapterStatus getStatus() {
        return status;
    }

    public List<PageAsset> getPages() {
        return Collections.unmodifiableList(pages);
    }

    /// The team credited for this chapter: every chapter is one team's version of it.
    public TeamId getTeamId() {
        return teamId;
    }

    public Instant getCreatedAt() {
        return createdAt;
    }

    public @Nullable Instant getPublishedAt() {
        return publishedAt;
    }

    public Instant getUpdatedAt() {
        return updatedAt;
    }
}
