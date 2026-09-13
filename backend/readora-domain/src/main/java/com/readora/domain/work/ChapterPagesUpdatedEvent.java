package com.readora.domain.work;

import com.readora.domain.common.DomainEvent;
import java.time.Instant;

public record ChapterPagesUpdatedEvent(
        ChapterId chapterId,
        int pageCount,
        Instant occurredOn
) implements DomainEvent {
    public static ChapterPagesUpdatedEvent now(ChapterId chapterId, int pageCount) {
        return new ChapterPagesUpdatedEvent(chapterId, pageCount, Instant.now());
    }
}
