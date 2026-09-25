package com.readora.infrastructure.persistence;

import com.readora.application.port.out.WorkRepositoryPort;
import com.readora.domain.common.UserId;
import com.readora.domain.identity.Email;
import com.readora.domain.identity.PasswordHash;
import com.readora.domain.identity.UserAccount;
import com.readora.domain.scanlation.ScanlationProject;
import com.readora.domain.scanlation.ScanlationRole;
import com.readora.domain.scanlation.Team;
import com.readora.domain.scanlation.TeamId;
import com.readora.domain.scanlation.TeamMember;
import com.readora.domain.work.*;
import com.readora.infrastructure.persistence.adapter.ChapterRepositoryAdapter;
import com.readora.infrastructure.persistence.adapter.ScanlationProjectRepositoryAdapter;
import com.readora.infrastructure.persistence.adapter.TeamRepositoryAdapter;
import com.readora.infrastructure.persistence.adapter.UserAccountRepositoryAdapter;
import com.readora.infrastructure.persistence.adapter.WorkRepositoryAdapter;
import jakarta.persistence.EntityManagerFactory;
import org.hibernate.SessionFactory;
import org.hibernate.stat.Statistics;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.TestPropertySource;

import java.util.List;
import java.util.Set;
import java.util.stream.IntStream;

import static org.assertj.core.api.Assertions.assertThat;

/// Guards the hot read paths against N+1 regressions: loading N aggregates with their lazy collections must take a
/// constant number of statements (batch fetching), not one per aggregate.
@SpringBootTest(classes = TestApplication.class)
@TestPropertySource(properties = {
        "spring.datasource.url=jdbc:h2:mem:readora_query_count;DB_CLOSE_DELAY=-1;DB_CLOSE_ON_EXIT=FALSE;MODE=PostgreSQL",
        "spring.datasource.driver-class-name=org.h2.Driver",
        "spring.datasource.username=sa",
        "spring.datasource.password=",
        "spring.flyway.enabled=true",
        "spring.jpa.hibernate.ddl-auto=validate",
        "spring.jpa.database-platform=org.hibernate.dialect.H2Dialect",
        "spring.jpa.properties.hibernate.generate_statistics=true",
        "aws.s3.bucket-name=test-bucket",
        "aws.cloudfront.domain=https://cdn-test.readora.com",
        "readora.security.jwt.secret=test-secret-at-least-32-bytes-long-1234567890"
})
class QueryCountTest {

    @Autowired
    private WorkRepositoryAdapter workRepository;

    @Autowired
    private ChapterRepositoryAdapter chapterRepository;

    @Autowired
    private ScanlationProjectRepositoryAdapter projectRepository;

    @Autowired
    private TeamRepositoryAdapter teamRepository;

    @Autowired
    private UserAccountRepositoryAdapter accountRepository;

    @Autowired
    private EntityManagerFactory entityManagerFactory;

    private Statistics statistics;

    @BeforeEach
    void setUp() {
        statistics = entityManagerFactory.unwrap(SessionFactory.class).getStatistics();
    }

    @Test
    @DisplayName("Listing 12 works with their genres and other titles takes a constant number of statements")
    void listingWorksDoesNotIssueOneQueryPerWork() {
        IntStream.range(0, 12).forEach(i ->
                workRepository.save(Work.create("Count Work " + i, "S", WorkType.MANGA, WorkStatus.ONGOING, null, null, "c.png", Set.of("Action", "Drama"),
                        new WorkFacts(List.of("Other title " + i), null, null, null, null))));

        statistics.clear();
        List<Work> works = workRepository.search(
                new WorkRepositoryPort.WorkSearch(null, Set.of(), Set.of(), Set.of(), Set.of(), Set.of()), 0, 12).items();

        assertThat(works).hasSize(12).allSatisfy(w -> assertThat(w.getGenres()).isNotEmpty());
        assertThat(works).allSatisfy(w -> assertThat(w.getFacts().alternativeTitles()).hasSize(1));
        assertThat(statistics.getPrepareStatementCount()).isLessThanOrEqualTo(4);
    }

    @Test
    @DisplayName("Published chapters of a work load with their pages in batches, in numeric chapter order")
    void publishedChaptersAreBatchedAndOrdered() {
        Work work = workRepository.save(Work.create("Chapters Work", "S", WorkType.MANGA, "c.png", Set.of("Action")));
        TeamId teamId = teamRepository.save(Team.create("Chapters Team", null, UserId.of("publisher"))).getId();
        for (String number : List.of("10", "2", "1")) {
            Chapter chapter = Chapter.createDraft(work.getId(), ChapterNumber.of(number), "Ch " + number, teamId);
            chapter.updatePages(List.of(PageAsset.create(2, "p2.webp", null), PageAsset.create(1, "p1.webp", null)));
            chapter.publish(UserId.of("publisher"));
            chapterRepository.save(chapter);
        }
        chapterRepository.save(Chapter.createDraft(work.getId(), ChapterNumber.of("11"), "Draft", teamId));

        statistics.clear();
        List<Chapter> published = chapterRepository.findPublishedByWorkId(work.getId());

        assertThat(published).extracting(c -> c.getChapterNumber().value()).containsExactly("1", "2", "10");
        assertThat(published.getFirst().getPages()).extracting(PageAsset::pageNumber).containsExactly(1, 2);
        assertThat(statistics.getPrepareStatementCount()).isLessThanOrEqualTo(2);
    }

    @Test
    @DisplayName("The projects of all my teams load in one query with their tasks and pages in batches, not one query per team")
    void projectsOfManyTeamsAreOneQuery() {
        List<TeamId> teamIds = IntStream.range(0, 6).mapToObj(i -> {
            Work work = workRepository.save(Work.create("Many Teams Work " + i, "S", WorkType.MANGA, "c.png", Set.of("Action")));
            Team team = teamRepository.save(Team.create("Many Teams " + i, null, UserId.of("many-leader")));
            ScanlationProject project = ScanlationProject.create("Many Teams " + i, work.getId(), team.getId());
            project.addChapterTask(ChapterNumber.of("1"), List.of(PageAsset.create(1, "raw/p1.webp", null), PageAsset.create(2, "raw/p2.webp", null)), UserId.of("many-leader"));
            projectRepository.save(project);
            return team.getId();
        }).toList();

        statistics.clear();
        List<ScanlationProject> projects = projectRepository.findByTeamIds(teamIds);

        assertThat(projects).hasSize(6).allSatisfy(p -> assertThat(p.getTasks().getFirst().getPages()).hasSize(2));
        assertThat(statistics.getPrepareStatementCount()).isLessThanOrEqualTo(3);
    }

    @Test
    @DisplayName("Projects of a work load their tasks and pages in batches, and their teams load members and roles in batches")
    void projectsAreBatched() {
        Work work = workRepository.save(Work.create("Projects Work", "S", WorkType.MANGA, "c.png", Set.of("Action")));
        IntStream.range(0, 5).forEach(i -> {
            Team team = Team.create("Group " + i, null, UserId.of("leader-" + i));
            team.addMember(TeamMember.of(UserId.of("tl-" + i), ScanlationRole.TRANSLATOR));
            teamRepository.save(team);
            ScanlationProject project = ScanlationProject.create("Group " + i, work.getId(), team.getId());
            project.addChapterTask(ChapterNumber.of(String.valueOf(i + 1)), List.of(PageAsset.create(1, "raw/p1.webp", null)), UserId.of("leader-" + i));
            projectRepository.save(project);
        });

        statistics.clear();
        List<ScanlationProject> projects = projectRepository.findByWorkId(work.getId());
        List<Team> teams = teamRepository.findAllById(projects.stream().map(ScanlationProject::getTeamId).toList());

        assertThat(projects).hasSize(5).allSatisfy(p -> assertThat(p.getTasks().getFirst().getPages()).hasSize(1));
        assertThat(teams).hasSize(5).allSatisfy(t -> assertThat(t.getMembers()).hasSize(2));
        assertThat(statistics.getPrepareStatementCount()).isLessThanOrEqualTo(6);
    }

    @Test
    @DisplayName("The Studio reads a team's boards and open tasks as plain columns: 3 statements and no entity for 30 boards of 12 tasks of 5 pages")
    void studioReadsLoadNoTaskOrPage() {
        Team team = teamRepository.save(Team.create("Studio Scale", null, UserId.of("studio-leader")));
        List<WorkId> workIds = IntStream.range(0, 30).mapToObj(i -> {
            Work work = workRepository.save(Work.create("Studio Scale Work " + i, "S", WorkType.MANGA, "c.png", Set.of("Action")));
            ScanlationProject project = ScanlationProject.create("Studio Scale " + i, work.getId(), team.getId());
            project.turnBoardOn();
            IntStream.rangeClosed(1, 12).forEach(chapter -> project.addChapterTask(ChapterNumber.of(String.valueOf(chapter)),
                    IntStream.rangeClosed(1, 5).mapToObj(page -> PageAsset.create(page, "raw/c" + chapter + "p" + page + ".webp", null)).toList(),
                    UserId.of("studio-leader")));
            projectRepository.save(project);
            return work.getId();
        }).toList();

        statistics.clear();
        var boards = projectRepository.findBoardRefs(List.of(team.getId()));
        var open = projectRepository.findOpenTasks(List.of(team.getId()));
        var titles = workRepository.findTitles(workIds);

        assertThat(boards).hasSize(30);
        assertThat(open).hasSize(30 * 12);
        assertThat(titles).hasSize(30);
        assertThat(statistics.getPrepareStatementCount()).isEqualTo(3);
        assertThat(statistics.getEntityLoadCount()).isZero();
    }

    @Test
    @DisplayName("Logging in loads the account in one statement")
    void accountLoadsInOneStatement() {
        accountRepository.save(UserAccount.register(Email.of("count@readora.test"), "count-reader", PasswordHash.of("hash")));

        statistics.clear();
        UserAccount account = accountRepository.findByEmail(Email.of("count@readora.test")).orElseThrow();

        assertThat(account.getUsername()).isEqualTo("count-reader");
        assertThat(statistics.getPrepareStatementCount()).isEqualTo(1);
    }

    @Test
    @DisplayName("The chapter list counts pages in one statement and loads no page, where the full chapters load every page")
    void chapterListCountsPages() {
        Work work = workRepository.save(Work.create("Long Series", "S", WorkType.MANGA, "c.png", Set.of("Action")));
        TeamId team = teamRepository.save(Team.create("Long Series Team", null, UserId.of("long-leader"))).getId();
        List<PageAsset> pages = IntStream.rangeClosed(1, 30).mapToObj(n -> PageAsset.create(n, "long/p" + n + ".webp", null)).toList();
        IntStream.rangeClosed(1, 40).forEach(n -> {
            Chapter chapter = Chapter.createDraft(work.getId(), ChapterNumber.of(String.valueOf(n)), "Ch " + n, team);
            chapter.updatePages(pages);
            chapter.publish(UserId.of("long-leader"));
            chapterRepository.save(chapter);
        });

        statistics.clear();
        List<ChapterSummary> summaries = chapterRepository.findPublishedSummariesByWorkId(work.getId());
        long summaryStatements = statistics.getPrepareStatementCount();
        long summaryEntities = statistics.getEntityLoadCount();
        statistics.clear();
        chapterRepository.findPublishedByWorkId(work.getId());
        long fullEntities = statistics.getEntityLoadCount();

        assertThat(summaries).hasSize(40).allSatisfy(summary -> assertThat(summary.pageCount()).isEqualTo(30));
        assertThat(summaries.getFirst().chapterNumber()).isEqualTo(ChapterNumber.of("1"));
        assertThat(summaries.getLast().chapterNumber()).isEqualTo(ChapterNumber.of("40"));
        assertThat(summaryStatements).isEqualTo(1);
        assertThat(summaryEntities).isZero();
        assertThat(fullEntities).isEqualTo(40 + 40 * 30);
    }
}
