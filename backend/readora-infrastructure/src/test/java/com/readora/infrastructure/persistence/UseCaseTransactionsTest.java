package com.readora.infrastructure.persistence;

import com.readora.domain.common.UserId;
import com.readora.domain.common.ConcurrentModificationDomainException;
import com.readora.domain.scanlation.ScanlationProject;
import com.readora.domain.work.*;
import com.readora.infrastructure.config.UseCaseTransactions;
import com.readora.infrastructure.persistence.adapter.ScanlationProjectRepositoryAdapter;
import com.readora.infrastructure.persistence.adapter.WorkRepositoryAdapter;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.TestPropertySource;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.TransactionDefinition;
import org.springframework.transaction.support.TransactionTemplate;

import java.util.Set;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

@SpringBootTest(classes = TestApplication.class)
@TestPropertySource(properties = {
        "spring.datasource.url=jdbc:h2:mem:readora_tx_test;DB_CLOSE_DELAY=-1;DB_CLOSE_ON_EXIT=FALSE;MODE=PostgreSQL",
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
        "readora.stripe.secret-key=sk_test_123",
        "readora.stripe.webhook-secret=whsec_123",
        "readora.stripe.premium-price-id=price_123"
})
class UseCaseTransactionsTest {

    /// Stand-in for a `port.in` interface.
    interface TwoStepUseCase {
        void run(Work first, Work second);
    }

    @Autowired
    private WorkRepositoryAdapter workRepository;

    @Autowired
    private ScanlationProjectRepositoryAdapter projectRepository;

    @Autowired
    private PlatformTransactionManager transactionManager;

    @Test
    @DisplayName("A use case that fails after its first save rolls back every write")
    void failingUseCaseRollsBackEarlierSaves() {
        TwoStepUseCase target = (first, second) -> {
            workRepository.save(first);
            throw new IllegalStateException("second step failed");
        };
        TwoStepUseCase useCase = UseCaseTransactions.transactional(target, TwoStepUseCase.class, transactionManager);
        Work first = Work.create("Rolled Back", "Synopsis", WorkType.MANGA, "c.png", Set.of("Action"));

        assertThatThrownBy(() -> useCase.run(first, null)).isInstanceOf(IllegalStateException.class);

        assertThat(workRepository.findById(first.getId())).isEmpty();
    }

    @Test
    @DisplayName("A use case that succeeds commits all of its saves")
    void successfulUseCaseCommitsAllSaves() {
        TwoStepUseCase useCase = UseCaseTransactions.transactional(
                (first, second) -> {
                    workRepository.save(first);
                    workRepository.save(second);
                }, TwoStepUseCase.class, transactionManager);
        Work first = Work.create("Committed A", "Synopsis", WorkType.MANGA, "c.png", Set.of("Action"));
        Work second = Work.create("Committed B", "Synopsis", WorkType.MANGA, "c.png", Set.of("Action"));

        useCase.run(first, second);

        assertThat(workRepository.findById(first.getId())).isPresent();
        assertThat(workRepository.findById(second.getId())).isPresent();
    }

    @Test
    @DisplayName("Inside one transaction, a write committed by someone else after our read is rejected as a conflict")
    void staleWriteInsideTransactionIsRejected() {
        Work work = Work.create("Tx Lock Work", "Synopsis", WorkType.MANGA, "c.png", Set.of("Action"));
        workRepository.save(work);
        ScanlationProject project = ScanlationProject.create("Tx Lock Group", work.getId(), UserId.of("leader_tx"));
        projectRepository.save(project);

        TransactionTemplate outer = new TransactionTemplate(transactionManager);
        TransactionTemplate concurrent = new TransactionTemplate(transactionManager);
        concurrent.setPropagationBehavior(TransactionDefinition.PROPAGATION_REQUIRES_NEW);

        assertThatThrownBy(() -> outer.executeWithoutResult(status -> {
            ScanlationProject mine = projectRepository.findById(project.getId()).orElseThrow();

            concurrent.executeWithoutResult(s -> {
                ScanlationProject theirs = projectRepository.findById(project.getId()).orElseThrow();
                theirs.addChapterTask(ChapterNumber.of("1"));
                projectRepository.save(theirs);
            });

            mine.addChapterTask(ChapterNumber.of("2"));
            projectRepository.save(mine);
        })).isInstanceOf(ConcurrentModificationDomainException.class);

        assertThat(projectRepository.findById(project.getId()).orElseThrow().getTasks())
                .extracting(t -> t.getChapterNumber().value())
                .containsExactly("1");
    }
}
