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

/// V24 removes the `SCANLATOR` account role from `users.roles` and keeps every other role.
/// Skipped when no Docker daemon is available; CI always runs it.
@Testcontainers(disabledWithoutDocker = true)
class ScanlatorRoleMigrationTest {

    @Container
    static final PostgreSQLContainer POSTGRES = new PostgreSQLContainer("postgres:16-alpine");

    @Test
    @DisplayName("V24 removes SCANLATOR wherever it sits in the list, and a scanlator-only account becomes a reader")
    void scanlatorRoleIsDropped() throws SQLException {
        givenTheSchemaAtVersion("23");
        givenAUserWithRoles("leader", "READER,SCANLATOR");
        givenAUserWithRoles("solo", "SCANLATOR");
        givenAUserWithRoles("boss", "SCANLATOR,ADMIN");
        givenAUserWithRoles("mod", "READER,MODERATOR");

        whenAllMigrationsRun();

        thenTheQueryReturns("select username || '|' || roles from users order by username",
                "boss|ADMIN", "leader|READER", "mod|READER,MODERATOR", "solo|READER");
    }

    private void givenTheSchemaAtVersion(String version) {
        flyway().cleanDisabled(false).load().clean();
        flyway().target(version).load().migrate();
    }

    private void givenAUserWithRoles(String username, String roles) throws SQLException {
        execute("insert into users (id, email, username, password_hash, display_name, roles) values ('" + username + "', '"
                + username + "@readora.test', '" + username + "', 'hash', '" + username + "', '" + roles + "')");
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
