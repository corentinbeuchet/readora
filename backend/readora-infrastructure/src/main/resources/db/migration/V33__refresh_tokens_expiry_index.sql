-- RefreshTokenCleanupJob deletes expired tokens (`expires_at < threshold`); without an index that delete scans every
-- token ever issued and still stored.
CREATE INDEX idx_refresh_tokens_expires_at ON refresh_tokens (expires_at);
