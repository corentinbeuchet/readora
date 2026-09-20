-- US-12: every chapter is one team's version of it, so it points to the team (not to a project, which is only that
-- team's task board for the series). Same for page reports, which go to the chapter's team.
ALTER TABLE chapters ADD COLUMN team_id UUID;

UPDATE chapters SET team_id = (SELECT p.team_id FROM scanlation_projects p WHERE p.id = chapters.scanlation_project_id)
WHERE scanlation_project_id IS NOT NULL;

-- Chapters published without a project (by an admin): the series' first team, as the publish rule did until now.
UPDATE chapters SET team_id = (SELECT p.team_id FROM scanlation_projects p WHERE p.work_id = chapters.work_id
                               ORDER BY p.created_at, p.id LIMIT 1)
WHERE team_id IS NULL;

-- Chapters of a series no team ever worked on: a house team, created only when such chapters exist.
INSERT INTO teams (id, name, name_key, description, created_at, updated_at, version)
SELECT CAST('00000000-0000-4000-9000-0000000000ff' AS UUID), 'Readora', 'readora 00000000-0000-4000-9000-0000000000ff',
       'Chapters published before teams existed.', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 0
WHERE EXISTS (SELECT 1 FROM chapters WHERE team_id IS NULL);
UPDATE chapters SET team_id = CAST('00000000-0000-4000-9000-0000000000ff' AS UUID) WHERE team_id IS NULL;

ALTER TABLE chapters ALTER COLUMN team_id SET NOT NULL;
ALTER TABLE chapters ADD CONSTRAINT fk_chapters_team FOREIGN KEY (team_id) REFERENCES teams (id);
CREATE INDEX idx_chapters_team_published ON chapters (team_id, status, published_at);
ALTER TABLE chapters DROP COLUMN scanlation_project_id;

ALTER TABLE page_reports ADD COLUMN team_id UUID;
UPDATE page_reports SET team_id = (SELECT c.team_id FROM chapters c WHERE c.id = page_reports.chapter_id);
ALTER TABLE page_reports ALTER COLUMN team_id SET NOT NULL;
ALTER TABLE page_reports ADD CONSTRAINT fk_page_reports_team FOREIGN KEY (team_id) REFERENCES teams (id);
DROP INDEX idx_page_reports_project_status;
ALTER TABLE page_reports DROP COLUMN project_id;
CREATE INDEX idx_page_reports_team_work_status ON page_reports (team_id, work_id, status, created_at);
