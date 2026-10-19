CREATE TABLE IF NOT EXISTS additional_contact_policies (
  workspace_id TEXT PRIMARY KEY,
  enabled INTEGER NOT NULL DEFAULT 0 CHECK(enabled IN (0,1)),
  daily_limit INTEGER NOT NULL DEFAULT 3 CHECK(daily_limit BETWEEN 1 AND 50),
  monthly_limit INTEGER NOT NULL DEFAULT 30 CHECK(monthly_limit BETWEEN 1 AND 1000),
  max_per_company INTEGER NOT NULL DEFAULT 2 CHECK(max_per_company BETWEEN 1 AND 2),
  approved_by TEXT,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS additional_contact_attempts (
  workspace_id TEXT NOT NULL,
  company_id TEXT NOT NULL,
  person_id TEXT NOT NULL,
  month TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'processing',
  result_json TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY(workspace_id,company_id,person_id,month)
);
CREATE INDEX IF NOT EXISTS additional_contact_attempt_budget ON additional_contact_attempts(workspace_id,created_at);
