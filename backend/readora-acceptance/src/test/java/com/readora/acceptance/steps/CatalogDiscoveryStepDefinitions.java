package com.readora.acceptance.steps;

import com.readora.acceptance.fakes.InMemoryChapterRepository;
import com.readora.acceptance.fakes.InMemoryProjectRepository;
import com.readora.acceptance.fakes.InMemoryTeamRepository;
import com.readora.acceptance.fakes.InMemoryWorkRepository;
import com.readora.application.port.in.BrowseCatalogUseCase.CatalogQuery;
import com.readora.application.service.CatalogService;
import com.readora.domain.work.Demographic;
import com.readora.domain.work.Work;
import com.readora.domain.work.WorkStatus;
import com.readora.domain.work.WorkType;
import io.cucumber.datatable.DataTable;
import io.cucumber.java.Before;
import io.cucumber.java.en.Given;
import io.cucumber.java.en.Then;
import io.cucumber.java.en.When;

import java.util.Arrays;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.regex.Pattern;
import java.util.stream.Collectors;

import static org.assertj.core.api.Assertions.assertThat;

/// US-04 Finding a series in the catalog.
public class CatalogDiscoveryStepDefinitions {

    private static final Pattern QUOTED = Pattern.compile("\"([^\"]+)\"");

    private InMemoryWorkRepository works;
    private CatalogService catalog;
    private List<Work> results = List.of();

    @Before
    public void setup() {
        works = new InMemoryWorkRepository();
        catalog = new CatalogService(works, new InMemoryChapterRepository(), new InMemoryProjectRepository(), new InMemoryTeamRepository());
        results = List.of();
    }

    @Given("the catalog has these series:")
    public void theCatalogHasTheseSeries(DataTable table) {
        for (Map<String, String> row : table.asMaps()) {
            Set<String> genres = Arrays.stream(row.get("genres").split(",")).map(String::trim).collect(Collectors.toSet());
            works.save(Work.create(row.get("title"), "", WorkType.valueOf(row.get("type")), WorkStatus.valueOf(row.get("status")),
                    row.get("author"), Demographic.valueOf(row.get("demographic")), null, genres));
        }
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

    private void search(CatalogQuery query) {
        results = catalog.searchWorks(query, 0, 20).items();
    }
}
