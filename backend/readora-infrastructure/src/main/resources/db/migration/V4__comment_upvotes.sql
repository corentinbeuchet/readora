-- ==============================================================================
-- Flyway Database Migration V4: one upvote per user per comment
-- PostgreSQL 16+
-- ==============================================================================

CREATE TABLE IF NOT EXISTS comment_upvotes (
    comment_id UUID NOT NULL REFERENCES chapter_comments (id) ON DELETE CASCADE,
    user_id VARCHAR(100) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    CONSTRAINT pk_comment_upvotes PRIMARY KEY (comment_id, user_id)
);
