CREATE TABLE book_processing_locks (
 workspace_id TEXT PRIMARY KEY REFERENCES workspaces(id), owner_id TEXT NOT NULL, lease_until INTEGER NOT NULL
);
ALTER TABLE writing_reference_jobs ADD COLUMN started_at INTEGER NOT NULL DEFAULT 0;
ALTER TABLE writing_reference_jobs ADD COLUMN last_progress_at INTEGER NOT NULL DEFAULT 0;
ALTER TABLE writing_reference_jobs ADD COLUMN progress_baseline INTEGER NOT NULL DEFAULT 0;
ALTER TABLE writing_reference_jobs ADD COLUMN total INTEGER NOT NULL DEFAULT 0;
ALTER TABLE writing_reference_jobs ADD COLUMN retry_attempts INTEGER NOT NULL DEFAULT 0;
