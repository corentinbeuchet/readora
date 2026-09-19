package com.readora.infrastructure.persistence.adapter;

import com.readora.application.port.out.CommentReportRepositoryPort;
import com.readora.domain.common.UserId;
import com.readora.domain.moderation.CommentReport;
import com.readora.domain.moderation.CommentReportReason;
import com.readora.domain.moderation.CommentReportStatus;
import com.readora.domain.social.CommentId;
import com.readora.infrastructure.persistence.entity.CommentReportJpaEntity;
import com.readora.infrastructure.persistence.repository.SpringDataCommentReportRepository;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Component
public class CommentReportRepositoryAdapter implements CommentReportRepositoryPort {

    private static final String OPEN = CommentReportStatus.OPEN.name();

    private final SpringDataCommentReportRepository springDataRepository;

    public CommentReportRepositoryAdapter(SpringDataCommentReportRepository springDataRepository) {
        this.springDataRepository = springDataRepository;
    }

    @Override
    @Transactional(readOnly = true)
    public Optional<CommentReport> findById(UUID id) {
        return springDataRepository.findById(id).map(this::toDomain);
    }

    @Override
    @Transactional
    public CommentReport save(CommentReport report) {
        CommentReportJpaEntity row = springDataRepository.findById(report.getId())
                .orElseGet(() -> new CommentReportJpaEntity(report.getId(), report.getCommentId().value(), report.getReporterId().value(),
                        report.getReason().name(), report.getCreatedAt()));
        row.setStatus(report.getStatus().name());
        row.setClosedAt(report.getClosedAt());
        UserId closedBy = report.getClosedBy();
        row.setClosedBy(closedBy != null ? closedBy.value() : null);
        return toDomain(springDataRepository.saveAndFlush(row));
    }

    @Override
    @Transactional(readOnly = true)
    public Optional<CommentReport> findOpen(UserId reporterId, CommentId commentId) {
        return springDataRepository.findFirstByReporterIdAndCommentIdAndStatus(reporterId.value(), commentId.value(), OPEN).map(this::toDomain);
    }

    @Override
    @Transactional(readOnly = true)
    public List<CommentReport> findOpenByComment(CommentId commentId) {
        return springDataRepository.findByCommentIdAndStatus(commentId.value(), OPEN).stream().map(this::toDomain).toList();
    }

    @Override
    @Transactional(readOnly = true)
    public List<CommentReport> findOpen(int limit) {
        return springDataRepository.findByStatusOrderByCreatedAtAsc(OPEN, PageRequest.of(0, limit)).stream().map(this::toDomain).toList();
    }

    private CommentReport toDomain(CommentReportJpaEntity row) {
        return new CommentReport(row.getId(), CommentId.of(row.getCommentId()), UserId.of(row.getReporterId()),
                CommentReportReason.valueOf(row.getReason()), CommentReportStatus.valueOf(row.getStatus()), row.getCreatedAt(),
                row.getClosedAt(), row.getClosedBy() != null ? UserId.of(row.getClosedBy()) : null);
    }
}
