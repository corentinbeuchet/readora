package com.readora.domain.scanlation;

import com.readora.domain.common.DomainEvent;
import com.readora.domain.work.ChapterNumber;

import java.time.Instant;

public record WorkflowCompletedEvent(
        ProjectId projectId,
        ChapterNumber chapterNumber,
        Instant occurredOn
) implements DomainEvent {
    public static WorkflowCompletedEvent now(ProjectId projectId, ChapterNumber chapterNumber) {
        return new WorkflowCompletedEvent(projectId, chapterNumber, Instant.now());
    }
}
