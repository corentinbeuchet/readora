@AGENTS.md

## Claude Code specifics
- Rules live in `AGENTS.md` (imported above); `backend/CLAUDE.md` and `frontend/CLAUDE.md` import the matching
  `AGENTS.md` when working in those folders. Update the `AGENTS.md` files, not these stubs.
- Before re-touching an area, check `git log --grep "review-2026-09/<id>"` and the "Known pitfalls" backlog.
- Prefer `context7` / the Angular CLI MCP (`get_best_practices`, `search_documentation`) when available: Angular 22,
  Spring Boot 4 and Java 25 are newer than most training data.
