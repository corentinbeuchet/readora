---
name: frontend-responsive
description: How Readora's frontend adapts to window sizes (phone, tablet, desktop, landscape, zoom) with SSR in mind. Use for every change to layout, SCSS, images, the header/navigation, dialogs, the reader, the kanban board, the upload studio or forms, for "mobile", "tablet", "breakpoint" or "viewport" work, and for responsive reviews.
---

# Phone, tablet and desktop

The layout must work from **320 CSS px** (phones, or 1280px at 400% zoom) to wide desktops, in both orientations,
with touch, mouse and keyboard. The prerendered HTML has no `window`, so the first paint must be right with CSS alone.
Screen by screen expectations: `references/patterns.md`. Accessibility side (reflow, target size, gestures): the
`frontend-accessibility` skill.

## Strategy
- **Mobile-first:** base styles are the phone layout; add `@media (min-width: …)` layers. New code never adds
  `max-width` queries. The existing ones in `works`/`work-detail`/upload steps are backlog F41.
- **One breakpoint set:** `480px` (large phone), `768px` (tablet portrait), `1024px` (tablet landscape / small laptop,
  and the reader's double page, `DOUBLE_PAGE_MEDIA_QUERY` in `reader-page.ts`), `1280px` (desktop). Custom properties
  can't be used in media conditions; until shared SCSS breakpoint mixins exist (F41), write these values, nothing else.
  Pick the breakpoint where the content breaks, not a device name.
- **Intrinsic layout before any query:**
  - covers: `grid-template-columns: repeat(auto-fill, minmax(min(100%, 9rem), 1fr))`;
  - toolbars and chips: `flex-wrap`;
  - readable text: `max-inline-size: 65ch`;
  - sizes: `clamp()` with a rem term (`clamp(1.5rem, 1.1rem + 2vw, 2.5rem)`), so text still grows with user zoom;
  - `min(22rem, 90vw)` for popovers.
- **Container queries** (`container-type: inline-size` + `@container (min-width: …)`, Baseline) for components that
  appear in different widths (cover card, kanban column, dialog body); media queries for page layout and user
  preferences.
- **Logical properties** (`margin-inline`, `padding-block`, `inset-inline-end`, `inline-size`).
- **Long text:** flex/grid children that hold titles get `min-width: 0` + `overflow-wrap: anywhere`, the usual cause of
  overflow at 320px.

## Viewport
- `index.html` has `width=device-width, initial-scale=1`. Never add `user-scalable=no` or `maximum-scale`.
- Full-height views use `min-height: 100dvh` (with `100vh` first as a fallback) or `svh` for sticky layouts, never
  bare `100vh`, which is hidden behind mobile browser bars. Today `100vh` is in the shell, reader, paged/vertical flows
  and kanban (F40).
- Fixed or sticky bars at the screen edge pad with `env(safe-area-inset-*)`, which only works once `viewport-fit=cover`
  is in the meta tag (F42). Add both together, never one alone.
- Forms and search at the bottom of the screen: the virtual keyboard doesn't change viewport units;
  `interactive-widget=resizes-content` in the viewport meta, or `visualViewport` in code, when a sticky footer must
  stay above it.

## Input: touch, mouse, keyboard
- Hover effects only under `@media (hover: hover) and (pointer: fine)`. Anything revealed on hover (card actions) must
  also be visible on touch and on `:focus-visible`.
- `@media (pointer: coarse)` enlarges hit areas: targets at least 24×24px (WCAG 2.5.8), aim for 44px on touch. Grow
  the hit area with padding, or a `::before` inset, without changing the look.
- `touch-action: manipulation` on buttons and tap zones (no double-tap zoom delay); the paged reader surface may use
  `pan-y`; never disable pinch zoom on the page.
- Every swipe (paged reader) and drag (upload drop zone, page reorder) has buttons too.

## Angular and SSR
- **CSS first.** A JS breakpoint only when the component *tree* must differ (e.g. the reader's single versus double
  page logic), and then:
  - read `matchMedia` inside `afterNextRender`, listen for `change`, and feed a signal (model: `reader-page.ts`,
    `state.setWideScreen()`);
  - the prerendered HTML uses the mobile-first default, and the JS value only refines it after hydration;
  - never branch on `window` or a breakpoint during render (hydration mismatch, flash).
- `@angular/cdk/layout` (`BreakpointObserver`) is not installed and not needed for this; add it only if many
  components need JS breakpoints.
- **Images:** `NgOptimizedImage` with a `sizes` attribute matching the layout (covers:
  `sizes="(min-width: 1024px) 180px, 30vw"`; reader pages `100vw`, or `50vw` for spreads), so phones don't download
  desktop images. `priority` only on the LCP image. `app-work-cover` doesn't pass `sizes` yet (F43).
- `@defer (on viewport)` placeholders reserve the final height (no layout shift).
- `@media (prefers-reduced-motion: no-preference)` wraps animations (F45); `prefers-color-scheme` isn't used (one
  theme).

## Common mistakes
`100vh` for full-screen views; blocked zoom; hover-only actions; targets under 24px; JS breakpoints deciding the
prerendered DOM; device-named breakpoints and a pile of one-off pixel values; `px` font sizes or `clamp()` without a
rem term; covers without `sizes`; `viewport-fit=cover` without `env()` padding; swipe or drag with no buttons;
titles overflowing at 320px (`min-width: auto` on flex/grid children); testing only in DevTools device mode.

## Testing
- Check changed screens at **320, 375, 768, 1024 (portrait and landscape) and 1280** px with Playwright MCP
  (`browser_resize`) or the Playwright device projects (`Mobile Chrome`/Pixel 5, `Mobile Safari`/iPhone 12 in
  `playwright.config.ts`).
- Assert no horizontal overflow: `document.documentElement.scrollWidth <= window.innerWidth`.
- Also check 200% and 400% browser zoom, landscape phone, and `emulateMedia({ reducedMotion: 'reduce' })`.
- Emulation misses the collapsing URL bar, `dvh` changes, the virtual keyboard, safe areas and iOS Safari quirks:
  check on a real phone before a release. Mobile-viewport e2e checks are backlog F46.

## Sources
web.dev/learn/design (media features, interaction, screen configurations); web.dev/blog/viewport-units;
developer.mozilla.org (container queries, env(), touch-action); w3.org WCAG 1.4.10 reflow and 2.5.8 target size;
angular.dev/guide/image-optimization and /api/core/afterNextRender; material.angular.dev/cdk/layout;
github.com/angular/components#18680 (SSR breakpoint flash); Playwright emulation docs.
