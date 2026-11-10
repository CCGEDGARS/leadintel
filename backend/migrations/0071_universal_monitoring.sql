-- Opt-in workflows. Existing schedules retain signal alerts and never acquire delivery permission.
ALTER TABLE market_monitoring_configs ADD COLUMN workflow_json TEXT NOT NULL DEFAULT '{}' CHECK(json_valid(workflow_json));
ALTER TABLE intelligence_sources ADD COLUMN revision INTEGER NOT NULL DEFAULT 1;
CREATE TRIGGER intelligence_source_settings_revision AFTER UPDATE OF canonical_url,source_type,monitoring_enabled,mandatory,trigger_ids_json,auth_mode ON intelligence_sources
WHEN NEW.revision=OLD.revision BEGIN
 UPDATE intelligence_sources SET revision=revision+1 WHERE id=NEW.id;
END;
CREATE TABLE monitoring_findings(
 id TEXT PRIMARY KEY, workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
 event_key TEXT NOT NULL, purpose TEXT NOT NULL, title TEXT NOT NULL DEFAULT '', source_url TEXT NOT NULL,
 event_json TEXT NOT NULL DEFAULT '{}' CHECK(json_valid(event_json)), assessment_json TEXT NOT NULL DEFAULT '{}' CHECK(json_valid(assessment_json)),
 fingerprint TEXT NOT NULL, revision INTEGER NOT NULL DEFAULT 1,
 status TEXT NOT NULL DEFAULT 'new' CHECK(status IN ('new','reviewed','dismissed')),
 config_revision INTEGER NOT NULL DEFAULT 0, source_id TEXT, source_revision INTEGER,
 created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
 UNIQUE(workspace_id,id), UNIQUE(workspace_id,event_key)
);
CREATE INDEX monitoring_findings_inbox ON monitoring_findings(workspace_id,status,updated_at DESC);
CREATE TABLE monitoring_finding_versions(
 id TEXT PRIMARY KEY, workspace_id TEXT NOT NULL, finding_id TEXT NOT NULL, revision INTEGER NOT NULL,
 fingerprint TEXT NOT NULL, event_json TEXT NOT NULL CHECK(json_valid(event_json)), assessment_json TEXT NOT NULL CHECK(json_valid(assessment_json)),
 created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
 FOREIGN KEY(workspace_id,finding_id) REFERENCES monitoring_findings(workspace_id,id) ON DELETE CASCADE,
 UNIQUE(workspace_id,finding_id,revision)
);
CREATE TABLE monitoring_subjects(
 id TEXT PRIMARY KEY, workspace_id TEXT NOT NULL, finding_id TEXT NOT NULL, subject_key TEXT NOT NULL,
 kind TEXT NOT NULL CHECK(kind IN ('person','organization','unresolved')), name TEXT NOT NULL, role TEXT NOT NULL DEFAULT '',
 website TEXT NOT NULL DEFAULT '', source_quote TEXT NOT NULL DEFAULT '',
 finding_revision INTEGER NOT NULL DEFAULT 1, revision INTEGER NOT NULL DEFAULT 1,
 review_json TEXT NOT NULL DEFAULT '{}' CHECK(json_valid(review_json)), email TEXT NOT NULL DEFAULT '',
 FOREIGN KEY(workspace_id,finding_id) REFERENCES monitoring_findings(workspace_id,id) ON DELETE CASCADE,
 UNIQUE(workspace_id,id), UNIQUE(workspace_id,finding_id,subject_key)
);
CREATE TABLE monitoring_messages(
 id TEXT PRIMARY KEY, workspace_id TEXT NOT NULL, finding_id TEXT NOT NULL, subject_id TEXT NOT NULL,
 finding_revision INTEGER NOT NULL, subject_revision INTEGER NOT NULL, config_revision INTEGER NOT NULL,
 template_id TEXT NOT NULL, template_hash TEXT NOT NULL, workspace_version INTEGER NOT NULL,
 recipient TEXT NOT NULL, subject TEXT NOT NULL, body TEXT NOT NULL,
 status TEXT NOT NULL DEFAULT 'draft' CHECK(status IN ('draft','approved','sending','sent','held','canceled','ambiguous','replied')),
 revision INTEGER NOT NULL DEFAULT 1, prepared_by TEXT NOT NULL, approved_by TEXT, approved_at TEXT,
 connection_hash TEXT NOT NULL DEFAULT '', delivery_hash TEXT NOT NULL DEFAULT '', transport_id TEXT,
 thread_id TEXT, error_code TEXT, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, sent_at TEXT,
 FOREIGN KEY(workspace_id,finding_id) REFERENCES monitoring_findings(workspace_id,id) ON DELETE CASCADE,
 FOREIGN KEY(workspace_id,subject_id) REFERENCES monitoring_subjects(workspace_id,id) ON DELETE CASCADE,
 UNIQUE(workspace_id,id)
);
CREATE INDEX monitoring_messages_delivery ON monitoring_messages(status,workspace_id,approved_at);
