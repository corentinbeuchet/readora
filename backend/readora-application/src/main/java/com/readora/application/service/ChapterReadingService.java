package com.readora.application.service;

import com.readora.application.port.in.ReadChapterUseCase;
import com.readora.application.port.out.ChapterRepositoryPort;
import com.readora.application.port.out.StoragePort;
import com.readora.application.port.out.TeamRepositoryPort;
import com.readora.application.port.out.WorkRepositoryPort;
import com.readora.domain.common.DomainValidationException;
import com.readora.domain.common.ErrorCodes;
import com.readora.domain.common.NotFoundException;
import com.readora.domain.scanlation.Team;
import com.readora.domain.scanlation.TeamCredit;
import com.readora.domain.scanlation.TeamId;
import com.readora.domain.work.Chapter;
import com.readora.domain.work.ChapterId;
import com.readora.domain.work.ChapterNumber;
import com.readora.domain.work.PageAsset;
import com.readora.domain.work.ReadingOrder;
import com.readora.domain.work.Work;
import com.readora.domain.common.UserId;

import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Optional;
import java.util.Set;
import java.util.stream.Collectors;

public class ChapterReadingService implements ReadChapterUseCase {
    private final ChapterRepositoryPort chapterRepository;
    private final WorkRepositoryPort workRepository;
    private final TeamRepositoryPort teamRepository;
    private final StoragePort storagePort;

    public ChapterReadingService(ChapterRepositoryPort chapterRepository, WorkRepositoryPort workRepository,
                                 TeamRepositoryPort teamRepository, StoragePort storagePort) {
        this.chapterRepository = Objects.requireNonNull(chapterRepository, "ChapterRepositoryPort cannot be null");
        this.workRepository = Objects.requireNonNull(workRepository, "WorkRepositoryPort cannot be null");
        this.teamRepository = Objects.requireNonNull(teamRepository, "TeamRepositoryPort cannot be null");
        this.storagePort = Objects.requireNonNull(storagePort, "StoragePort cannot be null");
    }

    @Override
    public ChapterReading readChapter(ChapterId chapterId, UserId readerId, String viewMode) {
        Chapter chapter = chapterRepository.findById(chapterId)
                .orElseThrow(() -> new NotFoundException("Chapter", chapterId));

        if (!chapter.isPublished()) {
            throw DomainValidationException.withCode(ErrorCodes.CHAPTER_NOT_PUBLISHED, "Chapter is not available for public reading.");
        }

        // Enrich page assets with CDN URLs if missing
        List<PageAsset> enrichedPages = chapter.getPages().stream()
                .map(p -> {
                    if (p.cdnUrl() == null || p.cdnUrl().isBlank()) {
                        String cdnUrl = storagePort.getPublicCdnUrl(p.storageKey());
                        return p.withCdnUrl(cdnUrl);
                    }
                    return p;
                }).toList();

        // A read returns a view with public URLs; it never mutates the aggregate or emits domain events.
        Chapter view = new Chapter(chapter.getId(), chapter.getWorkId(), chapter.getChapterNumber(), chapter.getTitle(),
                chapter.getStatus(), enrichedPages, chapter.getTeamId(), chapter.getCreatedAt(),
                chapter.getPublishedAt(), chapter.getUpdatedAt());
        Work work = workRepository.findById(chapter.getWorkId())
                .orElseThrow(() -> new NotFoundException("Work", chapter.getWorkId()));

        ReadingOrder order = ReadingOrder.of(chapterRepository.findPublishedRefsByWorkId(chapter.getWorkId()));
        ChapterNumber number = chapter.getChapterNumber();
        List<ChapterNumber> shown = java.util.stream.Stream.of(order.numberBefore(number), Optional.of(number), order.numberAfter(number))
                .flatMap(Optional::stream)
                .toList();
        Map<TeamId, TeamCredit> credits = credits(shown.stream().flatMap(n -> order.versionsOf(n).stream()).map(ReadingOrder.Version::teamId)
                .collect(Collectors.toSet()), chapter);
        TeamCredit team = Optional.ofNullable(credits.get(chapter.getTeamId())).orElseThrow(() -> new NotFoundException("Team", chapter.getTeamId()));
        return new ChapterReading(view, work, team, versions(order, number, credits),
                order.numberBefore(number).map(n -> neighbour(order, n, chapter.getTeamId(), credits)).orElse(null),
                order.numberAfter(number).map(n -> neighbour(order, n, chapter.getTeamId(), credits)).orElse(null));
    }

    /// Staying with the team being read is what keeps a reader from jumping between teams at every chapter.
    private static Neighbour neighbour(ReadingOrder order, ChapterNumber number, TeamId readingTeam, Map<TeamId, TeamCredit> credits) {
        ChapterId opens = order.pick(number, readingTeam).orElseThrow().id();
        return new Neighbour(number, opens, versions(order, number, credits));
    }

    private static List<ChapterVersion> versions(ReadingOrder order, ChapterNumber number, Map<TeamId, TeamCredit> credits) {
        return order.versionsOf(number).stream()
                .flatMap(version -> Optional.ofNullable(credits.get(version.teamId())).map(team -> new ChapterVersion(version.id(), team)).stream())
                .toList();
    }

    private Map<TeamId, TeamCredit> credits(Set<TeamId> teamIds, Chapter chapter) {
        Set<TeamId> wanted = new java.util.HashSet<>(teamIds);
        wanted.add(chapter.getTeamId());
        return teamRepository.findAllById(wanted).stream().collect(Collectors.toMap(Team::getId, TeamCredit::of));
    }
}
