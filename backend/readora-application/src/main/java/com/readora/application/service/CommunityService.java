package com.readora.application.service;

import com.readora.application.port.in.CommunityUseCase;
import com.readora.application.port.out.ChapterRepositoryPort;
import com.readora.application.port.out.CommunityQueryPort;
import com.readora.application.port.out.ScanlationProjectRepositoryPort;
import com.readora.application.port.out.UserAccountRepositoryPort;
import com.readora.application.port.out.WorkRepositoryPort;
import com.readora.domain.common.NotFoundException;
import com.readora.domain.common.UserId;
import com.readora.domain.identity.UserAccount;
import com.readora.domain.scanlation.ProjectId;
import com.readora.domain.scanlation.ScanlationProject;
import com.readora.domain.scanlation.TeamMember;
import com.readora.domain.work.Chapter;
import com.readora.domain.work.Work;
import org.jspecify.annotations.Nullable;

import java.time.Clock;
import java.util.Comparator;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Optional;

public class CommunityService implements CommunityUseCase {

    private final UserAccountRepositoryPort users;
    private final CommunityQueryPort community;
    private final ScanlationProjectRepositoryPort projects;
    private final WorkRepositoryPort works;
    private final ChapterRepositoryPort chapters;
    private final Clock clock;

    public CommunityService(UserAccountRepositoryPort users, CommunityQueryPort community, ScanlationProjectRepositoryPort projects,
                            WorkRepositoryPort works, ChapterRepositoryPort chapters, Clock clock) {
        this.users = Objects.requireNonNull(users, "UserAccountRepositoryPort cannot be null");
        this.community = Objects.requireNonNull(community, "CommunityQueryPort cannot be null");
        this.projects = Objects.requireNonNull(projects, "ScanlationProjectRepositoryPort cannot be null");
        this.works = Objects.requireNonNull(works, "WorkRepositoryPort cannot be null");
        this.chapters = Objects.requireNonNull(chapters, "ChapterRepositoryPort cannot be null");
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
    public TeamPage team(ProjectId projectId, @Nullable UserId viewer) {
        ScanlationProject project = requireTeam(projectId);
        Work series = works.findById(project.getWorkId()).orElseThrow(() -> new NotFoundException("Work", project.getWorkId()));
        Map<UserId, String> names = community.usernames(project.getMembers().stream().map(TeamMember::userId).toList());
        List<TeamMemberView> members = project.getMembers().stream()
                .flatMap(member -> Optional.ofNullable(names.get(member.userId())).map(name -> new TeamMemberView(name, member.roles())).stream())
                .sorted(Comparator.comparing(TeamMemberView::username))
                .toList();
        List<Chapter> latest = chapters.findPublishedByWorkId(project.getWorkId()).reversed().stream()
                .filter(chapter -> projectId.equals(chapter.getScanlationProjectId()))
                .limit(TEAM_LATEST_CHAPTERS)
                .toList();
        boolean following = viewer != null && community.isFollowing(viewer, projectId);
        return new TeamPage(projectId, project.getName(), series, members, latest, community.countFollowers(projectId), following);
    }

    @Override
    public void follow(UserId userId, ProjectId projectId) {
        requireTeam(projectId);
        community.follow(userId, projectId, clock.instant());
    }

    @Override
    public void unfollow(UserId userId, ProjectId projectId) {
        community.unfollow(userId, projectId);
    }

    private ScanlationProject requireTeam(ProjectId projectId) {
        return projects.findById(projectId).orElseThrow(() -> new NotFoundException("Team", projectId));
    }
}
