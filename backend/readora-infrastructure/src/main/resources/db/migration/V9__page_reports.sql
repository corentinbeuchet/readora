-- US-06: readers report broken pages, the chapter's scanlation team marks them fixed.
CREATE TABLE page_reports (
    id             UUID PRIMARY KEY,
    chapter_id     UUID         NOT NULL REFERENCES chapters (id) ON DELETE CASCADE,
    work_id        UUID         NOT NULL REFERENCES works (id) ON DELETE CASCADE,
    project_id     UUID         REFERENCES scanlation_projects (id) ON DELETE SET NULL,
    chapter_number VARCHAR(50)  NOT NULL,
    page_number    INT          NOT NULL,
    reason         VARCHAR(30)  NOT NULL,
    reporter_id    VARCHAR(100) NOT NULL,
    status         VARCHAR(20)  NOT NULL,
    created_at     TIMESTAMP WITH TIME ZONE NOT NULL,
    resolved_at    TIMESTAMP WITH TIME ZONE,
    resolved_by    VARCHAR(100),
    version        BIGINT       NOT NULL DEFAULT 0
);
CREATE INDEX idx_page_reports_project_status ON page_reports (project_id, status, created_at);
CREATE INDEX idx_page_reports_reporter_page ON page_reports (reporter_id, chapter_id, page_number, status);
