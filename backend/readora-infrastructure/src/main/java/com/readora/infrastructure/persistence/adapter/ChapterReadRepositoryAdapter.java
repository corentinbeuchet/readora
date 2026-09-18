package com.readora.infrastructure.persistence.adapter;

import com.readora.application.port.out.ChapterReadRepositoryPort;
import com.readora.domain.common.UserId;
import com.readora.domain.library.ChapterRead;
import com.readora.domain.work.ChapterId;
import com.readora.domain.work.ChapterNumber;
import com.readora.domain.work.WorkId;
import com.readora.infrastructure.persistence.entity.ChapterReadJpaEntity;
import com.readora.infrastructure.persistence.repository.SpringDataChapterReadRepository;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import java.util.Collection;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;

@Component
public class ChapterReadRepositoryAdapter implements ChapterReadRepositoryPort {

    private final SpringDataChapterReadRepository springDataRepository;

    public ChapterReadRepositoryAdapter(SpringDataChapterReadRepository springDataRepository) {
        this.springDataRepository = springDataRepository;
    }

    @Override
    @Transactional(readOnly = true)
    public Optional<ChapterRead> find(UserId userId, ChapterId chapterId) {
        return springDataRepository.findById(new ChapterReadJpaEntity.Key(userId.value(), chapterId.value())).map(this::toDomain);
    }

    @Override
    @Transactional
    public ChapterRead save(ChapterRead read) {
        ChapterReadJpaEntity row = springDataRepository.findById(new ChapterReadJpaEntity.Key(read.userId().value(), read.chapterId().value()))
                .map(existing -> {
                    existing.setReadAt(read.readAt());
                    existing.setFinished(read.finished());
                    return existing;
                })
                .orElseGet(() -> new ChapterReadJpaEntity(read.userId().value(), read.chapterId().value(), read.workId().value(),
                        read.chapterNumber().value(), read.readAt(), read.finished()));
        return toDomain(springDataRepository.saveAndFlush(row));
    }

    @Override
    @Transactional(readOnly = true)
    public List<ChapterRead> findByUserAndWork(UserId userId, WorkId workId) {
        return springDataRepository.findByIdUserIdAndWorkId(userId.value(), workId.value()).stream().map(this::toDomain).toList();
    }

    @Override
    @Transactional(readOnly = true)
    public List<ChapterRead> findLatestPerWork(UserId userId, int limit) {
        return springDataRepository.findLatestPerWork(userId.value(), PageRequest.of(0, limit)).stream().map(this::toDomain).toList();
    }

    @Override
    @Transactional(readOnly = true)
    public Map<WorkId, Long> countChaptersPublishedSinceLastRead(UserId userId, Collection<WorkId> workIds) {
        if (workIds.isEmpty()) {
            return Map.of();
        }
        List<UUID> ids = workIds.stream().map(WorkId::value).toList();
        Map<WorkId, Long> counts = new HashMap<>();
        for (Object[] row : springDataRepository.countPublishedSinceLastRead(userId.value(), ids)) {
            counts.put(WorkId.of((UUID) row[0]), ((Number) row[1]).longValue());
        }
        return counts;
    }

    private ChapterRead toDomain(ChapterReadJpaEntity row) {
        return new ChapterRead(UserId.of(row.getId().getUserId()), WorkId.of(row.getWorkId()), ChapterId.of(row.getId().getChapterId()),
                ChapterNumber.of(row.getChapterNumber()), row.getReadAt(), row.isFinished());
    }
}
