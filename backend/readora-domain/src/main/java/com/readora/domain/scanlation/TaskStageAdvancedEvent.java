package com.readora.domain.scanlation;

import com.readora.domain.common.DomainEvent;
import com.readora.domain.common.UserId;

import java.time.Instant;

/// A task reached `stage` because of `by` (a raw chapter put on the board, or a stage's work submitted); the listener
/// tells the members who work on that stage.
public record TaskStageAdvancedEvent(ProjectId projectId, TaskId taskId, WorkflowStage stage, UserId by, Instant occurredOn)
        implements DomainEvent {
    public static TaskStageAdvancedEvent now(ProjectId projectId, TaskId taskId, WorkflowStage stage, UserId by) {
        return new TaskStageAdvancedEvent(projectId, taskId, stage, by, Instant.now());
    }
}
