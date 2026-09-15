PRAGMA foreign_keys = ON;

ALTER TABLE oauth_states ADD COLUMN pkce_verifier TEXT;

CREATE TABLE IF NOT EXISTS microsoft_mail_connections (
  workspace_id TEXT PRIMARY KEY REFERENCES workspaces(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  microsoft_email TEXT NOT NULL COLLATE NOCASE,
  encrypted_refresh_token TEXT,
  scopes TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'connected' CHECK (status IN ('connected','disconnected','error')),
  connected_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  disconnected_at TEXT
);
CREATE INDEX IF NOT EXISTS microsoft_mail_connections_user_idx ON microsoft_mail_connections(user_id,status);

CREATE TABLE IF NOT EXISTS microsoft_mail_messages (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  customer_project_id TEXT REFERENCES customer_projects(id) ON DELETE SET NULL,
  idempotency_key TEXT NOT NULL,
  domain TEXT NOT NULL,
  recipient TEXT NOT NULL COLLATE NOCASE,
  subject TEXT NOT NULL,
  sent_by TEXT REFERENCES users(id) ON DELETE SET NULL,
  sent_at TEXT,
  status TEXT NOT NULL DEFAULT 'sending' CHECK (status IN ('sending','sent','failed')),
  provider_status TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (workspace_id,idempotency_key)
);
CREATE INDEX IF NOT EXISTS microsoft_mail_messages_workspace_sent_idx ON microsoft_mail_messages(workspace_id,sent_at DESC);
CREATE INDEX IF NOT EXISTS microsoft_mail_messages_workspace_domain_idx ON microsoft_mail_messages(workspace_id,domain,sent_at DESC);
