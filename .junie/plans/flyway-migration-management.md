---
sessionId: session-260913-072938-1ojb
---

# Requirements

### Overview & Goals
Provide a clear approach for managing database schema modifications in the Readora platform so that SQL changes are correctly recognized and applied during backend startup.

### Scope
- **In Scope**:
  - Explaining and resolving Flyway schema migration lifecycle behavior.
  - Providing the correct workflow for schema updates (incremental versioned migrations vs. local development database reset).
  - Verifying alignment between JPA entity definitions and database DDL.
- **Out of Scope**:
  - Modifying business domain logic or API controllers unrelated to schema changes.
  - Changing database technology or migration framework (Flyway remains standard).

### Functional Requirements
- Database schema changes must be automatically applied when the backend starts up without checksum validation errors.
- Schema evolutions must be tracked incrementally to ensure reproducible migrations across environments (development, staging, production).

### Non-Functional Requirements
- **Consistency**: The database state must strictly match Hibernate entity definitions (`spring.jpa.hibernate.ddl-auto: validate`).
- **Reproducibility**: Migration scripts must execute idempotently and in strict version order.

# Technical Design

### Current Implementation
- Flyway is configured in `backend/readora-web/src/main/resources/application.yml` with `spring.flyway.enabled: true` and `locations: classpath:db/migration`.
- Migration scripts live in `backend/readora-infrastructure/src/main/resources/db/migration/`:
  - `V1__init_schema.sql`
  - `V2__identity_and_subscriptions.sql`
- Docker Compose (`docker-compose.yml`) uses PostgreSQL 16 with a persistent volume (`postgres_data`), preserving `flyway_schema_history` across restarts.

### Key Decisions
- **Incremental Versioning over In-Place Modification**: Never modify already-applied versioned migrations in shared or persistent environments. Use new version files (`V3__...sql`) with `ALTER TABLE` / `CREATE TABLE` statements.
- **Local Database Reset for Scratch Iteration**: When in rapid local prototyping, use `docker compose down -v` to wipe the volume and test full initialization from `V1`.

### File Structure
- `backend/readora-infrastructure/src/main/resources/db/migration/`:
  - `V1__init_schema.sql` (baseline core tables)
  - `V2__identity_and_subscriptions.sql` (identity and billing tables)
  - `V3__<change_description>.sql` (new delta migration)

### Risks & Mitigations
- **Checksum Mismatches**: Editing `V1__init_schema.sql` after it has run will cause startup failures if Flyway validation is active. *Mitigation*: Keep existing version scripts immutable and add `V3`.
- **Entity Mismatch**: Adding columns to SQL without updating JPA entities will lead to Hibernate validation failures on startup (`ddl-auto: validate`). *Mitigation*: Keep entities in `backend/readora-infrastructure` synchronized with migration scripts.

# Delivery Steps

###   Step 1: Audit existing migrations and restore baseline checksums
The baseline schema and existing Flyway migrations are validated and in sync.

- Inspect existing migrations in `backend/readora-infrastructure/src/main/resources/db/migration/` (`V1__init_schema.sql` and `V2__identity_and_subscriptions.sql`).
- Restore baseline migration files to match their registered checksums if modified.
- Verify that `flyway_schema_history` matches the current codebase state.

###   Step 2: Apply schema updates via incremental migration or clean reset
Schema changes are applied cleanly without checksum mismatches.

- Create the next incremental versioned migration script `V3__...sql` in `backend/readora-infrastructure/src/main/resources/db/migration/` for new schema changes.
- Alternatively, if in local development mode, reset the persistent PostgreSQL volume via `docker compose down -v` to re-execute migrations from scratch.
- Restart the backend service and verify that Flyway executes pending migrations successfully.