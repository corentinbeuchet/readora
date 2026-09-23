package com.readora.acceptance.steps;

import com.readora.acceptance.fakes.FakeStorage;
import com.readora.acceptance.fakes.InMemoryChapterReadRepository;
import com.readora.acceptance.fakes.InMemoryChapterRepository;
import com.readora.acceptance.fakes.InMemoryCommunity;
import com.readora.acceptance.fakes.InMemoryDiscovery;
import com.readora.acceptance.fakes.InMemoryLibraryRepository;
import com.readora.acceptance.fakes.InMemoryProjectRepository;
import com.readora.acceptance.fakes.InMemoryTeamRepository;
import com.readora.acceptance.fakes.InMemoryRatingRepository;
import com.readora.acceptance.fakes.InMemoryUserAccounts;
import com.readora.acceptance.fakes.InMemoryWorkRepository;
import com.readora.application.port.in.ReadChapterUseCase.ChapterReading;
import com.readora.application.port.in.CommunityUseCase.PublicProfile;
import com.readora.application.port.in.CommunityUseCase.TeamPage;
import com.readora.application.port.in.CommunityUseCase.TeamSeries;
import com.readora.application.port.in.DiscoverUseCase.Release;
import com.readora.application.port.in.ManageLibraryUseCase.ExportRow;
import com.readora.application.service.ChapterReadingService;
import com.readora.application.service.WorkManagementService;
import com.readora.application.service.CommunityService;
import com.readora.application.service.TeamManagementService;
import com.readora.domain.common.AccessDeniedDomainException;
import com.readora.domain.common.DomainValidationException;
import com.readora.domain.common.ErrorCodes;
import com.readora.application.service.DiscoveryService;
import com.readora.application.service.LibraryService;
import com.readora.application.service.ReadingTrackerService;
import com.readora.domain.common.UserId;
import com.readora.domain.identity.Email;
import com.readora.domain.identity.PasswordHash;
import com.readora.domain.identity.UserAccount;
import com.readora.domain.scanlation.ScanlationProject;
import com.readora.domain.scanlation.ScanlationRole;
import com.readora.domain.scanlation.Team;
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
import org.jspecify.annotations.Nullable;

import java.util.List;
import java.util.Locale;
import java.util.Set;

import static org.assertj.core.api.Assertions.assertThat;

/// US-12 Community and scanlation teams.
public class CommunityStepDefinitions {

    private InMemoryWorkRepository works;
    private InMemoryChapterRepository chapters;
    private InMemoryProjectRepository projects;
    private InMemoryTeamRepository teams;
    private InMemoryUserAccounts users;
    private CommunityService community;
    private TeamManagementService teamManagement;
    private WorkManagementService publishing;
    private ChapterReadingService chapterReader;
    private ChapterReading opened;
    private @Nullable RuntimeException refusal;
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
        teams = new InMemoryTeamRepository();
        users = new InMemoryUserAccounts();
        InMemoryLibraryRepository libraryRepository = new InMemoryLibraryRepository();
        InMemoryChapterReadRepository reads = new InMemoryChapterReadRepository(chapters);
        InMemoryCommunity communityQueries = new InMemoryCommunity(works, reads, libraryRepository, users, chapters);
        InMemoryDiscovery discoveryQueries = new InMemoryDiscovery(works, chapters, libraryRepository, reads);
        discoveryQueries.followedTeams(communityQueries::followedBy);
        Clock clock = Clock.systemUTC();
        community = new CommunityService(users, communityQueries, teams, projects, works, clock);
        teamManagement = new TeamManagementService(teams, projects, works, users, clock);
        publishing = new WorkManagementService(works, chapters, projects, teams, users, event -> { }, clock);
        chapterReader = new ChapterReadingService(chapters, works, teams, new FakeStorage());
        refusal = null;
        discovery = new DiscoveryService(discoveryQueries, works, new InMemoryRatingRepository(), teams, clock);
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
        community.follow(UserId.of(reader), team(teamName).getTeamId());
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
        ScanlationProject first = team(teamName);
        Work secondSeries = works.save(Work.create("Omniscient Reader", "", WorkType.MANHWA, "", Set.of()));
        ScanlationProject second = projects.save(ScanlationProject.create(teamName, secondSeries.getId(), first.getTeamId()));
        publish(works.findById(first.getWorkId()).orElseThrow(), first, "1");
        publish(works.findById(first.getWorkId()).orElseThrow(), first, "2");
        publish(secondSeries, second, "1");
        team = community.team(first.getTeamId(), null);
    }

    @Then("they see its members, every series it translates and its latest chapters")
    public void theySeeMembersSeriesAndChapters() {
        assertThat(team.name()).isEqualTo("Shadow Scans");
        assertThat(team.members()).extracting(m -> m.username()).containsExactly("leader", "translator");
        assertThat(team.series()).extracting(series -> series.work().getTitle(), TeamSeries::chapterCount)
                .containsExactly(org.assertj.core.groups.Tuple.tuple("Solo Leveling", 2L), org.assertj.core.groups.Tuple.tuple("Omniscient Reader", 1L));
        assertThat(team.latestChapters()).hasSize(3);
    }

    @Given("scanlator {string} leads the team {string}")
    @When("scanlator {string} creates the team {string}")
    public void scanlatorCreatesTheTeam(String scanlator, String teamName) {
        try {
            teamManagement.createTeam(account(scanlator), teamName, null);
        } catch (RuntimeException e) {
            refusal = e;
        }
    }

    @Then("{string} is the leader of {string}")
    public void isTheLeaderOf(String scanlator, String teamName) {
        assertThat(teamNamed(teamName).isLeader(account(scanlator))).isTrue();
    }

    @Then("the page of the team {string} lists no series yet")
    public void thePageListsNoSeriesYet(String teamName) {
        assertThat(community.team(teamNamed(teamName).getId(), null).series()).isEmpty();
    }

    @Then("the team is refused because the name is taken")
    public void theTeamIsRefusedBecauseTheNameIsTaken() {
        assertThat(refusal).isInstanceOfSatisfying(DomainValidationException.class, e -> assertThat(e.code()).isEqualTo(ErrorCodes.TEAM_NAME_TAKEN));
    }

    @Given("{string} is already translated by the team {string}")
    public void isAlreadyTranslatedBy(String title, String teamName) {
        team(teamName);
    }

    @Given("{string} added {string} to {string} as {string}")
    public void addedAMember(String leader, String member, String teamName, String role) {
        teamManagement.setMember(account(leader), teamNamed(teamName).getId(), account(member).value().toLowerCase(Locale.ROOT),
                Set.of(ScanlationRole.valueOf(role)));
    }

    @When("{string} adds the series {string} to {string}")
    @When("{string} tries to add the series {string} to {string}")
    public void addsTheSeriesTo(String actor, String title, String teamName) {
        Work work = works.all().stream().filter(w -> w.getTitle().equals(title)).findFirst()
                .orElseGet(() -> works.save(Work.create(title, "", WorkType.MANHWA, "", Set.of())));
        attempt(() -> teamManagement.addSeries(account(actor), teamNamed(teamName).getId(), work.getId()));
    }

    @When("{string} tries to add {string} to {string} as {string}")
    public void triesToAddAMember(String actor, String member, String teamName, String role) {
        String username = account(member).value().toLowerCase(Locale.ROOT);
        attempt(() -> teamManagement.setMember(account(actor), teamNamed(teamName).getId(), username, Set.of(ScanlationRole.valueOf(role))));
    }

    @When("{string} tries to leave {string}")
    public void triesToLeave(String member, String teamName) {
        String username = account(member).value().toLowerCase(Locale.ROOT);
        attempt(() -> teamManagement.removeMember(account(member), teamNamed(teamName).getId(), username));
    }

    @Then("{string} has its own task board for {string}")
    public void hasItsOwnTaskBoardFor(String teamName, String title) {
        Team moon = teamNamed(teamName);
        assertThat(refusal).isNull();
        assertThat(projects.findByTeamId(moon.getId())).singleElement()
                .satisfies(board -> assertThat(works.findById(board.getWorkId()).orElseThrow().getTitle()).isEqualTo(title));
        assertThat(projects.findByWorkId(projects.findByTeamId(moon.getId()).getFirst().getWorkId())).hasSize(2);
    }

    @Then("the page of the team {string} lists the series {string}")
    public void thePageListsTheSeries(String teamName, String title) {
        assertThat(community.team(teamNamed(teamName).getId(), null).series()).extracting(series -> series.work().getTitle()).containsExactly(title);
    }

    @When("{string} publishes chapter {int} of {string} for {string}")
    public void publishesChapterFor(String publisher, int number, String title, String teamName) {
        Work work = works.all().stream().filter(w -> w.getTitle().equals(title)).findFirst().orElseThrow();
        attempt(() -> publishing.directPublishChapter(work.getId(), teamNamed(teamName).getId(), String.valueOf(number), "Chapter " + number,
                List.of(PageAsset.create(1, "p1.webp", null)), account(publisher)));
    }

    @Then("the chapter is refused because {string} does not work on the series")
    public void theChapterIsRefusedBecauseTheTeamDoesNotWorkOnTheSeries(String teamName) {
        assertThat(refusal).isInstanceOfSatisfying(DomainValidationException.class, e -> assertThat(e.code()).isEqualTo(ErrorCodes.TEAM_NOT_ON_SERIES));
        refusal = null;
    }

    @Then("chapter {int} of {string} is credited to {string}")
    public void chapterIsCreditedTo(int number, String title, String teamName) {
        assertThat(refusal).isNull();
        Work work = works.all().stream().filter(w -> w.getTitle().equals(title)).findFirst().orElseThrow();
        assertThat(chapters.firstVersion(work.getId(), ChapterNumber.of(String.valueOf(number))))
                .hasValueSatisfying(chapter -> assertThat(chapter.getTeamId()).isEqualTo(teamNamed(teamName).getId()));
    }

    @Given("{string} and {string} both published chapters {int} and {int} of {string}")
    public void bothPublishedChapters(String firstTeam, String secondTeam, int first, int second, String title) {
        ScanlationProject shadow = team(firstTeam);
        ScanlationProject moon = secondTeamOn(shadow, secondTeam);
        Work work = works.findById(shadow.getWorkId()).orElseThrow();
        Instant start = Instant.parse("2026-09-01T10:00:00Z");
        int hour = 0;
        for (int number : List.of(first, second)) {
            publishAt(work, shadow, number, start.plusSeconds(3600L * hour++));
            publishAt(work, moon, number, start.plusSeconds(3600L * hour++));
        }
    }

    @Given("only {string} published chapter {int} of {string}")
    public void onlyOneTeamPublished(String teamName, int number, String title) {
        ScanlationProject project = projectOfTeam(teamName);
        publishAt(works.findById(project.getWorkId()).orElseThrow(), project, number, Instant.parse("2026-09-02T10:00:00Z"));
    }

    @When("{string} opens chapter {int} by {string}")
    public void opensChapterBy(String reader, int number, String teamName) {
        ScanlationProject project = projectOfTeam(teamName);
        Chapter chapter = chapters.findByWorkIdAndChapterNumberAndTeam(project.getWorkId(), ChapterNumber.of(String.valueOf(number)), project.getTeamId())
                .orElseThrow();
        opened = chapterReader.readChapter(chapter.getId(), account(reader), "VERTICAL");
    }

    @Then("he can switch to the version by {string}")
    public void heCanSwitchToTheVersionBy(String teamName) {
        assertThat(opened.versions()).extracting(version -> version.team().name()).containsExactly(teamName, opened.team().name());
    }

    @Then("the next chapter is chapter {int} by {string}")
    public void theNextChapterIsBy(int number, String teamName) {
        assertThat(opened.next()).isNotNull();
        assertThat(opened.next().number()).isEqualTo(ChapterNumber.of(String.valueOf(number)));
        assertThat(opened.next().versions()).filteredOn(version -> version.chapterId().equals(opened.next().defaultChapterId()))
                .singleElement()
                .satisfies(version -> assertThat(version.team().name()).isEqualTo(teamName));
    }

    @When("{string} publishes chapter {int} of {string} again")
    public void publishesChapterAgain(String teamName, int number, String title) {
        ScanlationProject project = projectOfTeam(teamName);
        Team roster = teams.findById(project.getTeamId()).orElseThrow();
        UserId leader = roster.getMembers().stream().filter(m -> roster.isLeader(m.userId())).findFirst().orElseThrow().userId();
        attempt(() -> publishing.directPublishChapter(project.getWorkId(), project.getTeamId(), String.valueOf(number), "Again",
                List.of(PageAsset.create(1, "p1.webp", null)), leader));
    }

    @Then("the chapter is refused because the team already published it")
    public void theChapterIsRefusedBecauseTheTeamAlreadyPublishedIt() {
        assertThat(refusal).isInstanceOfSatisfying(DomainValidationException.class, e -> assertThat(e.code()).isEqualTo(ErrorCodes.CHAPTER_ALREADY_EXISTS));
    }

    @Then("the team refuses what {string} asked")
    public void theTeamRefusesWhatWasAsked(String actor) {
        assertThat(refusal).isInstanceOf(AccessDeniedDomainException.class);
        refusal = null;
    }

    @Then("the team refuses because it would have no leader")
    public void theTeamRefusesBecauseItWouldHaveNoLeader() {
        assertThat(refusal).isInstanceOfSatisfying(DomainValidationException.class, e -> assertThat(e.code()).isEqualTo(ErrorCodes.LAST_LEADER));
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
            Team roster = Team.create(teamName, null, account("leader"));
            roster.addMember(TeamMember.of(account("translator"), ScanlationRole.TRANSLATOR));
            teams.save(roster);
            return projects.save(ScanlationProject.create(teamName, work.getId(), roster.getId()));
        });
    }

    /// A second team with its own task board on the series of `first`.
    private ScanlationProject secondTeamOn(ScanlationProject first, String teamName) {
        Team roster = teams.save(Team.create(teamName, null, account("moonleader")));
        return projects.save(ScanlationProject.create(teamName, first.getWorkId(), roster.getId()));
    }

    private ScanlationProject projectOfTeam(String teamName) {
        return projects.findByWorkId(team("Shadow Scans").getWorkId()).stream().filter(p -> p.getName().equals(teamName)).findFirst().orElseThrow();
    }

    private void publishAt(Work work, ScanlationProject project, int number, Instant at) {
        chapters.save(new Chapter(ChapterId.generate(), work.getId(), ChapterNumber.of(String.valueOf(number)), "Chapter " + number,
                ChapterStatus.PUBLISHED, List.of(PageAsset.create(1, "p1.webp", null)), project.getTeamId(), at, at, at));
    }

    private Team teamNamed(String teamName) {
        return teams.findByMember(account("mina")).stream().filter(t -> t.getName().equals(teamName)).findFirst().orElseThrow();
    }

    private void attempt(Runnable action) {
        try {
            action.run();
        } catch (RuntimeException e) {
            refusal = e;
        }
    }

    private UserId account(String name) {
        String username = name.toLowerCase(Locale.ROOT);
        return users.findByUsername(username).map(UserAccount::getId).orElseGet(() -> {
            UserAccount account = new UserAccount(UserId.of(name), Email.of(username + "@readora.test"), username, PasswordHash.of("$2a$hash"),
                    null, null, null, Set.of(com.readora.domain.identity.Role.READER), Instant.now(), Instant.now());
            return users.save(account).getId();
        });
    }

    private Chapter publish(Work work, ScanlationProject project, String number) {
        Instant now = Instant.now();
        return chapters.save(new Chapter(ChapterId.generate(), work.getId(), ChapterNumber.of(number), "Chapter " + number, ChapterStatus.PUBLISHED,
                List.of(PageAsset.create(1, "p1.webp", null)), project != null ? project.getTeamId() : teams.anyTeam(), now, now, now));
    }
}
