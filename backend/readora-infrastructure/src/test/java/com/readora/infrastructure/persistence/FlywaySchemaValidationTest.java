package com.readora.infrastructure.persistence;

import com.readora.domain.common.UserId;
import com.readora.domain.scanlation.*;
import com.readora.domain.work.*;
import com.readora.infrastructure.persistence.adapter.ScanlationProjectRepositoryAdapter;
import com.readora.infrastructure.persistence.adapter.WorkRepositoryAdapter;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.TestPropertySource;

import java.time.Instant;
import java.util.Optional;
import java.util.Set;

import com.readora.domain.common.ConcurrentModificationDomainException;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

@SpringBootTest(classes = TestApplication.class)
@TestPropertySource(properties = {
        "spring.datasource.url=jdbc:h2:mem:readora_schema_test;DB_CLOSE_DELAY=-1;DB_CLOSE_ON_EXIT=FALSE;MODE=PostgreSQL",
        "spring.datasource.driver-class-name=org.h2.Driver",
        "spring.datasource.username=sa",
        "spring.datasource.password=",
        "spring.flyway.enabled=true",
        "spring.jpa.hibernate.ddl-auto=validate",
        "spring.jpa.database-platform=org.hibernate.dialect.H2Dialect",
        "aws.s3.bucket-name=test-bucket",
        "aws.s3.region=us-east-1",
        "aws.cloudfront.domain=https://cdn-test.readora.com",
        "readora.security.jwt.secret=test-secret-at-least-32-bytes-long-1234567890",
        "readora.security.jwt.access-ttl=PT15M",
        "readora.security.jwt.refresh-ttl=P30D",
        "readora.stripe.secret-key=sk_test_123",
        "readora.stripe.webhook-secret=whsec_123",
        "readora.stripe.premium-price-id=price_123"
})
class FlywaySchemaValidationTest {

    @Autowired
    private WorkRepositoryAdapter workRepositoryAdapter;

    @Autowired
    private ScanlationProjectRepositoryAdapter scanlationProjectRepositoryAdapter;

    @Test
    @DisplayName("Work with genres is successfully persisted and retrieved with Hibernate ddl-auto: validate")
    void persistAndRetrieveWorkWithGenres() {
        Work work = Work.create("Test Title", "Test Synopsis", WorkType.MANHWA, "cover.png", Set.of("Action", "Fantasy"));
        workRepositoryAdapter.save(work);

        Optional<Work> loaded = workRepositoryAdapter.findById(work.getId());
        assertTrue(loaded.isPresent());
        assertEquals("Test Title", loaded.get().getTitle());
        assertEquals(Set.of("Action", "Fantasy"), loaded.get().getGenres());
    }

    @Test
    @DisplayName("ScanlationProject with team member roles is successfully persisted and retrieved")
    void persistAndRetrieveProjectWithMemberRoles() {
        Work work = Work.create("Project Work", "Synopsis", WorkType.MANGA, "c.png", Set.of("Adventure"));
        workRepositoryAdapter.save(work);

        ScanlationProject project = ScanlationProject.create("Scan Group", work.getId(), UserId.of("leader_1"));
        project.addMember(new TeamMember(UserId.of("translator_1"), Set.of(ScanlationRole.TRANSLATOR, ScanlationRole.PROOFREADER), Instant.now()));

        scanlationProjectRepositoryAdapter.save(project);

        Optional<ScanlationProject> loaded = scanlationProjectRepositoryAdapter.findById(project.getId());
        assertTrue(loaded.isPresent());
        assertEquals("Scan Group", loaded.get().getName());
        assertEquals(2, loaded.get().getMembers().size());

        TeamMember translator = loaded.get().getMembers().stream()
                .filter(m -> m.userId().value().equals("translator_1"))
                .findFirst()
                .orElseThrow();
        assertEquals(Set.of(ScanlationRole.TRANSLATOR, ScanlationRole.PROOFREADER), translator.roles());
    }

    @Test
    @DisplayName("Two writers who loaded the same project version: the second save is rejected as a concurrent modification")
    void staleProjectSaveIsRejected() {
        Work work = Work.create("Locking Work", "Synopsis", WorkType.MANGA, "c.png", Set.of("Action"));
        workRepositoryAdapter.save(work);
        ScanlationProject project = ScanlationProject.create("Lock Group", work.getId(), UserId.of("leader_lock"));
        project.addChapterTask(ChapterNumber.of("1"));
        scanlationProjectRepositoryAdapter.save(project);

        ScanlationProject first = scanlationProjectRepositoryAdapter.findById(project.getId()).orElseThrow();
        ScanlationProject second = scanlationProjectRepositoryAdapter.findById(project.getId()).orElseThrow();
        TaskId taskId = first.getTasks().getFirst().getId();

        first.claimTask(taskId, UserId.of("leader_lock"));
        scanlationProjectRepositoryAdapter.save(first);

        second.addChapterTask(ChapterNumber.of("2"));
        assertThrows(ConcurrentModificationDomainException.class, () -> scanlationProjectRepositoryAdapter.save(second));
        assertEquals(1, scanlationProjectRepositoryAdapter.findById(project.getId()).orElseThrow().getTasks().size());
    }

    @Test
    @DisplayName("The same in-memory aggregate can be saved repeatedly: its version follows each save")
    void repeatedSavesOfSameAggregateSucceed() {
        Work work = Work.create("Resave Work", "Synopsis", WorkType.MANGA, "c.png", Set.of("Action"));
        workRepositoryAdapter.save(work);
        Long afterInsert = work.getVersion();

        workRepositoryAdapter.save(work);
        workRepositoryAdapter.save(work);

        assertNotNull(afterInsert);
        assertEquals(work.getVersion(), workRepositoryAdapter.findById(work.getId()).orElseThrow().getVersion());
    }
}
