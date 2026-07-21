CREATE TABLE IF NOT EXISTS run_policies (
  workspace_id TEXT PRIMARY KEY REFERENCES workspaces(id) ON DELETE CASCADE,
  daily_run_limit INTEGER NOT NULL DEFAULT 3 CHECK (daily_run_limit BETWEEN 1 AND 24),
  monthly_candidate_limit INTEGER NOT NULL DEFAULT 90 CHECK (monthly_candidate_limit BETWEEN 1 AND 5000),
  per_run_candidate_limit INTEGER NOT NULL DEFAULT 3 CHECK (per_run_candidate_limit BETWEEN 1 AND 25),
  cooldown_seconds INTEGER NOT NULL DEFAULT 300 CHECK (cooldown_seconds BETWEEN 0 AND 86400),
  dispatch_timeout_ms INTEGER NOT NULL DEFAULT 12000 CHECK (dispatch_timeout_ms BETWEEN 3000 AND 30000),
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS research_runs (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  idempotency_key TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('dispatching','accepted','running','completed','failed','timed_out','cancelled')),
  test INTEGER NOT NULL DEFAULT 0 CHECK (test IN (0,1)),
  candidate_budget INTEGER NOT NULL DEFAULT 0,
  candidates_used INTEGER NOT NULL DEFAULT 0,
  attempts INTEGER NOT NULL DEFAULT 0,
  request_json TEXT NOT NULL DEFAULT '{}' CHECK (json_valid(request_json)),
  response_json TEXT NOT NULL DEFAULT '{}' CHECK (json_valid(response_json)),
  error_code TEXT,
  error_message TEXT,
  requested_by TEXT REFERENCES users(id),
  accepted_at TEXT,
  completed_at TEXT,
  deadline_at TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(workspace_id,idempotency_key)
);
CREATE INDEX IF NOT EXISTS research_runs_workspace_created_idx ON research_runs(workspace_id,created_at DESC);
CREATE INDEX IF NOT EXISTS research_runs_workspace_status_idx ON research_runs(workspace_id,status,created_at DESC);

CREATE TABLE IF NOT EXISTS run_events (
  id TEXT PRIMARY KEY,
  run_id TEXT NOT NULL REFERENCES research_runs(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL,
  details_json TEXT NOT NULL DEFAULT '{}' CHECK (json_valid(details_json)),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS run_events_run_created_idx ON run_events(run_id,created_at);

INSERT OR IGNORE INTO run_policies(workspace_id) VALUES ('edgars-latvia');
