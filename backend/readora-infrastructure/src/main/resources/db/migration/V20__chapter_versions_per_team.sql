-- US-12: several teams may translate the same chapter. A chapter number exists once per team, no longer once per
-- series; readers' progress follows the number (chapter_reads.chapter_number), whichever version they read.
ALTER TABLE chapters DROP CONSTRAINT uq_chapter_work_number;
ALTER TABLE chapters ADD CONSTRAINT uq_chapter_work_number_team UNIQUE (work_id, chapter_number, team_id);

-- "N new" counts chapter numbers the reader has not finished in any version (one lookup per published chapter).
CREATE INDEX idx_chapter_reads_user_work_number ON chapter_reads (user_id, work_id, chapter_number);
