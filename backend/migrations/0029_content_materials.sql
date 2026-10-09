-- Reusable writing ingredients live outside the workspace JSON budget.
CREATE TABLE IF NOT EXISTS content_materials (
 id TEXT PRIMARY KEY,
 workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
 title TEXT NOT NULL,
 category TEXT NOT NULL,
 body TEXT NOT NULL,
 revision INTEGER NOT NULL DEFAULT 1,
 created_by TEXT NOT NULL,
 created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
 updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS content_materials_workspace ON content_materials(workspace_id, updated_at);
