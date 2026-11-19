-- The workspace/list pair is the owner of each retained company evidence record.
CREATE UNIQUE INDEX company_lists_owner_id ON company_lists(workspace_id,id);
CREATE TABLE company_list_evidence (
 workspace_id TEXT NOT NULL, list_id TEXT NOT NULL, domain TEXT NOT NULL,
 evidence_id TEXT NOT NULL, result_json TEXT NOT NULL CHECK(json_valid(result_json)),
 PRIMARY KEY(workspace_id,list_id,domain),
 FOREIGN KEY(workspace_id,list_id) REFERENCES company_lists(workspace_id,id) ON DELETE CASCADE
);
CREATE TRIGGER storage_company_list_evidence_insert AFTER INSERT ON company_list_evidence BEGIN
 SELECT CASE WHEN EXISTS(SELECT 1 FROM workspace_storage_accounts WHERE workspace_id=NEW.workspace_id AND records_bytes+length(CAST(NEW.result_json AS BLOB))>CASE WHEN plan_key='plus' AND paid_until>unixepoch() THEN plus_records_limit ELSE included_records_limit END) THEN RAISE(ABORT,'WORKSPACE_STORAGE_FULL') END;
 UPDATE workspace_storage_accounts SET records_bytes=records_bytes+length(CAST(NEW.result_json AS BLOB)) WHERE workspace_id=NEW.workspace_id;
END;
CREATE TRIGGER storage_company_list_evidence_update AFTER UPDATE OF result_json ON company_list_evidence BEGIN
 SELECT CASE WHEN EXISTS(SELECT 1 FROM workspace_storage_accounts WHERE workspace_id=NEW.workspace_id AND records_bytes+length(CAST(NEW.result_json AS BLOB))-length(CAST(OLD.result_json AS BLOB))>CASE WHEN plan_key='plus' AND paid_until>unixepoch() THEN plus_records_limit ELSE included_records_limit END) THEN RAISE(ABORT,'WORKSPACE_STORAGE_FULL') END;
 UPDATE workspace_storage_accounts SET records_bytes=records_bytes+length(CAST(NEW.result_json AS BLOB))-length(CAST(OLD.result_json AS BLOB)) WHERE workspace_id=NEW.workspace_id;
END;
CREATE TRIGGER storage_company_list_evidence_delete AFTER DELETE ON company_list_evidence BEGIN
 UPDATE workspace_storage_accounts SET records_bytes=records_bytes-length(CAST(OLD.result_json AS BLOB)) WHERE workspace_id=OLD.workspace_id;
END;
