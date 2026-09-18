-- ==============================================================================
-- Flyway Database Migration V6: payment event ordering and cancel-at-period-end
-- PostgreSQL 16+
-- ==============================================================================

ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS last_event_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS cancel_at_period_end BOOLEAN NOT NULL DEFAULT FALSE;
