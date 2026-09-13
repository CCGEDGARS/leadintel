PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS user_identities (
  id TEXT PRIMARY KEY,
  provider TEXT NOT NULL CHECK (provider IN ('google','microsoft')),
  provider_subject TEXT NOT NULL,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(provider, provider_subject),
  UNIQUE(provider, user_id)
);

CREATE TABLE IF NOT EXISTS customer_projects (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  website TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','archived')),
  created_by TEXT REFERENCES users(id) ON DELETE SET NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  archived_at TEXT
);
CREATE INDEX IF NOT EXISTS idx_customer_projects_workspace ON customer_projects(workspace_id,status,created_at);

CREATE TABLE IF NOT EXISTS customer_project_state (
  project_id TEXT PRIMARY KEY REFERENCES customer_projects(id) ON DELETE CASCADE,
  schema_version INTEGER NOT NULL DEFAULT 1,
  version INTEGER NOT NULL DEFAULT 1 CHECK (version >= 1),
  payload_json TEXT NOT NULL CHECK (json_valid(payload_json)),
  updated_by TEXT REFERENCES users(id) ON DELETE SET NULL,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

ALTER TABLE gmail_messages ADD COLUMN customer_project_id TEXT REFERENCES customer_projects(id) ON DELETE SET NULL;
ALTER TABLE gmail_replies ADD COLUMN customer_project_id TEXT REFERENCES customer_projects(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_gmail_messages_project_sent ON gmail_messages(customer_project_id,sent_at);
CREATE INDEX IF NOT EXISTS idx_gmail_replies_project_received ON gmail_replies(customer_project_id,received_at);

CREATE TABLE IF NOT EXISTS email_activity_events (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  customer_project_id TEXT REFERENCES customer_projects(id) ON DELETE SET NULL,
  user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
  kind TEXT NOT NULL,
  provider TEXT NOT NULL CHECK (provider IN ('gmail','microsoft')),
  provider_message_id TEXT,
  provider_thread_id TEXT,
  occurred_at TEXT NOT NULL,
  payload_json TEXT NOT NULL CHECK (json_valid(payload_json)),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_email_activity_workspace_time ON email_activity_events(workspace_id,occurred_at);
CREATE INDEX IF NOT EXISTS idx_email_activity_project_time ON email_activity_events(customer_project_id,occurred_at);
