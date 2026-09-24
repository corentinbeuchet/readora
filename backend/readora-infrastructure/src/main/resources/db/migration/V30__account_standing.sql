-- US-16: an admin suspends (until a date) or bans an account; ACTIVE for every account so far.
ALTER TABLE users ADD COLUMN standing VARCHAR(20) DEFAULT 'ACTIVE' NOT NULL;
ALTER TABLE users ADD COLUMN suspended_until TIMESTAMP WITH TIME ZONE;
