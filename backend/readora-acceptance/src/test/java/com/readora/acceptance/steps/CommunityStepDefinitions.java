package com.readora.acceptance.steps;

import com.readora.acceptance.fakes.InMemoryChapterReadRepository;
import com.readora.acceptance.fakes.InMemoryChapterRepository;
import com.readora.acceptance.fakes.InMemoryCommunity;
import com.readora.acceptance.fakes.InMemoryDiscovery;
import com.readora.acceptance.fakes.InMemoryLibraryRepository;
import com.readora.acceptance.fakes.InMemoryProjectRepository;
import com.readora.acceptance.fakes.InMemoryRatingRepository;
import com.readora.acceptance.fakes.InMemoryUserAccounts;
import com.readora.acceptance.fakes.InMemoryWorkRepository;
import com.readora.application.port.in.CommunityUseCase.PublicProfile;
import com.readora.application.port.in.CommunityUseCase.TeamPage;
import com.readora.application.port.in.DiscoverUseCase.Release;
import com.readora.application.port.in.ManageLibraryUseCase.ExportRow;
import com.readora.application.service.CommunityService;
import com.readora.application.service.DiscoveryService;
import com.readora.application.service.LibraryService;
import com.readora.application.service.ReadingTrackerService;
import com.readora.domain.common.UserId;
import com.readora.domain.identity.Email;
import com.readora.domain.identity.PasswordHash;
import com.readora.domain.identity.UserAccount;
import com.readora.domain.scanlation.ScanlationProject;
import com.readora.domain.scanlation.ScanlationRole;
import com.readora.domain.scanlation.TeamMember;
import com.readora.domain.social.ReadingStatus;
import com.readora.domain.work.Chapter;
import com.readora.domain.work.ChapterId;
import com.readora.domain.work.ChapterNumber;
import com.readora.domain.work.ChapterStatus;
import com.readora.domain.work.PageAsset;
import com.readora.domain.work.Work;
import com.readora.domain.work.WorkType;
import io.cucumber.java.Before;
import io.cucumber.java.en.Given;
import io.cucumber.java.en.Then;
import io.cucumber.java.en.When;

import java.time.Clock;
import java.time.Instant;
import java.util.List;
import java.util.Locale;
import java.util.Set;

import static org.assertj.core.api.Assertions.assertThat;

/// US-12 Community and scanlation teams.
public class CommunityStepDefinitions {

    private InMemoryWorkRepository works;
    private InMemoryChapterRepository chapters;
    private InMemoryProjectRepository projects;
    private InMemoryUserAccounts users;
    private CommunityService community;
    private DiscoveryService discovery;
    private LibraryService library;
    private ReadingTrackerService reading;
    private PublicProfile profile;
    private TeamPage team;
    private List<ExportRow> export = List.of();
    private Chapter published;

    @Before
    public void setup() {
        works = new InMemoryWorkRepository();
        chapters = new InMemoryChapterRepository();
        projects = new InMemoryProjectRepository();
        users = new InMemoryUserAccounts();
        InMemoryLibraryRepository libraryRepository = new InMemoryLibraryRepository();
        InMemoryChapterReadRepository reads = new InMemoryChapterReadRepository(chapters);
        InMemoryCommunity communityQueries = new InMemoryCommunity(works, reads, libraryRepository, users);
        InMemoryDiscovery discoveryQueries = new InMemoryDiscovery(works, chapters, libraryRepository, reads);
        discoveryQueries.followedTeams(communityQueries::followedBy);
        Clock clock = Clock.systemUTC();
        community = new CommunityService(users, communityQueries, projects, works, chapters, clock);
        discovery = new DiscoveryService(discoveryQueries, works, new InMemoryRatingRepository(), clock);
        library = new LibraryService(libraryRepository, works, reads, clock);
        reading = new ReadingTrackerService(reads, chapters, works, clock);
    }

    @Given("{string} read {int} chapters, mostly {string} and {string}")
    public void readChaptersMostly(String reader, int count, String firstGenre, String secondGenre) {
        UserId kenji = account(reader);
        Work favourite = works.save(Work.create("Solo Leveling", "", WorkType.MANHWA, "", Set.of(firstGenre, secondGenre)));
        Work other = works.save(Work.create("Horimiya", "", WorkType.MANGA, "", Set.of("Romance")));
        for (int n = 1; n <= count; n++) {
            Work work = n % 10 == 0 ? other : favourite;
            reading.recordRead(kenji, publish(work, null, String.valueOf(n)).getId(), true);
        }
        library.save(kenji, other.getId(), ReadingStatus.COMPLETED);
    }

    @When("{string} opens the profile of {string}")
    public void opensTheProfileOf(String visitor, String reader) {
        profile = community.profile(reader.toLowerCase(Locale.ROOT));
    }

    @Then("she sees his chapters read, his favourite genres and his completed series")
    public void seesStats() {
        assertThat(profile.chaptersRead()).isEqualTo(120);
        assertThat(profile.topGenres()).startsWith("Action", "Fantasy").hasSize(3);
        assertThat(profile.completedSeries()).extracting(Work::getTitle).containsExactly("Horimiya");
    }

    @When("{string} follows the team {string}")
    public void followsTheTeam(String reader, String teamName) {
        account(reader);
        community.follow(UserId.of(reader), team(teamName).getId());
    }

    @When("{string} publishes a chapter")
    public void publishesAChapter(String teamName) {
        ScanlationProject project = team(teamName);
        published = publish(works.findById(project.getWorkId()).orElseThrow(), project, "1");
    }

    @Then("the chapter appears in his {string} feed")
    public void theChapterAppearsInHisFeed(String feed) {
        List<Release> mine = discovery.latest(UserId.of("Kenji"), true, 0);
        assertThat(mine).extracting(Release::chapterId).containsExactly(published.getId());
    }

    @When("a reader opens the page of the team {string}")
    public void aReaderOpensThePageOfTheTeam(String teamName) {
        ScanlationProject project = team(teamName);
        publish(works.findById(project.getWorkId()).orElseThrow(), project, "1");
        team = community.team(project.getId(), null);
    }

    @Then("they see its members, the series it translates and its latest chapters")
    public void theySeeMembersSeriesAndChapters() {
        assertThat(team.members()).extracting(m -> m.username()).containsExactly("leader", "translator");
        assertThat(team.series().getTitle()).isEqualTo("Solo Leveling");
        assertThat(team.latestChapters()).hasSize(1);
    }

    @When("{string} exports his library")
    public void exportsHisLibrary(String reader) {
        UserId kenji = account(reader);
        Work solo = works.save(Work.create("Solo Leveling", "", WorkType.MANHWA, "", Set.of()));
        Work berserk = works.save(Work.create("Berserk", "", WorkType.MANGA, "", Set.of()));
        library.save(kenji, solo.getId(), ReadingStatus.READING);
        library.save(kenji, berserk.getId(), ReadingStatus.PLAN_TO_READ);
        reading.recordRead(kenji, publish(solo, null, "5").getId(), false);
        export = library.export(kenji);
    }

    @Then("he downloads a file listing each series with its status and last chapter read")
    public void heDownloadsAFile() {
        assertThat(export).extracting(ExportRow::title, ExportRow::status, ExportRow::lastChapterRead).containsExactlyInAnyOrder(
                org.assertj.core.groups.Tuple.tuple("Solo Leveling", ReadingStatus.READING, "5"),
                org.assertj.core.groups.Tuple.tuple("Berserk", ReadingStatus.PLAN_TO_READ, null));
    }

    /// The team translating "Solo Leveling" (created on first use): a leader and a translator.
    private ScanlationProject team(String teamName) {
        Work work = works.all().stream().filter(w -> w.getTitle().equals("Solo Leveling")).findFirst()
                .orElseGet(() -> works.save(Work.create("Solo Leveling", "", WorkType.MANHWA, "", Set.of())));
        return projects.findByWorkId(work.getId()).stream().findFirst().orElseGet(() -> {
            ScanlationProject project = ScanlationProject.create(teamName, work.getId(), account("leader"));
            project.addMember(TeamMember.of(account("translator"), ScanlationRole.TRANSLATOR));
            return projects.save(project);
        });
    }

    private UserId account(String name) {
        String username = name.toLowerCase(Locale.ROOT);
        return users.findByUsername(username).map(UserAccount::getId).orElseGet(() -> {
            UserAccount account = new UserAccount(UserId.of(name), Email.of(username + "@readora.test"), username, PasswordHash.of("$2a$hash"),
                    null, null, null, Set.of(com.readora.domain.identity.Role.READER), null, Instant.now(), Instant.now());
            return users.save(account).getId();
        });
    }

    private Chapter publish(Work work, ScanlationProject project, String number) {
        Instant now = Instant.now();
        return chapters.save(new Chapter(ChapterId.generate(), work.getId(), ChapterNumber.of(number), "Chapter " + number, ChapterStatus.PUBLISHED,
                List.of(PageAsset.create(1, "p1.webp", null)), project != null ? project.getId() : null, now, now, now));
    }
}
