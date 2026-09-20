-- US-12: a team is its own thing (one roster, several series) instead of being a scanlation project.
-- Every existing project becomes a team WITH THE SAME ID, so /teams/{id} links, team_follows rows and
-- chapters.scanlation_project_id keep pointing at the right team. Teams and projects created later get unrelated ids.
CREATE TABLE teams (
    id          UUID PRIMARY KEY,
    name        VARCHAR(255)  NOT NULL,
    description VARCHAR(1000),
    created_at  TIMESTAMP WITH TIME ZONE NOT NULL,
    updated_at  TIMESTAMP WITH TIME ZONE NOT NULL,
    version     BIGINT        NOT NULL DEFAULT 0
);

INSERT INTO teams (id, name, description, created_at, updated_at, version)
SELECT id, name, NULL, created_at, updated_at, 0 FROM scanlation_projects;

ALTER TABLE scanlation_projects ADD COLUMN team_id UUID;
UPDATE scanlation_projects SET team_id = id;
ALTER TABLE scanlation_projects ALTER COLUMN team_id SET NOT NULL;
ALTER TABLE scanlation_projects ADD CONSTRAINT fk_scanlation_projects_team FOREIGN KEY (team_id) REFERENCES teams (id);
ALTER TABLE scanlation_projects ADD CONSTRAINT uq_project_team_work UNIQUE (team_id, work_id);

-- The roster moves from the project to the team. The old foreign keys are unnamed (their generated names differ
-- between PostgreSQL and the H2 used by tests), so the tables are rebuilt rather than altered.
CREATE TABLE team_roster (
    id        UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    team_id   UUID         NOT NULL,
    user_id   VARCHAR(100) NOT NULL,
    joined_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    CONSTRAINT fk_team_members_team FOREIGN KEY (team_id) REFERENCES teams (id) ON DELETE CASCADE,
    CONSTRAINT uq_team_user UNIQUE (team_id, user_id)
);
INSERT INTO team_roster (id, team_id, user_id, joined_at)
SELECT id, project_id, user_id, joined_at FROM team_members;

CREATE TABLE team_roster_roles (
    member_id UUID        NOT NULL,
    role      VARCHAR(50) NOT NULL,
    CONSTRAINT fk_member_roles_member FOREIGN KEY (member_id) REFERENCES team_roster (id) ON DELETE CASCADE
);
INSERT INTO team_roster_roles (member_id, role)
SELECT member_id, role FROM member_roles;

DROP TABLE member_roles;
DROP TABLE team_members;
ALTER TABLE team_roster RENAME TO team_members;
ALTER TABLE team_roster_roles RENAME TO member_roles;
CREATE INDEX idx_member_roles_member ON member_roles (member_id);

CREATE TABLE team_followers (
    user_id     VARCHAR(100) NOT NULL,
    team_id     UUID         NOT NULL,
    followed_at TIMESTAMP WITH TIME ZONE NOT NULL,
    PRIMARY KEY (user_id, team_id),
    CONSTRAINT fk_team_follows_team FOREIGN KEY (team_id) REFERENCES teams (id) ON DELETE CASCADE
);
INSERT INTO team_followers (user_id, team_id, followed_at)
SELECT user_id, project_id, followed_at FROM team_follows;

DROP TABLE team_follows;
ALTER TABLE team_followers RENAME TO team_follows;
CREATE INDEX idx_team_follows_team ON team_follows (team_id);
