ALTER TABLE enrichment_requests ADD COLUMN personal_email_requested INTEGER NOT NULL DEFAULT 0;

UPDATE enrichment_requests SET personal_email_requested=0 WHERE personal_email_requested IS NULL;
