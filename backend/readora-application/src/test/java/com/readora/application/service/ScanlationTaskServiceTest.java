package com.readora.application.service;

import com.readora.application.port.out.ChapterRepositoryPort;
import com.readora.application.port.out.EventPublisherPort;
import com.readora.application.port.out.ScanlationProjectRepositoryPort;
import com.readora.domain.common.DomainValidationException;
import com.readora.domain.scanlation.ProjectId;
import com.readora.domain.scanlation.ScanlationProject;
import com.readora.domain.scanlation.TaskAssignedEvent;
import com.readora.domain.scanlation.TaskStageAdvancedEvent;
import com.readora.domain.scanlation.WorkflowStage;
import com.readora.domain.scanlation.WorkflowTask;
import com.readora.domain.work.Chapter;
import com.readora.domain.work.ChapterNumber;
import com.readora.domain.work.UserId;
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

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class ScanlationTaskServiceTest {

    @Mock
    private ScanlationProjectRepositoryPort projectRepository;

    @Mock
    private ChapterRepositoryPort chapterRepository;

    @Mock
    private EventPublisherPort eventPublisher;

    private ScanlationTaskService taskService;

    @BeforeEach
    void setUp() {
        taskService = new ScanlationTaskService(projectRepository, chapterRepository, eventPublisher);
    }

    @Test
    @DisplayName("Upload chapter task by a project member creates task and draft chapter")
    void uploadChapterTaskAsMemberSucceeds() {
        UserId leaderId = UserId.of("leader-1");
        WorkId workId = WorkId.generate();
        ScanlationProject project = ScanlationProject.create("Asura Scans", workId, leaderId);
        ProjectId projectId = project.getId();

        when(projectRepository.findById(projectId)).thenReturn(Optional.of(project));
        when(projectRepository.save(any(ScanlationProject.class))).thenAnswer(i -> i.getArgument(0));
        when(chapterRepository.findByWorkId(workId)).thenReturn(List.of());
        when(chapterRepository.save(any(Chapter.class))).thenAnswer(i -> i.getArgument(0));

        WorkflowTask task = taskService.uploadChapterTask(
                projectId,
                ChapterNumber.of("1"),
                "scans/solo-leveling/1/raw.zip",
                20,
                leaderId
        );

        assertThat(task).isNotNull();
        assertThat(task.getChapterNumber()).isEqualTo(ChapterNumber.of("1"));
        assertThat(task.getStage()).isEqualTo(WorkflowStage.RAW_UPLOADED);
        assertThat(task.getAssetPackageUrl()).isEqualTo("scans/solo-leveling/1/raw.zip");
        assertThat(task.getPageCount()).isEqualTo(20);

        verify(projectRepository).save(project);
        ArgumentCaptor<Chapter> chapterCaptor = ArgumentCaptor.forClass(Chapter.class);
        verify(chapterRepository).save(chapterCaptor.capture());
        Chapter draft = chapterCaptor.getValue();
        assertThat(draft.getChapterNumber()).isEqualTo(ChapterNumber.of("1"));
        assertThat(draft.getPages()).hasSize(20);
    }

    @Test
    @DisplayName("Upload chapter task by a non-member throws DomainValidationException")
    void uploadChapterTaskAsNonMemberThrows() {
        UserId leaderId = UserId.of("leader-1");
        UserId nonMemberId = UserId.of("stranger-1");
        ScanlationProject project = ScanlationProject.create("Asura Scans", WorkId.generate(), leaderId);
        ProjectId projectId = project.getId();

        when(projectRepository.findById(projectId)).thenReturn(Optional.of(project));

        assertThatThrownBy(() -> taskService.uploadChapterTask(
                projectId,
                ChapterNumber.of("1"),
                "scans/solo-leveling/1/raw.zip",
                20,
                nonMemberId
        )).isInstanceOf(DomainValidationException.class)
                .hasMessageContaining("not a member");

        verify(projectRepository, never()).save(any());
        verify(chapterRepository, never()).save(any());
    }

    @Test
    @DisplayName("Claiming a task publishes TaskAssignedEvent even though save returns a rebuilt copy")
    void claimPublishesEventsFromMutatedAggregate() {
        UserId leaderId = UserId.of("leader-1");
        ScanlationProject project = ScanlationProject.create("Asura Scans", WorkId.generate(), leaderId);
        WorkflowTask task = project.addChapterTask(ChapterNumber.of("1"));
        project.pollDomainEvents();

        when(projectRepository.findById(project.getId())).thenReturn(Optional.of(project));
        when(projectRepository.save(any(ScanlationProject.class))).thenAnswer(i -> rebuilt(i.getArgument(0)));

        WorkflowTask claimed = taskService.claimTask(project.getId(), task.getId(), leaderId);

        assertThat(claimed.getAssigneeId()).isEqualTo(leaderId);
        verify(eventPublisher).publish(any(TaskAssignedEvent.class));
    }

    @Test
    @DisplayName("Submitting work publishes TaskStageAdvancedEvent even though save returns a rebuilt copy")
    void submitPublishesEventsFromMutatedAggregate() {
        UserId leaderId = UserId.of("leader-1");
        ScanlationProject project = ScanlationProject.create("Asura Scans", WorkId.generate(), leaderId);
        WorkflowTask task = project.addChapterTask(ChapterNumber.of("1"));
        project.pollDomainEvents();

        when(projectRepository.findById(project.getId())).thenReturn(Optional.of(project));
        when(projectRepository.save(any(ScanlationProject.class))).thenAnswer(i -> rebuilt(i.getArgument(0)));

        taskService.submitWork(project.getId(), task.getId(), leaderId, "scans/1/clean.zip", 20);

        verify(eventPublisher).publish(any(TaskStageAdvancedEvent.class));
    }

    @Test
    @DisplayName("Publishing from QC a task still in translation is rejected and nothing is saved")
    void publishFromQcBeforeQcReviewSavesNothing() {
        UserId leaderId = UserId.of("leader-1");
        ScanlationProject project = ScanlationProject.create("Asura Scans", WorkId.generate(), leaderId);
        WorkflowTask task = project.addChapterTask(ChapterNumber.of("1"), "scans/1/raw.zip", 20);
        task.advanceStage(WorkflowStage.TRANSLATING);

        when(projectRepository.findById(project.getId())).thenReturn(Optional.of(project));

        assertThatThrownBy(() -> taskService.publishChapterFromQC(project.getId(), task.getId(), leaderId))
                .isInstanceOf(DomainValidationException.class)
                .hasMessageContaining("QC_REVIEW");
        verify(projectRepository, never()).save(any());
        verify(chapterRepository, never()).save(any());
        verify(eventPublisher, never()).publish(any());
    }

    /// Mimics the JPA adapter: `save` returns a new instance rebuilt from state, without pending events.
    private static ScanlationProject rebuilt(ScanlationProject source) {
        return new ScanlationProject(source.getId(), source.getName(), source.getWorkId(), source.getMembers(),
                source.getTasks(), source.getCreatedAt(), source.getUpdatedAt());
    }

    @Test
    @DisplayName("Upload chapter task with duplicate chapter throws DomainValidationException")
    void uploadDuplicateChapterThrows() {
        UserId leaderId = UserId.of("leader-1");
        ScanlationProject project = ScanlationProject.create("Asura Scans", WorkId.generate(), leaderId);
        project.addChapterTask(ChapterNumber.of("1"));
        ProjectId projectId = project.getId();

        when(projectRepository.findById(projectId)).thenReturn(Optional.of(project));

        assertThatThrownBy(() -> taskService.uploadChapterTask(
                projectId,
                ChapterNumber.of("1"),
                "scans/solo-leveling/1/raw.zip",
                20,
                leaderId
        )).isInstanceOf(DomainValidationException.class)
                .hasMessageContaining("already exists");
    }
}
