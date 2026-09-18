# Domain Models & Aggregate Catalog

This document is the living domain catalog for Readora. It lists core aggregates, entities, value objects, and domain events across all 38 platform use cases.

---

## 1. Work & Chapter Management Aggregate

### Aggregates & Entities
- **`Work` (Aggregate Root)**
  - `id`: `WorkId` (UUID)
  - `title`: `String`
  - `alternativeTitles`: `List<String>`
  - `synopsis`: `String`
  - `type`: `WorkType` (`MANGA`, `MANHWA`, `MANHUA`, `COMIC`, `WEBTOON`)
  - `status`: `WorkStatus` (`ONGOING`, `COMPLETED`, `HIATUS`, `CANCELLED`)
  - `contentRating`: `ContentRating` (`SAFE`, `SUGGESTIVE`, `EROTICA`)
  - `demographic`: `Demographic` (`SHOUNEN`, `SEINEN`, `SHOUJO`, `JOSEI`, `NONE`)
  - `coverImageUrl`: `String`
  - `genres`: `Set<String>`
  - `author`: `String`
  - `artist`: `String`
  - `releaseYear`: `Integer`
  - `createdAt`: `Instant`
  - `updatedAt`: `Instant`

- **`Chapter` (Aggregate Root)**
  - `id`: `ChapterId` (UUID)
  - `workId`: `WorkId`
  - `scanlationGroupId`: `ScanlationGroupId` (optional / multi-versioning)
  - `chapterNumber`: `ChapterNumber` (Value Object: e.g. "1", "1.5", "102")
  - `title`: `String`
  - `status`: `ChapterStatus` (`DRAFT`, `PENDING_REVIEW`, `PUBLISHED`, `ARCHIVED`)
  - `pages`: `List<PageAsset>` (Value Objects: page number, storage key, dimensions, thumbnail key)
  - `publishedAt`: `Instant`
  - `scanlationProjectId`: `ProjectId` (optional)

### Value Objects
- `PageAsset` (`pageIndex`: int, `storageKey`: String, `width`: int, `height`: int, `mimeType`: String)
- `ChapterNumber` (`value`: String, numeric sorting comparator)

### Domain Events
- `ChapterPublishedEvent` (`chapterId`, `workId`, `chapterNumber`, `scanlationGroupId`, `publishedAt`)
- `ChapterPagesUpdatedEvent` (`chapterId`, `pageCount`, `updatedAt`)
- `BrokenPageReportedEvent` (`workId`, `chapterId`, `pageIndex`, `reporterUserId`, `reportedAt`)

---

## 2. Scanlation & Creator Studio Aggregate

### Aggregates & Entities
- **`ScanlationGroup` (Aggregate Root)**
  - `id`: `ScanlationGroupId` (UUID)
  - `name`: `String`
  - `slug`: `String`
  - `description`: `String`
  - `bannerUrl`: `String`
  - `avatarUrl`: `String`
  - `discordUrl`: `String`
  - `donationUrl`: `String`
  - `members`: `Set<GroupMember>`
  - `openRecruitments`: `List<RecruitmentPosting>`
  - `creditTemplates`: `List<CreditPageTemplate>`

- **`ScanlationProject` (Aggregate Root)**
  - `id`: `ProjectId` (UUID)
  - `name`: `String`
  - `workId`: `WorkId`
  - `groupId`: `ScanlationGroupId`
  - `members`: `Set<TeamMember>`
  - `tasks`: `List<WorkflowTask>`

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
  - `workId`: `WorkId`
  - `authorId`: `UserId`
  - `authorUsername`: `String`
  - `content`: `CommentContent` (Markdown text, max 2000 chars)
  - `pageReference`: `Integer` (nullable target page index)
  - `parentId`: `CommentId` (nullable for threaded replies up to 5 levels)
  - `isSpoiler`: `boolean`
  - `upvotes`: `int`
  - `downvotes`: `int`
  - `createdAt`: `Instant`

- **`WorkReview` (Aggregate Root)**
  - `id`: `ReviewId` (UUID)
  - `workId`: `WorkId`
  - `authorId`: `UserId`
  - `overallScore`: `int` (1-10)
  - `storyScore`: `int` (1-10)
  - `artScore`: `int` (1-10)
  - `characterScore`: `int` (1-10)
  - `pros`: `List<String>`
  - `cons`: `List<String>`
  - `body`: `String`
  - `helpfulVotes`: `int`
  - `createdAt`: `Instant`

- **`UserCollection` (Aggregate Root)**
  - `id`: `CollectionId` (UUID)
  - `ownerId`: `UserId`
  - `title`: `String`
  - `description`: `String`
  - `visibility`: `CollectionVisibility` (`PUBLIC`, `PRIVATE`)
  - `bannerUrl`: `String`
  - `items`: `List<CollectionItem>` (`workId`, `orderIndex`, `customNote`)
  - `upvotes`: `int`
  - `createdAt`: `Instant`

- **`Bookmark` (Entity / Aggregate Root)**
  - `userId`: `UserId`
  - `workId`: `WorkId`
  - `lastReadChapterId`: `ChapterId`
  - `lastReadPageIndex`: `int`
  - `scrollPercentage`: `double`
  - `status`: `ReadingStatus` (`READING`, `PLAN_TO_READ`, `COMPLETED`, `RE_READING`, `ON_HOLD`, `DROPPED`)
  - `customFolderId`: `FolderId` (optional)
  - `updatedAt`: `Instant`

### Domain Events
- `CommentPostedEvent` (`commentId`, `chapterId`, `authorId`, `pageReference`, `createdAt`)
- `ReadingProgressUpdatedEvent` (`userId`, `workId`, `chapterId`, `pageIndex`, `scrollPercentage`, `updatedAt`)
- `ReviewSubmittedEvent` (`reviewId`, `workId`, `authorId`, `overallScore`, `createdAt`)
- `CollectionPublishedEvent` (`collectionId`, `ownerId`, `title`, `publishedAt`)

---

## 4. Notifications & Moderation Aggregate

### Aggregates & Entities
- **`Notification` (Aggregate Root)**
  - `id`: `NotificationId` (UUID)
  - `recipientId`: `UserId`
  - `type`: `NotificationType` (`CHAPTER_RELEASE`, `COMMENT_REPLY`, `MENTION`, `REVIEW_VOTE`, `SYSTEM_ALERT`)
  - `title`: `String`
  - `message`: `String`
  - `targetUrl`: `String`
  - `isRead`: `boolean`
  - `createdAt`: `Instant`

- **`ModerationReport` (Aggregate Root)**
  - `id`: `ReportId` (UUID)
  - `reporterId`: `UserId`
  - `targetType`: `ReportTargetType` (`COMMENT`, `REVIEW`, `CHAPTER_PAGE`, `WORK`, `USER`)
  - `targetId`: `String`
  - `reason`: `ReportReason` (`UNMARKED_SPOILER`, `HARASSMENT_ABUSE`, `SPAM_SCAM`, `BROKEN_ASSET`, `DUPLICATE_UPLOAD`)
  - `notes`: `String`
  - `status`: `ReportStatus` (`OPEN`, `TRIAGED`, `RESOLVED`, `DISMISSED`)
  - `resolutionAction`: `String`
  - `createdAt`: `Instant`
