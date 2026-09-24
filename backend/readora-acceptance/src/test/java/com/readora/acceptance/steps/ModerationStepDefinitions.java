package com.readora.acceptance.steps;

import com.readora.acceptance.fakes.InMemoryChapterReadRepository;
import com.readora.acceptance.fakes.InMemoryChapterRepository;
import com.readora.acceptance.fakes.InMemoryCommentReportRepository;
import com.readora.acceptance.fakes.InMemoryCommentRepository;
import com.readora.acceptance.fakes.InMemoryLibraryRepository;
import com.readora.acceptance.fakes.InMemoryNotificationRepository;
import com.readora.acceptance.fakes.InMemoryProjectRepository;
import com.readora.acceptance.fakes.InMemoryTeamInvitationRepository;
import com.readora.acceptance.fakes.InMemoryTeamRepository;
import com.readora.acceptance.fakes.InMemoryUserAccounts;
import com.readora.acceptance.fakes.InMemoryWorkRepository;
import com.readora.acceptance.fakes.MutableClock;
import com.readora.application.exception.CommentRateLimitedException;
import com.readora.application.port.in.ModerateCommentsUseCase.QueueItem;
import com.readora.application.port.out.EventPublisherPort;
import com.readora.application.service.ChapterReviewService;
import com.readora.application.service.LibraryService;
import com.readora.application.service.ModerationService;
import com.readora.application.service.NotificationService;
import com.readora.application.service.ReaderSocialService;
import com.readora.application.service.WorkManagementService;
import com.readora.domain.common.AccessDeniedDomainException;
import com.readora.domain.common.UserId;
import com.readora.domain.identity.Email;
import com.readora.domain.identity.PasswordHash;
import com.readora.domain.identity.Role;
import com.readora.domain.identity.UserAccount;
import com.readora.domain.moderation.CommentReportReason;
import com.readora.domain.scanlation.ScanlationProject;
import com.readora.domain.scanlation.Team;
import com.readora.domain.scanlation.TeamId;
import com.readora.domain.social.ChapterComment;
import com.readora.domain.work.Chapter;
import com.readora.domain.work.ChapterId;
import com.readora.domain.work.ChapterNumber;
import com.readora.domain.work.ChapterPublishedEvent;
import com.readora.domain.work.ChapterSentBackEvent;
import com.readora.domain.work.ChapterStatus;
import com.readora.domain.work.PageAsset;
import com.readora.domain.work.Work;
import com.readora.domain.work.WorkId;
import com.readora.domain.work.WorkType;
import io.cucumber.java.Before;
import io.cucumber.java.en.Given;
import io.cucumber.java.en.Then;
import io.cucumber.java.en.When;
import org.jspecify.annotations.Nullable;

import java.time.Duration;
import java.time.Instant;
import java.util.HashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

/// US-11 Keeping discussions healthy, and a team's first chapter reviewed by a moderator. The Spring after-commit
/// listener is replaced by calling the notification use case with each published event, as `NotificationEventListener` does.
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
    private InMemoryWorkRepository works;
    private InMemoryChapterRepository chapters;
    private InMemoryProjectRepository projects;
    private InMemoryTeamRepository teams;
    private LibraryService library;
    private NotificationService notifications;
    private WorkManagementService publishing;
    private ChapterReviewService review;
    private final Map<String, Team> teamsByName = new HashMap<>();
    private final Map<String, WorkId> seriesByTitle = new HashMap<>();
    private @Nullable ChapterId reviewed;

    @Before
    public void setup() {
        // Comments take their creation time from the system clock, so the scenario clock starts now.
        clock = new MutableClock(Instant.now());
        users = new InMemoryUserAccounts();
        chapters = new InMemoryChapterRepository();
        InMemoryCommentRepository comments = new InMemoryCommentRepository();
        social = new ReaderSocialService(comments, chapters, event -> { }, clock, Duration.ofSeconds(10));
        moderation = new ModerationService(new InMemoryCommentReportRepository(), comments, users, clock);
        works = new InMemoryWorkRepository();
        projects = new InMemoryProjectRepository();
        teams = new InMemoryTeamRepository();
        InMemoryLibraryRepository libraryRepository = new InMemoryLibraryRepository();
        library = new LibraryService(libraryRepository, works, new InMemoryChapterReadRepository(chapters), clock);
        notifications = new NotificationService(new InMemoryNotificationRepository(), libraryRepository, chapters, works, comments,
                new InMemoryTeamInvitationRepository(), teams, projects, users, clock);
        EventPublisherPort afterCommit = event -> {
            if (event instanceof ChapterPublishedEvent published) {
                notifications.notifyNewChapter(published.chapterId());
            } else if (event instanceof ChapterSentBackEvent sentBack) {
                notifications.notifyChapterSentBack(sentBack.chapterId());
            }
        };
        publishing = new WorkManagementService(works, chapters, projects, teams, users, afterCommit, clock);
        review = new ChapterReviewService(chapters, works, teams, users, afterCommit);
        teamsByName.clear();
        seriesByTitle.clear();
        reviewed = null;
        Work work = works.save(Work.create("Solo Leveling", "", WorkType.MANHWA, "", Set.of()));
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

    @Given("{string} keeps {string} in his library")
    public void keepsInHisLibrary(String reader, String title) {
        library.save(UserId.of(reader), series(title), null);
    }

    @When("the new team {string} publishes chapter {int} of {string}")
    @Given("the new team {string} published chapter {int} of {string} for review")
    public void theNewTeamPublishes(String teamName, int number, String title) {
        Team team = teams.save(Team.create(teamName, null, leaderOf(teamName)));
        teamsByName.put(teamName, team);
        projects.save(ScanlationProject.create(teamName, series(title), team.getId()));
        reviewed = publish(teamName, number, title).getId();
    }

    @When("{string} publishes chapter {int} of {string}")
    public void teamPublishes(String teamName, int number, String title) {
        publish(teamName, number, title);
    }

    @Then("readers do not see chapter {int} of {string}")
    public void readersDoNotSee(int number, String title) {
        assertThat(chapters.findPublishedByWorkId(series(title))).noneMatch(c -> c.getChapterNumber().equals(ChapterNumber.of(String.valueOf(number))));
    }

    @Then("readers see chapter {int} of {string}")
    public void readersSee(int number, String title) {
        assertThat(chapters.findPublishedByWorkId(series(title))).anyMatch(c -> c.getChapterNumber().equals(ChapterNumber.of(String.valueOf(number))));
    }

    @Then("{string} sees chapter {int} of {string} by {string} waiting for review")
    public void seesItWaiting(String name, int number, String title, String teamName) {
        assertThat(review.waiting(moderator)).singleElement().satisfies(waiting -> {
            assertThat(waiting.chapter().getChapterNumber()).isEqualTo(ChapterNumber.of(String.valueOf(number)));
            assertThat(waiting.seriesTitle()).isEqualTo(title);
            assertThat(waiting.team().name()).isEqualTo(teamName);
        });
    }

    @When("{string} approves the chapter")
    @Given("{string} approved the chapter")
    public void approvesTheChapter(String name) {
        review.approve(moderator, requireReviewed());
    }

    @When("{string} sends the chapter back")
    public void sendsTheChapterBack(String name) {
        review.sendBack(moderator, requireReviewed());
    }

    @Then("{string} hears {string}")
    public void hears(String reader, String message) {
        assertThat(notifications.recent(UserId.of(reader))).extracting(n -> n.message()).containsExactly(message);
    }

    @Then("the leader of {string} hears {string}")
    public void theLeaderHears(String teamName, String message) {
        hears(leaderOf(teamName).value(), message);
    }

    @Then("{string} can publish chapter {int} of {string} again for review")
    public void canPublishAgain(String teamName, int number, String title) {
        Chapter again = publish(teamName, number, title);
        assertThat(again.getId()).isEqualTo(reviewed);
        assertThat(again.isWaitingForReview()).isTrue();
    }

    @When("reader {string} tries to approve the chapter")
    public void readerTriesToApprove(String reader) {
        try {
            review.approve(UserId.of(reader), requireReviewed());
        } catch (RuntimeException e) {
            refusal = e;
        }
    }

    private Chapter publish(String teamName, int number, String title) {
        Team team = teamsByName.get(teamName);
        return publishing.directPublishChapter(series(title), team.getId(), String.valueOf(number), "",
                List.of(PageAsset.create(1, "p1.webp", "https://cdn.test/p1.webp")), leaderOf(teamName));
    }

    private WorkId series(String title) {
        return seriesByTitle.computeIfAbsent(title, t -> works.save(Work.create(t, "", WorkType.MANHWA, "", Set.of())).getId());
    }

    private static UserId leaderOf(String teamName) {
        return UserId.of(teamName + " leader");
    }

    private ChapterId requireReviewed() {
        assertThat(reviewed).isNotNull();
        return java.util.Objects.requireNonNull(reviewed);
    }
}
