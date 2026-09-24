package db.migration;

import org.flywaydb.core.api.migration.BaseJavaMigration;
import org.flywaydb.core.api.migration.Context;

import java.sql.Connection;
import java.sql.Statement;

/// Trigram indexes for the catalog search (`WorkSpecifications`: `lower(column) like '%text%'` on the title, the author
/// and the other titles), on PostgreSQL only: H2, which runs the migrations in tests, has neither `pg_trgm` nor
/// expression indexes, so there this migration does nothing. `pg_trgm` is a trusted extension (PostgreSQL 13+): the
/// database owner can create it without superuser rights. Measured on 100k series and 300k other titles: 422 ms to
/// 0.07 ms for a search that matches nothing.
public class V32__search_trigram_indexes extends BaseJavaMigration {

    @Override
    public void migrate(Context context) throws Exception {
        Connection connection = context.getConnection();
        if (!"PostgreSQL".equals(connection.getMetaData().getDatabaseProductName())) {
            return;
        }
        try (Statement statement = connection.createStatement()) {
            statement.execute("CREATE EXTENSION IF NOT EXISTS pg_trgm");
            statement.execute("CREATE INDEX idx_works_title_trgm ON works USING gin (lower(title) gin_trgm_ops)");
            statement.execute("CREATE INDEX idx_works_author_trgm ON works USING gin (lower(author) gin_trgm_ops)");
            statement.execute("CREATE INDEX idx_work_alt_titles_title_trgm ON work_alt_titles USING gin (lower(title) gin_trgm_ops)");
        }
    }
}
