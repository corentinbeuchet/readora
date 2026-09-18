# Module 4: Community, Social & Reviews

Inspired by **comix.to**, Readora fosters a vibrant reading community with granular in-reader page-level comments, nested spoiler-protected discussion trees, weighted reviews, public reader profile showcases with analytics radar charts, and social following.

---

## UC-21: Page-Referenced In-Reader Comments

### Overview
Allows readers to anchor comments to specific page numbers (e.g. `[Page 14]`). When browsing chapter discussions, clicking a page reference badge instantly scrolls the reader to that exact panel/page.

### Actor
- Registered Reader

### Primary Flow
1. While reading Chapter 12 on Page 8, the user clicks **"Comment on this page"** or presses `C`.
2. The comment compose dialog opens pre-filled with `Page 8` badge attached.
3. The user enters their thoughts and clicks **Submit**.
4. The comment is saved with `pageReference: 8`.
5. In the chapter comment section, the comment displays a clickable chip: `[📄 Page 8]`.
6. Clicking `[📄 Page 8]` immediately jumps the reader's scroll position to Page 8.
7. In the reader margin, a small comment counter badge appears on Page 8 showing the number of comments anchored to it.

---

## UC-22: Threaded Discussions with Spoiler Protection

### Overview
Nested conversation threads (up to 5 levels deep) supporting rich markdown, emoji pickers, GIF reactions, and click-to-reveal `||spoiler||` formatting with automatic spoiler warnings.

### Actor
- Registered Reader

### Spoiler Protection Mechanism
- Inline markdown syntax: `||spoiler content here||`.
- UI renders a blurred/blacked-out overlay with a label: *"Spoiler (Click to reveal)"*.
- Top-level spoiler checkbox: If checked, the entire comment card is masked with a red spoiler warning badge.

### Primary Flow
1. User clicks **"Reply"** on an existing comment (e.g., Comment `C102`).
2. Compose box opens inline underneath `C102`.
3. User writes markdown: `"I didn't expect ||the master to betray him|| in this chapter!"`.
4. User clicks **Post Reply**.
5. The comment tree dynamically updates in real-time without full page refresh.
6. The reply is rendered nested with indentation and a connecting vertical thread guide line.
7. Readers can click thread collapse buttons (`[-]`) to hide lengthy sub-threads.

---

## UC-23: Community Comment Reactions & Reputation System

### Overview
Readers can upvote and downvote comments and express quick emoji reactions (`🔥`, `❤️`, `😂`, `😭`, `💀`, `🤯`). Highly rated commenters earn community reputation points and badges.

### Actor
- Reader / Registered User

### Primary Flow
1. Next to any comment, user clicks the **Upvote (▲)** or **Downvote (▼)** button, or chooses an emoji reaction.
2. The client optimistically increments the count and sends `POST /api/v1/social/comments/:id/reactions` with `{ type: "UPVOTE" }`.
3. If the user had previously downvoted, the vote transitions to upvote (+2 net change).
4. Comments can be sorted dynamically by:
   - **Top (Score)**: `upvotes - downvotes` ranking.
   - **Newest**: Chronological reverse.
   - **Oldest**: Chronological.
   - **Page Order**: Sorted by page reference index (Page 1 to Page N).

---

## UC-24: 10-Star Rating & Structured Reviews

### Overview
Readers can rate works on a granular 1–10 star scale and write comprehensive structured reviews featuring **Pros**, **Cons**, and **Verdict**, which other community members can vote as "Helpful".

### Actor
- Registered Reader

### Preconditions
- User has read at least 3 chapters of the work (prevents spam / drive-by 1-star review bombing).

### Review Schema
- `overallScore`: Integer (1 to 10)
- `storyScore`: Integer (1 to 10)
- `artScore`: Integer (1 to 10)
- `characterScore`: Integer (1 to 10)
- `pros`: List of concise positive highlights
- `cons`: List of concise critical points
- `body`: Detailed markdown review text
- `isSpoiler`: boolean

### Primary Flow
1. User navigates to the **Reviews** tab on a Work page.
2. User clicks **"Write a Review"**.
3. User inputs dimensional scores (Story, Art, Characters) and writes pros/cons.
4. Clicking **Publish Review** creates the `WorkReview` aggregate and recalculates the work's aggregated Bayesian average rating.
5. Other readers can read the review and click **"Helpful (👍 42)"**.

---

## UC-25: Public User Profiles with Reading Analytics

### Overview
Showcases user profiles with customized avatars, banners, bios, reading streak counters, total chapters read, and an interactive **Genre Preference Radar Chart**.

### Actor
- Reader

### Profile Features
- **Header**: Avatar, Banner, Bio, Badges (e.g. `Scanlator`, `VIP Reader`, `Top Reviewer`).
- **Reading Stats**:
  - Total Chapters Read (e.g., `4,219`).
  - Total Works Completed (e.g., `87`).
  - Daily Reading Streak (e.g., `45 Days 🔥`).
- **Analytics Radar Chart**: Polygon radar showing distribution across genres (`Action: 85%`, `Fantasy: 70%`, `Romance: 20%`, `Mystery: 45%`, `Sci-Fi: 30%`).
- **Public Shelves & Favorites**: Pinned favorite manga covers and public curated collections.
- **Activity Feed**: Recent comments, reviews, and completed series.

---

## UC-26: User & Scanlation Group Following

### Overview
Enables social connectivity by allowing users to follow their favorite scanlation teams, authors, and fellow community reviewers, generating an aggregated personal social activity stream.

### Actor
- Registered Reader

### Primary Flow
1. Reader visits a scanlation group profile (`/groups/flame-scans`) or user profile (`/user/alice`).
2. Reader clicks **"Follow"**.
3. The relationship is stored via `POST /api/v1/social/follow/:targetId?type=GROUP|USER`.
4. Activity from followed entities (e.g., new chapter translations published by FlameScans, new reviews written by Alice) flows into the reader's unified **Activity Feed** (`/feed/social`).
