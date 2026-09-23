package com.readora.web.dto;

import com.readora.domain.scanlation.WorkflowTask;
import org.jspecify.annotations.Nullable;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

public record WorkflowTaskDto(
        UUID id,
        String chapterNumber,
        String stage,
        String status,
        @Nullable String assigneeId,
        /// `null` when nobody holds the task (or the account no longer exists)
        @Nullable String assigneeUsername,
        int pageCount,
        List<PageAssetDto> pages,
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
                task.getPages().stream().map(PageAssetDto::fromDomain).toList(),
                task.getUpdatedAt()
        );
    }
}
