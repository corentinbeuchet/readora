---
sessionId: session-260913-070442-s75z
---

# Requirements

### Overview & Goals
When starting the backend service (`readora-platform`) with PostgreSQL and Hibernate schema validation enabled (`spring.jpa.hibernate.ddl-auto: validate`), Spring Boot context initialization fails with:
`SchemaManagementException: Schema validation: missing table [work_genres]` (or `[member_roles]`).

This happens because:
1. JPA entities (`WorkJpaEntity` and `TeamMemberJpaEntity`) use JPA `@ElementCollection` / `@CollectionTable` mapping to relational child tables (`work_genres` and `member_roles`).
2. Existing databases / Docker volumes where Flyway migrations `V1` and `V2` have already been applied do not re-execute past migration versions (`V1`), leaving the database without `work_genres` and `member_roles` unless an incremental forward migration (`V3`) is provided.
3. A complete audit of all 11 JPA entities in the codebase confirms that `work_genres` and `member_roles` are the only collection tables and child tables requiring alignment.

The goal is to ensure 100% schema alignment across all JPA entities and database migrations by adding an idempotent forward Flyway migration (`V3__element_collection_tables.sql`) and keeping `V1__init_schema.sql` aligned, ensuring application startup passes `ddl-auto: validate` on both fresh databases and existing persistent environments.

### Scope
- **In Scope:**
  - Create `V3__element_collection_tables.sql` Flyway migration to idempotently create `work_genres` and `member_roles` tables (along with foreign keys and indexes) for existing databases.
  - Maintain clean `V1__init_schema.sql` table definitions for `works`, `work_genres`, `team_members`, and `member_roles` for fresh database setups.
  - Verify all 11 JPA entities (`UserAccount`, `Subscription`, `RefreshToken`, `Work`, `Chapter`, `PageAsset`, `ScanlationProject`, `TeamMember`, `WorkflowTask`, `ChapterComment`, `Bookmark`) pass `spring.jpa.hibernate.ddl-auto: validate`.
  - Update `FlywaySchemaValidationTest` to execute migrations V1, V2, and V3 against the test container/database.
- **Out of Scope:**
  - Altering domain entity business logic or domain model signatures.
  - Modifying table schemas for other unaffected entities (`users`, `subscriptions`, `chapters`, `workflow_tasks`, `bookmarks`, `chapter_comments`).

### User Stories
- **As a Developer / Operator**, I want the backend application to boot up without `SchemaManagementException` regardless of whether starting against a fresh database or an existing database volume with prior migrations, so that the platform runs reliably in all environments.

### Functional Requirements
- Flyway migration `V3__element_collection_tables.sql` must:
  - Create `work_genres` table if not exists with `work_id` (UUID foreign key to `works.id` with `ON DELETE CASCADE`) and `genre` (VARCHAR(255) NOT NULL).
  - Create `member_roles` table if not exists with `member_id` (UUID foreign key to `team_members.id` with `ON DELETE CASCADE`) and `role` (VARCHAR(50) NOT NULL).
  - Create indexes on `work_genres(work_id)` and `member_roles(member_id)`.
- Backend context initialization with `spring.jpa.hibernate.ddl-auto: validate` must complete successfully without `SchemaManagementException`.
- All persistence adapters (`WorkRepositoryAdapter`, `ScanlationProjectRepositoryAdapter`, `BookmarkRepositoryAdapter`, `ChapterRepositoryAdapter`, `CommentRepositoryAdapter`, `UserAccountRepositoryAdapter`, `RefreshTokenRepositoryAdapter`) must read/write cleanly.

### Non-Functional Requirements
- **Idempotence & Backward Compatibility**: `CREATE TABLE IF NOT EXISTS` and `CREATE INDEX IF NOT EXISTS` ensure forward migrations apply cleanly whether run on fresh or existing databases.
- **Referential Integrity**: Cascading deletes (`ON DELETE CASCADE`) prevent orphaned child collection records when parent entities are deleted.
- **Query Performance**: Dedicated index coverage on foreign key columns (`work_id` and `member_id`).

# Technical Design

### Current Implementation
- Complete audit of all 11 JPA entities in `backend/readora-infrastructure/src/main/java/com/readora/infrastructure/persistence/entity/`:
  1. `WorkJpaEntity`: `@Table(name = "works")`, `@CollectionTable(name = "work_genres")`
  2. `TeamMemberJpaEntity`: `@Table(name = "team_members")`, `@CollectionTable(name = "member_roles")`
  3. `ChapterJpaEntity`: `@Table(name = "chapters")`
  4. `PageAssetJpaEntity`: `@Table(name = "page_assets")`
  5. `ScanlationProjectJpaEntity`: `@Table(name = "scanlation_projects")`
  6. `WorkflowTaskJpaEntity`: `@Table(name = "workflow_tasks")`
  7. `ChapterCommentJpaEntity`: `@Table(name = "chapter_comments")`
  8. `BookmarkJpaEntity`: `@Table(name = "bookmarks")`
  9. `UserAccountJpaEntity`: `@Table(name = "users")`
  10. `SubscriptionJpaEntity`: `@Table(name = "subscriptions")`
  11. `RefreshTokenJpaEntity`: `@Table(name = "refresh_tokens")`
- `V1__init_schema.sql` defines core tables including `works`, `work_genres`, `team_members`, `member_roles`, `chapters`, `page_assets`, `scanlation_projects`, `workflow_tasks`, `chapter_comments`, `bookmarks`.
- `V2__identity_and_subscriptions.sql` defines `users`, `subscriptions`, and `refresh_tokens`.
- Existing database containers that previously ran V1/V2 before `work_genres` and `member_roles` were introduced fail during startup because Flyway does not re-run past versions without a forward migration.

### Key Decisions
1. **Provide an incremental Flyway migration `V3__element_collection_tables.sql` alongside aligned `V1`**:
   - *Rationale*: Flyway treats applied migration versions as immutable. Existing databases (Docker volumes, staging RDS, developer databases) that were initialized with earlier V1/V2 schemas need `V3` to automatically apply the missing `work_genres` and `member_roles` tables without requiring manual SQL execution or resetting volume data.
2. **Use Idempotent DDL statements (`CREATE TABLE IF NOT EXISTS` / `CREATE INDEX IF NOT EXISTS`)**:
   - *Rationale*: Allows both fresh setups (where V1 already created the tables) and existing setups (where V1 was run previously) to execute `V3` safely without errors.

### Proposed Changes

#### 1. Add Flyway Migration: `V3__element_collection_tables.sql`
Create `backend/readora-infrastructure/src/main/resources/db/migration/V3__element_collection_tables.sql`:
```sql
-- ==============================================================================
-- Flyway Database Migration V3: Element Collection Tables for Works and Teams
-- PostgreSQL 16+
-- ==============================================================================

CREATE TABLE IF NOT EXISTS work_genres (
    work_id UUID NOT NULL REFERENCES works (id) ON DELETE CASCADE,
    genre VARCHAR(255) NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_work_genres_work_id ON work_genres (work_id);

CREATE TABLE IF NOT EXISTS member_roles (
    member_id UUID NOT NULL REFERENCES team_members (id) ON DELETE CASCADE,
    role VARCHAR(50) NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_member_roles_member_id ON member_roles (member_id);
```

#### 2. Ensure `V1__init_schema.sql` and `V2__identity_and_subscriptions.sql` Completeness
- Verify all column names, types, nullability, unique constraints, and foreign keys in `V1` and `V2` match all 11 JPA entity fields.

#### 3. Update Integration Test: `FlywaySchemaValidationTest`
- Ensure tests in `readora-infrastructure` execute Flyway migrations against an in-memory/Postgres container database with `spring.jpa.hibernate.ddl-auto=validate` to verify all migrations (V1, V2, V3) apply and validate cleanly.

### Data Models / Contracts
- `work_genres`:
  - `work_id` UUID NOT NULL (FK to `works.id` ON DELETE CASCADE)
  - `genre` VARCHAR(255) NOT NULL
- `member_roles`:
  - `member_id` UUID NOT NULL (FK to `team_members.id` ON DELETE CASCADE)
  - `role` VARCHAR(50) NOT NULL

### File Structure
- Added:
  - `backend/readora-infrastructure/src/main/resources/db/migration/V3__element_collection_tables.sql`
- Modified:
  - `backend/readora-infrastructure/src/main/resources/db/migration/V1__init_schema.sql`
  - `backend/readora-infrastructure/src/test/java/com/readora/infrastructure/persistence/FlywaySchemaValidationTest.java`

### Risks
- None. Idempotent DDL ensures safe execution across all database states.

# Testing

### Validation Approach
- Execute `FlywaySchemaValidationTest` in `readora-infrastructure` with `spring.jpa.hibernate.ddl-auto: validate` to verify all tables and element collections validate successfully against Hibernate SessionFactory.
- Execute all unit, integration, architecture, and acceptance test suites (`CatalogControllerIntegrationTest`, `ChapterReadingControllerIntegrationTest`, `AuthControllerIntegrationTest`, `SecurityRulesIntegrationTest`, `BookmarkControllerIntegrationTest`, `SubscriptionWebhookIntegrationTest`, `CucumberAcceptanceTest`, `HexagonalArchitectureArchTest`).

### Key Scenarios
1. **Startup with Hibernate Validation**:
   - `readora-platform` starts without `SchemaManagementException` or missing table errors for `work_genres`, `member_roles`, or any other JPA entity.
2. **Work and Genre Persistence**:
   - Saving and loading `Work` with multiple genres persists into `work_genres` and loads via `WorkRepositoryAdapter`.
3. **Scanlation Team Member and Role Persistence**:
   - Saving and loading `ScanlationProject` with members having multiple roles persists into `member_roles` and loads via `ScanlationProjectRepositoryAdapter`.

### Edge Cases
- Cascading deletion of parent `Work` or `TeamMember` cascades to child tables.
- Entities with empty collections persist and load without null pointer or mapping errors.

# Delivery Steps

### ✓ Step 1: Add forward Flyway migration V3 for collection tables
Create `V3__element_collection_tables.sql` to ensure existing databases apply missing element collection tables.

- Add `backend/readora-infrastructure/src/main/resources/db/migration/V3__element_collection_tables.sql`.
- Define `CREATE TABLE IF NOT EXISTS work_genres` and `CREATE INDEX IF NOT EXISTS idx_work_genres_work_id`.
- Define `CREATE TABLE IF NOT EXISTS member_roles` and `CREATE INDEX IF NOT EXISTS idx_member_roles_member_id`.

### ✓ Step 2: Validate Hibernate schema validation and run all test suites
Verify all 11 JPA entities pass Hibernate schema validation and all unit, integration, and acceptance tests pass.

- Run `FlywaySchemaValidationTest` with `spring.jpa.hibernate.ddl-auto=validate` across all migrations (V1, V2, V3).
- Execute full test suites across `readora-infrastructure`, `readora-web`, `readora-domain`, and `readora-acceptance`.