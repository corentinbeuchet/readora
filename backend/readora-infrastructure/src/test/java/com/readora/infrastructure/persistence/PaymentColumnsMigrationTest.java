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

/// V22 drops the payment-only columns of `subscriptions` and rewrites the statuses only the payment provider set.
/// Skipped when no Docker daemon is available; CI always runs it.
@Testcontainers(disabledWithoutDocker = true)
class PaymentColumnsMigrationTest {

    @Container
    static final PostgreSQLContainer POSTGRES = new PostgreSQLContainer("postgres:16-alpine");

    @Test
    @DisplayName("V22 keeps plans and period ends, maps provider-only statuses and drops the payment columns")
    void paymentColumnsAreDropped() throws SQLException {
        givenTheSchemaAtVersion("21");
        givenSubscriptions("overdue", "PAST_DUE", "cus_1", "sub_1");
        givenSubscriptions("unfinished", "INCOMPLETE", "cus_2", null);
        givenSubscriptions("paying", "ACTIVE", "cus_3", "sub_3");

        whenAllMigrationsRun();

        thenTheQueryReturns("select user_id || '|' || plan || '|' || status from subscriptions order by user_id",
                "overdue|PREMIUM|ACTIVE", "paying|PREMIUM|ACTIVE", "unfinished|PREMIUM|CANCELED");
        thenTheQueryReturns("select column_name from information_schema.columns where table_name = 'subscriptions' order by column_name",
                "current_period_end", "plan", "status", "updated_at", "user_id");
    }

    private void givenTheSchemaAtVersion(String version) {
        flyway().cleanDisabled(false).load().clean();
        flyway().target(version).load().migrate();
    }

    private void givenSubscriptions(String userId, String status, String customerId, String subscriptionId) throws SQLException {
        execute("insert into users (id, email, username, password_hash, display_name) values ('" + userId + "', '" + userId
                + "@readora.test', '" + userId + "', 'hash', '" + userId + "')");
        execute("insert into subscriptions (user_id, plan, status, current_period_end, stripe_customer_id, stripe_subscription_id, "
                + "last_event_id, last_event_at, cancel_at_period_end) values ('" + userId + "', 'PREMIUM', '" + status
                + "', now() + interval '30 days', '" + customerId + "', " + (subscriptionId == null ? "null" : "'" + subscriptionId + "'")
                + ", 'evt_1', now(), false)");
    }

    /// Up to V22 only: V23 drops the whole table.
    private void whenAllMigrationsRun() {
        flyway().target("22").load().migrate();
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
