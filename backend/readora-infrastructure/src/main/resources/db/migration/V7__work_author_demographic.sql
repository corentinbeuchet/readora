-- US-04 catalog discovery: search by author, filter by target audience.
-- Sizes match Work.MAX_AUTHOR_LENGTH / CreateWorkRequest and the Demographic enum.
ALTER TABLE works ADD COLUMN author VARCHAR(120);
ALTER TABLE works ADD COLUMN demographic VARCHAR(20);
CREATE INDEX idx_works_demographic ON works (demographic);
