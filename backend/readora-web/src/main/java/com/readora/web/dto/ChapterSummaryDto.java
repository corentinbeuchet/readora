package com.readora.web.dto;

import com.readora.application.port.in.BrowseCatalogUseCase.CreditedChapter;
import com.readora.domain.work.ChapterStatus;
import com.readora.domain.work.ChapterSummary;
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
        ChapterSummary chapter = credited.chapter();
        return new ChapterSummaryDto(
                chapter.id().value(),
                chapter.workId().value(),
                chapter.chapterNumber().value(),
                chapter.title(),
                ChapterStatus.PUBLISHED.name(),
                chapter.pageCount(),
                chapter.publishedAt(),
                TeamRefDto.fromDomain(credited.team())
        );
    }
}
