PRAGMA foreign_keys=ON;
CREATE TABLE company_lists (
 id TEXT PRIMARY KEY, workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
 requested_by TEXT NOT NULL REFERENCES users(id), session_hash TEXT NOT NULL,
 input_json TEXT NOT NULL CHECK(json_valid(input_json)), state_json TEXT NOT NULL CHECK(json_valid(state_json)),
 status TEXT NOT NULL DEFAULT 'queued' CHECK(status IN ('queued','running','complete','incomplete','canceled')),
 last_error TEXT, saved INTEGER NOT NULL DEFAULT 0, revision INTEGER NOT NULL DEFAULT 1,
 lease_token TEXT, lease_until INTEGER NOT NULL DEFAULT 0,
 created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX company_lists_due ON company_lists(status,lease_until,updated_at);
CREATE INDEX company_lists_workspace ON company_lists(workspace_id,created_at);
CREATE UNIQUE INDEX company_lists_one_active ON company_lists(workspace_id) WHERE status IN ('queued','running');
CREATE TRIGGER storage_company_lists_insert AFTER INSERT ON company_lists BEGIN
 INSERT OR IGNORE INTO workspace_storage_accounts(workspace_id) VALUES(NEW.workspace_id);
 SELECT CASE WHEN EXISTS(SELECT 1 FROM workspace_storage_accounts WHERE workspace_id=NEW.workspace_id AND records_bytes+length(CAST(NEW.input_json AS BLOB))+length(CAST(NEW.state_json AS BLOB))>CASE WHEN plan_key='plus' AND paid_until>unixepoch() THEN plus_records_limit ELSE included_records_limit END) THEN RAISE(ABORT,'WORKSPACE_STORAGE_FULL') END;
 UPDATE workspace_storage_accounts SET records_bytes=records_bytes+length(CAST(NEW.input_json AS BLOB))+length(CAST(NEW.state_json AS BLOB)) WHERE workspace_id=NEW.workspace_id;
END;
CREATE TRIGGER storage_company_lists_update AFTER UPDATE OF input_json,state_json ON company_lists BEGIN
 SELECT CASE WHEN EXISTS(SELECT 1 FROM workspace_storage_accounts WHERE workspace_id=NEW.workspace_id AND records_bytes+length(CAST(NEW.input_json AS BLOB))+length(CAST(NEW.state_json AS BLOB))-length(CAST(OLD.input_json AS BLOB))-length(CAST(OLD.state_json AS BLOB))>CASE WHEN plan_key='plus' AND paid_until>unixepoch() THEN plus_records_limit ELSE included_records_limit END) THEN RAISE(ABORT,'WORKSPACE_STORAGE_FULL') END;
 UPDATE workspace_storage_accounts SET records_bytes=records_bytes+length(CAST(NEW.input_json AS BLOB))+length(CAST(NEW.state_json AS BLOB))-length(CAST(OLD.input_json AS BLOB))-length(CAST(OLD.state_json AS BLOB)) WHERE workspace_id=NEW.workspace_id;
END;
CREATE TRIGGER storage_company_lists_delete AFTER DELETE ON company_lists BEGIN
 UPDATE workspace_storage_accounts SET records_bytes=records_bytes-length(CAST(OLD.input_json AS BLOB))-length(CAST(OLD.state_json AS BLOB)) WHERE workspace_id=OLD.workspace_id;
END;
