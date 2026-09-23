package com.readora.domain.scanlation;

import com.readora.domain.common.DomainValidationException;
import com.readora.domain.common.Entity;
import com.readora.domain.common.UserId;
import com.readora.domain.work.ChapterNumber;
import com.readora.domain.work.PageAsset;
import org.jspecify.annotations.Nullable;

import java.time.Instant;
import java.util.ArrayList;
import java.util.Collections;
import java.util.Comparator;
import java.util.List;
import java.util.Objects;

public class WorkflowTask extends Entity<TaskId> {
    private final ChapterNumber chapterNumber;
    private WorkflowStage stage;
    private TaskStatus status;
    private @Nullable UserId assigneeId;
    /// The chapter's pages as the last stage left them (the raw pages first): what the next stage works on and what
    /// quality control publishes.
    private final List<PageAsset> pages = new ArrayList<>();
    private Instant updatedAt;

    public WorkflowTask(TaskId id, ChapterNumber chapterNumber, WorkflowStage stage, TaskStatus status, @Nullable UserId assigneeId,
                        List<PageAsset> pages, @Nullable Instant updatedAt) {
        super(id);
        this.chapterNumber = Objects.requireNonNull(chapterNumber, "ChapterNumber cannot be null");
        this.stage = Objects.requireNonNull(stage, "WorkflowStage cannot be null");
        this.status = Objects.requireNonNull(status, "TaskStatus cannot be null");
        this.assigneeId = assigneeId;
        this.pages.addAll(sortedUnique(pages));
        this.updatedAt = updatedAt != null ? updatedAt : Instant.now();
    }

    public static WorkflowTask create(ChapterNumber chapterNumber) {
        return create(chapterNumber, List.of());
    }

    public static WorkflowTask create(ChapterNumber chapterNumber, List<PageAsset> rawPages) {
        return new WorkflowTask(TaskId.generate(), chapterNumber, WorkflowStage.RAW_UPLOADED, TaskStatus.PENDING, null, rawPages, Instant.now());
    }

    /// @throws DomainValidationException if two pages share a number
    private static List<PageAsset> sortedUnique(List<PageAsset> pages) {
        Objects.requireNonNull(pages, "Pages cannot be null");
        if (pages.stream().map(PageAsset::pageNumber).distinct().count() != pages.size()) {
            throw new DomainValidationException("Two pages cannot have the same number");
        }
        return pages.stream().sorted(Comparator.comparingInt(PageAsset::pageNumber)).toList();
    }

    public void assignTo(UserId userId) {
        this.assigneeId = userId;
        this.status = TaskStatus.IN_PROGRESS;
        this.updatedAt = Instant.now();
    }

    /// The stage's work: its pages replace the ones it started from.
    ///
    /// @throws DomainValidationException if there is no page, or two pages share a number
    public void submitPages(List<PageAsset> newPages) {
        if (newPages == null || newPages.isEmpty()) {
            throw new DomainValidationException("Upload at least one page");
        }
        List<PageAsset> sorted = sortedUnique(newPages);
        this.pages.clear();
        this.pages.addAll(sorted);
        this.status = TaskStatus.COMPLETED;
        this.updatedAt = Instant.now();
    }

    public void advanceStage(WorkflowStage nextStage) {
        this.stage = nextStage;
        this.status = (nextStage == WorkflowStage.PUBLISHED) ? TaskStatus.COMPLETED : TaskStatus.PENDING;
        this.assigneeId = null;
        this.updatedAt = Instant.now();
    }

    public ChapterNumber getChapterNumber() {
        return chapterNumber;
    }

    public WorkflowStage getStage() {
        return stage;
    }

    public TaskStatus getStatus() {
        return status;
    }

    public @Nullable UserId getAssigneeId() {
        return assigneeId;
    }

    public List<PageAsset> getPages() {
        return Collections.unmodifiableList(pages);
    }

    public int getPageCount() {
        return pages.size();
    }

    public Instant getUpdatedAt() {
        return updatedAt;
    }
}
