PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS workspace_calendly_integrations (
  workspace_id TEXT PRIMARY KEY REFERENCES workspaces(id) ON DELETE CASCADE,
  scheduling_url TEXT NOT NULL,
  encrypted_personal_access_token TEXT NOT NULL,
  token_hint TEXT NOT NULL,
  user_uri TEXT NOT NULL,
  organization_uri TEXT NOT NULL,
  webhook_subscription_uri TEXT NOT NULL,
  webhook_secret_hash TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'connected' CHECK (status IN ('connected','error')),
  verified_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  last_event_at TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS calendly_webhook_events (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL CHECK (event_type IN ('invitee.created','invitee.canceled')),
  invitee_uri TEXT NOT NULL,
  scheduled_event_uri TEXT,
  invitee_email TEXT NOT NULL COLLATE NOCASE,
  payload_json TEXT NOT NULL,
  received_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  processed_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS calendly_webhook_events_workspace_time_idx
  ON calendly_webhook_events(workspace_id, processed_at DESC);
