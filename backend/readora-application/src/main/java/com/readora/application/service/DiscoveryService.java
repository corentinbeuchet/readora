package com.readora.application.service;

import com.readora.application.port.in.BrowseCatalogUseCase.CatalogQuery;
import com.readora.application.port.in.DiscoverUseCase;
import com.readora.application.port.out.DiscoveryQueryPort;
import com.readora.application.port.out.DiscoveryQueryPort.ChapterRelease;
import com.readora.application.port.out.RatingRepositoryPort;
import com.readora.application.port.out.WorkRepositoryPort;
import com.readora.application.port.out.WorkRepositoryPort.WorkSearch;
import com.readora.domain.common.DomainValidationException;
import com.readora.domain.common.UserId;
import com.readora.domain.work.ChapterId;
import com.readora.domain.work.Work;
import com.readora.domain.work.WorkId;
import org.jspecify.annotations.Nullable;

import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Objects;
import java.util.Optional;
import java.util.Set;
import java.util.function.Function;
import java.util.stream.Collectors;
import java.util.stream.IntStream;

public class DiscoveryService implements DiscoverUseCase {

    private final DiscoveryQueryPort discovery;
    private final WorkRepositoryPort workRepository;
    private final RatingRepositoryPort ratingRepository;
    private final Clock clock;

    public DiscoveryService(DiscoveryQueryPort discovery, WorkRepositoryPort workRepository, RatingRepositoryPort ratingRepository, Clock clock) {
        this.discovery = Objects.requireNonNull(discovery, "DiscoveryQueryPort cannot be null");
        this.workRepository = Objects.requireNonNull(workRepository, "WorkRepositoryPort cannot be null");
        this.ratingRepository = Objects.requireNonNull(ratingRepository, "RatingRepositoryPort cannot be null");
        this.clock = Objects.requireNonNull(clock, "Clock cannot be null");
    }

    @Override
    public List<Release> latest(@Nullable UserId viewer, boolean onlyMine, int page) {
        if (onlyMine && viewer == null) {
            throw new DomainValidationException("Sign in to see the updates of your library");
        }
        List<ChapterRelease> releases = discovery.findLatestReleases(onlyMine ? viewer : null, Math.max(0, page), RELEASES_PER_PAGE);
        if (releases.isEmpty()) {
            return List.of();
        }
        Map<WorkId, Work> works = worksById(releases.stream().map(ChapterRelease::workId).distinct().toList());
        Set<ChapterId> finished = viewer == null ? Set.of()
                : discovery.findFinished(viewer, releases.stream().map(ChapterRelease::chapterId).toList());
        return releases.stream()
                .flatMap(r -> Optional.ofNullable(works.get(r.workId()))
                        .map(work -> new Release(work, r.chapterId(), r.chapterNumber(), r.chapterTitle(), r.publishedAt(),
                                finished.contains(r.chapterId())))
                        .stream())
                .toList();
    }

    @Override
    public List<RankedWork> popular(Period period) {
        var popular = discovery.findPopular(since(period), RANKING_SIZE);
        Map<WorkId, Work> works = worksById(popular.stream().map(DiscoveryQueryPort.PopularWork::workId).toList());
        List<RankedWork> ranked = new java.util.ArrayList<>();
        for (var entry : popular) {
            Work work = works.get(entry.workId());
            if (work != null) {
                ranked.add(new RankedWork(ranked.size() + 1, work, entry.score(), 0));
            }
        }
        return ranked;
    }

    @Override
    public List<RankedWork> topRated() {
        var top = ratingRepository.findTopRated(MIN_RATINGS_FOR_TOP, RANKING_SIZE);
        Map<WorkId, Work> works = worksById(top.stream().map(RatingRepositoryPort.RankedWork::workId).toList());
        List<RankedWork> ranked = new java.util.ArrayList<>();
        for (var entry : top) {
            Work work = works.get(entry.workId());
            if (work != null) {
                ranked.add(new RankedWork(ranked.size() + 1, work, Math.round(entry.average() * 10) / 10.0, entry.count()));
            }
        }
        return ranked;
    }

    @Override
    public Optional<Work> surprise(CatalogQuery query) {
        return workRepository.findRandom(new WorkSearch(null, lowerCased(query.includedGenres()), lowerCased(query.excludedGenres()),
                query.types(), query.statuses(), query.demographics()));
    }

    private Instant since(Period period) {
        Instant now = clock.instant();
        return switch (period) {
            case TODAY -> now.minus(Duration.ofDays(1));
            case WEEK -> now.minus(Duration.ofDays(7));
            case MONTH -> now.minus(Duration.ofDays(30));
            case ALL -> Instant.EPOCH;
        };
    }

    private Map<WorkId, Work> worksById(List<WorkId> ids) {
        return ids.isEmpty() ? Map.of()
                : workRepository.findAllById(ids).stream().collect(Collectors.toMap(Work::getId, Function.identity()));
    }

    private static Set<String> lowerCased(Set<String> genres) {
        return genres.stream().filter(g -> !g.isBlank()).map(g -> g.trim().toLowerCase(Locale.ROOT)).collect(Collectors.toUnmodifiableSet());
    }
}
