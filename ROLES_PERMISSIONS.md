# Readora Roles & Permissions Architecture

This document describes Readora's authorization model, detailing account roles, subscription entitlements, project-level scanlation roles, and the access control matrix across backend APIs and frontend features.

---

## 1. The 3-Tier Authorization Model

Readora uses a layered access control architecture composed of three distinct tiers:

```
┌────────────────────────────────────────────────────────────────────────┐
│ Tier 1: Global Account Role (READER, SCANLATOR, ADMIN)                 │
├───────────────────────────────────┬────────────────────────────────────┤
│ Tier 2: Subscription Plan         │ Tier 3: Scanlation Team Role       │
│ (FREE vs. PREMIUM)                │ (LEADER, CLEANER_REDRAWER, etc.)   │
│ Dynamically grants bookmarking/   │ Project-scoped task claim & submit │
│ progress sync permissions         │ permissions for pipeline stages    │
└───────────────────────────────────┴────────────────────────────────────┘
```

### Effective Permissions Calculation
A user's runtime permissions in the platform are dynamically resolved as:
$$\text{Effective Permissions} = \text{Role.permissions} \cup (\text{Subscription.isActive} ? \text{SubscriptionPlan.permissions} : \emptyset)$$

---

## 2. Tier 1: Global Account Roles (`Role`)

Every user account has a primary role that determines baseline capabilities.

| Role | Description | Base Permissions |
|---|---|---|
| **`READER`** | Default account for reading works, posting comments, and upvoting discussions. | `COMMENT_WRITE`, `COMMENT_UPVOTE` |
| **`SCANLATOR`** | Contributor role with access to scanlation project workspaces, task pipelines, and chapter publishing. | `COMMENT_WRITE`, `COMMENT_UPVOTE`, `PROJECT_VIEW`, `TASK_CLAIM`, `TASK_SUBMIT`, `CHAPTER_PUBLISH` |
| **`ADMIN`** | System administrator with full privileges across catalog, users, projects, and billing. | `COMMENT_WRITE`, `COMMENT_UPVOTE`, `BOOKMARK_READ`, `BOOKMARK_WRITE`, `TASK_CLAIM`, `TASK_SUBMIT`, `CHAPTER_PUBLISH`, `PROJECT_VIEW`, `PROJECT_MANAGE`, `USER_MANAGE` |

---

## 3. Tier 2: Subscription Plans (`SubscriptionPlan`)

Subscriptions unlock dynamic reading enhancements and cross-device synchronization.

| Plan | Pricing | Dynamic Permissions | Features & Capabilities |
|---|---|---|---|
| **`FREE`** | Free ($0/mo) | *None* | Read public chapters, comment, upvote, browse catalog. |
| **`PREMIUM`** | $7.99 / month | `BOOKMARK_READ`, `BOOKMARK_WRITE` | Cross-device reading progress tracking, personal bookmark library, unlimited bookmarks. |

*Note:* When a `PREMIUM` subscription becomes `PAST_DUE`, `CANCELED`, or `INCOMPLETE`, the dynamic permissions are automatically revoked, and the user reverts to their base role permissions.

---

## 4. Tier 3: Scanlation Project Team Roles (`ScanlationRole`)

Within individual scanlation projects, team members are assigned specialized roles that govern which pipeline tasks they can claim and submit:

| Project Role | Pipeline Stage | Task Claim & Submission Permissions |
|---|---|---|
| **`LEADER`** | All Stages | Full management access. Can upload raw chapters, claim any stage, submit work, and publish. |
| **`CLEANER_REDRAWER`** | `RAW_UPLOADED` $\rightarrow$ `CLEANING` | Can claim raw chapter tasks, perform cleaning/redraw, and submit cleaned asset packages to translation. |
| **`TRANSLATOR`** | `TRANSLATING` | Claims cleaned chapter assets and submits translated text/scripts to typesetting. |
| **`TYPESETTER`** | `TYPESETTING` | Claims translated scripts and typesets text onto redraws. |
| **`PROOFREADER`** | `PROOFREADING` | Reviews typeset chapters for grammatical/linguistic accuracy. |
| **`QUALITY_CHECKER`** | `QC_REVIEW` | Performs final quality assurance check before triggering public release (`CHAPTER_PUBLISH`). |

### Workflow Pipeline Progression
```
[Upload RAWs]
     │
     ▼
(RAW_UPLOADED)  ── Claim by CLEANER_REDRAWER ──►  [Submit Cleaned Assets]
                                                            │
                                                            ▼
(TRANSLATING)   ── Claim by TRANSLATOR ────────►  [Submit Translation]
                                                            │
                                                            ▼
(TYPESETTING)   ── Claim by TYPESETTER ────────►  [Submit Typeset Pages]
                                                            │
                                                            ▼
(PROOFREADING)  ── Claim by PROOFREADER ───────►  [Submit Proofread Work]
                                                            │
                                                            ▼
(QC_REVIEW)     ── Approve by QUALITY_CHECKER ──►  (PUBLISHED)
```

---

## 5. Access Control Matrix

### Backend Endpoints Security Matrix

| HTTP Method | API Path | Required Authority / Condition | Accessible Roles / Plans |
|---|---|---|---|
| `GET` | `/api/v1/works/**` | Public (Anonymous) | All users |
| `GET` | `/api/v1/chapters/**` | Public (Anonymous) | All users |
| `GET` | `/api/v1/comments/**` | Public (Anonymous) | All users |
| `POST` | `/api/v1/comments/**` | `COMMENT_WRITE` | READER, SCANLATOR, ADMIN |
| `POST` | `/api/v1/comments/*/upvote` | `COMMENT_UPVOTE` | READER, SCANLATOR, ADMIN |
| `GET` | `/api/v1/bookmarks/**` | `BOOKMARK_READ` | PREMIUM, ADMIN |
| `PUT` | `/api/v1/bookmarks/*/progress`| `BOOKMARK_WRITE` | PREMIUM, ADMIN |
| `GET` | `/api/v1/scanlation/projects/{id}` | `PROJECT_VIEW` | SCANLATOR, ADMIN |
| `POST` | `/api/v1/scanlation/projects/{id}/tasks` | `TASK_CLAIM` or `PROJECT_MANAGE` + Project Member | SCANLATOR member, ADMIN |
| `POST` | `/api/v1/scanlation/projects/{id}/tasks/{id}/claim` | `TASK_CLAIM` + Valid Stage Role | SCANLATOR member, ADMIN |
| `POST` | `/api/v1/scanlation/projects/{id}/tasks/{id}/submit`| `TASK_SUBMIT` + Task Assignee / Leader | SCANLATOR member, ADMIN |
| `POST` | `/api/v1/scanlation/projects/{id}/tasks/{id}/publish`| `CHAPTER_PUBLISH` + QC Checker / Leader | SCANLATOR member, ADMIN |

### Frontend UI & Route Access Matrix

| Route / Feature | Guard / Directive | Visible To |
|---|---|---|
| `/profile` | `authGuard` | Authenticated users |
| `/subscription` | Public / `authGuard` for checkout | All users |
| `/scanlation` | `permissionGuard('PROJECT_VIEW')` | SCANLATOR, ADMIN |
| Profile menu > "Scanlation" | `*appHasPermission="'PROJECT_VIEW'"` | SCANLATOR, ADMIN |
| Kanban "Upload Chapter" button | `*appHasPermission="'TASK_CLAIM'"` | SCANLATOR, ADMIN |
| Reading Progress Synchronization | `isPremium` / `BOOKMARK_WRITE` | PREMIUM subscribers, ADMIN |
