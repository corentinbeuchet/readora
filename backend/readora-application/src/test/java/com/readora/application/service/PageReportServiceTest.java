package com.readora.application.service;

import com.readora.application.port.out.ChapterRepositoryPort;
import com.readora.application.port.out.EventPublisherPort;
import com.readora.application.port.out.PageReportRepositoryPort;
import com.readora.application.port.out.ScanlationProjectRepositoryPort;
import com.readora.application.port.out.TeamRepositoryPort;
import com.readora.application.port.out.UserAccountRepositoryPort;
import com.readora.domain.common.AccessDeniedDomainException;
import com.readora.domain.common.DomainValidationException;
import com.readora.domain.common.NotFoundException;
import com.readora.domain.common.UserId;
import com.readora.domain.report.PageReport;
import com.readora.domain.report.PageReportReason;
import com.readora.domain.report.PageReportedEvent;
import com.readora.domain.scanlation.ScanlationProject;
import com.readora.domain.scanlation.Team;
import com.readora.domain.work.Chapter;
import com.readora.domain.work.ChapterNumber;
import com.readora.domain.work.PageAsset;
import com.readora.domain.work.WorkId;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.Clock;
import java.time.Instant;
import java.time.ZoneOffset;
import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.lenient;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class PageReportServiceTest {

    private static final Instant NOW = Instant.parse("2026-09-10T10:00:00Z");

    @Mock
    private PageReportRepositoryPort reports;

    @Mock
    private ChapterRepositoryPort chapters;

    @Mock
    private ScanlationProjectRepositoryPort projects;
    @Mock
    private TeamRepositoryPort teams;

    @Mock
    private UserAccountRepositoryPort users;

    @Mock
    private EventPublisherPort events;

    private PageReportService service;
    private final UserId kenji = UserId.of("kenji");
    private final UserId leader = UserId.of("leader");
    private final WorkId work = WorkId.generate();
    private ScanlationProject project;
    private Team team;
    private Chapter chapter;

    @BeforeEach
    void setUp() {
        service = new PageReportService(reports, chapters, projects, teams, users, events, Clock.fixed(NOW, ZoneOffset.UTC));
        team = Team.create("Shadow Scans", null, leader);
        project = ScanlationProject.create("Shadow Scans", work, team.getId());
        chapter = Chapter.createDraft(work, ChapterNumber.of("1"), "Ch 1", project.getId());
        chapter.updatePages(List.of(PageAsset.create(1, "p1", null), PageAsset.create(2, "p2", null)));
        chapter.publish(leader);
        lenient().when(chapters.findById(chapter.getId())).thenReturn(Optional.of(chapter));
        lenient().when(projects.findById(project.getId())).thenReturn(Optional.of(project));
        lenient().when(teams.findById(team.getId())).thenReturn(Optional.of(team));
        lenient().when(users.findById(any())).thenReturn(Optional.empty());
        lenient().when(reports.save(any())).thenAnswer(i -> i.getArgument(0));
    }

    @Test
    @DisplayName("A report on a page the chapter doesn't have is refused")
    void pageOutOfRange() {
        assertThatThrownBy(() -> service.report(kenji, chapter.getId(), 3, PageReportReason.MISSING_PAGE))
                .isInstanceOf(DomainValidationException.class);
        verify(reports, never()).save(any());
    }

    @Test
    @DisplayName("A new report is attributed to the chapter's team and announced")
    void newReport() {
        when(reports.findOpen(kenji, chapter.getId(), 2)).thenReturn(Optional.empty());

        PageReport report = service.report(kenji, chapter.getId(), 2, PageReportReason.IMAGE_CORRUPTED);

        assertThat(report.getProjectId()).isEqualTo(project.getId());
        verify(events).publish(any(PageReportedEvent.class));
    }

    @Test
    @DisplayName("Reporting the same page again returns the open report without saving a new one")
    void duplicateReport() {
        PageReport first = PageReport.open(chapter.getId(), work, project.getId(), ChapterNumber.of("1"), 2,
                PageReportReason.IMAGE_CORRUPTED, kenji, NOW);
        when(reports.findOpen(kenji, chapter.getId(), 2)).thenReturn(Optional.of(first));

        assertThat(service.report(kenji, chapter.getId(), 2, PageReportReason.LOW_QUALITY)).isSameAs(first);
        verify(reports, never()).save(any());
    }

    @Test
    @DisplayName("Unpublished chapters can't be reported")
    void draftChapter() {
        Chapter draft = Chapter.createDraft(work, ChapterNumber.of("2"), "Draft", project.getId());
        when(chapters.findById(draft.getId())).thenReturn(Optional.of(draft));

        assertThatThrownBy(() -> service.report(kenji, draft.getId(), 1, PageReportReason.MISSING_PAGE)).isInstanceOf(NotFoundException.class);
    }

    @Test
    @DisplayName("Only team members (or admins) see and fix reports")
    void onlyTheTeam() {
        PageReport report = PageReport.open(chapter.getId(), work, project.getId(), ChapterNumber.of("1"), 2,
                PageReportReason.IMAGE_CORRUPTED, kenji, NOW);
        when(reports.findById(report.getId())).thenReturn(Optional.of(report));

        assertThatThrownBy(() -> service.openReports(kenji, project.getId())).isInstanceOf(AccessDeniedDomainException.class);
        assertThatThrownBy(() -> service.resolve(kenji, report.getId())).isInstanceOf(AccessDeniedDomainException.class);

        assertThat(service.resolve(leader, report.getId()).isOpen()).isFalse();
    }

    @Test
    @DisplayName("A report on a chapter without a team can only be fixed by an admin")
    void noTeamNeedsAnAdmin() {
        PageReport orphan = PageReport.open(chapter.getId(), work, null, ChapterNumber.of("1"), 1,
                PageReportReason.IMAGE_CORRUPTED, kenji, NOW);
        when(reports.findById(orphan.getId())).thenReturn(Optional.of(orphan));

        assertThatThrownBy(() -> service.resolve(leader, orphan.getId())).isInstanceOf(AccessDeniedDomainException.class);
    }
}
