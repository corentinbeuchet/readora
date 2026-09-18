package com.readora.infrastructure.persistence.adapter;

import com.readora.application.port.out.PageReportRepositoryPort;
import com.readora.domain.common.UserId;
import com.readora.domain.report.PageReport;
import com.readora.domain.report.PageReportId;
import com.readora.domain.report.PageReportReason;
import com.readora.domain.report.PageReportStatus;
import com.readora.domain.scanlation.ProjectId;
import com.readora.domain.work.ChapterId;
import com.readora.domain.work.ChapterNumber;
import com.readora.domain.work.WorkId;
import com.readora.infrastructure.persistence.entity.PageReportJpaEntity;
import com.readora.infrastructure.persistence.repository.SpringDataPageReportRepository;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.Optional;

@Component
public class PageReportRepositoryAdapter implements PageReportRepositoryPort {

    private final SpringDataPageReportRepository springDataRepository;

    public PageReportRepositoryAdapter(SpringDataPageReportRepository springDataRepository) {
        this.springDataRepository = springDataRepository;
    }

    @Override
    @Transactional(readOnly = true)
    public Optional<PageReport> findById(PageReportId id) {
        return springDataRepository.findById(id.value()).map(this::toDomain);
    }

    @Override
    @Transactional
    public PageReport save(PageReport report) {
        PageReportJpaEntity existing = springDataRepository.findById(report.getId().value()).orElse(null);
        if (existing == null) {
            PageReportJpaEntity saved = springDataRepository.saveAndFlush(toEntity(report));
            report.restoreVersion(saved.getVersion());
            return toDomain(saved);
        }
        OptimisticLocking.verify(report, existing.getVersion(), "PageReport");
        existing.setStatus(report.getStatus().name());
        existing.setResolvedAt(report.getResolvedAt());
        UserId resolvedBy = report.getResolvedBy();
        existing.setResolvedBy(resolvedBy != null ? resolvedBy.value() : null);
        PageReportJpaEntity saved = OptimisticLocking.flush(report, "PageReport", () -> springDataRepository.saveAndFlush(existing));
        report.restoreVersion(saved.getVersion());
        return toDomain(saved);
    }

    @Override
    @Transactional(readOnly = true)
    public Optional<PageReport> findOpen(UserId reporterId, ChapterId chapterId, int pageNumber) {
        return springDataRepository.findFirstByReporterIdAndChapterIdAndPageNumberAndStatus(reporterId.value(), chapterId.value(),
                pageNumber, PageReportStatus.OPEN.name()).map(this::toDomain);
    }

    @Override
    @Transactional(readOnly = true)
    public List<PageReport> findOpenByProject(ProjectId projectId) {
        return springDataRepository.findByProjectIdAndStatusOrderByCreatedAtAsc(projectId.value(), PageReportStatus.OPEN.name()).stream()
                .map(this::toDomain)
                .toList();
    }

    private PageReport toDomain(PageReportJpaEntity row) {
        PageReport report = new PageReport(
                PageReportId.of(row.getId()),
                ChapterId.of(row.getChapterId()),
                WorkId.of(row.getWorkId()),
                row.getProjectId() != null ? ProjectId.of(row.getProjectId()) : null,
                ChapterNumber.of(row.getChapterNumber()),
                row.getPageNumber(),
                PageReportReason.valueOf(row.getReason()),
                UserId.of(row.getReporterId()),
                PageReportStatus.valueOf(row.getStatus()),
                row.getCreatedAt(),
                row.getResolvedAt(),
                row.getResolvedBy() != null ? UserId.of(row.getResolvedBy()) : null);
        return OptimisticLocking.restored(report, row.getVersion());
    }

    private PageReportJpaEntity toEntity(PageReport report) {
        ProjectId projectId = report.getProjectId();
        return new PageReportJpaEntity(report.getId().value(), report.getChapterId().value(), report.getWorkId().value(),
                projectId != null ? projectId.value() : null, report.getChapterNumber().value(), report.getPageNumber(),
                report.getReason().name(), report.getReporterId().value(), report.getStatus().name(), report.getCreatedAt());
    }
}
