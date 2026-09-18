# Backend conventions (Spring Boot 4.1 / Java 25, hexagonal DDD)

## Layering (enforced by `readora-web/src/test/java/com/readora/web/arch/HexagonalArchitectureArchTest.java`)
- `readora-domain`: plain Java only. No Spring, JPA, Jackson, validation annotations.
- `readora-application`: plain Java + domain + slf4j. Services are **not** Spring components; they are wired as
  `@Bean`s in `infrastructure/config/DomainServiceConfig.java` with constructor `Objects.requireNonNull(x, "XPort cannot be null")`.
- Controllers call **only** `port.in` use cases. `web` never depends on `port.out`, `application.service` or
  `infrastructure` (ArchUnit-enforced). Exceptions adapters throw and web maps live in `application.exception`;
  JWT claim names in `application.auth.TokenClaims`.
- In-ports never expose out-port types; define the use case's own records (e.g. `ManageSubscriptionUseCase.CheckoutRedirect`).
- Shared-kernel types live in `domain.common` (`UserId`, `NotFoundException`, `ConcurrentModificationDomainException`).
- ArchUnit also enforces: `port.in` = interfaces named `*UseCase`, `port.out` = interfaces named `*Port`,
  `@Entity` classes are `*JpaEntity` in `infrastructure.persistence.entity`, `*Adapter` implements an out-port,
  no cycles between domain/application/infrastructure/web, no Jackson/validation in the domain.

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
- Every `port.in` bean that touches persistence is wrapped with `UseCaseTransactions.transactional(...)` in
  `DomainServiceConfig`, so each use-case call is one transaction (application layer stays Spring-free). Register new
  use cases the same way; pure I/O use cases (e.g. `ManageAssetsUseCase`) are not wrapped so they don't hold a DB
  connection. `InvalidCredentialsException` commits (security side effects stick).
  Validate/mutate all aggregates in memory before the first save. External calls (Stripe) must be idempotent.
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
- Aggregate entities carry `@Version`. Adapters call `OptimisticLocking.verify(...)` before copying state, save with
  `OptimisticLocking.flush(..., saveAndFlush)` and `restoreVersion` after; conflicts surface as
  `ConcurrentModificationDomainException` → 409.
  Ordered collections carry `@OrderBy` (pages, chapters).
- Every association declares `fetch = FetchType.LAZY` explicitly (`@ManyToOne`/`@OneToOne` default to EAGER); load what
  a use case needs with `JOIN FETCH` or an entity graph. Keep `spring.jpa.open-in-view=false`.
- `@Transactional` at the use-case boundary (see Application services), `readOnly = true` for queries; never on controllers.
- No "load everything then filter in memory"; write a query (`findByWorkIdAndStatus`). Hot queries get a statement-count
  assertion in tests (Hibernate statistics or datasource-proxy) to catch N+1.

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
  infrastructure adapters calling S3/Stripe — never retry inside a DB transaction; only retry idempotent calls.
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
- Web integration tests go through real HTTP and real auth (`AuthTestSupport`); assert JSON error bodies and status codes.
- Fakes must behave like real adapters: `save` returns a **new** instance (otherwise event bugs are hidden).
- Every state transition and authorization rule gets a test, including the negative case (wrong stage, wrong user, wrong role).
- Schema/entity alignment must be tested with Flyway enabled: Testcontainers 2
  (`org.testcontainers.postgresql.PostgreSQLContainer`) + `@ServiceConnection`.
- Boot 4 test APIs: `@MockitoBean` / `@MockitoSpyBean` (never `@MockBean`), `@AutoConfigureMockMvc` explicitly,
  `MockMvcTester` or `RestTestClient` for new web tests.

## Known pitfalls found in review (2026-09) — don't reintroduce
Backlog ids used in commit `Refs:` (status: `git log --grep "review-2026-09/B<n>"`).
- B1 `application-prod.yml` guarded by `on-profile: production` → never loaded; dev JWT secret default in `application.yml`. — fixed 61ef652
- B2 `/storage/presigned-url` lets any authenticated user choose bucket, key and duration. — fixed 9ffff17
- B3 Direct publish without project-membership check (IDOR). — fixed 90afc6f
- B4 Publish-from-QC without `stage == QC_REVIEW` guard; `Chapter.publish` re-publishable. — fixed ee8a113
- B5 `saved.pollDomainEvents()` in `ScanlationTaskService` / `ReaderSocialService` drops events. — fixed 84acc60
- B6 No transactions across multi-save use cases. — fixed e7b4580
- B7 No `@Version`; `WorkflowTask.assignTo` steals claimed tasks; unlimited upvotes. — fixed 83a6779, c64ad65, 8b9bd25
- B8 Stripe: null `currentPeriodEnd` = infinite access; unknown status → ACTIVE; any price → PREMIUM; out-of-order events; immediate cancel. — fixed 1fd811c
- B9 `S3StorageAdapter` unbounded in-memory `byte[]` cache; S3 failure swallowed; no multipart size config; fake presigned URL fallback. (`..` in folder fixed with B2.) — fixed 9ffff17, c35ca1d, da891b6
- B10 500 handler leaks `ex.getMessage()`; framework exceptions → 500; not-found → 400; DTO sizes ≠ DB sizes. — fixed 14401f9, 6f1cf72, 9b2db4f, da891b6
- B11 EAGER collections + load-all-then-filter (N+1); no `@OrderBy` on pages/chapters. — fixed 3d96ef9, aa996ec
- B12 Refresh-token reuse undetected; no expired-token cleanup; no issuer check; no rate limit; Swagger public in prod. — fixed 86a6e53
- B13 Layer leaks: controllers → out-ports, web → infrastructure, `UserId` in `domain.work`; missing ArchUnit rules. — fixed ea6cb29, e893751
- B14 Tests: web tests skip Flyway; fakes return same instance; CI runs `mvn test` not `verify`. — fixed d6f3f7b

Improvements from best-practice research (2026-09), not bugs:
- B15 Virtual threads: `spring.threads.virtual.enabled=true`, sized against the Hikari pool; `@ConcurrencyLimit` on scarce resources. — fixed 3df5fcb
- B16 Observability: `spring-boot-starter-opentelemetry` (OTLP metrics + traces). — fixed 6119e06
- B17 JSpecify `@NullMarked` + NullAway (Error Prone) build check, module by module starting with `readora-domain`. — fixed e3815c8, 6ced143, 030a0b0 (all modules; entities @NullUnmarked by design)
- B18 Optional: Spring Framework 7 API versioning (`spring.mvc.apiversion.*`) if `/api/v1` needs a successor. — not done: /api/v1 is the only version so far; adopt when a v2 is actually needed.

Open (needs a product decision):
- B19 Scanlation drafts/QC publish invent page keys `scans/{work}/{n}/p{i}.webp` that match no uploaded file; tasks only
  carry one asset-package URL. Decide how final pages are produced (unpack the QC package into page assets, or
  require a page upload step) before publishing through the scanlation workflow in production.
