# Module 5: Scanlation Hub & Creator Tools

Inspired by **comix.to** and top scanlation translation workflows, Readora provides a comprehensive collaborative scanlation ecosystem featuring group recruitment hubs, multi-group translation versioning, batch drag-and-drop upload studio, a role-gated Kanban pipeline, and automated credit page injection.

---

## UC-30: Scanlation Group Profile & Recruitment Hub

### Overview
Scanlation teams have dedicated public brand pages showcasing their roster, translated projects, external community links (Discord, Ko-fi, Patreon), and an active **Recruitment Hub** where leaders post open roles (e.g., *"Looking for Korean Translators & Experienced Redrawers"*).

### Actor
- Scanlation Group Leader / Member / Prospective Volunteer

### Primary Flow
1. Scanlation Leader navigates to `/groups/manage/:groupId`.
2. Leader configures:
   - **Branding**: Group banner, avatar, description, website, Discord invite URL, donation links.
   - **Roster & Roles**: Assigns member permissions (`Leader`, `Translator`, `Cleaner/Redrawer`, `Typesetter`, `Proofreader`, `QC`).
   - **Recruitment Postings**: Creates open positions with skill requirements and application forms (e.g. "Typesetter - Familiar with Photoshop / Clip Studio Paint").
3. Prospective volunteers visit `/groups/:groupSlug` and click **"Apply for Role"**.
4. Group leaders receive applicant notifications and review submitted portfolio links.

---

## UC-31: Multi-Scanlation Group Chapter Versioning

### Overview
Multiple independent scanlation groups (or official releases) can upload their own translation versions for the same work and chapter number. Readers can switch between group versions within the reader.

### Actor
- Reader / Scanlation Team

### Data Model & Resolution
- Each chapter record is identified by `(workId, chapterNumber, scanlationGroupId)`.
- When a reader opens a chapter, the default version is selected based on:
  1. Reader's preferred scanlation group for this series (if previously selected).
  2. The highest-rated / verified group translation.
- Inside the reader and chapter list, a dropdown or version pill selector displays:
  - `[FlameScans v1.0]`
  - `[AsuraScans v1.0]`
  - `[Official Webtoon]`

### Primary Flow
1. Scanlation Group B uploads "Chapter 45" for a series where Group A already published Chapter 45.
2. The system does not overwrite Group A's version; it registers a second `Chapter` aggregate with `scanlationGroupId: GroupB.id`.
3. In the reader, a switcher in the top bar displays: *"Translation: [FlameScans ▼]"*.
4. Selecting *"AsuraScans"* dynamically swaps the page array and comments without leaving the reader.

---

## UC-32: Batch Chapter Uploader & Page Reordering Studio

### Overview
High-performance visual upload studio supporting ZIP/CBZ archives and raw multi-image folder drag-and-drop. Includes thumbnail grid previews, drag-and-drop reordering, page splitting, rotation, and metadata editing.

### Actor
- Scanlation Uploader / Creator

### Primary Flow
1. User navigates to `/studio/upload/:workId`.
2. User drags and drops a `.cbz` or `.zip` file (or selects 50+ individual `.jpg`/`.png`/`.webp` files).
3. Client-side decompression/parsing extracts image metadata and generates local thumbnail previews.
4. The visual grid renders page tiles labeled `Page 1`, `Page 2`, ... `Page N`.
5. **Interactive Controls**:
   - **Reorder**: Drag any page card to swap or reorder indices.
   - **Rotate**: 90-degree clockwise / counter-clockwise page rotation.
   - **Split Dual-Page**: One-click split for wide 2-page spreads into two separate single pages.
   - **Delete**: Remove duplicate or blank pages.
6. User enters Chapter Number (e.g. `45.5`), Chapter Title (e.g. `The Awakening`), and selects Release Date.
7. User clicks **"Upload & Process"**.
8. The studio chunks and uploads pages in parallel to S3 storage via presigned URLs with progress bars.

---

## UC-33: Role-Gated Collaborative Kanban Workflow

### Overview
A linear, role-gated Kanban pipeline that coordinates scanlation team handoffs from raw image capture to final quality check and publication.

### Pipeline Stages
1. `RAW_UPLOADED`: Raw scans uploaded from source.
2. `CLEANING`: Cleaning speech bubbles and redrawing background art.
3. `TRANSLATING`: Translating dialogue text into target language.
4. `TYPESETTING`: Placing translated fonts and SFX into cleaned pages.
5. `PROOFREADING`: Reviewing grammar, flow, and terminology consistency.
6. `QC_REVIEW`: Final quality assurance inspection.
7. `PUBLISHED`: Chapter is released to public readers.

### State Transition Matrix & Role Gates
| From Stage | To Stage | Required Role | Required Asset |
|---|---|---|---|
| `RAW_UPLOADED` | `CLEANING` | Cleaner / Redrawer | Claim task |
| `CLEANING` | `TRANSLATING` | Cleaner / Redrawer | Cleaned image package |
| `TRANSLATING` | `TYPESETTING` | Translator | Translation script document |
| `TYPESETTING` | `PROOFREADING` | Typesetter | Assembled PSD / WebP package |
| `PROOFREADING` | `QC_REVIEW` | Proofreader | Approved text revisions |
| `QC_REVIEW` | `PUBLISHED` | Quality Checker / Leader | Final chapter verification |

### Primary Flow
1. Translator Bob logs into `/studio/kanban/:projectId`.
2. Bob drags Chapter 10 from `CLEANING (Done)` to `TRANSLATING (In Progress)`.
3. Bob downloads the cleaned asset package, writes the translation script, and attaches it to the task.
4. Bob clicks **"Complete Translation"**.
5. The task advances to `TYPESETTING`, triggering a notification to the group's typesetters.

---

## UC-34: Credit & Watermark Page Auto-Injector

### Overview
Allows scanlation leaders to configure standard credit, recruitment, and disclaimer pages that are automatically appended at the beginning (cover) or end of every published chapter package.

### Actor
- Scanlation Group Leader

### Primary Flow
1. Leader navigates to `/groups/manage/:groupId/credit-templates`.
2. Leader uploads credit banner assets:
   - `INTRO_CREDIT_PAGE`: Group logo, staff credits, website QR code.
   - `OUTRO_RECRUITMENT_PAGE`: Open roles, Discord link, donation links.
3. Leader selects injection policy:
   - *Auto-Inject Intro as Page 1*.
   - *Auto-Inject Outro as Last Page*.
4. When any chapter in the group's projects reaches `PUBLISHED` status, the backend asset processor automatically merges the credit pages into the chapter's `PageAsset` array before CloudFront CDN cache propagation.
