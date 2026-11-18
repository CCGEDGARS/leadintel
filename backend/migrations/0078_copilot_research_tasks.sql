CREATE TABLE copilot_research_tasks (
 id TEXT PRIMARY KEY, workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
 conversation_id TEXT NOT NULL REFERENCES copilot_conversations(id) ON DELETE CASCADE,
 requested_by TEXT NOT NULL REFERENCES users(id), session_hash TEXT NOT NULL,
 input_json TEXT NOT NULL CHECK(json_valid(input_json)), state_json TEXT NOT NULL CHECK(json_valid(state_json)),
 status TEXT NOT NULL DEFAULT 'draft' CHECK(status IN ('draft','ready','running','blocked','paused','complete')),
 revision INTEGER NOT NULL DEFAULT 1, last_error TEXT, lease_token TEXT, lease_until INTEGER NOT NULL DEFAULT 0,
 created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX copilot_tasks_due ON copilot_research_tasks(status,lease_until,updated_at);
CREATE INDEX copilot_tasks_workspace ON copilot_research_tasks(workspace_id,conversation_id);
CREATE UNIQUE INDEX copilot_tasks_one_active ON copilot_research_tasks(workspace_id) WHERE status='running';
CREATE TRIGGER storage_copilot_research_tasks_insert AFTER INSERT ON copilot_research_tasks BEGIN
 INSERT OR IGNORE INTO workspace_storage_accounts(workspace_id) VALUES(NEW.workspace_id);
 SELECT CASE WHEN EXISTS(SELECT 1 FROM workspace_storage_accounts WHERE workspace_id=NEW.workspace_id AND records_bytes+length(CAST(NEW.input_json AS BLOB))+length(CAST(NEW.state_json AS BLOB))>CASE WHEN plan_key='plus' AND paid_until>unixepoch() THEN plus_records_limit ELSE included_records_limit END) THEN RAISE(ABORT,'WORKSPACE_STORAGE_FULL') END;
 UPDATE workspace_storage_accounts SET records_bytes=records_bytes+length(CAST(NEW.input_json AS BLOB))+length(CAST(NEW.state_json AS BLOB)) WHERE workspace_id=NEW.workspace_id;
END;
CREATE TRIGGER storage_copilot_research_tasks_update AFTER UPDATE OF input_json,state_json ON copilot_research_tasks BEGIN
 SELECT CASE WHEN EXISTS(SELECT 1 FROM workspace_storage_accounts WHERE workspace_id=NEW.workspace_id AND records_bytes+length(CAST(NEW.input_json AS BLOB))+length(CAST(NEW.state_json AS BLOB))-length(CAST(OLD.input_json AS BLOB))-length(CAST(OLD.state_json AS BLOB))>CASE WHEN plan_key='plus' AND paid_until>unixepoch() THEN plus_records_limit ELSE included_records_limit END) THEN RAISE(ABORT,'WORKSPACE_STORAGE_FULL') END;
 UPDATE workspace_storage_accounts SET records_bytes=records_bytes+length(CAST(NEW.input_json AS BLOB))+length(CAST(NEW.state_json AS BLOB))-length(CAST(OLD.input_json AS BLOB))-length(CAST(OLD.state_json AS BLOB)) WHERE workspace_id=NEW.workspace_id;
END;
CREATE TRIGGER storage_copilot_research_tasks_delete AFTER DELETE ON copilot_research_tasks BEGIN
 UPDATE workspace_storage_accounts SET records_bytes=records_bytes-length(CAST(OLD.input_json AS BLOB))-length(CAST(OLD.state_json AS BLOB)) WHERE workspace_id=OLD.workspace_id;
END;

CREATE TRIGGER copilot_task_children_delete BEFORE DELETE ON copilot_research_tasks BEGIN
 UPDATE company_lists SET status='canceled',lease_token=NULL,lease_until=0,revision=revision+1 WHERE workspace_id=OLD.workspace_id AND json_extract(input_json,'$.taskId')=OLD.id AND status IN ('queued','running');
 UPDATE company_lists SET input_json=json_remove(input_json,'$.taskId') WHERE workspace_id=OLD.workspace_id AND json_extract(input_json,'$.taskId')=OLD.id;
 UPDATE buyer_research_jobs SET status='canceled',lease_token=NULL,lease_until=0,revision=revision+1 WHERE workspace_id=OLD.workspace_id AND json_extract(input_json,'$.taskId')=OLD.id AND status IN ('queued','running');
END;
