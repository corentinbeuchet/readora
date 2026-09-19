package com.readora.application.service;

import com.readora.application.port.in.ReadChapterUseCase;
import com.readora.application.port.out.ChapterRepositoryPort;
import com.readora.application.port.out.ChapterRepositoryPort.PublishedChapterRef;
import com.readora.application.port.out.StoragePort;
import com.readora.application.port.out.WorkRepositoryPort;
import com.readora.domain.common.DomainValidationException;
import com.readora.domain.common.NotFoundException;
import com.readora.domain.work.Chapter;
import com.readora.domain.work.ChapterId;
import com.readora.domain.work.PageAsset;
import com.readora.domain.work.Work;
import com.readora.domain.common.UserId;

import java.util.List;
import java.util.Objects;

public class ChapterReadingService implements ReadChapterUseCase {
    private final ChapterRepositoryPort chapterRepository;
    private final WorkRepositoryPort workRepository;
    private final StoragePort storagePort;

    public ChapterReadingService(ChapterRepositoryPort chapterRepository, WorkRepositoryPort workRepository, StoragePort storagePort) {
        this.chapterRepository = Objects.requireNonNull(chapterRepository, "ChapterRepositoryPort cannot be null");
        this.workRepository = Objects.requireNonNull(workRepository, "WorkRepositoryPort cannot be null");
        this.storagePort = Objects.requireNonNull(storagePort, "StoragePort cannot be null");
    }

    @Override
    public ChapterReading readChapter(ChapterId chapterId, UserId readerId, String viewMode) {
        Chapter chapter = chapterRepository.findById(chapterId)
                .orElseThrow(() -> new NotFoundException("Chapter", chapterId));

        if (!chapter.isPublished()) {
            throw new DomainValidationException("CHAPTER_NOT_PUBLISHED: Chapter is not available for public reading.");
        }

        // Enrich page assets with CDN URLs if missing
        List<PageAsset> enrichedPages = chapter.getPages().stream()
                .map(p -> {
                    if (p.cdnUrl() == null || p.cdnUrl().isBlank()) {
                        String cdnUrl = storagePort.getPublicCdnUrl(p.storageKey());
                        return p.withCdnUrl(cdnUrl);
                    }
                    return p;
                }).toList();

        // A read returns a view with public URLs; it never mutates the aggregate or emits domain events.
        Chapter view = new Chapter(chapter.getId(), chapter.getWorkId(), chapter.getChapterNumber(), chapter.getTitle(),
                chapter.getStatus(), enrichedPages, chapter.getScanlationProjectId(), chapter.getCreatedAt(),
                chapter.getPublishedAt(), chapter.getUpdatedAt());
        Work work = workRepository.findById(chapter.getWorkId())
                .orElseThrow(() -> new NotFoundException("Work", chapter.getWorkId()));

        List<PublishedChapterRef> published = chapterRepository.findPublishedRefsByWorkId(chapter.getWorkId());
        int index = indexOf(published, chapterId);
        ChapterId previous = index > 0 ? published.get(index - 1).id() : null;
        ChapterId next = index >= 0 && index + 1 < published.size() ? published.get(index + 1).id() : null;
        return new ChapterReading(view, work, previous, next);
    }

    private static int indexOf(List<PublishedChapterRef> published, ChapterId chapterId) {
        for (int i = 0; i < published.size(); i++) {
            if (published.get(i).id().equals(chapterId)) {
                return i;
            }
        }
        return -1;
    }
}
