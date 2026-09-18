# Module 2: Catalog Discovery & Advanced Filtering

Inspired by **comix.to**, Readora provides high-precision catalog discovery featuring tri-state tag logic, multi-dimensional facet filtering, live instant omnisearch with keyboard triggers, weekly release calendar scheduling, and a random title roulette.

---

## UC-09: Multi-Tag Tri-State Filtering

### Overview
Allows readers to filter works using a 3-state tag selector: **Include** (Green `+`, must contain tag), **Exclude** (Red `-`, must NOT contain tag), and **Neutral** (untagged/ignored). Enables complex boolean queries (e.g. Include `Action` AND `Fantasy`, while strictly excluding `Harem` and `Isekai`).

### Actor
- Reader (Guest / Registered)

### Preconditions
- Works are indexed in PostgreSQL with genre/theme tag arrays (`tags text[]` or JSONB).

### Tri-State Behavior Model
| State | UI Representation | Query Logic |
|---|---|---|
| **Neutral** (Default) | Gray Pill / Outline | Ignored in SQL WHERE clause |
| **Included (+)** | Solid Emerald Green with `+` icon | Added to `included_tags`: `work.tags @> ARRAY['Fantasy']` |
| **Excluded (-)** | Solid Rose Red with `−` icon | Added to `excluded_tags`: `NOT (work.tags && ARRAY['Harem'])` |

### Primary Flow
1. User navigates to `/catalog` or `/explore`.
2. A tag cloud displays all registered genres, themes, and content warnings.
3. Clicking a tag once cycles it to **Included (+)**.
4. Clicking it a second time cycles it to **Excluded (−)**.
5. Clicking a third time resets it to **Neutral**.
6. The client debounces tag state changes (300ms) and dispatches a catalog query to `/api/v1/catalog/search`:
   ```json
   {
     "includedTags": ["Action", "Fantasy", "Reincarnation"],
     "excludedTags": ["Harem", "Mecha", "Gore"],
     "page": 0,
     "size": 24
   }
   ```
7. Search results render as responsive responsive responsive book cards with cover art, rating badges, and latest chapter tags.
8. The filter state is synchronized to browser URL query parameters: `?include=Action,Fantasy&exclude=Harem`.

### Technical Implementation (PostgreSQL & Spring Data)
```sql
SELECT w.* FROM works w
WHERE (:includedTagsCount = 0 OR w.genres @> :includedTags)
  AND (:excludedTagsCount = 0 OR NOT (w.genres && :excludedTags))
ORDER BY w.updated_at DESC
LIMIT :size OFFSET :offset;
```

---

## UC-10: Multi-Dimensional Faceted Catalog Search

### Overview
Comprehensive faceted search combining demographic, country of origin, publication status, content rating, chapter count range, and release year range.

### Actor
- Reader

### Filter Dimensions
- **Demographic**: `Shounen`, `Seinen`, `Shoujo`, `Josei`, `None`
- **Origin / Type**: `Manga` (Japan), `Manhwa` (Korea), `Manhua` (China), `Comic` (Western), `Webtoon`
- **Publication Status**: `Ongoing`, `Completed`, `Hiatus`, `Cancelled`
- **Content Rating**: `Safe`, `Suggestive`, `Erotica` (Adult filter gate)
- **Chapter Count Range**: Min / Max slider (e.g., `50+ chapters`, `100+ chapters`)
- **Release Year Range**: Range slider from `1970` to current year.

### Primary Flow
1. The user opens the filter sidebar on the Catalog page.
2. The user selects facets: `Origin: Manhwa`, `Status: Completed`, `Min Chapters: 50`, `Content: Safe`.
3. The catalog results update reactively with active filter chips displayed above the grid.
4. Clicking `[Clear All Filters]` resets the facet store back to default pagination.

---

## UC-11: Dynamic Ranking & Trending Engine

### Overview
Provides algorithmic rankings that showcase popular and hot works across multiple time windows (Daily, Weekly, Monthly, All-Time) as well as Top Rated and Most Bookmarked lists.

### Actor
- Reader

### Ranking Categories
1. **Trending Now (Hot)**: Real-time velocity score based on chapter view counts, comments, and bookmark additions over the past 24 hours / 7 days.
2. **Top Rated**: Bayesian weighted average score of 10-star user ratings (minimum 5 ratings required).
3. **Most Popular / Most Bookmarked**: Total count of active library additions.
4. **Latest Updates**: Works with the most recently published chapters.

### Algorithmic Score Formula (Trending)
$$\text{Score} = \frac{V_{24h} \times 1.0 + C_{24h} \times 3.0 + B_{24h} \times 5.0}{(T_{\text{hours}} + 2)^{1.5}}$$
Where $V$ is chapter views, $C$ is comments posted, $B$ is bookmarks added, and $T$ is time decay in hours.

### Primary Flow
1. User clicks **Trending** or **Top Charts** on the main navigation bar.
2. User selects timeframe tab: `Today` | `This Week` | `This Month` | `All Time`.
3. Results render in a ranked leaderboard layout (positions #1 to #100) with visual rank badges and delta arrows (`▲ +3`, `▼ -1`, `NEW`).

---

## UC-12: Instant Omnisearch Overlay with Live Previews

### Overview
Global `Ctrl+K` / `Cmd+K` keyboard-activated omnisearch dialog with debounced sub-50ms autocomplete, live cover thumbnails, author details, genre tags, and quick-access chapter jump links.

### Actor
- Reader

### Primary Flow
1. User presses `Ctrl+K` (or clicks the search icon in the top header).
2. A modal overlay appears with an auto-focused search input.
3. As the user types (e.g. "solo"), the Angular component debounces input by 150ms and queries `/api/v1/catalog/omnisearch?q=solo`.
4. PostgreSQL trigram indexing (`pg_trgm`) matches primary title, romanized titles, alternative aliases, and author names.
5. Results are categorized instantly:
   - **Works (Matches)**: Displays cover thumbnail, title, author, year, score (`★ 9.4`), and latest chapter link (`Ch. 179`).
   - **Authors / Artists**: Direct link to creator index.
   - **Scanlation Groups**: Direct link to group translation profiles.
6. Using keyboard `Up`/`Down` arrows highlights results; pressing `Enter` navigates directly.
7. Pressing `Escape` closes the omnisearch overlay instantly.

### Acceptance Criteria
- Omnisearch responds within < 100ms on indexed catalog queries.
- Keyboard navigation is fully accessible without mouse interaction.

---

## UC-13: Weekly Release Schedule Calendar

### Overview
Interactive weekly calendar view displaying planned and recurring chapter releases by day of the week (Monday through Sunday) for ongoing serialized works.

### Actor
- Reader

### Primary Flow
1. User navigates to `/schedule`.
2. The view displays a 7-day calendar tab view (Monday to Sunday) defaulting to the current weekday.
3. Each day card lists series that regularly release chapters on that day, showing:
   - Work cover thumbnail and title.
   - Expected release time (localized to reader's timezone).
   - Latest chapter number released vs expected next chapter.
   - "In Library" bookmark indicator badge if the user follows this series.
4. User can toggle between **All Series** and **My Tracked Series Only**.
5. Clicking a release tile takes the user directly to the latest chapter or series landing page.

---

## UC-14: Random Manga Roulette ("Surprise Me")

### Overview
A fun discovery feature that randomly picks a high-quality series from the catalog based on optional reader preferences, mimicking comix.to's random surprise engine.

### Actor
- Reader

### Primary Flow
1. User clicks the **Surprise Me / Random** button in the top navigation or sidebar.
2. An optional quick modal allows the user to specify preferences:
   - Genre filter (e.g., Must include `Action` or `Romance`).
   - Minimum rating (e.g., `★ 7.5+`).
   - Minimum chapters (e.g., `20+ chapters`).
3. User clicks **"Spin Roulette"**.
4. A playful 1-second slot-machine rolling animation displays spinning cover art.
5. The reader is seamlessly redirected to the selected work's landing page `/works/:slug`.
6. A notification banner offers: *"Not feeling it? [Spin Again]"*.

### Technical Endpoint
- `GET /api/v1/catalog/random?minRating=7.0&minChapters=10&includedTags=Fantasy`
- Implemented via fast random indexed sampling (`TABLESAMPLE` or `ORDER BY RANDOM()` on candidate ID set).
