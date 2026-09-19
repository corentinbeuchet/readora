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
- `templateUrl` + `styleUrl` (relative paths). No inline `styles:` blocks.
- Order members: injected deps, inputs/models/outputs, queries, then state and methods. Name handlers for what they do
  (`saveProfile()`, not `handleClick()`).

## State
- Signal stores: private writable signal, public readonly view, derived via `computed` (model: `core/auth/auth-store.ts`):
  ```ts
  private readonly _user = signal<UserProfile | null>(null);
  readonly user = this._user.asReadonly();
  readonly isAuthenticated = computed(() => this._accessToken() !== null && this._user() !== null);
  ```
- Name stores `*Store` in `*-store.ts`. Only app-wide state is `providedIn: 'root'`; page-scoped state is provided on the
  route/component so it resets on navigation (model: `KanbanBoard` `providers: [ScanlationState]`).
- New singleton services use the Angular 22 `@Service()` decorator (root-provided, `inject()`-only) instead of
  `@Injectable({ providedIn: 'root' })` (enforced by `@angular-eslint/prefer-service-decorator`).
- Derived read-only state → `computed()`; derived but locally overridable state → `linkedSignal()`. Never `mutate`,
  only `set` / `update`. Keep transformations pure.
- Inside `effect`, wrap writes/reads you don't want tracked in `untracked(...)`. Check `resource.hasValue()` before `value()`.
- Effects that seed form models must not overwrite in-progress user edits.

## Data access
- One API service per backend resource in `core/api/*-api.ts`, all built on `ApiClient` (envelope unwrap + `ApiError`).
- Reads: `httpResource` factories on the API service, fed by signals; return `undefined` URL to keep the resource idle:
  ```ts
  readonly workId = input.required<string>();            // route param via withComponentInputBinding
  protected readonly work = this.catalogApi.workResource(this.workId);   // read by the template
  ```
  Resource `parse` uses `parseEnvelope<T>` (`core/api/api-client.ts`): `success: false` becomes an error, never `[]`.
  In error state `value()` throws: read list resources through `hasValue()`.
- Writes: `await firstValueFrom(this.api.x(...))` — never `new Promise(res => obs.subscribe(...))`.
- User-facing error text via `apiErrorMessage(err)` (`core/api/api-client.ts`, re-exported by `features/auth/auth-form.utils.ts`).
  No `console.error` as handling.
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
- Built-in control flow only: `@if (x(); as y)`, `@for (i of items(); track i.id)`, `@switch`.
- Standard async block: loading (`role="status"`) / error + retry (`role="alert"`) / empty / content (model: `works-page.html`).
- Forms: Signal Forms (`@angular/forms/signals`) + `visibleErrors(field)`, with
  `[attr.aria-invalid]="errors(f.x).length > 0"` and `aria-describedby`. Ids must be unique — never a static id inside `@for`.
- Every `<label>` has a control; custom radios/toggles need `role`, `aria-checked/pressed`, and keyboard handlers;
  dialogs need focus trap, Escape, initial focus and focus return (`appFocusTrap`, `core/a11y/focus-trap.directive.ts`); hover-only controls must also show on `:focus-visible`.
- Use global styles `.field`, `.form-error`, `.sr-only` — no Bootstrap-style classes, no per-component `.visually-hidden`.
- Every page must pass AXE checks and WCAG 2.2 AA (focus management, contrast, ARIA).
- Images: `NgOptimizedImage` (`ngSrc`, `width`/`height` or `fill`, `priority` on the LCP image such as the first
  cover or first reader page). Not for inline base64 images.
- `@defer` heavy or below-the-fold UI (comments, kanban modal, upload studio widgets) with an `@placeholder`;
  never defer what is visible in the initial viewport (layout shift). Deferred deps must be standalone and not
  imported elsewhere in the file. Tests use `DeferBlockBehavior.Manual`.

## Routing & auth
- Every route uses `loadComponent`. Permissions in route data: `canActivate: [permissionGuard], data: { permission: 'PROJECT_VIEW' }`.
- UI gating via `*appHasPermission="'CHAPTER_PUBLISH'"`, not ad-hoc `@if (auth.can(...))`.
- New private routes must be added to `app.routes.server.ts` as `RenderMode.Client`.
- Access token lives in memory only (signal); refresh token is an HttpOnly cookie. Never use `localStorage` for tokens.
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
- Security: `security.allowedHosts` (or `NG_ALLOWED_HOSTS`) set for SSR; CSP via a per-request nonce (`autoCsp` cannot be combined with SSR in 22.1, see F23); keep
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
- File suffixes: `*-store.ts`, `*-api.ts`, `*.guard.ts`, `*.interceptor.ts`, `*.directive.ts`, `*-page.ts` for routed pages.
- A feature with more than one component uses `components/` and `services/` subfolders.
- Imports use the `@app/...` alias, not relative `../` paths across folders.

## Tests (Vitest in `tests/unit`, mirroring `src/app`; Playwright in `tests/e2e`)
- Use shared fixtures (`tests/unit/core/auth/auth-fixtures.ts`: `signIn`, `mockUser`) and `settle(fixture)` from
  `tests/unit/test-utils.ts` for `httpResource` components. `http.verify()` in `afterEach`.
- Drive the real DOM and assert request bodies; don't poke component internals.
- `vi.useFakeTimers()` for debounce/timeouts — no real `setTimeout` waits. `tests/**` is linted by `npm run lint`.
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
- F24 Axe accessibility assertions in Playwright e2e (`@axe-core/playwright`).
