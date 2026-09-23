---
name: frontend-e2e-tests
description: How to write, run and debug Readora Playwright end-to-end tests in frontend/tests/e2e (real backend via docker compose). Use whenever an e2e spec, fixture or helper is created or edited, playwright.config.ts changes, or an e2e test is flaky. Covers fixtures and given/when/then methods, locators, web-first assertions, test data and the anti-flakiness rules.
---

# Frontend e2e tests (Playwright)

Source of truth: `frontend/AGENTS.md` "Tests". Model spec: `frontend/tests/e2e/reader-viewer.spec.ts`.
Support: `tests/e2e/support/fixtures.ts` (`test` with fixtures) and `tests/e2e/support/helpers.ts`
(`publishChapter`, `signUp`, `uniqueSuffix`, `PASSWORD`, `API_URL`).

## Running
- Stack: `docker compose up -d` (backend :8080, Postgres, MinIO; dev seed accounts) and the dev server
  (Playwright starts `npm run start` unless one is already on :4200).
- `npm run e2e -- --project=chromium` while developing; all projects before merging a UI-wide change. The `webkit`
  and `Mobile Safari` projects only exist off Windows (Playwright's Windows WebKit crashes pages, R27): run them in
  WSL/CI, or force them with `E2E_WEBKIT=1`.
- French (US-13): project `chromium-fr` runs only `tests/e2e/i18n-fr.spec.ts` against `npm run start:fr` (:4201,
  started by Playwright) or `<deployed>/fr/`; use relative paths there (`page.goto('works')`) so the `/fr/` base is kept.
- New or changed test: `npm run e2e:stress` (chromium, `--repeat-each=5`) with the stack started as
  `READORA_AUTH_RATE_LIMIT=200 docker compose up -d` (the default 10 auth calls/min/IP stops repeated sign-ups).
- Failures: open the trace (`npx playwright show-trace test-results/…/trace.zip`), not just the screenshot.

## Test data and isolation
- Every test creates what it needs, through the API, and nothing else depends on it: fixtures in
  `support/fixtures.ts` create it (`async ({ page, publishedChapter }) => …`). A fixture runs only for tests
  that request it and gives each test fresh data. Add a fixture rather than a `beforeEach`.
- Never depend on seed data or on what an environment happens to contain, and never `test.skip` for missing data.
  Seed accounts are for privileged setup only (`publishChapter` logs in as the publisher).
- Unique values come from `uniqueSuffix()` called **inside** the test or fixture (not at describe scope: a retry must
  get new data).
- Tests run `fullyParallel`: no shared accounts that tests mutate, no ordering between tests, no `test.describe.serial`.
- Third-party services (a payment provider, when there is one again) are stubbed with `page.route`; never our own backend.

## Locators and assertions
- Locators by role and accessible name (`getByRole('button', { name: 'Paged' })`), label (`getByLabel`), then text.
  No CSS classes, no XPath, no `nth()`/`first()` to pick among look-alikes (make the name unique instead).
- Web-first assertions only: `await expect(locator).toBeVisible()/toHaveText()/toHaveAttribute()`,
  `await expect(page).toHaveURL(...)`. Never `expect(await locator.isVisible()).toBe(true)`.
- Never `page.waitForTimeout`. Wait for a UI state with an assertion; for backend state use `expect.poll(fn)` or
  `expect(async () => …).toPass({ timeout })` (always pass a timeout to `toPass`).
- Time-dependent UI: `page.clock.install()` / `setFixedTime()` before navigation.
- Every Playwright call is awaited (`@typescript-eslint/no-floating-promises` is an error in tests).

## Given / When / Then (team convention, all test types)
Model: `tests/e2e/reader-viewer.spec.ts`.
```ts
test('a published chapter can be read and switched to paged mode', async ({ page, publishedChapter }) => {
  await givenIAmOnTheSeriesPage(page, publishedChapter);

  await whenIOpenChapter(page, 1);
  await whenIChooseTheReadingMode(page, 'Paged');

  await thenTheReadingModeIs(page, 'Paged');
  await thenICanSeePage(page, 1);
});

async function thenTheReadingModeIs(page: Page, mode: 'Vertical' | 'Paged'): Promise<void> {
  await expect(page.getByRole('button', { name: mode })).toHaveAttribute('aria-pressed', 'true');
}
```
Fixtures (`publishedChapter`) create the data; `given…` methods put the browser in the starting state. The methods
take `page` and the fixture data, are module-level functions after the `test.describe`, and use web-first
assertions inside `then…`. Methods shared by several specs move to `tests/e2e/support`.
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
- CI: `retries: 2` collects a trace, and `failOnFlakyTests` makes a pass-on-retry fail the run. `forbidOnly` on CI
  and `.only` is a lint error.
- A flaky e2e test is fixed or skipped with a backlog id in `frontend/AGENTS.md` the same day; never raise
  timeouts or add sleeps to hide it. Usual causes: missing `await`, a non-retrying assertion, shared data, a clock.
- Accessibility (backlog F24): when added, via a shared `AxeBuilder` fixture with WCAG 2.x A/AA tags, snapshotting
  only known-violation fingerprints.

## Checklist before committing
- [ ] The test creates its data (fixture/API) and uses unique values made inside the test.
- [ ] Role/label locators, web-first assertions, no `waitForTimeout`, everything awaited.
- [ ] `npm run e2e:stress` green; `npx eslint tests/e2e` clean.

## Sources
playwright.dev/docs/best-practices, /docs/locators, /docs/test-assertions, /docs/test-fixtures, /docs/test-retries,
/docs/test-parallel, /docs/api-testing, /docs/auth, /docs/clock, /docs/pom, /docs/accessibility-testing,
/docs/test-cli (`--repeat-each`, `--fail-on-flaky-tests`); martinfowler.com/articles/nonDeterminism.html;
testing.googleblog.com/2016/05/flaky-tests-at-google-and-how-we.html;
checklyhq.com/blog/page-object-models-and-fixtures-with-playwright.
