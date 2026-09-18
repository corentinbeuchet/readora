package com.readora.acceptance.steps;

import com.readora.acceptance.fakes.InMemoryRatingRepository;
import com.readora.acceptance.fakes.InMemoryWorkRepository;
import com.readora.application.port.in.RateWorkUseCase.ReviewItem;
import com.readora.application.service.RatingService;
import com.readora.domain.common.DomainValidationException;
import com.readora.domain.common.UserId;
import com.readora.domain.rating.Review;
import com.readora.domain.work.Work;
import com.readora.domain.work.WorkId;
import com.readora.domain.work.WorkType;
import io.cucumber.java.Before;
import io.cucumber.java.en.Given;
import io.cucumber.java.en.Then;
import io.cucumber.java.en.When;

import java.time.Clock;
import java.util.Set;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

/// US-09 Ratings and reviews.
public class RatingsAndReviewsStepDefinitions {

    private InMemoryWorkRepository works;
    private InMemoryRatingRepository ratings;
    private RatingService service;

    @Before
    public void setup() {
        works = new InMemoryWorkRepository();
        ratings = new InMemoryRatingRepository();
        service = new RatingService(ratings, works, Clock.systemUTC());
    }

    @Given("{string} and {string} are signed in")
    public void areSignedIn(String first, String second) {
        // Readers are identified by name in these scenarios.
    }

    @Given("the catalog has the series {string}")
    public void theCatalogHasTheSeries(String title) {
        works.save(Work.create(title, "", WorkType.MANGA, "", Set.of()));
    }

    @When("{string} rates {string} {int} out of {int}")
    public void ratesOutOf(String reader, String title, int score, int max) {
        service.rate(UserId.of(reader), work(title), score);
    }

    @Then("his rating of {string} is {int}")
    public void hisRatingIs(String title, int score) {
        assertThat(service.myRating(UserId.of("Kenji"), work(title)).orElseThrow().getScore()).isEqualTo(score);
    }

    @When("he rates it {int}")
    public void heRatesIt(int score) {
        service.rate(UserId.of("Kenji"), work("Berserk"), score);
    }

    @Then("his rating of {string} is {int} and he still counts as one rating")
    public void hisRatingIsAndCountsOnce(String title, int score) {
        hisRatingIs(title, score);
        assertThat(service.summary(work(title)).count()).isEqualTo(1);
    }

    @Given("{string} rated {string} {int} and {string} rated it {int}")
    public void ratedAndRated(String first, String title, int firstScore, String second, int secondScore) {
        service.rate(UserId.of(first), work(title), firstScore);
        service.rate(UserId.of(second), work(title), secondScore);
    }

    @When("a reader opens the page of {string}")
    public void aReaderOpens(String title) {
        // The page shows the summary checked in the next step.
    }

    @Then("it shows a score of {double} from {int} ratings")
    public void itShowsAScoreOf(double average, int count) {
        var summary = service.summary(work("Berserk"));
        assertThat(summary.average()).isEqualTo(average);
        assertThat(summary.count()).isEqualTo(count);
    }

    @When("{string} writes a review of {string} with what he liked, what he didn't and a verdict")
    @Given("{string} wrote a review of {string}")
    public void writesAReview(String reader, String title) {
        service.review(UserId.of(reader), work(title), 9, new Review("The art", "The hiatus", "A masterpiece"));
    }

    @Then("the review appears on the {string} page with his rating")
    public void theReviewAppears(String title) {
        assertThat(service.reviews(work(title))).singleElement().satisfies(item -> {
            assertThat(item.rating().getScore()).isEqualTo(9);
            assertThat(item.rating().getReview()).isNotNull();
        });
    }

    @When("{string} marks it as helpful")
    public void marksItAsHelpful(String reader) {
        service.markHelpful(UserId.of(reader), onlyReview().rating().getId());
    }

    @Then("the review shows {int} helpful vote")
    public void theReviewShowsHelpfulVotes(int votes) {
        assertThat(onlyReview().helpfulVotes()).isEqualTo(votes);
    }

    @Then("{string} cannot mark his own review as helpful")
    public void cannotMarkOwnReview(String reader) {
        assertThatThrownBy(() -> service.markHelpful(UserId.of(reader), onlyReview().rating().getId()))
                .isInstanceOf(DomainValidationException.class);
    }

    private ReviewItem onlyReview() {
        return service.reviews(work("Berserk")).getFirst();
    }

    private WorkId work(String title) {
        return works.byTitle(title).getId();
    }
}
