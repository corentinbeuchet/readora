---
name: frontend-unit-tests
description: How to write and review Readora frontend unit tests (Vitest + TestBed, no DOM) for services, stores, API clients, resources, pure functions, guards, interceptors and pipes in frontend/tests/unit. Use whenever such a spec is created or edited, or a test of that kind is flaky. Covers the Given/When/Then convention and the anti-flakiness rules.
---

# Frontend unit tests (services, stores, pure functions, guards, interceptors, pipes)

Source of truth: `frontend/AGENTS.md` "Tests". Model spec: `frontend/tests/unit/core/auth/auth-store.spec.ts`.
Components and routed pages use the `frontend-component-tests` skill instead.

## Setup
- Pure functions (`time-ago`, `scanlation-board`, `chunk-load-recovery` helpers): call them directly, no TestBed.
- Services/stores: `TestBed.configureTestingModule({ providers: [...provideHttpTesting(), …] })`, then
  `TestBed.inject(X)`. Page-scoped (`autoProvided: false`) services are listed in `providers`.
- HTTP is faked at the edge with `HttpTestingController` (never mock `HttpClient` or our `*Api` services: "don't mock
  what you don't own", and the API layer is what we want covered). `http.verify()` in `afterEach`.
  Answer with `ok(data)` / `fail(msg)` (+ `{ status }`), network errors with `req.error(new ProgressEvent('error'))`.
- Browser storage: `{ provide: BrowserStorage, useValue: new MemoryStorage() }` (values are JSON strings like the real
  storage; plant corrupt values in `storage.values`). Never real `localStorage`.
- Helpers live in `tests/unit/test-utils.ts` (`API`, `ok`, `fail`, `provideHttpTesting`, `MemoryStorage`, `FIXED_NOW`,
  `freezeDate`, `resourcesStable`) and `tests/unit/core/auth/auth-fixtures.ts` (`signIn`, `mockUser`, `mockSession`,
  `mockAuthResponse`). Never a local copy.

## Signals, effects and resources
- Read `signal`/`computed` values directly; set inputs of a store through its public methods.
- Effects and resources run on `TestBed.tick()` (not `flushEffects()`: deprecated since v20; never `fakeAsync`).
- `httpResource` without a component (angular.dev recipe): create it in `TestBed.runInInjectionContext`,
  `TestBed.tick()` (sends the request), `expectOne(...).flush(...)`, `await resourcesStable()`, then assert
  `value()` / `error()` / `hasValue()` (model: `core/api/resource-parsers.spec.ts`).
- Observables: `await firstValueFrom(obs)` after flushing its request; concurrent callers → `http.match(url)` and
  assert the count (model: refresh sharing in `auth-store.spec.ts`).

## Guards and interceptors
- Guard logic can be unit-tested with `TestBed.runInInjectionContext(() => guard(route, state))`, but where a URL
  lands is proven through the real route table: `tests/unit/app.guarded-routes.spec.ts` (component skill).
- Interceptors: `provideHttpClient(withInterceptors([x]))` + `provideHttpClientTesting()`; assert the outgoing
  request (headers, `withCredentials`) and the retry/refresh sequence; override injection tokens
  (`API_BASE_URL`) with `{ provide, useValue }` instead of editing the environment.

## Given / When / Then (team convention, all test types)
```ts
it('logout revokes the cookie server-side and clears the session locally', async () => {
  // Given
  await givenSignedIn();

  // When
  const logout = await whenLoggingOut();

  // Then
  expect(logout.request.withCredentials).toBe(true);
  expect(store.isAuthenticated()).toBe(false);
});
```
- Every test has `// Given`, `// When`, `// Then` sections (Given may be "the beforeEach"; several When/Then pairs
  are fine for one scenario).
- `given…` helpers build the precondition and **return** what the test uses. Values the test asserts on are
  **arguments** (`givenSignedIn(mockSession({ accessToken: 'jwt-secret' }))`), never hidden inside the helper
  (the "mystery guest" of xUnit Test Patterns).
- `when…` helpers only for a multi-step action used by 2+ tests; a one-liner stays inline.
- **No `then…` helpers.** Assertions stay in the test body. An extracted assertion checks one fact.
- No logic in tests (`if`, loops, computed expectations). DAMP over DRY: a little duplication beats indirection.
- `beforeEach` only for TestBed setup and cleanup, no nested `beforeEach` chains for scenario data.

## No flakiness
- No real waiting: no `setTimeout` promises, no polling loops. Time is faked: `vi.useFakeTimers()` +
  `vi.advanceTimersByTimeAsync(ms)`, and `vi.useRealTimers()` in `afterEach`.
- Dates: fixtures come from `FIXED_NOW`; code that reads the clock runs under `freezeDate()` (fakes `Date` only) or
  `vi.setSystemTime(FIXED_NOW)`. Never `new Date()` / `Date.now()` in a fixture.
- Spies, `vi.stubGlobal` and env stubs are restored automatically (`vitest-base.config.ts`: `restoreMocks`,
  `unstubGlobals`, `unstubEnvs`); fake timers are not, so restore them yourself.
- No state shared between tests: module-level constants only; anything mutable is created in `beforeEach` or the test.
- `retry` is 0. A new or changed spec must pass `npm run test:shuffle` (random order). A flaky test is fixed (or
  skipped with a backlog id in `frontend/AGENTS.md`) the same day, never retried away.

## Checklist before committing
- [ ] Test name states the behaviour; `@ui` scenario tests keep the exact scenario title.
- [ ] Failure and retry paths covered, not only the happy path.
- [ ] `http.verify()` passes; no `http.match(() => true)` catch-alls.
- [ ] `npm run test:shuffle` green; `node .claude/skills/verify/scripts/verify.mjs frontend` green.

## Sources
angular.dev/guide/testing, /guide/http/testing, /guide/http/http-resource, /guide/zoneless,
/api/core/testing/TestBed (flushEffects deprecated); vitest.dev/api/vi, /config/restoremocks, /config/unstubglobals,
/config/sequence, /config/retry; martinfowler.com/bliki/GivenWhenThen.html, /articles/nonDeterminism.html;
abseil.io/resources/swe-book/html/ch12.html (DAMP, helpers); kentcdodds.com/blog/aha-testing,
/blog/avoid-nesting-when-youre-testing; xunitpatterns.com (Obscure Test, Mystery Guest);
github.com/testdouble/contributing-tests/wiki/Don't-mock-what-you-don't-own.
