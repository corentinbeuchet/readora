package com.readora.web.dto;

import com.readora.domain.scanlation.WorkflowTask;
import org.jspecify.annotations.Nullable;

import java.time.Instant;
import java.util.UUID;

/// A task of a board, with its page count but not its pages: a board keeps every task it ever had, and a member's
/// browser asks for a task's pages (`GET …/tasks/{taskId}/pages`) when they open it.
public record WorkflowTaskDto(
        UUID id,
        String chapterNumber,
        String stage,
        String status,
        @Nullable String assigneeId,
        /// `null` when nobody holds the task (or the account no longer exists)
        @Nullable String assigneeUsername,
        int pageCount,
        Instant updatedAt
) {
    public static WorkflowTaskDto fromDomain(WorkflowTask task, @Nullable String assigneeUsername) {
        return new WorkflowTaskDto(
                task.getId().value(),
                task.getChapterNumber().value(),
                task.getStage().name(),
                task.getStatus().name(),
                task.getAssigneeId() != null ? task.getAssigneeId().value() : null,
                assigneeUsername,
                task.getPageCount(),
                task.getUpdatedAt()
        );
    }
}
