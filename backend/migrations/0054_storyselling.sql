CREATE TABLE story_bank (
 workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
 id TEXT NOT NULL,
 payload_json TEXT NOT NULL,
 revision INTEGER NOT NULL DEFAULT 1,
 updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
 PRIMARY KEY(workspace_id,id)
);
CREATE TABLE story_usage (
 workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
 recipient_key TEXT NOT NULL,
 story_id TEXT NOT NULL,
 story_revision INTEGER NOT NULL,
 preview_token TEXT NOT NULL,
 created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
 PRIMARY KEY(workspace_id,recipient_key,story_id)
);
