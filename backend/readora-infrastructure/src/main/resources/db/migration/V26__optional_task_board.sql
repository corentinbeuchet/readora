-- ==============================================================================
-- Flyway Database Migration V26: the task board is optional per series
-- PostgreSQL 16+
-- ==============================================================================
-- Most teams only publish finished chapters, so a series a team adds starts without a task board (the app saves
-- FALSE) and a leader turns it on. Boards that exist today keep working: they are on.

ALTER TABLE scanlation_projects ADD COLUMN board_enabled BOOLEAN NOT NULL DEFAULT TRUE;
