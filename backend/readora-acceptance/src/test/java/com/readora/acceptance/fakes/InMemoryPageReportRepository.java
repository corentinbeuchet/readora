package com.readora.acceptance.fakes;

import com.readora.application.port.out.PageReportRepositoryPort;
import com.readora.domain.common.UserId;
import com.readora.domain.report.PageReport;
import com.readora.domain.report.PageReportId;
import com.readora.domain.scanlation.ProjectId;
import com.readora.domain.work.ChapterId;

import java.util.Comparator;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.concurrent.ConcurrentHashMap;

public class InMemoryPageReportRepository implements PageReportRepositoryPort {

    private final Map<PageReportId, PageReport> reports = new ConcurrentHashMap<>();

    @Override
    public Optional<PageReport> findById(PageReportId id) {
        return Optional.ofNullable(reports.get(id));
    }

    @Override
    public PageReport save(PageReport report) {
        reports.put(report.getId(), report);
        return report;
    }

    @Override
    public Optional<PageReport> findOpen(UserId reporterId, ChapterId chapterId, int pageNumber) {
        return reports.values().stream()
                .filter(r -> r.isOpen() && r.getReporterId().equals(reporterId) && r.getChapterId().equals(chapterId) && r.getPageNumber() == pageNumber)
                .findFirst();
    }

    @Override
    public List<PageReport> findOpenByProject(ProjectId projectId) {
        return reports.values().stream()
                .filter(r -> r.isOpen() && projectId.equals(r.getProjectId()))
                .sorted(Comparator.comparing(PageReport::getCreatedAt))
                .toList();
    }
}
