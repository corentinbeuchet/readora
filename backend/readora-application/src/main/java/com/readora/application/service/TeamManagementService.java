package com.readora.application.service;

import com.readora.application.port.in.BrowseCatalogUseCase;
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
import com.readora.domain.scanlation.Team;
import com.readora.domain.scanlation.TeamId;
import com.readora.domain.scanlation.TeamInvitation;
import com.readora.domain.scanlation.TeamInvitationId;
import com.readora.domain.scanlation.TeamMember;
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
        List<TeamInvitation> pending = invitations.findPendingByTeam(teamId);
        Map<UserId, String> names = namesOf(pending);
        return pending.stream().map(invitation -> view(invitation, team, names)).toList();
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
        List<TeamInvitation> pending = invitations.findPendingByInvitee(userId);
        Map<TeamId, Team> teamsById = teams.findAllById(pending.stream().map(TeamInvitation::getTeamId).distinct().toList()).stream()
                .collect(Collectors.toMap(Team::getId, team -> team));
        Map<UserId, String> names = namesOf(pending);
        return pending.stream()
                .flatMap(invitation -> Optional.ofNullable(teamsById.get(invitation.getTeamId())).map(team -> view(invitation, team, names)).stream())
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

    /// The usernames of everyone named in these invitations, in one query (a missing one is looked up by [#usernameOf]).
    private Map<UserId, String> namesOf(List<TeamInvitation> invitations) {
        return new HashMap<>(users.findUsernames(invitations.stream()
                .flatMap(invitation -> java.util.stream.Stream.of(invitation.getInviteeId(), invitation.getInvitedBy()))
                .distinct().toList()));
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
        if (projects.existsByTeamAndWork(teamId, workId)) {
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
        // Plain columns only: loading the projects would load every task and page of every board.
        List<ScanlationProjectRepositoryPort.BoardRef> refs = projects.findBoardRefs(mine.stream().map(Team::getId).toList());
        Map<WorkId, String> titles = works.findTitles(refs.stream().map(ScanlationProjectRepositoryPort.BoardRef::workId).distinct().toList());
        Map<TeamId, List<Board>> boardsByTeam = new HashMap<>();
        for (ScanlationProjectRepositoryPort.BoardRef ref : refs) {
            String title = titles.get(ref.workId());
            if (title != null) {
                boardsByTeam.computeIfAbsent(ref.teamId(), id -> new ArrayList<>()).add(new Board(ref.projectId(), ref.workId(), title, ref.boardEnabled()));
            }
        }
        return mine.stream()
                .map(team -> new MyTeam(team, boardsByTeam.getOrDefault(team.getId(), List.of()).stream()
                        .sorted(Comparator.comparing(Board::title, String.CASE_INSENSITIVE_ORDER))
                        .toList()))
                .toList();
    }

    @Override
    public BrowseCatalogUseCase.Page<WaitingTask> waitingFor(UserId userId, int page, int size) {
        List<Team> mine = teams.findByMember(userId);
        Map<TeamId, Team> teamsById = mine.stream().collect(Collectors.toMap(Team::getId, team -> team));
        // Unfinished tasks of boards that are on, as plain columns (no page is loaded); roles are checked per team here.
        List<ScanlationProjectRepositoryPort.OpenTask> open = projects.findOpenTasks(teamsById.keySet());
        Map<WorkId, String> titles = works.findTitles(open.stream().map(ScanlationProjectRepositoryPort.OpenTask::workId).distinct().toList());
        List<WaitingTask> waiting = new ArrayList<>();
        for (ScanlationProjectRepositoryPort.OpenTask task : open) {
            Team team = teamsById.get(task.teamId());
            String title = titles.get(task.workId());
            if (team == null || title == null) {
                continue;
            }
            TeamMember member = team.findMember(userId).orElse(null);
            if (member == null) {
                continue;
            }
            boolean mineTask = userId.equals(task.assigneeId());
            boolean takeable = task.assigneeId() == null && member.hasRole(task.stage().requiredRole());
            if (mineTask || takeable) {
                waiting.add(new WaitingTask(task.projectId(), task.workId(), title, team, task.taskId(), task.chapterNumber(), task.stage(), mineTask));
            }
        }
        int safePage = Math.max(0, page);
        int safeSize = Math.clamp(size, 1, MAX_WAITING_PAGE_SIZE);
        List<WaitingTask> items = waiting.stream()
                .sorted(Comparator.comparing((WaitingTask w) -> !w.mine())
                        .thenComparing(WaitingTask::workTitle, String.CASE_INSENSITIVE_ORDER)
                        .thenComparing(WaitingTask::chapterNumber))
                .skip((long) safePage * safeSize)
                .limit(safeSize)
                .toList();
        return new BrowseCatalogUseCase.Page<>(items, safePage, safeSize, waiting.size());
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
