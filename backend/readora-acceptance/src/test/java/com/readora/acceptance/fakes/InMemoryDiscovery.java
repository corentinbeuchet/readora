package com.readora.acceptance.fakes;

import com.readora.application.port.out.DiscoveryQueryPort;
import com.readora.domain.common.UserId;
import com.readora.domain.library.ChapterRead;
import com.readora.domain.work.Chapter;
import com.readora.domain.work.ChapterId;
import com.readora.domain.work.WorkId;
import org.jspecify.annotations.Nullable;

import java.time.Instant;
import java.util.ArrayList;
import java.util.Collection;
import java.util.Comparator;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Set;
import java.util.stream.Collectors;

/// Same semantics as `DiscoveryQueryAdapter`, over the other in-memory fakes. Activity for the popularity ranking is
/// recorded by the steps (reads, comments, library adds with their time).
public class InMemoryDiscovery implements DiscoveryQueryPort {

    public enum Activity { READ, COMMENT, LIBRARY_ADD }

    private record Event(WorkId workId, Activity activity, Instant at) {
    }

    private final InMemoryWorkRepository works;
    private final InMemoryChapterRepository chapters;
    private final InMemoryLibraryRepository library;
    private final InMemoryChapterReadRepository reads;
    private final List<Event> events = new ArrayList<>();

    public InMemoryDiscovery(InMemoryWorkRepository works, InMemoryChapterRepository chapters, InMemoryLibraryRepository library,
                             InMemoryChapterReadRepository reads) {
        this.works = works;
        this.chapters = chapters;
        this.library = library;
        this.reads = reads;
    }

    private java.util.function.Function<UserId, Set<com.readora.domain.scanlation.TeamId>> followedTeams = user -> Set.of();

    /// Teams each reader follows (their chapters join the reader's "My library" updates).
    public void followedTeams(java.util.function.Function<UserId, Set<com.readora.domain.scanlation.TeamId>> lookup) {
        this.followedTeams = lookup;
    }

    public void record(WorkId workId, Activity activity, Instant at) {
        events.add(new Event(workId, activity, at));
    }

    @Override
    public List<ChapterRelease> findLatestReleases(@Nullable UserId onlyFor, int page, int size) {
        Set<WorkId> mine = onlyFor == null ? Set.of()
                : library.findByUser(onlyFor, null).stream().map(e -> e.getWorkId()).collect(Collectors.toSet());
        return works.all().stream()
                .flatMap(work -> chapters.findPublishedByWorkId(work.getId()).stream())
                .filter(chapter -> onlyFor == null || mine.contains(chapter.getWorkId())
                        || followedTeams.apply(onlyFor).contains(chapter.getTeamId()))
                .sorted(Comparator.comparing((Chapter c) -> Objects.requireNonNull(c.getPublishedAt())).reversed())
                .skip((long) page * size)
                .limit(size)
                .map(c -> new ChapterRelease(c.getId(), c.getWorkId(), c.getTeamId(), c.getChapterNumber(), c.getTitle(), Objects.requireNonNull(c.getPublishedAt())))
                .toList();
    }

    @Override
    public Set<ChapterId> findFinished(UserId userId, Collection<ChapterId> chapterIds) {
        return chapterIds.stream()
                .filter(id -> reads.find(userId, id).map(ChapterRead::finished).orElse(false))
                .collect(Collectors.toSet());
    }

    @Override
    public List<PopularWork> findPopular(Instant since, int limit) {
        Map<WorkId, Long> scores = new HashMap<>();
        for (Event event : events) {
            if (!event.at().isBefore(since)) {
                long weight = switch (event.activity()) {
                    case READ -> 1;
                    case COMMENT -> 3;
                    case LIBRARY_ADD -> 5;
                };
                scores.merge(event.workId(), weight, Long::sum);
            }
        }
        return scores.entrySet().stream()
                .sorted(Map.Entry.<WorkId, Long>comparingByValue().reversed())
                .limit(limit)
                .map(e -> new PopularWork(e.getKey(), e.getValue()))
                .toList();
    }
}
