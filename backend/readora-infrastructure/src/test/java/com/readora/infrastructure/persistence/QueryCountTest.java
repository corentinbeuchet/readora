package com.readora.infrastructure.persistence;

import com.readora.application.port.out.WorkRepositoryPort;
import com.readora.domain.common.UserId;
import com.readora.domain.identity.Email;
import com.readora.domain.identity.PasswordHash;
import com.readora.domain.identity.UserAccount;
import com.readora.domain.scanlation.ScanlationProject;
import com.readora.domain.scanlation.Team;
import com.readora.domain.scanlation.ScanlationRole;
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
        "readora.security.jwt.secret=test-secret-at-least-32-bytes-long-1234567890",
        "readora.stripe.secret-key=sk_test_123",
        "readora.stripe.webhook-secret=whsec_123",
        "readora.stripe.premium-price-id=price_123"
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
    @DisplayName("Listing 12 works with their genres takes a constant number of statements")
    void listingWorksDoesNotIssueOneQueryPerWork() {
        IntStream.range(0, 12).forEach(i ->
                workRepository.save(Work.create("Count Work " + i, "S", WorkType.MANGA, "c.png", Set.of("Action", "Drama"))));

        statistics.clear();
        List<Work> works = workRepository.search(
                new WorkRepositoryPort.WorkSearch(null, Set.of(), Set.of(), Set.of(), Set.of(), Set.of()), 0, 12).items();

        assertThat(works).hasSize(12).allSatisfy(w -> assertThat(w.getGenres()).isNotEmpty());
        assertThat(statistics.getPrepareStatementCount()).isLessThanOrEqualTo(3);
    }

    @Test
    @DisplayName("Published chapters of a work load with their pages in batches, in numeric chapter order")
    void publishedChaptersAreBatchedAndOrdered() {
        Work work = workRepository.save(Work.create("Chapters Work", "S", WorkType.MANGA, "c.png", Set.of("Action")));
        for (String number : List.of("10", "2", "1")) {
            Chapter chapter = Chapter.createDraft(work.getId(), ChapterNumber.of(number), "Ch " + number, null);
            chapter.updatePages(List.of(PageAsset.create(2, "p2.webp", null), PageAsset.create(1, "p1.webp", null)));
            chapter.publish(UserId.of("publisher"));
            chapterRepository.save(chapter);
        }
        chapterRepository.save(Chapter.createDraft(work.getId(), ChapterNumber.of("11"), "Draft", null));

        statistics.clear();
        List<Chapter> published = chapterRepository.findPublishedByWorkId(work.getId());

        assertThat(published).extracting(c -> c.getChapterNumber().value()).containsExactly("1", "2", "10");
        assertThat(published.getFirst().getPages()).extracting(PageAsset::pageNumber).containsExactly(1, 2);
        assertThat(statistics.getPrepareStatementCount()).isLessThanOrEqualTo(2);
    }

    @Test
    @DisplayName("Projects of a work load their tasks in batches, and their teams load members and roles in batches")
    void projectsAreBatched() {
        Work work = workRepository.save(Work.create("Projects Work", "S", WorkType.MANGA, "c.png", Set.of("Action")));
        IntStream.range(0, 5).forEach(i -> {
            Team team = Team.create("Group " + i, null, UserId.of("leader-" + i));
            team.addMember(TeamMember.of(UserId.of("tl-" + i), ScanlationRole.TRANSLATOR));
            teamRepository.save(team);
            ScanlationProject project = ScanlationProject.create("Group " + i, work.getId(), team.getId());
            project.addChapterTask(ChapterNumber.of(String.valueOf(i + 1)));
            projectRepository.save(project);
        });

        statistics.clear();
        List<ScanlationProject> projects = projectRepository.findByWorkId(work.getId());
        List<Team> teams = teamRepository.findAllById(projects.stream().map(ScanlationProject::getTeamId).toList());

        assertThat(projects).hasSize(5).allSatisfy(p -> assertThat(p.getTasks()).hasSize(1));
        assertThat(teams).hasSize(5).allSatisfy(t -> assertThat(t.getMembers()).hasSize(2));
        assertThat(statistics.getPrepareStatementCount()).isLessThanOrEqualTo(5);
    }

    @Test
    @DisplayName("Logging in loads the account and its subscription in one statement")
    void accountLoadsWithItsSubscriptionInOneStatement() {
        accountRepository.save(UserAccount.register(Email.of("count@readora.test"), "count-reader", PasswordHash.of("hash")));

        statistics.clear();
        UserAccount account = accountRepository.findByEmail(Email.of("count@readora.test")).orElseThrow();

        assertThat(account.getSubscription()).isNotNull();
        assertThat(statistics.getPrepareStatementCount()).isEqualTo(1);
    }
}
