---
name: frontend-accessibility
description: Readora's accessibility checklist (WCAG 2.2 AA, WAI-ARIA APG patterns, Angular 22 / @angular/aria). Use for every frontend change that touches templates, styles, keyboard or focus behaviour, forms, dialogs, menus, tabs, search/combobox, drag-and-drop, the reader, images or page titles, and for accessibility reviews or audits.
---

# Accessibility (target: WCAG 2.2 AA)

`frontend/AGENTS.md` "Templates & a11y" holds the Readora rules; this is the checklist to apply while coding.
Details: `references/wcag22-checklist.md` (criteria → what to check here) and `references/patterns.md` (APG patterns
mapped to our components, with keyboard maps).

## Before writing markup
- Native element first: `<button type="button">` for actions, `<a routerLink>` for navigation, `<label>` + input,
  `<ul>/<li>` for lists, headings in order. **No ARIA is better than bad ARIA**, and a role is a promise: `role="menu"`,
  `tab`, `listbox` or `grid` commit you to their full keyboard behaviour.
- Existing accessible building blocks, reuse them:
  - `app-dialog` (`shared/ui/dialog/`): `role="dialog"`, `aria-modal`, `labelledBy`, and `appFocusTrap`
    (`core/a11y/focus-trap.directive.ts`: initial focus, Tab wrap, Escape, focus return).
  - `@angular/aria` (stable in v22): Menu (account menu in `features/layout/shell/shell.html`), Tabs (profile page),
    Toolbar (`reader-toolbar`); also Listbox, Combobox, Select, Accordion, Tree and Grid are available. There is no
    dialog pattern in it: use `app-dialog`.
  - Forms: `[appAriaInvalid]` + `aria-describedby` + `<app-field-errors>`.
  - Shared styles: `.sr-only`, `.form-error`, `:focus-visible` rings in `styles.scss`.

## Checklist
- **Name, role, value (4.1.2):** every control has an accessible name. Icon-only buttons get `[attr.aria-label]`, and
  the label follows state ("Mark as read" vs "Marked as read"). Toggles expose `aria-pressed` or `aria-checked`;
  disclosures expose `aria-expanded` + `aria-controls`.
- **Keyboard (2.1.1, 2.4.3):** everything reachable and operable in DOM order. No `(click)` on `div`/`span`
  (eslint `click-events-have-key-events`, `interactive-supports-focus`). Roving focus inside composite widgets
  (toolbar, tabs, listbox) is handled by `@angular/aria`, so don't hand-roll it.
- **Focus visible and not obscured (2.4.7, 2.4.11):**
  - never `outline: none` without a `:focus-visible` replacement;
  - a focused element must not sit under a sticky header or toolbar (`scroll-margin`/`scroll-padding`);
  - auto-hidden reader controls reappear on focus.
- **Focus management:**
  - Dialogs: focus moves in, is trapped, returns to the trigger on close.
  - Popovers (notification bell): Escape closes and returns focus.
  - Never destroy the focused element with an `@if` swap without moving focus somewhere sensible.
  - After a route change the shell focuses the page's `h1` (or `<main>` while loading) when the path changes
    (`features/layout/shell/shell.ts`); every route sets a unique title through `SeoService`.
- **Status messages (4.1.3):**
  - The `role="status"` (polite) / `role="alert"` (errors only) container must exist before its text changes: keep
    it rendered and change only the text. Wrapping the region itself in `@if` makes screen readers miss the message.
  - Short messages; debounce counts (search results).
- **Forms:** visible `<label>` (never placeholder-only), errors linked and announced, `autocomplete` on identity fields
  (`email`, `current-password`, `new-password`), paste and password managers allowed, no puzzle CAPTCHA (3.3.8).
  Multi-step flows don't ask twice for the same data (3.3.7, upload wizard).
- **Pointer and gestures:**
  - Every drag (upload drop zone, any future kanban drag) and every swipe (paged reader) has a single-pointer or
    button alternative (2.5.7, 2.5.1).
  - Targets at least 24×24 CSS px or enough spacing (2.5.8); aim for 44px on touch.
- **Contrast:** colours only from tokens (`styles.scss`); text 4.5:1 (3:1 for large), UI borders, focus rings and icons
  3:1 (1.4.11); text over artwork needs a solid or scrim background.
- **Motion:** a global `prefers-reduced-motion: reduce` rule in `styles.scss` neutralises animations and transitions;
  new motion that matters (e.g. page-turn effects) should also check it, and never animate without it.
- **Reflow and zoom:** usable at 320 CSS px and at 200%/400% zoom without horizontal scrolling (the page image itself
  is exempt). Never `user-scalable=no`. See the `frontend-responsive` skill.
- **Hover/focus content (1.4.13):** tooltips and popovers are dismissible with Escape, hoverable and persistent.
- **Images:** meaningful `alt`; decorative images `alt=""` (reader preload images). User-supplied text (page
  descriptions, comments) is rendered by interpolation, never `[innerHTML]`.

## Reader specifics (`features/reader/reader-page/`)
- Page alt text is `Page N: description` or `Page N` (`reader-state.ts`). Add descriptions where uploaders give them;
  never use the file name.
- Buttons for everything gestures do: previous/next (also swipe), zoom +/- (also pinch).
- Labels stay semantic in right-to-left reading ("Next page", not "Right"); keys follow the reading direction.
- Single-key shortcuts never fire in inputs or dialogs (already guarded in `reader-page.ts`); keep it that way (2.1.4).
- The page position is announced through the toolbar's polite live region.

## Common Angular mistakes to catch in review
`(click)` on non-interactive elements; `<a>` without `href` used as a button; no focus handling after navigation;
custom dialogs without trap/Escape/return; live regions created together with their message; global `outline: none`;
icon buttons without names; placeholder as label; errors not linked; drag without an alternative; ARIA roles without
their keyboard support; `@if`/`[innerHTML]` swaps that drop focus to `<body>`; hover-only tooltips.

## Testing
- `npm run lint`: the angular-eslint template accessibility rules are errors (`eslint.config.js`).
- Unit and component tests: query by role and label and assert ARIA state and focus (`document.activeElement`); see
  the `frontend-component-tests` skill.
- E2E: role/label locators; keyboard-only paths for dialogs, menus and the reader. axe runs in
  `tests/e2e/accessibility.spec.ts` through the `axe` fixture (WCAG 2.0/2.1/2.2 A and AA): add every new page, and
  scan again after opening dialogs, popovers and tabs, since hidden states aren't scanned. Target sizes and reflow are
  checked in `tests/e2e/responsive.spec.ts`.
- Automation finds about 57% of issues (Deque). Name quality, focus order, alt text, 2.5.7, 3.3.7 and 3.3.8 need a
  manual pass; do a screen reader smoke test (NVDA + Firefox/Chrome, VoiceOver + Safari) on changed flows.

## Sources
w3.org/WAI/standards-guidelines/wcag/new-in-22; w3.org/WAI/WCAG22/Understanding/target-size-minimum;
w3.org/WAI/ARIA/apg (read-me-first, patterns); angular.dev/best-practices/a11y; angular.dev/guide/aria/overview;
github.com/dequelabs/axe-core-npm (playwright); deque.com automated-testing study (57%); w3.org/TR/wcag-3.0 (draft,
keep targeting 2.2).
