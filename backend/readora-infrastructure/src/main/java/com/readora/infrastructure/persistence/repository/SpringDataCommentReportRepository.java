package com.readora.infrastructure.persistence.repository;

import com.readora.infrastructure.persistence.entity.CommentReportJpaEntity;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Repository
public interface SpringDataCommentReportRepository extends JpaRepository<CommentReportJpaEntity, UUID> {
    Optional<CommentReportJpaEntity> findFirstByReporterIdAndCommentIdAndStatus(String reporterId, UUID commentId, String status);

    List<CommentReportJpaEntity> findByCommentIdAndStatus(UUID commentId, String status);

    List<CommentReportJpaEntity> findByStatusOrderByCreatedAtAsc(String status, Pageable page);
}
