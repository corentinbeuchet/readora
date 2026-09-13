# Hexagonal DDD Architecture Specification

## Architectural Overview
Readora follows strict Hexagonal Architecture (Ports and Adapters) paired with Domain-Driven Design (DDD) to isolate domain rules from frameworks, database drivers, and delivery mechanisms.

```mermaid
graph TD
    subgraph Primary / Driving Adapters
        WebController[REST API Controllers<br/>readora-web]
        CucumberTests[Cucumber BDD Acceptance Suite<br/>readora-acceptance]
    end

    subgraph Application Layer / readora-application
        InPorts[Inbound Ports / Use Cases]
        AppServices[Application Services]
        OutPorts[Outbound Ports / SPIs]
        InPorts --> AppServices
        AppServices --> OutPorts
    end

    subgraph Domain Layer / readora-domain
        Aggregates[Domain Aggregates<br/>Work, Chapter, ScanlationProject]
        Entities[Entities & Value Objects]
        DomainEvents[Domain Events]
        Aggregates --> Entities
        Aggregates --> DomainEvents
    end

    subgraph Secondary / Driven Adapters / readora-infrastructure
        JPAAdapters[Spring Data JPA / PostgreSQL]
        S3Adapters[S3 Media Storage Adapter]
        EventAdapters[Event Publishing Adapter]
    end

    WebController --> InPorts
    CucumberTests --> InPorts
    AppServices --> Aggregates
    OutPorts <|.. JPAAdapters
    OutPorts <|.. S3Adapters
    OutPorts <|.. EventAdapters
```

---

## Module Breakdown

### 1. `readora-domain`
- **Role**: Heart of the software containing core business entities, aggregates, domain services, value objects, and domain events.
- **Dependencies**: None (pure Java 25 LTS).
- **Key Packages**:
  - `com.readora.domain.work`: Aggregates for `Work`, `Chapter`, `PageAsset`, `ChapterStatus`.
  - `com.readora.domain.scanlation`: `ScanlationProject`, `WorkflowTask`, `ScanlationRole`, `WorkflowState`.
  - `com.readora.domain.social`: `ChapterComment`, `Rating`, `Bookmark`, `ReadingProgress`.
  - `com.readora.domain.common`: Base classes (`AggregateRoot`, `Entity`, `ValueObject`, `DomainEvent`).

### 2. `readora-application`
- **Role**: Coordinates domain objects to execute use cases.
- **Dependencies**: `readora-domain`.
- **Key Packages**:
  - `com.readora.application.port.in`: Inbound ports (use case interfaces).
  - `com.readora.application.port.out`: Outbound ports (SPI repository and service interfaces).
  - `com.readora.application.service`: Application service implementations orchestrating transactions and domain calls.

### 3. `readora-infrastructure`
- **Role**: Implements outbound ports using concrete technologies (JPA, PostgreSQL, S3, CloudFront, JWT).
- **Dependencies**: `readora-domain`, `readora-application`, Spring Boot Starter Data JPA, PostgreSQL Driver, AWS SDK S3.
- **Key Packages**:
  - `com.readora.infrastructure.persistence`: JPA entities, Spring Data repositories, adapter mappers.
  - `com.readora.infrastructure.storage`: AWS S3 & MinIO storage adapter implementing `StoragePort`.
  - `com.readora.infrastructure.security`: Spring Security & JWT token adapters.

### 4. `readora-web`
- **Role**: Primary entry point, REST controllers, exception handlers, and application bootstrap.
- **Dependencies**: `readora-domain`, `readora-application`, `readora-infrastructure`, Spring Boot 4.1 Starter WebMVC, Validation, OpenAPI (springdoc 3).
- **Key Packages**:
  - `com.readora.web.controller`: REST controllers.
  - `com.readora.web.dto`: API request/response DTOs and mappers.
  - `com.readora.web.exception`: `@RestControllerAdvice` error handler.
  - `com.readora.web.arch`: ArchUnit architectural validation tests.

### 5. `readora-acceptance`
- **Role**: Executable specifications. Runs the canonical `.readora/context/user-stories/*.feature` files with Cucumber-JVM against the application use cases through in-memory port fakes — no Spring context, no database.
- **Dependencies** (test scope only): `readora-domain`, `readora-application`, Cucumber-JVM, JUnit Platform Suite, AssertJ.
- **Feature source**: the module declares `.readora/context/user-stories` as an extra Maven test resource (`target/test-classes/features`), so there is a single source of truth for user stories.
- **Key Packages**:
  - `com.readora.acceptance.CucumberAcceptanceTest`: JUnit Platform Suite runner (`@SelectClasspathResource("features")`).
  - `com.readora.acceptance.steps`: Step definitions per user story (`ReaderViewerStepDefinitions`, `ScanlationWorkflowStepDefinitions`, `SocialCommentsStepDefinitions`).
- **Run**: `mvn -f backend/pom.xml -pl readora-acceptance -am test`.

---

## Frontend Architecture (Angular 22, zoneless)
- Standalone component architecture with fine-grained Signals (`signal`, `computed`, `effect`); zoneless change detection (no `zone.js`, no `provideZoneChangeDetection`).
- Built with `@angular/build:application` (esbuild) on TypeScript 6; served with `@angular/build:dev-server`.
- Feature-driven module layout (`features/reader`, `features/scanlation`, `features/social`, `features/library`).
- Test layout (outside `src/`):
  - `tests/unit/**/*.spec.ts`: Vitest (jsdom) headless component/service tests via `@angular/build:unit-test`, importing production code through the `@app/*` path alias.
  - `tests/e2e/*.spec.ts`: Playwright End-to-End tests validating cross-role collaboration (`playwright.config.ts` → `testDir: './tests/e2e'`).
