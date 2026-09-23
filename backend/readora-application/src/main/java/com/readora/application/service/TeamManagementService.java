package com.readora.application.service;

import com.readora.application.port.in.ManageTeamUseCase;
import com.readora.application.port.out.EventPublisherPort;
import com.readora.application.port.out.ScanlationProjectRepositoryPort;
import com.readora.application.port.out.TeamInvitationRepositoryPort;
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
import com.readora.domain.scanlation.ProjectId;
import com.readora.domain.scanlation.ScanlationProject;
import com.readora.domain.scanlation.ScanlationRole;
import com.readora.domain.scanlation.TaskStatus;
import com.readora.domain.scanlation.Team;
import com.readora.domain.scanlation.TeamId;
import com.readora.domain.scanlation.TeamInvitation;
import com.readora.domain.scanlation.TeamInvitationId;
import com.readora.domain.scanlation.TeamMember;
import com.readora.domain.scanlation.WorkflowStage;
import com.readora.domain.scanlation.WorkflowTask;
import com.readora.domain.work.Work;
import com.readora.domain.work.WorkId;
import org.jspecify.annotations.Nullable;

import java.time.Clock;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashMap;
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
    private final TeamInvitationRepositoryPort invitations;
    private final EventPublisherPort eventPublisher;
    private final Clock clock;

    public TeamManagementService(TeamRepositoryPort teams, ScanlationProjectRepositoryPort projects, WorkRepositoryPort works,
                                 UserAccountRepositoryPort users, TeamInvitationRepositoryPort invitations,
                                 EventPublisherPort eventPublisher, Clock clock) {
        this.teams = Objects.requireNonNull(teams, "TeamRepositoryPort cannot be null");
        this.projects = Objects.requireNonNull(projects, "ScanlationProjectRepositoryPort cannot be null");
        this.works = Objects.requireNonNull(works, "WorkRepositoryPort cannot be null");
        this.users = Objects.requireNonNull(users, "UserAccountRepositoryPort cannot be null");
        this.invitations = Objects.requireNonNull(invitations, "TeamInvitationRepositoryPort cannot be null");
        this.eventPublisher = Objects.requireNonNull(eventPublisher, "EventPublisherPort cannot be null");
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
        TeamMember current = team.findMember(member.getId()).orElseThrow(() ->
                DomainValidationException.withCode(ErrorCodes.NOT_ON_TEAM, username + " is not on " + team.getName() + ": invite them first"));
        team.addMember(new TeamMember(member.getId(), roles, current.joinedAt()));
        return teams.save(team);
    }

    @Override
    public InvitationView invite(UserId actorId, TeamId teamId, String username, Set<ScanlationRole> roles) {
        Team team = requireTeam(teamId);
        requireLeaderOrAdmin(team, actorId);
        UserAccount invitee = requireUser(username);
        if (invitations.findPending(teamId, invitee.getId()).isPresent()) {
            throw DomainValidationException.withCode(ErrorCodes.INVITATION_PENDING, username + " already has an invitation to " + team.getName());
        }
        TeamInvitation invitation = TeamInvitation.create(team, invitee.getId(), roles, actorId, clock.instant());
        TeamInvitation saved = invitations.save(invitation);
        invitation.pollDomainEvents().forEach(eventPublisher::publish);
        return view(saved, team, new HashMap<>());
    }

    @Override
    public List<InvitationView> pendingInvitations(UserId actorId, TeamId teamId) {
        Team team = requireTeam(teamId);
        requireLeaderOrAdmin(team, actorId);
        Map<UserId, String> names = new HashMap<>();
        return invitations.findPendingByTeam(teamId).stream().map(invitation -> view(invitation, team, names)).toList();
    }

    @Override
    public void cancelInvitation(UserId actorId, TeamInvitationId invitationId) {
        TeamInvitation invitation = requireInvitation(invitationId);
        requireLeaderOrAdmin(requireTeam(invitation.getTeamId()), actorId);
        invitation.cancel(clock.instant());
        invitations.save(invitation);
    }

    @Override
    public List<InvitationView> myInvitations(UserId userId) {
        Map<UserId, String> names = new HashMap<>();
        return invitations.findPendingByInvitee(userId).stream()
                .flatMap(invitation -> teams.findById(invitation.getTeamId()).map(team -> view(invitation, team, names)).stream())
                .toList();
    }

    @Override
    public Team acceptInvitation(UserId userId, TeamInvitationId invitationId) {
        TeamInvitation invitation = requireInvitation(invitationId);
        Team team = requireTeam(invitation.getTeamId());
        invitation.accept(team, userId, clock.instant());
        Team saved = teams.save(team);
        invitations.save(invitation);
        return saved;
    }

    @Override
    public void declineInvitation(UserId userId, TeamInvitationId invitationId) {
        TeamInvitation invitation = requireInvitation(invitationId);
        invitation.decline(userId, clock.instant());
        invitations.save(invitation);
    }

    private InvitationView view(TeamInvitation invitation, Team team, Map<UserId, String> names) {
        return new InvitationView(invitation, team.getName(), usernameOf(invitation.getInviteeId(), names),
                usernameOf(invitation.getInvitedBy(), names));
    }

    private String usernameOf(UserId userId, Map<UserId, String> names) {
        return names.computeIfAbsent(userId, id -> users.findById(id).map(UserAccount::getUsername).orElse(id.value()));
    }

    private TeamInvitation requireInvitation(TeamInvitationId invitationId) {
        return invitations.findById(invitationId).orElseThrow(() -> new NotFoundException("Invitation", invitationId));
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
    public ScanlationProject setBoard(UserId actorId, ProjectId projectId, boolean enabled) {
        ScanlationProject project = projects.findById(projectId).orElseThrow(() -> new NotFoundException("Project", projectId));
        requireLeaderOrAdmin(requireTeam(project.getTeamId()), actorId);
        if (enabled) {
            project.turnBoardOn();
        } else {
            project.turnBoardOff();
        }
        return projects.save(project);
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
                        .flatMap(project -> Optional.ofNullable(series.get(project.getWorkId())).map(work -> new Board(project.getId(), work, project.isBoardEnabled())).stream())
                        .sorted(Comparator.comparing((Board board) -> board.work().getTitle(), String.CASE_INSENSITIVE_ORDER))
                        .toList()))
                .toList();
    }

    @Override
    public List<WaitingTask> waitingFor(UserId userId) {
        List<Team> mine = teams.findByMember(userId);
        Map<TeamId, Team> teamsById = mine.stream().collect(Collectors.toMap(Team::getId, team -> team));
        List<ScanlationProject> boards = projects.findByTeamIds(teamsById.keySet());
        Map<WorkId, Work> series = works.findAllById(boards.stream().map(ScanlationProject::getWorkId).distinct().toList()).stream()
                .collect(Collectors.toMap(Work::getId, work -> work));
        List<WaitingTask> waiting = new ArrayList<>();
        for (ScanlationProject board : boards) {
            if (!board.isBoardEnabled()) {
                continue;
            }
            Team team = teamsById.get(board.getTeamId());
            Work work = series.get(board.getWorkId());
            if (team == null || work == null) {
                continue;
            }
            TeamMember member = team.findMember(userId).orElse(null);
            if (member == null) {
                continue;
            }
            for (WorkflowTask task : board.getTasks()) {
                boolean done = task.getStatus() == TaskStatus.COMPLETED || task.getStage() == WorkflowStage.PUBLISHED;
                boolean mineTask = userId.equals(task.getAssigneeId());
                boolean open = task.getAssigneeId() == null && member.hasRole(task.getStage().requiredRole());
                if (!done && (mineTask || open)) {
                    waiting.add(new WaitingTask(board.getId(), work, team, task, mineTask));
                }
            }
        }
        return waiting.stream()
                .sorted(Comparator.comparing((WaitingTask w) -> !w.mine())
                        .thenComparing(w -> w.work().getTitle(), String.CASE_INSENSITIVE_ORDER)
                        .thenComparing(w -> w.task().getChapterNumber()))
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
