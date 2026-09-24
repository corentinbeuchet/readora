package com.readora.domain.work;

import com.readora.domain.scanlation.TeamId;

import java.time.Instant;
import java.util.Comparator;
import java.util.Objects;

/// A published chapter as a list shows it: its page count, not its pages (a series' chapter list would otherwise load
/// every page of every chapter).
public record ChapterSummary(ChapterId id, WorkId workId, ChapterNumber chapterNumber, String title, TeamId teamId, Instant publishedAt,
                             int pageCount) {

    /// The reading order of `ChapterRepositoryPort.READING_ORDER`: numeric chapter order, a number's versions together,
    /// the first published first.
    public static final Comparator<ChapterSummary> READING_ORDER = Comparator.comparing(ChapterSummary::chapterNumber)
            .thenComparing(summary -> summary.chapterNumber().value())
            .thenComparing(ChapterSummary::publishedAt)
            .thenComparing(summary -> summary.id().value());

    public ChapterSummary {
        Objects.requireNonNull(id, "ChapterId cannot be null");
        Objects.requireNonNull(workId, "WorkId cannot be null");
        Objects.requireNonNull(chapterNumber, "ChapterNumber cannot be null");
        Objects.requireNonNull(teamId, "TeamId cannot be null");
        Objects.requireNonNull(publishedAt, "publishedAt cannot be null");
        title = title != null ? title : "";
    }

    public static ChapterSummary of(Chapter chapter) {
        return new ChapterSummary(chapter.getId(), chapter.getWorkId(), chapter.getChapterNumber(), chapter.getTitle(), chapter.getTeamId(),
                Objects.requireNonNull(chapter.getPublishedAt(), "a summary is of a published chapter"), chapter.getPages().size());
    }
}
