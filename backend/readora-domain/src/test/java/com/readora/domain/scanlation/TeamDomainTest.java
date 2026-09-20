package com.readora.domain.scanlation;

import com.readora.domain.common.DomainValidationException;
import com.readora.domain.common.UserId;
import com.readora.domain.work.ChapterNumber;
import com.readora.domain.work.WorkId;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class TeamDomainTest {

    private static final UserId LEADER = UserId.of("Leader1");
    private static final UserId ALICE = UserId.of("Alice");

    private Team team;
    private ScanlationProject project;
    private WorkflowTask task;

    @Test
    @DisplayName("A new team starts with its creator as leader")
    void newTeamHasItsCreatorAsLeader() {
        whenICreateTheTeam("  Shadow Scans ", "  We translate action series. ");

        thenTheTeamIsNamed("Shadow Scans");
        thenTheTeamIsDescribedAs("We translate action series.");
        thenTheMemberHasRole(LEADER, ScanlationRole.LEADER);
    }

    @Test
    @DisplayName("A blank description is no description")
    void blankDescriptionIsNone() {
        whenICreateTheTeam("Shadow Scans", "   ");

        thenTheTeamIsDescribedAs(null);
    }

    @Test
    @DisplayName("A team needs a name")
    void teamNeedsAName() {
        thenCreatingTheTeamIsRejected("   ", "name cannot be empty");
    }

    @Test
    @DisplayName("A team name longer than 255 characters is rejected")
    void teamNameHasAMaximumLength() {
        thenCreatingTheTeamIsRejected("x".repeat(Team.MAX_NAME_LENGTH + 1), "cannot exceed");
    }

    @Test
    @DisplayName("Adding a member again replaces their roles")
    void addingAMemberAgainReplacesTheirRoles() {
        givenTheTeam();
        givenTheMember(ALICE, ScanlationRole.TRANSLATOR);

        whenIAddTheMember(ALICE, ScanlationRole.PROOFREADER);

        thenTheTeamHasMembers(2);
        thenTheMemberHasRole(ALICE, ScanlationRole.PROOFREADER);
        thenTheMemberLacksRole(ALICE, ScanlationRole.TRANSLATOR);
    }

    @Test
    @DisplayName("A project only accepts its own team's roster")
    void projectRejectsAnotherTeamsRoster() {
        givenTheTeam();
        givenTheTeamHasATaskForChapter("5");

        thenClaimingTheTaskWithTheRosterOfIsRejected(Team.create("Moon Scans", null, LEADER));
        thenTheTaskIs(TaskStatus.PENDING);
    }

    private void givenTheTeam() {
        team = Team.create("Shadow Scans", null, LEADER);
    }

    private void givenTheTeamHasATaskForChapter(String number) {
        project = ScanlationProject.create("Shadow Scans - Solo Leveling", WorkId.generate(), team.getId());
        task = project.addChapterTask(ChapterNumber.of(number));
    }

    private void thenClaimingTheTaskWithTheRosterOfIsRejected(Team otherTeam) {
        assertThatThrownBy(() -> project.claimTask(otherTeam, task.getId(), LEADER)).isInstanceOf(IllegalArgumentException.class);
    }

    private void thenTheTaskIs(TaskStatus status) {
        assertThat(task.getStatus()).isEqualTo(status);
    }

    private void givenTheMember(UserId userId, ScanlationRole role) {
        team.addMember(TeamMember.of(userId, role));
    }

    private void whenICreateTheTeam(String name, String description) {
        team = Team.create(name, description, LEADER);
    }

    private void whenIAddTheMember(UserId userId, ScanlationRole role) {
        team.addMember(TeamMember.of(userId, role));
    }

    private void thenTheTeamIsNamed(String name) {
        assertThat(team.getName()).isEqualTo(name);
    }

    private void thenTheTeamIsDescribedAs(String description) {
        assertThat(team.getDescription()).isEqualTo(description);
    }

    private void thenTheTeamHasMembers(int count) {
        assertThat(team.getMembers()).hasSize(count);
    }

    private void thenTheMemberHasRole(UserId userId, ScanlationRole role) {
        assertThat(team.findMember(userId)).hasValueSatisfying(member -> assertThat(member.roles()).contains(role));
    }

    private void thenTheMemberLacksRole(UserId userId, ScanlationRole role) {
        assertThat(team.findMember(userId)).hasValueSatisfying(member -> assertThat(member.roles()).doesNotContain(role));
    }

    private void thenCreatingTheTeamIsRejected(String name, String reason) {
        assertThatThrownBy(() -> Team.create(name, null, LEADER))
                .isInstanceOf(DomainValidationException.class)
                .hasMessageContaining(reason);
    }
}
