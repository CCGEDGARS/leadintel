PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS companies (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  canonical_name TEXT NOT NULL,
  normalized_name TEXT NOT NULL,
  domain TEXT,
  website_url TEXT,
  industry TEXT,
  location TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(workspace_id,normalized_name)
);
CREATE INDEX IF NOT EXISTS companies_workspace_name_idx ON companies(workspace_id,normalized_name);

CREATE TABLE IF NOT EXISTS contacts (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  company_id TEXT NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  full_name TEXT NOT NULL,
  normalized_name TEXT NOT NULL,
  role TEXT,
  business_email TEXT COLLATE NOCASE,
  email_status TEXT NOT NULL DEFAULT 'Not found',
  verification_provider TEXT,
  verified_at TEXT,
  linkedin_url TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(workspace_id,business_email)
);
CREATE INDEX IF NOT EXISTS contacts_company_idx ON contacts(company_id,email_status);

CREATE TABLE IF NOT EXISTS signals (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  company_id TEXT NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  fingerprint TEXT NOT NULL,
  signal_type TEXT NOT NULL,
  summary TEXT NOT NULL,
  captured_at TEXT,
  source_title TEXT,
  source_url TEXT,
  confidence TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(workspace_id,fingerprint)
);
CREATE INDEX IF NOT EXISTS signals_company_captured_idx ON signals(company_id,captured_at DESC);

CREATE TABLE IF NOT EXISTS evidence_items (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  company_id TEXT NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  signal_id TEXT REFERENCES signals(id) ON DELETE CASCADE,
  fingerprint TEXT NOT NULL,
  claim_text TEXT NOT NULL,
  source_title TEXT,
  source_url TEXT,
  observed_at TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(workspace_id,fingerprint)
);
CREATE INDEX IF NOT EXISTS evidence_signal_idx ON evidence_items(signal_id);

CREATE TABLE IF NOT EXISTS opportunities (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  company_id TEXT NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'New',
  score_100 REAL NOT NULL DEFAULT 0,
  score_10 REAL NOT NULL DEFAULT 0,
  confidence TEXT,
  recommended_offer TEXT,
  commercial_reason TEXT,
  decision_maker_role TEXT,
  urgency TEXT,
  payload_json TEXT NOT NULL DEFAULT '{}' CHECK (json_valid(payload_json)),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(workspace_id,company_id)
);
CREATE INDEX IF NOT EXISTS opportunities_workspace_score_idx ON opportunities(workspace_id,score_10 DESC);

CREATE TABLE IF NOT EXISTS opportunity_signals (
  opportunity_id TEXT NOT NULL REFERENCES opportunities(id) ON DELETE CASCADE,
  signal_id TEXT NOT NULL REFERENCES signals(id) ON DELETE CASCADE,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY(opportunity_id,signal_id)
);
