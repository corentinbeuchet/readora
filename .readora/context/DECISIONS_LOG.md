# Architectural Decision Records (ADR)

This log records significant architectural choices, context, rationales, and consequences.

---

## ADR-001: Multi-Module Maven Hexagonal Architecture
- **Status**: Accepted
- **Date**: 2026-09-13
- **Context**: The backend requires high longevity, domain rule isolation, and clear separation between business logic and framework dependencies.
- **Decision**: Split backend into 4 distinct Maven modules: `readora-domain`, `readora-application`, `readora-infrastructure`, and `readora-web` (a fifth, test-only `readora-acceptance` module was added later — see ADR-007).
- **Consequences**:
  - `readora-domain` is guaranteed 100% pure Java without Spring/JPA dependencies.
  - Compile-time dependency boundaries prevent accidental leakage.
  - Enforced via ArchUnit regression tests in `readora-web`.

---

## ADR-002: Angular 22 Standalone Architecture with Signals (zoneless)
- **Status**: Accepted (updated from Angular 19 to Angular 22)
- **Date**: 2026-09-13
- **Context**: The reader chapter viewer and scanlation task board require low memory overhead, reactive performance, and modern forward-compatible APIs.
- **Decision**: Adopt Angular 22 with standalone components, signal inputs/outputs, fine-grained computed state and the default zoneless change detection; build with `@angular/build` on TypeScript 6.
- **Consequences**:
  - Zone.js is removed entirely (`zone.js`, `polyfills.ts`, `provideZoneChangeDetection` dropped).
  - Direct compatibility with future Angular major releases.
  - Clean separation into feature slices.

---

## ADR-003: Playwright for Frontend UI and Cross-Role E2E Testing
- **Status**: Accepted
- **Date**: 2026-09-13
- **Context**: Collaborative scanlation workflows involve multiple roles (e.g., Cleaner and Translator) interacting simultaneously.
- **Decision**: Use Playwright for End-to-End browser automation paired with Angular TestBed component tests for fast headless unit/component testing (runner: Vitest, see ADR-008).
- **Consequences**:
  - Native multi-browser context testing allows simulating multi-user collaboration in a single test script.
  - Substantially faster CI execution and lower memory footprint compared to Cypress.
  - Fast component unit tests run without booting the full application.

---

## ADR-004: Cucumber-JVM Acceptance Testing Wired to User Stories
- **Status**: Accepted
- **Date**: 2026-09-13
- **Context**: Business rules and state machines must remain verified across iterations without regression.
- **Decision**: Integrate Cucumber-JVM acceptance tests directly mapped to `.readora/context/user-stories/*.feature` files.
- **Consequences**:
  - User story specifications serve as executable living documentation.
  - Clear traceability between business requirements and domain use cases.
  - Hosting of the suite moved to a dedicated module (ADR-007).

---

## ADR-005: PostgreSQL Relational Core + S3/CloudFront Media Delivery
- **Status**: Accepted
- **Date**: 2026-09-13
- **Context**: High-concurrency reader access, complex role-based workflow ACLs, and heavy scan image assets.
- **Decision**: Use PostgreSQL 16+ for relational entities and comment trees, combined with Amazon S3 and CloudFront CDN for scan assets.
- **Consequences**:
  - Preserves ACID transaction guarantees for workflow state transitions.
  - Offloads heavy image streaming from backend compute nodes to CDN edge locations.

---

## ADR-006: Spring Boot 4.1 / Java 25 LTS Baseline
- **Status**: Accepted
- **Date**: 2026-09-13
- **Context**: Spring Boot 3.x is approaching end of OSS support and Java 25 is the current LTS. The platform should start on a GA baseline rather than migrate later.
- **Decision**: Build all Maven modules with `spring-boot-starter-parent:4.1.1` and `maven.compiler.release=25`; adopt the Boot 4 modular starters (`spring-boot-starter-webmvc`, `spring-boot-starter-webmvc-test`, `spring-boot-starter-data-jpa-test`, `spring-boot-starter-flyway`), Testcontainers 2 artifact names, springdoc 3, JUnit 6. Docker images use `eclipse-temurin:25-*-alpine` with generational ZGC (`-XX:+UseZGC`).
- **Consequences**:
  - Package relocations applied (`org.springframework.boot.persistence.autoconfigure.EntityScan`, `org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc`).
  - Plugin versions are inherited from the Boot parent (no local `maven-compiler-plugin`/`surefire` pins).
  - CI and App Runner runtimes target JDK 25.

---

## ADR-007: Dedicated `readora-acceptance` Module Reading Canonical User-Story Features
- **Status**: Accepted
- **Date**: 2026-09-13
- **Context**: The Cucumber runner and step definitions lived inside `readora-web` and executed byte-identical copies of the `.readora/context/user-stories/*.feature` files; the runner name did not match Surefire defaults and a full Spring context was booted for nothing.
- **Decision**: Create a lightweight, Spring-free `backend/readora-acceptance` module (test-scoped dependencies on `readora-domain` and `readora-application` only). The module mounts `.readora/context/user-stories` as an additional Maven test resource under `features/`, so the canonical feature files are the single source of truth. The runner is `CucumberAcceptanceTest` (Surefire default pattern) with glue `com.readora.acceptance.steps`.
- **Consequences**:
  - `readora-web` contains no Cucumber code, features or dependencies.
  - Acceptance scenarios run in ~1 s without a database or Spring context; they can be triggered independently (`mvn -pl readora-acceptance -am test`).
  - Surfacing the suite in the default build exposed a spec/domain mismatch: a cleaner's submission from `RAW_UPLOADED` now advances directly to `TRANSLATING` (the user story is the source of truth).
  - The Docker image builds only the deployable reactor slice (`mvn -pl readora-web -am`).

---

## ADR-008: Vitest Unit Runner and `frontend/tests` Layout
- **Status**: Accepted
- **Date**: 2026-09-13
- **Context**: Karma is deprecated and requires a headless Chrome in CI; colocated `*.spec.ts` files mixed tests with shipped code in `src/`.
- **Decision**: Use `@angular/build:unit-test` with Vitest + jsdom. Move unit specs to `frontend/tests/unit/**` (mirroring `src/app/features/**`) and Playwright specs to `frontend/tests/e2e/`. Specs import production code through the `@app/*` TypeScript path alias; `tsconfig.app.json` excludes `tests/**`.
- **Consequences**:
  - `npm run test:ci` runs in Node without a browser; Jasmine-only matchers were replaced by Jest-style equivalents (`toBe(true)`).
  - `src/` contains only production code; `package-lock.json` is committed so `npm ci` works in CI.
  - The unit-test builder resolves `include` globs relative to `sourceRoot`, hence `../tests/unit/**/*.spec.ts` in `angular.json`.
