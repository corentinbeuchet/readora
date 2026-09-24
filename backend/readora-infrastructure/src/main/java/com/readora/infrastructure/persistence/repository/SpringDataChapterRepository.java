package com.readora.infrastructure.persistence.repository;

import com.readora.infrastructure.persistence.entity.ChapterJpaEntity;
import org.springframework.data.domain.Limit;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.UUID;

@Repository
public interface SpringDataChapterRepository extends JpaRepository<ChapterJpaEntity, UUID> {
    List<ChapterJpaEntity> findByWorkId(UUID workId);

    List<ChapterJpaEntity> findByWorkIdAndStatus(UUID workId, String status);

    boolean existsByTeamIdAndStatus(UUID teamId, String status);

    List<ChapterJpaEntity> findByStatusOrderByUpdatedAtAsc(String status, Limit limit);

    java.util.Optional<ChapterJpaEntity> findByWorkIdAndChapterNumberAndTeamId(UUID workId, String chapterNumber, UUID teamId);

    /// Rows of `[id, chapterNumber, teamId, publishedAt]` for navigation and progress: no pages are loaded.
    @Query("select c.id, c.chapterNumber, c.teamId, c.publishedAt from ChapterJpaEntity c where c.workId = :workId and c.status = :status")
    List<Object[]> findRefsByWorkIdAndStatus(@Param("workId") UUID workId, @Param("status") String status);
}
