package com.readora.domain.scanlation;

import com.readora.domain.common.DomainEvent;

import java.time.Instant;

public record TaskStageAdvancedEvent(
        ProjectId projectId,
        TaskId taskId,
        WorkflowStage fromStage,
        WorkflowStage toStage,
        Instant occurredOn
) implements DomainEvent {
    public static TaskStageAdvancedEvent now(ProjectId projectId, TaskId taskId, WorkflowStage fromStage, WorkflowStage toStage) {
        return new TaskStageAdvancedEvent(projectId, taskId, fromStage, toStage, Instant.now());
    }
}
