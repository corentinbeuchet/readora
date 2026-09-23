-- ==============================================================================
-- Flyway Database Migration V24: drop the SCANLATOR account role
-- PostgreSQL 16+
-- ==============================================================================
-- Team tools no longer depend on an account role: any reader can start a team, and what a member may do comes
-- from their roles in that team (team_roster_roles). users.roles is a comma-separated list; an account that was
-- only a scanlator becomes a reader.

UPDATE users SET roles = REPLACE(roles, ',SCANLATOR', '') WHERE roles LIKE '%,SCANLATOR%';
UPDATE users SET roles = REPLACE(roles, 'SCANLATOR,', '') WHERE roles LIKE 'SCANLATOR,%';
UPDATE users SET roles = 'READER' WHERE roles = 'SCANLATOR';
