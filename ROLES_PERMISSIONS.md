# Readora roles and permissions

How access works in Readora. The code is the reference: `Role` and `Permission` (backend `domain.identity`), the
`@PreAuthorize` annotations on the controllers, the public matchers in `SecurityConfig`, and the frontend route
`data: { permission }` / `*appHasPermission`. If this page and the code disagree, the code wins: fix this page.

There are two layers, and no paid plans (Premium was removed on 2026-09-23):

1. **Account role** (`Role`): gives a set of permissions, carried in the JWT. The server checks them on every write.
2. **Team role** (`ScanlationRole`): decides what a member may do inside a scanlation team. Services check it
   (membership, stage, assignee), on top of the permission.

## 1. Account roles

| Role | For | Permissions |
|---|---|---|
| `READER` | every new account | `COMMENT_WRITE`, `COMMENT_UPVOTE`, `COMMENT_REPORT`, `LIBRARY_USE`, `PAGE_REPORT`, `RATE_WORK` |
| `MODERATOR` | looks after discussions (US-11) | reader permissions + `COMMENT_MODERATE` |
| `SCANLATOR` | team members | reader permissions + `PROJECT_VIEW`, `TASK_CLAIM`, `TASK_SUBMIT`, `CHAPTER_PUBLISH`, `WORK_CREATE` |
| `ADMIN` | operators | every permission |

## 2. What each permission allows

| Permission | Allows | Frontend |
|---|---|---|
| `COMMENT_WRITE` | post comments and replies | comment form |
| `COMMENT_UPVOTE` | upvote comments | upvote button |
| `COMMENT_REPORT` | report a comment to the moderators | report button |
| `COMMENT_MODERATE` | see the report queue, hide comments, dismiss reports | `/moderation` |
| `LIBRARY_USE` | library, reading history, read markers, bookmarks and progress sync, reading lists, team follows, notifications, export | `/library`, `/history`, reader progress |
| `PAGE_REPORT` | report a page that doesn't display (US-06) | reader "Report page" |
| `RATE_WORK` | rate and review series, mark reviews helpful (US-09) | ratings section |
| `PROJECT_VIEW` | see my teams, their task boards and page reports | `/scanlation` |
| `TASK_CLAIM` | upload a raw chapter as a task, claim a task | board |
| `TASK_SUBMIT` | submit work on a claimed task | board |
| `CHAPTER_PUBLISH` | publish from QC, publish a chapter directly | board, upload studio |
| `WORK_CREATE` | create series and teams, edit a series page, add members and series to a team | upload studio, team pages |
| `USER_MANAGE` | admin override in the services (act on any team, series or report) | none |

Anonymous visitors can read: works, chapters, comments, updates, rankings, public lists, team and user profiles, and
stored assets (the `permitAll` GET matchers in `SecurityConfig`). Everything else needs a signed-in account.

## 3. Team roles

A team has one roster, and its roles apply to every series the team works on. A member can hold several roles.
`LEADER` counts as every role (`TeamMember.hasRole`), and a team always keeps at least one leader (`LAST_LEADER`).

| Team role | Claims and submits tasks in stage |
|---|---|
| `LEADER` | any stage; also manages the roster and the team's series |
| `CLEANER_REDRAWER` | `RAW_UPLOADED`, `CLEANING` |
| `TRANSLATOR` | `TRANSLATING` |
| `TYPESETTER` | `TYPESETTING` |
| `PROOFREADER` | `PROOFREADING` |
| `QUALITY_CHECKER` | `QC_REVIEW`: approves, which publishes the chapter |

Stages follow `RAW_UPLOADED → CLEANING → TRANSLATING → TYPESETTING → PROOFREADING → QC_REVIEW → PUBLISHED`
(`WorkflowStage`).

A permission alone is never enough for a write on a team's resources. The service also checks that the actor belongs
to the team, holds the stage's role, or is the assignee. An admin's `USER_MANAGE` can stand in where the service
allows it.
