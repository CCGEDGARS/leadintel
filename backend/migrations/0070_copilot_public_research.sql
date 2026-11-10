PRAGMA foreign_keys=ON;
CREATE TABLE copilot_research_jobs (
 id TEXT PRIMARY KEY,
 workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
 conversation_id TEXT NOT NULL REFERENCES copilot_conversations(id) ON DELETE CASCADE,
 assistant_message_id TEXT NOT NULL REFERENCES copilot_messages(id) ON DELETE CASCADE,
 requested_by TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
 session_hash TEXT NOT NULL,
 input_key TEXT NOT NULL,
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
CREATE UNIQUE INDEX copilot_research_active_input ON copilot_research_jobs(workspace_id,conversation_id,input_key) WHERE status IN ('queued','running');
CREATE INDEX copilot_research_due ON copilot_research_jobs(status,lease_until,created_at);
CREATE TRIGGER storage_copilot_research_insert AFTER INSERT ON copilot_research_jobs BEGIN
 INSERT OR IGNORE INTO workspace_storage_accounts(workspace_id) VALUES(NEW.workspace_id);
 SELECT CASE WHEN EXISTS(SELECT 1 FROM workspace_storage_accounts WHERE workspace_id=NEW.workspace_id AND records_bytes+length(CAST(NEW.input_json AS BLOB))+length(CAST(NEW.state_json AS BLOB))>CASE WHEN plan_key='plus' AND paid_until>unixepoch() THEN plus_records_limit ELSE included_records_limit END) THEN RAISE(ABORT,'WORKSPACE_STORAGE_FULL') END;
 UPDATE workspace_storage_accounts SET records_bytes=records_bytes+length(CAST(NEW.input_json AS BLOB))+length(CAST(NEW.state_json AS BLOB)) WHERE workspace_id=NEW.workspace_id;
END;
CREATE TRIGGER storage_copilot_research_update AFTER UPDATE OF input_json,state_json ON copilot_research_jobs BEGIN
 SELECT CASE WHEN EXISTS(SELECT 1 FROM workspace_storage_accounts WHERE workspace_id=NEW.workspace_id AND records_bytes+length(CAST(NEW.input_json AS BLOB))+length(CAST(NEW.state_json AS BLOB))-length(CAST(OLD.input_json AS BLOB))-length(CAST(OLD.state_json AS BLOB))>CASE WHEN plan_key='plus' AND paid_until>unixepoch() THEN plus_records_limit ELSE included_records_limit END) THEN RAISE(ABORT,'WORKSPACE_STORAGE_FULL') END;
 UPDATE workspace_storage_accounts SET records_bytes=records_bytes+length(CAST(NEW.input_json AS BLOB))+length(CAST(NEW.state_json AS BLOB))-length(CAST(OLD.input_json AS BLOB))-length(CAST(OLD.state_json AS BLOB)) WHERE workspace_id=NEW.workspace_id;
END;
CREATE TRIGGER storage_copilot_research_delete AFTER DELETE ON copilot_research_jobs BEGIN
 UPDATE workspace_storage_accounts SET records_bytes=records_bytes-length(CAST(OLD.input_json AS BLOB))-length(CAST(OLD.state_json AS BLOB)) WHERE workspace_id=OLD.workspace_id;
END;
