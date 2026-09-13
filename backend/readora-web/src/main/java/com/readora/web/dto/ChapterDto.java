package com.readora.web.dto;

import com.readora.domain.work.Chapter;
import java.util.List;
import java.util.UUID;

public record ChapterDto(
        UUID id,
        UUID workId,
        String chapterNumber,
        String title,
        String status,
        List<PageAssetDto> pages
) {
    public static ChapterDto fromDomain(Chapter chapter) {
        List<PageAssetDto> pageDtos = chapter.getPages().stream()
                .map(p -> new PageAssetDto(p.pageNumber(), p.storageKey(), p.cdnUrl(), p.width(), p.height()))
                .toList();

        return new ChapterDto(
                chapter.getId().value(),
                chapter.getWorkId().value(),
                chapter.getChapterNumber().value(),
                chapter.getTitle(),
                chapter.getStatus().name(),
                pageDtos
        );
    }
}
