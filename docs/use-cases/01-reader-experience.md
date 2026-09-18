# Module 1: Reader Engine & Viewing Experience

Inspired by **comix.to**, the Reader Engine is the cornerstone of Readora. It is designed for near-instant rendering, frictionless reading continuity, and full keyboard/gesture customization.

---

## UC-01: Multi-Mode Chapter Viewing

### Overview
Allows readers to dynamically toggle between three standard comic/manga/webtoon viewing formats: Vertical Webtoon (infinite continuous vertical strip), Single Page (Paginated with Left-to-Right or Right-to-Left binding), and Double Page Spread (two pages side-by-side with an optional first-page cover offset).

### Actor
- Guest Reader / Registered User

### Preconditions
- Chapter contains one or more valid `PageAsset` objects.
- Chapter status is `PUBLISHED` (or accessed by an authorized scanlation project member in preview mode).

### Primary Flow
1. The user navigates to `/read/:workSlug/:chapterNumber`.
2. The Angular `ReaderComponent` initializes the `ActiveReaderStore` with persisted viewer settings from `localStorage` (or defaults to `VERTICAL` for Manhwa/Webtoons and `PAGINATED_RTL` for Manga).
3. The reader renders pages according to the chosen mode:
   - **VERTICAL**: Pages stacked vertically in a single column with IntersectionObserver virtualized windowing.
   - **PAGINATED_LTR / PAGINATED_RTL**: Single page displayed with navigation click zones on screen halves or keyboard hotkeys.
   - **DOUBLE_PAGE_SPREAD**: Pairs consecutive pages (e.g., [Page 1, Page 2], [Page 3, Page 4]). If `firstPageOffset` is enabled, Page 1 is displayed standalone as a cover and subsequent pages are paired ([Page 1], [Page 2, Page 3], ...).
4. As the user changes the viewing mode via the reader settings menu or hotkey `V`, the view transitions smoothly without refetching image network assets.
5. The selected mode is persisted to `localStorage['readora_reader_mode']` and synced to the user profile if authenticated.

### Alternative & Exception Flows
- **Single Page on Spread**: If an odd number of pages exists in double spread mode, the final page renders solo.
- **Ultra-wide images in Webtoon mode**: The viewer auto-scales images exceeding viewport width to fit the container without horizontal overflow.

### Technical & State Contract (Angular Zoneless Signal Store)
```typescript
export type ReaderViewMode = 'VERTICAL' | 'PAGINATED_LTR' | 'PAGINATED_RTL' | 'DOUBLE_PAGE_SPREAD';

export interface ReaderSettingsState {
  viewMode: ReaderViewMode;
  firstPageCoverOffset: boolean;
  maxWidthPx: number | 'FIT_WIDTH' | 'FIT_HEIGHT' | '100%';
  stripMarginPx: number;
  autoScrollSpeed: number; // 0 = disabled, 1 - 10
  imageQuality: 'ORIGINAL' | 'WEBP_OPTIMIZED' | 'DATA_SAVER';
}
```

### Backend Hexagonal Integration
- **Inbound Port**: `ReadChapterUseCase.getChapterPages(ChapterId chapterId, ReaderContext context)`
- **Domain Event**: `ChapterViewedEvent(userId, workId, chapterId, timestamp)`

---

## UC-02: Gapless Webtoon Margin & Spacing Control

### Overview
Webtoons and digital manhwas require seamless 0px vertical margins between page slices to prevent visible seams or white lines between panels. Readers can fine-tune strip spacing (from 0px gapless up to 32px separated strip) and restrict container width (Fit Width, Fit Height, 100%, or custom pixel constraints).

### Actor
- Reader

### Preconditions
- Viewing mode is `VERTICAL`.

### Primary Flow
1. The user opens the Reader Quick Settings overlay.
2. The user adjusts the **Strip Margin** slider (range: `0px` to `32px`, default: `0px`).
3. The reader container immediately updates the CSS variable `--webtoon-page-gap` via reactive signal effect.
4. The user selects **Viewer Max Width** (`Fit Width` [720px max], `100% Full Container`, or custom `600px–1400px`).
5. Images render gaplessly with `display: block` and `vertical-align: bottom` preventing subpixel rendering seams.
6. The preferences are saved to `ActiveReaderStore`.

### Acceptance Criteria
- Setting margin to `0px` produces zero visible gaps or border lines between sliced images across high-DPI and standard screens.
- Width changes do not trigger page re-renders or reset the current scroll position.

---

## UC-03: Reader Zen / Fullscreen Immersive Mode

### Overview
Provides distraction-free reading by entering browser fullscreen and auto-hiding all top navigation headers, progress bars, sidebars, and control menus. Controls reappear seamlessly upon user interaction (pointer move, mouse hover over trigger edges, or single screen tap).

### Actor
- Reader

### Preconditions
- Reader is actively viewing a chapter.

### Primary Flow
1. The user clicks the **Zen Mode** button or presses the `Z` / `F` hotkey.
2. The reader requests the Browser Fullscreen API (`document.documentElement.requestFullscreen()`).
3. The UI state `zenMode` transitions to `true`:
   - Top navbar and site header are hidden with CSS slide-out animation.
   - Reader bottom drawer and floating side controls fade to 0% opacity.
4. When scrolling or reading, the viewport contains only the comic art.
5. If the user moves the mouse, hovers near the top/bottom boundary, or taps on mobile, the HUD controls softly reappear (opacity 1.0) with a 3-second inactivity auto-fade timer.
6. Pressing `Escape` or clicking **Exit Zen Mode** restores the standard UI layout.

### Acceptance Criteria
- Seamless fullscreen toggle across Chrome, Firefox, Safari, and mobile WebKit.
- Auto-hide timer cancels and resets on continuous touch or pointer movement.

---

## UC-04: Auto-Scroll with Speed Regulation

### Overview
Provides hands-free vertical reading by smoothly scrolling the document down at a configurable speed with instant pause/resume controls.

### Actor
- Reader (Vertical Webtoon Mode)

### Preconditions
- Reader is in `VERTICAL` viewing mode.

### Primary Flow
1. The user presses `Space` or clicks **Auto-Scroll** in the floating reader action bar.
2. A floating speed pill appears at the bottom-right showing the current speed (`1x` to `10x`, step `0.5x`).
3. The reader launches an animation frame loop (`requestAnimationFrame`) calculating continuous delta scroll offsets based on the selected multiplier.
4. When the user hovers over a speech bubble or holds the pointer, scrolling temporarily pauses (Hover-to-Read feature).
5. When the user reaches the end of the chapter, auto-scroll pauses and displays a prompt: "Auto-advance to Next Chapter in 3s" with a Cancel button.
6. Pressing `Space` or scrolling manually with mouse wheel instantly toggles/pauses auto-scroll.

### Acceptance Criteria
- Smooth sub-pixel scrolling using `window.scrollBy({ top: delta, behavior: 'auto' })` synchronized with `requestAnimationFrame` to prevent stutter (60 FPS minimum).
- Reaching bottom of chapter does not bounce or cause scroll loops.

---

## UC-05: Smart Image Preloading & Data Saver Quality Selection

### Overview
Ensures zero-latency page transitions by proactively caching upcoming pages in browser memory, alongside user-controlled bandwidth profiles (Original High-Res, WebP Optimized, and Data Saver compressed).

### Actor
- Reader

### Preconditions
- Work chapter pages are indexed with multiple quality variants in S3/CloudFront CDN.

### Primary Flow
1. Upon loading page $N$, the reader engine initiates background preloading for pages $N+1$ through $N+4$ via `new Image().src` or `fetch()` cache.
2. When the user approaches the last 3 pages of the current chapter, the reader pre-fetches the manifest of the next sequential chapter and preloads its first 2 pages.
3. If the user is on a metered connection or selects **Data Saver** in settings:
   - Asset requests append `?format=webp&quality=60&w=900` to CloudFront URLs.
   - Preload depth drops from 5 pages to 2 pages to conserve cellular data.
4. If network is high-speed and **Original** is selected, full-resolution lossless PNG/WebP assets are loaded.

### Acceptance Criteria
- Next page is available instantaneously with 0ms visual wait time on standard 4G/broadband connections.
- Preloading respects user `Save-Data: on` HTTP client headers automatically.

---

## UC-06: Keyboard Hotkeys & Mobile Touch Gestures

### Overview
Comprehensive hotkey bindings and 3-zone mobile tap gestures for full hands-free or one-handed operation.

### Hotkey Mapping Matrix
| Key Binding | Action |
|---|---|
| `Right Arrow` / `D` | Next Page (Paginated LTR) / Prev Page (RTL) |
| `Left Arrow` / `A` | Prev Page (Paginated LTR) / Next Page (RTL) |
| `Down Arrow` / `S` | Scroll down 300px (Webtoon mode) |
| `Up Arrow` / `W` | Scroll up 300px (Webtoon mode) |
| `Space` | Toggle Auto-Scroll (or advance page if Paginated) |
| `F` | Toggle Browser Fullscreen |
| `Z` | Toggle Zen Immersive Mode |
| `M` | Open Chapter & Settings Drawer |
| `C` | Open In-Reader Comments Overlay |
| `R` | Reload current page asset |
| `[` / `]` | Jump to Previous / Next Chapter |

### Mobile 3-Zone Touch Layout
```
+--------------------------------------------------+
|               Top Bar (Auto-Hides)               |
+-------------------+----------+-------------------+
|                   |          |                   |
|   Left Zone (30%) |  Center  |  Right Zone (30%) |
|   [Prev Page]     |   (40%)  |    [Next Page]    |
|                   |  [Menu/  |                   |
|                   |   HUD]   |                   |
|                   |          |                   |
+-------------------+----------+-------------------+
|             Bottom Progress Scrub Bar            |
+--------------------------------------------------+
```

---

## UC-07: In-Reader Corrupted / Broken Page Reporting & CDN Edge Fallback

### Overview
When a CDN page asset fails to load (HTTP 404, 502, network timeout, or decode error), the reader gracefully displays a broken-page placeholder with an instant "Retry" action, automatic CDN fallback edge switching, and one-click bug reporting to moderators.

### Actor
- Reader

### Primary Flow
1. An image fails to load in the reader (`(error)` event triggered on `<img>`).
2. The client reader component catches the error:
   - **Step 1 (Automatic Retry)**: Attempts automatic reload with cache-busting timestamp (`?retry=1`).
   - **Step 2 (Edge Fallback)**: If the primary CloudFront domain fails, reroutes the request to the secondary backup CDN mirror origin.
3. If fallback also fails, the placeholder displays:
   - "Page 7 failed to load."
   - **[Reload Image]** button.
   - **[Report Broken Page]** button.
4. Clicking **Report Broken Page** posts a lightweight triage event to `/api/v1/reports/broken-page` with `{ workId, chapterId, pageIndex, imageStorageKey, userAgent }`.
5. An instant toast appears: "Report submitted. Our team will verify this asset."

---

## UC-08: Reader Side Drawer Quick Navigation

### Overview
Slide-out side navigation drawer that allows readers to inspect all chapters of the current work, see read/unread status badges, jump to any chapter or page thumbnail, and switch scanlation group versions without leaving the reader view.

### Actor
- Reader

### Primary Flow
1. The user clicks the Chapter List icon in the reader header or presses `M`.
2. A side drawer smoothly slides in from the left containing:
   - **Work Header**: Cover, title, current chapter badge.
   - **Version / Group Selector**: Dropdown if multiple scanlation groups have translated this work.
   - **Filter & Search Bar**: Quick filter by chapter number (e.g. typing "45" filters list instantly).
   - **Chapter List**: Chronological or reverse-chronological list showing chapter number, title, release date, and progress indicator (Unread, In-progress, Read).
   - **Page Thumbnail Scrub Bar**: Visual filmstrip of page thumbnails for the active chapter.
3. Clicking a chapter immediately navigates to that chapter while preserving the reader's view mode and zoom settings.
4. Clicking outside the drawer or pressing `Escape` dismisses the drawer with no scroll disruption.
