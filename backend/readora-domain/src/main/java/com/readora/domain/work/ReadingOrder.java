package com.readora.domain.work;

import com.readora.domain.scanlation.TeamId;
import org.jspecify.annotations.Nullable;

import java.time.Instant;
import java.util.Collection;
import java.util.Comparator;
import java.util.List;
import java.util.Map;
import java.util.NavigableMap;
import java.util.Objects;
import java.util.Optional;
import java.util.TreeMap;
import java.util.stream.Collectors;

/// The published chapters of one series as a reader goes through them: by chapter number, where a number may exist
/// in several teams' versions. Reading any version of a number counts as having read that chapter, and moving to the
/// next or previous number stays with the same team whenever that team has it.
public final class ReadingOrder {

    /// One team's published version of a chapter number.
    public record Version(ChapterId id, ChapterNumber number, TeamId teamId, Instant publishedAt) {
        public Version {
            Objects.requireNonNull(id, "ChapterId cannot be null");
            Objects.requireNonNull(number, "ChapterNumber cannot be null");
            Objects.requireNonNull(teamId, "TeamId cannot be null");
            Objects.requireNonNull(publishedAt, "publishedAt cannot be null");
        }
    }

    /// Numeric order first (`ChapterNumber`), then the text, so two labels that only differ by case stay apart.
    private static final Comparator<ChapterNumber> BY_NUMBER = Comparator.<ChapterNumber>naturalOrder().thenComparing(ChapterNumber::value);
    /// The first team to publish a number comes first; the id makes the order stable.
    private static final Comparator<Version> OLDEST_FIRST = Comparator.comparing(Version::publishedAt).thenComparing(v -> v.id().value());

    private final NavigableMap<ChapterNumber, List<Version>> versionsByNumber;

    private ReadingOrder(NavigableMap<ChapterNumber, List<Version>> versionsByNumber) {
        this.versionsByNumber = versionsByNumber;
    }

    public static ReadingOrder of(Collection<Version> published) {
        NavigableMap<ChapterNumber, List<Version>> byNumber = new TreeMap<>(BY_NUMBER);
        Map<ChapterNumber, List<Version>> grouped = published.stream().collect(Collectors.groupingBy(Version::number));
        grouped.forEach((number, versions) -> byNumber.put(number, versions.stream().sorted(OLDEST_FIRST).toList()));
        return new ReadingOrder(byNumber);
    }

    /// Every chapter number of the series, in reading order.
    public List<ChapterNumber> numbers() {
        return List.copyOf(versionsByNumber.keySet());
    }

    /// Every version in reading order; versions of one number are next to each other, the oldest first.
    public List<Version> versions() {
        return versionsByNumber.values().stream().flatMap(List::stream).toList();
    }

    /// The versions of a number, the oldest first; empty for an unknown number.
    public List<Version> versionsOf(ChapterNumber number) {
        return versionsByNumber.getOrDefault(number, List.of());
    }

    public Optional<Version> find(ChapterId chapterId) {
        return versionsByNumber.values().stream().flatMap(List::stream).filter(v -> v.id().equals(chapterId)).findFirst();
    }

    public Optional<ChapterNumber> numberAfter(ChapterNumber number) {
        return Optional.ofNullable(versionsByNumber.higherKey(number));
    }

    public Optional<ChapterNumber> numberBefore(ChapterNumber number) {
        return Optional.ofNullable(versionsByNumber.lowerKey(number));
    }

    /// The version of `number` to open: the preferred team's when it has one, otherwise the first one published.
    public Optional<Version> pick(ChapterNumber number, @Nullable TeamId preferredTeam) {
        List<Version> versions = versionsOf(number);
        return versions.stream().filter(v -> v.teamId().equals(preferredTeam)).findFirst().or(() -> versions.stream().findFirst());
    }

    /// Whether this version was the first one published for its number (a later one is not a "new chapter").
    public boolean isFirstVersion(ChapterId chapterId) {
        return find(chapterId).map(v -> versionsOf(v.number()).getFirst().id().equals(chapterId)).orElse(false);
    }
}
