package com.readora.web.dto;

import com.readora.domain.scanlation.WorkflowTask;
import org.jspecify.annotations.Nullable;
import java.time.Instant;
import java.util.UUID;

public record WorkflowTaskDto(
        UUID id,
        String chapterNumber,
        String stage,
        String status,
        @Nullable String assigneeId,
        @Nullable String assetPackageUrl,
        int pageCount,
        Instant updatedAt
) {
    public static WorkflowTaskDto fromDomain(WorkflowTask task) {
        return new WorkflowTaskDto(
                task.getId().value(),
                task.getChapterNumber().value(),
                task.getStage().name(),
                task.getStatus().name(),
                task.getAssigneeId() != null ? task.getAssigneeId().value() : null,
                task.getAssetPackageUrl(),
                task.getPageCount(),
                task.getUpdatedAt()
        );
    }
}
