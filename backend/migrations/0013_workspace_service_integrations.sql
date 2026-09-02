PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS workspace_service_integrations (
  workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  provider TEXT NOT NULL CHECK (provider IN ('apollo','firecrawl')),
  encrypted_api_key TEXT NOT NULL,
  key_hint TEXT NOT NULL,
  metadata_json TEXT NOT NULL DEFAULT '{}',
  verified_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  last_used_at TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (workspace_id, provider)
);

CREATE INDEX IF NOT EXISTS workspace_service_integrations_workspace_idx
  ON workspace_service_integrations(workspace_id, updated_at DESC);
