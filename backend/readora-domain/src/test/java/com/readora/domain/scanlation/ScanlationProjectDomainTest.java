package com.readora.domain.scanlation;

import com.readora.domain.common.DomainValidationException;
import com.readora.domain.work.ChapterNumber;
import com.readora.domain.work.UserId;
import com.readora.domain.work.WorkId;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class ScanlationProjectDomainTest {

    @Test
    @DisplayName("Claiming a task without required role must be rejected")
    void claimingTaskWithoutRoleThrowsException() {
        ScanlationProject project = ScanlationProject.create("Asura - Solo Leveling", WorkId.generate(), UserId.of("Leader1"));
        project.addMember(TeamMember.of(UserId.of("Alice"), ScanlationRole.TRANSLATOR));
        WorkflowTask task = project.addChapterTask(ChapterNumber.of("5")); // RAW_UPLOADED stage requires CLEANER_REDRAWER

        assertThatThrownBy(() -> project.claimTask(task.getId(), UserId.of("Alice")))
                .isInstanceOf(DomainValidationException.class)
                .hasMessageContaining("User lacks required role");
    }

    @Test
    @DisplayName("QC approval of a task that has not reached QC_REVIEW is rejected")
    void qcApprovalBeforeQcReviewIsRejected() {
        ScanlationProject project = ScanlationProject.create("Asura - Solo Leveling", WorkId.generate(), UserId.of("Leader1"));
        WorkflowTask task = project.addChapterTask(ChapterNumber.of("5")); // RAW_UPLOADED

        assertThatThrownBy(() -> project.approveQualityCheck(task.getId(), UserId.of("Leader1")))
                .isInstanceOf(DomainValidationException.class)
                .hasMessageContaining("QC_REVIEW");
        assertThat(task.getStage()).isEqualTo(WorkflowStage.RAW_UPLOADED);
    }

    @Test
    @DisplayName("QC approval by a member without the QUALITY_CHECKER role is rejected")
    void qcApprovalWithoutRoleIsRejected() {
        ScanlationProject project = ScanlationProject.create("Asura - Solo Leveling", WorkId.generate(), UserId.of("Leader1"));
        project.addMember(TeamMember.of(UserId.of("Alice"), ScanlationRole.TRANSLATOR));
        WorkflowTask task = project.addChapterTask(ChapterNumber.of("5"));
        task.advanceStage(WorkflowStage.QC_REVIEW);

        assertThatThrownBy(() -> project.approveQualityCheck(task.getId(), UserId.of("Alice")))
                .isInstanceOf(DomainValidationException.class)
                .hasMessageContaining("QUALITY_CHECKER");
    }

    @Test
    @DisplayName("QC approval of a task in QC_REVIEW publishes it and completes the workflow")
    void qcApprovalPublishesTask() {
        ScanlationProject project = ScanlationProject.create("Asura - Solo Leveling", WorkId.generate(), UserId.of("Leader1"));
        project.addMember(TeamMember.of(UserId.of("Charlie"), ScanlationRole.QUALITY_CHECKER));
        WorkflowTask task = project.addChapterTask(ChapterNumber.of("5"));
        task.advanceStage(WorkflowStage.QC_REVIEW);

        project.approveQualityCheck(task.getId(), UserId.of("Charlie"));

        assertThat(task.getStage()).isEqualTo(WorkflowStage.PUBLISHED);
        assertThat(project.pollDomainEvents())
                .hasAtLeastOneElementOfType(TaskStageAdvancedEvent.class)
                .hasAtLeastOneElementOfType(WorkflowCompletedEvent.class);
        assertThatThrownBy(() -> project.approveQualityCheck(task.getId(), UserId.of("Charlie")))
                .isInstanceOf(DomainValidationException.class);
    }

    @Test
    @DisplayName("Leader can claim and advance workflow stages successfully")
    void leaderAdvancesWorkflow() {
        ScanlationProject project = ScanlationProject.create("Asura - Solo Leveling", WorkId.generate(), UserId.of("Leader1"));
        WorkflowTask task = project.addChapterTask(ChapterNumber.of("5"));

        project.claimTask(task.getId(), UserId.of("Leader1"));
        assertThat(task.getStatus()).isEqualTo(TaskStatus.IN_PROGRESS);

        project.submitTaskWork(task.getId(), UserId.of("Leader1"), "s3://media/cleaned.zip", 20);
        assertThat(task.getStage()).isEqualTo(WorkflowStage.TRANSLATING);
    }

    @Test
    @DisplayName("A member cannot claim a task already in progress for someone else")
    void claimingTaskHeldBySomeoneElseIsRejected() {
        ScanlationProject project = ScanlationProject.create("Asura", WorkId.generate(), UserId.of("Leader1"));
        project.addMember(TeamMember.of(UserId.of("Cleaner1"), ScanlationRole.CLEANER_REDRAWER));
        project.addMember(TeamMember.of(UserId.of("Cleaner2"), ScanlationRole.CLEANER_REDRAWER));
        WorkflowTask task = project.addChapterTask(ChapterNumber.of("5"));
        project.claimTask(task.getId(), UserId.of("Cleaner1"));

        assertThatThrownBy(() -> project.claimTask(task.getId(), UserId.of("Cleaner2")))
                .isInstanceOf(DomainValidationException.class)
                .hasMessageContaining("already claimed");
        assertThat(task.getAssigneeId()).isEqualTo(UserId.of("Cleaner1"));
    }

    @Test
    @DisplayName("The leader can reassign a task that is in progress for someone else")
    void leaderCanReassignTask() {
        ScanlationProject project = ScanlationProject.create("Asura", WorkId.generate(), UserId.of("Leader1"));
        project.addMember(TeamMember.of(UserId.of("Cleaner1"), ScanlationRole.CLEANER_REDRAWER));
        WorkflowTask task = project.addChapterTask(ChapterNumber.of("5"));
        project.claimTask(task.getId(), UserId.of("Cleaner1"));

        project.claimTask(task.getId(), UserId.of("Leader1"));

        assertThat(task.getAssigneeId()).isEqualTo(UserId.of("Leader1"));
    }

    @Test
    @DisplayName("A member cannot submit work on a task claimed by someone else")
    void submittingTaskHeldBySomeoneElseIsRejected() {
        ScanlationProject project = ScanlationProject.create("Asura", WorkId.generate(), UserId.of("Leader1"));
        project.addMember(TeamMember.of(UserId.of("Cleaner1"), ScanlationRole.CLEANER_REDRAWER));
        project.addMember(TeamMember.of(UserId.of("Cleaner2"), ScanlationRole.CLEANER_REDRAWER));
        WorkflowTask task = project.addChapterTask(ChapterNumber.of("5"));
        project.claimTask(task.getId(), UserId.of("Cleaner1"));

        assertThatThrownBy(() -> project.submitTaskWork(task.getId(), UserId.of("Cleaner2"), "s3://x.zip", 10))
                .isInstanceOf(DomainValidationException.class)
                .hasMessageContaining("claimed by");
        assertThat(task.getStage()).isEqualTo(WorkflowStage.RAW_UPLOADED);
    }

    @Test
    @DisplayName("Published tasks can be neither claimed nor submitted, and QC_REVIEW tasks are not submitted")
    void closedStagesRejectClaimAndSubmit() {
        ScanlationProject project = ScanlationProject.create("Asura", WorkId.generate(), UserId.of("Leader1"));
        WorkflowTask published = project.addChapterTask(ChapterNumber.of("5"));
        published.advanceStage(WorkflowStage.PUBLISHED);
        WorkflowTask inQc = project.addChapterTask(ChapterNumber.of("6"));
        inQc.advanceStage(WorkflowStage.QC_REVIEW);

        assertThatThrownBy(() -> project.claimTask(published.getId(), UserId.of("Leader1")))
                .isInstanceOf(DomainValidationException.class).hasMessageContaining("already published");
        assertThatThrownBy(() -> project.submitTaskWork(published.getId(), UserId.of("Leader1"), "s3://x.zip", 1))
                .isInstanceOf(DomainValidationException.class).hasMessageContaining("already published");
        assertThatThrownBy(() -> project.submitTaskWork(inQc.getId(), UserId.of("Leader1"), "s3://x.zip", 1))
                .isInstanceOf(DomainValidationException.class).hasMessageContaining("QC approval");
    }
}
