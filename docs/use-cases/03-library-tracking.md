# Module 3: Library Management & Reading Tracking

Inspired by **comix.to**, Readora provides personal reading list organization, real-time cloud scroll sync across mobile and desktop, visual read status indicators, community curated collections, and MAL/AniList backup synchronization.

---

## UC-15: Granular Multi-Status Reading Library

### Overview
Allows registered readers to organize manga, comics, and manhwas across 6 granular statuses with custom personal categorization, sorting, and private notes.

### Actor
- Registered Reader

### Reading Status Taxonomy
- `READING`: Actively following and reading new chapters.
- `PLAN_TO_READ`: Bookmarked for future reading.
- `COMPLETED`: Finished reading all published chapters of a completed series.
- `RE_READING`: Reading an already completed series again.
- `ON_HOLD`: Temporarily paused (e.g. waiting for chapters to accumulate).
- `DROPPED`: Discontinued reading.

### Primary Flow
1. From any work page or reader view, the user clicks the **Library Status** button.
2. A dropdown selector displays the 6 statuses with colored indicators.
3. The user selects a status (e.g., `READING`).
4. The Angular UI updates the optimistic state immediately and dispatches `PUT /api/v1/library/bookmarks/:workId` with `{ status: "READING" }`.
5. The series is added to the user's personal Library dashboard (`/library`).
6. Users can filter their library by status tabs, sort by `Last Read`, `Alphabetical`, `Score`, or `Latest Update`, and filter by genres.

---

## UC-16: Cloud Progress Synchronization Across Devices

### Overview
Automatically records the reader's exact chapter number, page number, and vertical scroll percentage, syncing state to the backend database with intelligent debouncing. When resuming on another device (e.g., switching from mobile to desktop), the reader is greeted with an instant "Resume Reading" prompt.

### Actor
- Registered Reader

### Preconditions
- User is authenticated.

### Sync Lifecycle & Debounce
1. While reading in `ReaderComponent`, every page change or vertical scroll offset movement updates the local `ActiveReaderStore`.
2. The client buffers progress events and dispatches debounced updates every 5 seconds (or upon window `beforeunload` / navigation events) to `POST /api/v1/library/progress`:
   ```json
   {
     "workId": "9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d",
     "chapterId": "4c94c9aa-2525-4c09-a78b-3db4c8034032",
     "chapterNumber": "42",
     "pageIndex": 14,
     "scrollPercentage": 0.68
   }
   ```
3. When the user opens the work page or reader on another device, the app checks the latest remote sync timestamp.
4. If the remote progress is further ahead than the local cache, a floating toast banner appears:
   *"You were reading Chapter 42, Page 14 on Mobile. [Jump to Page]"*.

### Technical Contract
- **Domain Event**: `ReadingProgressUpdatedEvent(UserId userId, WorkId workId, ChapterId chapterId, int pageIndex, double scrollPercentage, Instant updatedAt)`
- **Inbound Port**: `ManageBookmarkUseCase.updateReadingProgress(...)`

---

## UC-17: Visual Read / Unread Chapter Tracking

### Overview
Provides clear visual indicators across chapter lists indicating whether a chapter is **Unread**, **In Progress** (with progress bar e.g. 60%), or **Read**. Includes a batch action to "Mark all previous chapters as read".

### Actor
- Registered Reader

### Visual States
- **Unread**: Standard clean text, bold chapter number, empty circle icon.
- **In Progress**: Semi-muted text with a mini progress bar under the title (e.g. `p. 12/24`) and half-filled circle.
- **Read**: Dimmed / muted gray text with a green checkmark icon (`✓ Read`).

### Primary Flow
1. The user opens the chapter table on a Work page or the in-reader side drawer.
2. The client fetches the user's read chapter set via `GET /api/v1/library/works/:workId/read-chapters`.
3. Read chapters are styled with muted backgrounds and checkmarks.
4. If a reader started reading from Chapter 50 (e.g., migrating from another platform), they click the options menu next to Chapter 50 and choose **"Mark all previous (Ch. 1–49) as read"**.
5. The backend executes a batch insert/update for all prior chapter IDs in one atomic transaction.

---

## UC-18: User Curated Collections & Public Lists

### Overview
Enables readers to build, curate, publish, and share thematic lists of works (e.g., *"Top 10 Dungeon Crawlers with Op Protagonists"*, *"Underrated Slice of Life Romance"*). Community members can browse, favorite, and upvote collections.

### Actor
- Registered Reader

### Preconditions
- User has an active account.

### Primary Flow
1. User navigates to `/collections` and clicks **"Create New Collection"**.
2. User provides:
   - **Title**: e.g., "Peak Reincarnation Manhwa".
   - **Description**: Markdown formatted overview with recommendations.
   - **Visibility**: `PUBLIC` (Discoverable in community feeds) or `PRIVATE` (Personal only).
   - **Custom Banner / Theme**: Optional cover banner image.
3. User searches works and adds them with custom per-entry notes (e.g., *"Read this for the incredible art style"*).
4. User drags and drops to reorder list items.
5. Clicking **Publish Collection** creates the aggregate and emits `CollectionPublishedEvent`.
6. Other readers can view the collection, click **Upvote / Bookmark Collection**, and share direct permalinks.

---

## UC-19: Library Import & Export (MAL / AniList / CSV / JSON)

### Overview
Eliminates platform lock-in by enabling 1-click import from MyAnimeList (MAL XML/JSON) and AniList (GraphQL OAuth import / JSON export), mapping external titles to Readora works, and exporting the complete personal library as JSON or CSV.

### Actor
- Registered Reader

### Primary Flow (Import)
1. User opens Settings -> **Library Sync & Data**.
2. User selects **Import from MyAnimeList (XML)** or **Import from AniList (JSON)**.
3. User uploads the exported file (or connects their AniList account via OAuth token).
4. Readora parses the list and executes title matching using trigram fuzzy match against the catalog database.
5. A confirmation preview displays matched series, statuses (`Reading`, `Completed`), and scores:
   - *High confidence matches* (98% match): Pre-selected.
   - *Ambiguous matches*: User manually selects the correct work from a candidate dropdown.
6. User clicks **"Confirm Import"**.
7. Bookmarks are created/updated in batch with status and score preserved.

### Primary Flow (Export)
1. User clicks **"Export Library (JSON)"** or **"Export Library (CSV)"**.
2. Backend streams a formatted file containing all works, statuses, scores, last read chapter numbers, and timestamps.

---

## UC-20: Custom Personal Folders & Library Tags

### Overview
Allows power readers with hundreds of bookmarked titles to create arbitrary custom tags and nested folders (e.g., *"Seasonal Fall 2026"*, *"Completed Binges"*, *"Awaiting Season 2"*) beyond standard status categories.

### Actor
- Registered Reader

### Primary Flow
1. In the personal library view (`/library`), the user clicks **"+ New Custom Folder"**.
2. User enters folder name "Weekend Binge" and picks a color badge.
3. User selects multiple works from their library and clicks **"Move / Add to Folder"**.
4. The sidebar displays custom folders with real-time counters of unread chapters.
5. Deleting a folder does not delete the underlying bookmarks.
