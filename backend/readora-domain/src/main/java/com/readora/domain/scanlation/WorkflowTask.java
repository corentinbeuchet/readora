package com.readora.domain.scanlation;

import com.readora.domain.common.Entity;
import com.readora.domain.work.ChapterNumber;
import com.readora.domain.common.UserId;

import java.time.Instant;
import java.util.Objects;

public class WorkflowTask extends Entity<TaskId> {
    private final ChapterNumber chapterNumber;
    private WorkflowStage stage;
    private TaskStatus status;
    private UserId assigneeId;
    private String assetPackageUrl;
    private int pageCount;
    private Instant updatedAt;

    public WorkflowTask(TaskId id, ChapterNumber chapterNumber, WorkflowStage stage, TaskStatus status, UserId assigneeId, String assetPackageUrl, int pageCount, Instant updatedAt) {
        super(id);
        this.chapterNumber = Objects.requireNonNull(chapterNumber, "ChapterNumber cannot be null");
        this.stage = Objects.requireNonNull(stage, "WorkflowStage cannot be null");
        this.status = Objects.requireNonNull(status, "TaskStatus cannot be null");
        this.assigneeId = assigneeId;
        this.assetPackageUrl = assetPackageUrl;
        this.pageCount = pageCount;
        this.updatedAt = updatedAt != null ? updatedAt : Instant.now();
    }

    public static WorkflowTask create(ChapterNumber chapterNumber) {
        return create(chapterNumber, null, 0);
    }

    public static WorkflowTask create(ChapterNumber chapterNumber, String assetUrl, int pageCount) {
        return new WorkflowTask(TaskId.generate(), chapterNumber, WorkflowStage.RAW_UPLOADED, TaskStatus.PENDING, null, assetUrl, pageCount, Instant.now());
    }

    public void assignTo(UserId userId) {
        this.assigneeId = userId;
        this.status = TaskStatus.IN_PROGRESS;
        this.updatedAt = Instant.now();
    }

    public void submitAssetPackage(String assetPackageUrl, int pageCount) {
        this.assetPackageUrl = assetPackageUrl;
        this.pageCount = pageCount;
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

    public UserId getAssigneeId() {
        return assigneeId;
    }

    public String getAssetPackageUrl() {
        return assetPackageUrl;
    }

    public int getPageCount() {
        return pageCount;
    }

    public Instant getUpdatedAt() {
        return updatedAt;
    }
}
