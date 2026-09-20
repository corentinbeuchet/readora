package com.readora.web.dto;

import com.readora.application.port.in.DiscoverUseCase.Release;

import java.time.Instant;
import java.util.UUID;

public record ReleaseDto(WorkSummaryDto work, TeamRefDto team, UUID chapterId, String chapterNumber, String chapterTitle, Instant publishedAt, boolean read) {
    public static ReleaseDto fromDomain(Release release) {
        return new ReleaseDto(WorkSummaryDto.fromDomain(release.work()), TeamRefDto.fromDomain(release.team()), release.chapterId().value(), release.chapterNumber().value(),
                release.chapterTitle(), release.publishedAt(), release.read());
    }
}
