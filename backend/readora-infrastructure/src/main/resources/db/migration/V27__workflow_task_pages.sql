-- ==============================================================================
-- Flyway Database Migration V27: real pages on the task board
-- PostgreSQL 16+
-- ==============================================================================
-- A task carried a typed "asset package" URL and a page count, and publishing from QC made page keys up from the
-- chapter number (backlog B19). Each stage now uploads its pages: the task keeps the latest ones, and QC publishes
-- them. An old package URL cannot become pages, so it is dropped.

CREATE TABLE workflow_task_pages (
    id           UUID         DEFAULT gen_random_uuid() PRIMARY KEY,
    task_id      UUID         NOT NULL,
    page_number  INT          NOT NULL,
    storage_key  VARCHAR(1024) NOT NULL,
    cdn_url      VARCHAR(1024),
    lite_cdn_url VARCHAR(1024),
    width        INT          NOT NULL DEFAULT 0,
    height       INT          NOT NULL DEFAULT 0,
    description  VARCHAR(500),
    CONSTRAINT fk_workflow_task_pages_task FOREIGN KEY (task_id) REFERENCES workflow_tasks (id) ON DELETE CASCADE,
    CONSTRAINT uq_workflow_task_page_number UNIQUE (task_id, page_number)
);

ALTER TABLE workflow_tasks DROP COLUMN asset_package_url;
ALTER TABLE workflow_tasks DROP COLUMN page_count;
