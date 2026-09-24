-- US-15: a deleted account keeps its row (comments and reviews keep an author) under a placeholder name; this marks it.
ALTER TABLE users ADD COLUMN deleted_at TIMESTAMP WITH TIME ZONE;
