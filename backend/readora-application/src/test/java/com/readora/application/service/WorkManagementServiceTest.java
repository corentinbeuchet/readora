package com.readora.application.service;

import com.readora.application.port.in.ManageWorkUseCase;
import com.readora.application.port.out.ChapterRepositoryPort;
import com.readora.application.port.out.EventPublisherPort;
import com.readora.application.port.out.ScanlationProjectRepositoryPort;
import com.readora.application.port.out.TeamRepositoryPort;
import com.readora.application.port.out.UserAccountRepositoryPort;
import com.readora.application.port.out.WorkRepositoryPort;
import com.readora.domain.common.AccessDeniedDomainException;
import com.readora.domain.common.DomainValidationException;
import com.readora.domain.common.ErrorCodes;
import com.readora.domain.common.UserId;
import com.readora.domain.identity.UserAccount;
import com.readora.domain.scanlation.ProjectId;
import com.readora.domain.scanlation.ScanlationProject;
import com.readora.domain.scanlation.ScanlationRole;
import com.readora.domain.scanlation.Team;
import com.readora.domain.work.*;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;

import java.time.Clock;
import java.time.Instant;
import java.time.ZoneOffset;
import java.util.List;
import java.util.Optional;
import java.util.Set;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

class WorkManagementServiceTest {

    private WorkRepositoryPort workRepository;
    private ChapterRepositoryPort chapterRepository;
    private ScanlationProjectRepositoryPort projectRepository;
    private TeamRepositoryPort teamRepository;
    private UserAccountRepositoryPort userRepository;
    private EventPublisherPort eventPublisher;
    private WorkManagementService service;

    private static final Instant NOW = Instant.parse("2026-09-20T10:00:00Z");

    @BeforeEach
    void setUp() {
        workRepository = mock(WorkRepositoryPort.class);
        chapterRepository = mock(ChapterRepositoryPort.class);
        // Its light reads (existsByTeamAndWork, findTeamIdsByWork) derive from the stubbed full reads.
        projectRepository = mock(ScanlationProjectRepositoryPort.class, withSettings().defaultAnswer(CALLS_REAL_METHODS));
        teamRepository = mock(TeamRepositoryPort.class);
        userRepository = mock(UserAccountRepositoryPort.class);
        eventPublisher = mock(EventPublisherPort.class);
        service = new WorkManagementService(workRepository, chapterRepository, projectRepository, teamRepository, userRepository, eventPublisher,
                Clock.fixed(NOW, ZoneOffset.UTC));
    }

    @Test
    @DisplayName("A new work belongs to a team its creator leads, which gets a task board for it")
    void createWorkSuccess() {
        UserId creatorId = UserId.of("creator-123");
        Team team = Team.create("Moon Scans", null, creatorId);
        when(teamRepository.findById(team.getId())).thenReturn(Optional.of(team));
        when(workRepository.save(any(Work.class))).thenAnswer(invocation -> invocation.getArgument(0));
        when(projectRepository.save(any(ScanlationProject.class))).thenAnswer(invocation -> invocation.getArgument(0));

        Work work = service.createWork(new ManageWorkUseCase.NewWork(
                "Solo Leveling",
                "Hunter Sung Jinwoo story",
                WorkType.MANHWA,
                WorkStatus.ONGOING,
                "  Chugong ",
                Demographic.SHOUNEN,
                "https://cdn.readora.com/covers/solo.webp",
                Set.of("Action", "Fantasy"),
                team.getId()
        ), creatorId);

        assertThat(work.getTitle()).isEqualTo("Solo Leveling");
        assertThat(work.getType()).isEqualTo(WorkType.MANHWA);
        assertThat(work.getGenres()).containsExactlyInAnyOrder("Action", "Fantasy");
        assertThat(work.getAuthor()).isEqualTo("Chugong");
        assertThat(work.getDemographic()).isEqualTo(Demographic.SHOUNEN);

        ArgumentCaptor<ScanlationProject> projectCaptor = ArgumentCaptor.forClass(ScanlationProject.class);
        verify(projectRepository).save(projectCaptor.capture());
        assertThat(projectCaptor.getValue().getWorkId()).isEqualTo(work.getId());
        assertThat(projectCaptor.getValue().getTeamId()).isEqualTo(team.getId());
        verify(teamRepository, never()).save(any());
    }

    @Test
    @DisplayName("A reader cannot create a work without a team they lead; nothing is saved")
    void createWorkNeedsATeam() {
        UserId creatorId = UserId.of("creator-123");

        assertThatThrownBy(() -> service.createWork(new ManageWorkUseCase.NewWork("Solo Leveling", null, WorkType.MANHWA, null, null, null, null,
                Set.of(), null), creatorId))
                .isInstanceOfSatisfying(DomainValidationException.class, e -> assertThat(e.code()).isEqualTo(ErrorCodes.TEAM_REQUIRED));
        verify(workRepository, never()).save(any());
    }

    @Test
    @DisplayName("Create work throws validation exception when title is empty")
    void createWorkInvalidTitle() {
        UserId creatorId = UserId.of("creator-123");

        assertThatThrownBy(() -> service.createWork(new ManageWorkUseCase.NewWork("", "Synopsis", WorkType.MANGA, WorkStatus.ONGOING, null, null, null, Set.of()), creatorId))
                .isInstanceOf(DomainValidationException.class)
                .hasMessageContaining("Work title cannot be empty");
    }

    @Test
    @DisplayName("Directly publish a chapter with ordered pages, credited to the publisher's team")
    void directPublishChapterSuccess() {
        UserId publisherId = UserId.of("pub-1");
        Work work = Work.create("One Piece", "Pirates", WorkType.MANGA, "op.jpg", Set.of("Adventure"));
        Team team = givenATeamWorkingOn(work, publisherId);
        when(chapterRepository.save(any(Chapter.class))).thenAnswer(invocation -> invocation.getArgument(0));
        when(chapterRepository.hasPublishedChapter(team.getId())).thenReturn(true);

        List<PageAsset> pages = List.of(
                PageAsset.create(1, "c1/p1.webp", "https://cdn.readora.com/c1/p1.webp"),
                PageAsset.create(2, "c1/p2.webp", "https://cdn.readora.com/c1/p2.webp")
        );

        Chapter chapter = service.directPublishChapter(work.getId(), team.getId(), "1", "Romance Dawn", pages, publisherId);

        assertThat(chapter).isNotNull();
        assertThat(chapter.getChapterNumber().value()).isEqualTo("1");
        assertThat(chapter.getStatus()).isEqualTo(ChapterStatus.PUBLISHED);
        assertThat(chapter.getTeamId()).isEqualTo(team.getId());
        assertThat(chapter.getPages()).hasSize(2);
        verify(eventPublisher, atLeastOnce()).publish(any());
    }

    @Test
    @DisplayName("A team cannot publish the same chapter number twice")
    void directPublishDuplicateChapterThrowsException() {
        UserId publisherId = UserId.of("pub-1");
        Work work = Work.create("One Piece", "Pirates", WorkType.MANGA, "op.jpg", Set.of("Adventure"));
        Team team = givenATeamWorkingOn(work, publisherId);
        Chapter existing = Chapter.createPublished(work.getId(), ChapterNumber.of("1"), "Existing",
                List.of(PageAsset.create(1, "c1/p1.webp", null)), team.getId(), publisherId);
        when(chapterRepository.findByWorkIdAndChapterNumberAndTeam(work.getId(), ChapterNumber.of("1"), team.getId())).thenReturn(Optional.of(existing));

        List<PageAsset> pages = List.of(PageAsset.create(1, "c1/p1.webp", "https://cdn.readora.com/c1/p1.webp"));

        assertThatThrownBy(() -> service.directPublishChapter(work.getId(), team.getId(), "1", "Duplicate", pages, publisherId))
                .isInstanceOfSatisfying(DomainValidationException.class, e -> assertThat(e.code()).isEqualTo(ErrorCodes.CHAPTER_ALREADY_EXISTS));
    }

    @Test
    @DisplayName("A scanlator who is not a leader or quality checker of the team cannot publish for it")
    void directPublishByOutsiderIsDenied() {
        Work work = Work.create("One Piece", "Pirates", WorkType.MANGA, "op.jpg", Set.of("Adventure"));
        Team team = givenATeamWorkingOn(work, UserId.of("owner"));
        UserId outsider = UserId.of("outsider");
        when(userRepository.findById(outsider)).thenReturn(Optional.empty());

        List<PageAsset> pages = List.of(PageAsset.create(1, "c1/p1.webp", null));

        assertThatThrownBy(() -> service.directPublishChapter(work.getId(), team.getId(), "1", "Hijack", pages, outsider))
                .isInstanceOf(AccessDeniedDomainException.class);
        verify(chapterRepository, never()).save(any());
    }

    @Test
    @DisplayName("A team cannot publish into a series it does not work on")
    void directPublishIntoAnotherTeamsSeriesIsRefused() {
        UserId leader = UserId.of("mina");
        Work work = Work.create("One Piece", "Pirates", WorkType.MANGA, "op.jpg", Set.of("Adventure"));
        Team moonScans = Team.create("Moon Scans", null, leader);
        when(workRepository.findById(work.getId())).thenReturn(Optional.of(work));
        when(teamRepository.findById(moonScans.getId())).thenReturn(Optional.of(moonScans));
        when(projectRepository.findByTeamId(moonScans.getId())).thenReturn(List.of());

        List<PageAsset> pages = List.of(PageAsset.create(1, "c1/p1.webp", null));

        assertThatThrownBy(() -> service.directPublishChapter(work.getId(), moonScans.getId(), "1", "Ch 1", pages, leader))
                .isInstanceOfSatisfying(DomainValidationException.class, e -> assertThat(e.code()).isEqualTo(ErrorCodes.TEAM_NOT_ON_SERIES));
        verify(chapterRepository, never()).save(any());
    }

    @Test
    @DisplayName("An admin can publish for a team without being one of its members")
    void directPublishByAdminIsAllowed() {
        Work work = Work.create("One Piece", "Pirates", WorkType.MANGA, "op.jpg", Set.of("Adventure"));
        Team team = givenATeamWorkingOn(work, UserId.of("owner"));
        UserId adminId = UserId.of("admin");
        UserAccount admin = mock(UserAccount.class);
        when(admin.can(com.readora.domain.identity.Permission.USER_MANAGE)).thenReturn(true);
        when(admin.can(com.readora.domain.identity.Permission.COMMENT_MODERATE)).thenReturn(true);
        when(userRepository.findById(adminId)).thenReturn(Optional.of(admin));
        when(chapterRepository.save(any(Chapter.class))).thenAnswer(invocation -> invocation.getArgument(0));

        Chapter chapter = service.directPublishChapter(work.getId(), team.getId(), "1", "Admin", List.of(PageAsset.create(1, "p1.webp", null)), adminId);

        assertThat(chapter.isPublished()).isTrue();
        assertThat(chapter.getTeamId()).isEqualTo(team.getId());
    }

    @Test
    @DisplayName("A team's first chapter waits for a moderator: hidden from readers, and nobody is told yet")
    void aTeamsFirstChapterWaitsForReview() {
        UserId publisherId = UserId.of("pub-1");
        Work work = Work.create("One Piece", "Pirates", WorkType.MANGA, "op.jpg", Set.of("Adventure"));
        Team team = givenATeamWorkingOn(work, publisherId);
        when(chapterRepository.save(any(Chapter.class))).thenAnswer(invocation -> invocation.getArgument(0));
        when(chapterRepository.hasPublishedChapter(team.getId())).thenReturn(false);

        Chapter chapter = service.directPublishChapter(work.getId(), team.getId(), "1", "Romance Dawn",
                List.of(PageAsset.create(1, "c1/p1.webp", null)), publisherId);

        assertThat(chapter.getStatus()).isEqualTo(ChapterStatus.PENDING_REVIEW);
        verify(eventPublisher, never()).publish(any());
    }

    @Test
    @DisplayName("A chapter a moderator sent back (a draft) is published again with its new pages, keeping its identity")
    void aDraftIsPublishedAgain() {
        UserId publisherId = UserId.of("pub-1");
        Work work = Work.create("One Piece", "Pirates", WorkType.MANGA, "op.jpg", Set.of("Adventure"));
        Team team = givenATeamWorkingOn(work, publisherId);
        Chapter sentBack = Chapter.createDraft(work.getId(), ChapterNumber.of("1"), "Romance Dawn", team.getId());
        when(chapterRepository.findByWorkIdAndChapterNumberAndTeam(work.getId(), ChapterNumber.of("1"), team.getId())).thenReturn(Optional.of(sentBack));
        when(chapterRepository.save(any(Chapter.class))).thenAnswer(invocation -> invocation.getArgument(0));
        when(chapterRepository.hasPublishedChapter(team.getId())).thenReturn(false);

        Chapter chapter = service.directPublishChapter(work.getId(), team.getId(), "1", "Romance Dawn",
                List.of(PageAsset.create(1, "c1/fixed.webp", null)), publisherId);

        assertThat(chapter.getId()).isEqualTo(sentBack.getId());
        assertThat(chapter.getStatus()).isEqualTo(ChapterStatus.PENDING_REVIEW);
        assertThat(chapter.getPages()).extracting(PageAsset::storageKey).containsExactly("c1/fixed.webp");
    }

    private Team givenATeamWorkingOn(Work work, UserId leader) {
        Team team = Team.create(work.getTitle() + " Team", null, leader);
        when(workRepository.findById(work.getId())).thenReturn(Optional.of(work));
        when(teamRepository.findById(team.getId())).thenReturn(Optional.of(team));
        when(projectRepository.findByTeamId(team.getId()))
                .thenReturn(List.of(ScanlationProject.create(team.getName(), work.getId(), team.getId())));
        return team;
    }
}
