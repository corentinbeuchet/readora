---
name: frontend-visual-design
description: Readora's visual language and how to apply it (colour and surfaces, type, icons, the series card, rails, skeletons, empty states, the home page, the header and phone tab bar). Use for every change to how the frontend looks or is composed - new pages or sections, new shared UI, navigation entries, colours or tokens, loading and empty states, copy in the interface - and for design reviews. Rules live in frontend/AGENTS.md "Design"; this is the checklist and the evidence behind it.
---

# Designing Readora

Source of truth: `frontend/AGENTS.md` "Design" (read it for the rules and the why). This skill is the checklist to
apply while designing, `references/evidence.md` holds the research each rule comes from (with URLs), and
`scripts/contrast.mjs` checks colours. Layout mechanics: `frontend-responsive`. Markup and focus:
`frontend-accessibility`. Angular conventions: `angular-best-practices`.

## The identity in three lines
- **Ink, paper, screentone.** Manga is black ink and halftone dots on paper, with loud magazine-cover type.
- **The covers bring the colour.** The interface is neutral grey with one accent (persimmon), dark by default.
- **One bold thing.** Screentone and the condensed display type are the signature; everything around them stays quiet.

## Before designing anything
1. Say who the screen is for and the one thing they came to do. The primary action gets the only filled button.
2. Look at what exists (`src/app/shared/ui/`): a series is always `<app-work-card>`, a list of them `.work-grid` or
   `.work-rows`, a line of them `<app-rail>`, a reading list `<app-list-card>`. Compose these before writing markup.
3. Decide the four states of every list up front: loading (skeleton), error (retry), empty (one action), content.
4. Write the real words first (sentence case, plain verbs). If the copy is hard to write, the screen is unclear.

## Shared pieces and their inputs
| Piece | Use | Inputs / slots |
|---|---|---|
| `app-work-card` | any series, anywhere | `work`, `variant` grid or row, `rank`, `newChapters`, `priority`; `[cardMeta]`, `[cardActions]` |
| `app-work-card-skeleton` | a list of series loading | `variant` grid, row or rail, `count`; projected loading text |
| `app-rail` | a section that scrolls sideways | `heading`, `seeAll`, `seeAllParams`; project `<li class="rail-item">` (`rail-item-wide` for rows) |
| `app-section-header` | heading of a section | `heading`, `headingId`, `seeAll`, `seeAllParams`; projected extras |
| `app-empty-state` | nothing to show | projected message; `[emptyAction]` one button or link |
| `app-list-card` | a reading list | `list`, `showVisibility` |
| `app-icon` | every icon | `name` (typed), `filled`; add one in `scripts/generate-icons.mjs`, then `npm run icons` |
| `app-load-error` | a failed load | `error`, `notFound`, `(retry)`; `[actions]` |

## Checklist
**Colour and surfaces**
- [ ] Only tokens. Depth comes from the surface steps (`--surface`, `--surface-2`, `--surface-3`), not shadows;
      `--elev-*` only for menus, dialogs and the featured cover.
- [ ] `--accent` for text, links, outlines; `--accent-strong` + `--on-accent` for fills. No new hue, no gradient.
- [ ] Changed a colour token? `node .claude/skills/frontend-visual-design/scripts/contrast.mjs` exits 0.
- [ ] No text on screentone or on artwork without a plain surface or `--overlay*` under it.

**Type**
- [ ] Headings, rank numerals, the logo: display voice (`--wdth-display`, `--fw-black`). Everything else: text voice.
- [ ] Numbers that line up or change (ranks, scores, counts): `font-variant-numeric: tabular-nums`.
- [ ] Paragraphs no wider than `--measure`; `--lh-tight` for headings, `--lh-snug` for card titles, `--lh-text` for prose.

**Shape, space, motion**
- [ ] Radius by role: covers `--radius-sm`, controls and cards `--radius-md`, panels and dialogs `--radius-lg`, chips `--radius-pill`.
- [ ] Spacing from `--space-*`; page width `--page-max`; breakpoints only through `bp.from()`.
- [ ] Motion answers an action and uses `--dur-*` / `--ease-out` (`--ease-in-out` for on-screen movement), under
      300 ms. Nothing fades in on load, rotates or advances alone; nothing animates on a keyboard action or a
      repeated one. Named properties, `transform`/`opacity` only; `:hover` through `@include ix.hover`.

**Cards, lists, states**
- [ ] One link per card (the title, stretched); cover `alt=""`; at most two badges; actions outside the link.
- [ ] No heading element inside a repeated card; the section has the heading (a single featured article may have one).
- [ ] Loading is a skeleton in `role="status"` with the loading sentence for screen readers; empty has one action.
- [ ] Meta information is separate elements or badges with a gap, never a string joined by "·".
- [ ] The first image of the page has `priority`, and only that one.

**Navigation and pages**
- [ ] At most five primary entries on screen; a new one replaces or earns its place. Team tools stay in the account menu.
- [ ] No second link to the same page in the same view (the footer is the exception: it is far from the header).
- [ ] A page has one `h1` inside `<main>` from the first render (focus and tests rely on it).
- [ ] Home page: live and personal data behind the `live` signal, never prerendered.

**Words**
- [ ] Sentence case. A button says what happens ("Create a free account", not "Submit").
- [ ] An error says what went wrong and what to do; an empty screen says what belongs there.
- [ ] Accounts are offered where they help, after the content. No popup, no wall, no countdown.

## What this design avoids (the tells of a templated interface)
All-caps tracked labels above headings; "A · B · C" meta strings; 01 / 02 / 03 numbering on things that are not a
sequence (rankings are, so they get big numerals); one radius and one soft shadow on everything; gradient washes;
fade-and-slide entrances on every section; emoji as icons; an arrow appended to every link; a hero that is a big
number with a small label.

## Review before committing
- [ ] Looked at it: 375px and 1280px, dark and light, English and French (`npm run start`, `npm run start:fr`).
- [ ] `npm run lint`, unit tests, build (`verify` skill); every component stylesheet under 4 kB.
- [ ] E2E with the stack started as `READORA_AUTH_RATE_LIMIT=200 docker compose up -d`: `accessibility.spec.ts`
      (axe, both themes), `responsive.spec.ts` (320 to 1024px, tab bar, 24px targets, no clipped tab label),
      `i18n-fr.spec.ts` (French at 320px).
- [ ] A new pattern or shared piece is added to `frontend/AGENTS.md` "Design" and to the table above.
