# Backend conventions (Spring Boot 4.1 / Java 25, hexagonal DDD)

## Layering (enforced by `readora-web/src/test/java/com/readora/web/arch/HexagonalArchitectureArchTest.java`)
- `readora-domain`: plain Java only. No Spring, JPA, Jackson, validation annotations.
- `readora-application`: plain Java + domain + slf4j. Services are **not** Spring components; they are wired as
  `@Bean`s in `infrastructure/config/DomainServiceConfig.java` with constructor `Objects.requireNonNull(x, "XPort cannot be null")`.
- Controllers call **only** `port.in` use cases. Never inject a `port.out` port or an `infrastructure` class into `web`
  (existing violations: `StorageController`, `SubscriptionController`, `SecurityProperties`/`JwtTokenProviderAdapter` imports — fix, don't copy).
- In-ports never expose out-port types; define the use case's own records.
- Shared-kernel types (e.g. `UserId`) belong in `domain.common`, not in a bounded context package.

## Domain
- Value objects are `record`s that validate **and normalise** in the compact constructor (model: `domain/identity/Email.java`).
- Typed IDs with `fromString` that wraps parse errors into `DomainValidationException` (model: `domain/work/WorkId.java`).
- Aggregates extend `AggregateRoot`; create them via intent-named factories (`UserAccount.register`, `Chapter.createPublished`,
  `ChapterComment.createReply`) that `registerEvent(...)`. Events are records with a `now(...)` factory.
- Every state transition guards its preconditions (current stage/status, assignee, already-published). No silent re-transitions.
- Child entities expose no public mutators; all changes go through the aggregate root. Return unmodifiable/copy collections.
- Permissions are derived in the domain (`Role`/`SubscriptionPlan` permission sets → `UserAccount.effectivePermissions()`).
- Secrets never print: override `toString` (model: `PasswordHash` → `"PasswordHash[****]"`).
- Inject time (`Clock`) for time-based rules instead of `Instant.now()` in new code.

## Application services
- **Events:** `aggregate.pollDomainEvents()` on the aggregate you mutated, **never** on the object returned by `repository.save(...)`
  (adapters rebuild it via `toDomain`, so it has no events).
- A use case that writes more than once runs in a single transaction (transactional decorator in `DomainServiceConfig`,
  keeping the application layer Spring-free). External calls (Stripe) happen after/outside the DB write, idempotently.
- Every write on a resource checks ownership/membership, not just the global permission (e.g. publisher must belong to the work's project).
- Not-found is a dedicated not-found exception → 404. Don't use `DomainValidationException` (400) for missing entities.
- Use-case signatures take value objects (`ChapterNumber`, `WorkId`), not raw strings. Validation lives in the domain; web only
  pre-validates shape.

## Naming
`port.in.*UseCase` · `port.out.*RepositoryPort` / `*Port` · `infrastructure...adapter.*RepositoryAdapter` ·
`SpringData*Repository` · `*JpaEntity` · adapter maps with private `toDomain` / `toEntity` and updates child collections
in place to keep row identity (model: `ChapterRepositoryAdapter`). No `default` no-op methods on out-ports.

## Persistence
- Every schema change = new Flyway migration in `readora-infrastructure/src/main/resources/db/migration`. Never edit an applied one.
- Entity column lengths == DTO `@Size` limits == migration column sizes.
- Aggregate entities carry `@Version`. Ordered collections carry `@OrderBy` (pages, chapters).
- No "load everything then filter in memory"; write a query (`findByWorkIdAndStatus`). Prefer LAZY + fetch joins over EAGER.

## Web
- Requests: records with Bean Validation + messages (model: `dto/RegisterRequest.java`). Validate nested lists with `@Valid`.
- Responses: records with `static fromDomain(...)`, wrapped in `ApiResponse.ok(...)`. Creates return 201.
- Actor always from `currentUserProvider.require()`. `@PreAuthorize` with a specific permission on every mutating endpoint;
  the service re-checks fresh permissions where it matters (model: `BookmarkService`).
- `GlobalExceptionHandler`: never put `ex.getMessage()` of unexpected exceptions in the response; map framework exceptions
  (unreadable body, type mismatch, no resource, size exceeded, data integrity) to 4xx.
- Storage keys/paths are built by the server, never taken raw from the client; reject `..`.

## Integrations
- Vendor SDK types never leave infrastructure — translate to the port's records (model: `StripePaymentAdapter` → `PaymentEvent`).
- Fail closed: unknown status/price/plan → reject or ignore with a WARN log, never grant access.
- Webhooks: idempotent and order-safe (compare event timestamps, not just the last event id).

## Config
- `@ConfigurationProperties` records (model: `SecurityProperties`), not `@Value`. Never a `@DefaultValue` on a secret.
- Profile file names must match the profile: `application-{profile}.yml` with matching `on-profile`.

## Documentation comments (Java 23+ Markdown, JEP 467)
- Write doc comments as `///` Markdown lines, never `/** */`. Every line of the comment starts with `///`,
  including blank separator lines (a truly empty line ends the comment).
- Code in backticks (not `{@code}`); links as `[Type]`, `[Type#method(int)]`, `[#field]`, or `[label][Type]`
  (not `{@link}`/`{@linkplain}`); escape array brackets: `[String#valueOf(char\[\])]`.
- Block tags unchanged: `@param`, `@return`, `@throws`, `@see`, `{@inheritDoc}`; tables are GitHub pipe tables.
- Document *why* and contracts (preconditions, thrown exceptions), not what the code obviously does.
  Plain `//` stays for implementation notes inside method bodies.
- Checkstyle javadoc checks don't understand `///` yet — don't add them. IntelliJ: inspection
  "Javadoc comment can be Markdown documentation comment" converts old ones.
  ```java
  /// Returns the chapter with the given id.
  ///
  /// @param id the chapter id, never `null`
  /// @throws NotFoundException if no chapter matches; see [ChapterRepositoryPort#findById(ChapterId)]
  ```

## Tests
- `@DisplayName("Full sentence describing behaviour")` + camelCase method name.
- Web integration tests go through real HTTP and real auth (`AuthTestSupport`); assert JSON error bodies and status codes.
- Fakes must behave like real adapters: `save` returns a **new** instance (otherwise event bugs are hidden).
- Every state transition and authorization rule gets a test, including the negative case (wrong stage, wrong user, wrong role).
- Schema/entity alignment must be tested with Flyway enabled (Testcontainers Postgres preferred).

## Known pitfalls found in review (2026-09) — don't reintroduce
Backlog ids used in commit `Refs:` (status: `git log --grep "review-2026-09/B<n>"`).
- B1 `application-prod.yml` guarded by `on-profile: production` → never loaded; dev JWT secret default in `application.yml`. — fixed 61ef652
- B2 `/storage/presigned-url` lets any authenticated user choose bucket, key and duration.
- B3 Direct publish without project-membership check (IDOR).
- B4 Publish-from-QC without `stage == QC_REVIEW` guard; `Chapter.publish` re-publishable.
- B5 `saved.pollDomainEvents()` in `ScanlationTaskService` / `ReaderSocialService` drops events.
- B6 No transactions across multi-save use cases.
- B7 No `@Version`; `WorkflowTask.assignTo` steals claimed tasks; unlimited upvotes.
- B8 Stripe: null `currentPeriodEnd` = infinite access; unknown status → ACTIVE; any price → PREMIUM; out-of-order events; immediate cancel.
- B9 `S3StorageAdapter` unbounded in-memory `byte[]` cache; S3 failure swallowed; no multipart size config; fake presigned URL fallback. (`..` in folder fixed with B2.)
- B10 500 handler leaks `ex.getMessage()`; framework exceptions → 500; not-found → 400; DTO sizes ≠ DB sizes.
- B11 EAGER collections + load-all-then-filter (N+1); no `@OrderBy` on pages/chapters.
- B12 Refresh-token reuse undetected; no expired-token cleanup; no issuer check; no rate limit; Swagger public in prod.
- B13 Layer leaks: controllers → out-ports, web → infrastructure, `UserId` in `domain.work`; missing ArchUnit rules.
- B14 Tests: web tests skip Flyway; fakes return same instance; CI runs `mvn test` not `verify`.
