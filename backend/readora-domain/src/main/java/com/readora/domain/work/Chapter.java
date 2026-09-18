package com.readora.domain.work;

import com.readora.domain.common.AggregateRoot;
import com.readora.domain.common.DomainValidationException;
import com.readora.domain.scanlation.ProjectId;

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
    private ProjectId scanlationProjectId;
    private final Instant createdAt;
    private Instant publishedAt;
    private Instant updatedAt;

    public Chapter(ChapterId id, WorkId workId, ChapterNumber chapterNumber, String title, ChapterStatus status, List<PageAsset> pages, ProjectId scanlationProjectId, Instant createdAt, Instant publishedAt, Instant updatedAt) {
        super(id);
        this.workId = Objects.requireNonNull(workId, "WorkId cannot be null");
        this.chapterNumber = Objects.requireNonNull(chapterNumber, "ChapterNumber cannot be null");
        this.title = title != null ? title : "";
        this.status = Objects.requireNonNull(status, "ChapterStatus cannot be null");
        if (pages != null) {
            this.pages.addAll(pages);
        }
        this.scanlationProjectId = scanlationProjectId;
        this.createdAt = createdAt != null ? createdAt : Instant.now();
        this.publishedAt = publishedAt;
        this.updatedAt = updatedAt != null ? updatedAt : this.createdAt;
    }

    public static Chapter createDraft(WorkId workId, ChapterNumber chapterNumber, String title, ProjectId scanlationProjectId) {
        Instant now = Instant.now();
        return new Chapter(ChapterId.generate(), workId, chapterNumber, title, ChapterStatus.DRAFT, List.of(), scanlationProjectId, now, null, now);
    }

    public static Chapter createPublished(WorkId workId, ChapterNumber chapterNumber, String title, List<PageAsset> pages, ProjectId scanlationProjectId, UserId publisherId) {
        if (pages == null || pages.isEmpty()) {
            throw new DomainValidationException("Cannot publish chapter with zero pages.");
        }
        requireUniquePageNumbers(pages);
        Instant now = Instant.now();
        Chapter chapter = new Chapter(ChapterId.generate(), workId, chapterNumber, title, ChapterStatus.PUBLISHED, pages, scanlationProjectId, now, now, now);
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
        registerEvent(ChapterPagesUpdatedEvent.now(this.id, this.pages.size()));
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

    public ProjectId getScanlationProjectId() {
        return scanlationProjectId;
    }

    public Instant getCreatedAt() {
        return createdAt;
    }

    public Instant getPublishedAt() {
        return publishedAt;
    }

    public Instant getUpdatedAt() {
        return updatedAt;
    }
}
