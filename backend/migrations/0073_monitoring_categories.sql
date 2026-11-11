-- Additive: the original workspace monitor keeps its IDs and API contract.
CREATE TABLE monitoring_categories (
 id TEXT PRIMARY KEY, workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
 name TEXT NOT NULL, description TEXT NOT NULL DEFAULT '', purpose TEXT NOT NULL,
 criteria_json TEXT NOT NULL CHECK(json_valid(criteria_json)), definition_hash TEXT NOT NULL,
 revision INTEGER NOT NULL DEFAULT 1, archived INTEGER NOT NULL DEFAULT 0 CHECK(archived IN (0,1)),
 created_by TEXT NOT NULL REFERENCES users(id), created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
 UNIQUE(workspace_id,id)
);
CREATE TABLE monitoring_monitors (
 id TEXT PRIMARY KEY, workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE, name TEXT NOT NULL,
 category_id TEXT, category_hash TEXT NOT NULL DEFAULT '', archived INTEGER NOT NULL DEFAULT 0 CHECK(archived IN (0,1)),
 enabled INTEGER NOT NULL DEFAULT 0 CHECK(enabled IN (0,1)), frequency TEXT NOT NULL CHECK(frequency IN ('daily','weekly','monthly')),
 research_depth TEXT NOT NULL CHECK(research_depth IN ('quick','deep')), minimum_score INTEGER NOT NULL CHECK(minimum_score BETWEEN 1 AND 100),
 source_types_json TEXT NOT NULL DEFAULT '[]' CHECK(json_valid(source_types_json)), signal_ids_json TEXT NOT NULL DEFAULT '[]' CHECK(json_valid(signal_ids_json)),
 custom_sources_json TEXT NOT NULL DEFAULT '[]' CHECK(json_valid(custom_sources_json)), workflow_json TEXT NOT NULL DEFAULT '{}' CHECK(json_valid(workflow_json)),
 revision INTEGER NOT NULL DEFAULT 1, strategy_signature TEXT NOT NULL DEFAULT '', preview_id TEXT,
 lease_id TEXT, lease_expires_at TEXT, next_run_at TEXT, last_run_at TEXT,
 created_by TEXT NOT NULL REFERENCES users(id), created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
 FOREIGN KEY(workspace_id,category_id) REFERENCES monitoring_categories(workspace_id,id), UNIQUE(workspace_id,id)
);
CREATE INDEX monitoring_monitors_due ON monitoring_monitors(enabled,archived,next_run_at);
CREATE TABLE monitoring_previews (
 id TEXT PRIMARY KEY, workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE, user_id TEXT NOT NULL REFERENCES users(id),
 monitor_id TEXT NOT NULL, monitor_revision INTEGER NOT NULL, strategy_signature TEXT NOT NULL, research_hash TEXT NOT NULL, source_url TEXT NOT NULL, result_json TEXT NOT NULL CHECK(json_valid(result_json)),
 can_activate INTEGER NOT NULL DEFAULT 0, expires_at TEXT NOT NULL, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
 UNIQUE(workspace_id,id)
);
ALTER TABLE market_monitoring_runs ADD COLUMN monitor_id TEXT NOT NULL DEFAULT 'legacy';
ALTER TABLE market_monitoring_evidence ADD COLUMN monitor_id TEXT NOT NULL DEFAULT 'legacy';
ALTER TABLE monitoring_findings ADD COLUMN monitor_id TEXT NOT NULL DEFAULT 'legacy';
ALTER TABLE monitoring_messages ADD COLUMN monitor_id TEXT NOT NULL DEFAULT 'legacy';
CREATE INDEX monitoring_runs_owner ON market_monitoring_runs(workspace_id,monitor_id,started_at DESC);
CREATE INDEX monitoring_findings_owner ON monitoring_findings(workspace_id,monitor_id,status,updated_at DESC);
CREATE INDEX monitoring_messages_owner ON monitoring_messages(workspace_id,monitor_id,status,sent_at);
