ALTER TABLE workspace_skills ADD COLUMN started_at INTEGER NOT NULL DEFAULT 0;
ALTER TABLE workspace_skills ADD COLUMN last_progress_at INTEGER NOT NULL DEFAULT 0;
ALTER TABLE workspace_skills ADD COLUMN progress_baseline INTEGER NOT NULL DEFAULT 0;
ALTER TABLE workspace_skills ADD COLUMN prepared_count INTEGER NOT NULL DEFAULT 0;

CREATE TABLE workspace_skill_attempts (
 skill_id TEXT NOT NULL REFERENCES workspace_skills(id),chunk_index INTEGER NOT NULL,part_index INTEGER NOT NULL,
 attempts INTEGER NOT NULL DEFAULT 0,PRIMARY KEY(skill_id,chunk_index,part_index)
);

ALTER TABLE workspace_skill_objects ADD COLUMN pending_until INTEGER NOT NULL DEFAULT 0;
ALTER TABLE workspace_skill_objects ADD COLUMN cleanup_version INTEGER NOT NULL DEFAULT 0;
