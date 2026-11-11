PRAGMA foreign_keys=ON;
-- Independent public contact research: never shares Buyer qualification or chat state.
CREATE TABLE website_contact_jobs (
 id TEXT PRIMARY KEY,
 workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
 company_id TEXT NOT NULL REFERENCES crm_companies(id) ON DELETE CASCADE,
 requested_by TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
 requested_role TEXT NOT NULL,
 session_hash TEXT NOT NULL,
 input_json TEXT NOT NULL CHECK(json_valid(input_json)),
 state_json TEXT NOT NULL DEFAULT '{}' CHECK(json_valid(state_json)),
 status TEXT NOT NULL DEFAULT 'queued' CHECK(status IN ('queued','running','complete','incomplete','canceled')),
 revision INTEGER NOT NULL DEFAULT 1,
 lease_token TEXT,
 lease_until INTEGER NOT NULL DEFAULT 0,
 deadline_at INTEGER NOT NULL,
 created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
 updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX website_contacts_active ON website_contact_jobs(workspace_id,company_id) WHERE status IN ('queued','running');
CREATE INDEX website_contacts_due ON website_contact_jobs(status,lease_until,created_at);
CREATE TRIGGER storage_website_contacts_insert AFTER INSERT ON website_contact_jobs BEGIN
 INSERT OR IGNORE INTO workspace_storage_accounts(workspace_id) VALUES(NEW.workspace_id);
 SELECT CASE WHEN EXISTS(SELECT 1 FROM workspace_storage_accounts WHERE workspace_id=NEW.workspace_id AND records_bytes+length(CAST(NEW.input_json AS BLOB))+length(CAST(NEW.state_json AS BLOB))>CASE WHEN plan_key='plus' AND paid_until>unixepoch() THEN plus_records_limit ELSE included_records_limit END) THEN RAISE(ABORT,'WORKSPACE_STORAGE_FULL') END;
 UPDATE workspace_storage_accounts SET records_bytes=records_bytes+length(CAST(NEW.input_json AS BLOB))+length(CAST(NEW.state_json AS BLOB)) WHERE workspace_id=NEW.workspace_id;
END;
CREATE TRIGGER storage_website_contacts_update AFTER UPDATE OF input_json,state_json ON website_contact_jobs BEGIN
 SELECT CASE WHEN EXISTS(SELECT 1 FROM workspace_storage_accounts WHERE workspace_id=NEW.workspace_id AND records_bytes+length(CAST(NEW.input_json AS BLOB))+length(CAST(NEW.state_json AS BLOB))-length(CAST(OLD.input_json AS BLOB))-length(CAST(OLD.state_json AS BLOB))>CASE WHEN plan_key='plus' AND paid_until>unixepoch() THEN plus_records_limit ELSE included_records_limit END) THEN RAISE(ABORT,'WORKSPACE_STORAGE_FULL') END;
 UPDATE workspace_storage_accounts SET records_bytes=records_bytes+length(CAST(NEW.input_json AS BLOB))+length(CAST(NEW.state_json AS BLOB))-length(CAST(OLD.input_json AS BLOB))-length(CAST(OLD.state_json AS BLOB)) WHERE workspace_id=NEW.workspace_id;
END;
CREATE TRIGGER storage_website_contacts_delete AFTER DELETE ON website_contact_jobs BEGIN
 UPDATE workspace_storage_accounts SET records_bytes=records_bytes-length(CAST(OLD.input_json AS BLOB))-length(CAST(OLD.state_json AS BLOB)) WHERE workspace_id=OLD.workspace_id;
END;
