package com.readora.application.port.out;

import com.readora.domain.common.UserId;
import com.readora.domain.report.PageReport;
import com.readora.domain.report.PageReportId;
import com.readora.domain.scanlation.TeamId;
import com.readora.domain.work.WorkId;
import com.readora.domain.work.ChapterId;

import java.util.List;
import java.util.Optional;

public interface PageReportRepositoryPort {
    Optional<PageReport> findById(PageReportId id);

    PageReport save(PageReport report);

    /// The reporter's open report on this page, if any (a second report of the same page is not a new one).
    Optional<PageReport> findOpen(UserId reporterId, ChapterId chapterId, int pageNumber);

    /// Open reports on the chapters the team published in this series, oldest first.
    List<PageReport> findOpenByTeamAndWork(TeamId teamId, WorkId workId);
}
