-- Display-only metadata; never supplied as factual evidence to AI.
ALTER TABLE writing_reference_sources ADD COLUMN presentation_json TEXT NOT NULL DEFAULT '{}';
UPDATE workspace_storage_accounts SET records_bytes=records_bytes+2*(SELECT COUNT(*) FROM writing_reference_sources WHERE workspace_id=workspace_storage_accounts.workspace_id);
CREATE TRIGGER storage_reference_presentation_insert AFTER INSERT ON writing_reference_sources BEGIN
 INSERT OR IGNORE INTO workspace_storage_accounts(workspace_id) VALUES(NEW.workspace_id);
 SELECT CASE WHEN length(CAST(NEW.presentation_json AS BLOB))>0 AND EXISTS(SELECT 1 FROM workspace_storage_accounts WHERE workspace_id=NEW.workspace_id AND records_bytes+(length(CAST(NEW.presentation_json AS BLOB)))>CASE WHEN plan_key='plus' AND paid_until>unixepoch() THEN plus_records_limit ELSE included_records_limit END) THEN RAISE(ABORT,'WORKSPACE_STORAGE_FULL') END;
 UPDATE workspace_storage_accounts SET records_bytes=records_bytes+(length(CAST(NEW.presentation_json AS BLOB))) WHERE workspace_id=NEW.workspace_id;
END;
CREATE TRIGGER storage_reference_presentation_update AFTER UPDATE ON writing_reference_sources BEGIN

 SELECT CASE WHEN length(CAST(NEW.presentation_json AS BLOB))-length(CAST(OLD.presentation_json AS BLOB))>0 AND EXISTS(SELECT 1 FROM workspace_storage_accounts WHERE workspace_id=NEW.workspace_id AND records_bytes+(length(CAST(NEW.presentation_json AS BLOB))-length(CAST(OLD.presentation_json AS BLOB)))>CASE WHEN plan_key='plus' AND paid_until>unixepoch() THEN plus_records_limit ELSE included_records_limit END) THEN RAISE(ABORT,'WORKSPACE_STORAGE_FULL') END;
 UPDATE workspace_storage_accounts SET records_bytes=records_bytes+(length(CAST(NEW.presentation_json AS BLOB))-length(CAST(OLD.presentation_json AS BLOB))) WHERE workspace_id=NEW.workspace_id;
END;
CREATE TRIGGER storage_reference_presentation_delete AFTER DELETE ON writing_reference_sources BEGIN


 UPDATE workspace_storage_accounts SET records_bytes=records_bytes+(-length(CAST(OLD.presentation_json AS BLOB))) WHERE workspace_id=OLD.workspace_id;
END;

-- Keep the first existing active source; retain all books. Future activation is exclusive.
UPDATE writing_reference_workspaces SET revision=revision+1 WHERE workspace_id IN (SELECT workspace_id FROM writing_reference_sources WHERE active=1 GROUP BY workspace_id HAVING COUNT(*)>1);
UPDATE writing_reference_slots SET revision=revision+1 WHERE source_id IN (SELECT id FROM writing_reference_sources s WHERE active=1 AND EXISTS(SELECT 1 FROM writing_reference_sources other WHERE other.workspace_id=s.workspace_id AND other.active=1 AND other.slot<s.slot));
UPDATE writing_reference_sources AS s SET active=0,revision=revision+1 WHERE active=1 AND EXISTS(SELECT 1 FROM writing_reference_sources other WHERE other.workspace_id=s.workspace_id AND other.active=1 AND other.slot<s.slot);
CREATE UNIQUE INDEX writing_reference_one_active ON writing_reference_sources(workspace_id) WHERE active=1;
