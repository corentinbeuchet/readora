package com.readora.application.port.in;

import com.readora.domain.common.UserId;
import com.readora.domain.scanlation.ProjectId;
import com.readora.domain.scanlation.ScanlationProject;
import com.readora.domain.scanlation.ScanlationRole;
import com.readora.domain.scanlation.Team;
import com.readora.domain.scanlation.TeamId;
import com.readora.domain.scanlation.TeamInvitation;
import com.readora.domain.scanlation.TeamInvitationId;
import com.readora.domain.scanlation.WorkflowTask;
import com.readora.domain.work.Work;
import com.readora.domain.work.WorkId;
import org.jspecify.annotations.Nullable;

import java.util.List;
import java.util.Set;

/// Running a scanlation team (US-12): creating it (any reader), its roster (invitations the reader accepts), and the
/// series it works on. Every change to a team is made by a leader of that team (or an admin).
public interface ManageTeamUseCase {

    /// One of the team's series with its task board (`boardEnabled`: the team uses the board for it).
    record Board(ProjectId projectId, Work work, boolean boardEnabled) {
    }

    /// A team the caller belongs to, with its boards (series title order).
    record MyTeam(Team team, List<Board> boards) {
    }

    /// @throws com.readora.domain.common.DomainValidationException `TEAM_NAME_TAKEN` if another team has this name
    ///         (case-insensitive)
    Team createTeam(UserId creatorId, String name, @Nullable String description);

    /// An invitation with the names a screen shows (team, invited reader, who invited them).
    record InvitationView(TeamInvitation invitation, String teamName, String inviteeUsername, String invitedByUsername) {
    }

    /// Replaces the roles of a member; newcomers are invited instead ([#invite]).
    ///
    /// @throws com.readora.domain.common.AccessDeniedDomainException unless the actor leads the team (or is an admin)
    /// @throws com.readora.domain.common.NotFoundException if the team or the user does not exist
    /// @throws com.readora.domain.common.DomainValidationException `NOT_ON_TEAM` if the user is not a member, or
    ///         `LAST_LEADER` if the team would lose its only leader
    Team setMember(UserId actorId, TeamId teamId, String username, Set<ScanlationRole> roles);

    /// Invites `username` to join the team with `roles`; they are notified and join once they accept.
    ///
    /// @throws com.readora.domain.common.AccessDeniedDomainException unless the actor leads the team (or is an admin)
    /// @throws com.readora.domain.common.NotFoundException if the team or the user does not exist
    /// @throws com.readora.domain.common.DomainValidationException `ALREADY_ON_TEAM` if they are a member already, or
    ///         `INVITATION_PENDING` if an invitation to this team waits for their answer
    InvitationView invite(UserId actorId, TeamId teamId, String username, Set<ScanlationRole> roles);

    /// The team's invitations still waiting for an answer, oldest first (leaders and admins).
    ///
    /// @throws com.readora.domain.common.AccessDeniedDomainException unless the actor leads the team (or is an admin)
    @ReadOnly
    List<InvitationView> pendingInvitations(UserId actorId, TeamId teamId);

    /// Withdraws a pending invitation of the team.
    ///
    /// @throws com.readora.domain.common.AccessDeniedDomainException unless the actor leads the team (or is an admin)
    /// @throws com.readora.domain.common.DomainValidationException `ALREADY_HANDLED` if it was already answered
    void cancelInvitation(UserId actorId, TeamInvitationId invitationId);

    /// The invitations waiting for the user's answer, newest first.
    @ReadOnly
    List<InvitationView> myInvitations(UserId userId);

    /// The invited reader joins the team with the invited roles.
    ///
    /// @throws com.readora.domain.common.AccessDeniedDomainException if the user is not the invited reader
    /// @throws com.readora.domain.common.DomainValidationException `ALREADY_HANDLED` if it was already answered
    Team acceptInvitation(UserId userId, TeamInvitationId invitationId);

    /// @throws com.readora.domain.common.AccessDeniedDomainException if the user is not the invited reader
    /// @throws com.readora.domain.common.DomainValidationException `ALREADY_HANDLED` if it was already answered
    void declineInvitation(UserId userId, TeamInvitationId invitationId);

    /// Removes `username` from the team: a leader removes anyone, a member may leave.
    ///
    /// @throws com.readora.domain.common.AccessDeniedDomainException if the actor is neither a leader nor that member
    /// @throws com.readora.domain.common.DomainValidationException `LAST_LEADER` if the team would lose its only leader
    Team removeMember(UserId actorId, TeamId teamId, String username);

    /// Starts the team's own task board for an existing series; other teams may already translate it.
    ///
    /// @throws com.readora.domain.common.AccessDeniedDomainException unless the actor leads the team (or is an admin)
    /// @throws com.readora.domain.common.DomainValidationException `SERIES_ALREADY_IN_TEAM` if the team already has it
    ScanlationProject addSeries(UserId actorId, TeamId teamId, WorkId workId);

    /// Turns the task board of one of the team's series on or off; tasks already on it stay and can be finished.
    ///
    /// @throws com.readora.domain.common.AccessDeniedDomainException unless the actor leads the team (or is an admin)
    /// @throws com.readora.domain.common.NotFoundException if there is no such board
    ScanlationProject setBoard(UserId actorId, ProjectId projectId, boolean enabled);

    /// The teams the user is a member of, by name.
    @ReadOnly
    List<MyTeam> myTeams(UserId userId);

    /// A task of one of my teams' boards that I can take on (open, in a stage my roles cover) or that I hold.
    record WaitingTask(ProjectId projectId, Work work, Team team, WorkflowTask task, boolean mine) {
    }

    /// What waits for the user across their teams' task boards that are on: the tasks they hold first, then the open
    /// ones in stages their roles cover (a leader covers every stage), by series title and chapter number.
    @ReadOnly
    List<WaitingTask> waitingFor(UserId userId);
}
