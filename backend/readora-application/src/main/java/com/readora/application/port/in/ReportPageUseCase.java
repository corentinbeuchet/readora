package com.readora.application.port.in;

import com.readora.domain.common.UserId;
import com.readora.domain.report.PageReport;
import com.readora.domain.report.PageReportId;
import com.readora.domain.report.PageReportReason;
import com.readora.domain.scanlation.ProjectId;
import com.readora.domain.work.ChapterId;

import java.util.List;

/// Broken-page reports (US-06): readers report, the chapter's scanlation team (or an admin) sees and fixes them.
public interface ReportPageUseCase {

    /// Reporting the same page again while the first report is open returns that report.
    ///
    /// @throws com.readora.domain.common.NotFoundException if the chapter doesn't exist or isn't published
    /// @throws com.readora.domain.common.DomainValidationException if the chapter has no such page
    PageReport report(UserId reporterId, ChapterId chapterId, int pageNumber, PageReportReason reason);

    /// @throws com.readora.domain.common.NotFoundException if the project doesn't exist
    /// @throws com.readora.domain.common.AccessDeniedDomainException unless the actor is a member of the project or an admin
    List<PageReport> openReports(UserId actorId, ProjectId projectId);

    /// @throws com.readora.domain.common.NotFoundException if the report doesn't exist
    /// @throws com.readora.domain.common.AccessDeniedDomainException unless the actor is on the chapter's team or an admin
    /// @throws com.readora.domain.common.DomainValidationException if it is already fixed
    PageReport resolve(UserId actorId, PageReportId reportId);
}
