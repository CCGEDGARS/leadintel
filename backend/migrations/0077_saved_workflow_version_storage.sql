-- Versions consume normal workspace storage. Original copies are not silently
-- evicted when full; the transaction fails and keeps existing saved versions.
CREATE TRIGGER storage_saved_flow_versions_insert AFTER INSERT ON saved_flow_versions BEGIN
 INSERT OR IGNORE INTO workspace_storage_accounts(workspace_id) VALUES(NEW.workspace_id);
 SELECT CASE WHEN EXISTS(SELECT 1 FROM workspace_storage_accounts WHERE workspace_id=NEW.workspace_id AND records_bytes+length(CAST(NEW.payload_json AS BLOB))+length(CAST(NEW.config_json AS BLOB))+length(CAST(NEW.name AS BLOB))>CASE WHEN plan_key='plus' AND paid_until>unixepoch() THEN plus_records_limit ELSE included_records_limit END) THEN RAISE(ABORT,'WORKSPACE_STORAGE_FULL') END;
 UPDATE workspace_storage_accounts SET records_bytes=records_bytes+length(CAST(NEW.payload_json AS BLOB))+length(CAST(NEW.config_json AS BLOB))+length(CAST(NEW.name AS BLOB)) WHERE workspace_id=NEW.workspace_id;
END;
CREATE TRIGGER storage_saved_flow_versions_delete AFTER DELETE ON saved_flow_versions BEGIN
 UPDATE workspace_storage_accounts SET records_bytes=records_bytes-length(CAST(OLD.payload_json AS BLOB))-length(CAST(OLD.config_json AS BLOB))-length(CAST(OLD.name AS BLOB)) WHERE workspace_id=OLD.workspace_id;
END;
-- Keep protected version chunks safe even during a rolling deployment where an
-- older worker still runs garbage collection unaware of saved_flow_versions.
CREATE TRIGGER saved_workflow_payload_protection BEFORE DELETE ON workspace_payload_records
WHEN EXISTS(SELECT 1 FROM workspaces WHERE id=OLD.workspace_id) AND EXISTS(SELECT 1 FROM saved_flow_versions v WHERE v.workspace_id=OLD.workspace_id AND json_extract(v.payload_json,'$.format')='leadintel-workspace-records-v1' AND json_extract(v.payload_json,'$.snapshot')=OLD.snapshot_id)
BEGIN SELECT RAISE(IGNORE); END;
