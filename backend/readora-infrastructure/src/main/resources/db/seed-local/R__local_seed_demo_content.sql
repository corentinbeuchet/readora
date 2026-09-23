-- ==============================================================================
-- LOCAL/DEV ONLY - loaded only with the `local` Spring profile, after R__local_seed_accounts.sql (Flyway runs
-- repeatable migrations in name order). Same rules: WHERE NOT EXISTS on every insert, UUIDs CAST explicitly.
--
-- Content to try the app with: two more teams, published chapters (Solo Leveling in two teams' versions),
-- comments with replies, open reports for the moderation queue, and reading history, a bookmark, a library,
-- a reading list, a team follow and notifications for `reader` / `kenji`.
-- Page images and covers are keys under `seed/`: LocalSeedImages draws and stores them at startup.
--
-- What each account sees:
--   reader    Horimiya fully read, Solo Leveling read up to chapter 3, a public list, follows Moonlight Scans
--   kenji     a bookmark in Omniscient Reader chapter 3
--   moderator two open comment reports at /moderation
--   leader2 / leader3  lead "Moonlight Scans" / "Equipe Aurore"
-- Readora Demo Saga keeps no published chapter (its chapters come from the scanlation board), Berserk has none.
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- Accounts: two more team leaders and two readers who write comments (password `readora-dev`)
-- ------------------------------------------------------------------------------
INSERT INTO users (id, email, username, password_hash, display_name, bio, roles, created_at, updated_at, version)
SELECT v.id, v.email, v.username, '$2a$10$h4Sf.74pdhE2fAwSA88J9uFUWM2M4gbKdr8AndMQ436nzwB4zR7OW', v.display_name, v.bio, v.roles,
       CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 0
FROM (
    SELECT '00000000-0000-4000-8000-000000000021' AS id, 'leader2@readora.local' AS email, 'leader2' AS username,
           'Mina (Moonlight Scans)' AS display_name, 'Leads Moonlight Scans (seed)' AS bio, 'READER' AS roles
    UNION ALL SELECT '00000000-0000-4000-8000-000000000031', 'leader3@readora.local', 'leader3',
           'Aurore', 'Leads Equipe Aurore (seed)', 'READER'
    UNION ALL SELECT '00000000-0000-4000-8000-000000000041', 'yuki@readora.local', 'yuki',
           'Yuki', 'Reads everything twice (seed)', 'READER'
    UNION ALL SELECT '00000000-0000-4000-8000-000000000042', 'sam@readora.local', 'sam',
           'Sam', 'Comments a lot (seed)', 'READER'
) v
WHERE NOT EXISTS (SELECT 1 FROM users u WHERE u.id = v.id OR u.email = v.email OR u.username = v.username);

-- ------------------------------------------------------------------------------
-- Two original series, only here to have more chapters to read
-- ------------------------------------------------------------------------------
INSERT INTO works (id, title, synopsis, work_type, status, author, demographic, cover_image_url, created_at, updated_at, version)
SELECT CAST(v.id AS UUID), v.title, v.synopsis, v.work_type, v.status, v.author, v.demographic, NULL,
       CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 0
FROM (
    SELECT '00000000-0000-4000-9000-000000000015' AS id, 'Moonlit Blade' AS title,
           'A disgraced swordswoman guards a travelling library through a country at war. (Seed series.)' AS synopsis,
           'MANHWA' AS work_type, 'ONGOING' AS status, 'Han Seo-yeon' AS author, 'SEINEN' AS demographic
    UNION ALL SELECT '00000000-0000-4000-9000-000000000016', 'Last Stop Cafe',
           'The cafe at the end of the tram line serves one customer a night, and every one has a story. (Seed series.)',
           'MANGA', 'ONGOING', 'Aoi Kurata', 'JOSEI'
) v
WHERE NOT EXISTS (SELECT 1 FROM works w WHERE w.id = CAST(v.id AS UUID));

INSERT INTO work_genres (work_id, genre)
SELECT CAST(g.work_id AS UUID), g.genre
FROM (
    SELECT '00000000-0000-4000-9000-000000000015' AS work_id, 'Action' AS genre
    UNION ALL SELECT '00000000-0000-4000-9000-000000000015', 'Historical'
    UNION ALL SELECT '00000000-0000-4000-9000-000000000016', 'Slice of Life'
    UNION ALL SELECT '00000000-0000-4000-9000-000000000016', 'Drama'
) g
WHERE NOT EXISTS (SELECT 1 FROM work_genres wg WHERE wg.work_id = CAST(g.work_id AS UUID) AND wg.genre = g.genre);

-- ------------------------------------------------------------------------------
-- Teams, rosters and the series each team works on
-- ------------------------------------------------------------------------------
INSERT INTO teams (id, name, name_key, description, created_at, updated_at, version)
SELECT CAST(v.id AS UUID), v.name, v.name_key, v.description, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 0
FROM (
    SELECT '00000000-0000-4000-9000-000000000102' AS id, 'Moonlight Scans' AS name, 'moonlight scans' AS name_key,
           'Fast weekly releases, action series first.' AS description
    UNION ALL SELECT '00000000-0000-4000-9000-000000000103', 'Equipe Aurore', 'equipe aurore',
           'Slice of life and romance, carefully typeset.'
) v
WHERE NOT EXISTS (SELECT 1 FROM teams t WHERE t.id = CAST(v.id AS UUID) OR t.name_key = v.name_key);

INSERT INTO team_members (id, team_id, user_id, joined_at)
SELECT CAST(m.id AS UUID), CAST(m.team_id AS UUID), m.user_id, CURRENT_TIMESTAMP
FROM (
    SELECT '00000000-0000-4000-9000-000000000211' AS id, '00000000-0000-4000-9000-000000000102' AS team_id,
           '00000000-0000-4000-8000-000000000021' AS user_id
    UNION ALL SELECT '00000000-0000-4000-9000-000000000221', '00000000-0000-4000-9000-000000000103', '00000000-0000-4000-8000-000000000031'
) m
WHERE EXISTS (SELECT 1 FROM users u WHERE u.id = m.user_id)
  AND EXISTS (SELECT 1 FROM teams t WHERE t.id = CAST(m.team_id AS UUID))
  AND NOT EXISTS (SELECT 1 FROM team_members t
                  WHERE t.id = CAST(m.id AS UUID) OR (t.team_id = CAST(m.team_id AS UUID) AND t.user_id = m.user_id));

INSERT INTO member_roles (member_id, role)
SELECT CAST(r.member_id AS UUID), r.role
FROM (
    SELECT '00000000-0000-4000-9000-000000000211' AS member_id, 'LEADER' AS role
    UNION ALL SELECT '00000000-0000-4000-9000-000000000211', 'TRANSLATOR'
    UNION ALL SELECT '00000000-0000-4000-9000-000000000211', 'QUALITY_CHECKER'
    UNION ALL SELECT '00000000-0000-4000-9000-000000000221', 'LEADER'
    UNION ALL SELECT '00000000-0000-4000-9000-000000000221', 'QUALITY_CHECKER'
) r
WHERE EXISTS (SELECT 1 FROM team_members t WHERE t.id = CAST(r.member_id AS UUID))
  AND NOT EXISTS (SELECT 1 FROM member_roles mr WHERE mr.member_id = CAST(r.member_id AS UUID) AND mr.role = r.role);

INSERT INTO scanlation_projects (id, name, work_id, team_id, created_at, updated_at, version)
SELECT CAST(p.id AS UUID), p.name, CAST(p.work_id AS UUID), CAST(p.team_id AS UUID), CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 0
FROM (
    SELECT '00000000-0000-4000-9000-000000000111' AS id, 'Readora Demo Team - Solo Leveling' AS name,
           '00000000-0000-4000-9000-000000000011' AS work_id, '00000000-0000-4000-9000-000000000101' AS team_id
    UNION ALL SELECT '00000000-0000-4000-9000-000000000121', 'Moonlight Scans - Solo Leveling',
           '00000000-0000-4000-9000-000000000011', '00000000-0000-4000-9000-000000000102'
    UNION ALL SELECT '00000000-0000-4000-9000-000000000122', 'Moonlight Scans - Omniscient Reader',
           '00000000-0000-4000-9000-000000000012', '00000000-0000-4000-9000-000000000102'
    UNION ALL SELECT '00000000-0000-4000-9000-000000000125', 'Moonlight Scans - Moonlit Blade',
           '00000000-0000-4000-9000-000000000015', '00000000-0000-4000-9000-000000000102'
    UNION ALL SELECT '00000000-0000-4000-9000-000000000133', 'Equipe Aurore - Horimiya',
           '00000000-0000-4000-9000-000000000013', '00000000-0000-4000-9000-000000000103'
    UNION ALL SELECT '00000000-0000-4000-9000-000000000136', 'Equipe Aurore - Last Stop Cafe',
           '00000000-0000-4000-9000-000000000016', '00000000-0000-4000-9000-000000000103'
) p
WHERE EXISTS (SELECT 1 FROM works w WHERE w.id = CAST(p.work_id AS UUID))
  AND EXISTS (SELECT 1 FROM teams t WHERE t.id = CAST(p.team_id AS UUID))
  AND NOT EXISTS (SELECT 1 FROM scanlation_projects s
                  WHERE s.id = CAST(p.id AS UUID) OR (s.team_id = CAST(p.team_id AS UUID) AND s.work_id = CAST(p.work_id AS UUID)));

-- ------------------------------------------------------------------------------
-- Published chapters, one version per (series, team). Chapter id: 00000000-0000-4000-b0WT-0000000000NN
-- (W = series code, T = team code, NN = chapter number). Later chapters were published more recently.
-- ------------------------------------------------------------------------------
INSERT INTO chapters (id, work_id, chapter_number, title, status, team_id, created_at, published_at, updated_at, version)
SELECT CAST('00000000-0000-4000-b0' || s.work_code || s.team_code || '-0000000000' || LPAD(CAST(n.n AS VARCHAR(2)), 2, '0') AS UUID),
       CAST(s.work_id AS UUID), CAST(n.n AS VARCHAR(2)), 'Chapter ' || CAST(n.n AS VARCHAR(2)), 'PUBLISHED', CAST(s.team_id AS UUID),
       CURRENT_TIMESTAMP - INTERVAL '1' DAY * (s.days_ago + s.chapters - n.n),
       CURRENT_TIMESTAMP - INTERVAL '1' DAY * (s.days_ago + s.chapters - n.n),
       CURRENT_TIMESTAMP, 0
FROM (
    SELECT '1' AS work_code, '00000000-0000-4000-9000-000000000011' AS work_id,
           '1' AS team_code, '00000000-0000-4000-9000-000000000101' AS team_id, 8 AS chapters, 0 AS days_ago
    UNION ALL SELECT '1', '00000000-0000-4000-9000-000000000011', '2', '00000000-0000-4000-9000-000000000102', 4, 3
    UNION ALL SELECT '2', '00000000-0000-4000-9000-000000000012', '2', '00000000-0000-4000-9000-000000000102', 6, 1
    UNION ALL SELECT '3', '00000000-0000-4000-9000-000000000013', '3', '00000000-0000-4000-9000-000000000103', 5, 10
    UNION ALL SELECT '5', '00000000-0000-4000-9000-000000000015', '2', '00000000-0000-4000-9000-000000000102', 3, 2
    UNION ALL SELECT '6', '00000000-0000-4000-9000-000000000016', '3', '00000000-0000-4000-9000-000000000103', 4, 5
) s
CROSS JOIN (
    SELECT 1 AS n UNION ALL SELECT 2 UNION ALL SELECT 3 UNION ALL SELECT 4
    UNION ALL SELECT 5 UNION ALL SELECT 6 UNION ALL SELECT 7 UNION ALL SELECT 8
) n
WHERE n.n <= s.chapters
  AND EXISTS (SELECT 1 FROM works w WHERE w.id = CAST(s.work_id AS UUID))
  AND EXISTS (SELECT 1 FROM teams t WHERE t.id = CAST(s.team_id AS UUID))
  AND NOT EXISTS (SELECT 1 FROM chapters c
                  WHERE c.id = CAST('00000000-0000-4000-b0' || s.work_code || s.team_code || '-0000000000' || LPAD(CAST(n.n AS VARCHAR(2)), 2, '0') AS UUID)
                     OR (c.work_id = CAST(s.work_id AS UUID) AND c.team_id = CAST(s.team_id AS UUID) AND c.chapter_number = CAST(n.n AS VARCHAR(2))));

-- Five pages per seeded chapter; cdn_url stays NULL (the reader derives it from the key).
INSERT INTO page_assets (chapter_id, page_number, storage_key, cdn_url, width, height, description)
SELECT c.id, p.n, 'seed/pages/' || CAST(c.id AS VARCHAR(36)) || '/p' || CAST(p.n AS VARCHAR(2)) || '.png', NULL, 800, 1200,
       'Placeholder page ' || CAST(p.n AS VARCHAR(2)) || ' of chapter ' || c.chapter_number
FROM chapters c
CROSS JOIN (SELECT 1 AS n UNION ALL SELECT 2 UNION ALL SELECT 3 UNION ALL SELECT 4 UNION ALL SELECT 5) p
WHERE CAST(c.id AS VARCHAR(36)) LIKE '00000000-0000-4000-b0%'
  AND NOT EXISTS (SELECT 1 FROM page_assets pa WHERE pa.chapter_id = c.id AND pa.page_number = p.n);

-- ------------------------------------------------------------------------------
-- Comments on Solo Leveling ch. 1 (Demo Team), Omniscient Reader ch. 1 and Horimiya ch. 1:
-- a reply thread three deep, a spoiler, upvotes; two of them reported (open), one report dismissed.
-- ------------------------------------------------------------------------------
INSERT INTO chapter_comments (id, chapter_id, author_id, author_username, content, page_reference, parent_id, depth, is_spoiler, upvotes, created_at, hidden)
SELECT CAST(v.id AS UUID), CAST(v.chapter_id AS UUID), v.author_id, v.author_username, v.content, v.page_reference,
       NULL, v.depth, v.is_spoiler, v.upvotes, CURRENT_TIMESTAMP - INTERVAL '1' HOUR * v.hours_ago, FALSE
FROM (
    SELECT '00000000-0000-4000-c000-000000000001' AS id, '00000000-0000-4000-b011-000000000001' AS chapter_id,
           '00000000-0000-4000-8000-000000000001' AS author_id, 'reader' AS author_username,
           'Finally reading this! The first dungeon scene is intense.' AS content, CAST(NULL AS INT) AS page_reference,
           CAST(NULL AS VARCHAR(36)) AS parent_id, 1 AS depth, FALSE AS is_spoiler, 2 AS upvotes, 30 AS hours_ago
    UNION ALL SELECT '00000000-0000-4000-c000-000000000002', '00000000-0000-4000-b011-000000000001',
           '00000000-0000-4000-8000-000000000041', 'yuki', 'Right? Wait until you see the statue scene.', NULL,
           '00000000-0000-4000-c000-000000000001', 2, FALSE, 1, 28
    UNION ALL SELECT '00000000-0000-4000-c000-000000000003', '00000000-0000-4000-b011-000000000001',
           '00000000-0000-4000-8000-000000000001', 'reader', 'No hints please, I am only on chapter 1!', NULL,
           '00000000-0000-4000-c000-000000000002', 3, FALSE, 0, 27
    UNION ALL SELECT '00000000-0000-4000-c000-000000000004', '00000000-0000-4000-b011-000000000001',
           '00000000-0000-4000-8000-000000000042', 'sam', 'The system is the one who chose him in the dungeon.', 4,
           NULL, 1, TRUE, 1, 20
    UNION ALL SELECT '00000000-0000-4000-c000-000000000005', '00000000-0000-4000-b011-000000000001',
           '00000000-0000-4000-8000-000000000042', 'sam', 'Anyone who likes the other team''s version is an idiot.', NULL,
           NULL, 1, FALSE, 0, 12
    UNION ALL SELECT '00000000-0000-4000-c000-000000000006', '00000000-0000-4000-b022-000000000001',
           '00000000-0000-4000-8000-000000000041', 'yuki', 'Get 1000 followers for free at totally-legit.example', NULL,
           NULL, 1, FALSE, 0, 8
    UNION ALL SELECT '00000000-0000-4000-c000-000000000007', '00000000-0000-4000-b022-000000000001',
           '00000000-0000-4000-8000-000000000002', 'kenji', 'The translation notes on page 3 are great.', 3,
           NULL, 1, FALSE, 1, 6
    UNION ALL SELECT '00000000-0000-4000-c000-000000000008', '00000000-0000-4000-b033-000000000001',
           '00000000-0000-4000-8000-000000000001', 'reader', 'Hori and Miyamura are adorable.', NULL,
           NULL, 1, FALSE, 0, 50
) v
WHERE EXISTS (SELECT 1 FROM chapters c WHERE c.id = CAST(v.chapter_id AS UUID))
  AND NOT EXISTS (SELECT 1 FROM chapter_comments cc WHERE cc.id = CAST(v.id AS UUID));

-- Replies are linked once every comment exists (H2 checks the parent key row by row within one insert).
UPDATE chapter_comments SET parent_id = CAST('00000000-0000-4000-c000-000000000001' AS UUID)
WHERE id = CAST('00000000-0000-4000-c000-000000000002' AS UUID) AND parent_id IS NULL;
UPDATE chapter_comments SET parent_id = CAST('00000000-0000-4000-c000-000000000002' AS UUID)
WHERE id = CAST('00000000-0000-4000-c000-000000000003' AS UUID) AND parent_id IS NULL;

INSERT INTO comment_upvotes (comment_id, user_id, created_at)
SELECT CAST(v.comment_id AS UUID), v.user_id, CURRENT_TIMESTAMP
FROM (
    SELECT '00000000-0000-4000-c000-000000000001' AS comment_id, '00000000-0000-4000-8000-000000000041' AS user_id
    UNION ALL SELECT '00000000-0000-4000-c000-000000000001', '00000000-0000-4000-8000-000000000002'
    UNION ALL SELECT '00000000-0000-4000-c000-000000000002', '00000000-0000-4000-8000-000000000001'
    UNION ALL SELECT '00000000-0000-4000-c000-000000000004', '00000000-0000-4000-8000-000000000041'
    UNION ALL SELECT '00000000-0000-4000-c000-000000000007', '00000000-0000-4000-8000-000000000001'
) v
WHERE EXISTS (SELECT 1 FROM chapter_comments c WHERE c.id = CAST(v.comment_id AS UUID))
  AND NOT EXISTS (SELECT 1 FROM comment_upvotes u WHERE u.comment_id = CAST(v.comment_id AS UUID) AND u.user_id = v.user_id);

INSERT INTO comment_reports (id, comment_id, reporter_id, reason, status, created_at, closed_at, closed_by)
SELECT CAST(v.id AS UUID), CAST(v.comment_id AS UUID), v.reporter_id, v.reason, v.status,
       CURRENT_TIMESTAMP - INTERVAL '1' HOUR * v.hours_ago,
       CASE WHEN v.status = 'OPEN' THEN NULL ELSE CURRENT_TIMESTAMP END, v.closed_by
FROM (
    SELECT '00000000-0000-4000-d000-000000000001' AS id, '00000000-0000-4000-c000-000000000005' AS comment_id,
           '00000000-0000-4000-8000-000000000001' AS reporter_id, 'HARASSMENT' AS reason, 'OPEN' AS status,
           10 AS hours_ago, CAST(NULL AS VARCHAR(100)) AS closed_by
    UNION ALL SELECT '00000000-0000-4000-d000-000000000002', '00000000-0000-4000-c000-000000000006',
           '00000000-0000-4000-8000-000000000002', 'SPAM', 'OPEN', 5, NULL
    UNION ALL SELECT '00000000-0000-4000-d000-000000000003', '00000000-0000-4000-c000-000000000008',
           '00000000-0000-4000-8000-000000000042', 'UNMARKED_SPOILER', 'DISMISSED', 40, '00000000-0000-4000-8000-000000000004'
) v
WHERE EXISTS (SELECT 1 FROM chapter_comments c WHERE c.id = CAST(v.comment_id AS UUID))
  AND NOT EXISTS (SELECT 1 FROM comment_reports r WHERE r.id = CAST(v.id AS UUID));

-- ------------------------------------------------------------------------------
-- reader: Horimiya finished (every chapter read), Solo Leveling read up to chapter 3; library, list, follow.
-- kenji: Omniscient Reader chapters 1-2 read, bookmarked on page 2 of chapter 3.
-- ------------------------------------------------------------------------------
INSERT INTO chapter_reads (user_id, chapter_id, work_id, chapter_number, read_at, finished)
SELECT r.user_id, c.id, c.work_id, c.chapter_number, CURRENT_TIMESTAMP - INTERVAL '1' HOUR * (10 - CAST(c.chapter_number AS INT)), TRUE
FROM chapters c
JOIN (
    SELECT '00000000-0000-4000-8000-000000000001' AS user_id, '00000000-0000-4000-b033-' AS chapter_prefix, 5 AS up_to
    UNION ALL SELECT '00000000-0000-4000-8000-000000000001', '00000000-0000-4000-b011-', 3
    UNION ALL SELECT '00000000-0000-4000-8000-000000000002', '00000000-0000-4000-b022-', 2
) r ON CAST(c.id AS VARCHAR(36)) LIKE r.chapter_prefix || '%' AND CAST(c.chapter_number AS INT) <= r.up_to
WHERE NOT EXISTS (SELECT 1 FROM chapter_reads cr WHERE cr.user_id = r.user_id AND cr.chapter_id = c.id);

INSERT INTO bookmarks (user_id, work_id, last_read_chapter_id, last_read_page_index, status, updated_at)
SELECT '00000000-0000-4000-8000-000000000002', CAST('00000000-0000-4000-9000-000000000012' AS UUID),
       CAST('00000000-0000-4000-b022-000000000003' AS UUID), 2, 'READING', CURRENT_TIMESTAMP
WHERE EXISTS (SELECT 1 FROM chapters WHERE id = CAST('00000000-0000-4000-b022-000000000003' AS UUID))
  AND NOT EXISTS (SELECT 1 FROM bookmarks b WHERE b.user_id = '00000000-0000-4000-8000-000000000002'
                  AND b.work_id = CAST('00000000-0000-4000-9000-000000000012' AS UUID));

INSERT INTO library_entries (user_id, work_id, status, added_at, updated_at, notify)
SELECT v.user_id, CAST(v.work_id AS UUID), v.status, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, TRUE
FROM (
    SELECT '00000000-0000-4000-8000-000000000001' AS user_id, '00000000-0000-4000-9000-000000000013' AS work_id, 'COMPLETED' AS status
    UNION ALL SELECT '00000000-0000-4000-8000-000000000001', '00000000-0000-4000-9000-000000000011', 'READING'
    UNION ALL SELECT '00000000-0000-4000-8000-000000000001', '00000000-0000-4000-9000-000000000016', 'PLAN_TO_READ'
    UNION ALL SELECT '00000000-0000-4000-8000-000000000002', '00000000-0000-4000-9000-000000000012', 'READING'
) v
WHERE EXISTS (SELECT 1 FROM works w WHERE w.id = CAST(v.work_id AS UUID))
  AND NOT EXISTS (SELECT 1 FROM library_entries l WHERE l.user_id = v.user_id AND l.work_id = CAST(v.work_id AS UUID));

INSERT INTO reading_lists (id, owner_id, owner_username, title, description, published, created_at, updated_at)
SELECT CAST('00000000-0000-4000-f000-000000000001' AS UUID), '00000000-0000-4000-8000-000000000001', 'reader',
       'Cozy weekend reads', 'Short, warm series to read on a lazy weekend.', TRUE, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
WHERE NOT EXISTS (SELECT 1 FROM reading_lists WHERE id = CAST('00000000-0000-4000-f000-000000000001' AS UUID));

INSERT INTO reading_list_items (list_id, position, work_id, note)
SELECT CAST('00000000-0000-4000-f000-000000000001' AS UUID), v.position, CAST(v.work_id AS UUID), v.note
FROM (
    SELECT 0 AS position, '00000000-0000-4000-9000-000000000013' AS work_id, 'The best high-school romance.' AS note
    UNION ALL SELECT 1, '00000000-0000-4000-9000-000000000016', NULL
) v
WHERE EXISTS (SELECT 1 FROM reading_lists WHERE id = CAST('00000000-0000-4000-f000-000000000001' AS UUID))
  AND NOT EXISTS (SELECT 1 FROM reading_list_items i
                  WHERE i.list_id = CAST('00000000-0000-4000-f000-000000000001' AS UUID) AND i.position = v.position);

INSERT INTO team_follows (user_id, team_id, followed_at)
SELECT '00000000-0000-4000-8000-000000000001', CAST('00000000-0000-4000-9000-000000000102' AS UUID), CURRENT_TIMESTAMP
WHERE EXISTS (SELECT 1 FROM teams WHERE id = CAST('00000000-0000-4000-9000-000000000102' AS UUID))
  AND NOT EXISTS (SELECT 1 FROM team_follows f WHERE f.user_id = '00000000-0000-4000-8000-000000000001'
                  AND f.team_id = CAST('00000000-0000-4000-9000-000000000102' AS UUID));

-- Same messages and links as NotificationService writes.
INSERT INTO notifications (id, user_id, type, message, link, created_at, read_at)
SELECT CAST(v.id AS UUID), '00000000-0000-4000-8000-000000000001', v.type, v.message, v.link,
       CURRENT_TIMESTAMP - INTERVAL '1' HOUR * v.hours_ago, NULL
FROM (
    SELECT '00000000-0000-4000-e000-000000000001' AS id, 'NEW_CHAPTER' AS type, 'Solo Leveling: chapter 8 is out' AS message,
           '/read/00000000-0000-4000-b011-000000000008' AS link, 1 AS hours_ago
    UNION ALL SELECT '00000000-0000-4000-e000-000000000002', 'COMMENT_REPLY', 'yuki replied to your comment',
           '/read/00000000-0000-4000-b011-000000000001?comment=00000000-0000-4000-c000-000000000002', 28
) v
WHERE NOT EXISTS (SELECT 1 FROM notifications n WHERE n.id = CAST(v.id AS UUID));
