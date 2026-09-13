package com.readora.domain.social;

import com.readora.domain.common.DomainEvent;
import com.readora.domain.work.ChapterId;
import com.readora.domain.work.UserId;
import com.readora.domain.work.WorkId;

import java.time.Instant;

public record ReadingProgressUpdatedEvent(
        UserId userId,
        WorkId workId,
        ChapterId chapterId,
        int pageIndex,
        Instant occurredOn
) implements DomainEvent {
    public static ReadingProgressUpdatedEvent now(UserId userId, WorkId workId, ChapterId chapterId, int pageIndex) {
        return new ReadingProgressUpdatedEvent(userId, workId, chapterId, pageIndex, Instant.now());
    }
}
