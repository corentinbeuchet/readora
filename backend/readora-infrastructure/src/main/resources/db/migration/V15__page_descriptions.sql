-- US-07: what each page shows, written by the uploader and read out by screen readers.
ALTER TABLE page_assets ADD COLUMN description VARCHAR(500);
