package com.readora.web.dto;

import com.readora.domain.work.Chapter;
import org.jspecify.annotations.Nullable;

import java.time.Instant;
import java.util.UUID;

public record ChapterSummaryDto(
        UUID id,
        UUID workId,
        String chapterNumber,
        String title,
        String status,
        int pageCount,
        @Nullable Instant publishedAt
) {
    public static ChapterSummaryDto fromDomain(Chapter chapter) {
        return new ChapterSummaryDto(
                chapter.getId().value(),
                chapter.getWorkId().value(),
                chapter.getChapterNumber().value(),
                chapter.getTitle(),
                chapter.getStatus().name(),
                chapter.getPages().size(),
                chapter.getPublishedAt()
        );
    }
}
