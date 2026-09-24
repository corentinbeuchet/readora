package com.readora.web.dto;

import com.readora.domain.work.Chapter;

import java.util.UUID;

/// Where a chapter stands after publishing or review (US-11): `PUBLISHED`, `PENDING_REVIEW` (a team's first, waiting for
/// a moderator) or `DRAFT` (sent back to its team).
public record ChapterStatusDto(UUID chapterId, String status) {
    public static ChapterStatusDto fromDomain(Chapter chapter) {
        return new ChapterStatusDto(chapter.getId().value(), chapter.getStatus().name());
    }
}
