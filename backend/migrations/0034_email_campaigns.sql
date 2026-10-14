CREATE TABLE IF NOT EXISTS email_campaigns (
 id TEXT PRIMARY KEY, workspace_id TEXT NOT NULL REFERENCES workspaces(id), name TEXT NOT NULL,
 objective TEXT NOT NULL DEFAULT '', template_id TEXT NOT NULL, mode TEXT NOT NULL,
 subject_template TEXT NOT NULL DEFAULT '', body_template TEXT NOT NULL DEFAULT '',
 revision INTEGER NOT NULL DEFAULT 1, delivery_token TEXT, delivery_until TEXT, created_by TEXT NOT NULL, created_at TEXT NOT NULL, updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_email_campaigns_workspace ON email_campaigns(workspace_id,updated_at);
CREATE TABLE IF NOT EXISTS email_campaign_members (
 campaign_id TEXT NOT NULL REFERENCES email_campaigns(id) ON DELETE CASCADE,
 workspace_id TEXT NOT NULL, contact_id TEXT NOT NULL REFERENCES crm_contacts(id) ON DELETE CASCADE,
 draft_json TEXT, context_hash TEXT, approved_at TEXT, sequence_id TEXT, sent_at TEXT, provider_status TEXT,
 error TEXT, PRIMARY KEY(campaign_id,contact_id)
);
CREATE INDEX IF NOT EXISTS idx_email_campaign_members_workspace ON email_campaign_members(workspace_id,campaign_id);

CREATE TRIGGER storage_email_campaigns_insert AFTER INSERT ON email_campaigns BEGIN
INSERT OR IGNORE INTO workspace_storage_accounts(workspace_id) VALUES(NEW.workspace_id);
UPDATE workspace_storage_accounts SET records_bytes=MAX(0,records_bytes+(COALESCE(length(CAST(NEW.name AS BLOB)),0)+COALESCE(length(CAST(NEW.objective AS BLOB)),0)+COALESCE(length(CAST(NEW.template_id AS BLOB)),0)+COALESCE(length(CAST(NEW.mode AS BLOB)),0)+COALESCE(length(CAST(NEW.subject_template AS BLOB)),0)+COALESCE(length(CAST(NEW.body_template AS BLOB)),0))) WHERE workspace_id=NEW.workspace_id;
SELECT CASE WHEN EXISTS(SELECT 1 FROM workspace_storage_accounts WHERE workspace_id=NEW.workspace_id AND records_bytes>CASE WHEN plan_key='plus' AND paid_until>unixepoch() THEN plus_records_limit ELSE included_records_limit END) THEN RAISE(ABORT,'WORKSPACE_STORAGE_FULL') END;
END;

CREATE TRIGGER storage_email_campaigns_update AFTER UPDATE ON email_campaigns BEGIN
INSERT OR IGNORE INTO workspace_storage_accounts(workspace_id) VALUES(NEW.workspace_id);
UPDATE workspace_storage_accounts SET records_bytes=MAX(0,records_bytes+((COALESCE(length(CAST(NEW.name AS BLOB)),0)+COALESCE(length(CAST(NEW.objective AS BLOB)),0)+COALESCE(length(CAST(NEW.template_id AS BLOB)),0)+COALESCE(length(CAST(NEW.mode AS BLOB)),0)+COALESCE(length(CAST(NEW.subject_template AS BLOB)),0)+COALESCE(length(CAST(NEW.body_template AS BLOB)),0))-(COALESCE(length(CAST(OLD.name AS BLOB)),0)+COALESCE(length(CAST(OLD.objective AS BLOB)),0)+COALESCE(length(CAST(OLD.template_id AS BLOB)),0)+COALESCE(length(CAST(OLD.mode AS BLOB)),0)+COALESCE(length(CAST(OLD.subject_template AS BLOB)),0)+COALESCE(length(CAST(OLD.body_template AS BLOB)),0)))) WHERE workspace_id=NEW.workspace_id;
SELECT CASE WHEN EXISTS(SELECT 1 FROM workspace_storage_accounts WHERE workspace_id=NEW.workspace_id AND records_bytes>CASE WHEN plan_key='plus' AND paid_until>unixepoch() THEN plus_records_limit ELSE included_records_limit END) THEN RAISE(ABORT,'WORKSPACE_STORAGE_FULL') END;
END;

CREATE TRIGGER storage_email_campaigns_delete AFTER DELETE ON email_campaigns BEGIN
INSERT OR IGNORE INTO workspace_storage_accounts(workspace_id) VALUES(OLD.workspace_id);
UPDATE workspace_storage_accounts SET records_bytes=MAX(0,records_bytes+(-(COALESCE(length(CAST(OLD.name AS BLOB)),0)+COALESCE(length(CAST(OLD.objective AS BLOB)),0)+COALESCE(length(CAST(OLD.template_id AS BLOB)),0)+COALESCE(length(CAST(OLD.mode AS BLOB)),0)+COALESCE(length(CAST(OLD.subject_template AS BLOB)),0)+COALESCE(length(CAST(OLD.body_template AS BLOB)),0)))) WHERE workspace_id=OLD.workspace_id;
END;

CREATE TRIGGER storage_email_campaign_members_insert AFTER INSERT ON email_campaign_members BEGIN
INSERT OR IGNORE INTO workspace_storage_accounts(workspace_id) VALUES(NEW.workspace_id);
UPDATE workspace_storage_accounts SET records_bytes=MAX(0,records_bytes+(COALESCE(length(CAST(NEW.draft_json AS BLOB)),0)+COALESCE(length(CAST(NEW.context_hash AS BLOB)),0))) WHERE workspace_id=NEW.workspace_id;
SELECT CASE WHEN EXISTS(SELECT 1 FROM workspace_storage_accounts WHERE workspace_id=NEW.workspace_id AND records_bytes>CASE WHEN plan_key='plus' AND paid_until>unixepoch() THEN plus_records_limit ELSE included_records_limit END) THEN RAISE(ABORT,'WORKSPACE_STORAGE_FULL') END;
END;

CREATE TRIGGER storage_email_campaign_members_update AFTER UPDATE ON email_campaign_members BEGIN
INSERT OR IGNORE INTO workspace_storage_accounts(workspace_id) VALUES(NEW.workspace_id);
UPDATE workspace_storage_accounts SET records_bytes=MAX(0,records_bytes+((COALESCE(length(CAST(NEW.draft_json AS BLOB)),0)+COALESCE(length(CAST(NEW.context_hash AS BLOB)),0))-(COALESCE(length(CAST(OLD.draft_json AS BLOB)),0)+COALESCE(length(CAST(OLD.context_hash AS BLOB)),0)))) WHERE workspace_id=NEW.workspace_id;
SELECT CASE WHEN EXISTS(SELECT 1 FROM workspace_storage_accounts WHERE workspace_id=NEW.workspace_id AND records_bytes>CASE WHEN plan_key='plus' AND paid_until>unixepoch() THEN plus_records_limit ELSE included_records_limit END) THEN RAISE(ABORT,'WORKSPACE_STORAGE_FULL') END;
END;

CREATE TRIGGER storage_email_campaign_members_delete AFTER DELETE ON email_campaign_members BEGIN
INSERT OR IGNORE INTO workspace_storage_accounts(workspace_id) VALUES(OLD.workspace_id);
UPDATE workspace_storage_accounts SET records_bytes=MAX(0,records_bytes+(-(COALESCE(length(CAST(OLD.draft_json AS BLOB)),0)+COALESCE(length(CAST(OLD.context_hash AS BLOB)),0)))) WHERE workspace_id=OLD.workspace_id;
END;
