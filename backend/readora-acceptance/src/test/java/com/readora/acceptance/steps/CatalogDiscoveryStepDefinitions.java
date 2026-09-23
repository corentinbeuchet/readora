package com.readora.acceptance.steps;

import com.readora.acceptance.fakes.InMemoryChapterRepository;
import com.readora.acceptance.fakes.InMemoryProjectRepository;
import com.readora.acceptance.fakes.InMemoryTeamRepository;
import com.readora.acceptance.fakes.InMemoryWorkRepository;
import com.readora.acceptance.fakes.NoUserAccounts;
import com.readora.application.port.in.ManageWorkUseCase.WorkDescription;
import com.readora.application.port.in.BrowseCatalogUseCase.CatalogQuery;
import com.readora.application.service.CatalogService;
import com.readora.application.service.WorkManagementService;
import com.readora.domain.common.AccessDeniedDomainException;
import com.readora.domain.common.DomainValidationException;
import com.readora.domain.common.UserId;
import com.readora.domain.scanlation.ScanlationProject;
import com.readora.domain.scanlation.ScanlationRole;
import com.readora.domain.scanlation.Team;
import com.readora.domain.scanlation.TeamMember;
import com.readora.domain.work.ContentRating;
import com.readora.domain.work.Demographic;
import com.readora.domain.work.OriginalLanguage;
import com.readora.domain.work.Work;
import com.readora.domain.work.WorkFacts;
import com.readora.domain.work.WorkStatus;
import com.readora.domain.work.WorkType;
import io.cucumber.datatable.DataTable;
import io.cucumber.java.Before;
import io.cucumber.java.en.Given;
import io.cucumber.java.en.Then;
import io.cucumber.java.en.When;

import java.time.Clock;
import java.util.Arrays;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.regex.Pattern;
import java.util.stream.Collectors;
import java.util.stream.IntStream;

import static org.assertj.core.api.Assertions.assertThat;

/// US-04 Finding a series in the catalog.
public class CatalogDiscoveryStepDefinitions {

    private static final Pattern QUOTED = Pattern.compile("\"([^\"]+)\"");

    private InMemoryWorkRepository works;
    private InMemoryProjectRepository projects;
    private InMemoryTeamRepository teams;
    private CatalogService catalog;
    private WorkManagementService seriesEditing;
    private List<Work> results = List.of();
    private final Map<String, Team> teamLedBy = new HashMap<>();
    private final Map<String, RuntimeException> refusals = new HashMap<>();

    @Before
    public void setup() {
        works = new InMemoryWorkRepository();
        projects = new InMemoryProjectRepository();
        teams = new InMemoryTeamRepository();
        catalog = new CatalogService(works, new InMemoryChapterRepository(), projects, teams, new NoUserAccounts());
        seriesEditing = new WorkManagementService(works, new InMemoryChapterRepository(), projects, teams, new NoUserAccounts(), event -> { },
                Clock.systemUTC());
        results = List.of();
        teamLedBy.clear();
        refusals.clear();
    }

    @Given("the catalog has these series:")
    public void theCatalogHasTheseSeries(DataTable table) {
        for (Map<String, String> row : table.asMaps()) {
            Set<String> genres = Arrays.stream(row.get("genres").split(",")).map(String::trim).collect(Collectors.toSet());
            works.save(Work.create(row.get("title"), "", WorkType.valueOf(row.get("type")), WorkStatus.valueOf(row.get("status")),
                    row.get("author"), Demographic.valueOf(row.get("demographic")), null, genres));
        }
    }

    @Given("{string} is also known as {string}")
    public void isAlsoKnownAs(String title, String otherTitle) {
        Work work = works.byTitle(title);
        work.describe(work.getTitle(), work.getSynopsis(), work.getType(), work.getStatus(), work.getAuthor(), work.getDemographic(),
                work.getCoverImageUrl(), work.getGenres(), new WorkFacts(List.of(otherTitle), null, null, null, null), work.getUpdatedAt());
        works.save(work);
    }

    @When("a reader wants {string} but not {string}")
    public void aReaderWantsButNot(String wanted, String excluded) {
        search(new CatalogQuery(null, Set.of(wanted), Set.of(excluded), Set.of(), Set.of(), Set.of()));
    }

    @When("a reader wants {string} and {string}")
    public void aReaderWantsBoth(String first, String second) {
        search(new CatalogQuery(null, Set.of(first, second), Set.of(), Set.of(), Set.of(), Set.of()));
    }

    @When("a reader filters on type {string} and status {string}")
    public void aReaderFiltersOnTypeAndStatus(String type, String status) {
        search(new CatalogQuery(null, Set.of(), Set.of(), Set.of(WorkType.valueOf(type)), Set.of(WorkStatus.valueOf(status)), Set.of()));
    }

    @When("a reader filters on demographic {string}")
    public void aReaderFiltersOnDemographic(String demographic) {
        search(new CatalogQuery(null, Set.of(), Set.of(), Set.of(), Set.of(), Set.of(Demographic.valueOf(demographic))));
    }

    @When("a reader types {string} in the search box")
    public void aReaderTypesInTheSearchBox(String text) {
        search(new CatalogQuery(text, Set.of(), Set.of(), Set.of(), Set.of(), Set.of()));
    }

    /// Accepts `"A"`, `"A" and "B"` and `"A", "B" and "C"`.
    @Then("the results are {}")
    public void theResultsAre(String titles) {
        List<String> expected = QUOTED.matcher(titles).results().map(m -> m.group(1)).toList();
        assertThat(results).extracting(Work::getTitle).containsExactlyInAnyOrderElementsOf(expected);
    }

    @Then("the suggestions show {string} by {string}")
    public void theSuggestionsShowBy(String title, String author) {
        assertThat(results).singleElement().satisfies(work -> {
            assertThat(work.getTitle()).isEqualTo(title);
            assertThat(work.getAuthor()).isEqualTo(author);
        });
    }

    @Given("scanlator {string} leads a team that translates {string}")
    public void scanlatorLeadsATeamThatTranslates(String leader, String title) {
        Team team = teams.save(Team.create(leader + " Scans", null, UserId.of(leader)));
        projects.save(ScanlationProject.create(team.getName() + " - " + title, works.byTitle(title).getId(), team.getId()));
        teamLedBy.put(leader, team);
    }

    @Given("{string} is a translator of the team of {string}")
    public void isATranslatorOfTheTeamOf(String member, String leader) {
        Team team = teamLedBy.get(leader);
        team.addMember(TeamMember.of(UserId.of(member), ScanlationRole.TRANSLATOR));
        teams.save(team);
    }

    @When("{string} sets the facts of {string} to artist {string}, year {int}, language {string}, rating {string} and other title {string}")
    public void setsTheFactsOf(String editor, String title, String artist, int year, String language, String rating, String otherTitle) {
        describe(editor, title, () -> new WorkFacts(List.of(otherTitle), artist, year, OriginalLanguage.valueOf(language), ContentRating.valueOf(rating)));
    }

    @When("{string} sets the artist of {string} to {string}")
    public void setsTheArtistOf(String editor, String title, String artist) {
        describe(editor, title, () -> new WorkFacts(List.of(), artist, null, null, null));
    }

    @When("{string} gives {string} {int} other titles")
    public void givesOtherTitles(String editor, String title, int count) {
        describe(editor, title, () -> new WorkFacts(IntStream.rangeClosed(1, count).mapToObj(n -> "Title " + n).toList(), null, null, null, null));
    }

    @Then("{string} has artist {string}, year {int}, language {string}, rating {string} and other title {string}")
    public void hasTheFacts(String title, String artist, int year, String language, String rating, String otherTitle) {
        assertThat(refusals).isEmpty();
        assertThat(works.byTitle(title).getFacts())
                .isEqualTo(new WorkFacts(List.of(otherTitle), artist, year, OriginalLanguage.valueOf(language), ContentRating.valueOf(rating)));
    }

    @Then("the edit is refused to {string}")
    public void theEditIsRefusedTo(String editor) {
        assertThat(refusals.get(editor)).isInstanceOf(AccessDeniedDomainException.class);
    }

    @Then("{string} has no artist")
    public void hasNoArtist(String title) {
        assertThat(works.byTitle(title).getFacts().artist()).isNull();
    }

    @Then("the edit is refused because a series has at most {int} other titles")
    public void theEditIsRefusedBecauseOfTooManyTitles(int max) {
        assertThat(refusals.values()).singleElement()
                .isInstanceOf(DomainValidationException.class)
                .satisfies(refusal -> assertThat(refusal).hasMessageContaining("at most " + max + " other titles"));
    }

    /// Edits only the facts: the rest of the description is sent back as it is, as the edit form does.
    private void describe(String editor, String title, java.util.function.Supplier<WorkFacts> facts) {
        Work work = works.byTitle(title);
        try {
            seriesEditing.updateWork(work.getId(), new WorkDescription(work.getTitle(), work.getSynopsis(), work.getType(), work.getStatus(),
                    work.getAuthor(), work.getDemographic(), work.getCoverImageUrl(), work.getGenres(), facts.get()), UserId.of(editor));
        } catch (AccessDeniedDomainException | DomainValidationException refusal) {
            refusals.put(editor, refusal);
        }
    }

    private void search(CatalogQuery query) {
        results = catalog.searchWorks(query, 0, 20).items();
    }
}
