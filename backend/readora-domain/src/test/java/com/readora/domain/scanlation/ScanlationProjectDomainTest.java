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
    @DisplayName("Leader can claim and advance workflow stages successfully")
    void leaderAdvancesWorkflow() {
        ScanlationProject project = ScanlationProject.create("Asura - Solo Leveling", WorkId.generate(), UserId.of("Leader1"));
        WorkflowTask task = project.addChapterTask(ChapterNumber.of("5"));

        project.claimTask(task.getId(), UserId.of("Leader1"));
        assertThat(task.getStatus()).isEqualTo(TaskStatus.IN_PROGRESS);

        project.submitTaskWork(task.getId(), UserId.of("Leader1"), "s3://media/cleaned.zip", 20);
        assertThat(task.getStage()).isEqualTo(WorkflowStage.TRANSLATING);
    }
}
