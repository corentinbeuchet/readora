package com.readora.application.service;

import com.readora.application.port.in.ManageLibraryUseCase;
import com.readora.application.port.out.ChapterReadRepositoryPort;
import com.readora.application.port.out.LibraryRepositoryPort;
import com.readora.application.port.out.WorkRepositoryPort;
import com.readora.domain.common.NotFoundException;
import com.readora.domain.common.UserId;
import com.readora.domain.library.LibraryEntry;
import com.readora.domain.social.ReadingStatus;
import com.readora.domain.work.Work;
import com.readora.domain.work.WorkId;
import org.jspecify.annotations.Nullable;

import java.time.Clock;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Optional;
import java.util.function.Function;
import java.util.stream.Collectors;

public class LibraryService implements ManageLibraryUseCase {

    private final LibraryRepositoryPort libraryRepository;
    private final WorkRepositoryPort workRepository;
    private final ChapterReadRepositoryPort chapterReadRepository;
    private final Clock clock;

    public LibraryService(LibraryRepositoryPort libraryRepository, WorkRepositoryPort workRepository,
                          ChapterReadRepositoryPort chapterReadRepository, Clock clock) {
        this.libraryRepository = Objects.requireNonNull(libraryRepository, "LibraryRepositoryPort cannot be null");
        this.workRepository = Objects.requireNonNull(workRepository, "WorkRepositoryPort cannot be null");
        this.chapterReadRepository = Objects.requireNonNull(chapterReadRepository, "ChapterReadRepositoryPort cannot be null");
        this.clock = Objects.requireNonNull(clock, "Clock cannot be null");
    }

    @Override
    public LibraryEntry save(UserId userId, WorkId workId, @Nullable ReadingStatus status) {
        if (workRepository.findById(workId).isEmpty()) {
            throw new NotFoundException("Work", workId);
        }
        LibraryEntry entry = libraryRepository.find(userId, workId)
                .map(existing -> {
                    if (status != null) {
                        existing.changeStatus(status, clock.instant());
                    }
                    return existing;
                })
                .orElseGet(() -> LibraryEntry.add(userId, workId, status != null ? status : ReadingStatus.READING, clock.instant()));
        return libraryRepository.save(entry);
    }

    @Override
    public Optional<LibraryEntry> find(UserId userId, WorkId workId) {
        return libraryRepository.find(userId, workId);
    }

    @Override
    public void remove(UserId userId, WorkId workId) {
        if (!libraryRepository.delete(userId, workId)) {
            throw new NotFoundException("Library entry", workId);
        }
    }

    @Override
    public List<LibraryItem> list(UserId userId, @Nullable ReadingStatus status) {
        List<LibraryEntry> entries = libraryRepository.findByUser(userId, status);
        if (entries.isEmpty()) {
            return List.of();
        }
        List<WorkId> workIds = entries.stream().map(LibraryEntry::getWorkId).toList();
        Map<WorkId, Work> works = workRepository.findAllById(workIds).stream()
                .collect(Collectors.toMap(Work::getId, Function.identity()));
        Map<WorkId, Long> newChapters = chapterReadRepository.countChaptersPublishedSinceLastRead(userId, workIds);
        return entries.stream()
                .flatMap(entry -> Optional.ofNullable(works.get(entry.getWorkId()))
                        .map(work -> new LibraryItem(work, entry, newChapters.getOrDefault(entry.getWorkId(), 0L)))
                        .stream())
                .toList();
    }
}
