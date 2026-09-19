package com.readora.acceptance.steps;

import com.readora.acceptance.fakes.InMemoryChapterReadRepository;
import com.readora.acceptance.fakes.InMemoryChapterRepository;
import com.readora.acceptance.fakes.InMemoryDiscovery;
import com.readora.acceptance.fakes.InMemoryDiscovery.Activity;
import com.readora.acceptance.fakes.InMemoryLibraryRepository;
import com.readora.acceptance.fakes.InMemoryRatingRepository;
import com.readora.acceptance.fakes.InMemoryWorkRepository;
import com.readora.acceptance.fakes.MutableClock;
import com.readora.application.port.in.BrowseCatalogUseCase.CatalogQuery;
import com.readora.application.port.in.DiscoverUseCase.Period;
import com.readora.application.port.in.DiscoverUseCase.RankedWork;
import com.readora.application.port.in.DiscoverUseCase.Release;
import com.readora.application.service.DiscoveryService;
import com.readora.application.service.LibraryService;
import com.readora.application.service.ReadingTrackerService;
import com.readora.domain.common.UserId;
import com.readora.domain.rating.WorkRating;
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
import java.util.Map;
import java.util.Set;
import java.util.stream.IntStream;

import static org.assertj.core.api.Assertions.assertThat;

/// US-08 Latest updates and rankings.
public class UpdatesAndRankingsStepDefinitions {

    private static final Instant NOW = Instant.parse("2026-09-15T12:00:00Z");
    private static final Map<String, Period> PERIODS = Map.of("Today", Period.TODAY, "This week", Period.WEEK,
            "This month", Period.MONTH, "All time", Period.ALL);

    private InMemoryWorkRepository works;
    private InMemoryChapterRepository chapters;
    private InMemoryRatingRepository ratings;
    private InMemoryDiscovery discovery;
    private DiscoveryService service;
    private ReadingTrackerService reading;
    private List<Release> releases = List.of();
    private List<RankedWork> ranking = List.of();
    private Work surprise;

    @Before
    public void setup() {
        MutableClock clock = new MutableClock(NOW);
        works = new InMemoryWorkRepository();
        chapters = new InMemoryChapterRepository();
        ratings = new InMemoryRatingRepository();
        InMemoryLibraryRepository library = new InMemoryLibraryRepository();
        InMemoryChapterReadRepository reads = new InMemoryChapterReadRepository(chapters);
        discovery = new InMemoryDiscovery(works, chapters, library, reads);
        service = new DiscoveryService(discovery, works, ratings, clock);
        reading = new ReadingTrackerService(reads, chapters, works, clock);
        libraryService = new LibraryService(library, works, reads, clock);
    }

    private LibraryService libraryService;

    @Given("the catalog has the series {string}, {string} and {string}")
    public void theCatalogHasTheSeries(String first, String second, String third) {
        works.save(Work.create(first, "", WorkType.MANHWA, "", Set.of("Action")));
        works.save(Work.create(second, "", WorkType.MANGA, "", Set.of("Adventure")));
        works.save(Work.create(third, "", WorkType.MANGA, "", Set.of("Romance")));
    }

    @Given("{string} is in the library of {string}")
    public void isInTheLibraryOf(String title, String reader) {
        libraryService.save(UserId.of(reader), work(title), null);
    }

    @Given("chapter {int} of {string} came out {int} minutes ago and chapter {int} of {string} {int} hours ago")
    public void chaptersCameOut(int firstNumber, String firstTitle, int minutes, int secondNumber, String secondTitle, int hours) {
        publish(firstTitle, firstNumber, NOW.minus(Duration.ofMinutes(minutes)));
        publish(secondTitle, secondNumber, NOW.minus(Duration.ofHours(hours)));
    }

    @Given("chapters {int} and {int} of {string} and chapter {int} of {string} came out today")
    public void chaptersCameOutToday(int first, int second, String title, int other, String otherTitle) {
        publish(title, first, NOW.minus(Duration.ofHours(3)));
        publish(title, second, NOW.minus(Duration.ofHours(2)));
        publish(otherTitle, other, NOW.minus(Duration.ofHours(1)));
    }

    @Given("{string} read chapter {int} of {string}")
    public void readChapter(String reader, int number, String title) {
        reading.recordRead(UserId.of(reader), chapter(title, number), true);
    }

    @When("{string} opens {string}")
    public void opens(String reader, String page) {
        releases = service.latest(UserId.of(reader), false, 0);
    }

    @When("{string} opens {string} and chooses {string}")
    public void opensAndChooses(String reader, String page, String filter) {
        releases = service.latest(UserId.of(reader), "My library".equals(filter), 0);
    }

    @Then("he sees {string} chapter {int} first, marked {string}")
    public void heSeesFirst(String title, int number, String age) {
        Release first = releases.getFirst();
        assertThat(first.work().getTitle()).isEqualTo(title);
        assertThat(first.chapterNumber().value()).isEqualTo(String.valueOf(number));
        long minutes = Long.parseLong(age.replace(" minutes ago", ""));
        assertThat(first.publishedAt()).isEqualTo(NOW.minus(Duration.ofMinutes(minutes)));
    }

    @Then("each chapter has a {string} button")
    public void eachChapterHasAButton(String label) {
        assertThat(releases).isNotEmpty().allSatisfy(release -> assertThat(release.chapterId()).isNotNull());
    }

    @Then("he only sees chapters of {string}")
    public void heOnlySeesChaptersOf(String title) {
        assertThat(releases).isNotEmpty().allSatisfy(release -> assertThat(release.work().getTitle()).isEqualTo(title));
    }

    @Then("chapter {int} is marked {string} and chapter {int} is not")
    public void chapterIsMarkedRead(int read, String label, int unread) {
        assertThat(release(read).read()).isTrue();
        assertThat(release(unread).read()).isFalse();
    }

    @Given("{string} had the most reads, comments and library adds this week")
    public void hadTheMostActivity(String title) {
        Instant thisWeek = NOW.minus(Duration.ofDays(2));
        for (Activity activity : Activity.values()) {
            discovery.record(work(title), activity, thisWeek);
            discovery.record(work(title), activity, thisWeek);
        }
        discovery.record(work("One Piece"), Activity.LIBRARY_ADD, thisWeek);
        // Older activity: counts for "This month" but not "This week".
        IntStream.range(0, 4).forEach(i -> discovery.record(work("Solo Leveling"), Activity.LIBRARY_ADD, NOW.minus(Duration.ofDays(20))));
    }

    @When("a reader opens {string} and picks {string}")
    public void aReaderOpensAndPicks(String page, String period) {
        ranking = service.popular(PERIODS.get(period));
    }

    @Then("{string} is number {int}")
    public void isNumber(String title, int rank) {
        assertThat(ranking.get(rank - 1).work().getTitle()).isEqualTo(title);
    }

    @Then("the ranking can also show {string}, {string} and {string}")
    public void theRankingCanAlsoShow(String first, String second, String third) {
        for (String period : List.of(first, second, third)) {
            assertThat(service.popular(PERIODS.get(period))).isNotNull();
        }
        assertThat(service.popular(Period.MONTH).getFirst().work().getTitle()).isEqualTo("Solo Leveling");
    }

    @Given("{string} has an average of {double} from {int} ratings")
    public void hasAnAverageOf(String title, double average, int count) {
        long total = Math.round(average * count);
        int base = (int) (total / count);
        int extra = (int) (total % count);
        IntStream.range(0, count).forEach(i ->
                ratings.save(WorkRating.rate(UserId.of("rater-" + i), work(title), i < extra ? base + 1 : base, NOW)));
    }

    @When("a reader opens {string}")
    public void aReaderOpens(String page) {
        ranking = service.topRated();
    }

    @Then("{string} is listed")
    public void isListed(String title) {
        assertThat(ranking).extracting(r -> r.work().getTitle()).contains(title);
    }

    @Then("{string} is not listed until it has at least {int} ratings")
    public void isNotListed(String title, int minimum) {
        assertThat(ranking).extracting(r -> r.work().getTitle()).doesNotContain(title);
        assertThat(minimum).isEqualTo(5);
    }

    @When("a reader clicks {string} with the genre {string} wanted")
    public void aReaderClicksSurpriseMe(String button, String genre) {
        surprise = service.surprise(new CatalogQuery(null, Set.of(genre), Set.of(), Set.of(), Set.of(), Set.of())).orElseThrow();
    }

    @Then("a random {string} series opens")
    public void aRandomSeriesOpens(String genre) {
        assertThat(surprise.getGenres()).contains(genre);
    }

    private Release release(int number) {
        return releases.stream().filter(r -> r.chapterNumber().value().equals(String.valueOf(number))).findFirst().orElseThrow();
    }

    private WorkId work(String title) {
        return works.byTitle(title).getId();
    }

    private ChapterId chapter(String title, int number) {
        return chapters.findByWorkIdAndChapterNumber(work(title), ChapterNumber.of(String.valueOf(number))).orElseThrow().getId();
    }

    private void publish(String title, int number, Instant at) {
        chapters.save(new Chapter(ChapterId.generate(), work(title), ChapterNumber.of(String.valueOf(number)), "Chapter " + number,
                ChapterStatus.PUBLISHED, List.of(PageAsset.create(1, "p1.webp", null)), null, at, at, at));
    }
}
