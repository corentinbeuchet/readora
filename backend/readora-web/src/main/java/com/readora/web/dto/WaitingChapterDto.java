package com.readora.web.dto;

import com.readora.application.port.in.ReviewChaptersUseCase.WaitingChapter;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

/// A team's first chapter waiting for a moderator (US-11), with its pages to look through.
public record WaitingChapterDto(UUID chapterId, SeriesRefDto work, TeamRefDto team, String chapterNumber, String title,
                                List<PageAssetDto> pages, Instant submittedAt) {
    public static WaitingChapterDto fromDomain(WaitingChapter waiting) {
        var chapter = waiting.chapter();
        return new WaitingChapterDto(chapter.getId().value(), new SeriesRefDto(chapter.getWorkId().value(), waiting.seriesTitle()),
                TeamRefDto.fromDomain(waiting.team()), chapter.getChapterNumber().value(), chapter.getTitle(),
                chapter.getPages().stream().map(PageAssetDto::fromDomain).toList(), chapter.getUpdatedAt());
    }
}
