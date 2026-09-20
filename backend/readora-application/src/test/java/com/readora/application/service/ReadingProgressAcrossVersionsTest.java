package com.readora.application.service;

import com.readora.application.port.in.TrackReadingUseCase.WorkProgress;
import com.readora.application.port.out.ChapterReadRepositoryPort;
import com.readora.application.port.out.ChapterRepositoryPort;
import com.readora.application.port.out.WorkRepositoryPort;
import com.readora.domain.common.UserId;
import com.readora.domain.library.ChapterRead;
import com.readora.domain.scanlation.TeamId;
import com.readora.domain.work.Chapter;
import com.readora.domain.work.ChapterId;
import com.readora.domain.work.ChapterNumber;
import com.readora.domain.work.ChapterStatus;
import com.readora.domain.work.PageAsset;
import com.readora.domain.work.WorkId;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.time.Clock;
import java.time.Instant;
import java.time.ZoneOffset;
import java.util.ArrayList;
import java.util.Collection;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.mock;

/// US-07 / US-12: several teams may publish the same chapter number. Progress follows the number, whichever
/// version was read, and the next chapter stays with the team the reader read last.
class ReadingProgressAcrossVersionsTest {

    private static final Instant NOW = Instant.parse("2026-09-20T12:00:00Z");
    private static final TeamId SHADOW = TeamId.generate();
    private static final TeamId MOON = TeamId.generate();

    private final UserId kenji = UserId.of("kenji");
    private final WorkId work = WorkId.generate();
    private final Map<String, Chapter> published = new HashMap<>();
    private final InMemoryReads reads = new InMemoryReads();
    private final ReadingTrackerService service = new ReadingTrackerService(reads, new PublishedChapters(), mock(WorkRepositoryPort.class),
            Clock.fixed(NOW, ZoneOffset.UTC));
    private WorkProgress progress;

    @Test
    @DisplayName("A chapter finished in one team's version is read, and the next number opens with the same team")
    void readInAnyVersion() {
        givenTheChapter("5", SHADOW, 1);
        givenTheChapter("5", MOON, 2);
        givenTheChapter("6", SHADOW, 3);
        givenTheChapter("6", MOON, 4);
        givenIFinished("5", MOON);

        whenIAskForMyProgress();

        thenTheNumbersReadAre("5");
        thenTheNextNumberIs("6");
        thenTheNextChapterIs("6", MOON);
    }

    @Test
    @DisplayName("When the team read last has not released the next number, the first version published opens")
    void nextFallsBackToTheFirstVersion() {
        givenTheChapter("5", SHADOW, 1);
        givenTheChapter("5", MOON, 2);
        givenTheChapter("6", SHADOW, 3);
        givenIFinished("5", MOON);

        whenIAskForMyProgress();

        thenTheNextChapterIs("6", SHADOW);
    }

    @Test
    @DisplayName("Finishing both versions of the last number leaves nothing to read")
    void upToDate() {
        givenTheChapter("5", SHADOW, 1);
        givenTheChapter("5", MOON, 2);
        givenIFinished("5", SHADOW);
        givenIFinished("5", MOON);

        whenIAskForMyProgress();

        thenTheNumbersReadAre("5");
        thenThereIsNothingNext();
    }

    @Test
    @DisplayName("Mark all previous as read marks one version per number, by the team of the chapter when it has one")
    void markPreviousMarksOneVersionPerNumber() {
        givenTheChapter("1", SHADOW, 1);
        givenTheChapter("1", MOON, 2);
        givenTheChapter("2", SHADOW, 3);
        givenTheChapter("3", MOON, 4);

        whenIMarkEverythingReadBefore("3", MOON);

        thenTheNumbersReadAre("1", "2");
        thenTheVersionsMarkedReadAre(chapter("1", MOON), chapter("2", SHADOW));
        thenTheNextChapterIs("3", MOON);
    }

    @Test
    @DisplayName("Mark all previous as read leaves a number alone once any version of it is finished")
    void markPreviousSkipsNumbersAlreadyRead() {
        givenTheChapter("1", SHADOW, 1);
        givenTheChapter("1", MOON, 2);
        givenTheChapter("2", MOON, 3);
        givenIFinished("1", SHADOW);

        whenIMarkEverythingReadBefore("2", MOON);

        thenTheVersionsMarkedReadAre(chapter("1", SHADOW));
    }

    private void givenTheChapter(String number, TeamId team, int publishedOnDay) {
        Instant at = NOW.minusSeconds(86_400L * (30 - publishedOnDay));
        Chapter chapter = new Chapter(ChapterId.generate(), work, ChapterNumber.of(number), "Chapter " + number, ChapterStatus.PUBLISHED,
                List.of(PageAsset.create(1, "p1.webp", null)), team, at, at, at);
        published.put(number + team, chapter);
    }

    private void givenIFinished(String number, TeamId team) {
        Chapter chapter = chapter(number, team);
        reads.save(new ChapterRead(kenji, work, chapter.getId(), chapter.getChapterNumber(), NOW.minusSeconds(60L * (10 - reads.all.size())), true));
    }

    private void whenIAskForMyProgress() {
        progress = service.progress(kenji, work);
    }

    private void whenIMarkEverythingReadBefore(String number, TeamId team) {
        progress = service.markReadUpTo(kenji, chapter(number, team).getId());
    }

    private void thenTheNumbersReadAre(String... numbers) {
        assertThat(progress.finishedNumbers()).extracting(ChapterNumber::value).containsExactlyInAnyOrder(numbers);
    }

    private void thenTheNextNumberIs(String number) {
        assertThat(progress.nextNumber()).isEqualTo(ChapterNumber.of(number));
    }

    private void thenTheNextChapterIs(String number, TeamId team) {
        assertThat(progress.nextToRead()).isEqualTo(chapter(number, team).getId());
    }

    private void thenThereIsNothingNext() {
        assertThat(progress.nextNumber()).isNull();
        assertThat(progress.nextToRead()).isNull();
    }

    private void thenTheVersionsMarkedReadAre(Chapter... chapters) {
        assertThat(progress.finished()).containsExactlyInAnyOrder(java.util.Arrays.stream(chapters).map(Chapter::getId).toArray(ChapterId[]::new));
    }

    private Chapter chapter(String number, TeamId team) {
        return published.get(number + team);
    }

    /// Only what the tracker reads: the published chapters of the one series of these tests.
    private final class PublishedChapters implements ChapterRepositoryPort {
        @Override
        public Optional<Chapter> findById(ChapterId id) {
            return published.values().stream().filter(c -> c.getId().equals(id)).findFirst();
        }

        @Override
        public List<Chapter> findByWorkId(WorkId workId) {
            return List.copyOf(published.values());
        }

        @Override
        public Chapter save(Chapter chapter) {
            throw new UnsupportedOperationException("not used by the reading tracker");
        }
    }

    private static final class InMemoryReads implements ChapterReadRepositoryPort {
        private final List<ChapterRead> all = new ArrayList<>();

        @Override
        public Optional<ChapterRead> find(UserId userId, ChapterId chapterId) {
            return all.stream().filter(r -> r.userId().equals(userId) && r.chapterId().equals(chapterId)).findFirst();
        }

        @Override
        public ChapterRead save(ChapterRead read) {
            all.removeIf(r -> r.userId().equals(read.userId()) && r.chapterId().equals(read.chapterId()));
            all.add(read);
            return read;
        }

        @Override
        public List<ChapterRead> findByUserAndWork(UserId userId, WorkId workId) {
            return all.stream().filter(r -> r.userId().equals(userId) && r.workId().equals(workId)).toList();
        }

        @Override
        public List<ChapterRead> findLatestPerWork(UserId userId, int limit) {
            throw new UnsupportedOperationException("not used by these tests");
        }

        @Override
        public Map<WorkId, Long> countChaptersPublishedSinceLastRead(UserId userId, Collection<WorkId> workIds) {
            throw new UnsupportedOperationException("not used by these tests");
        }
    }
}
