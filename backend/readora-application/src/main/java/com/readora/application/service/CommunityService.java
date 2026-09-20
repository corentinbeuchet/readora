package com.readora.application.service;

import com.readora.application.port.in.CommunityUseCase;
import com.readora.application.port.out.CommunityQueryPort;
import com.readora.application.port.out.ScanlationProjectRepositoryPort;
import com.readora.application.port.out.TeamRepositoryPort;
import com.readora.application.port.out.UserAccountRepositoryPort;
import com.readora.application.port.out.WorkRepositoryPort;
import com.readora.domain.common.NotFoundException;
import com.readora.domain.common.UserId;
import com.readora.domain.identity.UserAccount;
import com.readora.domain.scanlation.ProjectId;
import com.readora.domain.scanlation.ScanlationProject;
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
import java.util.stream.Collectors;

public class CommunityService implements CommunityUseCase {

    private final UserAccountRepositoryPort users;
    private final CommunityQueryPort community;
    private final TeamRepositoryPort teams;
    private final ScanlationProjectRepositoryPort projects;
    private final WorkRepositoryPort works;
    private final Clock clock;

    public CommunityService(UserAccountRepositoryPort users, CommunityQueryPort community, TeamRepositoryPort teams,
                            ScanlationProjectRepositoryPort projects, WorkRepositoryPort works, Clock clock) {
        this.users = Objects.requireNonNull(users, "UserAccountRepositoryPort cannot be null");
        this.community = Objects.requireNonNull(community, "CommunityQueryPort cannot be null");
        this.teams = Objects.requireNonNull(teams, "TeamRepositoryPort cannot be null");
        this.projects = Objects.requireNonNull(projects, "ScanlationProjectRepositoryPort cannot be null");
        this.works = Objects.requireNonNull(works, "WorkRepositoryPort cannot be null");
        this.clock = Objects.requireNonNull(clock, "Clock cannot be null");
    }

    @Override
    public PublicProfile profile(String username) {
        UserAccount account = users.findByUsername(username).orElseThrow(() -> new NotFoundException("Reader", username));
        var stats = community.readingStats(account.getId(), TOP_GENRES);
        List<Work> completed = stats.completedSeries().isEmpty() ? List.of() : works.findAllById(stats.completedSeries());
        return new PublicProfile(account.getUsername(), account.getDisplayName(), account.getAvatarUrl(), account.getBio(),
                account.getCreatedAt(), stats.chaptersRead(), stats.topGenres(), completed);
    }

    @Override
    public TeamPage team(TeamId teamId, @Nullable UserId viewer) {
        Team team = requireTeam(teamId);
        List<ScanlationProject> teamProjects = projects.findByTeamId(teamId);
        List<ProjectId> projectIds = teamProjects.stream().map(ScanlationProject::getId).toList();

        Map<ProjectId, Long> chapterCounts = community.countPublishedChapters(projectIds);
        Map<WorkId, Work> seriesById = works.findAllById(teamProjects.stream().map(ScanlationProject::getWorkId).toList()).stream()
                .collect(Collectors.toMap(Work::getId, work -> work));
        List<TeamSeries> series = teamProjects.stream()
                .flatMap(project -> Optional.ofNullable(seriesById.get(project.getWorkId()))
                        .map(work -> new TeamSeries(work, chapterCounts.getOrDefault(project.getId(), 0L))).stream())
                .sorted(Comparator.comparingLong(TeamSeries::chapterCount).reversed().thenComparing(entry -> entry.work().getTitle()))
                .toList();

        Map<UserId, String> names = community.usernames(team.getMembers().stream().map(TeamMember::userId).toList());
        List<TeamMemberView> members = team.getMembers().stream()
                .flatMap(member -> Optional.ofNullable(names.get(member.userId())).map(name -> new TeamMemberView(name, member.roles())).stream())
                .sorted(Comparator.comparing(TeamMemberView::username))
                .toList();
        List<TeamChapter> latest = community.latestPublishedChapters(projectIds, TEAM_LATEST_CHAPTERS).stream()
                .map(c -> new TeamChapter(c.id(), c.workId(), c.number(), c.title(), c.pageCount(), c.publishedAt()))
                .toList();
        boolean following = viewer != null && community.isFollowing(viewer, teamId);
        return new TeamPage(teamId, team.getName(), team.getDescription(), series, members, latest, community.countFollowers(teamId), following);
    }

    @Override
    public void follow(UserId userId, TeamId teamId) {
        requireTeam(teamId);
        community.follow(userId, teamId, clock.instant());
    }

    @Override
    public void unfollow(UserId userId, TeamId teamId) {
        community.unfollow(userId, teamId);
    }

    private Team requireTeam(TeamId teamId) {
        return teams.findById(teamId).orElseThrow(() -> new NotFoundException("Team", teamId));
    }
}
