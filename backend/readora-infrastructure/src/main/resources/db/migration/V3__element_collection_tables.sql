-- ==============================================================================
-- Flyway Database Migration V3: Element Collection Tables for Works and Teams
-- PostgreSQL 16+
-- ==============================================================================

CREATE TABLE IF NOT EXISTS work_genres (
    work_id UUID NOT NULL REFERENCES works (id) ON DELETE CASCADE,
    genre VARCHAR(255) NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_work_genres_work_id ON work_genres (work_id);

CREATE TABLE IF NOT EXISTS member_roles (
    member_id UUID NOT NULL REFERENCES team_members (id) ON DELETE CASCADE,
    role VARCHAR(50) NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_member_roles_member_id ON member_roles (member_id);
