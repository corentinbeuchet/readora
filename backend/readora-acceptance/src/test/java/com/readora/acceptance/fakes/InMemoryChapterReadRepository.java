package com.readora.acceptance.fakes;

import com.readora.application.port.out.ChapterReadRepositoryPort;
import com.readora.domain.common.UserId;
import com.readora.domain.library.ChapterRead;
import com.readora.domain.work.Chapter;
import com.readora.domain.work.ChapterId;
import com.readora.domain.work.WorkId;

import java.time.Instant;
import java.util.Collection;
import java.util.Comparator;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.concurrent.ConcurrentHashMap;
import java.util.stream.Collectors;

/// Same semantics as `ChapterReadRepositoryAdapter`; needs the chapters to count new ones.
public class InMemoryChapterReadRepository implements ChapterReadRepositoryPort {

    private final Map<String, ChapterRead> reads = new ConcurrentHashMap<>();
    private final InMemoryChapterRepository chapters;

    public InMemoryChapterReadRepository(InMemoryChapterRepository chapters) {
        this.chapters = chapters;
    }

    @Override
    public Optional<ChapterRead> find(UserId userId, ChapterId chapterId) {
        return Optional.ofNullable(reads.get(userId.value() + "|" + chapterId.value()));
    }

    @Override
    public ChapterRead save(ChapterRead read) {
        reads.put(read.userId().value() + "|" + read.chapterId().value(), read);
        return read;
    }

    @Override
    public List<ChapterRead> findByUserAndWork(UserId userId, WorkId workId) {
        return byUser(userId).filter(r -> r.workId().equals(workId)).toList();
    }

    @Override
    public List<ChapterRead> findLatestPerWork(UserId userId, int limit) {
        return byUser(userId)
                .collect(Collectors.toMap(ChapterRead::workId, r -> r,
                        (a, b) -> a.readAt().isAfter(b.readAt()) ? a : b))
                .values().stream()
                .sorted(Comparator.comparing(ChapterRead::readAt).reversed())
                .limit(limit)
                .toList();
    }

    @Override
    public Map<WorkId, Long> countChaptersPublishedSinceLastRead(UserId userId, Collection<WorkId> workIds) {
        Map<WorkId, Long> counts = new HashMap<>();
        for (WorkId workId : workIds) {
            Optional<Instant> lastRead = findByUserAndWork(userId, workId).stream().map(ChapterRead::readAt).max(Comparator.naturalOrder());
            lastRead.ifPresent(since -> {
                long count = chapters.findPublishedByWorkId(workId).stream()
                        .map(Chapter::getPublishedAt)
                        .filter(at -> at != null && at.isAfter(since))
                        .count();
                if (count > 0) {
                    counts.put(workId, count);
                }
            });
        }
        return counts;
    }

    /// Every read of the reader (fake-only helper for profile stats).
    public List<ChapterRead> allFor(UserId userId) {
        return byUser(userId).toList();
    }

    private java.util.stream.Stream<ChapterRead> byUser(UserId userId) {
        return reads.values().stream().filter(r -> r.userId().equals(userId));
    }
}
