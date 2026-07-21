CREATE TABLE IF NOT EXISTS enrichment_policies (
  workspace_id TEXT PRIMARY KEY REFERENCES workspaces(id) ON DELETE CASCADE,
  provider TEXT NOT NULL DEFAULT 'apollo',
  minimum_score REAL NOT NULL DEFAULT 7 CHECK (minimum_score BETWEEN 1 AND 10),
  daily_credit_limit INTEGER NOT NULL DEFAULT 3 CHECK (daily_credit_limit BETWEEN 1 AND 25),
  monthly_credit_limit INTEGER NOT NULL DEFAULT 30 CHECK (monthly_credit_limit BETWEEN 1 AND 500),
  retry_after_days INTEGER NOT NULL DEFAULT 30 CHECK (retry_after_days BETWEEN 1 AND 365),
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS enrichment_requests (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  opportunity_id TEXT NOT NULL REFERENCES opportunities(id) ON DELETE CASCADE,
  company_id TEXT NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  provider TEXT NOT NULL DEFAULT 'apollo',
  status TEXT NOT NULL CHECK (status IN ('processing','verified','not_found','failed','cancelled')),
  role_requested TEXT,
  person_provider_id TEXT,
  contact_id TEXT REFERENCES contacts(id) ON DELETE SET NULL,
  credits_reserved INTEGER NOT NULL DEFAULT 1,
  credits_used INTEGER NOT NULL DEFAULT 0,
  error_code TEXT,
  error_message TEXT,
  requested_by TEXT REFERENCES users(id),
  response_summary_json TEXT NOT NULL DEFAULT '{}' CHECK (json_valid(response_summary_json)),
  completed_at TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS enrichment_requests_workspace_created_idx ON enrichment_requests(workspace_id,created_at DESC);
CREATE INDEX IF NOT EXISTS enrichment_requests_opportunity_created_idx ON enrichment_requests(opportunity_id,created_at DESC);

INSERT OR IGNORE INTO enrichment_policies(workspace_id) VALUES ('edgars-latvia');
