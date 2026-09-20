package com.readora.domain.work;

import com.readora.domain.common.DomainValidationException;
import org.jspecify.annotations.Nullable;

import java.util.HashSet;
import java.util.List;
import java.util.Locale;
import java.util.Set;

/// What readers want to know about a series beside its synopsis. Every fact is optional: `null` (or no title) means
/// nobody filled it in, and it is then simply not shown.
///
/// Normalises on construction: texts are trimmed, blank means unknown, other titles lose blanks and duplicates
/// (ignoring case) and keep their order.
///
/// @param alternativeTitles the titles the series is also known by (original, romanised, other languages)
/// @param releaseYear       the year the original series started
public record WorkFacts(List<String> alternativeTitles, @Nullable String artist, @Nullable Integer releaseYear,
                        @Nullable OriginalLanguage originalLanguage, @Nullable ContentRating contentRating) {

    public static final int MAX_ALTERNATIVE_TITLES = 10;
    public static final int MAX_TITLE_LENGTH = 255;
    public static final int MAX_ARTIST_LENGTH = 120;
    public static final int MIN_RELEASE_YEAR = 1900;
    public static final int MAX_RELEASE_YEAR = 2100;

    private static final WorkFacts NONE = new WorkFacts(List.of(), null, null, null, null);

    public WorkFacts {
        alternativeTitles = normaliseTitles(alternativeTitles);
        artist = normaliseArtist(artist);
        if (releaseYear != null && (releaseYear < MIN_RELEASE_YEAR || releaseYear > MAX_RELEASE_YEAR)) {
            throw new DomainValidationException("Release year must be between " + MIN_RELEASE_YEAR + " and " + MAX_RELEASE_YEAR);
        }
    }

    /// Nothing known yet: how every series starts unless its creator says more.
    public static WorkFacts none() {
        return NONE;
    }

    private static List<String> normaliseTitles(List<String> titles) {
        Set<String> seen = new HashSet<>();
        List<String> kept = titles.stream()
                .filter(title -> title != null && !title.isBlank())
                .map(String::trim)
                .filter(title -> seen.add(title.toLowerCase(Locale.ROOT)))
                .toList();
        if (kept.size() > MAX_ALTERNATIVE_TITLES) {
            throw new DomainValidationException("A series has at most " + MAX_ALTERNATIVE_TITLES + " other titles");
        }
        if (kept.stream().anyMatch(title -> title.length() > MAX_TITLE_LENGTH)) {
            throw new DomainValidationException("A title cannot exceed " + MAX_TITLE_LENGTH + " characters");
        }
        return kept;
    }

    private static @Nullable String normaliseArtist(@Nullable String artist) {
        if (artist == null || artist.isBlank()) {
            return null;
        }
        String trimmed = artist.trim();
        if (trimmed.length() > MAX_ARTIST_LENGTH) {
            throw new DomainValidationException("Artist cannot exceed " + MAX_ARTIST_LENGTH + " characters");
        }
        return trimmed;
    }
}
