package com.readora.domain.work;

import com.readora.domain.scanlation.TeamId;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.time.Instant;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;

class ReadingOrderTest {

    private static final Instant START = Instant.parse("2026-09-01T00:00:00Z");
    private static final TeamId SHADOW = TeamId.generate();
    private static final TeamId MOON = TeamId.generate();
    private static final TeamId SUN = TeamId.generate();

    private final List<ReadingOrder.Version> published = new ArrayList<>();
    private final Map<String, ChapterId> ids = new HashMap<>();
    private ReadingOrder order;

    @Test
    @DisplayName("Numbers are in reading order and each appears once, whatever the number of versions")
    void numbersAppearOnce() {
        givenTheVersion("10", SHADOW, 1);
        givenTheVersion("2", SHADOW, 2);
        givenTheVersion("2", MOON, 3);
        givenTheVersion("Extra", SHADOW, 4);

        whenTheOrderIsBuilt();

        thenTheNumbersAre("2", "10", "Extra");
    }

    @Test
    @DisplayName("Versions of a number are listed with the first one published first")
    void oldestVersionFirst() {
        givenTheVersion("5", MOON, 9);
        givenTheVersion("5", SHADOW, 1);

        whenTheOrderIsBuilt();

        thenTheVersionsOfAre("5", SHADOW, MOON);
        thenTheVersionsOfAre("6");
    }

    @Test
    @DisplayName("The next chapter stays with the same team when that team has it")
    void nextStaysWithTheTeam() {
        givenTheVersion("5", SHADOW, 1);
        givenTheVersion("5", MOON, 2);
        givenTheVersion("6", SHADOW, 3);
        givenTheVersion("6", MOON, 4);

        whenTheOrderIsBuilt();

        thenTheNumberAfterIs("5", "6");
        thenThePickIs("6", MOON, MOON);
    }

    @Test
    @DisplayName("Without a version of the preferred team, the first one published is picked")
    void fallsBackToTheOldestVersion() {
        givenTheVersion("6", SUN, 5);
        givenTheVersion("6", SHADOW, 3);

        whenTheOrderIsBuilt();

        thenThePickIs("6", MOON, SHADOW);
        thenThePickIs("6", null, SHADOW);
        thenThereIsNoPickFor("7");
    }

    @Test
    @DisplayName("The first and last numbers have no neighbour on that side")
    void endsHaveNoNeighbour() {
        givenTheVersion("1", SHADOW, 1);
        givenTheVersion("2", SHADOW, 2);

        whenTheOrderIsBuilt();

        thenThereIsNoNumberBefore("1");
        thenThereIsNoNumberAfter("2");
        thenTheNumberBeforeIs("2", "1");
    }

    @Test
    @DisplayName("Only the first version published for a number is a new chapter")
    void onlyTheFirstVersionIsNew() {
        givenTheVersion("5", SHADOW, 1);
        givenTheVersion("5", MOON, 2);

        whenTheOrderIsBuilt();

        thenTheVersionIsTheFirstOfItsNumber("5", SHADOW, true);
        thenTheVersionIsTheFirstOfItsNumber("5", MOON, false);
    }

    private void givenTheVersion(String number, TeamId team, int publishedOnDay) {
        ChapterId id = ChapterId.generate();
        ids.put(number + team, id);
        published.add(new ReadingOrder.Version(id, ChapterNumber.of(number), team, START.plusSeconds(86_400L * publishedOnDay)));
    }

    private void whenTheOrderIsBuilt() {
        order = ReadingOrder.of(published);
    }

    private void thenTheNumbersAre(String... numbers) {
        assertThat(order.numbers()).extracting(ChapterNumber::value).containsExactly(numbers);
    }

    private void thenTheVersionsOfAre(String number, TeamId... teams) {
        assertThat(order.versionsOf(ChapterNumber.of(number))).extracting(ReadingOrder.Version::teamId).containsExactly(teams);
    }

    private void thenTheNumberAfterIs(String number, String next) {
        assertThat(order.numberAfter(ChapterNumber.of(number))).contains(ChapterNumber.of(next));
    }

    private void thenTheNumberBeforeIs(String number, String previous) {
        assertThat(order.numberBefore(ChapterNumber.of(number))).contains(ChapterNumber.of(previous));
    }

    private void thenThereIsNoNumberAfter(String number) {
        assertThat(order.numberAfter(ChapterNumber.of(number))).isEmpty();
    }

    private void thenThereIsNoNumberBefore(String number) {
        assertThat(order.numberBefore(ChapterNumber.of(number))).isEmpty();
    }

    private void thenThePickIs(String number, TeamId preferred, TeamId picked) {
        assertThat(order.pick(ChapterNumber.of(number), preferred)).map(ReadingOrder.Version::teamId).contains(picked);
    }

    private void thenThereIsNoPickFor(String number) {
        assertThat(order.pick(ChapterNumber.of(number), SHADOW)).isEmpty();
    }

    private void thenTheVersionIsTheFirstOfItsNumber(String number, TeamId team, boolean first) {
        assertThat(order.isFirstVersion(ids.get(number + team))).isEqualTo(first);
    }
}
