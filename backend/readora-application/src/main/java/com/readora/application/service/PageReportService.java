package com.readora.application.service;

import com.readora.application.port.in.ReportPageUseCase;
import com.readora.application.port.out.ChapterRepositoryPort;
import com.readora.application.port.out.PageReportRepositoryPort;
import com.readora.application.port.out.ScanlationProjectRepositoryPort;
import com.readora.application.port.out.TeamRepositoryPort;
import com.readora.application.port.out.UserAccountRepositoryPort;
import com.readora.domain.common.AccessDeniedDomainException;
import com.readora.domain.common.DomainValidationException;
import com.readora.domain.common.NotFoundException;
import com.readora.domain.common.UserId;
import com.readora.domain.identity.Permission;
import com.readora.domain.report.PageReport;
import com.readora.domain.report.PageReportId;
import com.readora.domain.report.PageReportReason;
import com.readora.domain.scanlation.ProjectId;
import com.readora.domain.scanlation.ScanlationProject;
import com.readora.domain.scanlation.TeamId;
import com.readora.domain.work.Chapter;
import com.readora.domain.work.ChapterId;

import java.time.Clock;
import java.util.List;
import java.util.Objects;

public class PageReportService implements ReportPageUseCase {

    private final PageReportRepositoryPort reportRepository;
    private final ChapterRepositoryPort chapterRepository;
    private final ScanlationProjectRepositoryPort projectRepository;
    private final TeamRepositoryPort teamRepository;
    private final UserAccountRepositoryPort userRepository;
    private final Clock clock;

    public PageReportService(PageReportRepositoryPort reportRepository, ChapterRepositoryPort chapterRepository,
                             ScanlationProjectRepositoryPort projectRepository, TeamRepositoryPort teamRepository,
                             UserAccountRepositoryPort userRepository,
                             Clock clock) {
        this.reportRepository = Objects.requireNonNull(reportRepository, "PageReportRepositoryPort cannot be null");
        this.chapterRepository = Objects.requireNonNull(chapterRepository, "ChapterRepositoryPort cannot be null");
        this.projectRepository = Objects.requireNonNull(projectRepository, "ScanlationProjectRepositoryPort cannot be null");
        this.teamRepository = Objects.requireNonNull(teamRepository, "TeamRepositoryPort cannot be null");
        this.userRepository = Objects.requireNonNull(userRepository, "UserAccountRepositoryPort cannot be null");
        this.clock = Objects.requireNonNull(clock, "Clock cannot be null");
    }

    @Override
    public PageReport report(UserId reporterId, ChapterId chapterId, int pageNumber, PageReportReason reason) {
        Chapter chapter = chapterRepository.findById(chapterId)
                .filter(Chapter::isPublished)
                .orElseThrow(() -> new NotFoundException("Chapter", chapterId));
        if (pageNumber < 1 || pageNumber > chapter.getPages().size()) {
            throw new DomainValidationException("Chapter " + chapter.getChapterNumber().value() + " has no page " + pageNumber);
        }
        var existing = reportRepository.findOpen(reporterId, chapterId, pageNumber);
        if (existing.isPresent()) {
            return existing.get();
        }
        PageReport report = PageReport.open(chapterId, chapter.getWorkId(), chapter.getTeamId(), chapter.getChapterNumber(),
                pageNumber, reason, reporterId, clock.instant());
        PageReport saved = reportRepository.save(report);
        return saved;
    }

    @Override
    public List<PageReport> openReports(UserId actorId, ProjectId projectId) {
        ScanlationProject project = projectRepository.findById(projectId)
                .orElseThrow(() -> new NotFoundException("Project", projectId));
        if (!isOnTeam(actorId, project) && !isAdmin(actorId)) {
            throw new AccessDeniedDomainException("Only the project's team can see its page reports");
        }
        return reportRepository.findOpenByTeamAndWork(project.getTeamId(), project.getWorkId());
    }

    @Override
    public PageReport resolve(UserId actorId, PageReportId reportId) {
        PageReport report = reportRepository.findById(reportId)
                .orElseThrow(() -> new NotFoundException("Page report", reportId));
        if (!isOnTeam(actorId, report.getTeamId()) && !isAdmin(actorId)) {
            throw new AccessDeniedDomainException("Only the chapter's team can mark this report as fixed");
        }
        report.resolve(actorId, clock.instant());
        return reportRepository.save(report);
    }

    private boolean isOnTeam(UserId actorId, ScanlationProject project) {
        return isOnTeam(actorId, project.getTeamId());
    }

    private boolean isOnTeam(UserId actorId, TeamId teamId) {
        return teamRepository.findById(teamId).flatMap(team -> team.findMember(actorId)).isPresent();
    }

    private boolean isAdmin(UserId actorId) {
        return userRepository.findById(actorId).map(account -> account.can(Permission.USER_MANAGE)).orElse(false);
    }
}
