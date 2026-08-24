PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS workspace_ai_integrations (
  workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  provider TEXT NOT NULL CHECK (provider IN ('openai','anthropic','gemini')),
  encrypted_api_key TEXT NOT NULL,
  key_hint TEXT NOT NULL,
  model TEXT NOT NULL,
  active INTEGER NOT NULL DEFAULT 0 CHECK (active IN (0,1)),
  verified_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  last_used_at TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (workspace_id, provider)
);

CREATE UNIQUE INDEX IF NOT EXISTS workspace_ai_integrations_one_active_idx
  ON workspace_ai_integrations(workspace_id)
  WHERE active=1;

CREATE INDEX IF NOT EXISTS workspace_ai_integrations_workspace_idx
  ON workspace_ai_integrations(workspace_id, updated_at DESC);
