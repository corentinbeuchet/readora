package com.readora.acceptance.fakes;

import com.readora.application.port.out.CommunityQueryPort;
import com.readora.domain.common.UserId;
import com.readora.domain.library.ChapterRead;
import com.readora.domain.library.LibraryEntry;
import com.readora.domain.scanlation.TeamId;
import com.readora.domain.work.Chapter;
import com.readora.domain.social.ReadingStatus;
import com.readora.domain.work.WorkId;

import java.time.Instant;
import java.util.Collection;
import java.util.Comparator;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.concurrent.ConcurrentHashMap;
import java.util.function.Function;
import java.util.stream.Collectors;

/// Same semantics as `CommunityQueryAdapter`, over the other in-memory fakes.
public class InMemoryCommunity implements CommunityQueryPort {

    private final InMemoryWorkRepository works;
    private final InMemoryChapterReadRepository reads;
    private final InMemoryLibraryRepository library;
    private final InMemoryUserAccounts users;
    private final InMemoryChapterRepository chapters;
    private final Map<UserId, Set<TeamId>> follows = new ConcurrentHashMap<>();

    public InMemoryCommunity(InMemoryWorkRepository works, InMemoryChapterReadRepository reads, InMemoryLibraryRepository library,
                             InMemoryUserAccounts users, InMemoryChapterRepository chapters) {
        this.chapters = chapters;
        this.works = works;
        this.reads = reads;
        this.library = library;
        this.users = users;
    }

    public Set<TeamId> followedBy(UserId userId) {
        return follows.getOrDefault(userId, Set.of());
    }

    @Override
    public ReadingStats readingStats(UserId userId, int topGenres) {
        List<ChapterRead> finished = reads.allFor(userId).stream().filter(ChapterRead::finished).toList();
        Map<String, Long> genres = finished.stream()
                .flatMap(read -> works.findById(read.workId()).stream())
                .flatMap(work -> work.getGenres().stream())
                .collect(Collectors.groupingBy(Function.identity(), Collectors.counting()));
        List<String> top = genres.entrySet().stream()
                .sorted(Map.Entry.<String, Long>comparingByValue().reversed().thenComparing(Map.Entry.comparingByKey()))
                .limit(topGenres).map(Map.Entry::getKey).toList();
        List<WorkId> completed = library.findByUser(userId, ReadingStatus.COMPLETED).stream().map(LibraryEntry::getWorkId).toList();
        return new ReadingStats(finished.size(), top, completed);
    }

    @Override
    public Map<UserId, String> usernames(Collection<UserId> userIds) {
        Map<UserId, String> names = new HashMap<>();
        userIds.forEach(id -> users.findById(id).ifPresent(account -> names.put(id, account.getUsername())));
        return names;
    }

    @Override
    public Map<WorkId, Long> countPublishedChapters(TeamId teamId) {
        return publishedBy(teamId).collect(Collectors.groupingBy(Chapter::getWorkId, Collectors.counting()));
    }

    @Override
    public List<PublishedChapter> latestPublishedChapters(TeamId teamId, int limit) {
        return publishedBy(teamId)
                .sorted(Comparator.comparing(Chapter::getPublishedAt).reversed())
                .limit(limit)
                .map(c -> new PublishedChapter(c.getId(), c.getWorkId(), c.getChapterNumber(), c.getTitle(), c.getPages().size(), c.getPublishedAt()))
                .toList();
    }

    private java.util.stream.Stream<Chapter> publishedBy(TeamId teamId) {
        return chapters.all().stream().filter(Chapter::isPublished).filter(c -> c.getTeamId().equals(teamId));
    }

    @Override
    public boolean follow(UserId userId, TeamId teamId, Instant at) {
        return follows.computeIfAbsent(userId, id -> ConcurrentHashMap.newKeySet()).add(teamId);
    }

    @Override
    public boolean unfollow(UserId userId, TeamId teamId) {
        return follows.getOrDefault(userId, Set.of()).remove(teamId);
    }

    @Override
    public boolean isFollowing(UserId userId, TeamId teamId) {
        return followedBy(userId).contains(teamId);
    }

    @Override
    public long countFollowers(TeamId teamId) {
        return follows.values().stream().filter(set -> set.contains(teamId)).count();
    }
}
