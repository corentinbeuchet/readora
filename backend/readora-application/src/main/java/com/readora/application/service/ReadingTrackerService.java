package com.readora.application.service;

import com.readora.application.port.in.TrackReadingUseCase;
import com.readora.application.port.out.ChapterReadRepositoryPort;
import com.readora.application.port.out.ChapterRepositoryPort;
import com.readora.application.port.out.WorkRepositoryPort;
import com.readora.domain.common.NotFoundException;
import com.readora.domain.common.UserId;
import com.readora.domain.library.ChapterRead;
import com.readora.domain.work.Chapter;
import com.readora.domain.work.ChapterId;
import com.readora.domain.work.Work;
import com.readora.domain.work.WorkId;

import java.time.Clock;
import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Optional;
import java.util.Set;
import java.util.function.Function;
import java.util.stream.Collectors;

public class ReadingTrackerService implements TrackReadingUseCase {

    private final ChapterReadRepositoryPort chapterReadRepository;
    private final ChapterRepositoryPort chapterRepository;
    private final WorkRepositoryPort workRepository;
    private final Clock clock;

    public ReadingTrackerService(ChapterReadRepositoryPort chapterReadRepository, ChapterRepositoryPort chapterRepository,
                                 WorkRepositoryPort workRepository, Clock clock) {
        this.chapterReadRepository = Objects.requireNonNull(chapterReadRepository, "ChapterReadRepositoryPort cannot be null");
        this.chapterRepository = Objects.requireNonNull(chapterRepository, "ChapterRepositoryPort cannot be null");
        this.workRepository = Objects.requireNonNull(workRepository, "WorkRepositoryPort cannot be null");
        this.clock = Objects.requireNonNull(clock, "Clock cannot be null");
    }

    @Override
    public ChapterRead recordRead(UserId userId, ChapterId chapterId, boolean finished) {
        // An unpublished chapter is reported as missing, like the reader endpoint does.
        Chapter chapter = chapterRepository.findById(chapterId)
                .filter(Chapter::isPublished)
                .orElseThrow(() -> new NotFoundException("Chapter", chapterId));
        Instant now = clock.instant();
        ChapterRead read = chapterReadRepository.find(userId, chapterId)
                .map(existing -> existing.revisit(now, finished))
                .orElseGet(() -> new ChapterRead(userId, chapter.getWorkId(), chapterId, chapter.getChapterNumber(), now, finished));
        return chapterReadRepository.save(read);
    }

    @Override
    public List<HistoryItem> history(UserId userId, int limit) {
        int safeLimit = Math.min(Math.max(1, limit), MAX_HISTORY);
        List<ChapterRead> latest = chapterReadRepository.findLatestPerWork(userId, safeLimit);
        if (latest.isEmpty()) {
            return List.of();
        }
        Map<WorkId, Work> works = workRepository.findAllById(latest.stream().map(ChapterRead::workId).toList()).stream()
                .collect(Collectors.toMap(Work::getId, Function.identity()));
        return latest.stream()
                .flatMap(read -> Optional.ofNullable(works.get(read.workId())).map(work -> new HistoryItem(work, read)).stream())
                .toList();
    }

    @Override
    public WorkProgress markReadUpTo(UserId userId, ChapterId chapterId) {
        Chapter chapter = chapterRepository.findById(chapterId)
                .filter(Chapter::isPublished)
                .orElseThrow(() -> new NotFoundException("Chapter", chapterId));
        List<ChapterRepositoryPort.PublishedChapterRef> earlier = chapterRepository.findPublishedRefsByWorkId(chapter.getWorkId()).stream()
                .takeWhile(ref -> !ref.id().equals(chapterId))
                .toList();
        Map<ChapterId, ChapterRead> existing = chapterReadRepository.findByUserAndWork(userId, chapter.getWorkId()).stream()
                .collect(Collectors.toMap(ChapterRead::chapterId, Function.identity()));
        Instant now = clock.instant();
        for (int i = 0; i < earlier.size(); i++) {
            var ref = earlier.get(i);
            ChapterRead read = existing.get(ref.id());
            if (read == null) {
                // Staggered by a millisecond so the history's "Continue" points at the highest chapter marked.
                Instant at = now.minusMillis(earlier.size() - i);
                chapterReadRepository.save(new ChapterRead(userId, chapter.getWorkId(), ref.id(), ref.number(), at, true));
            } else if (!read.finished()) {
                chapterReadRepository.save(new ChapterRead(userId, read.workId(), read.chapterId(), read.chapterNumber(), read.readAt(), true));
            }
        }
        return progress(userId, chapter.getWorkId());
    }

    @Override
    public WorkProgress progress(UserId userId, WorkId workId) {
        List<Chapter> published = chapterRepository.findPublishedByWorkId(workId);
        Set<ChapterId> finished = chapterReadRepository.findByUserAndWork(userId, workId).stream()
                .filter(ChapterRead::finished)
                .map(ChapterRead::chapterId)
                .collect(Collectors.toSet());
        int lastFinished = -1;
        for (int i = 0; i < published.size(); i++) {
            if (finished.contains(published.get(i).getId())) {
                lastFinished = i;
            }
        }
        ChapterId next = lastFinished + 1 < published.size() ? published.get(lastFinished + 1).getId() : null;
        Set<ChapterId> publishedFinished = published.stream().map(Chapter::getId).filter(finished::contains).collect(Collectors.toSet());
        return new WorkProgress(workId, publishedFinished, next);
    }
}
