-- ==============================================================================
-- Flyway Database Migration V5: optimistic-locking version columns on aggregate roots
-- PostgreSQL 16+
-- ==============================================================================

ALTER TABLE works ADD COLUMN IF NOT EXISTS version BIGINT NOT NULL DEFAULT 0;
ALTER TABLE chapters ADD COLUMN IF NOT EXISTS version BIGINT NOT NULL DEFAULT 0;
ALTER TABLE scanlation_projects ADD COLUMN IF NOT EXISTS version BIGINT NOT NULL DEFAULT 0;
ALTER TABLE users ADD COLUMN IF NOT EXISTS version BIGINT NOT NULL DEFAULT 0;
