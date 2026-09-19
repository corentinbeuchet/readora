-- US-11: moderators hide reported comments.
ALTER TABLE chapter_comments ADD COLUMN hidden BOOLEAN NOT NULL DEFAULT FALSE;
CREATE INDEX idx_comments_author_created ON chapter_comments (author_id, created_at);

CREATE TABLE comment_reports (
    id          UUID PRIMARY KEY,
    comment_id  UUID         NOT NULL REFERENCES chapter_comments (id) ON DELETE CASCADE,
    reporter_id VARCHAR(100) NOT NULL,
    reason      VARCHAR(30)  NOT NULL,
    status      VARCHAR(20)  NOT NULL,
    created_at  TIMESTAMP WITH TIME ZONE NOT NULL,
    closed_at   TIMESTAMP WITH TIME ZONE,
    closed_by   VARCHAR(100)
);
CREATE INDEX idx_comment_reports_status_created ON comment_reports (status, created_at);
CREATE INDEX idx_comment_reports_comment ON comment_reports (comment_id, status);
