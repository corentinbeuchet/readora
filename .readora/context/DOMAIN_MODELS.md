# Domain Models & Aggregate Catalog

This document is the living domain catalog for Readora. It lists core aggregates, entities, value objects, and domain events.

---

## 1. Work & Chapter Management Aggregate

### Aggregates & Entities
- **`Work` (Aggregate Root)**
  - `id`: `WorkId` (UUID)
  - `title`: `String`
  - `synopsis`: `String`
  - `type`: `WorkType` (`MANGA`, `MANHWA`, `MANHUA`, `COMIC`)
  - `status`: `WorkStatus` (`ONGOING`, `COMPLETED`, `HIATUS`)
  - `coverImageUrl`: `String`
  - `genres`: `Set<String>`
  - `createdAt`: `Instant`
  - `updatedAt`: `Instant`

- **`Chapter` (Aggregate Root)**
  - `id`: `ChapterId` (UUID)
  - `workId`: `WorkId`
  - `chapterNumber`: `ChapterNumber` (Value Object: e.g. "1", "1.5", "102")
  - `title`: `String`
  - `status`: `ChapterStatus` (`DRAFT`, `PENDING_REVIEW`, `PUBLISHED`, `ARCHIVED`)
  - `pages`: `List<PageAsset>` (Value Objects: page number, storage key, dimensions)
  - `publishedAt`: `Instant`
  - `scanlationProjectId`: `ProjectId` (optional)

### Domain Events
- `ChapterPublishedEvent` (`chapterId`, `workId`, `chapterNumber`, `publishedAt`)
- `ChapterPagesUpdatedEvent` (`chapterId`, `pageCount`, `updatedAt`)

---

## 2. Scanlation Pipeline Aggregate

### Aggregates & Entities
- **`ScanlationProject` (Aggregate Root)**
  - `id`: `ProjectId` (UUID)
  - `name`: `String`
  - `workId`: `WorkId`
  - `members`: `Set<TeamMember>`
  - `tasks`: `List<WorkflowTask>`

- **`TeamMember` (Entity)**
  - `userId`: `UserId`
  - `roles`: `Set<ScanlationRole>` (`LEADER`, `CLEANER_REDRAWER`, `TRANSLATOR`, `TYPESETTER`, `PROOFREADER`, `QUALITY_CHECKER`)
  - `joinedAt`: `Instant`

- **`WorkflowTask` (Entity)**
  - `id`: `TaskId` (UUID)
  - `chapterNumber`: `ChapterNumber`
  - `stage`: `WorkflowStage` (`RAW_UPLOADED`, `CLEANING`, `TRANSLATING`, `TYPESETTING`, `PROOFREADING`, `QC_REVIEW`, `PUBLISHED`)
  - `assigneeId`: `UserId` (nullable)
  - `status`: `TaskStatus` (`PENDING`, `IN_PROGRESS`, `COMPLETED`, `BLOCKED`)
  - `assetPackageUrl`: `String`
  - `updatedAt`: `Instant`

### Domain Events
- `TaskAssignedEvent` (`projectId`, `taskId`, `assigneeId`, `stage`)
- `TaskStageAdvancedEvent` (`projectId`, `taskId`, `fromStage`, `toStage`, `updatedAt`)
- `WorkflowCompletedEvent` (`projectId`, `chapterNumber`, `completedAt`)

---

## 3. Reader Interaction & Social Aggregate

### Aggregates & Entities
- **`ChapterComment` (Aggregate Root)**
  - `id`: `CommentId` (UUID)
  - `chapterId`: `ChapterId`
  - `authorId`: `UserId`
  - `authorUsername`: `String`
  - `content`: `CommentContent` (Validated markdown text, max 2000 chars)
  - `pageReference`: `Integer` (optional target page index)
  - `parentId`: `CommentId` (optional for threaded replies)
  - `isSpoiler`: `boolean`
  - `upvotes`: `int`
  - `createdAt`: `Instant`

- **`Bookmark` (Entity / Value Object)**
  - `userId`: `UserId`
  - `workId`: `WorkId`
  - `lastReadChapterId`: `ChapterId`
  - `lastReadPageIndex`: `int`
  - `status`: `ReadingStatus` (`READING`, `PLAN_TO_READ`, `COMPLETED`, `DROPPED`)
  - `updatedAt`: `Instant`

- **`WorkRating` (Entity / Value Object)**
  - `userId`: `UserId`
  - `workId`: `WorkId`
  - `score`: `int` (1-10)
  - `createdAt`: `Instant`

### Domain Events
- `CommentPostedEvent` (`commentId`, `chapterId`, `authorId`, `createdAt`)
- `ReadingProgressUpdatedEvent` (`userId`, `workId`, `chapterId`, `pageIndex`)
