package com.readora.application.service;

import com.readora.application.port.in.BrowseCatalogUseCase;
import com.readora.application.port.in.CommunityUseCase;
import com.readora.application.port.out.CommunityQueryPort;
import com.readora.application.port.out.ScanlationProjectRepositoryPort;
import com.readora.application.port.out.TeamRepositoryPort;
import com.readora.application.port.out.UserAccountRepositoryPort;
import com.readora.application.port.out.WorkRepositoryPort;
import com.readora.domain.common.DomainValidationException;
import com.readora.domain.common.NotFoundException;
import com.readora.domain.common.UserId;
import com.readora.domain.identity.UserAccount;
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
import java.util.stream.Stream;

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
    public List<ReaderRef> findReaders(String text) {
        String prefix = text == null ? "" : text.trim();
        if (prefix.length() < READER_SEARCH_MIN || prefix.length() > READER_SEARCH_MAX) {
            throw new DomainValidationException("Type between " + READER_SEARCH_MIN + " and " + READER_SEARCH_MAX + " characters of a username");
        }
        return community.readersStartingWith(prefix, READER_SEARCH_LIMIT).stream()
                .map(reader -> new ReaderRef(reader.username(), reader.displayName()))
                .toList();
    }

    @Override
    public PublicProfile profile(String username) {
        UserAccount account = users.findByUsername(username).filter(found -> !found.isDeleted())
                .orElseThrow(() -> new NotFoundException("Reader", username));
        var stats = community.readingStats(account.getId(), TOP_GENRES);
        List<Work> completed = stats.completedSeries().isEmpty() ? List.of() : works.findAllById(stats.completedSeries());
        return new PublicProfile(account.getUsername(), account.getDisplayName(), account.getAvatarUrl(), account.getBio(),
                account.getCreatedAt(), stats.chaptersRead(), stats.topGenres(), completed);
    }

    @Override
    public TeamPage team(TeamId teamId, @Nullable UserId viewer, int seriesPage) {
        Team team = requireTeam(teamId);
        // Plain columns: loading the projects would load every task and page of every board.
        List<WorkId> workIds = projects.findBoardRefs(List.of(teamId)).stream().map(ScanlationProjectRepositoryPort.BoardRef::workId).distinct().toList();
        List<CommunityQueryPort.PublishedChapter> latestRows = community.latestPublishedChapters(teamId, TEAM_LATEST_CHAPTERS);
        Map<WorkId, Long> chapterCounts = community.countPublishedChapters(teamId);
        Map<WorkId, String> titles = works.findTitles(Stream.concat(workIds.stream(), latestRows.stream().map(CommunityQueryPort.PublishedChapter::workId)).distinct().toList());

        // Ordered on ids, titles and counts; only the series of the page shown are loaded.
        List<WorkId> ordered = workIds.stream()
                .filter(titles::containsKey)
                .sorted(Comparator.comparingLong((WorkId id) -> chapterCounts.getOrDefault(id, 0L)).reversed()
                        .thenComparing(id -> titles.getOrDefault(id, "")))
                .toList();
        int page = Math.max(0, seriesPage);
        List<WorkId> onPage = ordered.stream().skip((long) page * TEAM_SERIES_PAGE_SIZE).limit(TEAM_SERIES_PAGE_SIZE).toList();
        Map<WorkId, Work> seriesById = works.findAllById(onPage).stream().collect(Collectors.toMap(Work::getId, work -> work));
        List<TeamSeries> series = onPage.stream()
                .flatMap(id -> Optional.ofNullable(seriesById.get(id)).map(work -> new TeamSeries(work, chapterCounts.getOrDefault(id, 0L))).stream())
                .toList();

        List<TeamChapter> latest = latestRows.stream()
                .map(c -> new TeamChapter(c.id(), c.workId(), titles.getOrDefault(c.workId(), ""), c.number(), c.title(), c.pageCount(), c.publishedAt()))
                .toList();
        boolean following = viewer != null && community.isFollowing(viewer, teamId);
        return new TeamPage(teamId, team.getName(), team.getDescription(),
                new BrowseCatalogUseCase.Page<>(series, page, TEAM_SERIES_PAGE_SIZE, ordered.size()),
                membersOf(team), latest, community.countFollowers(teamId), following);
    }

    @Override
    public List<TeamMemberView> members(TeamId teamId) {
        return membersOf(requireTeam(teamId));
    }

    private List<TeamMemberView> membersOf(Team team) {
        Map<UserId, String> names = community.usernames(team.getMembers().stream().map(TeamMember::userId).toList());
        return team.getMembers().stream()
                .flatMap(member -> Optional.ofNullable(names.get(member.userId())).map(name -> new TeamMemberView(name, member.roles())).stream())
                .sorted(Comparator.comparing(TeamMemberView::username))
                .toList();
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
