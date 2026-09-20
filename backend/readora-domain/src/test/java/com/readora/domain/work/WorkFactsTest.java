package com.readora.domain.work;

import com.readora.domain.common.DomainValidationException;
import org.jspecify.annotations.Nullable;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.util.Arrays;
import java.util.List;
import java.util.stream.IntStream;

import static org.assertj.core.api.Assertions.assertThat;

/// US-04: the optional facts of a series normalise what people type and refuse what the page cannot show.
class WorkFactsTest {

    private @Nullable WorkFacts facts;
    private @Nullable RuntimeException refusal;

    @Test
    @DisplayName("Other titles are trimmed, keep their order, and lose blanks and duplicates whatever the case")
    void otherTitlesAreNormalised() {
        whenTheFactsHaveTheOtherTitles("  Na Honjaman Level Up ", "", "나 혼자만 레벨업", "na honjaman level up", "   ");

        thenTheOtherTitlesAre("Na Honjaman Level Up", "나 혼자만 레벨업");
    }

    @Test
    @DisplayName("A blank artist means nobody filled it in")
    void aBlankArtistIsUnknown() {
        whenTheFactsHaveTheArtist("   ");

        thenTheArtistIs(null);
    }

    @Test
    @DisplayName("The artist is trimmed")
    void theArtistIsTrimmed() {
        whenTheFactsHaveTheArtist("  DUBU ");

        thenTheArtistIs("DUBU");
    }

    @Test
    @DisplayName("A series has at most ten other titles")
    void elevenOtherTitlesAreRefused() {
        whenTheFactsHaveTheOtherTitles(titles(11));

        thenTheFactsAreRefused();
    }

    @Test
    @DisplayName("Ten other titles are accepted")
    void tenOtherTitlesAreAccepted() {
        whenTheFactsHaveTheOtherTitles(titles(10));

        thenTheOtherTitlesAre(titles(10));
    }

    @Test
    @DisplayName("A title longer than 255 characters is refused")
    void aTooLongTitleIsRefused() {
        whenTheFactsHaveTheOtherTitles("x".repeat(256));

        thenTheFactsAreRefused();
    }

    @Test
    @DisplayName("An artist longer than 120 characters is refused")
    void aTooLongArtistIsRefused() {
        whenTheFactsHaveTheArtist("x".repeat(121));

        thenTheFactsAreRefused();
    }

    @Test
    @DisplayName("A release year before 1900 is refused")
    void aYearBefore1900IsRefused() {
        whenTheFactsHaveTheReleaseYear(1899);

        thenTheFactsAreRefused();
    }

    @Test
    @DisplayName("A release year after 2100 is refused")
    void aYearAfter2100IsRefused() {
        whenTheFactsHaveTheReleaseYear(2101);

        thenTheFactsAreRefused();
    }

    @Test
    @DisplayName("A series starts with no facts")
    void noFactsAreKnownAtFirst() {
        whenNothingIsKnown();

        thenTheOtherTitlesAre();
        thenTheArtistIs(null);
    }

    private void whenTheFactsHaveTheOtherTitles(String... titles) {
        whenTheFactsAre(Arrays.asList(titles), null, null);
    }

    private void whenTheFactsHaveTheArtist(String artist) {
        whenTheFactsAre(List.of(), artist, null);
    }

    private void whenTheFactsHaveTheReleaseYear(int year) {
        whenTheFactsAre(List.of(), null, year);
    }

    private void whenNothingIsKnown() {
        facts = WorkFacts.none();
    }

    private void whenTheFactsAre(List<String> titles, @Nullable String artist, @Nullable Integer year) {
        try {
            facts = new WorkFacts(titles, artist, year, null, null);
        } catch (DomainValidationException e) {
            refusal = e;
        }
    }

    private void thenTheOtherTitlesAre(String... titles) {
        assertThat(refusal).isNull();
        assertThat(facts).isNotNull();
        assertThat(facts.alternativeTitles()).containsExactly(titles);
    }

    private void thenTheArtistIs(@Nullable String artist) {
        assertThat(facts).isNotNull();
        assertThat(facts.artist()).isEqualTo(artist);
    }

    private void thenTheFactsAreRefused() {
        assertThat(refusal).isInstanceOf(DomainValidationException.class);
    }

    private static String[] titles(int count) {
        return IntStream.rangeClosed(1, count).mapToObj(n -> "Title " + n).toArray(String[]::new);
    }
}
