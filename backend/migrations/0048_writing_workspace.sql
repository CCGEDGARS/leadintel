-- Private general writing is independent of customer, CRM and sending records.
CREATE TABLE writing_workspace_records (
 workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
 user_id TEXT NOT NULL REFERENCES users(id),
 id TEXT NOT NULL,
 payload_json TEXT NOT NULL,
 revision INTEGER NOT NULL CHECK(revision>0),
 updated_at TEXT NOT NULL,
 archived INTEGER NOT NULL DEFAULT 0 CHECK(archived IN (0,1)),
 PRIMARY KEY(workspace_id,user_id,id)
);
CREATE INDEX writing_workspace_records_recent ON writing_workspace_records(workspace_id,user_id,archived,updated_at DESC);

CREATE TRIGGER storage_writing_workspace_insert AFTER INSERT ON writing_workspace_records BEGIN
 INSERT OR IGNORE INTO workspace_storage_accounts(workspace_id) VALUES(NEW.workspace_id);
 SELECT CASE WHEN EXISTS(SELECT 1 FROM workspace_storage_accounts WHERE workspace_id=NEW.workspace_id AND records_bytes+length(CAST(NEW.payload_json AS BLOB))>CASE WHEN plan_key='plus' AND paid_until>unixepoch() THEN plus_records_limit ELSE included_records_limit END) THEN RAISE(ABORT,'WORKSPACE_STORAGE_FULL') END;
 UPDATE workspace_storage_accounts SET records_bytes=records_bytes+length(CAST(NEW.payload_json AS BLOB)) WHERE workspace_id=NEW.workspace_id;
END;
CREATE TRIGGER storage_writing_workspace_update AFTER UPDATE ON writing_workspace_records BEGIN
 SELECT CASE WHEN length(CAST(NEW.payload_json AS BLOB))>length(CAST(OLD.payload_json AS BLOB)) AND EXISTS(SELECT 1 FROM workspace_storage_accounts WHERE workspace_id=NEW.workspace_id AND records_bytes+length(CAST(NEW.payload_json AS BLOB))-length(CAST(OLD.payload_json AS BLOB))>CASE WHEN plan_key='plus' AND paid_until>unixepoch() THEN plus_records_limit ELSE included_records_limit END) THEN RAISE(ABORT,'WORKSPACE_STORAGE_FULL') END;
 UPDATE workspace_storage_accounts SET records_bytes=records_bytes+length(CAST(NEW.payload_json AS BLOB))-length(CAST(OLD.payload_json AS BLOB)) WHERE workspace_id=NEW.workspace_id;
END;
CREATE TRIGGER storage_writing_workspace_delete AFTER DELETE ON writing_workspace_records BEGIN
 UPDATE workspace_storage_accounts SET records_bytes=records_bytes-length(CAST(OLD.payload_json AS BLOB)) WHERE workspace_id=OLD.workspace_id;
END;
