@AGENTS.md

## Claude Code specifics
- Rules live in `AGENTS.md` (imported above); `backend/CLAUDE.md` and `frontend/CLAUDE.md` import the matching
  `AGENTS.md` when working in those folders. Update the `AGENTS.md` files, not these stubs.
- Before re-touching an area, check `git log --grep "review-2026-09/<id>"` and the "Known pitfalls" backlog.
- Project automations (`.claude/`): skill `verify` (all checks, prints the commit `Verify:` line), skill
  `story-check` (every non-`@wip` scenario ran in Cucumber or has its `@ui` Vitest test), agent `rules-reviewer`
  (diff vs the AGENTS.md rules, run before committing a feature), and a PreToolUse hook that denies edits to
  committed Flyway migrations and add-everything staging. Don't work around the hook: follow the rule it quotes.
- Prefer `context7` / the Angular CLI MCP (`get_best_practices`, `search_documentation`) when available: Angular 22,
  Spring Boot 4 and Java 25 are newer than most training data.
