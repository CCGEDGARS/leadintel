PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS oauth_states (
  id_hash TEXT PRIMARY KEY,
  purpose TEXT NOT NULL CHECK (purpose IN ('login','gmail')),
  user_id TEXT REFERENCES users(id) ON DELETE CASCADE,
  workspace_id TEXT REFERENCES workspaces(id) ON DELETE CASCADE,
  return_to TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  expires_at TEXT NOT NULL,
  consumed_at TEXT
);
CREATE INDEX IF NOT EXISTS oauth_states_expiry_idx ON oauth_states(expires_at);
CREATE INDEX IF NOT EXISTS oauth_states_workspace_idx ON oauth_states(workspace_id,purpose);

CREATE TABLE IF NOT EXISTS customer_workspace_state (
  workspace_id TEXT PRIMARY KEY REFERENCES workspaces(id) ON DELETE CASCADE,
  schema_version INTEGER NOT NULL DEFAULT 1,
  version INTEGER NOT NULL DEFAULT 1 CHECK (version >= 1),
  payload_json TEXT NOT NULL CHECK (json_valid(payload_json)),
  updated_by TEXT REFERENCES users(id) ON DELETE SET NULL,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS gmail_connections (
  workspace_id TEXT PRIMARY KEY REFERENCES workspaces(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  google_email TEXT NOT NULL COLLATE NOCASE,
  encrypted_refresh_token TEXT,
  scopes TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'connected' CHECK (status IN ('connected','disconnected','error')),
  history_id TEXT,
  connected_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  disconnected_at TEXT
);
CREATE INDEX IF NOT EXISTS gmail_connections_user_idx ON gmail_connections(user_id,status);

CREATE TABLE IF NOT EXISTS gmail_messages (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  idempotency_key TEXT NOT NULL,
  domain TEXT NOT NULL,
  recipient TEXT NOT NULL COLLATE NOCASE,
  subject TEXT NOT NULL,
  gmail_message_id TEXT,
  gmail_thread_id TEXT,
  sent_by TEXT REFERENCES users(id) ON DELETE SET NULL,
  sent_at TEXT,
  status TEXT NOT NULL DEFAULT 'sending' CHECK (status IN ('sending','sent','failed')),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (workspace_id, idempotency_key)
);
CREATE INDEX IF NOT EXISTS gmail_messages_workspace_thread_idx ON gmail_messages(workspace_id,gmail_thread_id,sent_at DESC);
CREATE INDEX IF NOT EXISTS gmail_messages_workspace_domain_idx ON gmail_messages(workspace_id,domain,sent_at DESC);

CREATE TABLE IF NOT EXISTS gmail_replies (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  domain TEXT NOT NULL,
  gmail_message_id TEXT NOT NULL,
  gmail_thread_id TEXT NOT NULL,
  sender_email TEXT NOT NULL COLLATE NOCASE,
  received_at TEXT NOT NULL,
  body_text TEXT NOT NULL,
  category TEXT NOT NULL CHECK (category IN ('meeting_request','positive','objection','not_now','referral','unsubscribe','out_of_office','neutral')),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (workspace_id, gmail_message_id)
);
CREATE INDEX IF NOT EXISTS gmail_replies_workspace_thread_idx ON gmail_replies(workspace_id,gmail_thread_id,received_at DESC);
CREATE INDEX IF NOT EXISTS gmail_replies_workspace_domain_idx ON gmail_replies(workspace_id,domain,received_at DESC);
