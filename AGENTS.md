# Readora

> Tool-neutral source of truth for AI agents (Claude Code, Junie, Gemini CLI, …). `CLAUDE.md` and `GEMINI.md`
> only import/point to this file. Edit rules **here**, and in `backend/AGENTS.md` / `frontend/AGENTS.md`.

Manga/manhwa/comics reading platform with built-in scanlation team workflows (readers read, discuss and follow
series; teams take chapters from RAW to published). Monorepo:

- `backend/` — Spring Boot 4.1 / Java 25, hexagonal DDD, Maven multi-module
  (`readora-domain` → `readora-application` → `readora-infrastructure` / `readora-web`, plus `readora-acceptance` Cucumber).
  Conventions: `backend/AGENTS.md`.
- `frontend/` — Angular 22, standalone, zoneless, signals, SSR (static prerender). Conventions: `frontend/AGENTS.md`.
- `.readora/context/user-stories/*.feature` — behaviour specs, executed by Cucumber (`readora-acceptance`).
  Read the relevant ones before feature work.
- Target hosting: isolated staging and production (AWS App Runner/ECS, RDS PostgreSQL, S3 + CloudFront); same
  container image and Flyway migrations in both.

## Commands
- Backend: `mvn -f backend/pom.xml verify` (ArchUnit + unit + integration + acceptance)
- Frontend (from `frontend/`): `npm test`, `npm run lint`, `npm run build`, `npm run e2e` (needs running backend);
  `npm run start:fr` (French on :4201), `npm run extract-i18n` after changing user-visible text (see frontend AGENTS "i18n")
- Local stack: `docker compose up` (Postgres, MinIO, backend). The backend image is rebuilt on every `up`
  (`pull_policy: build`, cached layers make it fast), so it always runs the current code. `docker compose up --watch`
  also rebuilds and restarts the backend whenever a backend source or pom changes.
- Dev seed accounts (Spring profile `local`: on in docker-compose; elsewhere add `local` to the active profiles,
  e.g. `--spring.profiles.active=local`). Password for all: `readora-dev`. Emails `<username>@readora.local`:
  `reader`, `kenji` (readers), `admin`, `moderator` (comment moderation queue at `/moderation`),
  and the "Readora Demo Team" scanlators `leader`, `cleaner`,
  `translator`, `typesetter`, `proofreader`, `quality` (QC) with one open task per stage (chapters 1–5; QC can publish ch. 5).
  The roster belongs to the team (its roles apply to every series the team works on); the tasks belong to the team's
  project for "Readora Demo Saga". `/scanlation` lists my teams and their task boards.
  The catalog also has four US-04 series (Solo Leveling, Omniscient Reader, Horimiya, Berserk; no chapters) to try
  search and filters; Solo Leveling and Berserk have series facts (other titles, artist, year, language, rating).
  `leader` can edit the page of "Readora Demo Saga" from `/scanlation` ("Edit series").
  Demo content (`R__local_seed_demo_content.sql`): teams "Moonlight Scans" (`leader2`) and "Equipe Aurore" (`leader3`);
  published chapters (5 placeholder pages each) for Solo Leveling (two teams' versions), Omniscient Reader, Horimiya
  and two seed series; Readora Demo Saga (drafts only, from the board) and Berserk have none. Readers `yuki` and `sam`
  wrote comments (a reply thread, a spoiler); `moderator` has two open reports. `reader` finished Horimiya, is on
  chapter 4 of Solo Leveling, has a public list, a team follow and notifications; `kenji` has a bookmark in
  Omniscient Reader. Page images and covers are drawn at startup by `LocalSeedImages` (keys under `seed/`).
  Seed files: `backend/readora-infrastructure/src/main/resources/db/seed-local/`.
  Never enabled with `production` (startup guard).

## Cross-cutting rules
- `.feature` files in `.readora/context/user-stories/` are the source of truth for behaviour. New behaviour → scenario first.
  Scenario tags: `@must`/`@should`/`@could` (priority), `@wip` (not built yet, skipped), `@ui` (frontend-only: not run by
  Cucumber; a frontend Vitest `it(...)` carries the exact scenario title). Everything else runs as a Cucumber test.
- Identity comes **only** from the JWT. Never accept `userId` / `authorId` / `publisherId` in a request body;
  tests on both sides assert this, keep it that way.
- One API envelope: backend `ApiResponse.ok/error` ↔ frontend `ApiClient` unwraps it into typed values / `ApiError`.
- Permission names are shared vocabulary: backend `Role` enum permission sets and `@PreAuthorize`,
  frontend route `data: { permission }` + `permissionGuard` and `*appHasPermission`. Rename in both places or neither.
  Roles today: `READER`, `MODERATOR` (reader + `COMMENT_MODERATE`, which also covers reviewing a team's first
  chapter), `ADMIN` (everything). Free signed-in
  features (library, bookmarks, history, lists, follows, notifications, export) share `LIBRARY_USE`; add a new
  permission only when a role must be able to lack it. There are no paid plans (Premium was removed on 2026-09-23).
  Team tools are not an account role: any reader can start or join a team, and what a member may do comes from
  their roles in that team (`ScanlationRole`), checked by the services and mirrored in the UI from the team data
  (`core/models/scanlation.ts`), never from global permissions.
- Authorization is enforced on the server for every write, including resource ownership/membership. UI gating is cosmetic.
- No default secrets anywhere (yml fallbacks, `@DefaultValue`, env files). Missing secret = startup failure.
- Decisions are recorded where they're read: the commit's `Why:` for the change, and the matching `AGENTS.md` when
  it becomes a rule. No separate architecture/domain docs: the code (and ArchUnit) is the reference.
- Keep lint, tests and build green; don't leave `console.error`/`printStackTrace` as error handling.

## Git: commit every change an AI agent makes (user rule)
Goal: every change is a checkpoint that can be found and reverted later.
- When on `main`, create a branch first (`fix/<topic>`, `feat/<topic>`, `chore/<topic>`). Never push unless asked.
- **One logical change = one commit**, made as soon as that change builds/tests green. Don't batch unrelated fixes.
- Stage only files you changed, by explicit path (`git add <paths>`). Never `git add -A`: the user often has
  unrelated uncommitted work in `.readora/` and `docs/`.
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
- Review backlog ids: backend `B<n>` in `backend/AGENTS.md`, frontend `F<n>` in `frontend/AGENTS.md` ("Open review items");
  the 2026-09-19 review uses `review-2026-09-19/<n>` (same sections, CI/deploy items in `backend/AGENTS.md`).
  The backlogs list open items only: when an item is fully fixed, delete its line in the fixing commit (its `Refs:`
  keeps the id; `git log -p -- <file>` keeps the text). A lesson that must not be forgotten becomes a rule in the
  matching section instead.
