package com.readora.application.port.out;

import com.readora.domain.scanlation.TeamId;
import com.readora.domain.work.Chapter;
import com.readora.domain.work.ChapterId;
import com.readora.domain.work.ChapterNumber;
import com.readora.domain.work.ReadingOrder;
import com.readora.domain.work.WorkId;

import java.util.Comparator;
import java.util.List;
import java.util.Objects;
import java.util.Optional;

public interface ChapterRepositoryPort {
    Optional<Chapter> findById(ChapterId id);
    List<Chapter> findByWorkId(WorkId workId);
    Chapter save(Chapter chapter);

    /// Whether the team has a published chapter: until it has, its chapters are reviewed first (US-11).
    boolean hasPublishedChapter(TeamId teamId);

    /// Chapters waiting for a moderator, the longest-waiting first.
    List<Chapter> findWaitingForReview(int limit);

    /// A team's version of a chapter number, published or not: a number exists at most once per team.
    default Optional<Chapter> findByWorkIdAndChapterNumberAndTeam(WorkId workId, ChapterNumber chapterNumber, TeamId teamId) {
        return findByWorkId(workId).stream()
                .filter(c -> c.getChapterNumber().equals(chapterNumber) && c.getTeamId().equals(teamId))
                .findFirst();
    }

    /// The published versions of a work without their pages, for navigation and progress.
    /// Adapters should override this with a query that doesn't load pages.
    default List<ReadingOrder.Version> findPublishedRefsByWorkId(WorkId workId) {
        return findPublishedByWorkId(workId).stream()
                .map(c -> new ReadingOrder.Version(c.getId(), c.getChapterNumber(), c.getTeamId(), Objects.requireNonNull(c.getPublishedAt())))
                .toList();
    }

    /// Published chapters of a work in reading order (numeric chapter order); versions of one number are next to each
    /// other, the first one published first.
    default List<Chapter> findPublishedByWorkId(WorkId workId) {
        return findByWorkId(workId).stream().filter(Chapter::isPublished).sorted(READING_ORDER).toList();
    }

    Comparator<Chapter> READING_ORDER = Comparator.comparing(Chapter::getChapterNumber)
            .thenComparing(c -> c.getChapterNumber().value())
            .thenComparing(Chapter::getPublishedAt, Comparator.nullsLast(Comparator.naturalOrder()))
            .thenComparing(c -> c.getId().value());
}
