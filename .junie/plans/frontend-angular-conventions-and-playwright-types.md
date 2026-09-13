---
sessionId: session-260913-035156-1fhb
---

# Requirements

### Overview & Goals
Three frontend-only cleanups in `frontend/`:

1. **Fix `playwright.config.ts` type errors** — `process` is not found because TypeScript 6 (`typescript ~6.0.2`) changed the default of `compilerOptions.types` from "all `@types/*`" to `[]`. `@types/node@24.13.4` is installed but never included. Confirmed by `npx tsc --noEmit -p tsconfig.json` → `TS2591: Cannot find name 'process'` at lines 6, 7, 8, 14.
2. **Extract inline `template`/`styles`** of the three feature components into sibling `.html` / `.scss` files (same pattern already used by `app.component.ts` via `templateUrl` + external files).
3. **Adopt the Angular v20+ naming convention** (no `.component` / `.service` file suffixes, no `Component` / `Service` class suffixes, `styleUrl`, no `standalone: true`, no blanket `CommonModule`) across components, the root `App`, services, and their spec files.

### Scope
**In scope (all under `frontend/`)**
- `tsconfig.json` — add `"types": ["node"]`.
- Components: `chapter-viewer`, `kanban-board`, `comment-tree`, and root `app`.
- Services: `reader-state`, `scanlation-state`.
- All importers: `app.routes.ts`, `main.ts`, unit specs under `tests/unit/**`.
- Documentation touch-up in `.readora/context/ARCHITECTURE.md` frontend section only if it references renamed files (currently it does not name component files → no change expected).

**Out of scope**
- Backend, Docker, CI workflows.
- Behavioural changes to components/services, selectors (`app-chapter-viewer`, etc.), routes, or CSS rules.
- E2E spec content (`tests/e2e/*.spec.ts` only import `@playwright/test`).
- `readora.models.ts`, `app.config.ts`, `app.routes.ts` file names (CLI still generates `app.config.ts` / `app.routes.ts`; models have no official suffix rule).

### User Stories
- As a developer, I want `playwright.config.ts` to type-check in the IDE and via `tsc` so that the e2e setup is not red.
- As a developer, I want each component's HTML and SCSS in their own files so that templates are readable, get proper IDE tooling, and TS files stay focused on logic.
- As a developer, I want file and class names to follow the current Angular style guide (`chapter-viewer.ts` / `ChapterViewer`) so that the codebase matches what `ng generate` produces today.

### Functional Requirements / Acceptance Criteria
- `npx tsc --noEmit -p tsconfig.json` reports **no** errors for `playwright.config.ts` (remaining errors, if any, must only be the pre-existing vitest-global errors in `tests/unit` which are covered by `tsconfig.spec.json`).
- `npx playwright test --list` loads the config successfully.
- Every component TS file uses `templateUrl` + `styleUrl`; no `template:` or `styles:` inline blocks remain in `src/app`.
- File layout after the change:
  - `src/app/app.ts`, `app.html`, `app.scss` → class `App`
  - `src/app/features/reader/components/chapter-viewer.ts|html|scss` → class `ChapterViewer`
  - `src/app/features/scanlation/components/kanban-board.ts|html|scss` → class `KanbanBoard`
  - `src/app/features/social/components/comment-tree.ts|html|scss` → class `CommentTree`
  - `src/app/features/reader/services/reader-state.ts` → class `ReaderState`
  - `src/app/features/scanlation/services/scanlation-state.ts` → class `ScanlationState`
  - specs renamed accordingly: `tests/unit/.../chapter-viewer.spec.ts`, `reader-state.spec.ts`, `scanlation-state.spec.ts`
- No `standalone: true` flags; `CommonModule` replaced by exact imports (`DatePipe` in `CommentTree` only; none for the others).
- `npm run build` and `npm run test:ci` succeed; the rendered DOM/CSS is unchanged (same class names, same selectors).

# Technical Design

### Current Implementation
| File | Issue |
|---|---|
| `frontend/tsconfig.json` | No `types` entry; TS 6 default is `[]` so `@types/node` globals (`process`) are invisible. `tsconfig.app.json` sets `types: []`, `tsconfig.spec.json` sets `types: ["vitest/globals"]`. |
| `frontend/playwright.config.ts` | Uses `process.env[...]` at lines 6–8 and 14 → `TS2591`. |
| `src/app/features/reader/components/chapter-viewer.component.ts` | Lines 9–59 inline `template`, lines 60–119 inline `styles`; `standalone: true`; imports `CommonModule` (unused — only control flow); class `ChapterViewerComponent`. |
| `src/app/features/scanlation/components/kanban-board.component.ts` | Lines 10–43 template, 44–87 styles; same pattern; class `KanbanBoardComponent`. |
| `src/app/features/social/components/comment-tree.component.ts` | Lines 9–45 template, 46–88 styles; uses `date` pipe (needs `DatePipe`); class `CommentTreeComponent`. |
| `src/app/app.component.ts` | Already external files but old names: `app.component.html/.scss`, `styleUrls`, `standalone: true`, class `AppComponent`. |
| `src/app/features/*/services/*-state.service.ts` | `ReaderStateService`, `ScanlationStateService`. |
| Importers | `app.routes.ts` (2 component imports), `main.ts` (`AppComponent`), `tests/unit/**/*.spec.ts` (3 files, `@app/*` alias imports). |

### Key Decisions
- **Fix `process` via root `tsconfig.json` `"types": ["node"]`** (user-approved). `tsconfig.app.json` keeps `types: []` so Node globals never leak into the browser bundle; `tsconfig.spec.json` keeps `vitest/globals`. No new tsconfig file, no code change in `playwright.config.ts`.
- **Angular v20+ naming**: file = kebab-case of the class, no type suffix; class = PascalCase without `Component`/`Service`. Selectors and `prefix: "app"` unchanged so e2e/unit selectors keep working.
- **External template/styles via `templateUrl` + singular `styleUrl`** — mirrors the existing `app.component.ts` pattern; SCSS extension per `angular.json` schematics (`style: scss`, `inlineStyleLanguage: scss`).
- **Remove `standalone: true`** (default since v19) and **replace `CommonModule`** with the precise import: `DatePipe` for `CommentTree`; empty `imports` removed for `ChapterViewer` / `KanbanBoard` (they only use `@if`/`@for`, bindings, and events).
- Renames done with IDE rename refactoring / `git mv` so history is preserved and all references update (`app.routes.ts`, `main.ts`, specs).

### Proposed Changes
1. `frontend/tsconfig.json` → add `"types": ["node"]` to `compilerOptions`.
2. For each feature component: create `<name>.html` with the exact template body (lines noted above), create `<name>.scss` with the exact style rules; rewrite decorator:
   ```ts
   @Component({
     selector: 'app-chapter-viewer',
     templateUrl: './chapter-viewer.html',
     styleUrl: './chapter-viewer.scss',
     changeDetection: ChangeDetectionStrategy.OnPush
   })
   export class ChapterViewer { readonly state = inject(ReaderState); ... }
   ```
   `CommentTree` additionally keeps `imports: [DatePipe]`.
3. Root app: rename `app.component.ts|html|scss` → `app.ts|html|scss`, class `App`, `templateUrl: './app.html'`, `styleUrl: './app.scss'`, drop `standalone`. Update `main.ts` → `bootstrapApplication(App, appConfig)`.
4. Services: rename files + classes (`ReaderState`, `ScanlationState`); update injections in `ChapterViewer`, `KanbanBoard`, and specs.
5. Update `app.routes.ts` imports/`component:` references; rename and update the three unit specs (import paths through `@app/...`, class names, `describe` titles).

### File Structure (after)
```
frontend/
├── tsconfig.json                     (modified: types: ["node"])
├── playwright.config.ts              (unchanged)
├── src/
│   ├── main.ts                       (modified)
│   └── app/
│       ├── app.ts / app.html / app.scss          (renamed from app.component.*)
│       ├── app.routes.ts                          (modified)
│       └── features/
│           ├── reader/
│           │   ├── components/chapter-viewer.ts / .html / .scss   (renamed + 2 new)
│           │   └── services/reader-state.ts                        (renamed)
│           ├── scanlation/
│           │   ├── components/kanban-board.ts / .html / .scss       (renamed + 2 new)
│           │   └── services/scanlation-state.ts                    (renamed)
│           └── social/components/comment-tree.ts / .html / .scss   (renamed + 2 new)
└── tests/unit/features/
    ├── reader/components/chapter-viewer.spec.ts   (renamed + updated)
    ├── reader/services/reader-state.spec.ts       (renamed + updated)
    └── scanlation/services/scanlation-state.spec.ts (renamed + updated)
```

### Risks
- **`anyComponentStyle` budget** (`angular.json`: warn 4kB / error 8kB) — extracted SCSS files are ≈1–1.5 kB each, well under budget.
- **Stale `dist/`** output references old class names — irrelevant; rebuilt by `npm run build`.
- **`app.ts` vs `app.config.ts`/`app.routes.ts` coexistence** — intended; matches `ng new` output.
- **Vitest `include` in `angular.json`** is `../tests/unit/**/*.spec.ts` — renamed specs still match the glob.

# Testing

### Validation Approach
All checks are run from `frontend/` and are non-interactive.

### Key Scenarios
- `npx tsc --noEmit -p tsconfig.json 2>&1 | Select-String playwright` → no output (no `process` errors).
- `npx playwright test --list` → lists the e2e tests from `tests/e2e` without a config load error.
- `npx tsc --noEmit -p tsconfig.app.json` → clean (ensures Node types did not leak into the app compilation and all renamed imports resolve).
- `npm run build` → succeeds; no `anyComponentStyle` budget error.
- `npm run test:ci` → the 3 renamed unit specs pass: vertical-mode renders 2 `img.page-image`, paged-mode `button.btn-next` advances to page 2, service specs unchanged in behaviour.

### Edge Cases
- `grep` for `template:` / `styles:` / `standalone: true` / `CommonModule` / `styleUrls` under `src/app` → zero hits.
- `grep` for `Component'` / `Service'` class-suffix imports and `.component'` / `.service'` path imports under `src` and `tests` → zero hits.
- `CommentTree` still renders `{{ comment.createdAt | date:'short' }}` — verified by `strictTemplates` compile (missing `DatePipe` would be a build error).

### Test Changes
- Rename `chapter-viewer.component.spec.ts` → `chapter-viewer.spec.ts`; update imports to `@app/features/reader/components/chapter-viewer` and `@app/features/reader/services/reader-state`; use `ChapterViewer` / `ReaderState`.
- Rename `reader-state.service.spec.ts` → `reader-state.spec.ts`; `scanlation-state.service.spec.ts` → `scanlation-state.spec.ts`; update imports/class names.
- No new tests required; behaviour is unchanged.

# Delivery Steps

### ✓ Step 1: Fix Playwright type resolution in tsconfig.json
`playwright.config.ts` type-checks with no `Cannot find name 'process'` errors.

- Add `"types": ["node"]` to `compilerOptions` in `frontend/tsconfig.json` (TS 6 no longer auto-includes `@types/*`).
- Leave `tsconfig.app.json` (`types: []`) and `tsconfig.spec.json` (`vitest/globals`) untouched so the browser bundle and vitest setup are unaffected.
- Verify with `npx tsc --noEmit -p tsconfig.json` (no `playwright.config.ts` errors) and `npx playwright test --list`.

### ✓ Step 2: Rename services to Angular v20+ convention
State services live in `reader-state.ts` / `scanlation-state.ts` with classes `ReaderState` / `ScanlationState`.

- Rename `src/app/features/reader/services/reader-state.service.ts` → `reader-state.ts`; class `ReaderStateService` → `ReaderState` (keep `ViewMode`/`ReadingDirection` exports).
- Rename `src/app/features/scanlation/services/scanlation-state.service.ts` → `scanlation-state.ts`; class `ScanlationStateService` → `ScanlationState`.
- Update the `inject(...)` calls in the two consuming components and the import paths.
- Rename and update `tests/unit/features/reader/services/reader-state.spec.ts` and `tests/unit/features/scanlation/services/scanlation-state.spec.ts` (imports via `@app/...`, class names, `describe` titles).

### ✓ Step 3: Extract and rename ChapterViewer (reader feature)
`chapter-viewer.ts` uses `templateUrl`/`styleUrl` pointing at new `chapter-viewer.html` / `chapter-viewer.scss`, class `ChapterViewer`.

- Create `chapter-viewer.html` with the template body (current lines 10–58) and `chapter-viewer.scss` with the style rules (current lines 61–118), content unchanged.
- Rename `chapter-viewer.component.ts` → `chapter-viewer.ts`; decorator becomes `selector`, `templateUrl`, `styleUrl`, `changeDetection: OnPush`; remove `standalone: true`, `imports: [CommonModule]` and the `CommonModule` import.
- Rename class to `ChapterViewer`, inject `ReaderState`.
- Update `app.routes.ts` (`/read` route) import and reference.
- Rename `tests/unit/features/reader/components/chapter-viewer.component.spec.ts` → `chapter-viewer.spec.ts`, update imports/class names; run `npm run test:ci`.

### ✓ Step 4: Extract and rename KanbanBoard and CommentTree
`kanban-board.ts` and `comment-tree.ts` follow the same external-template pattern with classes `KanbanBoard` / `CommentTree`.

- `scanlation/components`: create `kanban-board.html` (template lines 11–42) and `kanban-board.scss` (styles lines 45–86); rename `kanban-board.component.ts` → `kanban-board.ts`; class `KanbanBoard`; drop `standalone` and `CommonModule`; inject `ScanlationState`.
- `social/components`: create `comment-tree.html` (template lines 10–44) and `comment-tree.scss` (styles lines 47–87); rename `comment-tree.component.ts` → `comment-tree.ts`; class `CommentTree`; drop `standalone`; replace `CommonModule` with `imports: [DatePipe]` from `@angular/common` (template uses `| date:'short'`).
- Update `app.routes.ts` (`/scanlation` route) to `KanbanBoard`.
- Run `npx tsc --noEmit -p tsconfig.app.json` to confirm `strictTemplates` compile.

### ✓ Step 5: Rename root App component and verify full build
Root component is `app.ts` / `app.html` / `app.scss` with class `App`, and the whole frontend builds and tests green.

- Rename `app.component.ts|html|scss` → `app.ts|html|scss`; class `AppComponent` → `App`; use `templateUrl: './app.html'`, `styleUrl: './app.scss'`; remove `standalone: true`.
- Update `src/main.ts` to `bootstrapApplication(App, appConfig)`.
- Grep `src/` and `tests/` for leftover `template:`, `styles:`, `styleUrls`, `standalone: true`, `CommonModule`, `.component'`, `.service'`, `Component'`/`Service'` references → zero hits.
- Run `npm run build` (check `anyComponentStyle` budget) and `npm run test:ci`; re-run `npx playwright test --list`.