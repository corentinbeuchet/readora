# Frontend conventions (Angular 22, standalone, zoneless, signals, SSR)

## Components
- Standalone, `changeDetection: ChangeDetectionStrategy.OnPush`, zoneless (no zone.js, no `provideZoneChangeDetection`).
- Dependencies via `inject()` in fields: `private readonly api = inject(CatalogApi);`
- Members used only by the template are **`private readonly`** (Angular 22 templates can read private members).
  Use `protected`/public only when a subclass, parent, or directive API genuinely needs it.
  (Existing code still has `protected` in many places — migrate opportunistically, don't copy it.)
- `input()` / `input.required()` / `model()` / `output()`; never `@Input`/`@Output` decorators.
- `templateUrl` + `styleUrl`. No inline `styles:` blocks, no `CommonModule`, no `FormsModule`/`ngModel`.

## State
- Signal stores: private writable signal, public readonly view, derived via `computed` (model: `core/auth/auth-store.ts`):
  ```ts
  private readonly _user = signal<UserProfile | null>(null);
  readonly user = this._user.asReadonly();
  readonly isAuthenticated = computed(() => this._accessToken() !== null && this._user() !== null);
  ```
- Name stores `*Store` in `*-store.ts`. Only app-wide state is `providedIn: 'root'`; page-scoped state is provided on the
  route/component so it resets on navigation (the root-scoped `ScanlationState` shows stale data — don't copy).
- Inside `effect`, wrap writes/reads you don't want tracked in `untracked(...)`. Check `resource.hasValue()` before `value()`.
- Effects that seed form models must not overwrite in-progress user edits.

## Data access
- One API service per backend resource in `core/api/*-api.ts`, all built on `ApiClient` (envelope unwrap + `ApiError`).
- Reads: `httpResource` factories on the API service, fed by signals; return `undefined` URL to keep the resource idle:
  ```ts
  readonly workId = input.required<string>();            // route param via withComponentInputBinding
  private readonly work = this.catalogApi.workResource(this.workId);
  ```
  Resource `parse` must surface `success: false` as an error, not silently return `[]`.
- Writes: `await firstValueFrom(this.api.x(...))` — never `new Promise(res => obs.subscribe(...))`.
- User-facing error text via `apiErrorMessage(err)` (`features/auth/auth-form.utils.ts`). No `console.error` as handling.
- Multi-step flows (upload/publish) must be retry-safe: reuse already-created entities, mark failed items, surface errors.

## RxJS
- Only at the HTTP edge and for genuine streams (debounce). Manual subscriptions use `takeUntilDestroyed(this.destroyRef)`.
- An inner observable in `switchMap`/`mergeMap` gets its **own** `catchError`, otherwise one failure kills the stream.
- Interceptors: `catchError` scoped to the exact call it handles (e.g. only `store.refresh()`), not the retried request.

## Templates & a11y
- Built-in control flow only: `@if (x(); as y)`, `@for (i of items(); track i.id)`, `@switch`.
- Standard async block: loading (`role="status"`) / error + retry (`role="alert"`) / empty / content (model: `works-page.html`).
- Forms: Signal Forms (`@angular/forms/signals`) + `visibleErrors(field)`, with
  `[attr.aria-invalid]="errors(f.x).length > 0"` and `aria-describedby`. Ids must be unique — never a static id inside `@for`.
- Every `<label>` has a control; custom radios/toggles need `role`, `aria-checked/pressed`, and keyboard handlers;
  dialogs need focus trap, Escape, initial focus and focus return; hover-only controls must also show on `:focus-visible`.
- Use global styles `.field`, `.form-error`, `.sr-only` — no Bootstrap-style classes, no per-component `.visually-hidden`.

## Routing & auth
- Every route uses `loadComponent`. Permissions in route data: `canActivate: [permissionGuard], data: { permission: 'PROJECT_VIEW' }`.
- UI gating via `*appHasPermission="'CHAPTER_PUBLISH'"`, not ad-hoc `@if (auth.can(...))`.
- New private routes must be added to `app.routes.server.ts` as `RenderMode.Client`.
- Access token lives in memory only (signal); refresh token is an HttpOnly cookie. Never use `localStorage` for tokens.
- Validate redirect targets: `returnUrl` must start with `/` and not `//` (model: `login-page.ts`); external redirects
  (Stripe) must check the host. Never send the user's identity in request bodies.

## SSR
- No direct `window`, `document`, `localStorage`. Use `inject(DOCUMENT)` and `DOCUMENT.defaultView?`.
- App initializers must be server-safe (`isPlatformServer` → skip) and have a `timeout()`.
- Browser side effects go behind an overridable method (model: `plans-page.ts` `protected redirectTo(url)`).

## Browser resources
- Every `URL.createObjectURL` is revoked (on remove, replace, reset and destroy).
- Bound file size, archive size and entry count before unpacking ZIP/CBZ; report failures to the user.

## SEO
- Call `SeoService.update(...)` in the constructor; non-indexable pages use `seo.private_('Title')` (no "— Readora" suffix by hand).

## Naming & layout
- `core/` = app-wide singletons (api, auth, seo). A feature-only service lives in its feature.
- File suffixes: `*-store.ts`, `*-api.ts`, `*.guard.ts`, `*.interceptor.ts`, `*.directive.ts`, `*-page.ts` for routed pages.
- A feature with more than one component uses `components/` and `services/` subfolders.
- Imports use the `@app/...` alias, not relative `../` paths across folders.

## Tests (Vitest in `tests/unit`, mirroring `src/app`; Playwright in `tests/e2e`)
- Use shared fixtures (`tests/unit/core/auth/auth-fixtures.ts`: `signIn`, `mockUser`) and `settle(fixture)` from
  `tests/unit/test-utils.ts` for `httpResource` components. `http.verify()` in `afterEach`.
- Drive the real DOM and assert request bodies; don't poke component internals.
- `vi.useFakeTimers()` for debounce/timeouts — no real `setTimeout` waits.
- Cover failure and retry paths, not only the happy path. No placeholder e2e tests; no `test.skip` on missing data.

## Known pitfalls found in review (2026-09) — don't reintroduce
Backlog ids used in commit `Refs:` (status: `git log --grep "review-2026-09/F<n>"`).
- F1 Upload retry recreates the Work; batch failure leaves items `uploading`; SCANLATION mode swallows errors; `parseFloat || 1`.
- F2 Reader: vertical mode never updates `currentPageIndex`; opening a chapter overwrites the bookmark with page 1;
  view-mode switch refetches and resets; "continue reading" doesn't restore the page.
- F3 Progress sync stream dies after one failed save (no inner `catchError`).
- F4 `auth.interceptor.ts` clears the session when the *retried* request fails.
- F5 Object URLs never revoked in `page-grid-uploader` / cover preview; serial image decoding.
- F6 ZIP/CBZ loaded fully in memory with no size/entry limits; failures silent.
- F7 `ng lint` fails (unused imports, unlabeled controls, keyboard-less `role="radio"`).
- F8 `provideAppInitializer` session restore runs during SSR/prerender with no timeout.
- F9 Root-scoped `ScanlationState` shows stale project data.
- F10 Profile form effect overwrites in-progress edits.
- F11 `httpResource` parsers ignore `success:false`.
- F12 Comments: replies appended at bottom; spoilers present in DOM/prerender.
- F13 A11y: kanban modal focus trap/Escape; focus-invisible buttons; duplicate ids in `@for`.
- F14 Build/SEO: missing favicon/og image in `public/`; sitemap only on `npm run build`; upload scss over budget.
- F15 Eager routes (`ChapterViewer`, `KanbanBoard`).
- F16 Low: shell double navigation; Stripe redirect host unchecked; unused `proxy.conf.json`; POSIX env in `e2e:staging`.
- F17 Tests: upload happy-path only; real timers; placeholder e2e; e2e not on SSR build; `tests/**` not linted.
