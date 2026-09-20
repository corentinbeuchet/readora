package com.readora.web.dto;

import com.readora.application.port.in.BrowseCatalogUseCase.CreditedChapter;
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
        @Nullable Instant publishedAt,
        TeamRefDto team
) {
    public static ChapterSummaryDto fromDomain(CreditedChapter credited) {
        Chapter chapter = credited.chapter();
        return new ChapterSummaryDto(
                chapter.getId().value(),
                chapter.getWorkId().value(),
                chapter.getChapterNumber().value(),
                chapter.getTitle(),
                chapter.getStatus().name(),
                chapter.getPages().size(),
                chapter.getPublishedAt(),
                TeamRefDto.fromDomain(credited.team())
        );
    }
}
