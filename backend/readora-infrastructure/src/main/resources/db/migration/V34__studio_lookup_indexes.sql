-- The Studio finds "my teams" by member (team_members.user_id) on every visit, and a series' teams by work
-- (scanlation_projects.work_id); both were only covered as the second column of (team_id, ...) indexes.
CREATE INDEX idx_team_members_user ON team_members (user_id);
CREATE INDEX idx_scanlation_projects_work ON scanlation_projects (work_id);
