package com.readora.application.service;

import com.readora.domain.common.UserId;
import com.readora.application.port.in.ManageWorkUseCase;
import com.readora.application.port.out.ChapterRepositoryPort;
import com.readora.application.port.out.EventPublisherPort;
import com.readora.application.port.out.ScanlationProjectRepositoryPort;
import com.readora.application.port.out.TeamRepositoryPort;
import com.readora.application.port.out.UserAccountRepositoryPort;
import com.readora.application.port.out.WorkRepositoryPort;
import com.readora.domain.common.AccessDeniedDomainException;
import com.readora.domain.common.DomainValidationException;
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

    @BeforeEach
    void setUp() {
        workRepository = mock(WorkRepositoryPort.class);
        chapterRepository = mock(ChapterRepositoryPort.class);
        projectRepository = mock(ScanlationProjectRepositoryPort.class);
        teamRepository = mock(TeamRepositoryPort.class);
        userRepository = mock(UserAccountRepositoryPort.class);
        eventPublisher = mock(EventPublisherPort.class);
        service = new WorkManagementService(workRepository, chapterRepository, projectRepository, teamRepository, userRepository, eventPublisher);
    }

    @Test
    @DisplayName("Successfully create a new work and auto-create a scanlation workspace project")
    void createWorkSuccess() {
        UserId creatorId = UserId.of("creator-123");
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
                Set.of("Action", "Fantasy")
        ), creatorId);

        assertThat(work).isNotNull();
        assertThat(work.getTitle()).isEqualTo("Solo Leveling");
        assertThat(work.getType()).isEqualTo(WorkType.MANHWA);
        assertThat(work.getGenres()).containsExactlyInAnyOrder("Action", "Fantasy");
        assertThat(work.getAuthor()).isEqualTo("Chugong");
        assertThat(work.getDemographic()).isEqualTo(Demographic.SHOUNEN);

        ArgumentCaptor<ScanlationProject> projectCaptor = ArgumentCaptor.forClass(ScanlationProject.class);
        verify(projectRepository).save(projectCaptor.capture());
        ScanlationProject project = projectCaptor.getValue();
        assertThat(project.getName()).isEqualTo("Solo Leveling Workspace");
        assertThat(project.getWorkId()).isEqualTo(work.getId());

        ArgumentCaptor<Team> teamCaptor = ArgumentCaptor.forClass(Team.class);
        verify(teamRepository).save(teamCaptor.capture());
        Team team = teamCaptor.getValue();
        assertThat(team.getName()).isEqualTo("Solo Leveling Workspace");
        assertThat(team.findMember(creatorId)).hasValueSatisfying(member -> assertThat(member.roles()).containsExactly(ScanlationRole.LEADER));
        assertThat(project.getTeamId()).isEqualTo(team.getId());
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
    @DisplayName("Directly publish a chapter with ordered pages")
    void directPublishChapterSuccess() {
        UserId publisherId = UserId.of("pub-1");
        Work work = Work.create("One Piece", "Pirates", WorkType.MANGA, "op.jpg", Set.of("Adventure"));
        Team team = Team.create("One Piece Workspace", null, publisherId);
        ScanlationProject project = ScanlationProject.create("One Piece Workspace", work.getId(), team.getId());
        when(workRepository.findById(work.getId())).thenReturn(Optional.of(work));
        when(projectRepository.findByWorkId(work.getId())).thenReturn(List.of(project));
        when(teamRepository.findAllById(List.of(team.getId()))).thenReturn(List.of(team));
        when(chapterRepository.save(any(Chapter.class))).thenAnswer(invocation -> invocation.getArgument(0));

        List<PageAsset> pages = List.of(
                PageAsset.create(1, "c1/p1.webp", "https://cdn.readora.com/c1/p1.webp"),
                PageAsset.create(2, "c1/p2.webp", "https://cdn.readora.com/c1/p2.webp")
        );

        Chapter chapter = service.directPublishChapter(work.getId(), "1", "Romance Dawn", pages, publisherId);

        assertThat(chapter).isNotNull();
        assertThat(chapter.getChapterNumber().value()).isEqualTo("1");
        assertThat(chapter.getStatus()).isEqualTo(ChapterStatus.PUBLISHED);
        assertThat(chapter.getPages()).hasSize(2);
        verify(eventPublisher, atLeastOnce()).publish(any());
    }

    @Test
    @DisplayName("Directly publishing duplicate chapter number throws exception")
    void directPublishDuplicateChapterThrowsException() {
        UserId publisherId = UserId.of("pub-1");
        Work work = Work.create("One Piece", "Pirates", WorkType.MANGA, "op.jpg", Set.of("Adventure"));
        Chapter existing = Chapter.createDraft(work.getId(), ChapterNumber.of("1"), "Existing", null);

        when(workRepository.findById(work.getId())).thenReturn(Optional.of(work));
        Team team = Team.create("One Piece Workspace", null, publisherId);
        when(projectRepository.findByWorkId(work.getId()))
                .thenReturn(List.of(ScanlationProject.create("One Piece Workspace", work.getId(), team.getId())));
        when(teamRepository.findAllById(List.of(team.getId()))).thenReturn(List.of(team));
        when(chapterRepository.findByWorkIdAndChapterNumber(work.getId(), ChapterNumber.of("1"))).thenReturn(Optional.of(existing));

        List<PageAsset> pages = List.of(PageAsset.create(1, "c1/p1.webp", "https://cdn.readora.com/c1/p1.webp"));

        assertThatThrownBy(() -> service.directPublishChapter(work.getId(), "1", "Duplicate", pages, publisherId))
                .isInstanceOf(DomainValidationException.class)
                .hasMessageContaining("already exists");
    }

    @Test
    @DisplayName("A scanlator who is not a leader or quality checker of the work's project cannot publish into it")
    void directPublishByOutsiderIsDenied() {
        Work work = Work.create("One Piece", "Pirates", WorkType.MANGA, "op.jpg", Set.of("Adventure"));
        Team team = Team.create("One Piece Workspace", null, UserId.of("owner"));
        ScanlationProject project = ScanlationProject.create("One Piece Workspace", work.getId(), team.getId());
        UserId outsider = UserId.of("outsider");
        when(workRepository.findById(work.getId())).thenReturn(Optional.of(work));
        when(projectRepository.findByWorkId(work.getId())).thenReturn(List.of(project));
        when(teamRepository.findAllById(List.of(team.getId()))).thenReturn(List.of(team));
        when(userRepository.findById(outsider)).thenReturn(Optional.empty());

        List<PageAsset> pages = List.of(PageAsset.create(1, "c1/p1.webp", null));

        assertThatThrownBy(() -> service.directPublishChapter(work.getId(), "1", "Hijack", pages, outsider))
                .isInstanceOf(AccessDeniedDomainException.class);
        verify(chapterRepository, never()).save(any());
    }

    @Test
    @DisplayName("An admin can publish into a work without being a project member")
    void directPublishByAdminIsAllowed() {
        Work work = Work.create("One Piece", "Pirates", WorkType.MANGA, "op.jpg", Set.of("Adventure"));
        UserId adminId = UserId.of("admin");
        UserAccount admin = mock(UserAccount.class);
        when(admin.can(com.readora.domain.identity.Permission.USER_MANAGE)).thenReturn(true);
        when(workRepository.findById(work.getId())).thenReturn(Optional.of(work));
        when(projectRepository.findByWorkId(work.getId())).thenReturn(List.of());
        when(userRepository.findById(adminId)).thenReturn(Optional.of(admin));
        when(chapterRepository.save(any(Chapter.class))).thenAnswer(invocation -> invocation.getArgument(0));

        Chapter chapter = service.directPublishChapter(work.getId(), "1", "Admin", List.of(PageAsset.create(1, "p1.webp", null)), adminId);

        assertThat(chapter.isPublished()).isTrue();
    }
}
