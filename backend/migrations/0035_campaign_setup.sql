CREATE TABLE IF NOT EXISTS email_campaign_setup (
 campaign_id TEXT PRIMARY KEY REFERENCES email_campaigns(id) ON DELETE CASCADE,
 workspace_id TEXT NOT NULL REFERENCES workspaces(id),
 company_ids_json TEXT NOT NULL DEFAULT '[]',
 selection_json TEXT NOT NULL DEFAULT '{}',
 route TEXT NOT NULL DEFAULT 'direct' CHECK(route IN ('direct','research'))
);
CREATE INDEX IF NOT EXISTS idx_email_campaign_setup_workspace ON email_campaign_setup(workspace_id,campaign_id);
CREATE TRIGGER storage_campaign_setup_insert AFTER INSERT ON email_campaign_setup BEGIN
 INSERT OR IGNORE INTO workspace_storage_accounts(workspace_id) VALUES(NEW.workspace_id);
 UPDATE workspace_storage_accounts SET records_bytes=records_bytes+length(CAST(NEW.company_ids_json AS BLOB))+length(CAST(NEW.selection_json AS BLOB))+length(CAST(NEW.route AS BLOB)) WHERE workspace_id=NEW.workspace_id;
 SELECT CASE WHEN EXISTS(SELECT 1 FROM workspace_storage_accounts WHERE workspace_id=NEW.workspace_id AND records_bytes>CASE WHEN plan_key='plus' AND paid_until>unixepoch() THEN plus_records_limit ELSE included_records_limit END) THEN RAISE(ABORT,'WORKSPACE_STORAGE_FULL') END;
END;
CREATE TRIGGER storage_campaign_setup_update AFTER UPDATE ON email_campaign_setup BEGIN
 UPDATE workspace_storage_accounts SET records_bytes=MAX(0,records_bytes+length(CAST(NEW.company_ids_json AS BLOB))+length(CAST(NEW.selection_json AS BLOB))+length(CAST(NEW.route AS BLOB))-length(CAST(OLD.company_ids_json AS BLOB))-length(CAST(OLD.selection_json AS BLOB))-length(CAST(OLD.route AS BLOB))) WHERE workspace_id=NEW.workspace_id;
 SELECT CASE WHEN EXISTS(SELECT 1 FROM workspace_storage_accounts WHERE workspace_id=NEW.workspace_id AND records_bytes>CASE WHEN plan_key='plus' AND paid_until>unixepoch() THEN plus_records_limit ELSE included_records_limit END) THEN RAISE(ABORT,'WORKSPACE_STORAGE_FULL') END;
END;
CREATE TRIGGER storage_campaign_setup_delete AFTER DELETE ON email_campaign_setup BEGIN
 UPDATE workspace_storage_accounts SET records_bytes=MAX(0,records_bytes-length(CAST(OLD.company_ids_json AS BLOB))-length(CAST(OLD.selection_json AS BLOB))-length(CAST(OLD.route AS BLOB))) WHERE workspace_id=OLD.workspace_id;
END;
