# Backend conventions (Spring Boot 4.1 / Java 25, hexagonal DDD)

## Layering (enforced by `readora-web/src/test/java/com/readora/web/arch/HexagonalArchitectureArchTest.java`)
- `readora-domain`: plain Java only. No Spring, JPA, Jackson, validation annotations.
- `readora-application`: plain Java + domain + slf4j. Services are **not** Spring components; they are wired as
  `@Bean`s in `infrastructure/config/DomainServiceConfig.java` with constructor `Objects.requireNonNull(x, "XPort cannot be null")`.
- Controllers call **only** `port.in` use cases. `web` never depends on `port.out`, `application.service` or
  `infrastructure` (ArchUnit-enforced). Exceptions adapters throw and web maps live in `application.exception`;
  JWT claim names in `application.auth.TokenClaims`.
- In-ports never expose out-port types; define the use case's own records (e.g. `ManageTeamUseCase.MyTeam` / `Board`).
- Shared-kernel types live in `domain.common` (`UserId`, `NotFoundException`, `ConcurrentModificationDomainException`).
- ArchUnit also enforces: `port.in` = interfaces named `*UseCase`, `port.out` = interfaces named `*Port`,
  `@Entity` classes are `*JpaEntity` in `infrastructure.persistence.entity`, `*Adapter` implements an out-port,
  no cycles between domain/application/infrastructure/web, no Jackson/validation in the domain.

## Domain
- Value objects are `record`s that validate **and normalise** in the compact constructor (model: `domain/identity/Email.java`).
- Typed IDs with `fromString` that wraps parse errors into `DomainValidationException` (model: `domain/work/WorkId.java`).
- Aggregates extend `AggregateRoot`; create them via intent-named factories (`UserAccount.register`, `Chapter.createPublished`,
  `ChapterComment.createReply`), which `registerEvent(...)` when something reacts to them. Events are records with a
  `now(...)` factory, and an event exists only once a listener consumes it (today `ChapterPublishedEvent`,
  `CommentPostedEvent`, `TeamInvitedEvent`, `TaskStageAdvancedEvent`, `ChapterSentBackEvent`): add it together with its
  listener.
- Every state transition guards its preconditions (current stage/status, assignee, already-published). No silent re-transitions.
- Child entities expose no public mutators; all changes go through the aggregate root. Return unmodifiable/copy collections.
- Permissions are derived in the domain (`Role` permission sets → `UserAccount.effectivePermissions()`).
- Secrets never print: override `toString` (model: `PasswordHash` → `"PasswordHash[****]"`).
- Inject time (`Clock`) for time-based rules instead of `Instant.now()` in new code.

## Application services
- **Events:** `aggregate.pollDomainEvents()` on the aggregate you mutated, **never** on the object returned by `repository.save(...)`
  (adapters rebuild it via `toDomain`, so it has no events).
  Side effects listen in infrastructure with `@TransactionalEventListener(phase = AFTER_COMMIT, fallbackExecution = true)`
  (model: `infrastructure/event/NotificationEventListener`), so rolled-back use cases never trigger them. The listener
  calls a `port.in` use case inside a **new** transaction (`TransactionTemplate` with `PROPAGATION_REQUIRES_NEW`):
  after commit, a plain `REQUIRED` joins the finished transaction and its writes are never committed. It catches and
  logs failures at WARN; a failed side effect never fails the publisher.
- Don't keep speculative code: no unused ports/methods/marker types. Out-ports have no no-op `default` methods; the
  exception is a `default` that derives from other port methods (e.g. `ChapterRepositoryPort.findPublishedByWorkId`).
- Every `port.in` bean that touches persistence is wrapped with `UseCaseTransactions.transactional(...)` in
  `DomainServiceConfig`, so each use-case call is one transaction (application layer stays Spring-free). Register new
  use cases the same way; pure I/O use cases (e.g. `ManageAssetsUseCase`) are not wrapped so they don't hold a DB
  connection. `InvalidCredentialsException` commits (security side effects stick).
  A use-case method that only reads is marked `@ReadOnly` (`port.in.ReadOnly`) and runs read-only: no flush, no
  dirty-checking snapshots, and PostgreSQL refuses writes. Never mark a method that saves anything, even on one path.
  Validate/mutate all aggregates in memory before the first save. External calls (S3) must be idempotent.
- Every write on a resource checks ownership/membership, not just the global permission (e.g. publisher must belong to the work's project).
  Membership lives on the `Team` (one roster, roles valid for all its series), never on the `ScanlationProject` (a
  team's task board for one series): load the project's team and check there (model: `ScanlationProject.requireMember`,
  `TeamManagementService.requireLeaderOrAdmin`). Several teams may have a project on the same work.
  A reader joins a team only by accepting a leader's `TeamInvitation` (nobody lands in a team without agreeing);
  `PUT /teams/{id}/members/{username}` changes the roles of an existing member (`NOT_ON_TEAM` otherwise).
  The task board of a team's series is optional (`ScanlationProject.boardEnabled`): off for a series added from now
  on, switched by a leader; a new task needs it on (`BOARD_OFF`), tasks already on it can still be finished.
  A task carries real uploaded pages (`WorkflowTask.pages`: the raw pages, then what each stage submits, which
  replaces them); QC publishes exactly those pages (`TASK_HAS_NO_PAGES` when there are none). Never build page keys
  from a chapter number.
  A team's first chapter waits for a moderator (US-11): every publishing path goes through `ChapterRelease.release`
  (direct publish and QC), which queues it as `PENDING_REVIEW` while the team has no published chapter, unless the
  publisher can moderate. Readers only ever query `PUBLISHED`; `ChapterReviewService` approves (readers are told) or
  sends it back as a `DRAFT` that the team publishes again (its leaders are told).
  A chapter belongs to a team (`Chapter.teamId`, never null): whoever publishes names the team in the request, and
  the service checks both that the actor may publish for that team and that the team works on the series
  (`TEAM_NOT_ON_SERIES`). A payload that shows a chapter carries its `TeamCredit` (id + name).
- A series has no owner: several teams may translate it, but it comes in through one: a new series names a team its
  creator leads, which gets its task board (`TEAM_REQUIRED` otherwise; only an admin may add a series without a team). Its description (`Work.describe`, `PUT /works/{id}`, which
  replaces the whole description, facts included) is edited by a leader of any team that has a project on it, or an
  admin (`WorkManagementService.requireSeriesLeaderOrAdmin`). The optional facts
  are the value object `WorkFacts` (other titles, artist, year, original language, content rating): `null` or no
  title means "not filled in", never a default.
- A chapter number may exist in several teams' versions (unique per `(work, number, team)`). Anything about "the
  chapters of a series" goes through `domain.work.ReadingOrder`: progress, "N new", notifications and profile counts
  follow the **number** (any version read = chapter read; only the first version published is news), next/previous
  stay with the team being read (`pick(number, team)`), and a lookup by number always names the team. Never assume
  one row per number, in SQL or in a fake.
- Not-found is a dedicated not-found exception → 404. Don't use `DomainValidationException` (400) for missing entities.
- Use-case signatures take value objects (`ChapterNumber`, `WorkId`), not raw strings. Validation lives in the domain; web only
  pre-validates shape.

## Naming
`port.in.*UseCase` · `port.out.*RepositoryPort` / `*Port` · `infrastructure...adapter.*RepositoryAdapter` ·
`SpringData*Repository` · `*JpaEntity` · adapter maps with private `toDomain` / `toEntity` and updates child collections
in place to keep row identity (model: `ChapterRepositoryAdapter`). No `default` no-op methods on out-ports.

## Persistence
- Every schema change = new Flyway migration in `readora-infrastructure/src/main/resources/db/migration`. Never edit an applied one.
  Migrations also run on H2 (PostgreSQL mode) in tests: name every constraint you create, don't drop a constraint by
  its generated name (they differ per database: rebuild the table instead, model `V17__teams.sql`), and no expression
  indexes (model: `teams.name_key` in `V18`). What only PostgreSQL has (extensions, trigram or expression indexes)
  goes in a Java migration in `db.migration` that does nothing on other databases (model: `V32__search_trigram_indexes`).
  A migration that moves data gets a Testcontainers test that migrates to the previous version, inserts rows, then
  migrates (model: `TeamsMigrationTest`).
- `teams.id` equals the old project id for every team that existed before V17 (links and follows kept working);
  teams and projects created since have unrelated ids. `TeamId` and `ProjectId` are never interchangeable in code.
- Entity column lengths == DTO `@Size` limits == migration column sizes.
- Aggregate entities carry `@Version`. Adapters call `OptimisticLocking.verify(...)` before copying state, save with
  `OptimisticLocking.flush(..., saveAndFlush)` and `restoreVersion` after; conflicts surface as
  `ConcurrentModificationDomainException` → 409.
  Ordered collections carry `@OrderBy` (pages, chapters).
- Every association declares `fetch = FetchType.LAZY` explicitly (`@ManyToOne`/`@OneToOne` default to EAGER); load what
  a use case needs with `JOIN FETCH` or an entity graph. Keep `spring.jpa.open-in-view=false`.
- Transactions at the use-case boundary (see Application services; queries `@ReadOnly`) and `readOnly = true` on
  adapter query methods; never on controllers.
- Caches (`CacheConfig`, Caffeine per instance, `spring.cache.*`) only for read models that may be minutes old
  (rankings: `DiscoveryQueryAdapter.POPULAR_WORKS_CACHE`, 5 minutes); the caller rounds time arguments so requests share
  entries. Tests run with `spring.cache.type: none`; each cache has its own test (model: `RankingsCacheTest`).
- No "load everything then filter in memory"; write a query (`findByWorkIdAndStatus`). Hot queries get a statement-count
  assertion in tests (Hibernate statistics or datasource-proxy) to catch N+1.

## Web
- Requests: records with Bean Validation + messages (model: `dto/RegisterRequest.java`). Validate list elements with `List<@Valid Item>` (`@Valid` on the
  container is deprecated in Hibernate Validator 9).
- Responses: records with `static fromDomain(...)`, wrapped in `ApiResponse.ok(...)`. Creates return 201.
- Errors carry a stable code (US-13): `ApiResponse.error(code, message)`, codes in `domain.common.ErrorCodes`. Domain
  exceptions implement `CodedException`; a rule a reader can break through the UI uses
  `DomainValidationException.withCode(ErrorCodes.X, "…")` (backstop checks keep `VALIDATION_FAILED`). The message
  stays English for logs; the frontend translates by code (`core/api/error-messages.ts`), so add the text there too.
  Never rename a published code.
- Actor always from `currentUserProvider.require()`. `@PreAuthorize` with a specific permission on every mutating endpoint;
  the service re-checks fresh permissions where it matters (model: `BookmarkService`).
- `GlobalExceptionHandler`: never put `ex.getMessage()` of unexpected exceptions in the response; map framework exceptions
  (unreadable body, type mismatch, no resource, size exceeded, data integrity) to 4xx.
- Storage keys/paths are built by the server, never taken raw from the client; reject `..`.
- Public reads are `permitAll` GET matchers in `SecurityConfig`. When a public prefix has a private sub-path
  (`/api/v1/lists/mine` under `/api/v1/lists/*`), declare its `authenticated()` matcher **first**, or anonymous
  callers get 403 instead of 401.
- Jackson 3 rejects a request missing a **primitive** component (`boolean`, `int`) with 400. Use a primitive only for
  fields the client must always send; optional flags are `@Nullable Boolean` with a default in the controller.

## Integrations
- Email goes through `MailPort` (`SmtpMailAdapter`, `spring.mail.*`): Mailpit in dev, the Amazon SES SMTP interface in
  production (`READORA_MAIL_HOST/USERNAME/PASSWORD/FROM`, no defaults there). A failed delivery is logged, never thrown,
  and mail is left out of the health check: a caller must answer the same whether an email went out, and an SMTP outage
  must not restart the app. Anything that says whether an address has an account (reset links) answers the same both ways.
- An admin suspends (until a date) or bans an account (US-16, `AccountStanding`): login refuses it with
  `ACCOUNT_SUSPENDED`/`ACCOUNT_BANNED` (only after the password matched), its refresh tokens are deleted, and
  `AccountStandingFilter` (in the security chain, after the bearer token) refuses its *writes* on every request, as it
  does for a deleted account (`ACCOUNT_CLOSED`): an access token outlives those decisions by up to its lifetime.
  An admin never administers their own account (`SELF_ADMINISTRATION`).
- A deleted account (US-15) keeps its `users` row under a `deleted_…` placeholder (`UserAccount.erase`, `deleted_at`):
  comments and reviews keep an author. What only the reader had is deleted by `ReaderDataErasureAdapter`: a new table
  keyed by a reader's id goes on its `READER_ROWS` list in the same commit, or it outlives the account (reports and
  ratings stay on purpose: moderation records, and reviews that keep an author). Queries that
  show readers (public profile, reader search) skip deleted accounts.
- Ending sessions for security (password change or reset) *deletes* the refresh tokens (`deleteAllForUser`): a
  revoked token presented later than the reuse grace is treated as theft and would sign the reader out everywhere.
- Payments and Premium were removed on 2026-09-23 (Stripe checkout, cancel, webhooks, then the plans themselves:
  bookmarks became `LIBRARY_USE`). V22 dropped the payment-only columns and V23 the `subscriptions` table; a payments
  feature adds its own schema back. Bring the flow back from git
  (`git log --oneline -- backend/readora-infrastructure/src/main/java/com/readora/infrastructure/payment`) and follow the
  webhook rules below.
- Vendor SDK types never leave infrastructure — translate to the port's types (model: `S3StorageAdapter`: S3 SDK types stay
  inside, `StoragePort` speaks keys, URLs and bytes).
- Fail closed: unknown status/price/plan → reject or ignore with a WARN log, never grant access.
- Webhooks: idempotent and order-safe (compare event timestamps, not just the last event id).

## Config
- `@ConfigurationProperties` records (model: `SecurityProperties`), not `@Value`. Never a `@DefaultValue` on a secret.
- Profile file names must match the profile: `application-{profile}.yml` with matching `on-profile`.

## Java 25 language (final features only)
- Records for value objects, commands, DTOs and events. Sealed interfaces + exhaustive pattern-matching `switch`
  (with record patterns) for domain results/errors instead of `instanceof` chains or boolean flags.
- `_` for unused lambda params / catch variables / pattern components (JEP 456).
- Sequenced collections: `list.getFirst()` / `getLast()` / `reversed()` instead of index arithmetic.
- Flexible constructor bodies (JEP 513): validate arguments before `super(...)` / `this(...)`.
- `ScopedValue` (final in 25) instead of `ThreadLocal` for per-request context.
- **No preview features** (no `--enable-preview`): structured concurrency, stable values / `LazyConstant`,
  primitive patterns. Don't use module imports or compact source files in application code.

## Spring Boot 4 / Framework 7 / Security 7
- Null safety: JSpecify `@NullMarked` in each package's `package-info.java`, `@Nullable` only where null is legal.
  Every main package is null-marked and **NullAway fails the build** on violations (Error Prone configured once in the
  parent pom). Every new package needs a `package-info.java` with `@NullMarked`. Only exception:
  `infrastructure.persistence.entity` is `@NullUnmarked` (Hibernate fills entities via no-arg constructors); adapters
  translate entities into null-checked domain objects. Request DTOs are bound by Jackson: validate with Bean
  Validation, and mark optional components `@Nullable`.
- Errors are RFC 9457 `ProblemDetail` (`spring.mvc.problemdetails.enabled=true`, off by default).
- Outbound HTTP: `RestClient` or `@HttpExchange` interfaces registered with `@ImportHttpServices`; never `RestTemplate`.
- Resilience from Framework 7 core: `@Retryable` / `@ConcurrencyLimit` (enable with `@EnableResilientMethods`) on
  infrastructure adapters calling S3 or another provider — never retry inside a DB transaction; only retry idempotent calls.
- Jackson 3 only (`tools.jackson.*` packages, `JsonMapper`); no `com.fasterxml.jackson.databind` imports.
- Security 7: lambda DSL only, `authorizeHttpRequests`, `PathPatternRequestMatcher`; no `.and()`, no Ant/MVC matchers.
- Starters are modular: every technology needs its own `spring-boot-starter-*` (e.g. `spring-boot-starter-flyway`).
- Fix deprecation warnings when you see them: Boot 4.1 removed what 4.0 deprecated.

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
- User stories (`.readora/context/user-stories/*.feature`) run as Cucumber acceptance tests, filtered by
  `CucumberAcceptanceTest` with `not @wip and not @ui`. `@wip` = not built yet (remove it when implementing);
  `@ui` = frontend-only behaviour, verified by a frontend Vitest test whose name is the scenario title.
  Step classes don't share state (no DI container): each feature's steps live in one class, with Background
  wording unique to that feature.
- Web integration tests go through real HTTP and real auth (`AuthTestSupport`); assert JSON error bodies and status codes.
- Fakes must behave like real adapters: `save` returns a **new** instance (otherwise event bugs are hidden).
- Every state transition and authorization rule gets a test, including the negative case (wrong stage, wrong user, wrong role).
- Schema/entity alignment must be tested with Flyway enabled: Testcontainers 2
  (`org.testcontainers.postgresql.PostgreSQLContainer`) + `@ServiceConnection`.
- Boot 4 test APIs: `@MockitoBean` / `@MockitoSpyBean` (never `@MockBean`), `@AutoConfigureMockMvc` explicitly,
  `MockMvcTester` or `RestTestClient` for new web tests.

## Open review items — don't reintroduce what was fixed
Backlog ids are used in commit `Refs:`. Fixed items were removed (2026-09-23): `git log --grep "review-2026-09/B<n>"`
or `git log --grep "review-2026-09-19/R<n>"` finds a fixed one; the rules above hold their lessons.

- B18 Optional: Spring Framework 7 API versioning (`spring.mvc.apiversion.*`) if `/api/v1` needs a successor. Not done:
  /api/v1 is the only version so far; adopt when a v2 is actually needed.

Whole-project review (2026-09-19, refs `review-2026-09-19/<n>`; "survey" = reported with path:line, re-check before acting):
- R13 `POST /storage/upload` is `isAuthenticated()` only (any reader, 50 MB); `AssetService` skips the content-type
  allow-list when the type is blank and allows `application/octet-stream`.
- Same sweep as R4 still to do (survey): uncoded reader-visible rules in `WorkManagementService`, `ReaderSocialService`.
- R19 (survey) Missing index `refresh_tokens(expires_at)`.
- R21/R22 (survey) Unbounded lists (chapter comments, work chapters, library list/export, bookmarks, `GET /teams/mine`).
  (The chapter list counts pages instead of loading them: `ChapterSummary`.) The chapter list has one item per team version: when it
  gets paginated, paginate by chapter number on the server, so the versions of a number never split across pages.
- R23/R24 (survey) Scanlation "not a member" answers 400 instead of 403; `ProfileController` PUT lacks `@PreAuthorize`.
- R27/R28 (survey) Several application services without unit tests; no graceful shutdown, structured logs or
  correlation id.

CI / deploy (same review; nothing here has ever run, the repository has no remote). Open, needs a decision: default JWT
secret and DB password still in `application.yml` (only `production` is guarded); deploys don't wait for App Runner
before the frontend prerender build; production deploy skips tests and runs from any ref; the JAR is built but never
shipped while `backend/Dockerfile` is unused by the deploy path; long-lived admin AWS keys instead of OIDC; no
Dependabot/CodeQL; no IaC; no `.gitattributes`, Maven wrapper, README.
