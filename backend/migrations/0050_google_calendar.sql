-- Personal read-only calendar connections, separate from Gmail.
CREATE TABLE IF NOT EXISTS google_calendar_connections (
 workspace_id TEXT NOT NULL REFERENCES workspaces(id),
 user_id TEXT NOT NULL REFERENCES users(id),
 google_email TEXT NOT NULL,
 encrypted_refresh_token TEXT NOT NULL,
 scopes TEXT NOT NULL,
 connected_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
 PRIMARY KEY(workspace_id,user_id)
);
CREATE TABLE IF NOT EXISTS google_calendar_oauth_states (
 id_hash TEXT PRIMARY KEY,
 workspace_id TEXT NOT NULL REFERENCES workspaces(id),
 user_id TEXT NOT NULL REFERENCES users(id),
 return_to TEXT NOT NULL,
 expires_at TEXT NOT NULL,
 consumed_at TEXT
);
