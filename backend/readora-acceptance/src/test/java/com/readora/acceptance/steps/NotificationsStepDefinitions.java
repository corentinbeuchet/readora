package com.readora.acceptance.steps;

import com.readora.acceptance.fakes.InMemoryChapterReadRepository;
import com.readora.acceptance.fakes.InMemoryChapterRepository;
import com.readora.acceptance.fakes.InMemoryCommentRepository;
import com.readora.acceptance.fakes.InMemoryLibraryRepository;
import com.readora.acceptance.fakes.InMemoryNotificationRepository;
import com.readora.acceptance.fakes.InMemoryTeamInvitationRepository;
import com.readora.acceptance.fakes.InMemoryTeamRepository;
import com.readora.acceptance.fakes.InMemoryWorkRepository;
import com.readora.acceptance.fakes.NoUserAccounts;
import com.readora.application.service.LibraryService;
import com.readora.application.service.NotificationService;
import com.readora.application.service.ReaderSocialService;
import com.readora.domain.common.UserId;
import com.readora.domain.notification.Notification;
import com.readora.domain.scanlation.TeamId;
import com.readora.domain.social.ChapterComment;
import com.readora.domain.social.CommentPostedEvent;
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

import java.time.Clock;
import java.time.Instant;
import java.util.List;
import java.util.Set;

import static org.assertj.core.api.Assertions.assertThat;

/// US-10 Notifications. The Spring after-commit listener is replaced by calling the use case with each published event,
/// exactly as `NotificationEventListener` does.
public class NotificationsStepDefinitions {

    private InMemoryWorkRepository works;
    private InMemoryChapterRepository chapters;
    private InMemoryLibraryRepository library;
    private NotificationService notifications;
    private LibraryService libraryService;
    private ReaderSocialService social;
    private ChapterComment kenjiComment;

    @Before
    public void setup() {
        works = new InMemoryWorkRepository();
        chapters = new InMemoryChapterRepository();
        library = new InMemoryLibraryRepository();
        InMemoryCommentRepository comments = new InMemoryCommentRepository();
        notifications = new NotificationService(new InMemoryNotificationRepository(), library, chapters, works, comments,
                new InMemoryTeamInvitationRepository(), new InMemoryTeamRepository(), new NoUserAccounts(), Clock.systemUTC());
        libraryService = new LibraryService(library, works, new InMemoryChapterReadRepository(chapters), Clock.systemUTC());
        social = new ReaderSocialService(comments, chapters, event -> {
            if (event instanceof CommentPostedEvent posted && posted.parentId() != null) {
                notifications.notifyReply(posted.commentId());
            }
        });
    }

    @Given("{string} is signed in and has {string} in his library")
    public void isSignedInAndHasInLibrary(String reader, String title) {
        works.save(Work.create(title, "", WorkType.MANHWA, "", Set.of()));
        libraryService.save(UserId.of(reader), work(title), null);
    }

    @When("chapter {int} of {string} is published")
    public void chapterIsPublished(int number, String title) {
        Chapter chapter = publish(title, number);
        notifications.notifyNewChapter(chapter.getId());
    }

    @When("another team publishes its own version of chapter {int} of {string}")
    public void anotherTeamPublishesItsOwnVersion(int number, String title) {
        Instant later = Instant.now().plusSeconds(60);
        Chapter version = chapters.save(new Chapter(ChapterId.generate(), work(title), ChapterNumber.of(String.valueOf(number)), "Chapter " + number,
                ChapterStatus.PUBLISHED, List.of(PageAsset.create(1, "p1.webp", null)), TeamId.generate(), later, later, later));
        notifications.notifyNewChapter(version.getId());
    }

    @Then("{string} has {int} notification")
    public void hasNotifications(String reader, int count) {
        assertThat(notifications.recent(UserId.of(reader))).hasSize(count);
    }

    @Then("{string} gets a notification {string}")
    public void getsANotification(String reader, String message) {
        assertThat(latest(reader).message()).isEqualTo(message);
    }

    @Then("clicking it opens chapter {int}")
    public void clickingItOpensChapter(int number) {
        assertThat(latest("Kenji").link()).isEqualTo("/read/" + chapter("Solo Leveling", number).value());
    }

    @Given("{string} has {int} unread notifications")
    public void hasUnreadNotifications(String reader, int count) {
        for (int i = 1; i <= count; i++) {
            notifications.notifyNewChapter(publish("Solo Leveling", i).getId());
        }
    }

    @Then("the bell shows {int}")
    public void theBellShows(int count) {
        assertThat(notifications.unreadCount(UserId.of("Kenji"))).isEqualTo(count);
    }

    @When("he chooses {string}")
    public void heChooses(String action) {
        assertThat(action).isEqualTo("Mark all as read");
        notifications.markAllRead(UserId.of("Kenji"));
    }

    @Then("the bell shows no count")
    public void theBellShowsNoCount() {
        assertThat(notifications.unreadCount(UserId.of("Kenji"))).isZero();
    }

    @Given("{string} commented on chapter {int} of {string}")
    public void commentedOnChapter(String reader, int number, String title) {
        ChapterId chapterId = publish(title, number).getId();
        kenjiComment = social.postRootComment(chapterId, UserId.of(reader), reader, "What a chapter!", null, false);
    }

    @When("{string} replies to his comment")
    public void repliesToHisComment(String reader) {
        social.replyToComment(kenjiComment.getId(), UserId.of(reader), reader, "Totally agree!", false);
    }

    @Then("clicking it opens chapter {int} with the reply highlighted")
    public void clickingItOpensChapterWithReply(int number) {
        assertThat(latest("Kenji").link()).startsWith("/read/" + chapter("Solo Leveling", number).value() + "?comment=");
    }

    @When("{string} turns off notifications for {string}")
    public void turnsOffNotificationsFor(String reader, String title) {
        notifications.setSeriesNotifications(UserId.of(reader), work(title), false);
    }

    @Then("{string} gets no notification")
    public void getsNoNotification(String reader) {
        assertThat(notifications.recent(UserId.of(reader))).isEmpty();
    }

    @Then("{string} stays in his library")
    public void staysInHisLibrary(String title) {
        assertThat(libraryService.list(UserId.of("Kenji"), null)).extracting(item -> item.work().getTitle()).containsExactly(title);
    }

    private Notification latest(String reader) {
        List<Notification> recent = notifications.recent(UserId.of(reader));
        assertThat(recent).isNotEmpty();
        return recent.getFirst();
    }

    private WorkId work(String title) {
        return works.byTitle(title).getId();
    }

    private ChapterId chapter(String title, int number) {
        return chapters.firstVersion(work(title), ChapterNumber.of(String.valueOf(number))).orElseThrow().getId();
    }

    private Chapter publish(String title, int number) {
        Instant now = Instant.now();
        return chapters.save(new Chapter(ChapterId.generate(), work(title), ChapterNumber.of(String.valueOf(number)), "Chapter " + number,
                ChapterStatus.PUBLISHED, List.of(PageAsset.create(1, "p1.webp", null)), TeamId.generate(), now, now, now));
    }
}
