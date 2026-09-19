# Readora screens at each size

Phone < 768px · tablet 768–1023px (portrait) · tablet landscape / laptop 1024–1279px · desktop ≥ 1280px.
"Now" says what the code does today; gaps carry their backlog id (`frontend/AGENTS.md`). Paths are under
`frontend/src/app/`.

## Header and navigation (`features/layout/shell/`)
- Target:
  - **Phone:** logo, search icon (expands to the combobox), notification bell, account and a menu button that opens
    the primary nav as a disclosure (`aria-expanded`), or a bottom tab bar with 3–5 items and
    `env(safe-area-inset-bottom)` padding.
  - **Tablet and up:** today's single row.
- Now: one non-wrapping flex row with no small-screen variant (F39). The nav list wraps, the rest gets squeezed.
- Keep the skip link first and the bell visible at every size.

## Catalog grids (works, library, history, rankings, updates)
- Cover grid: `repeat(auto-fill, minmax(min(100%, 9rem), 1fr))`, which gives 2 columns on phones and grows without
  queries.
- Filters (type/status/audience, genre chips): stacked full-width selects on phones, a row from 768px; chips wrap.
- Covers get `sizes` (F43). Only the first cover is `priority`.

## Work detail (`features/catalog/work-detail-page/`)
- Phone: cover above the title and actions, actions full width; chapter list full width.
- From 768px: cover beside the info (today's `max-width: 640px` query inverted to mobile-first when touched, F41).
- Ratings (`@defer`) keeps its placeholder height.

## Reader (`features/reader/reader-page/`)
- **Vertical mode:** pages at full width on phones (`max-inline-size: 100%`), centred and capped on large screens.
  Native scrolling; no fixed heights.
- **Paged mode:** one page at every size. Double page (`DOUBLE_PAGE_MEDIA_QUERY`, 1024px, set after hydration via
  `matchMedia`) only when the user enabled spreads and the screen is wide; landscape tablets qualify.
- Heights use `dvh`, not `100vh` (F40), so the page isn't hidden under the mobile URL bar.
- Swipe (`paged-flow.ts`, horizontal travel threshold, mirrored in RTL) plus visible prev/next buttons plus keyboard;
  tap zones are shortcuts.
- Zoom +/- buttons (50–200%) plus native pinch; never block pinch.
- Toolbar: wraps on phones; zen mode hides chrome, and focus brings it back.
- Settings and chapter list panels: full width sheets on phones, side panels from 1024px.
- Reader pages use `sizes="100vw"` (`50vw` per page in spreads).

## Dialogs (`shared/ui/dialog/`)
- Phone (< 600px): full-screen sheet, `inline-size: 100%`, `block-size: 100dvh`, sticky title and actions,
  safe-area padding.
- Larger: centred, `min(width, 90vw)` (today), `max-block-size: 90dvh` with the body scrolling.
- Focus trap and Escape unchanged at every size.

## Scanlation board (`features/scanlation/scanlation-board-page/`)
- Phone: columns scroll horizontally with `scroll-snap-type: x mandatory`, each column `scroll-snap-align: start`,
  `inline-size: 85vw`; or a stage switcher. Today: fixed 260px columns in an `overflow-x: auto` row. Scrolling works,
  but there is no snap.
- The scroll container is a labelled region with `tabindex="0"` so keyboard users can scroll it.
- Buttons (Claim, Submit, Publish), never drag-only.

## Upload studio (`features/upload/upload-studio-page/`)
- Wizard steps stack vertically on phones; the step indicator wraps (`wizard-steps`).
- On touch (`pointer: coarse`) the drop zone text says "Choose files" and the file button is prominent; drag and drop
  is an extra.
- Page grid: `auto-fill` thumbnails, with the "Move left/right" buttons still reachable (at least 24px) on touch.

## Forms (auth, profile, lists, reports)
- Full-width fields on phones, centred and capped at 480px on larger screens (`.page-narrow` in `styles.scss`).
- The submit button stays visible above the virtual keyboard: no fixed footers, or `interactive-widget=resizes-content`.
- `autocomplete` and `inputmode`/`type` (email) so phones show the right keyboard.

## Notification bell popover (`features/layout/shell/notification-bell/`)
- `min(22rem, 90vw)` wide, `max-block-size: 70dvh` (today 70vh) with scroll. On phones it may become a full-width panel
  under the header.
