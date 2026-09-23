package com.readora.domain.scanlation;

import com.readora.domain.common.AccessDeniedDomainException;
import com.readora.domain.common.DomainValidationException;
import com.readora.domain.common.ErrorCodes;
import com.readora.domain.common.UserId;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.time.Instant;
import java.util.Set;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class TeamInvitationTest {

    private static final Instant NOW = Instant.parse("2026-09-23T10:00:00Z");
    private static final UserId MINA = UserId.of("mina");
    private static final UserId BOB = UserId.of("bob");

    private final Team team = Team.create("Moon Scans", null, MINA);

    @Test
    @DisplayName("An invitation is pending and announced; the reader is not on the team until they accept")
    void invitingAnnouncesAndWaits() {
        TeamInvitation invitation = TeamInvitation.create(team, BOB, Set.of(ScanlationRole.TRANSLATOR), MINA, NOW);

        assertThat(invitation.isPending()).isTrue();
        assertThat(invitation.getDomainEvents()).singleElement().isInstanceOf(TeamInvitedEvent.class);
        assertThat(team.findMember(BOB)).isEmpty();
    }

    @Test
    @DisplayName("Accepting adds the reader with the invited roles, once")
    void acceptingJoinsTheTeam() {
        TeamInvitation invitation = TeamInvitation.create(team, BOB, Set.of(ScanlationRole.TRANSLATOR, ScanlationRole.PROOFREADER), MINA, NOW);

        invitation.accept(team, BOB, NOW);

        assertThat(invitation.getStatus()).isEqualTo(InvitationStatus.ACCEPTED);
        assertThat(team.findMember(BOB)).hasValueSatisfying(member ->
                assertThat(member.roles()).containsExactlyInAnyOrder(ScanlationRole.TRANSLATOR, ScanlationRole.PROOFREADER));
        assertThatThrownBy(() -> invitation.accept(team, BOB, NOW))
                .isInstanceOfSatisfying(DomainValidationException.class, e -> assertThat(e.code()).isEqualTo(ErrorCodes.ALREADY_HANDLED));
    }

    @Test
    @DisplayName("Only the invited reader answers; a closed invitation cannot be cancelled or declined")
    void onlyTheInviteeAnswers() {
        TeamInvitation invitation = TeamInvitation.create(team, BOB, Set.of(ScanlationRole.TRANSLATOR), MINA, NOW);

        assertThatThrownBy(() -> invitation.accept(team, MINA, NOW)).isInstanceOf(AccessDeniedDomainException.class);
        assertThatThrownBy(() -> invitation.decline(MINA, NOW)).isInstanceOf(AccessDeniedDomainException.class);

        invitation.decline(BOB, NOW);

        assertThat(invitation.getStatus()).isEqualTo(InvitationStatus.DECLINED);
        assertThatThrownBy(() -> invitation.cancel(NOW)).isInstanceOf(DomainValidationException.class);
    }

    @Test
    @DisplayName("A cancelled invitation cannot be accepted")
    void cancelledCannotBeAccepted() {
        TeamInvitation invitation = TeamInvitation.create(team, BOB, Set.of(ScanlationRole.TRANSLATOR), MINA, NOW);

        invitation.cancel(NOW);

        assertThatThrownBy(() -> invitation.accept(team, BOB, NOW)).isInstanceOf(DomainValidationException.class);
        assertThat(team.findMember(BOB)).isEmpty();
    }

    @Test
    @DisplayName("A member is not invited, and an invitation needs a role")
    void invitationRules() {
        assertThatThrownBy(() -> TeamInvitation.create(team, MINA, Set.of(ScanlationRole.TRANSLATOR), MINA, NOW))
                .isInstanceOfSatisfying(DomainValidationException.class, e -> assertThat(e.code()).isEqualTo(ErrorCodes.ALREADY_ON_TEAM));
        assertThatThrownBy(() -> TeamInvitation.create(team, BOB, Set.of(), MINA, NOW))
                .isInstanceOf(DomainValidationException.class);
    }
}
