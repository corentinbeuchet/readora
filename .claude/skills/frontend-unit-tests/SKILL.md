---
name: frontend-unit-tests
description: How to write and review Readora frontend unit tests (Vitest + TestBed, no DOM) for services, stores, API clients, resources, pure functions, guards, interceptors and pipes in frontend/tests/unit. Use whenever such a spec is created or edited, or a test of that kind is flaky. Covers the given/when/then methods convention and the anti-flakiness rules.
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
Model: `core/auth/auth-store.spec.ts`.
```ts
it('logout revokes the cookie server-side and clears the session locally', async () => {
  await givenIAmSignedIn();

  await whenILogOut();

  thenTheLogoutSentTheRefreshCookie();
  thenIAmAnonymous();
});

async function whenILogOut(): Promise<void> {
  const logout = firstValueFrom(store.logout());
  lastRequest = http.expectOne(`${API}/auth/logout`);
  lastRequest.flush(ok('Logged out'));
  await logout;
}

function thenIAmAnonymous(): void {
  expect(store.isAuthenticated()).toBe(false);
  expect(store.accessToken()).toBeNull();
}
```
- The test body is only calls to extracted methods named `given…`, `when…`, `then…`, in that order (a scenario may
  chain several when/then rounds). No `// Given` / `// When` / `// Then` comments, no raw `expect`, DOM, HTTP or
  `page` code in the body: the method names are the documentation. Names are first-person domain sentences
  (`givenIAmOnTheWorkPage`, `whenIAddTheSeriesToMyLibrary`, `thenMyLibraryStatusIs`).
- Keep the test readable without opening the methods (what the community warns about: hidden setup, assertions
  far from the test):
  - the data the scenario is about is an **argument**, on both sides: `givenIAmOnTheWorkPage({ inLibrary: false,
    finished: ['c-1'] })`, `thenChapterIsRead(1)`, `thenTheFeedWasAskedFor({ mine: true })`; defaults only for
    values the test doesn't care about;
  - one `then…` checks **one** observable fact and its name says which; several `then…` calls per test are normal;
  - one `when…` is one user or caller action, including answering the requests it triggers;
  - state shared by the methods (fixture, last request, spies) lives in the `describe`, not in return values the
    test has to juggle.
- Methods are function declarations **after** the tests of their `describe` (hoisted), so a spec reads scenarios
  first. A method used by several spec files moves to the shared helpers.
- No logic in test bodies (`if`, loops); `it.each` for tables of cases. Comments only for a non-obvious "why"
  (e.g. why a request is answered 404), never to label phases.
- `beforeEach` only for TestBed setup and cleanup; scenario state is built by `given…` methods.

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
