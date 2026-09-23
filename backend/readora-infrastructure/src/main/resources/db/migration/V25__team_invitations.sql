-- ==============================================================================
-- Flyway Database Migration V25: team invitations
-- PostgreSQL 16+
-- ==============================================================================
-- US-12: a leader invites a reader with some roles; the reader joins the team only by accepting. roles is a
-- comma-separated list of ScanlationRole names, like users.roles.

CREATE TABLE team_invitations (
    id          UUID PRIMARY KEY,
    team_id     UUID         NOT NULL,
    invitee_id  VARCHAR(100) NOT NULL,
    roles       VARCHAR(200) NOT NULL,
    invited_by  VARCHAR(100) NOT NULL,
    status      VARCHAR(20)  NOT NULL,
    created_at  TIMESTAMP WITH TIME ZONE NOT NULL,
    answered_at TIMESTAMP WITH TIME ZONE,
    version     BIGINT       NOT NULL DEFAULT 0,
    CONSTRAINT fk_team_invitations_team FOREIGN KEY (team_id) REFERENCES teams (id) ON DELETE CASCADE
);
CREATE INDEX idx_team_invitations_team_status ON team_invitations (team_id, status, created_at);
CREATE INDEX idx_team_invitations_invitee_status ON team_invitations (invitee_id, status, created_at);
