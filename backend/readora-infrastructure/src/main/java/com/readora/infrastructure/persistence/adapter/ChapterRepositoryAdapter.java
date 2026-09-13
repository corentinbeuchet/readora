package com.readora.infrastructure.persistence.adapter;

import com.readora.application.port.out.ChapterRepositoryPort;
import com.readora.domain.scanlation.ProjectId;
import com.readora.domain.work.*;
import com.readora.infrastructure.persistence.entity.ChapterJpaEntity;
import com.readora.infrastructure.persistence.entity.PageAssetJpaEntity;
import com.readora.infrastructure.persistence.repository.SpringDataChapterRepository;
import org.springframework.stereotype.Component;

import java.util.ArrayList;
import java.util.List;
import java.util.Optional;

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
    public Chapter save(Chapter chapter) {
        ChapterJpaEntity entity = toEntity(chapter);
        ChapterJpaEntity saved = springDataRepository.save(entity);
        return toDomain(saved);
    }

    private Chapter toDomain(ChapterJpaEntity entity) {
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
