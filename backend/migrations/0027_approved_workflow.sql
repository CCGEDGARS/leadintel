PRAGMA foreign_keys = ON;
CREATE TABLE approved_workflows (
  workspace_id TEXT PRIMARY KEY REFERENCES workspaces(id) ON DELETE CASCADE,
  revision INTEGER NOT NULL DEFAULT 1,
  status TEXT NOT NULL DEFAULT 'manual' CHECK(status IN ('manual','automatic','paused','stopped','needs_review')),
  config_json TEXT NOT NULL DEFAULT '{}' CHECK(json_valid(config_json)),
  approvals_json TEXT NOT NULL DEFAULT '{}' CHECK(json_valid(approvals_json)),
  context_hash TEXT NOT NULL DEFAULT '',
  approved_by TEXT REFERENCES users(id) ON DELETE SET NULL,
  approved_at TEXT,
  next_run_at TEXT,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE approved_workflow_runs (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  revision INTEGER NOT NULL,
  status TEXT NOT NULL CHECK(status IN ('running','completed','blocked','stopped')),
  stage_index INTEGER NOT NULL DEFAULT 0,
  result_json TEXT NOT NULL DEFAULT '{}' CHECK(json_valid(result_json)),
  error_message TEXT,
  lease_token TEXT,
  lease_until TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX approved_workflow_runs_workspace ON approved_workflow_runs(workspace_id,created_at DESC);
CREATE UNIQUE INDEX approved_workflow_single_run ON approved_workflow_runs(workspace_id) WHERE status='running';
ALTER TABLE outreach_automation_sequences ADD COLUMN workflow_run_id TEXT REFERENCES approved_workflow_runs(id);
ALTER TABLE outreach_automation_sequences ADD COLUMN workflow_revision INTEGER;
