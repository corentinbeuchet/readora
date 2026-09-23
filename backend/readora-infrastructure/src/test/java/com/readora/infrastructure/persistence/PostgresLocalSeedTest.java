package com.readora.infrastructure.persistence;

import com.readora.domain.identity.Email;
import com.readora.domain.identity.Permission;
import com.readora.domain.identity.UserAccount;
import com.readora.domain.scanlation.ProjectId;
import com.readora.domain.scanlation.ScanlationProject;
import com.readora.domain.scanlation.Team;
import com.readora.infrastructure.persistence.adapter.ScanlationProjectRepositoryAdapter;
import com.readora.infrastructure.persistence.adapter.TeamRepositoryAdapter;
import com.readora.infrastructure.persistence.adapter.UserAccountRepositoryAdapter;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;
import org.testcontainers.postgresql.PostgreSQLContainer;

import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;

/// Runs the local dev seed (db/seed-local) on real PostgreSQL, like docker-compose does. H2 accepts implicit
/// text-to-uuid conversions that PostgreSQL rejects, so the H2 web test alone is not enough.
/// Skipped when no Docker daemon is available; CI always runs it.
@Testcontainers(disabledWithoutDocker = true)
@SpringBootTest(classes = TestApplication.class, properties = {
        "spring.flyway.enabled=true",
        "spring.flyway.locations=classpath:db/migration,classpath:db/seed-local",
        "spring.jpa.hibernate.ddl-auto=validate",
        "aws.s3.bucket-name=test-bucket",
        "aws.cloudfront.domain=https://cdn-test.readora.com",
        "readora.security.jwt.secret=test-secret-at-least-32-bytes-long-1234567890"
})
class PostgresLocalSeedTest {

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
    private UserAccountRepositoryAdapter users;

    @Autowired
    private ScanlationProjectRepositoryAdapter projects;

    @Autowired
    private TeamRepositoryAdapter teams;

    @Autowired
    private com.readora.infrastructure.persistence.adapter.RatingRepositoryAdapter ratings;

    @Test
    @DisplayName("The local seed applies on PostgreSQL and its accounts and demo team load through the adapters")
    void seedAppliesOnPostgres() {
        UserAccount kenji = users.findByEmail(Email.of("kenji@readora.local")).orElseThrow();
        assertThat(kenji.can(Permission.LIBRARY_USE)).isTrue();
        assertThat(users.findByEmail(Email.of("admin@readora.local")).orElseThrow().can(Permission.USER_MANAGE)).isTrue();
        assertThat(users.findByEmail(Email.of("quality@readora.local")).orElseThrow().can(Permission.USER_MANAGE)).isFalse();
        assertThat(users.findByEmail(Email.of("moderator@readora.local")).orElseThrow().can(Permission.COMMENT_MODERATE)).isTrue();
        assertThat(ratings.findTopRated(5, 10)).hasSize(2);

        ScanlationProject project = projects.findById(ProjectId.of(UUID.fromString("00000000-0000-4000-9000-000000000101"))).orElseThrow();
        assertThat(project.getTasks()).hasSize(5);
        Team team = teams.findById(project.getTeamId()).orElseThrow();
        assertThat(team.getName()).isEqualTo("Readora Demo Team");
        assertThat(team.getMembers()).hasSize(6);
    }
}
