-- ==============================================================================
-- LOCAL/DEV ONLY - loaded only with the `local` Spring profile (application-local.yml).
-- Never enabled in staging/production (ProductionSecretsGuard refuses `production` + `local`).
--
-- One account per platform role + a demo work whose scanlation team has one member per team role,
-- and a few ratings so "Top rated" (at least 5 ratings per series) has something to show.
-- Every account: email <username>@readora.local, password `readora-dev`.
--
-- Repeatable migration: re-applied whenever this file changes. Every insert is guarded by WHERE NOT EXISTS
-- (portable Postgres/H2), so re-runs never duplicate rows or overwrite data you changed while testing.
-- UUID literals are CAST explicitly: PostgreSQL does not compare/insert text into uuid columns (H2 does).
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- Accounts (roles stored like UserAccountRepositoryAdapter: sorted, comma-separated)
-- BCrypt hash of 'readora-dev'
-- ------------------------------------------------------------------------------
INSERT INTO users (id, email, username, password_hash, display_name, bio, roles, created_at, updated_at, version)
SELECT v.id, v.email, v.username, '$2a$10$h4Sf.74pdhE2fAwSA88J9uFUWM2M4gbKdr8AndMQ436nzwB4zR7OW', v.display_name, v.bio, v.roles,
       CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 0
FROM (
    SELECT '00000000-0000-4000-8000-000000000001' AS id, 'reader@readora.local' AS email, 'reader' AS username,
           'Local Reader' AS display_name, 'Free reader (seed)' AS bio, 'READER' AS roles
    UNION ALL SELECT '00000000-0000-4000-8000-000000000002', 'premium@readora.local', 'premium',
           'Local Premium', 'Premium reader: bookmarks enabled (seed)', 'READER'
    UNION ALL SELECT '00000000-0000-4000-8000-000000000003', 'admin@readora.local', 'admin',
           'Local Admin', 'Administrator (seed)', 'ADMIN,READER'
    UNION ALL SELECT '00000000-0000-4000-8000-000000000004', 'moderator@readora.local', 'moderator',
           'Local Moderator', 'Comment moderator (seed)', 'MODERATOR,READER'
    UNION ALL SELECT '00000000-0000-4000-8000-000000000011', 'leader@readora.local', 'leader',
           'Team Leader', 'Scanlation team leader (seed)', 'READER,SCANLATOR'
    UNION ALL SELECT '00000000-0000-4000-8000-000000000012', 'cleaner@readora.local', 'cleaner',
           'Team Cleaner', 'Cleaner / redrawer (seed)', 'READER,SCANLATOR'
    UNION ALL SELECT '00000000-0000-4000-8000-000000000013', 'translator@readora.local', 'translator',
           'Team Translator', 'Translator (seed)', 'READER,SCANLATOR'
    UNION ALL SELECT '00000000-0000-4000-8000-000000000014', 'typesetter@readora.local', 'typesetter',
           'Team Typesetter', 'Typesetter (seed)', 'READER,SCANLATOR'
    UNION ALL SELECT '00000000-0000-4000-8000-000000000015', 'proofreader@readora.local', 'proofreader',
           'Team Proofreader', 'Proofreader (seed)', 'READER,SCANLATOR'
    UNION ALL SELECT '00000000-0000-4000-8000-000000000016', 'quality@readora.local', 'quality',
           'Team Quality Checker', 'Quality checker (seed)', 'READER,SCANLATOR'
) v
WHERE NOT EXISTS (SELECT 1 FROM users u WHERE u.id = v.id OR u.email = v.email OR u.username = v.username);

-- Premium subscription that never expires locally.
INSERT INTO subscriptions (user_id, plan, status, current_period_end, updated_at, cancel_at_period_end)
SELECT '00000000-0000-4000-8000-000000000002', 'PREMIUM', 'ACTIVE', TIMESTAMP '2099-12-31 23:59:59', CURRENT_TIMESTAMP, FALSE
WHERE EXISTS (SELECT 1 FROM users WHERE id = '00000000-0000-4000-8000-000000000002')
  AND NOT EXISTS (SELECT 1 FROM subscriptions WHERE user_id = '00000000-0000-4000-8000-000000000002');

-- ------------------------------------------------------------------------------
-- Demo work + scanlation project with one member per team role
-- ------------------------------------------------------------------------------
INSERT INTO works (id, title, synopsis, work_type, status, cover_image_url, created_at, updated_at, version)
SELECT CAST('00000000-0000-4000-9000-000000000001' AS UUID), 'Readora Demo Saga',
       'Seeded locally to exercise the catalog and the scanlation pipeline.', 'MANHWA', 'ONGOING', NULL,
       CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 0
WHERE NOT EXISTS (SELECT 1 FROM works WHERE id = CAST('00000000-0000-4000-9000-000000000001' AS UUID));

INSERT INTO work_genres (work_id, genre)
SELECT CAST('00000000-0000-4000-9000-000000000001' AS UUID), g.genre
FROM (SELECT 'Action' AS genre UNION ALL SELECT 'Fantasy') g
WHERE NOT EXISTS (SELECT 1 FROM work_genres wg WHERE wg.work_id = CAST('00000000-0000-4000-9000-000000000001' AS UUID) AND wg.genre = g.genre);

-- US-04 catalog discovery: a few series to try the filters and the search on (no chapters: no page images).
INSERT INTO works (id, title, synopsis, work_type, status, author, demographic, cover_image_url, created_at, updated_at, version)
SELECT CAST('00000000-0000-4000-9000-000000000011' AS UUID), 'Solo Leveling', 'Seeded locally to try catalog search and filters.', 'MANHWA', 'COMPLETED', 'Chugong', 'SHOUNEN', NULL,
       CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 0
WHERE NOT EXISTS (SELECT 1 FROM works WHERE id = CAST('00000000-0000-4000-9000-000000000011' AS UUID));

INSERT INTO work_genres (work_id, genre)
SELECT CAST('00000000-0000-4000-9000-000000000011' AS UUID), g.genre
FROM (SELECT 'Action' AS genre UNION ALL SELECT 'Fantasy') g
WHERE NOT EXISTS (SELECT 1 FROM work_genres wg WHERE wg.work_id = CAST('00000000-0000-4000-9000-000000000011' AS UUID) AND wg.genre = g.genre);

INSERT INTO works (id, title, synopsis, work_type, status, author, demographic, cover_image_url, created_at, updated_at, version)
SELECT CAST('00000000-0000-4000-9000-000000000012' AS UUID), 'Omniscient Reader', 'Seeded locally to try catalog search and filters.', 'MANHWA', 'ONGOING', 'Sing Shong', 'SHOUNEN', NULL,
       CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 0
WHERE NOT EXISTS (SELECT 1 FROM works WHERE id = CAST('00000000-0000-4000-9000-000000000012' AS UUID));

INSERT INTO work_genres (work_id, genre)
SELECT CAST('00000000-0000-4000-9000-000000000012' AS UUID), g.genre
FROM (SELECT 'Action' AS genre UNION ALL SELECT 'Fantasy' UNION ALL SELECT 'Apocalypse') g
WHERE NOT EXISTS (SELECT 1 FROM work_genres wg WHERE wg.work_id = CAST('00000000-0000-4000-9000-000000000012' AS UUID) AND wg.genre = g.genre);

INSERT INTO works (id, title, synopsis, work_type, status, author, demographic, cover_image_url, created_at, updated_at, version)
SELECT CAST('00000000-0000-4000-9000-000000000013' AS UUID), 'Horimiya', 'Seeded locally to try catalog search and filters.', 'MANGA', 'COMPLETED', 'HERO', 'SHOUNEN', NULL,
       CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 0
WHERE NOT EXISTS (SELECT 1 FROM works WHERE id = CAST('00000000-0000-4000-9000-000000000013' AS UUID));

INSERT INTO work_genres (work_id, genre)
SELECT CAST('00000000-0000-4000-9000-000000000013' AS UUID), g.genre
FROM (SELECT 'Romance' AS genre UNION ALL SELECT 'Comedy' UNION ALL SELECT 'Slice of Life') g
WHERE NOT EXISTS (SELECT 1 FROM work_genres wg WHERE wg.work_id = CAST('00000000-0000-4000-9000-000000000013' AS UUID) AND wg.genre = g.genre);

INSERT INTO works (id, title, synopsis, work_type, status, author, demographic, cover_image_url, created_at, updated_at, version)
SELECT CAST('00000000-0000-4000-9000-000000000014' AS UUID), 'Berserk', 'Seeded locally to try catalog search and filters.', 'MANGA', 'HIATUS', 'Kentaro Miura', 'SEINEN', NULL,
       CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 0
WHERE NOT EXISTS (SELECT 1 FROM works WHERE id = CAST('00000000-0000-4000-9000-000000000014' AS UUID));

INSERT INTO work_genres (work_id, genre)
SELECT CAST('00000000-0000-4000-9000-000000000014' AS UUID), g.genre
FROM (SELECT 'Action' AS genre UNION ALL SELECT 'Dark Fantasy' UNION ALL SELECT 'Horror') g
WHERE NOT EXISTS (SELECT 1 FROM work_genres wg WHERE wg.work_id = CAST('00000000-0000-4000-9000-000000000014' AS UUID) AND wg.genre = g.genre);

INSERT INTO scanlation_projects (id, name, work_id, created_at, updated_at, version)
SELECT CAST('00000000-0000-4000-9000-000000000101' AS UUID), 'Readora Demo Team', CAST('00000000-0000-4000-9000-000000000001' AS UUID),
       CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 0
WHERE NOT EXISTS (SELECT 1 FROM scanlation_projects WHERE id = CAST('00000000-0000-4000-9000-000000000101' AS UUID));

INSERT INTO team_members (id, project_id, user_id, joined_at)
SELECT m.id, CAST('00000000-0000-4000-9000-000000000101' AS UUID), m.user_id, CURRENT_TIMESTAMP
FROM (
    SELECT CAST('00000000-0000-4000-9000-000000000201' AS UUID) AS id, '00000000-0000-4000-8000-000000000011' AS user_id
    UNION ALL SELECT CAST('00000000-0000-4000-9000-000000000202' AS UUID), '00000000-0000-4000-8000-000000000012'
    UNION ALL SELECT CAST('00000000-0000-4000-9000-000000000203' AS UUID), '00000000-0000-4000-8000-000000000013'
    UNION ALL SELECT CAST('00000000-0000-4000-9000-000000000204' AS UUID), '00000000-0000-4000-8000-000000000014'
    UNION ALL SELECT CAST('00000000-0000-4000-9000-000000000205' AS UUID), '00000000-0000-4000-8000-000000000015'
    UNION ALL SELECT CAST('00000000-0000-4000-9000-000000000206' AS UUID), '00000000-0000-4000-8000-000000000016'
) m
WHERE EXISTS (SELECT 1 FROM users u WHERE u.id = m.user_id)
  AND NOT EXISTS (SELECT 1 FROM team_members t
                  WHERE t.id = m.id OR (t.project_id = CAST('00000000-0000-4000-9000-000000000101' AS UUID) AND t.user_id = m.user_id));

INSERT INTO member_roles (member_id, role)
SELECT r.member_id, r.role
FROM (
    SELECT CAST('00000000-0000-4000-9000-000000000201' AS UUID) AS member_id, 'LEADER' AS role
    UNION ALL SELECT CAST('00000000-0000-4000-9000-000000000202' AS UUID), 'CLEANER_REDRAWER'
    UNION ALL SELECT CAST('00000000-0000-4000-9000-000000000203' AS UUID), 'TRANSLATOR'
    UNION ALL SELECT CAST('00000000-0000-4000-9000-000000000204' AS UUID), 'TYPESETTER'
    UNION ALL SELECT CAST('00000000-0000-4000-9000-000000000205' AS UUID), 'PROOFREADER'
    UNION ALL SELECT CAST('00000000-0000-4000-9000-000000000206' AS UUID), 'QUALITY_CHECKER'
) r
WHERE EXISTS (SELECT 1 FROM team_members t WHERE t.id = r.member_id)
  AND NOT EXISTS (SELECT 1 FROM member_roles mr WHERE mr.member_id = r.member_id AND mr.role = r.role);

-- One open task per stage, so every team role has something to claim/submit and QC can publish chapter 5.
INSERT INTO workflow_tasks (id, project_id, chapter_number, stage, status, assignee_id, asset_package_url, page_count, updated_at)
SELECT t.id, CAST('00000000-0000-4000-9000-000000000101' AS UUID), t.chapter_number, t.stage, 'PENDING', NULL, t.asset_url, 12, CURRENT_TIMESTAMP
FROM (
    SELECT CAST('00000000-0000-4000-9000-000000000301' AS UUID) AS id, '1' AS chapter_number, 'RAW_UPLOADED' AS stage,
           'scans/demo/1/raw.zip' AS asset_url
    UNION ALL SELECT CAST('00000000-0000-4000-9000-000000000302' AS UUID), '2', 'TRANSLATING', 'scans/demo/2/cleaned.zip'
    UNION ALL SELECT CAST('00000000-0000-4000-9000-000000000303' AS UUID), '3', 'TYPESETTING', 'scans/demo/3/script.zip'
    UNION ALL SELECT CAST('00000000-0000-4000-9000-000000000304' AS UUID), '4', 'PROOFREADING', 'scans/demo/4/typeset.zip'
    UNION ALL SELECT CAST('00000000-0000-4000-9000-000000000305' AS UUID), '5', 'QC_REVIEW', 'scans/demo/5/final.zip'
) t
WHERE EXISTS (SELECT 1 FROM scanlation_projects p WHERE p.id = CAST('00000000-0000-4000-9000-000000000101' AS UUID))
  AND NOT EXISTS (SELECT 1 FROM workflow_tasks w
                  WHERE w.id = t.id OR (w.project_id = CAST('00000000-0000-4000-9000-000000000101' AS UUID) AND w.chapter_number = t.chapter_number));

-- ------------------------------------------------------------------------------
-- US-09 ratings on the US-04 series: 5 each, so both reach the "Top rated" ranking; one written review.
-- ------------------------------------------------------------------------------
INSERT INTO work_ratings (id, user_id, work_id, score, liked, disliked, verdict, rated_at, updated_at)
SELECT CAST(v.id AS UUID), v.user_id, CAST(v.work_id AS UUID), v.score, NULL, NULL, v.verdict, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
FROM (
    SELECT '00000000-0000-4000-a000-000000000001' AS id, '00000000-0000-4000-8000-000000000001' AS user_id,
           '00000000-0000-4000-9000-000000000014' AS work_id, 10 AS score,
           'A dark masterpiece; the art alone is worth it.' AS verdict
    UNION ALL SELECT '00000000-0000-4000-a000-000000000002', '00000000-0000-4000-8000-000000000002', '00000000-0000-4000-9000-000000000014', 9, NULL
    UNION ALL SELECT '00000000-0000-4000-a000-000000000003', '00000000-0000-4000-8000-000000000013', '00000000-0000-4000-9000-000000000014', 10, NULL
    UNION ALL SELECT '00000000-0000-4000-a000-000000000004', '00000000-0000-4000-8000-000000000014', '00000000-0000-4000-9000-000000000014', 9, NULL
    UNION ALL SELECT '00000000-0000-4000-a000-000000000005', '00000000-0000-4000-8000-000000000015', '00000000-0000-4000-9000-000000000014', 8, NULL
    UNION ALL SELECT '00000000-0000-4000-a000-000000000011', '00000000-0000-4000-8000-000000000001', '00000000-0000-4000-9000-000000000011', 8, NULL
    UNION ALL SELECT '00000000-0000-4000-a000-000000000012', '00000000-0000-4000-8000-000000000002', '00000000-0000-4000-9000-000000000011', 9, NULL
    UNION ALL SELECT '00000000-0000-4000-a000-000000000013', '00000000-0000-4000-8000-000000000003', '00000000-0000-4000-9000-000000000011', 7, NULL
    UNION ALL SELECT '00000000-0000-4000-a000-000000000014', '00000000-0000-4000-8000-000000000011', '00000000-0000-4000-9000-000000000011', 8, NULL
    UNION ALL SELECT '00000000-0000-4000-a000-000000000015', '00000000-0000-4000-8000-000000000012', '00000000-0000-4000-9000-000000000011', 9, NULL
) v
WHERE EXISTS (SELECT 1 FROM works w WHERE w.id = CAST(v.work_id AS UUID))
  AND NOT EXISTS (SELECT 1 FROM work_ratings r WHERE r.id = CAST(v.id AS UUID) OR (r.user_id = v.user_id AND r.work_id = CAST(v.work_id AS UUID)));
