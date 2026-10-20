-- Research must not consume the small workflow-state row budget. Immutable,
-- workspace-scoped chunks commit atomically with the state/flow CAS manifest.
CREATE TABLE workspace_payload_records(
 workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
 snapshot_id TEXT NOT NULL,
 part_index INTEGER NOT NULL CHECK(part_index>=0),
 content TEXT NOT NULL,
 PRIMARY KEY(workspace_id,snapshot_id,part_index)
);
CREATE TRIGGER storage_workspace_payload_records_insert AFTER INSERT ON workspace_payload_records BEGIN
 INSERT OR IGNORE INTO workspace_storage_accounts(workspace_id) VALUES(NEW.workspace_id);
 SELECT CASE WHEN EXISTS(SELECT 1 FROM workspace_storage_accounts WHERE workspace_id=NEW.workspace_id AND records_bytes+length(CAST(NEW.content AS BLOB))>CASE WHEN plan_key='plus' AND paid_until>unixepoch() THEN plus_records_limit ELSE included_records_limit END) THEN RAISE(ABORT,'WORKSPACE_STORAGE_FULL') END;
 UPDATE workspace_storage_accounts SET records_bytes=records_bytes+length(CAST(NEW.content AS BLOB)) WHERE workspace_id=NEW.workspace_id;
END;
CREATE TRIGGER storage_workspace_payload_records_delete AFTER DELETE ON workspace_payload_records BEGIN
 UPDATE workspace_storage_accounts SET records_bytes=records_bytes-length(CAST(OLD.content AS BLOB)) WHERE workspace_id=OLD.workspace_id;
END;
CREATE TRIGGER workspace_payload_records_immutable BEFORE UPDATE ON workspace_payload_records BEGIN
 SELECT RAISE(ABORT,'Workspace research records are immutable');
END;
