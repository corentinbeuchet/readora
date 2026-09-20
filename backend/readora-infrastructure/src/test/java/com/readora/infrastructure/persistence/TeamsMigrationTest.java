package com.readora.infrastructure.persistence;

import org.flywaydb.core.Flyway;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;
import org.testcontainers.postgresql.PostgreSQLContainer;

import java.sql.Connection;
import java.sql.DriverManager;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.sql.Statement;
import java.util.ArrayList;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

/// V17 turns every scanlation project into a team with the same id: the roster, the roles and the follows that
/// existed before must still be there afterwards. Skipped when no Docker daemon is available; CI always runs it.
@Testcontainers(disabledWithoutDocker = true)
class TeamsMigrationTest {

    private static final String WORK = "00000000-0000-4000-a000-000000000001";
    private static final String PROJECT = "00000000-0000-4000-a000-000000000101";
    private static final String MEMBER = "00000000-0000-4000-a000-000000000201";

    @Container
    static final PostgreSQLContainer POSTGRES = new PostgreSQLContainer("postgres:16-alpine");

    @Test
    @DisplayName("A project that existed before V17 becomes a team with the same id, members, roles and followers")
    void existingProjectBecomesATeam() throws SQLException {
        givenTheSchemaAtVersion("16");
        givenAProjectWithALeaderAndAFollower();

        whenAllMigrationsRun();

        thenTheQueryReturns("select id::text || '|' || name from teams", PROJECT + "|Shadow Scans");
        thenTheQueryReturns("select team_id::text from scanlation_projects where id = '" + PROJECT + "'", PROJECT);
        thenTheQueryReturns("select id::text || '|' || team_id::text || '|' || user_id from team_members", MEMBER + "|" + PROJECT + "|leader-1");
        thenTheQueryReturns("select role from member_roles where member_id = '" + MEMBER + "'", "LEADER");
        thenTheQueryReturns("select user_id || '|' || team_id::text from team_follows", "kenji|" + PROJECT);
    }

    private void givenTheSchemaAtVersion(String version) {
        flyway().target(version).load().migrate();
    }

    private void givenAProjectWithALeaderAndAFollower() throws SQLException {
        execute("insert into works (id, title, work_type, status) values ('" + WORK + "', 'Solo Leveling', 'MANHWA', 'ONGOING')");
        execute("insert into scanlation_projects (id, name, work_id) values ('" + PROJECT + "', 'Shadow Scans', '" + WORK + "')");
        execute("insert into team_members (id, project_id, user_id) values ('" + MEMBER + "', '" + PROJECT + "', 'leader-1')");
        execute("insert into member_roles (member_id, role) values ('" + MEMBER + "', 'LEADER')");
        execute("insert into team_follows (user_id, project_id, followed_at) values ('kenji', '" + PROJECT + "', now())");
    }

    private void whenAllMigrationsRun() {
        flyway().load().migrate();
    }

    private void thenTheQueryReturns(String sql, String... rows) throws SQLException {
        List<String> found = new ArrayList<>();
        try (Connection connection = connect(); Statement statement = connection.createStatement(); ResultSet result = statement.executeQuery(sql)) {
            while (result.next()) {
                found.add(result.getString(1));
            }
        }
        assertThat(found).containsExactly(rows);
    }

    private static org.flywaydb.core.api.configuration.FluentConfiguration flyway() {
        return Flyway.configure()
                .dataSource(POSTGRES.getJdbcUrl(), POSTGRES.getUsername(), POSTGRES.getPassword())
                .locations("classpath:db/migration");
    }

    private static void execute(String sql) throws SQLException {
        try (Connection connection = connect(); Statement statement = connection.createStatement()) {
            statement.execute(sql);
        }
    }

    private static Connection connect() throws SQLException {
        return DriverManager.getConnection(POSTGRES.getJdbcUrl(), POSTGRES.getUsername(), POSTGRES.getPassword());
    }
}
