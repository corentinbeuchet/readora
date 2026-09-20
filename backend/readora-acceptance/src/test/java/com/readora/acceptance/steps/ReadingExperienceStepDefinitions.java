package com.readora.acceptance.steps;

import com.readora.acceptance.fakes.FakeStorage;
import com.readora.acceptance.fakes.InMemoryCommentRepository;
import com.readora.application.service.ReaderSocialService;
import com.readora.domain.social.ChapterComment;
import com.readora.domain.social.CommentContent;
import com.readora.domain.social.CommentId;
import com.readora.acceptance.fakes.InMemoryChapterReadRepository;
import com.readora.acceptance.fakes.InMemoryChapterRepository;
import com.readora.acceptance.fakes.InMemoryLibraryRepository;
import com.readora.acceptance.fakes.InMemoryTeamRepository;
import com.readora.acceptance.fakes.InMemoryWorkRepository;
import com.readora.acceptance.fakes.MutableClock;
import com.readora.application.port.in.ReadChapterUseCase.ChapterReading;
import com.readora.application.port.in.TrackReadingUseCase.HistoryItem;
import com.readora.application.port.in.TrackReadingUseCase.WorkProgress;
import com.readora.application.service.ChapterReadingService;
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

import com.readora.application.service.AssetService;

import java.time.Duration;
import java.util.Arrays;
import java.util.Optional;
import java.time.Instant;
import java.util.List;
import java.util.Set;
import java.util.stream.IntStream;

import static org.assertj.core.api.Assertions.assertThat;

/// US-07 scenarios that need the backend: next chapter, read markers, history, new-chapter badges.
public class ReadingExperienceStepDefinitions {

    private static final Instant START = Instant.parse("2026-09-01T10:00:00Z");

    private MutableClock clock;
    private InMemoryWorkRepository works;
    private InMemoryChapterRepository chapters;
    private ReadingTrackerService reading;
    private LibraryService library;
    private ChapterReadingService chapterReader;
    private ChapterReading opened;
    private UserId reader;
    private WorkProgress progress;
    private List<HistoryItem> history = List.of();
    private final java.util.Map<String, ChapterId> lastChapterRead = new java.util.HashMap<>();
    private InMemoryCommentRepository comments;
    private FakeStorage storage;
    private InMemoryTeamRepository teams;
    private AssetService assets;
    private boolean dataSaver;
    private ReaderSocialService social;
    private List<ChapterComment> shownComments = List.of();

    @Before
    public void setup() {
        clock = new MutableClock(START);
        works = new InMemoryWorkRepository();
        chapters = new InMemoryChapterRepository();
        teams = new InMemoryTeamRepository();
        InMemoryChapterReadRepository reads = new InMemoryChapterReadRepository(chapters);
        reading = new ReadingTrackerService(reads, chapters, works, clock);
        library = new LibraryService(new InMemoryLibraryRepository(), works, reads, clock);
        storage = new FakeStorage();
        chapterReader = new ChapterReadingService(chapters, works, teams, storage);
        // Stand-in for the ImageIO adapter (tested in infrastructure): a copy a quarter of the size.
        assets = new AssetService(storage, image -> Optional.of(Arrays.copyOf(image, image.length / 4)));
        dataSaver = false;
        comments = new InMemoryCommentRepository();
        social = new ReaderSocialService(comments, chapters, event -> { });
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

    @Given("{string} is on the last page of chapter {int} of {string}")
    public void isOnTheLastPageOfChapter(String name, int number, String title) {
        opened = chapterReader.readChapter(chapter(title, number).getId(), reader, "PAGED");
    }

    @Then("he sees a {string} button, a {string} button and the chapter list")
    public void heSeesNavigation(String next, String previous) {
        assertThat(opened.nextChapterId()).as(next).isNotNull();
        assertThat(opened.previousChapterId()).as(previous).isNotNull();
        assertThat(opened.work().getId()).as("chapter list of the series").isEqualTo(opened.chapter().getWorkId());
    }

    @When("he clicks {string}")
    public void heClicks(String button) {
        assertThat(button).isEqualTo("Next chapter");
        ChapterId next = opened.nextChapterId();
        assertThat(next).isNotNull();
        opened = chapterReader.readChapter(next, reader, "PAGED");
    }

    @Then("chapter {int} opens on its first page")
    public void chapterOpensOnItsFirstPage(int number) {
        assertThat(opened.chapter().getChapterNumber().value()).isEqualTo(String.valueOf(number));
        assertThat(opened.chapter().getPages()).isNotEmpty();
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

    @Given("{string} read chapters {int} to {int} of {string} on another site")
    public void readChaptersOnAnotherSite(String name, int from, int to, String title) {
        WorkId workId = works.byTitle(title).getId();
        for (int n = from; n <= to + 1; n++) {
            if (chapters.findByWorkIdAndChapterNumber(workId, ChapterNumber.of(String.valueOf(n))).isEmpty()) {
                publish(workId, n, START.minus(Duration.ofDays(1)));
            }
        }
    }

    @When("he chooses {string} on chapter {int}")
    public void heChoosesOnChapter(String action, int number) {
        assertThat(action).isEqualTo("Mark all previous as read");
        progress = reading.markReadUpTo(reader, chapter("Solo Leveling", number).getId());
    }

    @Then("chapters {int} to {int} are marked as read")
    public void chaptersAreMarkedAsRead(int from, int to) {
        chaptersAreDimmed(from, to);
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

    /// Upvotes 0..7 on eight comments of chapter 5 of "Solo Leveling"; the two most upvoted are spoilers.
    @Given("chapter {int} has many comments")
    public void chapterHasManyComments(int number) {
        Chapter chapter = chapter("Solo Leveling", number);
        for (int upvotes = 0; upvotes < 8; upvotes++) {
            comments.save(new ChapterComment(CommentId.generate(), chapter.getId(), UserId.of("fan-" + upvotes), "fan-" + upvotes,
                    CommentContent.of("Comment with " + upvotes + " upvotes"), null, null, 1, upvotes >= 6, upvotes,
                    START.plusSeconds(upvotes)));
        }
    }

    @When("{string} reaches the last page")
    public void reachesTheLastPage(String name) {
        shownComments = social.topComments(chapter("Solo Leveling", 5).getId(), 3);
    }

    @Then("the three most-upvoted comments without spoilers are shown under it")
    public void theThreeMostUpvotedCommentsWithoutSpoilersAreShown() {
        assertThat(shownComments).extracting(ChapterComment::getUpvotes).containsExactly(5, 4, 3);
        assertThat(shownComments).noneMatch(ChapterComment::isSpoiler);
    }

    @When("{string} turns on {string}")
    public void turnsOn(String name, String setting) {
        assertThat(setting).isEqualTo("Data saver");
        dataSaver = true;
    }

    /// A team uploads chapter 6 as usual; every page gets a lighter copy that the reader serves in data-saver mode.
    @Then("chapters load lighter, lower-quality images")
    public void chaptersLoadLighterImages() {
        WorkId workId = works.byTitle("Solo Leveling").getId();
        List<PageAsset> pages = IntStream.rangeClosed(1, 3).mapToObj(n -> {
            var stored = assets.upload("scans/solo/6", "p" + n + ".webp", "image/webp", new byte[4000]);
            return new PageAsset(n, stored.storageKey(), stored.publicUrl(), 800, 1200, null, stored.litePublicUrl());
        }).toList();
        Chapter six = new Chapter(ChapterId.generate(), workId, ChapterNumber.of("6"), "Chapter 6", ChapterStatus.PUBLISHED,
                pages, teams.anyTeam(), START, START, START);
        chapters.save(six);

        List<PageAsset> read = chapterReader.readChapter(six.getId(), reader, "VERTICAL").chapter().getPages();
        assertThat(dataSaver).isTrue();
        assertThat(read).allSatisfy(page -> {
            String lite = page.liteCdnUrl();
            assertThat(lite).isNotNull().isNotEqualTo(page.cdnUrl());
            assertThat(storage.loadByUrl(lite).orElseThrow().length)
                    .isLessThan(storage.loadByUrl(page.cdnUrl()).orElseThrow().length);
        });
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
                ChapterStatus.PUBLISHED, List.of(PageAsset.create(1, "p1.webp", null)), teams.anyTeam(), at, at, at));
    }
}
