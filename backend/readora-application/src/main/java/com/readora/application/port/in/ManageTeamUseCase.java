package com.readora.application.port.in;

import com.readora.domain.common.UserId;
import com.readora.domain.scanlation.ProjectId;
import com.readora.domain.scanlation.ScanlationProject;
import com.readora.domain.scanlation.ScanlationRole;
import com.readora.domain.scanlation.Team;
import com.readora.domain.scanlation.TeamId;
import com.readora.domain.work.Work;
import com.readora.domain.work.WorkId;
import org.jspecify.annotations.Nullable;

import java.util.List;
import java.util.Set;

/// Running a scanlation team (US-12): creating it, its roster, and the series it works on. Every change is made by a
/// leader of that team (or an admin); the global permission alone is not enough.
public interface ManageTeamUseCase {

    /// One of the team's task boards with the series it is for.
    record Board(ProjectId projectId, Work work) {
    }

    /// A team the caller belongs to, with its boards (series title order).
    record MyTeam(Team team, List<Board> boards) {
    }

    /// @throws com.readora.domain.common.DomainValidationException `TEAM_NAME_TAKEN` if another team has this name
    ///         (case-insensitive)
    Team createTeam(UserId creatorId, String name, @Nullable String description);

    /// Adds `username` to the team, or replaces their roles.
    ///
    /// @throws com.readora.domain.common.AccessDeniedDomainException unless the actor leads the team (or is an admin)
    /// @throws com.readora.domain.common.NotFoundException if the team or the user does not exist
    /// @throws com.readora.domain.common.DomainValidationException `LAST_LEADER` if the team would lose its only leader
    Team setMember(UserId actorId, TeamId teamId, String username, Set<ScanlationRole> roles);

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

    /// The teams the user is a member of, by name.
    List<MyTeam> myTeams(UserId userId);
}
