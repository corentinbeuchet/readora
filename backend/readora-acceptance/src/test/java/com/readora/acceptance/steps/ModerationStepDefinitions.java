package com.readora.acceptance.steps;

import com.readora.acceptance.fakes.InMemoryChapterRepository;
import com.readora.acceptance.fakes.InMemoryCommentReportRepository;
import com.readora.acceptance.fakes.InMemoryCommentRepository;
import com.readora.acceptance.fakes.InMemoryUserAccounts;
import com.readora.acceptance.fakes.InMemoryWorkRepository;
import com.readora.acceptance.fakes.MutableClock;
import com.readora.application.exception.CommentRateLimitedException;
import com.readora.application.port.in.ModerateCommentsUseCase.QueueItem;
import com.readora.application.service.ModerationService;
import com.readora.application.service.ReaderSocialService;
import com.readora.domain.scanlation.TeamId;
import com.readora.domain.common.AccessDeniedDomainException;
import com.readora.domain.common.UserId;
import com.readora.domain.identity.Email;
import com.readora.domain.identity.PasswordHash;
import com.readora.domain.identity.Role;
import com.readora.domain.identity.UserAccount;
import com.readora.domain.moderation.CommentReportReason;
import com.readora.domain.social.ChapterComment;
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
import org.jspecify.annotations.Nullable;

import java.time.Duration;
import java.time.Instant;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

/// US-11 Keeping discussions healthy.
public class ModerationStepDefinitions {

    private static final Map<String, CommentReportReason> REASONS = Map.of(
            "Unmarked spoiler", CommentReportReason.UNMARKED_SPOILER,
            "Harassment", CommentReportReason.HARASSMENT,
            "Spam", CommentReportReason.SPAM);

    private MutableClock clock;
    private InMemoryUserAccounts users;
    private ReaderSocialService social;
    private ModerationService moderation;
    private ChapterId chapterId;
    private ChapterComment aoiComment;
    private UserId moderator;
    private @Nullable RuntimeException refusal;

    @Before
    public void setup() {
        // Comments take their creation time from the system clock, so the scenario clock starts now.
        clock = new MutableClock(Instant.now());
        users = new InMemoryUserAccounts();
        InMemoryChapterRepository chapters = new InMemoryChapterRepository();
        InMemoryCommentRepository comments = new InMemoryCommentRepository();
        social = new ReaderSocialService(comments, chapters, event -> { }, clock, Duration.ofSeconds(10));
        moderation = new ModerationService(new InMemoryCommentReportRepository(), comments, users, clock);
        Work work = new InMemoryWorkRepository().save(Work.create("Solo Leveling", "", WorkType.MANHWA, "", Set.of()));
        Instant earlier = clock.instant().minus(Duration.ofDays(1));
        chapterId = chapters.save(new Chapter(ChapterId.generate(), work.getId(), ChapterNumber.of("5"), "Chapter 5", ChapterStatus.PUBLISHED,
                List.of(PageAsset.create(1, "p1.webp", null)), TeamId.generate(), earlier, earlier, earlier)).getId();
        refusal = null;
    }

    @Given("{string} posted a comment on chapter {int} of {string}")
    public void postedACommentOnChapter(String reader, int number, String title) {
        aoiComment = social.postRootComment(chapterId, UserId.of(reader), reader, "Big reveal in the last page!", null, false);
    }

    @Given("{string} is a moderator")
    public void isAModerator(String name) {
        UserAccount account = UserAccount.register(Email.of(name.toLowerCase(Locale.ROOT) + "@readora.test"), name.toLowerCase(Locale.ROOT),
                PasswordHash.of("$2a$hash"));
        account.grantRole(Role.MODERATOR);
        moderator = users.save(account).getId();
    }

    @When("{string} reports the comment of {string} as {string}")
    @Given("{string} reported the comment of {string} as {string}")
    public void reportsTheComment(String reader, String author, String reason) {
        moderation.report(UserId.of(reader), aoiComment.getId(), REASONS.get(reason));
    }

    @Then("{string} sees the report in the moderation queue")
    public void seesTheReport(String name) {
        assertThat(moderation.queue(moderator)).singleElement()
                .satisfies(item -> assertThat(item.comment().getId()).isEqualTo(aoiComment.getId()));
    }

    @When("{string} hides the comment")
    public void hidesTheComment(String name) {
        moderation.hide(moderator, onlyReport().report().getId());
    }

    @Then("readers no longer see it")
    public void readersNoLongerSeeIt() {
        assertThat(social.getCommentsForChapter(chapterId)).extracting(ChapterComment::getId).doesNotContain(aoiComment.getId());
    }

    @Then("the report is closed")
    public void theReportIsClosed() {
        assertThat(moderation.queue(moderator)).isEmpty();
    }

    @When("{string} dismisses the report")
    public void dismissesTheReport(String name) {
        moderation.dismiss(moderator, onlyReport().report().getId());
    }

    @Then("the comment stays visible")
    public void theCommentStaysVisible() {
        assertThat(social.getCommentsForChapter(chapterId)).extracting(ChapterComment::getId).contains(aoiComment.getId());
    }

    @When("reader {string} opens the moderation queue")
    public void readerOpensTheModerationQueue(String reader) {
        try {
            moderation.queue(UserId.of(reader));
        } catch (RuntimeException e) {
            refusal = e;
        }
    }

    @Then("access is refused")
    public void accessIsRefused() {
        assertThat(refusal).isInstanceOf(AccessDeniedDomainException.class);
    }

    @Given("{string} posted a comment a few seconds ago")
    public void postedACommentAFewSecondsAgo(String reader) {
        social.postRootComment(chapterId, UserId.of(reader), reader, "First!", null, false);
        clock.advance(Duration.ofSeconds(3));
    }

    @When("he posts another comment right away")
    public void hePostsAnotherCommentRightAway() {
        try {
            social.postRootComment(chapterId, UserId.of("Kenji"), "Kenji", "Second!", null, false);
        } catch (RuntimeException e) {
            refusal = e;
        }
    }

    @Then("he is asked to wait a few seconds before commenting again")
    public void heIsAskedToWait() {
        assertThat(refusal).isInstanceOf(CommentRateLimitedException.class).hasMessageContaining("wait 7 seconds");
        clock.advance(Duration.ofSeconds(8));
        social.postRootComment(chapterId, UserId.of("Kenji"), "Kenji", "Second, later", null, false);
    }

    private QueueItem onlyReport() {
        return moderation.queue(moderator).getFirst();
    }
}
