---
sessionId: session-260913-025755-c6ou
---

# Requirements

### Overview & Goals
Bring the Readora foundation up to the versions originally requested and fix two structural issues in how tests are organised:

1. **Backend**: Spring Boot `3.4.3` / Java 21 → **Spring Boot `4.1.1` / Java 25 LTS** across all Maven modules, Docker image and CI.
2. **Frontend**: Angular `19.1` → **Angular 22** (TypeScript 6, `@angular/build`, zoneless by default, Vitest as unit-test runner).
3. **Frontend tests in a dedicated folder**: all `*.spec.ts` files currently colocated under `frontend/src/app/**` move to `frontend/tests/unit/**`; Playwright specs move from `frontend/e2e/` to `frontend/tests/e2e/`.
4. **Cucumber BDD in its own Maven module**: the runner, step definitions and feature resources currently living in `backend/readora-web/src/test/java/com/readora/web/bdd` move to a new `backend/readora-acceptance` module that consumes the `.readora/context/user-stories/*.feature` files directly (no duplicated copies).
5. All docs (`AWS_DEPLOYMENT_GUIDE.md`, `.readora/context/*.md`, `.junie/plans/readora-platform-foundation.md`) and GitHub Actions workflows are updated so they no longer mention Java 21 / Angular 19 / Spring Boot 3.4.

### Scope
#### In Scope
- Maven parent + 4 module POMs upgraded to Boot 4.1.1 conventions (modular starters, renamed test starters, Testcontainers 2 artifact names, Flyway starter, springdoc 3.1.0, Cucumber 7.34.x, ArchUnit 1.5.0).
- Java source changes required by Boot 4 package relocations (`@EntityScan`, `@AutoConfigureMockMvc`).
- `backend/Dockerfile` on `eclipse-temurin:25` images, JVM flags valid on JDK 25.
- New `backend/readora-acceptance` module (lightweight, **no Spring context**, depends on `readora-domain` + `readora-application` only, per user decision).
- Angular 22 upgrade of `frontend/` including removal of `zone.js`, `@angular/animations`, `@angular/platform-browser-dynamic`, `@angular-devkit/build-angular`, Karma/Jasmine.
- Vitest + jsdom unit-test setup via `@angular/build:unit-test`; Jasmine-only matchers converted.
- `frontend/tests/unit/**` and `frontend/tests/e2e/**` layout with a `@app/*` path alias.
- `package-lock.json` generated so `npm ci` in CI actually works.
- CI workflows (`.github/workflows/*.yml`) switched to JDK 25 / Node 24 and to the new module & test commands.
- Documentation/ADR sync.

#### Out of Scope
- New product features or new user stories.
- Changing hexagonal architecture rules, domain model or REST API contracts.
- Adding a Maven Wrapper or changing the AWS topology.
- Migrating Jasmine tests to Vitest-specific APIs beyond what is needed to pass (`vi.*` fake timers etc.).

### User Stories
- As a **backend developer**, I want the project to build on JDK 25 with Spring Boot 4.1.1 so that we are on the current LTS/GA baseline and not on an EOL Boot 3.x line.
- As a **frontend developer**, I want Angular 22 with Vitest so that unit tests run fast in Node without a Chrome dependency and the code base follows current Angular defaults (zoneless, OnPush).
- As a **developer**, I want all frontend tests under `frontend/tests/` so that production source (`src/`) contains only shipped code.
- As a **QA / product owner**, I want the Cucumber acceptance suite in its own `readora-acceptance` module reading the canonical `.readora/context/user-stories/*.feature` files, so there is a single source of truth and BDD runs can be triggered independently of the web module.

### Functional Requirements / Acceptance Criteria
- `mvn -q -f backend/pom.xml clean verify` succeeds on JDK 25 with the Boot 4.1.1 parent; all modules compile with `--release 25`.
- `HexagonalArchitectureArchTest`, `*DomainTest` and `ChapterReadingControllerIntegrationTest` still pass.
- `mvn -f backend/pom.xml -pl readora-acceptance -am test` runs the 3 feature files (US-01/02/03) from `.readora/context/user-stories` and all scenarios pass; `backend/readora-web` contains no Cucumber code or feature copies.
- `npm run test:ci` in `frontend/` runs Vitest (jsdom) against `tests/unit/**/*.spec.ts` and passes; `npm run build:staging` succeeds with Angular 22 builders.
- `npx playwright test --list` resolves specs from `frontend/tests/e2e`.
- No remaining references to `Java 21`, `temurin:21`, `Angular 19`, `Spring Boot 3.4`, `@angular-devkit/build-angular`, `karma` in repo config or docs.

### Non-Functional Requirements
- Keep `readora-domain` free of any framework dependency (ArchUnit rule must still hold).
- Acceptance module must not start a Spring context (fast feedback, <10 s locally).
- Docker image remains multi-stage and rootless.

# Technical Design

### Current Implementation
| Area | Current state | Problem |
|---|---|---|
| `backend/pom.xml` | parent `spring-boot-starter-parent:3.4.3`, `java.version=21`, pinned `maven-compiler-plugin 3.13.0` with `<source>/<target>21`, `cucumber 7.20.1`, `archunit 1.3.0`, `testcontainers 1.20.4`, `springdoc 2.8.5`, `junit-platform-suite 1.11.4` | Old Boot line, Java 21, versions incompatible with Boot 4 / JUnit 6 |
| `backend/readora-web/pom.xml` | `spring-boot-starter-web`, `spring-boot-starter-test`, springdoc 2.x, Cucumber (`cucumber-java`, `-junit-platform-engine`, `-spring`, `junit-platform-suite`) | Deprecated starter names; BDD mixed into the web module |
| `backend/readora-infrastructure/pom.xml` | `flyway-core`, `org.testcontainers:junit-jupiter` / `postgresql`, `spring-boot-starter-test` | Boot 4 uses `spring-boot-starter-flyway`, Testcontainers 2 renamed artifacts, dedicated test starters |
| `ReadoraApplication.java` | `import org.springframework.boot.autoconfigure.domain.EntityScan` | Relocated in Boot 4 to `org.springframework.boot.persistence.autoconfigure.EntityScan` |
| `ChapterReadingControllerIntegrationTest.java` | `import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc` | Relocated to `org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc` (needs `spring-boot-starter-webmvc-test`) |
| `readora-web/src/test/java/com/readora/web/bdd/*` + `src/test/resources/features/*.feature` + `junit-platform.properties` | `CucumberTestRunner` (`@Suite`, glue `com.readora.web.bdd`), `CucumberSpringConfiguration` (boots full Spring context, unused by steps), 3 step-definition classes using **in-memory port fakes** and application services directly | Feature files are byte-identical duplicates of `.readora/context/user-stories/*.feature`; Spring context boot is dead weight |
| `backend/Dockerfile` | `eclipse-temurin:21-jdk-alpine` / `21-jre-alpine`, `-XX:+UseZGC -XX:+ZGenerational` | `ZGenerational` is obsolete since JDK 24 (generational ZGC is the only ZGC) and will fail/warn on JDK 25 |
| `frontend/package.json` | Angular `^19.1.0`, `@angular-devkit/build-angular`, Karma + Jasmine, TS `~5.6.3`, `@angular/animations`, `@angular/platform-browser-dynamic`; `zone.js` imported in `polyfills.ts` but **not declared** as a dependency; no `package-lock.json` (CI `npm ci` cannot work) | Old major, deprecated packages, broken CI install |
| `frontend/angular.json` | `@angular-devkit/build-angular:application|dev-server|karma` builders, `polyfills: [src/polyfills.ts]` | Deprecated builders, Karma |
| `frontend/src/app/app.config.ts` | `provideZoneChangeDetection({ eventCoalescing: true })` | Angular 22 is zoneless by default |
| Frontend specs | `src/app/features/reader/components/chapter-viewer.component.spec.ts`, `src/app/features/reader/services/reader-state.service.spec.ts`, `src/app/features/scanlation/services/scanlation-state.service.spec.ts`; Playwright in `frontend/e2e/*.spec.ts` (`playwright.config.ts` `testDir: './e2e'`) | Tests colocated in `src/`; user wants a `tests/` folder |
| CI (`.github/workflows/*.yml`) | JDK 21, Node 22, `mvn test -Dtest="*Cucumber*"`, `cache-dependency-path: frontend/package.json`, `npm run test:ci` with `--browsers=ChromeHeadless` | Must target JDK 25, new module, Vitest, lock file |

### Key Decisions
1. **Spring Boot 4.1.1 + Java 25 via `<maven.compiler.release>25</maven.compiler.release>`** – drop the explicit `maven-compiler-plugin`/`surefire` version pins and `<source>/<target>` in favour of the versions managed by the Boot 4.1.1 parent (avoids fighting the parent's plugin management).
2. **Modular Boot 4 starters** – `spring-boot-starter-web` → `spring-boot-starter-webmvc`; test dependencies become `spring-boot-starter-webmvc-test` (web) and `spring-boot-starter-data-jpa-test` (infrastructure); `flyway-core` → `spring-boot-starter-flyway` (+ `flyway-database-postgresql`). Rationale: Boot 4 migration guide; the old names are deprecated.
3. **Lightweight `readora-acceptance` module without Spring** (user choice). Step definitions already build application services with in-memory fakes; `CucumberSpringConfiguration` and `cucumber-spring` are dropped. Dependencies: `readora-domain`, `readora-application`, `cucumber-java`, `cucumber-junit-platform-engine`, `junit-platform-suite`, `assertj-core`.
4. **Feature files single source of truth** – the acceptance module declares `.readora/context/user-stories` as an additional Maven `<testResource>` with `<targetPath>features</targetPath>`; the copies in `readora-web/src/test/resources/features` are deleted. `@SelectClasspathResource("features")` keeps working unchanged.
5. **Runner class named `CucumberAcceptanceTest`** so it matches Surefire's default `*Test` include pattern (the current `CucumberTestRunner` only runs because CI passes `-Dtest=*Cucumber*`).
6. **Docker build of only the deployable module** – `mvn -pl readora-web -am clean package -DskipTests` so the image build does not need the acceptance module sources (the parent still lists it, so its `pom.xml` is copied too).
7. **Angular 22 zoneless + `@angular/build`** – remove `zone.js`/`polyfills.ts`, `provideZoneChangeDetection`, `@angular/animations`, `@angular/platform-browser-dynamic`; use `@angular/build:application`, `:dev-server`, `:unit-test`. Components already use `ChangeDetectionStrategy.OnPush` + signals, so no behavioural change is expected.
8. **Vitest + jsdom** (user choice) via `@angular/build:unit-test`; `tsconfig.spec.json` uses `"types": ["vitest/globals"]`; Jasmine-only matchers (`toBeTrue()`, `toBeFalse()`) are rewritten to `toBe(true)`/`toBe(false)`.
9. **`frontend/tests/{unit,e2e}` layout with `@app/*` alias** (user choice). `tsconfig.json` gets `"paths": { "@app/*": ["./src/app/*"] }` so moved specs import `@app/features/reader/...` instead of fragile `../../../../src/app/...` paths. `tsconfig.app.json` keeps `include: ["src/**/*.ts"]` so `tests/` never leaks into the bundle.

### Proposed Changes
#### A. Backend – Spring Boot 4.1.1 / Java 25
- `backend/pom.xml`
  - parent version `4.1.1`; properties: `java.version=25`, `maven.compiler.release=25` (remove `maven.compiler.source/target`), `archunit.version=1.5.0`, `cucumber.version=7.34.7`, `springdoc.version=3.1.0`, `aws.sdk.version` → latest 2.x; remove `testcontainers.version` (managed by Boot BOM) and the `junit-platform-suite` explicit version (managed by Boot/JUnit 6 BOM).
  - `dependencyManagement`: add `readora-acceptance` internal entry? (not needed – nothing depends on it); remove `cucumber-spring`; keep `h2` managed by Boot (drop explicit version).
  - `<modules>` add `readora-acceptance` after `readora-web`.
  - `pluginManagement`: drop `maven-compiler-plugin` and `maven-surefire-plugin` version/`source`/`target` pins; keep `<parameters>true</parameters>` via `<maven.compiler.parameters>true</maven.compiler.parameters>` property.
- `backend/readora-web/pom.xml`: `spring-boot-starter-webmvc`; test scope `spring-boot-starter-webmvc-test`, `h2`, `archunit-junit5`; remove all Cucumber + `junit-platform-suite` deps; update `<description>` (no more "Cucumber BDD").
- `backend/readora-infrastructure/pom.xml`: `spring-boot-starter-flyway` replaces `flyway-core`; `org.testcontainers:testcontainers-junit-jupiter` and `testcontainers-postgresql`; `spring-boot-starter-data-jpa-test` replaces `spring-boot-starter-test`.
- `backend/readora-domain/pom.xml`, `backend/readora-application/pom.xml`: unchanged coordinates (JUnit 6 / Mockito / AssertJ versions come from the Boot 4.1.1 BOM).
- `ReadoraApplication.java`: `import org.springframework.boot.persistence.autoconfigure.EntityScan;`
- `ChapterReadingControllerIntegrationTest.java`: `import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;`
- `backend/Dockerfile`: `FROM eclipse-temurin:25-jdk-alpine AS builder`, `FROM eclipse-temurin:25-jre-alpine`; copy `readora-acceptance/pom.xml`; `mvn -pl readora-web -am clean package -DskipTests`; `ENTRYPOINT ["java", "-XX:+UseZGC", "-jar", "app.jar"]`; header comment "Spring Boot 4.1 on Java 25".

#### B. Backend – `readora-acceptance` module
```
backend/readora-acceptance/
├── pom.xml
└── src/test/
    ├── java/com/readora/acceptance/
    │   ├── CucumberAcceptanceTest.java          (moved+renamed from CucumberTestRunner)
    │   └── steps/
    │       ├── ReaderViewerStepDefinitions.java
    │       ├── ScanlationWorkflowStepDefinitions.java
    │       └── SocialCommentsStepDefinitions.java
    └── resources/
        └── junit-platform.properties            (moved)
```
- `pom.xml` (packaging `jar`, `<name>Readora Acceptance Tests (Cucumber BDD)</name>`):
```xml
<dependencies>
  <dependency><groupId>com.readora</groupId><artifactId>readora-domain</artifactId><scope>test</scope></dependency>
  <dependency><groupId>com.readora</groupId><artifactId>readora-application</artifactId><scope>test</scope></dependency>
  <dependency><groupId>io.cucumber</groupId><artifactId>cucumber-java</artifactId><scope>test</scope></dependency>
  <dependency><groupId>io.cucumber</groupId><artifactId>cucumber-junit-platform-engine</artifactId><scope>test</scope></dependency>
  <dependency><groupId>org.junit.platform</groupId><artifactId>junit-platform-suite</artifactId><scope>test</scope></dependency>
  <dependency><groupId>org.assertj</groupId><artifactId>assertj-core</artifactId><scope>test</scope></dependency>
</dependencies>
<build>
  <testResources>
    <testResource><directory>src/test/resources</directory></testResource>
    <testResource>
      <directory>${project.basedir}/../../.readora/context/user-stories</directory>
      <targetPath>features</targetPath>
      <includes><include>*.feature</include></includes>
    </testResource>
  </testResources>
  <plugins>
    <plugin><groupId>org.apache.maven.plugins</groupId><artifactId>maven-jar-plugin</artifactId>
      <configuration><skipIfEmpty>true</skipIfEmpty></configuration></plugin>
  </plugins>
</build>
```
- `CucumberAcceptanceTest`:
```java
@Suite
@IncludeEngines("cucumber")
@SelectClasspathResource("features")
@ConfigurationParameter(key = GLUE_PROPERTY_NAME, value = "com.readora.acceptance.steps")
@ConfigurationParameter(key = PLUGIN_PROPERTY_NAME, value = "pretty, html:target/cucumber-report.html")
public class CucumberAcceptanceTest {}
```
- Step-definition classes: package rename only (`com.readora.acceptance.steps`); bodies untouched.
- Delete from `readora-web`: `src/test/java/com/readora/web/bdd/**`, `src/test/resources/features/**`, `src/test/resources/junit-platform.properties`.

#### C. Frontend – Angular 22
- `frontend/package.json`
  - `dependencies`: `@angular/{common,compiler,core,forms,platform-browser,router}` `^22.0.0`, `lucide-angular` latest with Angular 22 peer support, `rxjs ~7.8`, `tslib`. Remove `@angular/animations`, `@angular/platform-browser-dynamic`.
  - `devDependencies`: `@angular/build ^22`, `@angular/cli ^22`, `@angular/compiler-cli ^22`, `typescript ~6.0`, `vitest`, `jsdom`, `@playwright/test` latest, `@types/node ^24`. Remove all `karma-*`, `jasmine-core`, `@types/jasmine`, `@angular-devkit/build-angular`.
  - `engines: { "node": ">=22" }`; scripts: `"test": "ng test"`, `"test:ci": "ng test --watch=false"`, `"e2e": "playwright test"`, `"e2e:staging"` unchanged.
  - Run `npm install` to produce `frontend/package-lock.json` (committed).
- `frontend/angular.json`: builders `@angular/build:application`, `@angular/build:dev-server`, `@angular/build:unit-test`; `polyfills: []` (remove `src/polyfills.ts`); test target options `{ "tsConfig": "tsconfig.spec.json", "runner": "vitest", "include": ["tests/unit/**/*.spec.ts"], "buildTarget": "readora-frontend:build:development" }`.
- Delete `frontend/src/polyfills.ts`.
- `frontend/src/app/app.config.ts`: remove `provideZoneChangeDetection` (zoneless default in v22).
- `frontend/tsconfig.json`: TS 6-compatible options as generated by Angular 22 CLI (drop deprecated `esModuleInterop` if flagged, keep `moduleResolution: bundler`, `isolatedModules`), add `"paths": { "@app/*": ["./src/app/*"] }`.
- `frontend/tsconfig.app.json`: ensure `include: ["src/**/*.ts"]`, `exclude: ["src/**/*.spec.ts", "tests/**"]`.

#### D. Frontend – tests folder
```
frontend/
├── tests/
│   ├── unit/
│   │   └── features/
│   │       ├── reader/
│   │       │   ├── components/chapter-viewer.component.spec.ts
│   │       │   └── services/reader-state.service.spec.ts
│   │       └── scanlation/
│   │           └── services/scanlation-state.service.spec.ts
│   └── e2e/
│       ├── reader-viewer.spec.ts
│       └── scanlation-pipeline.spec.ts
├── playwright.config.ts   (testDir: './tests/e2e')
└── tsconfig.spec.json     (include: tests/unit/**/*.spec.ts, types: vitest/globals)
```
- Imports become `import { ChapterViewerComponent } from '@app/features/reader/components/chapter-viewer.component';` etc.
- Matcher rewrites: `toBeTrue()` → `toBe(true)`, `toBeFalse()` → `toBe(false)` (3 occurrences in `reader-state.service.spec.ts`, check `scanlation-state.service.spec.ts`).
- `frontend/e2e/` removed.

#### E. CI/CD & Docs
- `.github/workflows/ci-pr-validation.yml`: `java-version: '25'`; backend step 1 `mvn -B test -pl readora-domain,readora-application,readora-infrastructure,readora-web`; step 2 `mvn -B -pl readora-acceptance -am -DskipTests=false -Dsurefire.failIfNoSpecifiedTests=false -Dtest=CucumberAcceptanceTest test`; Node `24`, `cache-dependency-path: frontend/package-lock.json`; `npm run test:ci` (Vitest, no Chrome).
- `.github/workflows/deploy-staging.yml`, `deploy-production.yml`: JDK 25, Node 24, lock-file cache path; Playwright job unchanged except cache path.
- `AWS_DEPLOYMENT_GUIDE.md` Step 4: Runtime **Java 25**; build command `cd backend && mvn -pl readora-web -am clean package -DskipTests`.
- `.readora/context/PROJECT_CONTEXT.md`, `ARCHITECTURE.md` (new module #5 `readora-acceptance`, diagram node `CucumberTests` now labelled `readora-acceptance`, frontend section "Angular 22 (zoneless, Vitest)"), `DECISIONS_LOG.md` (ADR-002 updated to Angular 22; new **ADR-006: Spring Boot 4.1 / Java 25 baseline**, **ADR-007: Dedicated `readora-acceptance` module reading canonical user-story features**, **ADR-008: Vitest + `frontend/tests` layout**), `.junie/plans/readora-platform-foundation.md` version mentions.

### Architecture Diagram
```mermaid
graph TD
  subgraph Backend Maven Reactor - Spring Boot 4.1.1 / Java 25
    DOM[readora-domain]
    APP[readora-application] --> DOM
    INFRA[readora-infrastructure] --> APP
    WEB[readora-web<br/>REST + ArchUnit + MockMvc IT] --> INFRA
    ACC[readora-acceptance<br/>Cucumber runner + steps] -.test scope.-> APP
    ACC -.test scope.-> DOM
  end
  US[.readora/context/user-stories/*.feature] -->|Maven testResource -> classpath:features| ACC
  subgraph Frontend - Angular 22
    SRC[src/app - shipped code]
    UNIT[tests/unit - Vitest jsdom] -->|@app/* alias| SRC
    E2E[tests/e2e - Playwright]
  end
  CI[GitHub Actions JDK 25 / Node 24] --> WEB
  CI --> ACC
  CI --> UNIT
```

### Risks
- **No `mvn` on PATH locally** (only the IDE's bundled Maven). Validation will use the IDE build tool / bundled Maven; consider adding the Maven Wrapper later (out of scope).
- **Boot 4 dependency graph surprises** (e.g. Hibernate 7 dialect naming, Jackson 3 in springdoc 3.1): mitigated by compiling and running `ChapterReadingControllerIntegrationTest` which boots the full context on H2.
- **`-Dtest` filtering in a multi-module build** fails modules with no matching tests unless `-Dsurefire.failIfNoSpecifiedTests=false` is set – explicitly added to CI.
- **Zoneless change detection**: `ChapterViewerComponent` spec relies on `fixture.detectChanges()` after signal writes and button clicks; this remains valid in zoneless mode, but if a test needs async settle, `await fixture.whenStable()` will be added.
- **`ng update` cannot skip majors** (19→20→21→22). The agent edits `package.json`/`angular.json` directly to the v22 shape (equivalent end state) rather than running four sequential `ng update` passes; TS 6 deprecation warnings in `tsconfig.json` are fixed by hand.
- **Testcontainers 2 API/package changes** – infrastructure module currently has no tests using them, so only artifact IDs change.

# Testing

### Validation Approach
Each stage ends with a build/test run of the affected part so regressions surface immediately. The agent uses the IDE build tool (`mcp_idea_build_project`) / bundled Maven for the backend and `npm` scripts for the frontend (JDK 25.0.1 and Node 24.13 are available locally).

### Key Scenarios
1. **Backend compiles on JDK 25 / Boot 4.1.1** – `mvn -f backend/pom.xml -q clean verify -DskipTests` succeeds; no `--release`/bytecode warnings.
2. **Existing backend tests pass** – `mvn -f backend/pom.xml test -pl readora-domain,readora-application,readora-infrastructure,readora-web`: 3 `*DomainTest`, `HexagonalArchitectureArchTest`, `ChapterReadingControllerIntegrationTest` (Spring context boots on H2 with Boot 4 auto-configuration and springdoc 3.1).
3. **Acceptance module runs the canonical features** – `mvn -f backend/pom.xml -pl readora-acceptance -am test`: Surefire discovers `CucumberAcceptanceTest` by default pattern; `target/test-classes/features/US-0{1,2,3}-*.feature` exist (copied from `.readora/context/user-stories`); all scenarios green; `target/cucumber-report.html` produced.
4. **`readora-web` is Cucumber-free** – grep for `io.cucumber` / `bdd` / `features/` in `backend/readora-web` returns nothing.
5. **Frontend installs & builds on Angular 22** – `npm install` creates `package-lock.json`; `npm run build:staging` and `npm run build:prod` succeed with `@angular/build:application`; `dist/readora-frontend/browser/index.html` exists; no `zone.js` chunk in the output.
6. **Vitest unit tests from `tests/unit`** – `npm run test:ci` runs exactly the 3 relocated spec files and passes; `src/` contains no `*.spec.ts`.
7. **Playwright discovery** – `npx playwright test --list` lists specs from `tests/e2e/` (execution against a live URL is not required).
8. **Docker recipe sanity** – `backend/Dockerfile` references only `eclipse-temurin:25-*`, copies the 5 module POMs, and the ENTRYPOINT has no `ZGenerational` flag (static review; optional `docker build` if Docker is available).
9. **Docs/CI grep** – no occurrences of `Java 21`, `java-version: '21'`, `temurin:21`, `Angular 19`, `Spring Boot 3.4`, `karma`, `@angular-devkit/build-angular` remain (except historical ADR wording explicitly marked as superseded).

### Edge Cases
- Surefire `-Dtest=` in CI combined with modules that have no matching tests → verified with `-Dsurefire.failIfNoSpecifiedTests=false`.
- Feature file path resolution from `readora-acceptance` when built from the reactor root vs. from the module directory (`${project.basedir}` based path handles both).
- Zoneless mode: component spec click → `detectChanges()` re-render of `img.active-page`.
- `@app/*` alias resolution inside Vitest (Angular's unit-test builder honours `tsconfig.spec.json` `paths`).
- `tsconfig.app.json` excludes `tests/**` so specs never break the production bundle.

### Test Changes
- **Moved**: 3 Angular specs → `frontend/tests/unit/**`; 2 Playwright specs → `frontend/tests/e2e/`; Cucumber runner + 3 step classes → `backend/readora-acceptance`.
- **Modified**: Jasmine-only matchers → Vitest-compatible; imports → `@app/*`; `CucumberTestRunner` → `CucumberAcceptanceTest` with new glue package; `ChapterReadingControllerIntegrationTest` import update.
- **Deleted**: `CucumberSpringConfiguration` (no Spring in acceptance module), duplicated `.feature` copies in `readora-web`, `frontend/src/polyfills.ts`.
- **Not added**: no new test scenarios (pure upgrade/restructure).

# Delivery Steps

### ✓ Step 1: Upgrade backend to Spring Boot 4.1.1 on Java 25
The Maven reactor builds and all existing backend tests pass on JDK 25 with the Spring Boot 4.1.1 parent and Boot 4 modular starters.

- `backend/pom.xml`: parent `spring-boot-starter-parent:4.1.1`; `java.version=25`, `maven.compiler.release=25`, `maven.compiler.parameters=true`; drop `maven-compiler-plugin`/`maven-surefire-plugin` pins and `<source>/<target>`; bump `archunit.version=1.5.0`, `cucumber.version=7.34.7`, `springdoc.version=3.1.0`, latest AWS SDK 2.x; remove `testcontainers.version`, explicit `junit-platform-suite` and `h2` versions (Boot BOM managed); remove `cucumber-spring` from `dependencyManagement`.
- `backend/readora-web/pom.xml`: `spring-boot-starter-web` → `spring-boot-starter-webmvc`; `spring-boot-starter-test` → `spring-boot-starter-webmvc-test`; keep `h2`, `archunit-junit5`, springdoc 3.1.0 (Cucumber deps are removed in the next stage).
- `backend/readora-infrastructure/pom.xml`: `flyway-core` → `spring-boot-starter-flyway` (keep `flyway-database-postgresql`); `org.testcontainers:junit-jupiter`/`postgresql` → `testcontainers-junit-jupiter`/`testcontainers-postgresql`; `spring-boot-starter-test` → `spring-boot-starter-data-jpa-test`.
- `ReadoraApplication.java`: import `org.springframework.boot.persistence.autoconfigure.EntityScan`.
- `ChapterReadingControllerIntegrationTest.java`: import `org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc`.
- `backend/Dockerfile`: `eclipse-temurin:25-jdk-alpine` / `25-jre-alpine`, remove obsolete `-XX:+ZGenerational`, update header comment.
- Validate: full backend compile + `*DomainTest`, `HexagonalArchitectureArchTest`, `ChapterReadingControllerIntegrationTest` green on JDK 25.

### ✓ Step 2: Extract Cucumber BDD into the readora-acceptance module
Cucumber runner, step definitions and feature resources live in `backend/readora-acceptance`, consume `.readora/context/user-stories/*.feature` directly, and `readora-web` contains no BDD code.

- Create `backend/readora-acceptance/pom.xml` (parent `readora-parent`) with test-scoped `readora-domain`, `readora-application`, `cucumber-java`, `cucumber-junit-platform-engine`, `junit-platform-suite`, `assertj-core`; `<testResources>` adding `${project.basedir}/../../.readora/context/user-stories` → `features`; `maven-jar-plugin` `skipIfEmpty`.
- Register `<module>readora-acceptance</module>` in `backend/pom.xml`.
- Move `CucumberTestRunner` → `com.readora.acceptance.CucumberAcceptanceTest` (glue `com.readora.acceptance.steps`), move the 3 step-definition classes to `com.readora.acceptance.steps`, move `junit-platform.properties`.
- Delete `readora-web/src/test/java/com/readora/web/bdd/**`, `readora-web/src/test/resources/features/**`, `readora-web/src/test/resources/junit-platform.properties`; drop Cucumber/`junit-platform-suite` deps and BDD wording from `readora-web/pom.xml`.
- `backend/Dockerfile`: copy `readora-acceptance/pom.xml`; build with `mvn -pl readora-web -am clean package -DskipTests`.
- (User decision) Fix pre-existing spec/domain mismatch surfaced by the runner: `ScanlationProject.submitTaskWork` advances `RAW_UPLOADED` → `TRANSLATING` (cleaner's submission completes cleaning); `ScanlationProjectDomainTest` updated accordingly.
- Validate: `mvn -pl readora-acceptance -am test` runs all US-01/02/03 scenarios green from the copied features; `readora-web` tests still pass.

### ✓ Step 3: Upgrade frontend to Angular 22 (zoneless, @angular/build, TypeScript 6)
The frontend installs, builds and serves on Angular 22 with the new `@angular/build` builders and no zone.js.

- `frontend/package.json`: Angular packages `^22`, `@angular/build`, `@angular/cli`, `@angular/compiler-cli` `^22`, `typescript ~6.0`, `@types/node ^24`, latest `lucide-angular` and `@playwright/test`; remove `@angular/animations`, `@angular/platform-browser-dynamic`, `@angular-devkit/build-angular`, all Karma/Jasmine packages; add `vitest`, `jsdom`; `engines.node >=22`; scripts `test`, `test:ci` (`ng test --watch=false`).
- `frontend/angular.json`: `@angular/build:application`, `@angular/build:dev-server`, `@angular/build:unit-test` (runner `vitest`, `tsConfig: tsconfig.spec.json`, `include: ["tests/unit/**/*.spec.ts"]`); `polyfills: []`.
- Delete `frontend/src/polyfills.ts`; remove `provideZoneChangeDetection` from `app.config.ts`.
- `frontend/tsconfig.json`: TS 6-compatible options per Angular 22 CLI defaults; add `paths: { "@app/*": ["./src/app/*"] }`; `tsconfig.app.json` excludes `tests/**` and `*.spec.ts`.
- Run `npm install` to generate and commit `frontend/package-lock.json`.
- Validate: `npm run build:staging` and `npm run build:prod` succeed; output contains no zone.js.

### ✓ Step 4: Move frontend tests to tests/ and migrate to Vitest
All frontend unit specs run with Vitest from `frontend/tests/unit/**` and Playwright specs are discovered from `frontend/tests/e2e/`.

- Move `src/app/features/reader/components/chapter-viewer.component.spec.ts`, `src/app/features/reader/services/reader-state.service.spec.ts`, `src/app/features/scanlation/services/scanlation-state.service.spec.ts` to `tests/unit/features/**` (same relative structure).
- Rewrite imports to `@app/...`; convert Jasmine-only matchers (`toBeTrue()`/`toBeFalse()` → `toBe(true)`/`toBe(false)`); add `await fixture.whenStable()` only where zoneless rendering requires it.
- `frontend/tsconfig.spec.json`: `include: ["tests/unit/**/*.spec.ts", "src/**/*.d.ts"]`, `types: ["vitest/globals"]`, `outDir` for spec.
- Move `frontend/e2e/*.spec.ts` → `frontend/tests/e2e/`; set `testDir: './tests/e2e'` in `playwright.config.ts`; delete `frontend/e2e/`.
- Validate: `npm run test:ci` passes with exactly the 3 relocated specs; `npx playwright test --list` shows the two e2e specs; `src/` contains no `*.spec.ts`.

### ✓ Step 5: Update CI/CD workflows, deployment guide and context docs
GitHub Actions, the AWS guide and `.readora/context` documentation reflect Java 25 / Spring Boot 4.1.1 / Angular 22, the `readora-acceptance` module and the new test layout.

- `.github/workflows/ci-pr-validation.yml`: `java-version: '25'`; backend steps `mvn -B test -pl readora-domain,readora-application,readora-infrastructure,readora-web` and `mvn -B -pl readora-acceptance -am -Dsurefire.failIfNoSpecifiedTests=false -Dtest=CucumberAcceptanceTest test`; Node `24`, `cache-dependency-path: frontend/package-lock.json`; Vitest `npm run test:ci`.
- `.github/workflows/deploy-staging.yml`, `deploy-production.yml`: JDK 25, Node 24, lock-file cache path.
- `AWS_DEPLOYMENT_GUIDE.md` Step 4: runtime Java 25, build command `cd backend && mvn -pl readora-web -am clean package -DskipTests`.
- `.readora/context/PROJECT_CONTEXT.md`, `ARCHITECTURE.md` (module #5 `readora-acceptance`, updated diagram, Angular 22 zoneless/Vitest section, `frontend/tests` layout), `DECISIONS_LOG.md` (update ADR-002; add ADR-006 Boot 4.1/Java 25, ADR-007 acceptance module + canonical features, ADR-008 Vitest + `tests/` layout), `.junie/plans/readora-platform-foundation.md` version mentions.
- Validate: repo-wide grep shows no stale `Java 21` / `temurin:21` / `Angular 19` / `Spring Boot 3.4` / `karma` / `@angular-devkit/build-angular` references in config or docs.