-- Series facts (US-04): what a series page says beside the synopsis. All optional.
-- Sizes match WorkFacts (domain), WorkJpaEntity and the request DTOs.
ALTER TABLE works ADD COLUMN artist VARCHAR(120);
ALTER TABLE works ADD COLUMN release_year INTEGER;
ALTER TABLE works ADD COLUMN original_language VARCHAR(20);
ALTER TABLE works ADD COLUMN content_rating VARCHAR(20);

ALTER TABLE works ADD CONSTRAINT ck_works_release_year CHECK (release_year IS NULL OR release_year BETWEEN 1900 AND 2100);

-- The titles a series is also known by, in the order its translators gave them (at most 10, enforced by the domain).
CREATE TABLE work_alt_titles (
    work_id     UUID         NOT NULL,
    title_order INTEGER      NOT NULL,
    title       VARCHAR(255) NOT NULL,
    CONSTRAINT pk_work_alt_titles PRIMARY KEY (work_id, title_order),
    CONSTRAINT fk_work_alt_titles_work FOREIGN KEY (work_id) REFERENCES works (id) ON DELETE CASCADE
);
