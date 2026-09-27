---
name: story-check
description: Check that every user-story scenario in .readora/context/user-stories is really verified — non-@wip backend scenarios passed in the last Cucumber run, every @ui scenario has a frontend Vitest it(...) with the exact scenario title, every @e2e scenario passed in the last playwright-bdd run — and list the @wip ones. Use after implementing or changing a user story, after removing a @wip tag, before the final commit of a story, or when asked which stories are done.
---

# Story check

```bash
node .claude/skills/story-check/scripts/story-check.mjs
```

It reads the `.feature` files, the Cucumber report from the last backend run
(`backend/readora-acceptance/target/surefire-reports/TEST-*.xml`), the Vitest specs in `frontend/tests/unit` and the
playwright-bdd report of the last `npm run e2e:stories` (`frontend/e2e-reports/user-stories.json`; any Playwright run
rewrites it, so run `e2e:stories` or the full `e2e` last).

- `FAIL Cucumber did not run/skipped/failed` — a scenario that should run in Cucumber didn't pass: missing or
  mistyped step definitions, a leftover filter, or a real failure. Run the backend verify (`verify` skill) and fix.
- `FAIL @ui without a Vitest it(...)` — write the frontend test with the **exact** scenario title as its name
  (AGENTS.md: `@ui` scenarios are verified by Vitest), or fix a typo in either title.
- `FAIL playwright-bdd did not run/skipped/failed` — an `@e2e` scenario didn't pass in the last run: start the stack,
  run `npm run e2e:stories` in `frontend/`, and fix the steps or the app (`No playwright-bdd report`: it never ran).
- `WIP` lines are scenarios deliberately not built; the feature file header should say why.
- `WARN ... older than a .feature file` — a report is stale: run the backend verify (Cucumber) or `e2e:stories` first.

Exit code 0 means every non-@wip scenario is verified.
