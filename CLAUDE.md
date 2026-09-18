# Readora

Manga/comics reading and scanlation platform. Monorepo:

- `backend/` — Spring Boot 4.1 / Java 25, hexagonal DDD, Maven multi-module
  (`readora-domain` → `readora-application` → `readora-infrastructure` / `readora-web`, plus `readora-acceptance` Cucumber).
  Conventions: `backend/CLAUDE.md`.
- `frontend/` — Angular 22, standalone, zoneless, signals, SSR (static prerender). Conventions: `frontend/CLAUDE.md`.
- `.readora/context/` — `ARCHITECTURE.md`, `DECISIONS_LOG.md`, `DOMAIN_MODELS.md`, `PROJECT_CONTEXT.md`
  and `user-stories/*.feature`. Read the relevant ones before feature work.

## Commands
- Backend: `mvn -f backend/pom.xml verify` (ArchUnit + unit + integration + acceptance)
- Frontend (from `frontend/`): `npm test`, `npm run lint`, `npm run build`, `npm run e2e` (needs running backend)

## Cross-cutting rules
- `.feature` files in `.readora/context/user-stories/` are the source of truth for behaviour. New behaviour → scenario first.
- Identity comes **only** from the JWT. Never accept `userId` / `authorId` / `publisherId` in a request body;
  tests on both sides assert this, keep it that way.
- One API envelope: backend `ApiResponse.ok/error` ↔ frontend `ApiClient` unwraps it into typed values / `ApiError`.
- Permission names are shared vocabulary: backend `Role` / `SubscriptionPlan` enum permission sets and `@PreAuthorize`,
  frontend route `data: { permission }` + `permissionGuard` and `*appHasPermission`. Rename in both places or neither.
- Authorization is enforced on the server for every write, including resource ownership/membership. UI gating is cosmetic.
- No default secrets anywhere (yml fallbacks, `@DefaultValue`, env files). Missing secret = startup failure.
- When a pattern changes, update `.readora/context/ARCHITECTURE.md` (it has drifted: frontend store names, zoneless API)
  and log the decision in `DECISIONS_LOG.md`.
- Keep lint, tests and build green; don't leave `console.error`/`printStackTrace` as error handling.

## Git: commit every change Claude makes (user rule)
Goal: every change is a checkpoint that can be found and reverted later.
- When on `main`, create a branch first (`fix/<topic>`, `feat/<topic>`, `chore/<topic>`). Never push unless asked.
- **One logical change = one commit**, made as soon as that change builds/tests green. Don't batch unrelated fixes.
- Stage only files you changed, by explicit path (`git add <paths>`). Never `git add -A`: the user often has
  unrelated uncommitted work in `.readora/`, `docs/`, `.junie/`.
- Message format (Conventional Commits) so history is greppable:
  ```
  <type>(<scope>): <imperative summary, ≤72 chars>

  Why: <problem / bug being fixed, with file refs>
  What: <what changed, key decisions>
  Verify: <command(s) run and result>
  Refs: <backlog id, e.g. review-2026-09/B1, or US-02>
  ```
  `type` ∈ feat, fix, refactor, test, docs, chore, perf, security. `scope` ∈ backend, frontend, domain, web, infra,
  reader, upload, auth, scanlation, ci, rules …
- Consult history before re-touching an area: `git log --oneline -- <path>`, `git log --grep "review-2026-09/B1"`,
  `git show <sha>`. Undo a change with `git revert <sha>` (not reset) unless the user asks otherwise.
- Review backlog ids: backend `B1..B14` in `backend/CLAUDE.md`, frontend `F1..F17` in `frontend/CLAUDE.md` ("Known pitfalls").
  When an item is fully fixed, keep its line but append ` — fixed <sha>`.
