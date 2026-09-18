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
        Aggregates[Domain Aggregates<br/>Work, Chapter, ScanlationProject, UserCollection, WorkReview]
        Entities[Entities & Value Objects]
        DomainEvents[Domain Events]
        Aggregates --> Entities
        Aggregates --> DomainEvents
    end

    subgraph Secondary / Driven Adapters / readora-infrastructure
        JPAAdapters[Spring Data JPA / PostgreSQL]
        S3Adapters[S3 Media Storage Adapter]
        EventAdapters[Event Publishing Adapter]
        NotificationAdapters[WebPush / Notification Adapter]
    end

    WebController --> InPorts
    CucumberTests --> InPorts
    AppServices --> Aggregates
    OutPorts <|.. JPAAdapters
    OutPorts <|.. S3Adapters
    OutPorts <|.. EventAdapters
    OutPorts <|.. NotificationAdapters
```

---

## Inbound Ports (Use Cases Catalog)
- **Reader Engine**:
  - `ReadChapterUseCase`: Load chapter pages, resolve versioning, edge CDN URLs.
  - `ReportCorruptedPageUseCase`: Submit broken asset reports.
- **Catalog & Search**:
  - `BrowseCatalogUseCase`: Tri-state filtering, faceted filtering, pagination.
  - `OmnisearchUseCase`: Trigram debounced autocomplete.
  - `TrendingRankingUseCase`: Calculate trending velocity scores and leaderboards.
  - `ReleaseScheduleUseCase`: Fetch weekly release calendar.
- **Library & Bookmarks**:
  - `ManageBookmarkUseCase`: Update reading statuses, record cloud progress.
  - `ManageCollectionUseCase`: Create, curate, and upvote user collections.
  - `LibraryDataSyncUseCase`: Import/export MAL/AniList lists and CSVs.
- **Social & Reviews**:
  - `ReaderInteractionUseCase`: Post page-referenced comments, nested replies, vote tallying.
  - `ManageReviewUseCase`: Submit 10-star structured reviews.
  - `SocialFollowUseCase`: Follow scanlation groups and user profiles.
- **Scanlation Hub**:
  - `ManageScanlationTaskUseCase`: Claim tasks, advance role-gated Kanban pipeline.
  - `BatchChapterUploadUseCase`: Upload archives, split/reorder pages.
  - `ScanlationGroupAdminUseCase`: Manage group rosters, recruitments, credit templates.
- **Moderation**:
  - `ModerationTriageUseCase`: Review community report queue, enforce actions.

---

## Outbound Ports (Driven SPIs)
- `WorkRepositoryPort`, `ChapterRepositoryPort`
- `BookmarkRepositoryPort`, `CollectionRepositoryPort`
- `CommentRepositoryPort`, `ReviewRepositoryPort`
- `ScanlationProjectRepositoryPort`, `ScanlationGroupRepositoryPort`
- `NotificationRepositoryPort`, `ModerationReportRepositoryPort`
- `StoragePort`: Presigned upload URLs, asset loading, CDN public URL resolution.
- `EventPublisherPort`: Spring ApplicationEvent and asynchronous event broker.
- `NotificationDispatcherPort`: WebPush notifications.

---

## Frontend Architecture (Angular 22, zoneless)
- **Standalone Component Architecture**: Zoneless change detection (`provideExperimentalZonelessChangeDetection` / default).
- **Signal Stores**:
  - `ActiveReaderStore`: Manages `currentChapter`, `currentPage`, `viewMode`, `zoomMode`, `stripMargin`, `autoScrollSpeed`, `fullscreen`.
  - `CatalogFilterStore`: Manages tri-state tag arrays (`includedTags`, `excludedTags`), facet selections, sorting.
  - `UserLibraryStore`: Reactive library bookmarks, read chapter sets, sync buffers.
  - `OfflineReaderStore`: IndexedDB persistence (`idb-keyval`), download queue manager.
- **Test Layout**:
  - `tests/unit/**/*.spec.ts`: Vitest (jsdom) headless component/service specs (`@app/*` alias).
  - `tests/e2e/*.spec.ts`: Playwright End-to-End browser scenarios.
