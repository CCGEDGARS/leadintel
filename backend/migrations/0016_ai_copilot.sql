PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS copilot_conversations (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  created_by TEXT REFERENCES users(id) ON DELETE SET NULL,
  title TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS copilot_conversations_workspace_idx
  ON copilot_conversations(workspace_id,updated_at DESC);

CREATE TABLE IF NOT EXISTS copilot_messages (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  conversation_id TEXT NOT NULL REFERENCES copilot_conversations(id) ON DELETE CASCADE,
  user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
  role TEXT NOT NULL CHECK (role IN ('user','assistant')),
  content TEXT NOT NULL,
  metadata_json TEXT NOT NULL DEFAULT '{}' CHECK (json_valid(metadata_json)),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS copilot_messages_conversation_idx
  ON copilot_messages(workspace_id,conversation_id,created_at);

CREATE TABLE IF NOT EXISTS copilot_memories (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  kind TEXT NOT NULL CHECK (kind IN ('decision','preference','constraint')),
  fingerprint TEXT NOT NULL,
  value_json TEXT NOT NULL CHECK (json_valid(value_json)),
  created_by TEXT REFERENCES users(id) ON DELETE SET NULL,
  source_conversation_id TEXT REFERENCES copilot_conversations(id) ON DELETE SET NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  archived_at TEXT,
  UNIQUE(workspace_id,fingerprint)
);
CREATE INDEX IF NOT EXISTS copilot_memories_workspace_idx
  ON copilot_memories(workspace_id,archived_at,updated_at DESC);

CREATE TABLE IF NOT EXISTS copilot_diagnostics (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  category TEXT NOT NULL CHECK (category IN ('completeness','consistency','quality','evidence','readiness')),
  severity TEXT NOT NULL CHECK (severity IN ('info','improve','important')),
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open','resolved','dismissed')),
  fingerprint TEXT NOT NULL,
  title TEXT NOT NULL,
  summary TEXT NOT NULL DEFAULT '',
  details_json TEXT NOT NULL DEFAULT '{}' CHECK (json_valid(details_json)),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  resolved_at TEXT,
  UNIQUE(workspace_id,fingerprint)
);
CREATE INDEX IF NOT EXISTS copilot_diagnostics_open_idx
  ON copilot_diagnostics(workspace_id,status,severity,updated_at DESC);

CREATE TABLE IF NOT EXISTS copilot_action_proposals (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  conversation_id TEXT REFERENCES copilot_conversations(id) ON DELETE SET NULL,
  proposed_by TEXT REFERENCES users(id) ON DELETE SET NULL,
  confirmed_by TEXT REFERENCES users(id) ON DELETE SET NULL,
  action_type TEXT NOT NULL CHECK (action_type IN ('signal.add','signal.update','icp.update_field')),
  status TEXT NOT NULL DEFAULT 'proposed' CHECK (status IN ('proposed','confirmed','applied','rejected','expired','failed')),
  payload_json TEXT NOT NULL CHECK (json_valid(payload_json)),
  preview_json TEXT NOT NULL CHECK (json_valid(preview_json)),
  result_json TEXT NOT NULL DEFAULT '{}' CHECK (json_valid(result_json)),
  idempotency_key TEXT NOT NULL,
  expected_state_version INTEGER NOT NULL DEFAULT 0 CHECK (expected_state_version >= 0),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  confirmed_at TEXT,
  applied_at TEXT,
  expires_at TEXT,
  error_code TEXT,
  error_message TEXT,
  UNIQUE(workspace_id,idempotency_key)
);
CREATE INDEX IF NOT EXISTS copilot_action_proposals_status_idx
  ON copilot_action_proposals(workspace_id,status,created_at DESC);
