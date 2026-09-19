---
name: verify
description: Run Readora's checks (backend mvn verify with ArchUnit, unit, Postgres, Cucumber; frontend lint, Vitest, build) and get one pass/fail line per suite plus a ready "Verify:" line for the commit message. Use before every commit, after changing backend or frontend code, or when the user asks whether the build is green. Arguments: all (default), backend, frontend; --no-build skips the frontend production build.
---

# Verify Readora

Run the bundled script from the repo root instead of hand-building Maven/npm commands:

```bash
node .claude/skills/verify/scripts/verify.mjs [all|backend|frontend] [--no-build]
```

- It finds Maven (PATH, `$MAVEN_CMD`, or IntelliJ's bundled `mvn.cmd`) and a JDK 25 (`JAVA_HOME` or `~/.jdks/*25*`) itself.
- Output: `PASS`/`FAIL` per suite (backend, lint, test, build) with counts, the failing tests or errors quoted, and the
  full log path for anything that failed. Exit code 0 only when everything passed.
- The last line starts with `Verify:` — paste it into the commit message's `Verify:` section.
- Run in the background for the full suite (`run_in_background`, ~5–8 min backend, ~2 min frontend); pick the side
  you changed (`backend` / `frontend`) when only one changed. Always run `all` before the last commit of a feature.

When something fails: read the quoted lines first, open the printed log only if they are not enough, fix, and run the
same target again. Never commit with a `FAIL` line, and never report green without this script's `PASS` lines.
