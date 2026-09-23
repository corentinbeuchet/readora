package com.readora.domain.scanlation;

import com.readora.domain.common.CodedException;
import com.readora.domain.common.DomainValidationException;
import com.readora.domain.common.ErrorCodes;
import com.readora.domain.work.ChapterNumber;
import com.readora.domain.common.UserId;
import com.readora.domain.work.WorkId;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class ScanlationProjectDomainTest {

    @Test
    @DisplayName("Claiming a task without required role must be rejected")
    void claimingTaskWithoutRoleThrowsException() {
        Team team = Team.create("Asura - Solo Leveling", null, UserId.of("Leader1"));
        ScanlationProject project = ScanlationProject.create("Asura - Solo Leveling", WorkId.generate(), team.getId());
        team.addMember(TeamMember.of(UserId.of("Alice"), ScanlationRole.TRANSLATOR));
        WorkflowTask task = project.addChapterTask(ChapterNumber.of("5")); // RAW_UPLOADED stage requires CLEANER_REDRAWER

        assertThatThrownBy(() -> project.claimTask(team, task.getId(), UserId.of("Alice")))
                .isInstanceOf(DomainValidationException.class)
                .hasMessageContaining("User lacks required role");
    }

    @Test
    @DisplayName("QC approval of a task that has not reached QC_REVIEW is rejected")
    void qcApprovalBeforeQcReviewIsRejected() {
        Team team = Team.create("Asura - Solo Leveling", null, UserId.of("Leader1"));
        ScanlationProject project = ScanlationProject.create("Asura - Solo Leveling", WorkId.generate(), team.getId());
        WorkflowTask task = project.addChapterTask(ChapterNumber.of("5")); // RAW_UPLOADED

        assertThatThrownBy(() -> project.approveQualityCheck(team, task.getId(), UserId.of("Leader1")))
                .isInstanceOf(DomainValidationException.class)
                .hasMessageContaining("QC_REVIEW");
        assertThat(task.getStage()).isEqualTo(WorkflowStage.RAW_UPLOADED);
    }

    @Test
    @DisplayName("QC approval by a member without the QUALITY_CHECKER role is rejected")
    void qcApprovalWithoutRoleIsRejected() {
        Team team = Team.create("Asura - Solo Leveling", null, UserId.of("Leader1"));
        ScanlationProject project = ScanlationProject.create("Asura - Solo Leveling", WorkId.generate(), team.getId());
        team.addMember(TeamMember.of(UserId.of("Alice"), ScanlationRole.TRANSLATOR));
        WorkflowTask task = project.addChapterTask(ChapterNumber.of("5"));
        task.advanceStage(WorkflowStage.QC_REVIEW);

        assertThatThrownBy(() -> project.approveQualityCheck(team, task.getId(), UserId.of("Alice")))
                .isInstanceOf(DomainValidationException.class)
                .hasMessageContaining("QUALITY_CHECKER");
    }

    @Test
    @DisplayName("QC approval of a task in QC_REVIEW publishes it, once")
    void qcApprovalPublishesTask() {
        Team team = Team.create("Asura - Solo Leveling", null, UserId.of("Leader1"));
        ScanlationProject project = ScanlationProject.create("Asura - Solo Leveling", WorkId.generate(), team.getId());
        team.addMember(TeamMember.of(UserId.of("Charlie"), ScanlationRole.QUALITY_CHECKER));
        WorkflowTask task = project.addChapterTask(ChapterNumber.of("5"));
        task.advanceStage(WorkflowStage.QC_REVIEW);

        project.approveQualityCheck(team, task.getId(), UserId.of("Charlie"));

        assertThat(task.getStage()).isEqualTo(WorkflowStage.PUBLISHED);
        assertThatThrownBy(() -> project.approveQualityCheck(team, task.getId(), UserId.of("Charlie")))
                .isInstanceOf(DomainValidationException.class);
    }

    @Test
    @DisplayName("Leader can claim and advance workflow stages successfully")
    void leaderAdvancesWorkflow() {
        Team team = Team.create("Asura - Solo Leveling", null, UserId.of("Leader1"));
        ScanlationProject project = ScanlationProject.create("Asura - Solo Leveling", WorkId.generate(), team.getId());
        WorkflowTask task = project.addChapterTask(ChapterNumber.of("5"));

        project.claimTask(team, task.getId(), UserId.of("Leader1"));
        assertThat(task.getStatus()).isEqualTo(TaskStatus.IN_PROGRESS);

        project.submitTaskWork(team, task.getId(), UserId.of("Leader1"), "s3://media/cleaned.zip", 20);
        assertThat(task.getStage()).isEqualTo(WorkflowStage.TRANSLATING);
    }

    @Test
    @DisplayName("A member cannot claim a task already in progress for someone else")
    void claimingTaskHeldBySomeoneElseIsRejected() {
        Team team = Team.create("Asura", null, UserId.of("Leader1"));
        ScanlationProject project = ScanlationProject.create("Asura", WorkId.generate(), team.getId());
        team.addMember(TeamMember.of(UserId.of("Cleaner1"), ScanlationRole.CLEANER_REDRAWER));
        team.addMember(TeamMember.of(UserId.of("Cleaner2"), ScanlationRole.CLEANER_REDRAWER));
        WorkflowTask task = project.addChapterTask(ChapterNumber.of("5"));
        project.claimTask(team, task.getId(), UserId.of("Cleaner1"));

        assertThatThrownBy(() -> project.claimTask(team, task.getId(), UserId.of("Cleaner2")))
                .isInstanceOf(DomainValidationException.class)
                .hasMessageContaining("already claimed")
                .satisfies(e -> assertThat(((CodedException) e).code()).isEqualTo(ErrorCodes.TASK_ALREADY_CLAIMED));
        assertThat(task.getAssigneeId()).isEqualTo(UserId.of("Cleaner1"));
    }

    @Test
    @DisplayName("The leader can reassign a task that is in progress for someone else")
    void leaderCanReassignTask() {
        Team team = Team.create("Asura", null, UserId.of("Leader1"));
        ScanlationProject project = ScanlationProject.create("Asura", WorkId.generate(), team.getId());
        team.addMember(TeamMember.of(UserId.of("Cleaner1"), ScanlationRole.CLEANER_REDRAWER));
        WorkflowTask task = project.addChapterTask(ChapterNumber.of("5"));
        project.claimTask(team, task.getId(), UserId.of("Cleaner1"));

        project.claimTask(team, task.getId(), UserId.of("Leader1"));

        assertThat(task.getAssigneeId()).isEqualTo(UserId.of("Leader1"));
    }

    @Test
    @DisplayName("A member cannot submit work on a task claimed by someone else")
    void submittingTaskHeldBySomeoneElseIsRejected() {
        Team team = Team.create("Asura", null, UserId.of("Leader1"));
        ScanlationProject project = ScanlationProject.create("Asura", WorkId.generate(), team.getId());
        team.addMember(TeamMember.of(UserId.of("Cleaner1"), ScanlationRole.CLEANER_REDRAWER));
        team.addMember(TeamMember.of(UserId.of("Cleaner2"), ScanlationRole.CLEANER_REDRAWER));
        WorkflowTask task = project.addChapterTask(ChapterNumber.of("5"));
        project.claimTask(team, task.getId(), UserId.of("Cleaner1"));

        assertThatThrownBy(() -> project.submitTaskWork(team, task.getId(), UserId.of("Cleaner2"), "s3://x.zip", 10))
                .isInstanceOf(DomainValidationException.class)
                .hasMessageContaining("claimed by");
        assertThat(task.getStage()).isEqualTo(WorkflowStage.RAW_UPLOADED);
    }

    @Test
    @DisplayName("Published tasks can be neither claimed nor submitted, and QC_REVIEW tasks are not submitted")
    void closedStagesRejectClaimAndSubmit() {
        Team team = Team.create("Asura", null, UserId.of("Leader1"));
        ScanlationProject project = ScanlationProject.create("Asura", WorkId.generate(), team.getId());
        WorkflowTask published = project.addChapterTask(ChapterNumber.of("5"));
        published.advanceStage(WorkflowStage.PUBLISHED);
        WorkflowTask inQc = project.addChapterTask(ChapterNumber.of("6"));
        inQc.advanceStage(WorkflowStage.QC_REVIEW);

        assertThatThrownBy(() -> project.claimTask(team, published.getId(), UserId.of("Leader1")))
                .isInstanceOf(DomainValidationException.class).hasMessageContaining("already published");
        assertThatThrownBy(() -> project.submitTaskWork(team, published.getId(), UserId.of("Leader1"), "s3://x.zip", 1))
                .isInstanceOf(DomainValidationException.class).hasMessageContaining("already published");
        assertThatThrownBy(() -> project.submitTaskWork(team, inQc.getId(), UserId.of("Leader1"), "s3://x.zip", 1))
                .isInstanceOf(DomainValidationException.class).hasMessageContaining("QC approval");
    }
}
