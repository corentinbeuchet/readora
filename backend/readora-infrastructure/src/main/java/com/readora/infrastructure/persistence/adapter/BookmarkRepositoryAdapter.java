package com.readora.infrastructure.persistence.adapter;

import com.readora.application.port.out.BookmarkRepositoryPort;
import com.readora.domain.social.Bookmark;
import com.readora.domain.social.ReadingStatus;
import com.readora.domain.work.ChapterId;
import com.readora.domain.work.UserId;
import com.readora.domain.work.WorkId;
import com.readora.infrastructure.persistence.entity.BookmarkJpaEntity;
import com.readora.infrastructure.persistence.repository.SpringDataBookmarkRepository;
import org.springframework.stereotype.Component;

import java.util.List;
import java.util.Optional;

@Component
public class BookmarkRepositoryAdapter implements BookmarkRepositoryPort {

    private final SpringDataBookmarkRepository springDataRepository;

    public BookmarkRepositoryAdapter(SpringDataBookmarkRepository springDataRepository) {
        this.springDataRepository = springDataRepository;
    }

    @Override
    public Optional<Bookmark> findByUserIdAndWorkId(UserId userId, WorkId workId) {
        return springDataRepository.findByUserIdAndWorkId(userId.value(), workId.value()).map(this::toDomain);
    }

    @Override
    public List<Bookmark> findByUserId(UserId userId) {
        return springDataRepository.findByUserIdOrderByUpdatedAtDesc(userId.value()).stream()
                .map(this::toDomain)
                .toList();
    }

    @Override
    public Bookmark save(Bookmark bookmark) {
        BookmarkJpaEntity entity = springDataRepository
                .findByUserIdAndWorkId(bookmark.getUserId().value(), bookmark.getWorkId().value())
                .map(existing -> {
                    existing.setLastReadChapterId(bookmark.getLastReadChapterId() != null ? bookmark.getLastReadChapterId().value() : null);
                    existing.setLastReadPageIndex(bookmark.getLastReadPageIndex());
                    existing.setStatus(bookmark.getStatus().name());
                    existing.setUpdatedAt(bookmark.getUpdatedAt());
                    return existing;
                })
                .orElseGet(() -> toEntity(bookmark));
        BookmarkJpaEntity saved = springDataRepository.save(entity);
        return toDomain(saved);
    }

    private Bookmark toDomain(BookmarkJpaEntity entity) {
        return new Bookmark(
                UserId.of(entity.getUserId()),
                WorkId.of(entity.getWorkId()),
                entity.getLastReadChapterId() != null ? ChapterId.of(entity.getLastReadChapterId()) : null,
                entity.getLastReadPageIndex(),
                ReadingStatus.valueOf(entity.getStatus()),
                entity.getUpdatedAt()
        );
    }

    private BookmarkJpaEntity toEntity(Bookmark bookmark) {
        return new BookmarkJpaEntity(
                bookmark.getUserId().value(),
                bookmark.getWorkId().value(),
                bookmark.getLastReadChapterId() != null ? bookmark.getLastReadChapterId().value() : null,
                bookmark.getLastReadPageIndex(),
                bookmark.getStatus().name(),
                bookmark.getUpdatedAt()
        );
    }
}
