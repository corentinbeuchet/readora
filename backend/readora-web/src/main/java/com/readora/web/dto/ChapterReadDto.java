package com.readora.web.dto;

import com.readora.domain.library.ChapterRead;

import java.time.Instant;
import java.util.UUID;

public record ChapterReadDto(UUID chapterId, UUID workId, String chapterNumber, Instant readAt, boolean finished) {
    public static ChapterReadDto fromDomain(ChapterRead read) {
        return new ChapterReadDto(read.chapterId().value(), read.workId().value(), read.chapterNumber().value(), read.readAt(), read.finished());
    }
}
