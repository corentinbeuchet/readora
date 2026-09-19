package com.readora.domain.report;

import com.readora.domain.common.AggregateRoot;
import com.readora.domain.common.DomainValidationException;
import com.readora.domain.common.ErrorCodes;
import com.readora.domain.common.UserId;
import com.readora.domain.scanlation.ProjectId;
import com.readora.domain.work.ChapterId;
import com.readora.domain.work.ChapterNumber;
import com.readora.domain.work.WorkId;
import org.jspecify.annotations.Nullable;

import java.time.Instant;
import java.util.Objects;

/// A reader's report that a page of a published chapter doesn't display properly. The scanlation team of the
/// chapter (or an admin, for chapters without a team) marks it fixed.
public class PageReport extends AggregateRoot<PageReportId> {
    private final ChapterId chapterId;
    private final WorkId workId;
    private final @Nullable ProjectId projectId;
    private final ChapterNumber chapterNumber;
    private final int pageNumber;
    private final PageReportReason reason;
    private final UserId reporterId;
    private PageReportStatus status;
    private final Instant createdAt;
    private @Nullable Instant resolvedAt;
    private @Nullable UserId resolvedBy;

    public PageReport(PageReportId id, ChapterId chapterId, WorkId workId, @Nullable ProjectId projectId, ChapterNumber chapterNumber,
                      int pageNumber, PageReportReason reason, UserId reporterId, PageReportStatus status, Instant createdAt,
                      @Nullable Instant resolvedAt, @Nullable UserId resolvedBy) {
        super(id);
        if (pageNumber < 1) {
            throw new DomainValidationException("Page number must be at least 1");
        }
        this.chapterId = Objects.requireNonNull(chapterId, "ChapterId cannot be null");
        this.workId = Objects.requireNonNull(workId, "WorkId cannot be null");
        this.projectId = projectId;
        this.chapterNumber = Objects.requireNonNull(chapterNumber, "ChapterNumber cannot be null");
        this.pageNumber = pageNumber;
        this.reason = Objects.requireNonNull(reason, "PageReportReason cannot be null");
        this.reporterId = Objects.requireNonNull(reporterId, "Reporter cannot be null");
        this.status = Objects.requireNonNull(status, "PageReportStatus cannot be null");
        this.createdAt = Objects.requireNonNull(createdAt, "createdAt cannot be null");
        this.resolvedAt = resolvedAt;
        this.resolvedBy = resolvedBy;
    }

    public static PageReport open(ChapterId chapterId, WorkId workId, @Nullable ProjectId projectId, ChapterNumber chapterNumber,
                                  int pageNumber, PageReportReason reason, UserId reporterId, Instant now) {
        PageReport report = new PageReport(PageReportId.generate(), chapterId, workId, projectId, chapterNumber, pageNumber, reason,
                reporterId, PageReportStatus.OPEN, now, null, null);
        report.registerEvent(PageReportedEvent.now(report.getId(), chapterId, pageNumber, reason));
        return report;
    }

    /// @throws DomainValidationException if the report was already marked fixed
    public void resolve(UserId by, Instant now) {
        if (status == PageReportStatus.RESOLVED) {
            throw DomainValidationException.withCode(ErrorCodes.ALREADY_HANDLED, "This report is already marked as fixed");
        }
        this.status = PageReportStatus.RESOLVED;
        this.resolvedAt = now;
        this.resolvedBy = Objects.requireNonNull(by, "Resolver cannot be null");
    }

    public boolean isOpen() {
        return status == PageReportStatus.OPEN;
    }

    public ChapterId getChapterId() { return chapterId; }
    public WorkId getWorkId() { return workId; }
    public @Nullable ProjectId getProjectId() { return projectId; }
    public ChapterNumber getChapterNumber() { return chapterNumber; }
    public int getPageNumber() { return pageNumber; }
    public PageReportReason getReason() { return reason; }
    public UserId getReporterId() { return reporterId; }
    public PageReportStatus getStatus() { return status; }
    public Instant getCreatedAt() { return createdAt; }
    public @Nullable Instant getResolvedAt() { return resolvedAt; }
    public @Nullable UserId getResolvedBy() { return resolvedBy; }
}
