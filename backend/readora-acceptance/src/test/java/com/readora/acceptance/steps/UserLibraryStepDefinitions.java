package com.readora.acceptance.steps;

import com.readora.acceptance.fakes.InMemoryChapterReadRepository;
import com.readora.acceptance.fakes.InMemoryChapterRepository;
import com.readora.acceptance.fakes.InMemoryLibraryRepository;
import com.readora.acceptance.fakes.InMemoryWorkRepository;
import com.readora.application.port.in.ManageLibraryUseCase.LibraryItem;
import com.readora.application.service.LibraryService;
import com.readora.domain.common.UserId;
import com.readora.domain.social.ReadingStatus;
import com.readora.domain.work.Work;
import com.readora.domain.work.WorkType;
import io.cucumber.java.Before;
import io.cucumber.java.en.Given;
import io.cucumber.java.en.Then;
import io.cucumber.java.en.When;

import java.time.Clock;
import java.util.List;
import java.util.Map;
import java.util.Set;

import static org.assertj.core.api.Assertions.assertThat;

/// US-05 My library.
public class UserLibraryStepDefinitions {

    private static final Map<String, ReadingStatus> STATUS_LABELS = Map.of(
            "Reading", ReadingStatus.READING,
            "Plan to read", ReadingStatus.PLAN_TO_READ,
            "Completed", ReadingStatus.COMPLETED,
            "Dropped", ReadingStatus.DROPPED);

    private InMemoryWorkRepository works;
    private LibraryService library;
    private UserId kenji;
    private List<LibraryItem> shown = List.of();

    @Before
    public void setup() {
        works = new InMemoryWorkRepository();
        InMemoryChapterRepository chapters = new InMemoryChapterRepository();
        library = new LibraryService(new InMemoryLibraryRepository(), works, new InMemoryChapterReadRepository(chapters), Clock.systemUTC());
        shown = List.of();
    }

    @Given("reader {string} has a free account")
    public void readerHasAFreeAccount(String name) {
        kenji = UserId.of(name);
    }

    @Given("the series {string} and {string} are in the catalog")
    public void theSeriesAreInTheCatalog(String first, String second) {
        for (String title : List.of(first, second)) {
            works.save(Work.create(title, "", WorkType.MANHWA, "", Set.of("Action")));
        }
    }

    @When("{string} adds {string} to his library")
    public void addsToHisLibrary(String reader, String title) {
        library.save(UserId.of(reader), works.byTitle(title).getId(), null);
    }

    @When("{string} adds {string} to his library as {string}")
    public void addsToHisLibraryAs(String reader, String title, String status) {
        library.save(UserId.of(reader), works.byTitle(title).getId(), status(status));
    }

    @Given("{string} is reading {string} and plans to read {string}")
    public void isReadingAndPlansToRead(String reader, String reading, String planned) {
        library.save(UserId.of(reader), works.byTitle(reading).getId(), ReadingStatus.READING);
        library.save(UserId.of(reader), works.byTitle(planned).getId(), ReadingStatus.PLAN_TO_READ);
    }

    @Given("{string} has {string} in his library")
    public void hasInHisLibrary(String reader, String title) {
        library.save(UserId.of(reader), works.byTitle(title).getId(), null);
    }

    @When("he shows only {string}")
    public void heShowsOnly(String status) {
        shown = library.list(kenji, status(status));
    }

    @When("he marks {string} as {string}")
    public void heMarksAs(String title, String status) {
        library.save(kenji, works.byTitle(title).getId(), status(status));
    }

    @When("he removes {string} from his library")
    public void heRemovesFromHisLibrary(String title) {
        library.remove(kenji, works.byTitle(title).getId());
    }

    @Then("his library shows {string} as {string}")
    public void hisLibraryShowsAs(String title, String status) {
        assertThat(library.list(kenji, null))
                .filteredOn(item -> item.work().getTitle().equals(title))
                .singleElement()
                .satisfies(item -> assertThat(item.entry().getStatus()).isEqualTo(status(status)));
    }

    @Then("he sees only {string}")
    public void heSeesOnly(String title) {
        assertThat(shown).extracting(item -> item.work().getTitle()).containsExactly(title);
    }

    @Then("his library is empty")
    public void hisLibraryIsEmpty() {
        assertThat(library.list(kenji, null)).isEmpty();
    }

    @Then("the library of reader {string} is empty")
    public void theLibraryOfReaderIsEmpty(String reader) {
        assertThat(library.list(UserId.of(reader), null)).isEmpty();
    }

    private static ReadingStatus status(String label) {
        ReadingStatus status = STATUS_LABELS.get(label);
        if (status == null) {
            throw new IllegalArgumentException("Unknown reading status label: " + label);
        }
        return status;
    }
}
