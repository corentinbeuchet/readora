package com.readora.infrastructure.persistence.adapter;

import com.readora.application.port.out.ChapterRepositoryPort;
import com.readora.domain.scanlation.ProjectId;
import com.readora.domain.work.*;
import com.readora.infrastructure.persistence.entity.ChapterJpaEntity;
import com.readora.infrastructure.persistence.entity.PageAssetJpaEntity;
import com.readora.infrastructure.persistence.repository.SpringDataChapterRepository;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import java.util.*;
import java.util.stream.Collectors;

@Component
public class ChapterRepositoryAdapter implements ChapterRepositoryPort {

    private final SpringDataChapterRepository springDataRepository;

    public ChapterRepositoryAdapter(SpringDataChapterRepository springDataRepository) {
        this.springDataRepository = springDataRepository;
    }

    @Override
    public Optional<Chapter> findById(ChapterId id) {
        return springDataRepository.findById(id.value()).map(this::toDomain);
    }

    @Override
    public List<Chapter> findByWorkId(WorkId workId) {
        return springDataRepository.findByWorkId(workId.value()).stream()
                .map(this::toDomain)
                .toList();
    }

    @Override
    @Transactional
    public Chapter save(Chapter chapter) {
        ChapterJpaEntity existing = springDataRepository.findById(chapter.getId().value()).orElse(null);
        if (existing != null) {
            OptimisticLocking.verify(chapter, existing.getVersion(), "Chapter");
            existing.setWorkId(chapter.getWorkId().value());
            existing.setChapterNumber(chapter.getChapterNumber().value());
            existing.setTitle(chapter.getTitle());
            existing.setStatus(chapter.getStatus().name());
            existing.setScanlationProjectId(chapter.getScanlationProjectId() != null ? chapter.getScanlationProjectId().value() : null);
            existing.setPublishedAt(chapter.getPublishedAt());
            existing.setUpdatedAt(chapter.getUpdatedAt());

            // Update pages in place
            Map<Integer, PageAssetJpaEntity> existingPagesByNumber = existing.getPages().stream()
                    .collect(Collectors.toMap(PageAssetJpaEntity::getPageNumber, p -> p));

            existing.getPages().removeIf(ep -> chapter.getPages().stream().noneMatch(p -> p.pageNumber() == ep.getPageNumber()));

            for (PageAsset page : chapter.getPages()) {
                PageAssetJpaEntity pageEntity = existingPagesByNumber.get(page.pageNumber());
                if (pageEntity != null) {
                    pageEntity.setStorageKey(page.storageKey());
                    pageEntity.setCdnUrl(page.cdnUrl());
                    pageEntity.setWidth(page.width());
                    pageEntity.setHeight(page.height());
                } else {
                    existing.getPages().add(new PageAssetJpaEntity(existing, page.pageNumber(), page.storageKey(), page.cdnUrl(), page.width(), page.height()));
                }
            }

            ChapterJpaEntity saved = OptimisticLocking.flush(chapter, "Chapter", () -> springDataRepository.saveAndFlush(existing));
            chapter.restoreVersion(saved.getVersion());
            return toDomain(saved);
        } else {
            ChapterJpaEntity entity = toEntity(chapter);
            ChapterJpaEntity saved = springDataRepository.saveAndFlush(entity);
            chapter.restoreVersion(saved.getVersion());
            return toDomain(saved);
        }
    }

    private Chapter toDomain(ChapterJpaEntity entity) {
        return OptimisticLocking.restored(toDomainState(entity), entity.getVersion());
    }

    private Chapter toDomainState(ChapterJpaEntity entity) {
        List<PageAsset> pages = entity.getPages() != null ?
                entity.getPages().stream()
                        .map(p -> new PageAsset(p.getPageNumber(), p.getStorageKey(), p.getCdnUrl(), p.getWidth(), p.getHeight()))
                        .toList() : List.of();

        return new Chapter(
                ChapterId.of(entity.getId()),
                WorkId.of(entity.getWorkId()),
                ChapterNumber.of(entity.getChapterNumber()),
                entity.getTitle(),
                ChapterStatus.valueOf(entity.getStatus()),
                pages,
                entity.getScanlationProjectId() != null ? ProjectId.of(entity.getScanlationProjectId()) : null,
                entity.getCreatedAt(),
                entity.getPublishedAt(),
                entity.getUpdatedAt()
        );
    }

    private ChapterJpaEntity toEntity(Chapter chapter) {
        ChapterJpaEntity entity = new ChapterJpaEntity(
                chapter.getId().value(),
                chapter.getWorkId().value(),
                chapter.getChapterNumber().value(),
                chapter.getTitle(),
                chapter.getStatus().name(),
                chapter.getScanlationProjectId() != null ? chapter.getScanlationProjectId().value() : null,
                chapter.getCreatedAt(),
                chapter.getPublishedAt(),
                chapter.getUpdatedAt()
        );

        List<PageAssetJpaEntity> pageEntities = new ArrayList<>();
        if (chapter.getPages() != null) {
            for (PageAsset page : chapter.getPages()) {
                pageEntities.add(new PageAssetJpaEntity(entity, page.pageNumber(), page.storageKey(), page.cdnUrl(), page.width(), page.height()));
            }
        }
        entity.setPages(pageEntities);
        return entity;
    }
}
