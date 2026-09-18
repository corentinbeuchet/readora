package com.readora.web.dto;

import com.readora.domain.report.PageReport;
import org.jspecify.annotations.Nullable;

import java.time.Instant;
import java.util.UUID;

/// The reporter is not exposed: the team fixes the page, it doesn't need to know who reported it.
public record PageReportDto(UUID id, UUID chapterId, UUID workId, String chapterNumber, int pageNumber, String reason,
                            String status, Instant createdAt, @Nullable Instant resolvedAt) {
    public static PageReportDto fromDomain(PageReport report) {
        return new PageReportDto(report.getId().value(), report.getChapterId().value(), report.getWorkId().value(),
                report.getChapterNumber().value(), report.getPageNumber(), report.getReason().name(), report.getStatus().name(),
                report.getCreatedAt(), report.getResolvedAt());
    }
}
