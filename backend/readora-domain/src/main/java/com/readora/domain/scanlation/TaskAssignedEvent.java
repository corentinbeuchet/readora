package com.readora.domain.scanlation;

import com.readora.domain.common.DomainEvent;
import com.readora.domain.work.UserId;

import java.time.Instant;

public record TaskAssignedEvent(
        ProjectId projectId,
        TaskId taskId,
        UserId assigneeId,
        WorkflowStage stage,
        Instant occurredOn
) implements DomainEvent {
    public static TaskAssignedEvent now(ProjectId projectId, TaskId taskId, UserId assigneeId, WorkflowStage stage) {
        return new TaskAssignedEvent(projectId, taskId, assigneeId, stage, Instant.now());
    }
}
