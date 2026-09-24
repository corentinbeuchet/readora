package com.readora.infrastructure.persistence;

import com.readora.application.port.out.CommunityQueryPort;
import com.readora.application.port.out.WorkRepositoryPort;
import com.readora.domain.common.UserId;
import com.readora.domain.identity.Email;
import com.readora.domain.identity.PasswordHash;
import com.readora.domain.identity.UserAccount;
import com.readora.domain.library.ChapterRead;
import com.readora.domain.library.LibraryEntry;
import com.readora.domain.rating.Review;
import com.readora.domain.rating.WorkRating;
import com.readora.domain.report.PageReport;
import com.readora.domain.report.PageReportReason;
import com.readora.domain.scanlation.InvitationStatus;
import com.readora.domain.scanlation.ScanlationProject;
import com.readora.domain.scanlation.ScanlationRole;
import com.readora.domain.scanlation.Team;
import com.readora.domain.scanlation.TeamId;
import com.readora.domain.scanlation.TeamInvitation;
import com.readora.domain.scanlation.WorkflowTask;
import com.readora.domain.social.ReadingStatus;
import com.readora.domain.work.*;
import com.readora.infrastructure.persistence.adapter.ChapterReadRepositoryAdapter;
import com.readora.infrastructure.persistence.adapter.ChapterRepositoryAdapter;
import com.readora.infrastructure.persistence.adapter.CommentReportRepositoryAdapter;
import com.readora.infrastructure.persistence.adapter.CommentRepositoryAdapter;
import com.readora.infrastructure.persistence.adapter.CommunityQueryAdapter;
import com.readora.infrastructure.persistence.adapter.DiscoveryQueryAdapter;
import com.readora.infrastructure.persistence.adapter.LibraryRepositoryAdapter;
import com.readora.infrastructure.persistence.adapter.NotificationRepositoryAdapter;
import com.readora.infrastructure.persistence.adapter.PageReportRepositoryAdapter;
import com.readora.infrastructure.persistence.adapter.RatingRepositoryAdapter;
import com.readora.infrastructure.persistence.adapter.ReadingListRepositoryAdapter;
import com.readora.infrastructure.persistence.adapter.ScanlationProjectRepositoryAdapter;
import com.readora.infrastructure.persistence.adapter.TeamInvitationRepositoryAdapter;
import com.readora.infrastructure.persistence.adapter.TeamRepositoryAdapter;
import com.readora.infrastructure.persistence.adapter.UserAccountRepositoryAdapter;
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
        "readora.security.jwt.secret=test-secret-at-least-32-bytes-long-1234567890"
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

    @Autowired
    private TeamRepositoryAdapter teamRepository;

    @Test
    @DisplayName("All migrations apply on PostgreSQL and the aggregates round-trip through the validated schema")
    void migrationsApplyAndAggregatesRoundTrip() {
        Work work = workRepository.save(Work.create("PG Work", "Synopsis", WorkType.MANHWA, "c.png", Set.of("Action")));
        Team pgGroup = teamRepository.save(Team.create("PG Group", null, UserId.of("leader")));
        ScanlationProject project = ScanlationProject.create("PG Group", work.getId(), pgGroup.getId());
        project.addChapterTask(ChapterNumber.of("1"));
        projectRepository.save(project);
        Chapter chapter = Chapter.createDraft(work.getId(), ChapterNumber.of("1"), "Ch 1", project.getTeamId());
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
    @DisplayName("Series facts (V21) round-trip on PostgreSQL: other titles keep their order and an edit replaces them")
    void seriesFactsRoundTrip() {
        WorkFacts facts = new WorkFacts(List.of("Na Honjaman Level Up", "Only I Level Up"), "DUBU", 2018, OriginalLanguage.KOREAN, ContentRating.TEEN);
        Work work = workRepository.save(Work.create("PG Facts", "", WorkType.MANHWA, WorkStatus.ONGOING, "Chugong", null, null, Set.of("Action"), facts));

        assertThat(workRepository.findById(work.getId()).orElseThrow().getFacts()).isEqualTo(facts);

        Work loaded = workRepository.findById(work.getId()).orElseThrow();
        WorkFacts edited = new WorkFacts(List.of("Only I Level Up"), null, null, null, ContentRating.MATURE);
        loaded.describe("PG Facts", "", WorkType.MANHWA, WorkStatus.ONGOING, "Chugong", null, null, Set.of("Action"), edited,
                java.time.Instant.parse("2026-09-20T10:00:00Z"));
        workRepository.save(loaded);

        assertThat(workRepository.findById(work.getId()).orElseThrow().getFacts()).isEqualTo(edited);
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

    @Test
    @DisplayName("Catalog search by another title (EXISTS on work_alt_titles) runs on PostgreSQL and lists a series once")
    void catalogSearchByOtherTitleRunsOnPostgres() {
        WorkFacts knownAs = new WorkFacts(List.of("PG Honjaman Level Up", "PG Honjaman Rebeleop"), null, null, null, null);
        workRepository.save(Work.create("PG Known As", "", WorkType.MANHWA, WorkStatus.COMPLETED, "Chugong", null, null, Set.of("PG-alt-run"), knownAs));

        var page = workRepository.search(
                new WorkRepositoryPort.WorkSearch("pg honjaman", Set.of("pg-alt-run"), Set.of(), Set.of(), Set.of(), Set.of()), 0, 10);

        assertThat(page.totalElements()).isEqualTo(1);
        assertThat(page.items()).singleElement().extracting(Work::getTitle).isEqualTo("PG Known As");
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
        Chapter one = Chapter.createDraft(work.getId(), ChapterNumber.of("1"), "Ch 1", anyTeam());
        one.updatePages(List.of(PageAsset.create(1, "p1.webp", null)));
        one.publish(UserId.of("qc"));
        chapterRepository.save(one);
        library.save(LibraryEntry.add(kenji, work.getId(), ReadingStatus.READING, java.time.Instant.now()));
        // Read right when chapter 1 came out; chapter 2 is published afterwards.
        chapterReads.save(new ChapterRead(kenji, work.getId(), one.getId(), one.getChapterNumber(), one.getPublishedAt(), true));
        sleepPastClockTick();

        Chapter two = Chapter.createDraft(work.getId(), ChapterNumber.of("2"), "Ch 2", anyTeam());
        two.updatePages(List.of(PageAsset.create(1, "p1.webp", null)));
        two.publish(UserId.of("qc"));
        chapterRepository.save(two);

        assertThat(chapterReads.findLatestPerWork(kenji, 10)).singleElement().extracting(ChapterRead::chapterId).isEqualTo(one.getId());
        assertThat(chapterReads.countChaptersPublishedSinceLastRead(kenji, List.of(work.getId()))).containsEntry(work.getId(), 1L);
        assertThat(library.findByUser(kenji, ReadingStatus.READING)).hasSize(1);

        // US-12: other teams' versions of chapter 1 (already read) and of chapter 2 (already counted) add nothing new.
        for (String number : List.of("1", "2")) {
            Chapter version = Chapter.createDraft(work.getId(), ChapterNumber.of(number), "Ch " + number + " again", anyTeam());
            version.updatePages(List.of(PageAsset.create(1, "p1.webp", null)));
            version.publish(UserId.of("qc"));
            chapterRepository.save(version);
        }

        assertThat(chapterRepository.findPublishedRefsByWorkId(work.getId())).hasSize(4);
        assertThat(chapterRepository.findPublishedByWorkId(work.getId())).extracting(c -> c.getChapterNumber().value()).containsExactly("1", "1", "2", "2");
        assertThat(chapterReads.countChaptersPublishedSinceLastRead(kenji, List.of(work.getId()))).containsEntry(work.getId(), 1L);
        assertThat(community.readingStats(kenji, 3).chaptersRead()).isEqualTo(1);
    }

    @Test
    @DisplayName("A team has one chapter per number; another team can publish the same number")
    void oneVersionPerTeam() {
        Work work = workRepository.save(Work.create("PG Versions", "", WorkType.MANGA, "c.png", Set.of("Action")));
        com.readora.domain.scanlation.TeamId shadow = anyTeam();
        chapterRepository.save(Chapter.createDraft(work.getId(), ChapterNumber.of("5"), "Shadow", shadow));
        chapterRepository.save(Chapter.createDraft(work.getId(), ChapterNumber.of("5"), "Moon", anyTeam()));

        assertThat(chapterRepository.findByWorkIdAndChapterNumberAndTeam(work.getId(), ChapterNumber.of("5"), shadow))
                .hasValueSatisfying(chapter -> assertThat(chapter.getTitle()).isEqualTo("Shadow"));
        org.assertj.core.api.Assertions.assertThatThrownBy(() -> chapterRepository.save(Chapter.createDraft(work.getId(), ChapterNumber.of("5"), "Shadow again", shadow)))
                .isInstanceOf(org.springframework.dao.DataIntegrityViolationException.class);
    }

    @Autowired
    private PageReportRepositoryAdapter pageReports;

    @Test
    @DisplayName("Page reports round-trip on PostgreSQL, with optimistic locking on resolve")
    void pageReportsRunOnPostgres() {
        Work work = workRepository.save(Work.create("PG Reports", "", WorkType.MANGA, "c.png", Set.of("Action")));
        Team pgTeam = teamRepository.save(Team.create("PG Team", null, UserId.of("pg-leader")));
        ScanlationProject team = projectRepository.save(ScanlationProject.create("PG Team", work.getId(), pgTeam.getId()));
        Chapter chapter = Chapter.createDraft(work.getId(), ChapterNumber.of("1"), "Ch 1", pgTeam.getId());
        chapter.updatePages(List.of(PageAsset.create(1, "p1.webp", null)));
        chapter.publish(UserId.of("pg-leader"));
        chapterRepository.save(chapter);

        PageReport report = pageReports.save(PageReport.open(chapter.getId(), work.getId(), pgTeam.getId(), chapter.getChapterNumber(), 1,
                PageReportReason.IMAGE_CORRUPTED, UserId.of("pg-reader"), java.time.Instant.now()));
        assertThat(pageReports.findOpen(UserId.of("pg-reader"), chapter.getId(), 1)).isPresent();
        assertThat(pageReports.findOpenByTeamAndWork(pgTeam.getId(), work.getId())).hasSize(1);

        report.resolve(UserId.of("pg-leader"), java.time.Instant.now());
        pageReports.save(report);
        assertThat(pageReports.findOpenByTeamAndWork(pgTeam.getId(), work.getId())).isEmpty();
    }

    @Test
    @DisplayName("A new series starts without a task board on PostgreSQL, and the switch is saved")
    void boardSwitchRunsOnPostgres() {
        Work work = workRepository.save(Work.create("PG Board", "", WorkType.MANGA, "c.png", Set.of("Action")));
        Team team = teamRepository.save(Team.create("PG Board Team " + java.util.UUID.randomUUID(), null, UserId.of("pg-leader")));
        ScanlationProject project = projectRepository.save(ScanlationProject.create("PG Board", work.getId(), team.getId()));
        assertThat(projectRepository.findById(project.getId()).orElseThrow().isBoardEnabled()).isFalse();

        project.turnBoardOn();
        projectRepository.save(project);

        assertThat(projectRepository.findById(project.getId()).orElseThrow().isBoardEnabled()).isTrue();
    }

    @Test
    @DisplayName("Task pages (V27) round-trip on PostgreSQL in order, and a submission replaces them")
    void taskPagesRunOnPostgres() {
        Work work = workRepository.save(Work.create("PG Task Pages", "", WorkType.MANGA, "c.png", Set.of("Action")));
        UserId leader = UserId.of("pg-leader");
        Team team = teamRepository.save(Team.create("PG Pages Team " + java.util.UUID.randomUUID(), null, leader));
        ScanlationProject created = ScanlationProject.create("PG Task Pages", work.getId(), team.getId());
        WorkflowTask task = created.addChapterTask(ChapterNumber.of("1"), taskPages("raw", 3), leader);
        projectRepository.save(created);

        ScanlationProject loaded = projectRepository.findById(created.getId()).orElseThrow();
        assertThat(loaded.getTasks().getFirst().getPages()).isEqualTo(taskPages("raw", 3));
        loaded.claimTask(team, task.getId(), leader);
        loaded.submitTaskWork(team, task.getId(), leader, taskPages("cleaned", 2));
        projectRepository.save(loaded);

        assertThat(projectRepository.findById(created.getId()).orElseThrow().getTasks().getFirst().getPages())
                .isEqualTo(taskPages("cleaned", 2));
    }

    private static List<PageAsset> taskPages(String stage, int count) {
        return java.util.stream.IntStream.rangeClosed(1, count)
                .mapToObj(n -> new PageAsset(n, "scans/pg/" + stage + "/p" + n + ".webp", "https://cdn.test/" + stage + "/p" + n + ".webp", 800, 1200))
                .toList();
    }

    @Autowired
    private TeamInvitationRepositoryAdapter invitations;

    @Test
    @DisplayName("Team invitations round-trip on PostgreSQL: roles, pending queries and optimistic locking on answer")
    void teamInvitationsRunOnPostgres() {
        Team team = teamRepository.save(Team.create("PG Invites " + java.util.UUID.randomUUID(), null, UserId.of("pg-leader")));
        TeamInvitation invitation = invitations.save(TeamInvitation.create(team, UserId.of("pg-invitee"),
                Set.of(ScanlationRole.TRANSLATOR, ScanlationRole.PROOFREADER), UserId.of("pg-leader"), java.time.Instant.now()));

        assertThat(invitations.findById(invitation.getId())).hasValueSatisfying(found ->
                assertThat(found.getRoles()).containsExactlyInAnyOrder(ScanlationRole.TRANSLATOR, ScanlationRole.PROOFREADER));
        assertThat(invitations.findPendingByTeam(team.getId())).hasSize(1);
        assertThat(invitations.findPendingByInvitee(UserId.of("pg-invitee"))).hasSize(1);
        assertThat(invitations.findPending(team.getId(), UserId.of("pg-invitee"))).isPresent();

        invitation.decline(UserId.of("pg-invitee"), java.time.Instant.now());
        invitations.save(invitation);
        assertThat(invitations.findPendingByInvitee(UserId.of("pg-invitee"))).isEmpty();
        assertThat(invitations.findById(invitation.getId())).hasValueSatisfying(found ->
                assertThat(found.getStatus()).isEqualTo(InvitationStatus.DECLINED));
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
        Chapter chapter = Chapter.createDraft(work.getId(), ChapterNumber.of("1"), "Ch 1", anyTeam());
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
    @DisplayName("Hidden comments, top comments, the author's last comment time and comment reports work on PostgreSQL")
    void moderationQueriesRunOnPostgres() {
        Work work = workRepository.save(Work.create("PG Moderated", "", WorkType.MANGA, "c.png", Set.of("Action")));
        Chapter chapter = Chapter.createDraft(work.getId(), ChapterNumber.of("1"), "Ch 1", anyTeam());
        chapter.updatePages(List.of(PageAsset.create(1, "p1.webp", null)));
        chapter.publish(UserId.of("qc"));
        chapterRepository.save(chapter);
        UserId author = UserId.of("pg-author");
        var comment = comments.save(com.readora.domain.social.ChapterComment.createRoot(chapter.getId(), author, "pg", "Hello", null, false));
        assertThat(comments.findLatestCommentTime(author)).isPresent();

        var report = commentReports.save(com.readora.domain.moderation.CommentReport.open(comment.getId(), UserId.of("pg-reporter"),
                com.readora.domain.moderation.CommentReportReason.SPAM, java.time.Instant.now()));
        assertThat(commentReports.findOpen(10)).extracting(r -> r.getId()).contains(report.getId());
        comments.save(com.readora.domain.social.ChapterComment.createRoot(chapter.getId(), author, "pg", "Spoiler", null, true));
        assertThat(comments.findTopByChapterId(chapter.getId(), 3)).extracting(c -> c.getId()).containsExactly(comment.getId());

        comment.hide();
        comments.save(comment);
        assertThat(comments.findByChapterId(chapter.getId())).extracting(c -> c.getContent().value()).containsExactly("Spoiler");
        assertThat(comments.findTopByChapterId(chapter.getId(), 3)).isEmpty();
        assertThat(comments.findById(comment.getId())).get().extracting(c -> c.isHidden()).isEqualTo(true);
    }

    @Autowired
    private CommunityQueryAdapter community;

    @Test
    @DisplayName("Profile stats (genres of finished reads), usernames and team follows run on PostgreSQL")
    void communityQueriesRunOnPostgres() {
        Work work = workRepository.save(Work.create("PG Community", "", WorkType.MANGA, "c.png", Set.of("Mystery")));
        Team team = teamRepository.save(Team.create("PG Team 2", null, UserId.of("pg-leader-2")));
        ScanlationProject project = projectRepository.save(ScanlationProject.create("PG Team 2", work.getId(), team.getId()));
        Chapter chapter = Chapter.createDraft(work.getId(), ChapterNumber.of("1"), "Ch 1", project.getTeamId());
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
        assertThat(community.countPublishedChapters(team.getId())).containsEntry(work.getId(), 1L);
        assertThat(community.latestPublishedChapters(team.getId(), 10)).singleElement()
                .satisfies(latest -> {
                    assertThat(latest.id()).isEqualTo(chapter.getId());
                    assertThat(latest.pageCount()).isEqualTo(1);
                });
        assertThat(discovery.findLatestReleases(reader, 0, 10)).extracting(r -> r.chapterId()).contains(chapter.getId());
        assertThat(community.unfollow(reader, team.getId())).isTrue();
        assertThat(community.usernames(List.of(reader))).isEmpty();
    }

    @Autowired
    private UserAccountRepositoryAdapter userRepository;

    @Test
    @DisplayName("Readers are found by the start of their username on PostgreSQL, case-insensitively and literally")
    void readersByNameRunOnPostgres() {
        userRepository.save(UserAccount.register(Email.of("pg_finder@readora.test"), "PgFinder", PasswordHash.of("$2a$hash")));

        assertThat(community.readersStartingWith("pgfin", 8)).extracting(CommunityQueryPort.ReaderName::username).containsExactly("PgFinder");
        assertThat(community.readersStartingWith("pg%", 8)).isEmpty();
    }

    @Autowired
    private ReadingListRepositoryAdapter readingLists;

    @Test
    @DisplayName("Reading lists (ordered items with notes, upvotes, top published) run on PostgreSQL")
    void readingListsRunOnPostgres() {
        Work first = workRepository.save(Work.create("PG List A", "", WorkType.MANGA, "c.png", Set.of("Action")));
        Work second = workRepository.save(Work.create("PG List B", "", WorkType.MANGA, "c.png", Set.of("Action")));
        var list = com.readora.domain.list.ReadingList.create(UserId.of("pg-owner"), "pgowner", "PG List", "", List.of(
                new com.readora.domain.list.ListItem(second.getId(), "second first"), new com.readora.domain.list.ListItem(first.getId(), null)),
                true, java.time.Instant.now());
        readingLists.save(list);
        assertThat(readingLists.addUpvote(list.getId(), UserId.of("pg-fan"))).isEqualTo(1);
        assertThat(readingLists.findById(list.getId())).get()
                .satisfies(l -> assertThat(l.getItems()).extracting(i -> i.workId()).containsExactly(second.getId(), first.getId()));
        assertThat(readingLists.findTopPublished(10)).extracting(l -> l.getId()).contains(list.getId());
        assertThat(readingLists.countUpvotes(List.of(list.getId()))).containsEntry(list.getId(), 1L);
    }

    private static void sleepPastClockTick() {
        try {
            Thread.sleep(5);
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
        }
    }

    /// Every chapter is some team's version: a throwaway team for tests that are not about teams.
    private TeamId anyTeam() {
        return teamRepository.save(Team.create("Team " + java.util.UUID.randomUUID(), null, UserId.of("any-leader"))).getId();
    }
}
