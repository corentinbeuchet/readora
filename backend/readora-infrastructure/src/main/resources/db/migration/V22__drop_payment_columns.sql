-- ==============================================================================
-- Flyway Database Migration V22: drop what only the payment provider used
-- PostgreSQL 16+ (also runs on H2 in tests: the indexes have explicit names, so they are dropped by name)
-- ==============================================================================
-- Payments were removed on 2026-09-23. The provider ids, the webhook event ordering (V6) and "cancel at period end"
-- only served them; a payments feature adds its own columns back. Premium stays: plan, status, period end.

-- Statuses only the provider set: an overdue payment kept access until the period end, an unfinished checkout never
-- gave any.
UPDATE subscriptions SET status = 'ACTIVE' WHERE status = 'PAST_DUE';
UPDATE subscriptions SET status = 'CANCELED' WHERE status = 'INCOMPLETE';

DROP INDEX IF EXISTS idx_subscriptions_stripe_customer;
DROP INDEX IF EXISTS idx_subscriptions_stripe_subscription;

ALTER TABLE subscriptions DROP COLUMN stripe_customer_id;
ALTER TABLE subscriptions DROP COLUMN stripe_subscription_id;
ALTER TABLE subscriptions DROP COLUMN last_event_id;
ALTER TABLE subscriptions DROP COLUMN last_event_at;
ALTER TABLE subscriptions DROP COLUMN cancel_at_period_end;
