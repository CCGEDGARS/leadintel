PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS market_monitoring_configs (
  workspace_id TEXT PRIMARY KEY REFERENCES workspaces(id) ON DELETE CASCADE,
  enabled INTEGER NOT NULL DEFAULT 0 CHECK (enabled IN (0,1)),
  frequency TEXT NOT NULL CHECK (frequency IN ('daily','weekly','monthly')),
  research_depth TEXT NOT NULL CHECK (research_depth IN ('quick','deep')),
  minimum_score INTEGER NOT NULL DEFAULT 70 CHECK (minimum_score BETWEEN 1 AND 100),
  source_types_json TEXT NOT NULL DEFAULT '[]' CHECK (json_valid(source_types_json)),
  signal_ids_json TEXT NOT NULL DEFAULT '[]' CHECK (json_valid(signal_ids_json)),
  custom_sources_json TEXT NOT NULL DEFAULT '[]' CHECK (json_valid(custom_sources_json)),
  notification_channels_json TEXT NOT NULL DEFAULT '["in_app"]' CHECK (json_valid(notification_channels_json)),
  next_run_at TEXT,
  last_run_at TEXT,
  created_by TEXT REFERENCES users(id),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS market_monitoring_runs (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  trigger_type TEXT NOT NULL CHECK (trigger_type IN ('manual','scheduled')),
  research_depth TEXT NOT NULL CHECK (research_depth IN ('quick','deep')),
  status TEXT NOT NULL CHECK (status IN ('running','completed','partial','failed')),
  query_count INTEGER NOT NULL DEFAULT 0,
  source_count INTEGER NOT NULL DEFAULT 0,
  alert_count INTEGER NOT NULL DEFAULT 0,
  snapshot_json TEXT NOT NULL DEFAULT '{}' CHECK (json_valid(snapshot_json)),
  error_message TEXT,
  started_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  completed_at TEXT
);
CREATE INDEX IF NOT EXISTS market_monitoring_runs_workspace_idx ON market_monitoring_runs(workspace_id,started_at DESC);

CREATE TABLE IF NOT EXISTS market_monitoring_evidence (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  run_id TEXT NOT NULL REFERENCES market_monitoring_runs(id) ON DELETE CASCADE,
  fingerprint TEXT NOT NULL,
  source_url TEXT NOT NULL,
  source_type TEXT NOT NULL,
  title TEXT NOT NULL DEFAULT '',
  excerpt TEXT NOT NULL DEFAULT '',
  published_at TEXT,
  score INTEGER NOT NULL DEFAULT 0 CHECK (score BETWEEN 0 AND 100),
  signal_ids_json TEXT NOT NULL DEFAULT '[]' CHECK (json_valid(signal_ids_json)),
  first_seen_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  last_seen_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(workspace_id,fingerprint)
);

CREATE TABLE IF NOT EXISTS market_monitoring_alerts (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  evidence_id TEXT NOT NULL REFERENCES market_monitoring_evidence(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'new' CHECK (status IN ('new','read','dismissed')),
  score INTEGER NOT NULL CHECK (score BETWEEN 0 AND 100),
  title TEXT NOT NULL,
  summary TEXT NOT NULL DEFAULT '',
  source_url TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(workspace_id,evidence_id)
);
CREATE INDEX IF NOT EXISTS market_monitoring_alerts_workspace_idx ON market_monitoring_alerts(workspace_id,status,created_at DESC);
