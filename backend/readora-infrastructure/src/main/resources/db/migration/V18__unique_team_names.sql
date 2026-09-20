-- US-12: a team name is taken once, whatever its case. `name_key` holds the lower-cased name: a plain unique
-- constraint works on PostgreSQL and on the H2 used by tests (no expression index there).
ALTER TABLE teams ADD COLUMN name_key VARCHAR(300);
UPDATE teams SET name_key = LOWER(name);

-- Teams migrated from projects may share a name ("<title> Workspace" of two series with one title): those keep
-- their name and get a key made unique by their id.
UPDATE teams SET name_key = LOWER(name) || ' ' || CAST(id AS VARCHAR(36))
WHERE EXISTS (SELECT 1 FROM teams other WHERE LOWER(other.name) = LOWER(teams.name) AND other.id <> teams.id);

ALTER TABLE teams ALTER COLUMN name_key SET NOT NULL;
ALTER TABLE teams ADD CONSTRAINT uq_teams_name_key UNIQUE (name_key);
