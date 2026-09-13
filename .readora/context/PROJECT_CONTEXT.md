# Readora Project Context

## Mission & Purpose
Readora is a unified web platform designed to eliminate friction between manga/comic/webtoon reading communities and collaborative scanlation translation pipelines. It provides an integrated ecosystem where readers enjoy a high-performance viewing and discussion experience, while scanlation teams manage end-to-end translation workflows with role-based coordination.

## Core Tech Stack
- **Backend**: Java 25 LTS, Spring Boot 4.1, Maven Multi-Module, Hexagonal Architecture (Ports & Adapters), Domain-Driven Design (DDD).
- **Frontend**: Angular 22 (Standalone Components, Signals-based reactive state, zoneless change detection, `@angular/build` esbuild pipeline, TypeScript 6, Tailwind CSS / SCSS).
- **BDD & Testing**: Cucumber-JVM in the dedicated `readora-acceptance` module (executes the canonical `.readora/context/user-stories/*.feature` files), JUnit 6, Mockito, ArchUnit (architectural boundaries), Vitest + jsdom (fast headless Angular component/service tests under `frontend/tests/unit`), Playwright (E2E multi-browser UI testing under `frontend/tests/e2e`).
- **Database & Storage**: PostgreSQL 16+ (relational metadata, ACLs, comment trees), S3-compatible Object Storage (scan image assets) + CloudFront CDN edge delivery.
- **Infrastructure & Hosting**: Dual isolated environments (Staging & Production) on AWS (AWS App Runner / ECS Fargate, Amazon RDS PostgreSQL, Amazon S3, CloudFront).

---

## Architectural Invariants (Enforced via ArchUnit & AI Governance)
1. **Domain Purity**: `readora-domain` contains zero external dependencies (pure Java 25 POJOs). No Spring, JPA, or third-party framework imports are permitted.
2. **Hexagonal Dependency Direction**:
   - `readora-application` depends strictly on `readora-domain`. It exposes Inbound Ports (use cases) and Outbound Ports (SPIs).
   - `readora-infrastructure` depends on `readora-application` and `readora-domain` to implement Outbound Ports (persistence, storage, event publishing).
   - `readora-web` depends on `readora-application` and `readora-domain` to implement Inbound REST Controllers and bootstrap the Spring Boot runtime.
   - `readora-acceptance` (test-only) depends on `readora-application` and `readora-domain` to drive use cases from Cucumber scenarios without any Spring context.
3. **Frontend Signal Exclusivity**: Angular UI state must leverage Angular Signals for fine-grained reactivity; the application runs zoneless (no Zone.js), so every state change must flow through signals.
4. **Tests Live Outside Shipped Source**: frontend `src/` contains only production code; unit specs live in `frontend/tests/unit/**` (importing via the `@app/*` alias) and Playwright specs in `frontend/tests/e2e/`.
5. **Environment Parity**: Staging and Production configurations must remain strictly isolated, with identical containerized runtimes and database migration flows.

---

## AI Agent Governance & Context Verification Protocol
To ensure high-utility, regression-free development, every AI coding agent MUST execute the following loop:
1. **Pre-Execution Check**:
   - Inspect `.readora/context/PROJECT_CONTEXT.md` and `.readora/context/ARCHITECTURE.md`.
   - Read all feature files in `.readora/context/user-stories/`.
   - **Conflict / Regression Warning**: If a requested change contradicts an established user story rule or architectural invariant, emit an explicit warning to the user before proceeding.
2. **Execution**:
   - Implement changes in strict adherence to Hexagonal DDD and Signal conventions.
   - Maintain automated test coverage (POJO unit tests, Cucumber BDD scenarios, component specs).
3. **Post-Execution Synchronization**:
   - Add or update user stories in `.readora/context/user-stories/`.
   - Update `DOMAIN_MODELS.md` when aggregates, value objects, or domain events are altered.
   - Update `ARCHITECTURE.md` when ports, adapters, or modules change.
   - Log the architectural decision in `DECISIONS_LOG.md`.
