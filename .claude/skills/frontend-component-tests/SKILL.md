---
name: frontend-component-tests
description: How to write and review Readora frontend component tests (Vitest + TestBed driving the DOM) for components, routed pages (RouterTestingHarness), directives and forms in frontend/tests/unit. Use whenever such a spec is created or edited, an @ui scenario gets its test, or a component test is flaky. Covers the Given/When/Then convention and the anti-flakiness rules.
---

# Frontend component tests (components, routed pages, directives)

Source of truth: `frontend/AGENTS.md` "Tests". Model specs:
`frontend/tests/unit/features/catalog/work-detail-page.spec.ts` ("library and read markers" block) and
`frontend/tests/unit/features/discovery/updates-page.spec.ts` (routed page). Services and pure functions use the
`frontend-unit-tests` skill.

## Test like a user
- Drive and read the DOM: click, type (`input` + `blur` events), press keys; read text, ARIA attributes and
  `router.url`. Never call component methods, read component signals or `fixture.componentInstance` state.
- Query in the Testing Library priority: role/ARIA (`[role="alert"]`, `aria-current`, `aria-pressed`) and labels
  (`#id` of a labelled control) first, visible text next, CSS classes only for purely visual state (`.chapter-read`),
  `data-testid` never unless nothing else identifies it.
- Inputs: `fixture.componentRef.setInput('workId', id)`; outputs through a host component
  (model: `page-grid-uploader.spec.ts` host with `[(pages)]`).
- Forms (Signal Forms): type, blur, then assert the visible error text and `aria-invalid`; submit through the form's
  `submit` event; assert the request body (and that identity fields are absent: `not.toHaveProperty('authorId')`).
- Dialogs and popups: assert focus moves in, Escape closes, and focus returns to the trigger (`document.activeElement`).
- An `@ui` scenario (`.readora/context/user-stories`) is verified by one `it(...)` whose name is the **exact**
  scenario title (`story-check` fails otherwise).

## Data and change detection
- HTTP: `HttpTestingController` + `ok()` / `fail()`; answer each request the page makes with `expectOne` and assert
  its method, params and body. `http.verify()` in `afterEach`. A scoped `http.match(predicate)` in `afterEach` only
  for requests owned by a child with its own spec (model: ratings in `work-detail-page.spec.ts`), with a comment.
- `settle(fixture)` after creating the component and after each flush while an `httpResource` is involved
  (`whenStable()` waits forever while a request is pending). Otherwise `await fixture.whenStable()`.
- Signed-in state: `await signIn(TestBed.inject(AuthStore), http, mockUser({ permissions: [...] }))`: permissions
  the test depends on are explicit arguments.
- `@defer` blocks: `deferBlockBehavior: DeferBlockBehavior.Manual` and render the state you test.

## Routing
- Real router only: `provideRouter(ANY_URL)` (every URL resolves to a blank page) or real routes with
  `RouterTestingHarness.create()` + `harness.navigateByUrl(url)`; assert `router.url`. Never spy on or mock
  `navigate` / `navigateByUrl` (a spy that only counts real navigations is fine).
- Route/query params reach the page as inputs (`withComponentInputBinding()`), so navigate with the query string
  (model: `updates-page.spec.ts` `givenUpdatesPageAt('/updates?feed=mine')`).
- Where a guarded URL lands is covered by `tests/unit/app.guarded-routes.spec.ts` (real route table).

## Given / When / Then (team convention, all test types)
```ts
it('adds the series to the library, then removes it', async () => {
  // Given
  await givenWorkPage({ inLibrary: false, finished: [], next: 'c-1' });

  // When
  button('Add to library').click();
  const save = http.expectOne(`${API}/library/${WORK.id}`);
  save.flush(ok({ workId: WORK.id, status: 'READING', addedAt: '', updatedAt: '' }));
  await settle(fixture);

  // Then
  expect(save.request.body).toEqual({});
  expect(libraryStatus()).toBe('READING');
});
```
- Every test has `// Given`, `// When`, `// Then` sections (a scenario may chain several When/Then pairs).
- `given…` helpers open the page in a state and **return** what the test needs (e.g. the unanswered request).
  Whatever the test asserts on is an **argument** (`finished: ['c-1']`), never baked into the helper (mystery guest).
- `when…` helpers only for multi-step actions shared by 2+ tests; small DOM accessors (`button(label)`,
  `chapterLinks()`) are fine and keep the test readable.
- **No `then…` helpers**: assertions stay in the test. No `if`/loops in tests; `it.each` for tables of cases.
- `beforeEach` only for TestBed configuration and cleanup.

## No flakiness
- No real waits (`setTimeout` promises, polling). Debounces, polls and timeouts use `vi.useFakeTimers()` +
  `vi.advanceTimersByTimeAsync(ms)`; under fake timers use `advanceTimersByTimeAsync(0)` instead of `settle()`
  (which needs a real `setTimeout`). `vi.useRealTimers()` in `afterEach`.
- Relative times ("10 minutes ago") come from `FIXED_NOW` fixtures under `freezeDate()`; never the real clock.
- Browser APIs jsdom lacks (`IntersectionObserver`, `matchMedia`, `Image` decoding) are stubbed with
  `vi.stubGlobal` (auto-restored); `document` properties with `vi.spyOn(document, 'visibilityState', 'get')`
  (auto-restored).
- Each test builds its own component and data; nothing mutable at module level.
- New or changed specs pass `npm run test:shuffle`. Retry is 0: a flaky test is fixed or skipped with a backlog id
  the same day.

## Checklist before committing
- [ ] Loading, error + Retry, empty and content states covered where the component has them.
- [ ] Every request asserted (method/params/body) and answered; `http.verify()` green.
- [ ] No component internals touched; queries follow the priority above.
- [ ] `npm run test:shuffle` and `node .claude/skills/verify/scripts/verify.mjs frontend` green.

## Sources
testing-library.com/docs/guiding-principles, /docs/queries/about (query priority); angular.dev/guide/testing,
/guide/testing/components-scenarios, /guide/zoneless (whenStable), /guide/http/testing, /guide/templates/defer,
/guide/testing/using-component-harnesses; kentcdodds.com/blog/testing-implementation-details;
martinfowler.com/bliki/GivenWhenThen.html; abseil.io/resources/swe-book/html/ch12.html; vitest.dev/api/vi.
