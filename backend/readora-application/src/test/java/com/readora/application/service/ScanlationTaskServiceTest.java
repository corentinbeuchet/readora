package com.readora.application.service;

import com.readora.application.port.out.ChapterRepositoryPort;
import com.readora.application.port.out.EventPublisherPort;
import com.readora.application.port.out.ScanlationProjectRepositoryPort;
import com.readora.application.port.out.TeamRepositoryPort;
import com.readora.domain.common.DomainValidationException;
import com.readora.domain.common.ErrorCodes;
import com.readora.domain.common.UserId;
import com.readora.domain.scanlation.ProjectId;
import com.readora.domain.scanlation.ScanlationProject;
import com.readora.domain.scanlation.Team;
import com.readora.domain.scanlation.WorkflowStage;
import com.readora.domain.scanlation.WorkflowTask;
import com.readora.domain.work.Chapter;
import com.readora.domain.work.ChapterNumber;
import com.readora.domain.work.ChapterPublishedEvent;
import com.readora.domain.work.PageAsset;
import com.readora.domain.work.WorkId;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.List;
import java.util.Optional;
import java.util.stream.IntStream;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class ScanlationTaskServiceTest {

    @Mock
    private ScanlationProjectRepositoryPort projectRepository;

    @Mock
    private TeamRepositoryPort teamRepository;

    @Mock
    private ChapterRepositoryPort chapterRepository;

    @Mock
    private EventPublisherPort eventPublisher;

    private ScanlationTaskService taskService;

    @BeforeEach
    void setUp() {
        taskService = new ScanlationTaskService(projectRepository, teamRepository, chapterRepository, eventPublisher);
    }

    @Test
    @DisplayName("Upload chapter task by a project member puts the raw pages on the board, and no chapter yet")
    void uploadChapterTaskAsMemberSucceeds() {
        UserId leaderId = UserId.of("leader-1");
        WorkId workId = WorkId.generate();
        Team team = Team.create("Asura Scans", null, leaderId);
        ScanlationProject project = ScanlationProject.create("Asura Scans", workId, team.getId());
        project.turnBoardOn();
        ProjectId projectId = project.getId();

        when(projectRepository.findById(projectId)).thenReturn(Optional.of(project));
        when(teamRepository.findById(team.getId())).thenReturn(Optional.of(team));
        when(projectRepository.save(any(ScanlationProject.class))).thenAnswer(i -> i.getArgument(0));

        WorkflowTask task = taskService.uploadChapterTask(projectId, ChapterNumber.of("1"), pages(20), leaderId);

        assertThat(task).isNotNull();
        assertThat(task.getChapterNumber()).isEqualTo(ChapterNumber.of("1"));
        assertThat(task.getStage()).isEqualTo(WorkflowStage.RAW_UPLOADED);
        assertThat(task.getPages()).isEqualTo(pages(20));

        verify(projectRepository).save(project);
        verify(chapterRepository, never()).save(any());
    }

    @Test
    @DisplayName("Upload chapter task by a non-member throws DomainValidationException")
    void uploadChapterTaskAsNonMemberThrows() {
        UserId leaderId = UserId.of("leader-1");
        UserId nonMemberId = UserId.of("stranger-1");
        Team team = Team.create("Asura Scans", null, leaderId);
        ScanlationProject project = ScanlationProject.create("Asura Scans", WorkId.generate(), team.getId());
        ProjectId projectId = project.getId();

        when(projectRepository.findById(projectId)).thenReturn(Optional.of(project));
        when(teamRepository.findById(team.getId())).thenReturn(Optional.of(team));

        assertThatThrownBy(() -> taskService.uploadChapterTask(projectId, ChapterNumber.of("1"), pages(20), nonMemberId)).isInstanceOf(DomainValidationException.class)
                .hasMessageContaining("not a member");

        verify(projectRepository, never()).save(any());
        verify(chapterRepository, never()).save(any());
    }

    @Test
    @DisplayName("Claiming a task returns it assigned even though save returns a rebuilt copy")
    void claimReturnsTheTaskFromTheMutatedAggregate() {
        UserId leaderId = UserId.of("leader-1");
        Team team = Team.create("Asura Scans", null, leaderId);
        ScanlationProject project = ScanlationProject.create("Asura Scans", WorkId.generate(), team.getId());
        WorkflowTask task = project.addChapterTask(ChapterNumber.of("1"));
        project.pollDomainEvents();

        when(projectRepository.findById(project.getId())).thenReturn(Optional.of(project));
        when(teamRepository.findById(team.getId())).thenReturn(Optional.of(team));
        when(projectRepository.save(any(ScanlationProject.class))).thenAnswer(i -> rebuilt(i.getArgument(0)));

        WorkflowTask claimed = taskService.claimTask(project.getId(), task.getId(), leaderId);

        assertThat(claimed.getAssigneeId()).isEqualTo(leaderId);
    }

    @Test
    @DisplayName("Publishing from QC publishes ChapterPublishedEvent from the chapter it mutated, not the saved copy")
    void publishFromQcPublishesTheChapterEvent() {
        UserId leaderId = UserId.of("leader-1");
        Team team = Team.create("Asura Scans", null, leaderId);
        ScanlationProject project = ScanlationProject.create("Asura Scans", WorkId.generate(), team.getId());
        WorkflowTask task = project.addChapterTask(ChapterNumber.of("1"), pages(20));
        task.advanceStage(WorkflowStage.QC_REVIEW);

        when(projectRepository.findById(project.getId())).thenReturn(Optional.of(project));
        when(teamRepository.findById(team.getId())).thenReturn(Optional.of(team));
        when(chapterRepository.findByWorkIdAndChapterNumberAndTeam(project.getWorkId(), ChapterNumber.of("1"), team.getId()))
                .thenReturn(Optional.empty());

        taskService.publishChapterFromQC(project.getId(), task.getId(), leaderId);

        verify(eventPublisher).publish(any(ChapterPublishedEvent.class));
    }

    @Test
    @DisplayName("Publishing from QC puts the task's pages on the chapter, in order")
    void publishFromQcPublishesTheTaskPages() {
        UserId leaderId = UserId.of("leader-1");
        Team team = Team.create("Asura Scans", null, leaderId);
        ScanlationProject project = ScanlationProject.create("Asura Scans", WorkId.generate(), team.getId());
        WorkflowTask task = project.addChapterTask(ChapterNumber.of("1"), pages(3));
        task.advanceStage(WorkflowStage.QC_REVIEW);
        when(projectRepository.findById(project.getId())).thenReturn(Optional.of(project));
        when(teamRepository.findById(team.getId())).thenReturn(Optional.of(team));
        when(chapterRepository.findByWorkIdAndChapterNumberAndTeam(project.getWorkId(), ChapterNumber.of("1"), team.getId()))
                .thenReturn(Optional.empty());

        taskService.publishChapterFromQC(project.getId(), task.getId(), leaderId);

        ArgumentCaptor<Chapter> saved = ArgumentCaptor.forClass(Chapter.class);
        verify(chapterRepository).save(saved.capture());
        assertThat(saved.getValue().getPages()).extracting(PageAsset::storageKey)
                .containsExactly("scans/test/p1.webp", "scans/test/p2.webp", "scans/test/p3.webp");
    }

    @Test
    @DisplayName("Publishing from QC a task without pages is refused and nothing is saved")
    void publishFromQcWithoutPagesIsRefused() {
        UserId leaderId = UserId.of("leader-1");
        Team team = Team.create("Asura Scans", null, leaderId);
        ScanlationProject project = ScanlationProject.create("Asura Scans", WorkId.generate(), team.getId());
        WorkflowTask task = project.addChapterTask(ChapterNumber.of("1"));
        task.advanceStage(WorkflowStage.QC_REVIEW);
        when(projectRepository.findById(project.getId())).thenReturn(Optional.of(project));
        when(teamRepository.findById(team.getId())).thenReturn(Optional.of(team));

        assertThatThrownBy(() -> taskService.publishChapterFromQC(project.getId(), task.getId(), leaderId))
                .isInstanceOfSatisfying(DomainValidationException.class, e -> assertThat(e.code()).isEqualTo(ErrorCodes.TASK_HAS_NO_PAGES));
        verify(projectRepository, never()).save(any());
        verify(chapterRepository, never()).save(any());
    }

    @Test
    @DisplayName("Publishing from QC a task still in translation is rejected and nothing is saved")
    void publishFromQcBeforeQcReviewSavesNothing() {
        UserId leaderId = UserId.of("leader-1");
        Team team = Team.create("Asura Scans", null, leaderId);
        ScanlationProject project = ScanlationProject.create("Asura Scans", WorkId.generate(), team.getId());
        WorkflowTask task = project.addChapterTask(ChapterNumber.of("1"), pages(20));
        task.advanceStage(WorkflowStage.TRANSLATING);

        when(projectRepository.findById(project.getId())).thenReturn(Optional.of(project));
        when(teamRepository.findById(team.getId())).thenReturn(Optional.of(team));

        assertThatThrownBy(() -> taskService.publishChapterFromQC(project.getId(), task.getId(), leaderId))
                .isInstanceOf(DomainValidationException.class)
                .hasMessageContaining("QC_REVIEW");
        verify(projectRepository, never()).save(any());
        verify(chapterRepository, never()).save(any());
        verify(eventPublisher, never()).publish(any());
    }

    private static List<PageAsset> pages(int count) {
        return IntStream.rangeClosed(1, count)
                .mapToObj(n -> new PageAsset(n, "scans/test/p" + n + ".webp", "https://cdn.test/p" + n + ".webp", 800, 1200))
                .toList();
    }

    /// Mimics the JPA adapter: `save` returns a new instance rebuilt from state, without pending events.
    private static ScanlationProject rebuilt(ScanlationProject source) {
        return new ScanlationProject(source.getId(), source.getName(), source.getWorkId(), source.getTeamId(),
                source.getTasks(), source.isBoardEnabled(), source.getCreatedAt(), source.getUpdatedAt());
    }

    @Test
    @DisplayName("A raw chapter cannot go on a board the team has not turned on, and nothing is saved")
    void uploadOnABoardThatIsOffIsRefused() {
        UserId leaderId = UserId.of("leader-1");
        Team team = Team.create("Asura Scans", null, leaderId);
        ScanlationProject project = ScanlationProject.create("Asura Scans", WorkId.generate(), team.getId());
        when(projectRepository.findById(project.getId())).thenReturn(Optional.of(project));
        when(teamRepository.findById(team.getId())).thenReturn(Optional.of(team));

        assertThatThrownBy(() -> taskService.uploadChapterTask(project.getId(), ChapterNumber.of("1"), pages(20), leaderId))
                .isInstanceOfSatisfying(DomainValidationException.class, e -> assertThat(e.code()).isEqualTo(ErrorCodes.BOARD_OFF));
        verify(projectRepository, never()).save(any());
    }

    @Test
    @DisplayName("Upload chapter task with duplicate chapter throws DomainValidationException")
    void uploadDuplicateChapterThrows() {
        UserId leaderId = UserId.of("leader-1");
        Team team = Team.create("Asura Scans", null, leaderId);
        ScanlationProject project = ScanlationProject.create("Asura Scans", WorkId.generate(), team.getId());
        project.turnBoardOn();
        project.addChapterTask(ChapterNumber.of("1"));
        ProjectId projectId = project.getId();

        when(projectRepository.findById(projectId)).thenReturn(Optional.of(project));
        when(teamRepository.findById(team.getId())).thenReturn(Optional.of(team));

        assertThatThrownBy(() -> taskService.uploadChapterTask(projectId, ChapterNumber.of("1"), pages(20), leaderId)).isInstanceOf(DomainValidationException.class)
                .hasMessageContaining("already exists");
    }
}
