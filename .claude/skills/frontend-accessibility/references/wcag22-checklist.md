# WCAG 2.2 AA criteria that matter for Readora

★ = new in WCAG 2.2. 4.1.1 Parsing was removed in 2.2 and no longer needs testing. WCAG 3.0 is still a working draft,
so keep targeting 2.2 AA.

| Criterion | Level | What to check in Readora |
|---|---|---|
| 1.1.1 Non-text content | A | Reader pages `Page N[: description]`; covers `Cover of <title>`; decorative/preload images `alt=""`; icon buttons named |
| 1.3.1 Info and relationships | A | Headings in order (one `h1` per page); lists as `ul/li` (comment thread, chapter list); labels tied to inputs; fieldset/legend for radio groups (reader settings) |
| 1.3.4 Orientation | AA | Nothing locked to portrait or landscape (reader double page adapts, never forces) |
| 1.4.3 Contrast (minimum) | AA | Text 4.5:1, large text 3:1: token pairs in `styles.scss` (`--muted` on `--surface` etc.) |
| 1.4.4 Resize text | AA | rem/em font sizes; 200% text zoom without loss |
| 1.4.10 Reflow | AA | No horizontal scroll at 320 CSS px (header, forms, catalog, dialogs); reader page image exempt, its controls not |
| 1.4.11 Non-text contrast | AA | Borders of inputs, focus rings, icons, toggles: 3:1 |
| 1.4.12 Text spacing | AA | No clipped text with increased line/letter/word spacing (avoid fixed heights on text boxes) |
| 1.4.13 Content on hover or focus | AA | Popovers/tooltips: Escape dismisses, pointer can move onto them, they stay until dismissed |
| 2.1.1 Keyboard | A | Every action by keyboard: reader turns (arrows/Space/PageUp/Down), menus, tabs, kanban claim/submit/publish, upload |
| 2.1.2 No keyboard trap | A | Only modal dialogs trap focus, and Escape releases it |
| 2.1.4 Character key shortcuts | A | Reader single-key shortcuts ignored in inputs and dialogs |
| 2.4.1 Bypass blocks | A | Skip link `#main-content` in `shell.html` |
| 2.4.2 Page titled | A | Unique title per route (`SeoService.update` / `private_`) |
| 2.4.3 Focus order | A | DOM order = visual order; dialogs focus inside; after navigation the shell focuses the page `h1` |
| 2.4.6 Headings and labels | AA | Descriptive headings and labels |
| 2.4.7 Focus visible | AA | `:focus-visible` rings everywhere, never removed without replacement |
| ★ 2.4.11 Focus not obscured (minimum) | AA | Sticky header / reader toolbar / notification popover never fully cover the focused element (`scroll-margin`) |
| 2.5.1 Pointer gestures | A | Swipe in paged mode has prev/next buttons; pinch has zoom buttons |
| 2.5.3 Label in name | A | Visible label text is part of the accessible name (don't override "Add to library" with an unrelated aria-label) |
| ★ 2.5.7 Dragging movements | AA | Upload drop zone has a file-picker button; any future kanban drag needs a "Move to…" alternative |
| ★ 2.5.8 Target size (minimum) | AA | ≥ 24×24 CSS px or 24px spacing circle: comment actions, chips, pager, kanban card buttons, close buttons |
| 3.1.1 Language of page | A | `<html lang>` set |
| 3.2.1 / 3.2.2 On focus / on input | A | No navigation or submit on focus/select alone (filters apply on change is fine when announced) |
| ★ 3.2.6 Consistent help | A | Help/contact links in the same place on every page (footer/header) |
| 3.3.1 / 3.3.3 Error identification / suggestion | A/AA | `app-field-errors` text says what's wrong and how to fix |
| 3.3.2 Labels or instructions | A | Visible labels, required markers (`aria-hidden` asterisk + required in the name) |
| ★ 3.3.7 Redundant entry | A | Upload wizard: never re-ask series data already entered; prefill |
| ★ 3.3.8 Accessible authentication (minimum) | AA | Login/register: paste allowed, `autocomplete` set, no cognitive test / puzzle CAPTCHA |
| 4.1.2 Name, role, value | A | Custom widgets expose role + state (`aria-expanded`, `aria-pressed`, `aria-selected`) |
| 4.1.3 Status messages | AA | Saves, uploads, errors, search counts, page position announced via persistent `role="status"`/`alert` regions |
