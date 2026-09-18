package com.readora.acceptance.steps;

import com.readora.acceptance.fakes.InMemoryChapterReadRepository;
import com.readora.acceptance.fakes.InMemoryChapterRepository;
import com.readora.acceptance.fakes.InMemoryLibraryRepository;
import com.readora.acceptance.fakes.InMemoryWorkRepository;
import com.readora.acceptance.fakes.MutableClock;
import com.readora.application.port.in.TrackReadingUseCase.HistoryItem;
import com.readora.application.port.in.TrackReadingUseCase.WorkProgress;
import com.readora.application.service.LibraryService;
import com.readora.application.service.ReadingTrackerService;
import com.readora.domain.common.UserId;
import com.readora.domain.work.Chapter;
import com.readora.domain.work.ChapterId;
import com.readora.domain.work.ChapterNumber;
import com.readora.domain.work.ChapterStatus;
import com.readora.domain.work.PageAsset;
import com.readora.domain.work.Work;
import com.readora.domain.work.WorkId;
import com.readora.domain.work.WorkType;
import io.cucumber.java.Before;
import io.cucumber.java.en.Given;
import io.cucumber.java.en.Then;
import io.cucumber.java.en.When;

import java.time.Duration;
import java.time.Instant;
import java.util.List;
import java.util.Set;
import java.util.stream.IntStream;

import static org.assertj.core.api.Assertions.assertThat;

/// US-07 scenarios that need the backend: read markers, history, new-chapter badges.
public class ReadingExperienceStepDefinitions {

    private static final Instant START = Instant.parse("2026-09-01T10:00:00Z");

    private MutableClock clock;
    private InMemoryWorkRepository works;
    private InMemoryChapterRepository chapters;
    private ReadingTrackerService reading;
    private LibraryService library;
    private UserId reader;
    private WorkProgress progress;
    private List<HistoryItem> history = List.of();
    private final java.util.Map<String, ChapterId> lastChapterRead = new java.util.HashMap<>();

    @Before
    public void setup() {
        clock = new MutableClock(START);
        works = new InMemoryWorkRepository();
        chapters = new InMemoryChapterRepository();
        InMemoryChapterReadRepository reads = new InMemoryChapterReadRepository(chapters);
        reading = new ReadingTrackerService(reads, chapters, works, clock);
        library = new LibraryService(new InMemoryLibraryRepository(), works, reads, clock);
        lastChapterRead.clear();
    }

    @Given("{string} is signed in")
    public void isSignedIn(String name) {
        reader = UserId.of(name);
    }

    /// Both series start with chapters 1 to 5, published before the scenario starts.
    @Given("the catalog has the manhwa {string} and the manga {string}")
    public void theCatalogHasTheManhwaAndTheManga(String manhwa, String manga) {
        for (Work work : List.of(Work.create(manhwa, "", WorkType.MANHWA, "", Set.of()), Work.create(manga, "", WorkType.MANGA, "", Set.of()))) {
            works.save(work);
            IntStream.rangeClosed(1, 5).forEach(n -> publish(work.getId(), n, START.minus(Duration.ofDays(30))));
        }
    }

    @Given("{string} finished chapters {int} to {int} of {string}")
    public void finishedChapters(String name, int from, int to, String title) {
        for (int n = from; n <= to; n++) {
            reading.recordRead(reader, chapter(title, n).getId(), true);
        }
    }

    @When("he opens the chapter list")
    public void heOpensTheChapterList() {
        progress = reading.progress(reader, works.byTitle("Solo Leveling").getId());
    }

    @Then("chapters {int} to {int} are dimmed")
    public void chaptersAreDimmed(int from, int to) {
        List<ChapterId> expected = IntStream.rangeClosed(from, to).mapToObj(n -> chapter("Solo Leveling", n).getId()).toList();
        assertThat(progress.finished()).containsExactlyInAnyOrderElementsOf(expected);
    }

    @Then("chapter {int} is highlighted as the next one to read")
    public void chapterIsHighlightedAsNext(int number) {
        assertThat(progress.nextToRead()).isEqualTo(chapter("Solo Leveling", number).getId());
    }

    @Given("{string} read {string} yesterday and {string} today")
    public void readYesterdayAndToday(String name, String yesterday, String today) {
        read(yesterday, 3);
        clock.advance(Duration.ofDays(1));
        read(today, 2);
    }

    @When("he opens his History page")
    public void heOpensHisHistoryPage() {
        history = reading.history(reader, 20);
    }

    @Then("he sees {string} first, then {string}")
    public void heSeesFirstThen(String first, String second) {
        assertThat(history).extracting(item -> item.work().getTitle()).containsExactly(first, second);
    }

    @Then("each has a {string} button that opens the last chapter he read")
    public void eachHasAContinueButton(String label) {
        assertThat(history).allSatisfy(item ->
                assertThat(item.lastRead().chapterId()).isEqualTo(lastChapterRead.get(item.work().getTitle())));
    }

    @Given("{string} has {string} in his library and read up to chapter {int}")
    public void hasInLibraryAndReadUpTo(String name, String title, int upTo) {
        library.save(reader, works.byTitle(title).getId(), null);
        for (int n = 1; n <= upTo; n++) {
            reading.recordRead(reader, chapter(title, n).getId(), true);
        }
    }

    @When("chapters {int} and {int} are published")
    public void chaptersArePublished(int first, int second) {
        clock.advance(Duration.ofHours(2));
        WorkId workId = works.byTitle("Solo Leveling").getId();
        publish(workId, first, clock.instant());
        publish(workId, second, clock.instant());
    }

    @Then("his library shows a {string} badge on {string}")
    public void hisLibraryShowsABadgeOn(String badge, String title) {
        long expected = Long.parseLong(badge.replace(" new", ""));
        assertThat(library.list(reader, null))
                .filteredOn(item -> item.work().getTitle().equals(title))
                .singleElement()
                .satisfies(item -> assertThat(item.newChapters()).isEqualTo(expected));
    }

    private void read(String title, int number) {
        ChapterId id = chapter(title, number).getId();
        reading.recordRead(reader, id, false);
        lastChapterRead.put(title, id);
    }

    private Chapter chapter(String title, int number) {
        return chapters.findByWorkIdAndChapterNumber(works.byTitle(title).getId(), ChapterNumber.of(String.valueOf(number)))
                .orElseThrow();
    }

    private void publish(WorkId workId, int number, Instant at) {
        chapters.save(new Chapter(ChapterId.generate(), workId, ChapterNumber.of(String.valueOf(number)), "Chapter " + number,
                ChapterStatus.PUBLISHED, List.of(PageAsset.create(1, "p1.webp", null)), null, at, at, at));
    }
}
