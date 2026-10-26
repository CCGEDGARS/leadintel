-- Meter bounded company reference metadata separately from private original files.
-- R2 bytes are already metered by withWorkspaceStorage.
CREATE TRIGGER storage_company_material_insert AFTER INSERT ON company_materials BEGIN
 INSERT OR IGNORE INTO workspace_storage_accounts(workspace_id) VALUES(NEW.workspace_id);
 SELECT CASE WHEN EXISTS(SELECT 1 FROM workspace_storage_accounts WHERE workspace_id=NEW.workspace_id AND records_bytes+length(CAST(NEW.analysis_json AS BLOB))+length(CAST(NEW.filename AS BLOB))+length(CAST(NEW.error AS BLOB))>CASE WHEN plan_key='plus' AND paid_until>unixepoch() THEN plus_records_limit ELSE included_records_limit END) THEN RAISE(ABORT,'WORKSPACE_STORAGE_FULL') END;
 UPDATE workspace_storage_accounts SET records_bytes=records_bytes+length(CAST(NEW.analysis_json AS BLOB))+length(CAST(NEW.filename AS BLOB))+length(CAST(NEW.error AS BLOB)) WHERE workspace_id=NEW.workspace_id;
END;
CREATE TRIGGER storage_company_material_update AFTER UPDATE ON company_materials BEGIN
 SELECT CASE WHEN length(CAST(NEW.analysis_json AS BLOB))+length(CAST(NEW.filename AS BLOB))+length(CAST(NEW.error AS BLOB))>length(CAST(OLD.analysis_json AS BLOB))+length(CAST(OLD.filename AS BLOB))+length(CAST(OLD.error AS BLOB)) AND EXISTS(SELECT 1 FROM workspace_storage_accounts WHERE workspace_id=NEW.workspace_id AND records_bytes+length(CAST(NEW.analysis_json AS BLOB))+length(CAST(NEW.filename AS BLOB))+length(CAST(NEW.error AS BLOB))-length(CAST(OLD.analysis_json AS BLOB))-length(CAST(OLD.filename AS BLOB))-length(CAST(OLD.error AS BLOB))>CASE WHEN plan_key='plus' AND paid_until>unixepoch() THEN plus_records_limit ELSE included_records_limit END) THEN RAISE(ABORT,'WORKSPACE_STORAGE_FULL') END;
 UPDATE workspace_storage_accounts SET records_bytes=records_bytes+length(CAST(NEW.analysis_json AS BLOB))+length(CAST(NEW.filename AS BLOB))+length(CAST(NEW.error AS BLOB))-length(CAST(OLD.analysis_json AS BLOB))-length(CAST(OLD.filename AS BLOB))-length(CAST(OLD.error AS BLOB)) WHERE workspace_id=NEW.workspace_id;
END;
CREATE TRIGGER storage_company_material_delete AFTER DELETE ON company_materials BEGIN
 UPDATE workspace_storage_accounts SET records_bytes=records_bytes-length(CAST(OLD.analysis_json AS BLOB))-length(CAST(OLD.filename AS BLOB))-length(CAST(OLD.error AS BLOB)) WHERE workspace_id=OLD.workspace_id;
END;
