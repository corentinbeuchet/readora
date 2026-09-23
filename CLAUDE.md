@AGENTS.md

## Claude Code specifics
- Rules live in `AGENTS.md` (imported above); `backend/CLAUDE.md` and `frontend/CLAUDE.md` import the matching
  `AGENTS.md` when working in those folders. Update the `AGENTS.md` files, not these stubs.
- Before re-touching an area, check `git log --grep "review-2026-09/<id>"` and the "Open review items" backlog.
- Frontend work: load the `angular-best-practices` skill first (checklist; `frontend/AGENTS.md` is the source);
  tests: `frontend-unit-tests`, `frontend-component-tests`, `frontend-e2e-tests`; accessibility and screen sizes:
  `frontend-accessibility`, `frontend-responsive`; look, composition, navigation and interface copy:
  `frontend-visual-design` (checklist + research evidence + contrast script; rules in `frontend/AGENTS.md` "Design").
- Project automations (`.claude/`): skill `verify` (all checks, prints the commit `Verify:` line), skill
  `story-check` (every non-`@wip` scenario ran in Cucumber or has its `@ui` Vitest test), agent `rules-reviewer`
  (diff vs the AGENTS.md rules, run before committing a feature), and a PreToolUse hook that denies edits to
  committed Flyway migrations and add-everything staging. Don't work around the hook: follow the rule it quotes.
- Prefer `context7` / the Angular CLI MCP (`get_best_practices`, `search_documentation`) when available: Angular 22,
  Spring Boot 4 and Java 25 are newer than most training data.
- Outer loop for a feature or fix (not questions or research): start the task with this `/goal`. Its evaluator only
  reads the transcript, so every clause is something a command prints; a fix without a scenario drops the first one.
  ```
  /goal the scenario for this change exists in .readora/context/user-stories (written before the code); after the
  last edit the verify skill printed PASS for every suite it ran; story-check printed "every non-@wip scenario is
  verified"; rules-reviewer reported no violation on the final diff; the change is committed with its Verify: line.
  Or stop after 25 turns and list what is left.
  ```
