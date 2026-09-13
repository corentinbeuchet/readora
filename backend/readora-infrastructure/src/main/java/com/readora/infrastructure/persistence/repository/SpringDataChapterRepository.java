package com.readora.infrastructure.persistence.repository;

import com.readora.infrastructure.persistence.entity.ChapterJpaEntity;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.UUID;

@Repository
public interface SpringDataChapterRepository extends JpaRepository<ChapterJpaEntity, UUID> {
    List<ChapterJpaEntity> findByWorkId(UUID workId);
}
