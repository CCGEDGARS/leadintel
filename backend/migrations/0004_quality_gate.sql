CREATE TABLE IF NOT EXISTS quality_rejections (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  run_id TEXT,
  query_id TEXT,
  company_name TEXT,
  source_title TEXT,
  source_url TEXT,
  reasons_json TEXT NOT NULL DEFAULT '[]' CHECK (json_valid(reasons_json)),
  warnings_json TEXT NOT NULL DEFAULT '[]' CHECK (json_valid(warnings_json)),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS quality_rejections_workspace_created_idx ON quality_rejections(workspace_id,created_at DESC);

