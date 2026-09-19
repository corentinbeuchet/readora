# Frontend conventions (Angular 22, standalone, zoneless, signals, SSR)

## Components
- Standalone and OnPush are the Angular 22 defaults: never write `standalone: true` or `changeDetection` (angular.dev
  best practices for v22; the explicit ones were removed). Zoneless: no zone.js, no `provideZoneChangeDetection`,
  no `NgZone.onStable` — use `afterNextRender()` / `afterEveryRender()`.
- Dependencies via `inject()` in fields: `private readonly api = inject(CatalogApi);` (never constructor injection).
- Template visibility (user rule, version-gated):
  - **Now (Angular 22.1.x installed):** members read by the template are `protected readonly`. `private` members in
    templates do **not** compile before 22.2.
  - **From stable Angular 22.2** (compiler PR #70188): template-only members become `private readonly` (tracked as F18).
  - Truly internal state: `private` or `#field`. Public only for the component's API (inputs/outputs/methods others call).
- `input()` / `input.required()` / `model()` / `output()`; never `@Input`/`@Output` decorators. Mark them `readonly`.
- Host bindings/listeners in the `host: {}` metadata object, never `@HostBinding` / `@HostListener`.
- `[class.x]` / `[style.x]` bindings, never `ngClass` / `ngStyle`. No `CommonModule`, no `FormsModule`/`ngModel`.
- `templateUrl` + `styleUrl` (relative paths), one stylesheet per component (never a shared `feature.scss`). No
  inline `styles:` blocks; an inline `template` only for tiny shared pieces (~15 lines, e.g. `shared/ui/load-error.ts`).
- One responsibility per component: past ~250 lines of TS or template, split presentational children into their
  own folders under the component and logic into services beside it (model: `features/reader/reader-page/`).
- Order members: injected deps, inputs/models/outputs, queries, then state and methods. Name handlers for what they do
  (`saveProfile()`, not `handleClick()`).

## State
- **No store library** (decided 2026-09 after comparing NgRx SignalStore 22): state lives in signal services plus
  resources. SignalStore's main gains are already covered here: loading, error and value come from `httpResource`;
  one store shape comes from the convention below; page scope comes from `@Service({ autoProvided: false })`. Its
  resource support is experimental or third-party, and the largest stores (`ReaderState`: `linkedSignal`,
  `UploadWizard`: Signal Forms) would only be reshaped. Revisit when one of these appears:
  - the same loading/pagination/filter logic in 3+ stores (`signalStoreFeature`);
  - entity collections shared across features (`withEntities`);
  - features reacting to one event without importing each other (events plugin);
  - a real need for DevTools.

  Then pilot it on one feature before any migration.
- Signal stores: private writable signal, public readonly view, derived via `computed` (model: `core/auth/auth-store.ts`):
  ```ts
  private readonly _user = signal<UserProfile | null>(null);
  readonly user = this._user.asReadonly();
  readonly isAuthenticated = computed(() => this._accessToken() !== null && this._user() !== null);
  ```
- Name stores `*Store` in `*-store.ts`. Only app-wide state is root-provided. Page-scoped state is
  `@Service({ autoProvided: false })` + `providers: [X]` on the routed component, so it resets per visit
  (model: `ReaderPage` `providers: [ReaderState, ReadingTracker, AutoScroller]`).
- New singleton services use the Angular 22 `@Service()` decorator (root-provided, `inject()`-only) instead of
  `@Injectable({ providedIn: 'root' })` (enforced by `@angular-eslint/prefer-service-decorator`).
- Derived read-only state → `computed()`; derived but locally overridable state → `linkedSignal()`. Never `mutate`,
  only `set` / `update`. Keep transformations pure.
- **Never use `effect` to copy or sync state** (resource -> signal, prefs -> state, input -> form): derive it with
  `computed`/`linkedSignal`. Effects are for non-signal side effects (SEO/head, DOM APIs, recording a visit).
- After a write, update the resource itself (`resource.set/update(...)`), not a second signal holding a copy
  (model: `scanlation-board-page/scanlation-board-page.ts` `project.update(withTask(...))`).
- Inside `effect`, wrap writes/reads you don't want tracked in `untracked(...)`. Check `resource.hasValue()` before `value()`.
- Seeding a form from loaded data must not overwrite in-progress edits: only while pristine (model: `profile-page/profile-form/profile-form.ts`).

## Data access
- One API service per backend resource in `core/api/*-api.ts`, all built on `ApiClient` (envelope unwrap + `ApiError`).
- `null` vs `undefined` (decided 2026-09-19): the backend sends every DTO field and an empty one as `null`, so
  **response** types mirror the Java record: every field required, `T | null` exactly where it is `@Nullable`,
  never `?:`. **Request** types say what callers send: `?:` for "left out", `T | null` for "sent as null", not both.
  In code `null` = known empty (API value, 404 via `nullIfNotFound()`), `undefined` = not loaded yet / not given
  (resources, optional params); `T | null | undefined` only where both really arrive. Test mocks spell out the nulls.
  Write `T | null` directly: no `Nullable<T>`/`Maybe<T>` alias or wrapper class (the name is ambiguous next to TS's
  `NonNullable`, which also removes `undefined`, and it hides the union in hovers).
- Reads: `httpResource` factories on the API service, fed by signals; return `undefined` URL to keep the resource idle:
  ```ts
  readonly workId = input.required<string>();            // route param via withComponentInputBinding
  protected readonly work = this.catalogApi.workResource(this.workId);   // read by the template
  ```
  Resource `parse` uses `parseEnvelope<T>` (`core/api/api-client.ts`): `success: false` becomes an error, never `[]`.
  In error state `value()` throws: read list resources through `hasValue()`. Fetch only what is shown: tabs and
  panels pass an `enabled` signal (model: `rankings-page.ts`), a page needing one entry uses the per-id endpoint.
  "Mine or 404" reads use `rxResource` + `nullIfNotFound()` (model: `LibraryApi.entryResource`).
  No Observable duplicate of a read that has a resource.
- URLs come from `API_BASE_URL` / `SITE_URL` (`core/config/urls.ts`), never `environment` in app code.
- Writes: `await firstValueFrom(this.api.x(...))` — never `new Promise(res => obs.subscribe(...))`. Busy/error state
  via `asyncAction()` (`core/utils/async-action.ts`: `busy()`, `error()`, `run(fn, { fallback })`), not hand-rolled
  `saving`/`error` signals.
- User-facing error text via `apiErrorMessage(err)` (`core/api/api-client.ts`). No `console.error` as handling.
  Direct `HttpClient` calls (blobs) still `catchError(toApiError)`.
- Multi-step flows (upload/publish) must be retry-safe: reuse already-created entities, mark failed items, surface errors.
- `HttpClient` uses the fetch backend by default in v22: don't add `withFetch()` (deprecated). Upload progress needs
  `provideHttpClient(withXhr())` + `reportUploadProgress: true` (`reportProgress` is deprecated).
- SSR transfer cache: exclude user-specific endpoints with `withHttpTransferCacheOptions({ filter })`; never include
  auth headers in cached keys.

## RxJS
- Only at the HTTP edge and for genuine streams (debounce). Manual subscriptions use `takeUntilDestroyed(this.destroyRef)`.
- An inner observable in `switchMap`/`mergeMap` gets its **own** `catchError`, otherwise one failure kills the stream.
- Interceptors: `catchError` scoped to the exact call it handles (e.g. only `store.refresh()`), not the retried request.

## Templates & a11y
Checklists: skill `frontend-accessibility` (WCAG 2.2 AA, APG patterns mapped to our components) and skill
`frontend-responsive` (phone/tablet/desktop, breakpoints 480/768/1024/1280 mobile-first, dvh, touch, SSR-safe
breakpoints).
- Built-in control flow only: `@if (x(); as y)`, `@for (i of items(); track i.id)`, `@switch`.
- Standard async block: loading (`role="status"`) / error + retry / empty / content (model: `works-page.html`); the
  error state is `<app-load-error [error]="r.error()" notFound="…" (retry)="r.reload()">` (a 404 is not a network error).
- No method calls in `@for` rows and no repeated per-row work: build a view-model with `computed` (model:
  `work-detail-page.ts` `chapterRows`). Formatting via pipes (`DatePipe`, `DecimalPipe`, `I18nPluralPipe`, `timeAgo`),
  not `toFixed`/plural ternaries/`.join` in templates. Use `$index`/`$first` directly, template literals in bindings.
- Forms: Signal Forms (`@angular/forms/signals`), validators in the schema (no `required`/`maxlength` attributes on
  `[formField]`, NG8022); per field `[appAriaInvalid]="f.x"` + `aria-describedby` and
  `<app-field-errors id="…-error" [field]="f.x" />` (`shared/forms/`). Ids must be unique — never a static id inside `@for`.
- Shared UI (`src/app/shared/`) before writing a copy: `app-load-error`, `app-work-cover` (ngSrc + fallback),
  `app-dialog` (focus trap, Escape, labelledBy), `timeAgo` pipe, `app-field-errors`, `appAriaInvalid`; shared styles
  `.tab`, `.pager`, `.wizard-*`, `.dialog-actions` in `styles.scss`. A third copy of anything means it should be shared.
- Every `<label>` has a control; custom radios/toggles need `role`, `aria-checked/pressed`, and keyboard handlers;
  dialogs need focus trap, Escape, initial focus and focus return (`appFocusTrap`, `core/a11y/focus-trap.directive.ts`); hover-only controls must also show on `:focus-visible`.
- Use global styles `.field`, `.form-error`, `.sr-only` — no Bootstrap-style classes, no per-component `.visually-hidden`.
- Every page must pass AXE checks and WCAG 2.2 AA (focus management, contrast, ARIA).
- Images: `NgOptimizedImage` (`ngSrc`, `width`/`height` or `fill`, `priority` on the LCP image such as the first
  cover or first reader page). Not for `data:` fallbacks, `blob:` previews or hidden preloads: those keep `[src]`
  with an `eslint-disable-next-line @angular-eslint/template/prefer-ngsrc -- reason` comment.
- Styles: never `::ng-deep` (give the child its own `styleUrl`), never `[class]="…"` (overwrites static classes),
  never hex/rgba or raw `font-size`/`font-weight` in components: colours, sizes and weights come from the tokens in
  `src/styles/_tokens.scss` (`--accent`, `--danger-soft`, `--fs-sm`, `--fw-semibold`, …). Theme colours are
  `light-dark(<light>, <dark>)` and must pass AA in both (the axe e2e runs each page in light and dark); tints are
  `color-mix()` of their base token. Text over artwork uses `--overlay*` + `--on-overlay` (theme-less), the reader
  page backgrounds `--reader-*` (a reader setting, not the theme). A new token goes in `_tokens.scss`.
- Theme: `ThemeStore` (`core/theme/theme-store.ts`, System / Light / Dark, footer picker) sets `data-theme` on
  `<html>`; an inline script in `index.html` applies the saved choice before the first paint (key `readora.theme`).
- `@defer` heavy or below-the-fold UI (comments, kanban modal, upload studio widgets) with an `@placeholder`;
  never defer what is visible in the initial viewport (layout shift). Deferred deps must be standalone and not
  imported elsewhere in the file. Tests use `DeferBlockBehavior.Manual`.

## Routing & auth
- Every route uses `loadComponent`. Permissions in route data: `canActivate: [permissionGuard], data: { permission: 'PROJECT_VIEW' }`.
- UI gating via `*appHasPermission="'CHAPTER_PUBLISH'"`, not ad-hoc `@if (auth.can(...))`.
- Every route has a server route (unit-tested): public with params -> `Prerender` + `fallback: PrerenderFallback.Client`,
  private/live -> `RenderMode.Client`.
- Route and query params arrive as inputs (`withComponentInputBinding`); no `ActivatedRoute.snapshot`.
- Keep `withNavigationErrorHandler(recoverFromChunkLoadFailure)`: after a deploy, a failed lazy chunk reloads once.
- Access token lives in memory only (signal); refresh token is an HttpOnly cookie. Never use `localStorage` for tokens.
  Only the non-secret `readora.has-session` hint is stored: bootstrap skips `POST /auth/refresh` without it, so
  anonymous page loads don't spend the backend's per-IP auth rate limit (10/min).
- Validate redirect targets: `returnUrl` must start with `/` and not `//` (model: `login-page.ts`); external redirects
  (Stripe) must check the host. Never send the user's identity in request bodies.

## SSR
- No direct `window`, `document`, `navigator`, `localStorage`. Use `inject(DOCUMENT)` / `DOCUMENT.defaultView?`, and
  run browser-only work in `afterNextRender()`. Prefer platform-specific providers over `isPlatformBrowser`; never
  branch on platform inside templates (hydration mismatch).
- App initializers must be server-safe (skip on the server) and have a `timeout()` (model: `core/auth/session-restore.ts`,
  registered only in `app.config.browser.ts`). Async server work that must finish
  before render is registered with `PendingTasks`.
- `getPrerenderParams` calls `inject()` before any `await`.
- Hydration: `provideClientHydration(withEventReplay())` — incremental hydration is on by default in v22; use
  `@defer (hydrate on viewport|interaction)` for heavy prerendered sections.
- Security: `security.allowedHosts` (or `NG_ALLOWED_HOSTS`) set for SSR; CSP via a per-request nonce (`autoCsp` cannot be combined with SSR in 22.1, see F23; the theme script in `index.html` then needs its hash); keep
  Trusted Types compatible; build `SafeValue`s as close to the input as possible and never bypass sanitization on
  user content.
- Browser side effects go behind an overridable method (model: `plans-page.ts` `protected redirectTo(url)`).

## Browser resources
- Every `URL.createObjectURL` is revoked (on remove, replace, reset and destroy).
- Bound file size, archive size and entry count before unpacking ZIP/CBZ; report failures to the user.

## SEO
- Call `SeoService.update(...)` in the constructor; non-indexable pages use `seo.private_('Title')` (no "— Readora" suffix by hand).

## Naming & layout
- `core/` = app-wide singletons (api, auth, seo). A feature-only service lives in its feature.
- API types: one file per domain in `core/models/<domain>.ts` (`catalog`, `chapter`, `scanlation`, `identity`, …),
  imported by that path (no barrel, no catch-all model file). Domain rules on those types (`canClaim(task)`,
  `canCancelSubscription(sub)`) are pure functions exported beside them and unit-tested in
  `tests/unit/core/models/`. Components and stores call them rather than comparing statuses inline. Types stay
  interfaces, not classes: API data is plain JSON, and resource updates spread objects, which would drop class
  methods (decided 2026-09-19).
- File suffixes: `*-store.ts`, `*-api.ts`, `*.guard.ts`, `*.interceptor.ts`, `*.directive.ts`, `*-page.ts` for routed pages.
- Folders by feature, then **one folder per component** (angular.dev style guide; the CLI's default): a component
  with a template or styles lives in `<name>/<name>.{ts,html,scss}`; single-file units (services, stores, pipes,
  directives, utils, inline-template components such as `forbidden-page.ts`) stay files.
- **No type folders** (`components/`, `services/`, `directives/`: the style guide says to avoid them). A routed page's
  folder sits at the feature root; each child component is a subfolder of the component that uses it
  (`upload-studio-page/pages-step/page-grid-uploader/`); services and utils sit beside the component tree that uses
  them (`reader-page/reader-state.ts`). Used by several components: move it to their nearest common parent; by several
  features: `shared/`. Example: `features/catalog/{works-page/, work-detail-page/{work-ratings/, add-to-list/}}`.
- `tests/unit` mirrors `src/app` path for path (`tests/unit/features/catalog/work-detail-page/work-detail-page.spec.ts`);
  only cross-cutting specs (`app.guarded-routes`, `core/api/resource-parsers`) have no single source file.
- Class names: `XPage` for routed pages, no `Component` suffix; model interfaces don't reuse a page name
  (`TeamProfile` model vs `TeamPage` component). Unique selectors.
- One import alias, `@app/...` (no `@core`/`@shared`/`@features`: one spelling per file); no `../` paths
  (only `environments/`, outside the alias). Layers `core` <- `shared` <- `features`: core imports neither shared
  nor features, shared imports no feature, a feature imports only its own files, except the reader embedding
  `social`'s `ChapterComments`. All of this is enforced by `no-restricted-imports` in `eslint.config.js`
  (a new allowed cross-feature import goes in `CROSS_FEATURE_ALLOWED`, with a reason).

## Tests (Vitest in `tests/unit`, mirroring `src/app`; Playwright in `tests/e2e`)
Checklists per test type: skills `frontend-unit-tests` (services, stores, pure functions, guards, interceptors),
`frontend-component-tests` (components, routed pages, directives), `frontend-e2e-tests` (Playwright).
- **Given / When / Then as methods** (team convention): a test body is only calls to extracted first-person methods
  `given…` / `when…` / `then…` (`whenIVisit(page, '/read')`, `thenICanSeePage(page, 1)`), without phase comments and
  without raw `expect`/DOM/HTTP code. Guard-rails (from Fowler, SWE at Google ch. 12, Kent C. Dodds, xUnit Test
  Patterns, whose concern is hidden setup and assertions far from the test): the data the scenario is about is an
  argument on both sides (`givenIAmOnTheWorkPage({ inLibrary: false })`, `thenChapterIsRead(1)`); one `then…`
  checks one fact; one `when…` is one action; methods are function declarations after the tests (hoisted); shared
  ones move to the helper files; no logic in test bodies; comments only for a non-obvious "why".
  E2E: fixtures create the data, methods take `page`. Models: `core/auth/auth-store.spec.ts`,
  `features/catalog/work-detail-page/work-detail-page.spec.ts` (library block), `features/discovery/updates-page/updates-page.spec.ts`,
  `tests/e2e/reader-viewer.spec.ts`. Every spec follows it.
- **No flaky tests:**
  - No real waits. Time is faked: fake timers, and `FIXED_NOW` / `freezeDate()` for anything relative to "now".
  - `vitest-base.config.ts` auto-restores spies, stubbed globals and env stubs; fake timers need `useRealTimers()`
    in `afterEach`. Retry is 0.
  - Nothing mutable is shared between tests. E2E data is created per test (fixtures, `uniqueSuffix()` inside the
    test). CI fails on a test that only passes on retry (`failOnFlakyTests`).
  - A new or changed spec passes `npm run test:shuffle` (unit, random order) / `npm run e2e:stress` (e2e, 5 repeats;
    stack started with `READORA_AUTH_RATE_LIMIT=200`).
  - A flaky test is fixed, or skipped with a backlog id here, the same day. Never retried away, never given a longer timeout.
- Shared helpers, never local copies: `tests/unit/test-utils.ts` (`API`, `ok(data)`/`fail(msg)` envelopes,
  `provideHttpTesting()`, `settle(fixtureOrHarness)`, `resourcesStable()`, `ANY_URL` routes, `MemoryStorage`,
  `FIXED_NOW`, `freezeDate()`) and `tests/unit/core/auth/auth-fixtures.ts` (`givenIAmSignedInWith(permissions)`, `signIn`, `mockUser`, `mockSession`).
  `http.verify()` in `afterEach`; `http.match` in `afterEach` only for requests a child with its own spec owns.
- Real router: `provideRouter(ANY_URL)` or real routes + `RouterTestingHarness`, assert `router.url`; never mock
  `navigate`/`navigateByUrl`. Guards are covered through the real table (`tests/unit/app.guarded-routes.spec.ts`).
- E2E: role/label locators, web-first assertions, no `waitForTimeout`; every call awaited (`no-floating-promises`);
  create the data a test needs (`tests/e2e/support/fixtures.ts` `publishedChapter`, `helpers.ts` `signUp`).
- Drive the real DOM and assert request bodies; don't poke component internals.
- `vi.useFakeTimers()` for debounce/timeouts — no real `setTimeout` waits (`settle()` uses one: under fake timers use
  `vi.advanceTimersByTimeAsync(0)`). `tests/**` is linted by `npm run lint` (CI too); `.only` is a lint error.
- A user-story scenario tagged `@ui` (`.readora/context/user-stories/*.feature`) is verified here: one `it(...)` whose
  name is the exact scenario title, driving the real DOM.
- Cover failure and retry paths, not only the happy path. No placeholder e2e tests; no `test.skip` on missing data.

## Known pitfalls found in review (2026-09) — don't reintroduce
Backlog ids used in commit `Refs:` (status: `git log --grep "review-2026-09/F<n>"`).
- F1 Upload retry recreates the Work; batch failure leaves items `uploading`; SCANLATION mode swallows errors; `parseFloat || 1`. — fixed 06e748b
- F2 Reader: vertical mode never updates `currentPageIndex`; opening a chapter overwrites the bookmark with page 1;
  view-mode switch refetches and resets; "continue reading" doesn't restore the page. — fixed d685632
- F3 Progress sync stream dies after one failed save (no inner `catchError`). — fixed d685632
- F4 `auth.interceptor.ts` clears the session when the *retried* request fails. — fixed 0c8ade9
- F5 Object URLs never revoked in `page-grid-uploader` / cover preview; serial image decoding. — fixed d8262f2
- F6 ZIP/CBZ loaded fully in memory with no size/entry limits; failures silent. — fixed 781a96d
- F7 `ng lint` fails (unused imports, unlabeled controls, keyboard-less `role="radio"`). — fixed 7b3901d
- F8 `provideAppInitializer` session restore runs during SSR/prerender with no timeout. — fixed 85c548b
- F9 Root-scoped `ScanlationState` shows stale project data. — fixed 3dc0948
- F10 Profile form effect overwrites in-progress edits. — fixed 25b939a
- F11 `httpResource` parsers ignore `success:false`. — fixed 4d524da
- F12 Comments: replies appended at bottom; spoilers present in DOM/prerender. — fixed 356615d
- F13 A11y: kanban modal focus trap/Escape; focus-invisible buttons; duplicate ids in `@for`. — fixed 25814d7
- F14 Build/SEO: missing favicon/og image in `public/`; sitemap only on `npm run build`; upload scss over budget. — fixed ecd9f84, bed5898, 3d5d938
- F15 Eager routes (`ChapterViewer`, `KanbanBoard`). — fixed ae4dbbf
- F16 Low: shell double navigation; Stripe redirect host unchecked; unused `proxy.conf.json`; POSIX env in `e2e:staging`. — fixed 73bdda6, 76b029c, ba65a83
- F17 Tests: upload happy-path only; real timers; placeholder e2e; e2e not on SSR build; `tests/**` not linted. — partially fixed 95fe6f4 (still open: e2e runs against `ng serve`, not the prerendered build)

Improvements from best-practice research (2026-09), not bugs:
- F18 Upgrade to stable Angular 22.2, then switch template-only members from `protected` to `private` (~106 today).
- F19 Remove `withFetch()` (`app.config.ts`); upload progress via `withXhr()` + `reportUploadProgress`. — fixed 176fb94 (no withXhr: progress is per settled page)
- F20 `NgOptimizedImage` for covers and reader pages (none today; also fixes reader layout shift from F13). — fixed ef12282
- F21 `@defer` the comments section and the kanban modal. — fixed 385f63d
- F22 Migrate the 14 `@Injectable` root services to `@Service()` (check angular-eslint for a `prefer-service-decorator` rule). — fixed 12aa7fd
- F23 `autoCsp` + `security.allowedHosts` for SSR. — blocked: Angular 22.1 build fails with "Cannot set both SSR and auto-CSP"; allowedHosts only applies to an SSR server (outputMode is static)
- F24 Axe accessibility assertions in Playwright e2e (`@axe-core/playwright`). — fixed 0a8e549
  (`tests/e2e/accessibility.spec.ts`, `axe` fixture; it found and fixed 08c7ca0, the login live region)

Angular best-practice review (2026-09-19, refs `ng-best-practices/<n>`, checklist in the `angular-best-practices`
skill) — fixed:
- F25 App-wide `ReaderState`/`ScanlationState` leaked state between pages. — fixed f7eb303, 6b41731
- F26 Effects copying resources into signals (list page, ratings, kanban, reader). — fixed 1c0821d, 717c289, 6b41731, 9f4f3fc
- F27 No recovery from failed lazy chunks after a deploy; prerender fallback implicit; transfer cache unfiltered. — fixed adff67c, 7549b0b, 7b903fc
- F28 Notifications: counts of the previous user, overlapping polls, no focus return. — fixed 6fd8127
- F29 Oversized reader (650 lines) and upload studio (FormsModule). — fixed 9f4f3fc, 5da9fe7, a4b1e7d, 349df0b
- F30 Copy-pasted busy/error, field errors, load-error, covers, dialogs, relative time. — fixed 1b6484b, 23f0756, 974300c, 1e648c7, 5411b3d, 88f8edc, 5a5b30f
- F31 Method calls in `@for`, `::ng-deep`, `[class]` overwrites, hex colours, explicit OnPush, comment-tree a11y. — fixed cb5f4f4, f66f599, b868d51, 9a3c86c
- F32 Over-fetching (both rankings, all bookmarks/library for one work), unused Observable reads, env URLs outside DI. — fixed e0d31f5, febf287, 6836eff
- F33 Naming/layout: `TeamPageComponent`, duplicate `app-profile-page` selector, shared feature stylesheets, relative imports. — fixed daeae36, e61eedb, 3cd1cbd, f72bf39, d2dd35a
- F34 CI without lint; weak lint rules; mocked Router and duplicated test setup; e2e skipping on missing data. — fixed 7fecf89, b4bb4a0, d0c0687, 6272d20
- F35 Every anonymous page load called `/auth/refresh` and spent the per-IP rate limit (reload -> 429 -> logged out). — fixed 28f9de5
- F36 Layering (core <- shared <- features, no `../`) held by convention only. — fixed by the lint rules (`git log --grep ng-best-practices/26`)
- F37 Flaky-test risks: real clock in fixtures, a leaked `document` spy, no auto-restore, a catch-all HTTP flush,
  colliding e2e suffixes, CI retries hiding flakes. — fixed (`git log --grep ng-best-practices/27`)
- F38 `components/` + `services/` type folders with up to 24 flat files each (the style guide says to avoid them).
  — fixed: folder per component, children nested under their user (`git log --grep ng-best-practices/30`)

Accessibility and responsive gaps (2026-09-19 research, skills `frontend-accessibility` / `frontend-responsive`):
- F39 Header has no small-screen layout (one non-wrapping row, 689px wide at 375px). — fixed 31a6f5a (menu button +
  nav disclosure below 1024px, search on its own row)
- F40 `100vh` for full-height views and `vh` caps: hidden behind mobile browser bars. — fixed 57d4841 (`dvh` after a `vh`
  fallback)
- F41 No shared breakpoints or fluid tokens (6 ad-hoc `max-width` queries). — fixed e30bc4f (`src/styles/_breakpoints.scss`
  `bp.from()`, `--space-page`, `--fs-h1/h2`)
- F42 No input-modality or notch handling. — fixed c83abab (`viewport-fit=cover` + safe-area padding, `touch-action`,
  44px controls under `pointer: coarse`, hover-only upload actions visible under `hover: none`)
- F43 Covers have no `sizes`: blocked, not a frontend fix. NgOptimizedImage only builds a `srcset` with an image loader,
  and storage (MinIO/S3/CloudFront) serves only the original file, so `sizes` alone changes nothing. Needs the backend
  to store resized cover/page variants (as it already does for page "lite" copies), then an `IMAGE_LOADER` mapping a
  width to its variant, then `sizes` on `app-work-cover` and reader pages.
- F44 No focus move after route navigation. — fixed da60ba9 (the page `h1`, or `<main>` while loading, gets focus when
  the path changes; query-only changes keep focus)
- F45 No `prefers-reduced-motion` handling. — fixed 3cc637f (global rule in `styles.scss`)
- F46 No mobile-viewport or target-size checks. — fixed 0a8e549 (`tests/e2e/responsive.spec.ts`: overflow at
  320/375/768/1024, phone header, 24px targets; reader swipe stays covered by the reader unit tests). It found and
  fixed c098580 (reader toolbar overflow) and 6217137 (18px reader links).
- F47 Dark-only UI, 19 raw font sizes and 22 raw colours in components; `<button>`s in the browser font. — fixed
  4bfcf59, 7e5987f, 50f1fcd, 27686e2, bacca4f (`_tokens.scss` type scale + semantic colours, `light-dark()` light
  theme, System/Light/Dark picker, axe in both themes)
