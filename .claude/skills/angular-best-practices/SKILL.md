---
name: angular-best-practices
description: Readora's Angular 22 best-practice checklist (angular.dev best practices for v22 + lessons from the 2026-09 frontend audit). Use for EVERY change in frontend/ — new or edited components, templates, styles, services, stores, httpResource/API calls, forms, routes, SSR/prerender config, and unit or e2e tests — and when reviewing frontend code. Also use to re-run a frontend audit (references/review-checklist.md).
---

# Angular best practices for Readora (Angular 22.1, zoneless, SSR static prerender)

Readora's conventions live in `frontend/AGENTS.md` (source of truth, read it for the "why"). This skill is the
checklist to apply while coding. Deeper docs: the `angular-developer` skill references in
`.claude/skills/angular-developer/references/` (named below as `ref: file.md`).

## Before writing code
- Check the Angular version in `frontend/package.json`; 22.1 means template members are `protected readonly`
  (private only from stable 22.2, backlog F18).
- Look for an existing shared piece before writing UI or helpers (see "Reuse, don't copy").

## Components (ref: components.md, inputs.md, outputs.md, host-elements.md)
- Standalone and OnPush are defaults: never write `standalone: true` or `changeDetection`.
- `input()`/`input.required()`/`model()`/`output()`/`viewChild()`; host bindings in `host: {}`; `inject()` in fields.
- One responsibility per component. Past ~250 lines of TS or template, split: each presentational child in its own
  folder under the component, logic in services beside it (component-provided when page-scoped).
- Layout: one folder per multi-file component (`name/name.{ts,html,scss}`), children nested under the component that
  uses them, shared ones at the nearest common parent; never `components/` or `services/` folders.
- Template-read members `protected readonly`; public only for the component's API. Tests must not need more.

## Templates (ref: components.md, pipes.md)
- Built-in control flow, `track` by id, `@empty` for empty lists, `@let` for repeated reads.
- No method calls inside `@for` and no repeated calls per row: build a view-model with `computed`
  (e.g. `rows = computed(() => chapters().map(c => ({ chapter: c, read: finished().has(c.id), … })))`).
- Formatting belongs in pipes (`DatePipe`, `DecimalPipe`, `I18nPluralPipe`, custom pure pipes), not in `toFixed`,
  ternaries for plurals or `.join` in templates.
- `[class.x]` / `[style.x]`; never `[class]="…"` (it overwrites static classes), `ngClass`, `ngStyle`.
- Read DOM values with template refs (`#fit (change)="setFit(fit.value)"`), not per-class `(event.target as …)` casts.
- Images: `NgOptimizedImage` (`ngSrc`, sizes, `priority` on the LCP image), including avatars and covers.

## State and reactivity (ref: signals-overview.md, linked-signal.md, effects.md, resource.md)
- No store library (NgRx SignalStore was assessed and declined; revisit triggers in `frontend/AGENTS.md` "State").
- Derived → `computed`. Derived but locally overridable → `linkedSignal`. **Never use `effect` to copy or sync
  state** (resource → signal, prefs → state, input → form). Effects are for non-signal side effects only
  (SEO/head, DOM APIs, analytics, recording a visit).
- Local change after a write: `resource.value.set/update(...)`, not a second signal holding a copy.
- Page-scoped state: `@Service({ autoProvided: false })` + `providers: [X]` on the routed component (model:
  `ReaderPage` + `ReaderState`). Only app-wide state is root-provided. Stores expose `asReadonly()`/`computed`.
- Seeding a form from loaded data must not overwrite user edits (only while pristine; model `profile-page/profile-form/profile-form.ts`).
- `afterRenderEffect` with phases (`write` for DOM writes).

## Data access (ref: http-client.md, resource.md)
- Reads: `httpResource` factories on the `*-api.ts` service, `parse: parseEnvelope`, return `undefined` to stay idle
  (also for tabs/panels not shown). No Observable duplicate of a read that has a resource.
- Writes: `await firstValueFrom(api.x())` with busy/error handled once (shared helper, see below).
- Every resource shown to the user has loading (`role="status"`), error with Retry (`role="alert"`), empty and
  content states; a 404 is not the same message as a network error.
- One API service per backend resource; stores never call `ApiClient` directly.
- RxJS only at the HTTP edge and for real streams (debounce): `toObservable(computed)` + inner `catchError` +
  `takeUntilDestroyed`.

## Forms (ref: signal-forms.md)
- Signal Forms only (`form()`, validators in the schema, `[formField]`, `submit()`); no `FormsModule`/`ngModel`,
  no hand-rolled validation. Per-field errors with `aria-invalid` + `aria-describedby`.

## Routing and SSR (ref: define-routes.md, route-guards.md, rendering-strategies.md, router-lifecycle.md)
- Every route `loadComponent`; functional guards with `data: { permission }`; `withComponentInputBinding` inputs for
  params/query params (no `ActivatedRoute.snapshot`).
- Every route has a server route: public → `Prerender` with `fallback: PrerenderFallback.Client` for params,
  private/live → `Client` (static output has no server).
- Failed lazy-chunk loads after a deploy are recovered by the navigation error handler; keep it.
- Transfer cache only for public GETs; no browser globals outside `afterNextRender`/`DOCUMENT`; time-dependent text
  (e.g. "5 minutes ago") only after hydration on prerendered pages.
- `@defer (on viewport)` for heavy below-the-fold UI; add `hydrate on viewport` when it's prerendered.

## Styling (ref: component-styling.md)
- One stylesheet per component; never `::ng-deep` — give the child its own `styleUrl` or use `:host`.
- Colours, font sizes and weights only from the tokens in `src/styles/_tokens.scss` (`var(--surface)`, `--fs-sm`,
  `--fw-semibold`, …), never hex/rgba or raw sizes in components; theme colours are `light-dark()` and must pass AA in
  light and dark.
- Shared patterns (`.tab`, `.pager`, cards) in `src/styles.scss`, not copied per component.

## Accessibility (AGENTS.md "Templates & a11y")
- Load `frontend-accessibility` for markup, focus or keyboard work and `frontend-responsive` for layout, SCSS or
  image work; they hold the detailed checklists.
- AXE clean, WCAG 2.2 AA. Every control labelled; no interactive element inside another (`role="button"` wrapping an
  `<input>`); disclosure panels and dialogs: `aria-expanded`/`aria-controls`, Escape closes, focus returns to the
  trigger; dialogs trap focus. Required markers `aria-hidden`. Nested content (comment threads) uses list structure.
- Prefer `@angular/aria` (Menu, Tabs, Toolbar, Combobox, Listbox) over hand-rolled widgets.

## Imports and layers
- `@app/...` only, no `../`. core <- shared <- features; a feature imports only itself (reader -> social
  `ChapterComments` is the one exception). Lint enforces it: put code in the right layer rather than adding exceptions.
- Response model fields are required and `T | null` where the Java DTO is `@Nullable` (no `?:`); request fields use
  `?:` or `| null`, not both; `undefined` means "not loaded / not given", `null` means "empty".
- API types come from `@app/core/models/<domain>` (one file per domain). A rule about a model (who may claim, can a
  plan be cancelled) is a pure function beside the type, unit-tested, not an inline comparison in a component and
  not a class method.

## Reuse, don't copy
Before adding UI or helpers, search `src/app/shared/` and `src/app/core/utils/`. One implementation each:
- busy/error of a write: `asyncAction()` (`core/utils/async-action.ts`);
- form field errors: `<app-field-errors [field]>` + `[appAriaInvalid]` (`shared/forms/`);
- resource error + Retry + 404 text: `<app-load-error>`; covers: `<app-work-cover>`; modal: `<app-dialog>`;
  relative time: `timeAgo` pipe (`shared/ui/`);
- 404 as "none": `nullIfNotFound()`; URLs: `API_BASE_URL`/`SITE_URL`;
- tests: `API`, `ok`/`fail`, `provideHttpTesting`, `settle`, `ANY_URL`, `MemoryStorage` (`tests/unit/test-utils.ts`).
A third copy of anything means it should be shared.

## Tests (ref: testing-fundamentals.md, router-testing.md, component-harnesses.md)
- Load the matching testing skill: `frontend-unit-tests`, `frontend-component-tests` or `frontend-e2e-tests`
  (Given/When/Then convention and anti-flakiness rules).
- Drive the real DOM (click, type, read text/ARIA); never call component methods or read component signals.
- Real routes + `RouterTestingHarness`/`router.url`; don't mock `navigateByUrl`.
- Shared helpers from `tests/unit/test-utils.ts` and `core/auth/auth-fixtures.ts` (`settle`, envelopes, `signIn`);
  `http.verify()` in `afterEach`; fake timers for time.
- A `@ui` scenario's test name is the exact scenario title.

## After coding
- Run the `verify` skill (`frontend`), and `story-check` when a user story changed.
- A new pattern or shared piece → add it to `frontend/AGENTS.md` and this skill.
