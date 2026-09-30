PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS outreach_contact_suppression (
  workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  email TEXT NOT NULL COLLATE NOCASE,
  reason TEXT NOT NULL CHECK (reason IN ('unsubscribe','manual','objection')),
  source TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY(workspace_id,email)
);
CREATE INDEX IF NOT EXISTS outreach_contact_suppression_workspace_idx ON outreach_contact_suppression(workspace_id,updated_at DESC);
