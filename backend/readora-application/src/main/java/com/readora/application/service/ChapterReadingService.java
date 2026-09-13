package com.readora.application.service;

import com.readora.application.port.in.ReadChapterUseCase;
import com.readora.application.port.out.ChapterRepositoryPort;
import com.readora.application.port.out.EventPublisherPort;
import com.readora.application.port.out.StoragePort;
import com.readora.domain.common.DomainValidationException;
import com.readora.domain.work.Chapter;
import com.readora.domain.work.ChapterId;
import com.readora.domain.work.PageAsset;
import com.readora.domain.work.UserId;

import java.util.List;
import java.util.Objects;

public class ChapterReadingService implements ReadChapterUseCase {
    private final ChapterRepositoryPort chapterRepository;
    private final StoragePort storagePort;
    private final EventPublisherPort eventPublisher;

    public ChapterReadingService(ChapterRepositoryPort chapterRepository, StoragePort storagePort, EventPublisherPort eventPublisher) {
        this.chapterRepository = Objects.requireNonNull(chapterRepository, "ChapterRepositoryPort cannot be null");
        this.storagePort = Objects.requireNonNull(storagePort, "StoragePort cannot be null");
        this.eventPublisher = Objects.requireNonNull(eventPublisher, "EventPublisherPort cannot be null");
    }

    @Override
    public Chapter readChapter(ChapterId chapterId, UserId readerId, String viewMode) {
        Chapter chapter = chapterRepository.findById(chapterId)
                .orElseThrow(() -> new DomainValidationException("Chapter not found with id: " + chapterId));

        if (!chapter.isPublished()) {
            throw new DomainValidationException("CHAPTER_NOT_PUBLISHED: Chapter is not available for public reading.");
        }

        // Enrich page assets with CDN URLs if missing
        List<PageAsset> enrichedPages = chapter.getPages().stream()
                .map(p -> {
                    if (p.cdnUrl() == null || p.cdnUrl().isBlank()) {
                        String cdnUrl = storagePort.getPublicCdnUrl(p.storageKey());
                        return new PageAsset(p.pageNumber(), p.storageKey(), cdnUrl, p.width(), p.height());
                    }
                    return p;
                }).toList();

        chapter.updatePages(enrichedPages);
        chapter.pollDomainEvents().forEach(eventPublisher::publish);
        return chapter;
    }
}
