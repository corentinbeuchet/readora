package com.readora.web.dto;

import com.readora.application.port.in.ReadChapterUseCase.ChapterReading;
import com.readora.application.port.in.ReadChapterUseCase.ChapterVersion;
import com.readora.application.port.in.ReadChapterUseCase.Neighbour;
import com.readora.domain.work.Chapter;
import com.readora.domain.work.Work;
import org.jspecify.annotations.Nullable;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

/// @param work the series (reader view only: format for the default reading mode, title for the header)
/// @param team the team credited for the chapter (reader view only)
/// @param versions every team's version of this chapter number, this one included (reader view only, else empty)
/// @param previous the chapter number before this one with its versions (reader view only; `null` for the first)
/// @param next the chapter number after this one with its versions (reader view only; `null` for the latest)
/// @param previousChapterId the version of `previous` to open by default: the same team's when it has one
/// @param nextChapterId the version of `next` to open by default: the same team's when it has one
public record ChapterDto(
        UUID id,
        UUID workId,
        String chapterNumber,
        String title,
        String status,
        List<PageAssetDto> pages,
        @Nullable WorkRef work,
        @Nullable TeamRefDto team,
        List<Version> versions,
        @Nullable NeighbourDto previous,
        @Nullable NeighbourDto next,
        @Nullable UUID previousChapterId,
        @Nullable UUID nextChapterId
) {
    public record WorkRef(UUID id, String title, String type) {
        static WorkRef fromDomain(Work work) {
            return new WorkRef(work.getId().value(), work.getTitle(), work.getType().name());
        }
    }

    public record Version(UUID chapterId, TeamRefDto team) {
        static Version fromDomain(ChapterVersion version) {
            return new Version(version.chapterId().value(), TeamRefDto.fromDomain(version.team()));
        }
    }

    public record NeighbourDto(String chapterNumber, List<Version> versions) {
        static @Nullable NeighbourDto fromDomain(@Nullable Neighbour neighbour) {
            return neighbour != null
                    ? new NeighbourDto(neighbour.number().value(), neighbour.versions().stream().map(Version::fromDomain).toList())
                    : null;
        }
    }

    public static ChapterDto fromDomain(Chapter chapter) {
        return of(chapter, null, null, List.of(), null, null);
    }

    public static ChapterDto fromReading(ChapterReading reading) {
        return of(reading.chapter(), WorkRef.fromDomain(reading.work()), TeamRefDto.fromDomain(reading.team()),
                reading.versions().stream().map(Version::fromDomain).toList(), reading.previous(), reading.next());
    }

    private static ChapterDto of(Chapter chapter, @Nullable WorkRef work, @Nullable TeamRefDto team, List<Version> versions,
                                 @Nullable Neighbour previous, @Nullable Neighbour next) {
        List<PageAssetDto> pageDtos = chapter.getPages().stream()
                .map(PageAssetDto::fromDomain)
                .toList();

        return new ChapterDto(
                chapter.getId().value(),
                chapter.getWorkId().value(),
                chapter.getChapterNumber().value(),
                chapter.getTitle(),
                chapter.getStatus().name(),
                pageDtos,
                work,
                team,
                versions,
                NeighbourDto.fromDomain(previous),
                NeighbourDto.fromDomain(next),
                Optional.ofNullable(previous).map(n -> n.defaultChapterId().value()).orElse(null),
                Optional.ofNullable(next).map(n -> n.defaultChapterId().value()).orElse(null)
        );
    }
}
