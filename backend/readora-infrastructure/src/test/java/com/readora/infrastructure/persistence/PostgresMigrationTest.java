package com.readora.infrastructure.persistence;

import com.readora.domain.common.UserId;
import com.readora.domain.scanlation.ScanlationProject;
import com.readora.domain.work.*;
import com.readora.infrastructure.persistence.adapter.ChapterRepositoryAdapter;
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
}
