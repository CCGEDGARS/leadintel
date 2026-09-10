PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS intelligence_sources (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  canonical_url TEXT NOT NULL,
  host TEXT NOT NULL,
  source_type TEXT NOT NULL DEFAULT 'other',
  geography_json TEXT NOT NULL DEFAULT '[]' CHECK (json_valid(geography_json)),
  access_status TEXT NOT NULL DEFAULT 'not_tested' CHECK (access_status IN ('not_tested','full','partial','no_access')),
  anonymous_access_status TEXT NOT NULL DEFAULT 'not_tested' CHECK (anonymous_access_status IN ('not_tested','full','partial','no_access')),
  authenticated_access_status TEXT NOT NULL DEFAULT 'not_connected' CHECK (authenticated_access_status IN ('not_connected','not_tested','full','partial','no_access')),
  access_method TEXT NOT NULL DEFAULT '',
  auth_mode TEXT NOT NULL DEFAULT 'public' CHECK (auth_mode IN ('public','google','username_password','api_key','subscription','manual_only')),
  auth_required INTEGER NOT NULL DEFAULT 0 CHECK (auth_required IN (0,1)),
  extractable_fields_json TEXT NOT NULL DEFAULT '[]' CHECK (json_valid(extractable_fields_json)),
  coverage_json TEXT NOT NULL DEFAULT '{}' CHECK (json_valid(coverage_json)),
  reliability TEXT NOT NULL DEFAULT 'unknown' CHECK (reliability IN ('unknown','high','medium','low')),
  monitoring_enabled INTEGER NOT NULL DEFAULT 0 CHECK (monitoring_enabled IN (0,1)),
  mandatory INTEGER NOT NULL DEFAULT 0 CHECK (mandatory IN (0,1)),
  frequency TEXT NOT NULL DEFAULT 'daily' CHECK (frequency IN ('daily','weekly','monthly')),
  trigger_ids_json TEXT NOT NULL DEFAULT '[]' CHECK (json_valid(trigger_ids_json)),
  last_access_test_at TEXT,
  last_successful_extraction_at TEXT,
  last_status_change_at TEXT,
  consecutive_failures INTEGER NOT NULL DEFAULT 0,
  health_status TEXT NOT NULL DEFAULT 'unknown' CHECK (health_status IN ('unknown','healthy','degraded','failing')),
  last_error TEXT NOT NULL DEFAULT '',
  next_health_check_at TEXT,
  created_by TEXT REFERENCES users(id),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(workspace_id,canonical_url)
);
CREATE INDEX IF NOT EXISTS intelligence_sources_workspace_idx ON intelligence_sources(workspace_id,mandatory,monitoring_enabled,updated_at DESC);
CREATE INDEX IF NOT EXISTS intelligence_sources_health_idx ON intelligence_sources(monitoring_enabled,next_health_check_at);

CREATE TABLE IF NOT EXISTS intelligence_source_audits (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  source_id TEXT NOT NULL REFERENCES intelligence_sources(id) ON DELETE CASCADE,
  access_status TEXT NOT NULL CHECK (access_status IN ('full','partial','no_access')),
  provider TEXT NOT NULL,
  method TEXT NOT NULL,
  content_chars INTEGER NOT NULL DEFAULT 0,
  extractable_fields_json TEXT NOT NULL DEFAULT '[]' CHECK (json_valid(extractable_fields_json)),
  coverage_json TEXT NOT NULL DEFAULT '{}' CHECK (json_valid(coverage_json)),
  restriction_reason TEXT NOT NULL DEFAULT '',
  error_message TEXT NOT NULL DEFAULT '',
  attempted_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS intelligence_source_audits_source_idx ON intelligence_source_audits(source_id,attempted_at DESC);
