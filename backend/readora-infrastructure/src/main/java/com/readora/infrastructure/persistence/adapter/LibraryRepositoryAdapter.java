package com.readora.infrastructure.persistence.adapter;

import com.readora.application.port.out.LibraryRepositoryPort;
import com.readora.domain.common.UserId;
import com.readora.domain.library.LibraryEntry;
import com.readora.domain.social.ReadingStatus;
import com.readora.domain.work.WorkId;
import com.readora.infrastructure.persistence.entity.LibraryEntryJpaEntity;
import com.readora.infrastructure.persistence.repository.SpringDataLibraryEntryRepository;
import org.jspecify.annotations.Nullable;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.Optional;

@Component
public class LibraryRepositoryAdapter implements LibraryRepositoryPort {

    private final SpringDataLibraryEntryRepository springDataRepository;

    public LibraryRepositoryAdapter(SpringDataLibraryEntryRepository springDataRepository) {
        this.springDataRepository = springDataRepository;
    }

    @Override
    @Transactional(readOnly = true)
    public Optional<LibraryEntry> find(UserId userId, WorkId workId) {
        return springDataRepository.findById(key(userId, workId)).map(this::toDomain);
    }

    @Override
    @Transactional(readOnly = true)
    public List<LibraryEntry> findByUser(UserId userId, @Nullable ReadingStatus status) {
        List<LibraryEntryJpaEntity> rows = status == null
                ? springDataRepository.findByIdUserIdOrderByUpdatedAtDesc(userId.value())
                : springDataRepository.findByIdUserIdAndStatusOrderByUpdatedAtDesc(userId.value(), status.name());
        return rows.stream().map(this::toDomain).toList();
    }

    @Override
    @Transactional
    public LibraryEntry save(LibraryEntry entry) {
        LibraryEntryJpaEntity row = springDataRepository.findById(key(entry.getUserId(), entry.getWorkId()))
                .map(existing -> {
                    existing.setStatus(entry.getStatus().name());
                    existing.setUpdatedAt(entry.getUpdatedAt());
                    return existing;
                })
                .orElseGet(() -> new LibraryEntryJpaEntity(entry.getUserId().value(), entry.getWorkId().value(),
                        entry.getStatus().name(), entry.getAddedAt(), entry.getUpdatedAt()));
        row.setNotify(entry.notifiesNewChapters());
        return toDomain(springDataRepository.saveAndFlush(row));
    }

    @Override
    @Transactional
    public boolean delete(UserId userId, WorkId workId) {
        LibraryEntryJpaEntity.Key key = key(userId, workId);
        if (!springDataRepository.existsById(key)) {
            return false;
        }
        springDataRepository.deleteById(key);
        return true;
    }

    @Override
    @Transactional(readOnly = true)
    public List<UserId> findSubscribers(WorkId workId) {
        return springDataRepository.findSubscriberIds(workId.value()).stream().map(UserId::of).toList();
    }

    private static LibraryEntryJpaEntity.Key key(UserId userId, WorkId workId) {
        return new LibraryEntryJpaEntity.Key(userId.value(), workId.value());
    }

    private LibraryEntry toDomain(LibraryEntryJpaEntity row) {
        return new LibraryEntry(UserId.of(row.getId().getUserId()), WorkId.of(row.getId().getWorkId()),
                ReadingStatus.valueOf(row.getStatus()), row.getAddedAt(), row.getUpdatedAt(), row.isNotify());
    }
}
