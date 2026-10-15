CREATE TABLE IF NOT EXISTS core_script_registry (
 id TEXT PRIMARY KEY, payload_json TEXT NOT NULL, revision INTEGER NOT NULL,
 updated_by TEXT NOT NULL REFERENCES users(id), updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS personal_script_library (
 workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE, user_id TEXT NOT NULL REFERENCES users(id),
 id TEXT NOT NULL, channel TEXT NOT NULL CHECK(channel IN ('email','linkedin','phone')),
 payload_json TEXT NOT NULL, revision INTEGER NOT NULL,
 PRIMARY KEY(workspace_id,user_id,id)
);
CREATE TABLE IF NOT EXISTS primary_script_preferences (
 workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE, user_id TEXT NOT NULL REFERENCES users(id),
 channel TEXT NOT NULL CHECK(channel IN ('email','linkedin','phone')), template_id TEXT,
 revision INTEGER NOT NULL, PRIMARY KEY(workspace_id,user_id,channel)
);
CREATE TABLE IF NOT EXISTS phone_script_drafts (
 workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE, user_id TEXT NOT NULL REFERENCES users(id),
 company_id TEXT NOT NULL REFERENCES crm_companies(id) ON DELETE CASCADE, contact_id TEXT NOT NULL REFERENCES crm_contacts(id) ON DELETE CASCADE,
 payload_json TEXT NOT NULL, revision INTEGER NOT NULL,
 PRIMARY KEY(workspace_id,user_id,company_id,contact_id)
);

CREATE TRIGGER storage_personal_script_library_insert AFTER INSERT ON personal_script_library BEGIN
 INSERT OR IGNORE INTO workspace_storage_accounts(workspace_id) VALUES(NEW.workspace_id);
 SELECT CASE WHEN (length(CAST(NEW.payload_json AS BLOB)))>0 AND EXISTS(SELECT 1 FROM workspace_storage_accounts WHERE workspace_id=NEW.workspace_id AND records_bytes+(length(CAST(NEW.payload_json AS BLOB)))>CASE WHEN plan_key='plus' AND paid_until>unixepoch() THEN plus_records_limit ELSE included_records_limit END) THEN RAISE(ABORT,'WORKSPACE_STORAGE_FULL') END;
 UPDATE workspace_storage_accounts SET records_bytes=records_bytes+(length(CAST(NEW.payload_json AS BLOB))) WHERE workspace_id=NEW.workspace_id;
END;

CREATE TRIGGER storage_personal_script_library_update AFTER UPDATE ON personal_script_library BEGIN
 SELECT CASE WHEN (length(CAST(NEW.payload_json AS BLOB))-length(CAST(OLD.payload_json AS BLOB)))>0 AND EXISTS(SELECT 1 FROM workspace_storage_accounts WHERE workspace_id=NEW.workspace_id AND records_bytes+(length(CAST(NEW.payload_json AS BLOB))-length(CAST(OLD.payload_json AS BLOB)))>CASE WHEN plan_key='plus' AND paid_until>unixepoch() THEN plus_records_limit ELSE included_records_limit END) THEN RAISE(ABORT,'WORKSPACE_STORAGE_FULL') END;
 UPDATE workspace_storage_accounts SET records_bytes=records_bytes+(length(CAST(NEW.payload_json AS BLOB))-length(CAST(OLD.payload_json AS BLOB))) WHERE workspace_id=NEW.workspace_id;
END;

CREATE TRIGGER storage_personal_script_library_delete AFTER DELETE ON personal_script_library BEGIN
 UPDATE workspace_storage_accounts SET records_bytes=records_bytes+(-length(CAST(OLD.payload_json AS BLOB))) WHERE workspace_id=OLD.workspace_id;
END;

CREATE TRIGGER storage_phone_script_drafts_insert AFTER INSERT ON phone_script_drafts BEGIN
 INSERT OR IGNORE INTO workspace_storage_accounts(workspace_id) VALUES(NEW.workspace_id);
 SELECT CASE WHEN (length(CAST(NEW.payload_json AS BLOB)))>0 AND EXISTS(SELECT 1 FROM workspace_storage_accounts WHERE workspace_id=NEW.workspace_id AND records_bytes+(length(CAST(NEW.payload_json AS BLOB)))>CASE WHEN plan_key='plus' AND paid_until>unixepoch() THEN plus_records_limit ELSE included_records_limit END) THEN RAISE(ABORT,'WORKSPACE_STORAGE_FULL') END;
 UPDATE workspace_storage_accounts SET records_bytes=records_bytes+(length(CAST(NEW.payload_json AS BLOB))) WHERE workspace_id=NEW.workspace_id;
END;

CREATE TRIGGER storage_phone_script_drafts_update AFTER UPDATE ON phone_script_drafts BEGIN
 SELECT CASE WHEN (length(CAST(NEW.payload_json AS BLOB))-length(CAST(OLD.payload_json AS BLOB)))>0 AND EXISTS(SELECT 1 FROM workspace_storage_accounts WHERE workspace_id=NEW.workspace_id AND records_bytes+(length(CAST(NEW.payload_json AS BLOB))-length(CAST(OLD.payload_json AS BLOB)))>CASE WHEN plan_key='plus' AND paid_until>unixepoch() THEN plus_records_limit ELSE included_records_limit END) THEN RAISE(ABORT,'WORKSPACE_STORAGE_FULL') END;
 UPDATE workspace_storage_accounts SET records_bytes=records_bytes+(length(CAST(NEW.payload_json AS BLOB))-length(CAST(OLD.payload_json AS BLOB))) WHERE workspace_id=NEW.workspace_id;
END;

CREATE TRIGGER storage_phone_script_drafts_delete AFTER DELETE ON phone_script_drafts BEGIN
 UPDATE workspace_storage_accounts SET records_bytes=records_bytes+(-length(CAST(OLD.payload_json AS BLOB))) WHERE workspace_id=OLD.workspace_id;
END;

CREATE TRIGGER phone_script_activity_insert AFTER INSERT ON phone_script_drafts BEGIN
 INSERT INTO crm_activities(id,workspace_id,company_id,contact_id,activity_type,channel,summary,metadata_json,actor_user_id,occurred_at,created_at)
 VALUES(lower(hex(randomblob(16))),NEW.workspace_id,NEW.company_id,NEW.contact_id,'script.saved','phone','Calling script saved',json_object('script',json(NEW.payload_json),'revision',NEW.revision),NEW.user_id,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP);
END;

CREATE TRIGGER phone_script_activity_update AFTER UPDATE ON phone_script_drafts BEGIN
 INSERT INTO crm_activities(id,workspace_id,company_id,contact_id,activity_type,channel,summary,metadata_json,actor_user_id,occurred_at,created_at)
 VALUES(lower(hex(randomblob(16))),NEW.workspace_id,NEW.company_id,NEW.contact_id,'script.saved','phone','Calling script saved',json_object('script',json(NEW.payload_json),'revision',NEW.revision),NEW.user_id,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP);
END;
