package com.readora.infrastructure.persistence.repository;

import com.readora.infrastructure.persistence.entity.BookmarkJpaEntity;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Repository
public interface SpringDataBookmarkRepository extends JpaRepository<BookmarkJpaEntity, UUID> {
    Optional<BookmarkJpaEntity> findByUserIdAndWorkId(String userId, UUID workId);
    List<BookmarkJpaEntity> findByUserIdOrderByUpdatedAtDesc(String userId);
}
