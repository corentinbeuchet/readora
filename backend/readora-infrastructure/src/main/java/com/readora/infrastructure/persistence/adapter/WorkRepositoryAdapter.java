package com.readora.infrastructure.persistence.adapter;

import com.readora.application.port.out.WorkRepositoryPort;
import com.readora.domain.work.*;
import com.readora.infrastructure.persistence.entity.WorkJpaEntity;
import com.readora.infrastructure.persistence.repository.SpringDataWorkRepository;
import com.readora.infrastructure.persistence.repository.WorkSpecifications;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.jspecify.annotations.Nullable;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Optional;

@Component
public class WorkRepositoryAdapter implements WorkRepositoryPort {

    private final SpringDataWorkRepository springDataRepository;

    public WorkRepositoryAdapter(SpringDataWorkRepository springDataRepository) {
        this.springDataRepository = springDataRepository;
    }

    @Override
    @Transactional(readOnly = true)
    public Optional<Work> findById(WorkId id) {
        return springDataRepository.findById(id.value()).map(this::toDomain);
    }

    @Override
    @Transactional(readOnly = true)
    public WorkPage search(WorkSearch search, int page, int size) {
        // Tie-break on id so pages are stable when works share an updatedAt.
        Sort order = Sort.by(Sort.Direction.DESC, "updatedAt").and(Sort.by("id"));
        Page<WorkJpaEntity> result = springDataRepository.findAll(WorkSpecifications.matching(search), PageRequest.of(page, size, order));
        return new WorkPage(result.map(this::toDomain).getContent(), result.getTotalElements());
    }

    @Override
    @Transactional(readOnly = true)
    public List<String> findAllGenres() {
        return springDataRepository.findAllGenres();
    }

    @Override
    @Transactional
    public Work save(Work work) {
        WorkJpaEntity existing = springDataRepository.findById(work.getId().value()).orElse(null);
        if (existing != null) {
            OptimisticLocking.verify(work, existing.getVersion(), "Work");
            existing.setTitle(work.getTitle());
            existing.setSynopsis(work.getSynopsis());
            existing.setWorkType(work.getType().name());
            existing.setStatus(work.getStatus().name());
            existing.setAuthor(work.getAuthor());
            existing.setDemographic(demographicName(work));
            existing.setCoverImageUrl(work.getCoverImageUrl());
            existing.setGenres(new ArrayList<>(work.getGenres()));
            existing.setUpdatedAt(work.getUpdatedAt());
            WorkJpaEntity saved = OptimisticLocking.flush(work, "Work", () -> springDataRepository.saveAndFlush(existing));
            work.restoreVersion(saved.getVersion());
            return toDomain(saved);
        } else {
            WorkJpaEntity entity = toEntity(work);
            WorkJpaEntity saved = springDataRepository.saveAndFlush(entity);
            work.restoreVersion(saved.getVersion());
            return toDomain(saved);
        }
    }

    private Work toDomain(WorkJpaEntity entity) {
        return OptimisticLocking.restored(toDomainState(entity), entity.getVersion());
    }

    private Work toDomainState(WorkJpaEntity entity) {
        return new Work(
                WorkId.of(entity.getId()),
                entity.getTitle(),
                entity.getSynopsis(),
                WorkType.valueOf(entity.getWorkType()),
                WorkStatus.valueOf(entity.getStatus()),
                entity.getAuthor(),
                entity.getDemographic() != null ? Demographic.valueOf(entity.getDemographic()) : null,
                entity.getCoverImageUrl(),
                entity.getGenres() != null ? new HashSet<>(entity.getGenres()) : new HashSet<>(),
                entity.getCreatedAt(),
                entity.getUpdatedAt()
        );
    }

    private static @Nullable String demographicName(Work work) {
        Demographic demographic = work.getDemographic();
        return demographic != null ? demographic.name() : null;
    }

    private WorkJpaEntity toEntity(Work work) {
        return new WorkJpaEntity(
                work.getId().value(),
                work.getTitle(),
                work.getSynopsis(),
                work.getType().name(),
                work.getStatus().name(),
                work.getAuthor(),
                demographicName(work),
                work.getCoverImageUrl(),
                new ArrayList<>(work.getGenres()),
                work.getCreatedAt(),
                work.getUpdatedAt()
        );
    }
}
