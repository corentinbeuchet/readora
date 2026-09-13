package com.readora.domain.work;

import com.readora.domain.common.DomainEvent;
import java.time.Instant;

public record ChapterPublishedEvent(
        ChapterId chapterId,
        WorkId workId,
        ChapterNumber chapterNumber,
        Instant occurredOn
) implements DomainEvent {
    public static ChapterPublishedEvent now(ChapterId chapterId, WorkId workId, ChapterNumber chapterNumber) {
        return new ChapterPublishedEvent(chapterId, workId, chapterNumber, Instant.now());
    }
}
