package com.readora.infrastructure.persistence.repository;

import com.readora.infrastructure.persistence.entity.PageReportJpaEntity;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Repository
public interface SpringDataPageReportRepository extends JpaRepository<PageReportJpaEntity, UUID> {
    Optional<PageReportJpaEntity> findFirstByReporterIdAndChapterIdAndPageNumberAndStatus(String reporterId, UUID chapterId,
                                                                                          int pageNumber, String status);

    List<PageReportJpaEntity> findByTeamIdAndWorkIdAndStatusOrderByCreatedAtAsc(UUID teamId, UUID workId, String status);
}
