package com.readora.web.dto;

import com.readora.application.port.in.ReadChapterUseCase.ChapterReading;
import com.readora.domain.work.Chapter;
import com.readora.domain.work.ChapterId;
import com.readora.domain.work.Work;
import org.jspecify.annotations.Nullable;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

/// @param work the series (reader view only: format for the default reading mode, title for the header)
/// @param previousChapterId previous published chapter (reader view only; `null` for the first chapter)
/// @param nextChapterId next published chapter (reader view only; `null` for the latest chapter)
public record ChapterDto(
        UUID id,
        UUID workId,
        String chapterNumber,
        String title,
        String status,
        List<PageAssetDto> pages,
        @Nullable UUID scanlationProjectId,
        @Nullable WorkRef work,
        @Nullable UUID previousChapterId,
        @Nullable UUID nextChapterId
) {
    public record WorkRef(UUID id, String title, String type) {
        static WorkRef fromDomain(Work work) {
            return new WorkRef(work.getId().value(), work.getTitle(), work.getType().name());
        }
    }

    public static ChapterDto fromDomain(Chapter chapter) {
        return of(chapter, null, null, null);
    }

    public static ChapterDto fromReading(ChapterReading reading) {
        return of(reading.chapter(), WorkRef.fromDomain(reading.work()), reading.previousChapterId(), reading.nextChapterId());
    }

    private static ChapterDto of(Chapter chapter, @Nullable WorkRef work, @Nullable ChapterId previous, @Nullable ChapterId next) {
        List<PageAssetDto> pageDtos = chapter.getPages().stream()
                .map(p -> new PageAssetDto(p.pageNumber(), p.storageKey(), p.cdnUrl(), p.width(), p.height()))
                .toList();

        return new ChapterDto(
                chapter.getId().value(),
                chapter.getWorkId().value(),
                chapter.getChapterNumber().value(),
                chapter.getTitle(),
                chapter.getStatus().name(),
                pageDtos,
                Optional.ofNullable(chapter.getScanlationProjectId()).map(id -> id.value()).orElse(null),
                work,
                Optional.ofNullable(previous).map(ChapterId::value).orElse(null),
                Optional.ofNullable(next).map(ChapterId::value).orElse(null)
        );
    }
}
