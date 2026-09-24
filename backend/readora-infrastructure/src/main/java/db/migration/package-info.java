/// Flyway Java migrations (found through `classpath:db/migration`): what SQL migrations can't express on every database.
/// Null-safe by default: nothing is nullable unless annotated `@Nullable` (checked by NullAway at build time).
@NullMarked
package db.migration;

import org.jspecify.annotations.NullMarked;
