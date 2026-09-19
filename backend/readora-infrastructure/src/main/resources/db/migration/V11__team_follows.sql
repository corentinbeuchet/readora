-- US-08 / US-12: readers follow scanlation teams; followed teams feed their "My library" updates.
CREATE TABLE team_follows (
    user_id     VARCHAR(100) NOT NULL,
    project_id  UUID         NOT NULL REFERENCES scanlation_projects (id) ON DELETE CASCADE,
    followed_at TIMESTAMP WITH TIME ZONE NOT NULL,
    PRIMARY KEY (user_id, project_id)
);
CREATE INDEX idx_team_follows_project ON team_follows (project_id);
CREATE INDEX idx_chapters_published_at ON chapters (status, published_at);
