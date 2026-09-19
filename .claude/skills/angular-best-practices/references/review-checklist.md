# Frontend audit checklist (re-run with 3 parallel Explore agents, read-only)

Give each agent the `angular-developer` references it needs and `frontend/AGENTS.md`, ask for findings as
file:line + rule (cite reference) + fix, prioritized, plus "already good". Then fetch
`https://angular.dev/assets/context/best-practices.md` for anything new in the installed version, and
**ask the user whether to update this skill / AGENTS.md with the findings** before planning fixes.

## 1. Components, templates, styling, a11y, naming
- `standalone: true`, explicit `changeDetection`, decorators (`@Input/@Output/@HostBinding/@HostListener/@ViewChild`).
- Components > ~250 lines (list the biggest `.ts/.html/.scss`); responsibilities that could be children/services.
- Method calls in `@for` / repeated per-row calls → view-model `computed`.
- `[class]=`, `ngClass`, `ngStyle`, `::ng-deep`, hex colours, styles duplicated across components, classes used but
  defined nowhere (encapsulation).
- Copy-pasted blocks (field errors, load/error/retry, covers, dialogs, time/number formatting, `(event.target as …)`).
- Forms not on Signal Forms; `FormsModule`/`ngModel`.
- a11y: nested interactive content, focus return, Escape, headings/landmarks, list structure, `NgOptimizedImage`.
- Naming: `*Component` suffix, filename ≠ class, routed components not `*-page`, multi-file components without their own folder, `components/`/`services/` type folders, a child not nested under its only user.

## 2. State, data, DI, RxJS
- Effects that copy/sync state; signals duplicating resource values; imperative fetches in effects.
- Root-provided state that is page-scoped; stores without `asReadonly`.
- Resources fetched while not shown; Observable duplicates of resource reads; stores calling `ApiClient` directly.
- Busy/error boilerplate copies; errors swallowed; missing Retry; 404 vs network error.
- Manual subscriptions without `takeUntilDestroyed`; RxJS where signals suffice.
- `environment` read directly instead of InjectionTokens; cross-feature imports.

## 3. Routing, SSR, build, tests, tooling
- Routes without server routes; `fallback` with static output; guards; input binding vs snapshots.
- Navigation error handling (chunk loads), transfer cache filter, preloading, view transitions, hydration triggers.
- Budgets on the CI build, lint in CI, ESLint rules missing for AGENTS.md rules, strict compiler options.
- Tests: calling component internals, mocked Router, duplicated setup (`settle`, envelopes, providers), missing
  `http.verify()`; e2e `test.skip` on data, CSS locators, duplicated flows.
