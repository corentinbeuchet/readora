-- US-07 data saver: a lighter JPEG copy of each page, made at upload. NULL for older pages (the reader falls back).
ALTER TABLE page_assets ADD COLUMN lite_cdn_url VARCHAR(1024);
