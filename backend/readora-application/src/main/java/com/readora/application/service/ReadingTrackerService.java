package com.readora.application.service;

import com.readora.application.port.in.TrackReadingUseCase;
import com.readora.application.port.out.ChapterReadRepositoryPort;
import com.readora.application.port.out.ChapterRepositoryPort;
import com.readora.application.port.out.WorkRepositoryPort;
import com.readora.domain.common.NotFoundException;
import com.readora.domain.common.UserId;
import com.readora.domain.library.ChapterRead;
import com.readora.domain.work.Chapter;
import com.readora.domain.scanlation.TeamId;
import com.readora.domain.work.ChapterId;
import com.readora.domain.work.ChapterNumber;
import com.readora.domain.work.ReadingOrder;
import com.readora.domain.work.Work;
import com.readora.domain.work.WorkId;
import org.jspecify.annotations.Nullable;

import java.time.Clock;
import java.time.Instant;
import java.util.Comparator;
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
        ReadingOrder order = ReadingOrder.of(chapterRepository.findPublishedRefsByWorkId(chapter.getWorkId()));
        Map<ChapterId, ChapterRead> reads = chapterReadRepository.findByUserAndWork(userId, chapter.getWorkId()).stream()
                .collect(Collectors.toMap(ChapterRead::chapterId, Function.identity()));
        List<ChapterNumber> earlier = order.numbers().stream()
                .takeWhile(number -> !number.equals(chapter.getChapterNumber()))
                .filter(number -> order.versionsOf(number).stream().noneMatch(version -> isFinished(reads.get(version.id()))))
                .toList();
        Instant now = clock.instant();
        for (int i = 0; i < earlier.size(); i++) {
            ChapterNumber number = earlier.get(i);
            // A version the reader already opened is the one they were reading; otherwise the same team's, else the oldest.
            Optional<ChapterRead> started = order.versionsOf(number).stream().map(version -> reads.get(version.id())).filter(Objects::nonNull).findFirst();
            if (started.isPresent()) {
                ChapterRead read = started.get();
                chapterReadRepository.save(new ChapterRead(userId, read.workId(), read.chapterId(), read.chapterNumber(), read.readAt(), true));
            } else {
                // Staggered by a millisecond so the history's "Continue" points at the highest chapter marked.
                Instant at = now.minusMillis(earlier.size() - i);
                ChapterId version = order.pick(number, chapter.getTeamId()).orElseThrow().id();
                chapterReadRepository.save(new ChapterRead(userId, chapter.getWorkId(), version, number, at, true));
            }
        }
        return progress(userId, chapter.getWorkId());
    }

    @Override
    public WorkProgress progress(UserId userId, WorkId workId) {
        ReadingOrder order = ReadingOrder.of(chapterRepository.findPublishedRefsByWorkId(workId));
        List<ChapterRead> reads = chapterReadRepository.findByUserAndWork(userId, workId).stream()
                .filter(read -> order.find(read.chapterId()).isPresent())
                .toList();
        Set<ChapterId> finished = reads.stream().filter(ChapterRead::finished).map(ChapterRead::chapterId).collect(Collectors.toSet());
        Set<ChapterNumber> finishedNumbers = finished.stream()
                .flatMap(id -> order.find(id).stream())
                .map(ReadingOrder.Version::number)
                .collect(Collectors.toSet());

        List<ChapterNumber> numbers = order.numbers();
        int lastFinished = -1;
        for (int i = 0; i < numbers.size(); i++) {
            if (finishedNumbers.contains(numbers.get(i))) {
                lastFinished = i;
            }
        }
        ChapterNumber nextNumber = lastFinished + 1 < numbers.size() ? numbers.get(lastFinished + 1) : null;
        TeamId lastTeam = reads.stream().max(Comparator.comparing(ChapterRead::readAt))
                .flatMap(read -> order.find(read.chapterId()))
                .map(ReadingOrder.Version::teamId)
                .orElse(null);
        ChapterId next = nextNumber != null ? order.pick(nextNumber, lastTeam).map(ReadingOrder.Version::id).orElse(null) : null;
        return new WorkProgress(workId, finished, finishedNumbers, nextNumber, next);
    }

    private static boolean isFinished(@Nullable ChapterRead read) {
        return read != null && read.finished();
    }
}
