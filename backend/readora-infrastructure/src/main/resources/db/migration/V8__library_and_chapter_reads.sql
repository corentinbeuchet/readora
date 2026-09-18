-- US-05 personal library and US-07 reading history / read markers / new-chapter badges.
CREATE TABLE library_entries (
    user_id    VARCHAR(100) NOT NULL,
    work_id    UUID         NOT NULL REFERENCES works (id) ON DELETE CASCADE,
    status     VARCHAR(20)  NOT NULL,
    added_at   TIMESTAMP WITH TIME ZONE NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL,
    PRIMARY KEY (user_id, work_id)
);
CREATE INDEX idx_library_entries_user_updated ON library_entries (user_id, updated_at);

CREATE TABLE chapter_reads (
    user_id        VARCHAR(100) NOT NULL,
    chapter_id     UUID         NOT NULL REFERENCES chapters (id) ON DELETE CASCADE,
    work_id        UUID         NOT NULL REFERENCES works (id) ON DELETE CASCADE,
    chapter_number VARCHAR(50)  NOT NULL,
    read_at        TIMESTAMP WITH TIME ZONE NOT NULL,
    finished       BOOLEAN      NOT NULL,
    PRIMARY KEY (user_id, chapter_id)
);
CREATE INDEX idx_chapter_reads_user_work ON chapter_reads (user_id, work_id, read_at);
