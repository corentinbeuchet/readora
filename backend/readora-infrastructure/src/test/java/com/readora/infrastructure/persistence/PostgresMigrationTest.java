package com.readora.infrastructure.persistence;

import com.readora.application.port.out.WorkRepositoryPort;
import com.readora.domain.common.UserId;
import com.readora.domain.scanlation.ScanlationProject;
import com.readora.domain.work.*;
import com.readora.domain.library.ChapterRead;
import com.readora.domain.rating.Review;
import com.readora.domain.rating.WorkRating;
import com.readora.domain.report.PageReport;
import com.readora.domain.report.PageReportReason;
import com.readora.domain.library.LibraryEntry;
import com.readora.domain.social.ReadingStatus;
import com.readora.infrastructure.persistence.adapter.ChapterReadRepositoryAdapter;
import com.readora.infrastructure.persistence.adapter.CommentReportRepositoryAdapter;
import com.readora.infrastructure.persistence.adapter.CommentRepositoryAdapter;
import com.readora.infrastructure.persistence.adapter.CommunityQueryAdapter;
import com.readora.infrastructure.persistence.adapter.DiscoveryQueryAdapter;
import com.readora.infrastructure.persistence.adapter.ChapterRepositoryAdapter;
import com.readora.infrastructure.persistence.adapter.LibraryRepositoryAdapter;
import com.readora.infrastructure.persistence.adapter.NotificationRepositoryAdapter;
import com.readora.infrastructure.persistence.adapter.PageReportRepositoryAdapter;
import com.readora.infrastructure.persistence.adapter.RatingRepositoryAdapter;
import com.readora.infrastructure.persistence.adapter.ScanlationProjectRepositoryAdapter;
import com.readora.infrastructure.persistence.adapter.WorkRepositoryAdapter;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;
import org.testcontainers.postgresql.PostgreSQLContainer;

import java.util.List;
import java.util.Set;

import static org.assertj.core.api.Assertions.assertThat;

/// Runs every Flyway migration on a real PostgreSQL and validates the JPA mapping against it (H2 tests can't catch
/// Postgres-only syntax or type differences). Skipped when no Docker daemon is available; CI always runs it.
@Testcontainers(disabledWithoutDocker = true)
@SpringBootTest(classes = TestApplication.class, properties = {
        "spring.flyway.enabled=true",
        "spring.jpa.hibernate.ddl-auto=validate",
        "aws.s3.bucket-name=test-bucket",
        "aws.cloudfront.domain=https://cdn-test.readora.com",
        "readora.security.jwt.secret=test-secret-at-least-32-bytes-long-1234567890",
        "readora.stripe.secret-key=sk_test_123",
        "readora.stripe.webhook-secret=whsec_123",
        "readora.stripe.premium-price-id=price_123"
})
class PostgresMigrationTest {

    @Container
    static final PostgreSQLContainer POSTGRES = new PostgreSQLContainer("postgres:16-alpine");

    @DynamicPropertySource
    static void datasource(DynamicPropertyRegistry registry) {
        registry.add("spring.datasource.url", POSTGRES::getJdbcUrl);
        registry.add("spring.datasource.username", POSTGRES::getUsername);
        registry.add("spring.datasource.password", POSTGRES::getPassword);
        registry.add("spring.datasource.driver-class-name", () -> "org.postgresql.Driver");
    }

    @Autowired
    private WorkRepositoryAdapter workRepository;

    @Autowired
    private ChapterRepositoryAdapter chapterRepository;

    @Autowired
    private ScanlationProjectRepositoryAdapter projectRepository;

    @Test
    @DisplayName("All migrations apply on PostgreSQL and the aggregates round-trip through the validated schema")
    void migrationsApplyAndAggregatesRoundTrip() {
        Work work = workRepository.save(Work.create("PG Work", "Synopsis", WorkType.MANHWA, "c.png", Set.of("Action")));
        ScanlationProject project = ScanlationProject.create("PG Group", work.getId(), UserId.of("leader"));
        project.addChapterTask(ChapterNumber.of("1"));
        projectRepository.save(project);
        Chapter chapter = Chapter.createDraft(work.getId(), ChapterNumber.of("1"), "Ch 1", project.getId());
        chapter.updatePages(List.of(PageAsset.create(1, "p1.webp", null)));
        chapter.publish(UserId.of("leader"));
        chapterRepository.save(chapter);

        assertThat(workRepository.findById(work.getId())).get().extracting(Work::getGenres).isEqualTo(Set.of("Action"));
        assertThat(projectRepository.findByWorkId(work.getId())).singleElement()
                .satisfies(p -> assertThat(p.getTasks()).hasSize(1));
        assertThat(chapterRepository.findPublishedByWorkId(work.getId())).singleElement()
                .satisfies(c -> assertThat(c.getPages()).hasSize(1));
    }

    @Test
    @DisplayName("Catalog search (genre EXISTS sub-queries, LIKE with escapes, facets) runs on PostgreSQL")
    void catalogSearchRunsOnPostgres() {
        workRepository.save(Work.create("PG Solo Leveling", "", WorkType.MANHWA, WorkStatus.COMPLETED, "Chugong", Demographic.SHOUNEN, null, Set.of("Action", "PG-run")));
        workRepository.save(Work.create("PG Horimiya", "", WorkType.MANGA, WorkStatus.COMPLETED, "HERO", Demographic.SHOUNEN, null, Set.of("Romance", "PG-run")));

        var search = new WorkRepositoryPort.WorkSearch("chug", Set.of("pg-run", "action"), Set.of("romance"),
                Set.of(WorkType.MANHWA), Set.of(WorkStatus.COMPLETED), Set.of(Demographic.SHOUNEN));
        var page = workRepository.search(search, 0, 10);

        assertThat(page.totalElements()).isEqualTo(1);
        assertThat(page.items()).singleElement().extracting(Work::getAuthor).isEqualTo("Chugong");
        assertThat(workRepository.findAllGenres()).contains("Action", "PG-run", "Romance");
    }

    @Autowired
    private ChapterReadRepositoryAdapter chapterReads;

    @Autowired
    private LibraryRepositoryAdapter library;

    @Test
    @DisplayName("Library and reading queries (latest read per work, new chapters since last read) run on PostgreSQL")
    void libraryQueriesRunOnPostgres() {
        Work work = workRepository.save(Work.create("PG Library", "", WorkType.MANGA, "c.png", Set.of("Action")));
        UserId kenji = UserId.of("pg-kenji");
        Chapter one = Chapter.createDraft(work.getId(), ChapterNumber.of("1"), "Ch 1", null);
        one.updatePages(List.of(PageAsset.create(1, "p1.webp", null)));
        one.publish(UserId.of("qc"));
        chapterRepository.save(one);
        library.save(LibraryEntry.add(kenji, work.getId(), ReadingStatus.READING, java.time.Instant.now()));
        // Read right when chapter 1 came out; chapter 2 is published afterwards.
        chapterReads.save(new ChapterRead(kenji, work.getId(), one.getId(), one.getChapterNumber(), one.getPublishedAt(), true));
        sleepPastClockTick();

        Chapter two = Chapter.createDraft(work.getId(), ChapterNumber.of("2"), "Ch 2", null);
        two.updatePages(List.of(PageAsset.create(1, "p1.webp", null)));
        two.publish(UserId.of("qc"));
        chapterRepository.save(two);

        assertThat(chapterReads.findLatestPerWork(kenji, 10)).singleElement().extracting(ChapterRead::chapterId).isEqualTo(one.getId());
        assertThat(chapterReads.countChaptersPublishedSinceLastRead(kenji, List.of(work.getId()))).containsEntry(work.getId(), 1L);
        assertThat(library.findByUser(kenji, ReadingStatus.READING)).hasSize(1);
    }

    @Autowired
    private PageReportRepositoryAdapter pageReports;

    @Test
    @DisplayName("Page reports round-trip on PostgreSQL, with optimistic locking on resolve")
    void pageReportsRunOnPostgres() {
        Work work = workRepository.save(Work.create("PG Reports", "", WorkType.MANGA, "c.png", Set.of("Action")));
        ScanlationProject team = projectRepository.save(ScanlationProject.create("PG Team", work.getId(), UserId.of("pg-leader")));
        Chapter chapter = Chapter.createDraft(work.getId(), ChapterNumber.of("1"), "Ch 1", team.getId());
        chapter.updatePages(List.of(PageAsset.create(1, "p1.webp", null)));
        chapter.publish(UserId.of("pg-leader"));
        chapterRepository.save(chapter);

        PageReport report = pageReports.save(PageReport.open(chapter.getId(), work.getId(), team.getId(), chapter.getChapterNumber(), 1,
                PageReportReason.IMAGE_CORRUPTED, UserId.of("pg-reader"), java.time.Instant.now()));
        assertThat(pageReports.findOpen(UserId.of("pg-reader"), chapter.getId(), 1)).isPresent();
        assertThat(pageReports.findOpenByProject(team.getId())).hasSize(1);

        report.resolve(UserId.of("pg-leader"), java.time.Instant.now());
        pageReports.save(report);
        assertThat(pageReports.findOpenByProject(team.getId())).isEmpty();
    }

    @Autowired
    private RatingRepositoryAdapter ratingRepository;

    @Test
    @DisplayName("Rating queries (summary, reviews joined with usernames, top rated) run on PostgreSQL")
    void ratingQueriesRunOnPostgres() {
        Work work = workRepository.save(Work.create("PG Rated", "", WorkType.MANGA, "c.png", Set.of("Action")));
        WorkRating rating = WorkRating.rate(UserId.of("pg-rater"), work.getId(), 8, java.time.Instant.now());
        rating.writeReview(new Review(null, null, "Good"), java.time.Instant.now());
        ratingRepository.save(rating);

        assertThat(ratingRepository.summary(work.getId()).count()).isEqualTo(1);
        assertThat(ratingRepository.findReviews(work.getId(), 10)).isEmpty(); // no user row for pg-rater: inner join
        assertThat(ratingRepository.addHelpfulVote(rating.getId(), UserId.of("pg-voter"))).isEqualTo(1);
        assertThat(ratingRepository.findTopRated(1, 10)).extracting(r -> r.workId()).contains(work.getId());
    }

    @Autowired
    private DiscoveryQueryAdapter discovery;

    @Test
    @DisplayName("Feed and popularity queries (sub-selects across reads, comments, library, follows) run on PostgreSQL")
    void discoveryQueriesRunOnPostgres() {
        Work work = workRepository.save(Work.create("PG Popular", "", WorkType.MANGA, "c.png", Set.of("Action")));
        Chapter chapter = Chapter.createDraft(work.getId(), ChapterNumber.of("1"), "Ch 1", null);
        chapter.updatePages(List.of(PageAsset.create(1, "p1.webp", null)));
        chapter.publish(UserId.of("qc"));
        chapterRepository.save(chapter);
        UserId reader = UserId.of("pg-discovery");
        library.save(LibraryEntry.add(reader, work.getId(), ReadingStatus.READING, java.time.Instant.now()));
        chapterReads.save(new ChapterRead(reader, work.getId(), chapter.getId(), chapter.getChapterNumber(), java.time.Instant.now(), true));

        assertThat(discovery.findLatestReleases(reader, 0, 10)).extracting(r -> r.chapterId()).containsExactly(chapter.getId());
        assertThat(discovery.findFinished(reader, List.of(chapter.getId()))).containsExactly(chapter.getId());
        assertThat(discovery.findPopular(java.time.Instant.now().minusSeconds(3600), 10))
                .anySatisfy(p -> assertThat(p.workId()).isEqualTo(work.getId()));
        assertThat(workRepository.findRandom(new com.readora.application.port.out.WorkRepositoryPort.WorkSearch(
                null, Set.of("action"), Set.of(), Set.of(), Set.of(), Set.of()))).isPresent();
    }

    @Autowired
    private NotificationRepositoryAdapter notificationRepository;

    @Test
    @DisplayName("Notifications and library subscribers run on PostgreSQL")
    void notificationQueriesRunOnPostgres() {
        Work work = workRepository.save(Work.create("PG Notified", "", WorkType.MANGA, "c.png", Set.of("Action")));
        UserId reader = UserId.of("pg-notified");
        LibraryEntry entry = LibraryEntry.add(reader, work.getId(), ReadingStatus.READING, java.time.Instant.now());
        library.save(entry);
        assertThat(library.findSubscribers(work.getId())).containsExactly(reader);
        entry.setNotifications(false, java.time.Instant.now());
        library.save(entry);
        assertThat(library.findSubscribers(work.getId())).isEmpty();

        notificationRepository.saveAll(List.of(com.readora.domain.notification.Notification.create(reader,
                com.readora.domain.notification.NotificationType.NEW_CHAPTER, "New", "/read/x", java.time.Instant.now())));
        assertThat(notificationRepository.countUnread(reader)).isEqualTo(1);
        notificationRepository.markAllRead(reader, java.time.Instant.now());
        assertThat(notificationRepository.countUnread(reader)).isZero();
        assertThat(notificationRepository.findRecent(reader, 5)).hasSize(1);
    }

    @Autowired
    private CommentReportRepositoryAdapter commentReports;

    @Autowired
    private CommentRepositoryAdapter comments;

    @Test
    @DisplayName("Hidden comments, the author's last comment time and comment reports work on PostgreSQL")
    void moderationQueriesRunOnPostgres() {
        Work work = workRepository.save(Work.create("PG Moderated", "", WorkType.MANGA, "c.png", Set.of("Action")));
        Chapter chapter = Chapter.createDraft(work.getId(), ChapterNumber.of("1"), "Ch 1", null);
        chapter.updatePages(List.of(PageAsset.create(1, "p1.webp", null)));
        chapter.publish(UserId.of("qc"));
        chapterRepository.save(chapter);
        UserId author = UserId.of("pg-author");
        var comment = comments.save(com.readora.domain.social.ChapterComment.createRoot(chapter.getId(), author, "pg", "Hello", null, false));
        assertThat(comments.findLatestCommentTime(author)).isPresent();

        var report = commentReports.save(com.readora.domain.moderation.CommentReport.open(comment.getId(), UserId.of("pg-reporter"),
                com.readora.domain.moderation.CommentReportReason.SPAM, java.time.Instant.now()));
        assertThat(commentReports.findOpen(10)).extracting(r -> r.getId()).contains(report.getId());

        comment.hide();
        comments.save(comment);
        assertThat(comments.findByChapterId(chapter.getId())).isEmpty();
        assertThat(comments.findById(comment.getId())).get().extracting(c -> c.isHidden()).isEqualTo(true);
    }

    @Autowired
    private CommunityQueryAdapter community;

    @Test
    @DisplayName("Profile stats (genres of finished reads), usernames and team follows run on PostgreSQL")
    void communityQueriesRunOnPostgres() {
        Work work = workRepository.save(Work.create("PG Community", "", WorkType.MANGA, "c.png", Set.of("Mystery")));
        ScanlationProject team = projectRepository.save(ScanlationProject.create("PG Team 2", work.getId(), UserId.of("pg-leader-2")));
        Chapter chapter = Chapter.createDraft(work.getId(), ChapterNumber.of("1"), "Ch 1", team.getId());
        chapter.updatePages(List.of(PageAsset.create(1, "p1.webp", null)));
        chapter.publish(UserId.of("qc"));
        chapterRepository.save(chapter);
        UserId reader = UserId.of("pg-community");
        chapterReads.save(new ChapterRead(reader, work.getId(), chapter.getId(), chapter.getChapterNumber(), java.time.Instant.now(), true));

        var stats = community.readingStats(reader, 3);
        assertThat(stats.chaptersRead()).isEqualTo(1);
        assertThat(stats.topGenres()).containsExactly("Mystery");
        assertThat(community.follow(reader, team.getId(), java.time.Instant.now())).isTrue();
        assertThat(community.follow(reader, team.getId(), java.time.Instant.now())).isFalse();
        assertThat(community.countFollowers(team.getId())).isEqualTo(1);
        assertThat(discovery.findLatestReleases(reader, 0, 10)).extracting(r -> r.chapterId()).contains(chapter.getId());
        assertThat(community.unfollow(reader, team.getId())).isTrue();
        assertThat(community.usernames(List.of(reader))).isEmpty();
    }

    private static void sleepPastClockTick() {
        try {
            Thread.sleep(5);
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
        }
    }
}
