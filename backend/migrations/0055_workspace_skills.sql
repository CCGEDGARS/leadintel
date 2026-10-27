CREATE TABLE workspace_skills (
 id TEXT PRIMARY KEY, workspace_id TEXT NOT NULL REFERENCES workspaces(id),
 title TEXT NOT NULL, source_hash TEXT NOT NULL, source_id TEXT NOT NULL DEFAULT '',
 source_revision INTEGER NOT NULL DEFAULT 0, source_filename TEXT NOT NULL DEFAULT '',
 status TEXT NOT NULL DEFAULT 'Preparing', enabled INTEGER NOT NULL DEFAULT 1 CHECK(enabled IN (0,1)),
 revision INTEGER NOT NULL DEFAULT 1, input_key TEXT NOT NULL DEFAULT '', package_key TEXT NOT NULL DEFAULT '',
 coverage_json TEXT NOT NULL DEFAULT '{}', description TEXT NOT NULL DEFAULT '', routing_json TEXT NOT NULL DEFAULT '[]',
 completed INTEGER NOT NULL DEFAULT 0, total INTEGER NOT NULL DEFAULT 0, error TEXT NOT NULL DEFAULT '',
 lease_id TEXT NOT NULL DEFAULT '', lease_until INTEGER NOT NULL DEFAULT 0, next_at INTEGER NOT NULL DEFAULT 0,
 created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX workspace_skill_source ON workspace_skills(workspace_id,source_hash) WHERE status NOT IN ('Deleted','Deleting');
CREATE INDEX workspace_skill_scope ON workspace_skills(workspace_id,status,enabled);
CREATE TRIGGER workspace_skill_capacity BEFORE INSERT ON workspace_skills
 WHEN NEW.status NOT IN ('Deleted','Deleting') AND (SELECT count(*) FROM workspace_skills WHERE workspace_id=NEW.workspace_id AND status NOT IN ('Deleted','Deleting'))>=30
 BEGIN SELECT RAISE(ABORT,'Workspace skill limit is 30'); END;
CREATE TABLE workspace_skill_chunks (
 skill_id TEXT NOT NULL REFERENCES workspace_skills(id), chunk_index INTEGER NOT NULL,
 object_key TEXT NOT NULL, PRIMARY KEY(skill_id,chunk_index)
);
