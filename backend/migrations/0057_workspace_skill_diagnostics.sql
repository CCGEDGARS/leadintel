ALTER TABLE workspace_skills ADD COLUMN retry_attempts INTEGER NOT NULL DEFAULT 0;
ALTER TABLE workspace_skills ADD COLUMN error_code TEXT NOT NULL DEFAULT '';
ALTER TABLE workspace_skills ADD COLUMN error_phase TEXT NOT NULL DEFAULT '';
