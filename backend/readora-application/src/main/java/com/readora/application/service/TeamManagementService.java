package com.readora.application.service;

import com.readora.application.port.in.ManageTeamUseCase;
import com.readora.application.port.out.ScanlationProjectRepositoryPort;
import com.readora.application.port.out.TeamRepositoryPort;
import com.readora.application.port.out.UserAccountRepositoryPort;
import com.readora.application.port.out.WorkRepositoryPort;
import com.readora.domain.common.AccessDeniedDomainException;
import com.readora.domain.common.DomainValidationException;
import com.readora.domain.common.ErrorCodes;
import com.readora.domain.common.NotFoundException;
import com.readora.domain.common.UserId;
import com.readora.domain.identity.Permission;
import com.readora.domain.identity.UserAccount;
import com.readora.domain.scanlation.ScanlationProject;
import com.readora.domain.scanlation.ScanlationRole;
import com.readora.domain.scanlation.Team;
import com.readora.domain.scanlation.TeamId;
import com.readora.domain.scanlation.TeamMember;
import com.readora.domain.work.Work;
import com.readora.domain.work.WorkId;
import org.jspecify.annotations.Nullable;

import java.time.Clock;
import java.util.Comparator;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Optional;
import java.util.Set;
import java.util.stream.Collectors;

public class TeamManagementService implements ManageTeamUseCase {

    private final TeamRepositoryPort teams;
    private final ScanlationProjectRepositoryPort projects;
    private final WorkRepositoryPort works;
    private final UserAccountRepositoryPort users;
    private final Clock clock;

    public TeamManagementService(TeamRepositoryPort teams, ScanlationProjectRepositoryPort projects, WorkRepositoryPort works,
                                 UserAccountRepositoryPort users, Clock clock) {
        this.teams = Objects.requireNonNull(teams, "TeamRepositoryPort cannot be null");
        this.projects = Objects.requireNonNull(projects, "ScanlationProjectRepositoryPort cannot be null");
        this.works = Objects.requireNonNull(works, "WorkRepositoryPort cannot be null");
        this.users = Objects.requireNonNull(users, "UserAccountRepositoryPort cannot be null");
        this.clock = Objects.requireNonNull(clock, "Clock cannot be null");
    }

    @Override
    public Team createTeam(UserId creatorId, String name, @Nullable String description) {
        Team team = Team.create(name, description, creatorId);
        if (teams.existsByName(team.getName())) {
            throw DomainValidationException.withCode(ErrorCodes.TEAM_NAME_TAKEN, "A team named " + team.getName() + " already exists");
        }
        return teams.save(team);
    }

    @Override
    public Team setMember(UserId actorId, TeamId teamId, String username, Set<ScanlationRole> roles) {
        Team team = requireTeam(teamId);
        requireLeaderOrAdmin(team, actorId);
        UserAccount member = requireUser(username);
        team.addMember(new TeamMember(member.getId(), roles,
                team.findMember(member.getId()).map(TeamMember::joinedAt).orElseGet(clock::instant)));
        return teams.save(team);
    }

    @Override
    public Team removeMember(UserId actorId, TeamId teamId, String username) {
        Team team = requireTeam(teamId);
        UserAccount member = requireUser(username);
        if (!member.getId().equals(actorId)) {
            requireLeaderOrAdmin(team, actorId);
        }
        team.removeMember(member.getId());
        return teams.save(team);
    }

    @Override
    public ScanlationProject addSeries(UserId actorId, TeamId teamId, WorkId workId) {
        Team team = requireTeam(teamId);
        requireLeaderOrAdmin(team, actorId);
        Work work = works.findById(workId).orElseThrow(() -> new NotFoundException("Work", workId));
        if (projects.findByTeamId(teamId).stream().anyMatch(project -> project.getWorkId().equals(workId))) {
            throw DomainValidationException.withCode(ErrorCodes.SERIES_ALREADY_IN_TEAM, team.getName() + " already works on " + work.getTitle());
        }
        return projects.save(ScanlationProject.create(team.getName() + " - " + work.getTitle(), workId, teamId));
    }

    @Override
    public List<MyTeam> myTeams(UserId userId) {
        List<Team> mine = teams.findByMember(userId).stream()
                .sorted(Comparator.comparing(Team::getName, String.CASE_INSENSITIVE_ORDER))
                .toList();
        Map<TeamId, List<ScanlationProject>> projectsByTeam = projects.findByTeamIds(mine.stream().map(Team::getId).toList()).stream()
                .collect(Collectors.groupingBy(ScanlationProject::getTeamId));
        List<WorkId> workIds = projectsByTeam.values().stream().flatMap(List::stream).map(ScanlationProject::getWorkId).distinct().toList();
        Map<WorkId, Work> series = works.findAllById(workIds).stream().collect(Collectors.toMap(Work::getId, work -> work));
        return mine.stream()
                .map(team -> new MyTeam(team, projectsByTeam.getOrDefault(team.getId(), List.of()).stream()
                        .flatMap(project -> Optional.ofNullable(series.get(project.getWorkId())).map(work -> new Board(project.getId(), work)).stream())
                        .sorted(Comparator.comparing((Board board) -> board.work().getTitle(), String.CASE_INSENSITIVE_ORDER))
                        .toList()))
                .toList();
    }

    private void requireLeaderOrAdmin(Team team, UserId actorId) {
        if (team.isLeader(actorId)) {
            return;
        }
        boolean admin = users.findById(actorId).map(account -> account.can(Permission.USER_MANAGE)).orElse(false);
        if (!admin) {
            throw new AccessDeniedDomainException("Only a leader of " + team.getName() + " can do this");
        }
    }

    private Team requireTeam(TeamId teamId) {
        return teams.findById(teamId).orElseThrow(() -> new NotFoundException("Team", teamId));
    }

    private UserAccount requireUser(String username) {
        return users.findByUsername(username).orElseThrow(() -> new NotFoundException("Reader", username));
    }
}
