CREATE TABLE IF NOT EXISTS conversation_workflows (
 id TEXT PRIMARY KEY, workspace_id TEXT NOT NULL REFERENCES workspaces(id), name TEXT NOT NULL,
 revision INTEGER NOT NULL, is_default INTEGER NOT NULL DEFAULT 0, active INTEGER NOT NULL DEFAULT 1,
 approved_at TEXT NOT NULL, default_since TEXT, deleted_at TEXT,
 enrollment_error TEXT, enrollment_error_message_id TEXT, enrollment_error_at TEXT
);
CREATE UNIQUE INDEX IF NOT EXISTS conversation_workflow_default ON conversation_workflows(workspace_id) WHERE is_default=1 AND active=1 AND deleted_at IS NULL;
CREATE TABLE IF NOT EXISTS conversation_workflow_revisions (
 workflow_id TEXT NOT NULL REFERENCES conversation_workflows(id), workspace_id TEXT NOT NULL,
 revision INTEGER NOT NULL, config_json TEXT NOT NULL, approved_by TEXT NOT NULL, approved_at TEXT NOT NULL,
 PRIMARY KEY(workflow_id,revision)
);
CREATE TABLE IF NOT EXISTS conversation_workflow_assignments (
 message_id TEXT PRIMARY KEY REFERENCES gmail_messages(id), workspace_id TEXT NOT NULL,
 workflow_id TEXT NOT NULL REFERENCES conversation_workflows(id), revision INTEGER NOT NULL,
 status TEXT NOT NULL DEFAULT 'automatic', error TEXT, assigned_at TEXT NOT NULL,
 baseline_reply_id TEXT, reply_count INTEGER NOT NULL DEFAULT 0, first_step_index INTEGER NOT NULL DEFAULT 1
);
ALTER TABLE conversation_plan_steps ADD COLUMN reply_message_id TEXT;
CREATE UNIQUE INDEX conversation_workflow_reply_once ON conversation_plan_steps(plan_id,reply_message_id) WHERE reply_message_id IS NOT NULL;

CREATE TRIGGER conversation_workflow_revision_immutable BEFORE UPDATE ON conversation_workflow_revisions BEGIN SELECT RAISE(ABORT,'Workflow approval snapshot is immutable'); END;
CREATE TRIGGER conversation_workflow_revision_retained BEFORE DELETE ON conversation_workflow_revisions BEGIN SELECT RAISE(ABORT,'Workflow approval snapshot is immutable'); END;

-- Preset metadata reserves 4096 bytes including a bounded quota-safe enrollment alert.
CREATE TRIGGER storage_conversation_workflows_insert AFTER INSERT ON conversation_workflows BEGIN
 INSERT OR IGNORE INTO workspace_storage_accounts(workspace_id) VALUES(NEW.workspace_id);
 SELECT CASE WHEN EXISTS(SELECT 1 FROM workspace_storage_accounts WHERE workspace_id=NEW.workspace_id AND records_bytes+(4096+length(CAST(NEW.name AS BLOB)))>CASE WHEN plan_key='plus' AND paid_until>unixepoch() THEN plus_records_limit ELSE included_records_limit END) THEN RAISE(ABORT,'WORKSPACE_STORAGE_FULL') END;
 UPDATE workspace_storage_accounts SET records_bytes=records_bytes+(4096+length(CAST(NEW.name AS BLOB))) WHERE workspace_id=NEW.workspace_id;
END;
CREATE TRIGGER storage_conversation_workflows_update AFTER UPDATE ON conversation_workflows BEGIN
 SELECT CASE WHEN NEW.workspace_id IS NOT OLD.workspace_id THEN RAISE(ABORT,'WORKSPACE_STORAGE_SCOPE_IMMUTABLE') END;
 SELECT CASE WHEN (4096+length(CAST(NEW.name AS BLOB)))>(4096+length(CAST(OLD.name AS BLOB))) AND EXISTS(SELECT 1 FROM workspace_storage_accounts WHERE workspace_id=NEW.workspace_id AND records_bytes+(4096+length(CAST(NEW.name AS BLOB)))-(4096+length(CAST(OLD.name AS BLOB)))>CASE WHEN plan_key='plus' AND paid_until>unixepoch() THEN plus_records_limit ELSE included_records_limit END) THEN RAISE(ABORT,'WORKSPACE_STORAGE_FULL') END;
 UPDATE workspace_storage_accounts SET records_bytes=records_bytes+(4096+length(CAST(NEW.name AS BLOB)))-(4096+length(CAST(OLD.name AS BLOB))) WHERE workspace_id=NEW.workspace_id;
END;
CREATE TRIGGER storage_conversation_workflows_delete AFTER DELETE ON conversation_workflows BEGIN
 UPDATE workspace_storage_accounts SET records_bytes=records_bytes-(4096+length(CAST(OLD.name AS BLOB))) WHERE workspace_id=OLD.workspace_id;
END;

CREATE TRIGGER storage_conversation_workflow_revisions_insert AFTER INSERT ON conversation_workflow_revisions BEGIN
 INSERT OR IGNORE INTO workspace_storage_accounts(workspace_id) VALUES(NEW.workspace_id);
 SELECT CASE WHEN EXISTS(SELECT 1 FROM workspace_storage_accounts WHERE workspace_id=NEW.workspace_id AND records_bytes+(1024+length(CAST(NEW.config_json AS BLOB)))>CASE WHEN plan_key='plus' AND paid_until>unixepoch() THEN plus_records_limit ELSE included_records_limit END) THEN RAISE(ABORT,'WORKSPACE_STORAGE_FULL') END;
 UPDATE workspace_storage_accounts SET records_bytes=records_bytes+(1024+length(CAST(NEW.config_json AS BLOB))) WHERE workspace_id=NEW.workspace_id;
END;
CREATE TRIGGER storage_conversation_workflow_revisions_update AFTER UPDATE ON conversation_workflow_revisions BEGIN
 SELECT CASE WHEN NEW.workspace_id IS NOT OLD.workspace_id THEN RAISE(ABORT,'WORKSPACE_STORAGE_SCOPE_IMMUTABLE') END;
 SELECT CASE WHEN (1024+length(CAST(NEW.config_json AS BLOB)))>(1024+length(CAST(OLD.config_json AS BLOB))) AND EXISTS(SELECT 1 FROM workspace_storage_accounts WHERE workspace_id=NEW.workspace_id AND records_bytes+(1024+length(CAST(NEW.config_json AS BLOB)))-(1024+length(CAST(OLD.config_json AS BLOB)))>CASE WHEN plan_key='plus' AND paid_until>unixepoch() THEN plus_records_limit ELSE included_records_limit END) THEN RAISE(ABORT,'WORKSPACE_STORAGE_FULL') END;
 UPDATE workspace_storage_accounts SET records_bytes=records_bytes+(1024+length(CAST(NEW.config_json AS BLOB)))-(1024+length(CAST(OLD.config_json AS BLOB))) WHERE workspace_id=NEW.workspace_id;
END;
CREATE TRIGGER storage_conversation_workflow_revisions_delete AFTER DELETE ON conversation_workflow_revisions BEGIN
 UPDATE workspace_storage_accounts SET records_bytes=records_bytes-(1024+length(CAST(OLD.config_json AS BLOB))) WHERE workspace_id=OLD.workspace_id;
END;

CREATE TRIGGER storage_conversation_workflow_assignments_insert AFTER INSERT ON conversation_workflow_assignments BEGIN
 INSERT OR IGNORE INTO workspace_storage_accounts(workspace_id) VALUES(NEW.workspace_id);
 SELECT CASE WHEN EXISTS(SELECT 1 FROM workspace_storage_accounts WHERE workspace_id=NEW.workspace_id AND records_bytes+(1024)>CASE WHEN plan_key='plus' AND paid_until>unixepoch() THEN plus_records_limit ELSE included_records_limit END) THEN RAISE(ABORT,'WORKSPACE_STORAGE_FULL') END;
 UPDATE workspace_storage_accounts SET records_bytes=records_bytes+(1024) WHERE workspace_id=NEW.workspace_id;
END;
CREATE TRIGGER storage_conversation_workflow_assignments_update AFTER UPDATE ON conversation_workflow_assignments BEGIN
 SELECT CASE WHEN NEW.workspace_id IS NOT OLD.workspace_id THEN RAISE(ABORT,'WORKSPACE_STORAGE_SCOPE_IMMUTABLE') END;
 SELECT CASE WHEN (1024)>(1024) AND EXISTS(SELECT 1 FROM workspace_storage_accounts WHERE workspace_id=NEW.workspace_id AND records_bytes+(1024)-(1024)>CASE WHEN plan_key='plus' AND paid_until>unixepoch() THEN plus_records_limit ELSE included_records_limit END) THEN RAISE(ABORT,'WORKSPACE_STORAGE_FULL') END;
 UPDATE workspace_storage_accounts SET records_bytes=records_bytes+(1024)-(1024) WHERE workspace_id=NEW.workspace_id;
END;
CREATE TRIGGER storage_conversation_workflow_assignments_delete AFTER DELETE ON conversation_workflow_assignments BEGIN
 UPDATE workspace_storage_accounts SET records_bytes=records_bytes-(1024) WHERE workspace_id=OLD.workspace_id;
END;

CREATE TRIGGER conversation_workflow_assignment_approval_insert BEFORE INSERT ON conversation_workflow_assignments BEGIN
 SELECT CASE WHEN NOT EXISTS(SELECT 1 FROM conversation_workflows WHERE id=NEW.workflow_id AND workspace_id=NEW.workspace_id AND revision=NEW.revision AND active=1 AND deleted_at IS NULL) THEN RAISE(ABORT,'Workflow approval changed') END;
END;
CREATE TRIGGER conversation_workflow_assignment_approval_update BEFORE UPDATE OF workflow_id,revision ON conversation_workflow_assignments BEGIN
 SELECT CASE WHEN NOT EXISTS(SELECT 1 FROM conversation_workflows WHERE id=NEW.workflow_id AND workspace_id=NEW.workspace_id AND revision=NEW.revision AND active=1 AND deleted_at IS NULL) THEN RAISE(ABORT,'Workflow approval changed') END;
END;
CREATE TABLE conversation_workflow_assignment_history (
 id TEXT PRIMARY KEY,message_id TEXT NOT NULL,workspace_id TEXT NOT NULL,
 workflow_id TEXT NOT NULL,revision INTEGER NOT NULL,approved_by TEXT NOT NULL,
 approved_at TEXT NOT NULL,context_version TEXT NOT NULL
);
CREATE TRIGGER conversation_workflow_assignment_history_immutable BEFORE UPDATE ON conversation_workflow_assignment_history BEGIN SELECT RAISE(ABORT,'Assignment history is immutable'); END;
CREATE TRIGGER storage_conversation_workflow_history_insert AFTER INSERT ON conversation_workflow_assignment_history BEGIN
 INSERT OR IGNORE INTO workspace_storage_accounts(workspace_id) VALUES(NEW.workspace_id);
 SELECT CASE WHEN EXISTS(SELECT 1 FROM workspace_storage_accounts WHERE workspace_id=NEW.workspace_id AND records_bytes+1024>CASE WHEN plan_key='plus' AND paid_until>unixepoch() THEN plus_records_limit ELSE included_records_limit END) THEN RAISE(ABORT,'WORKSPACE_STORAGE_FULL') END;
 UPDATE workspace_storage_accounts SET records_bytes=records_bytes+1024 WHERE workspace_id=NEW.workspace_id;
END;
CREATE TRIGGER storage_conversation_workflow_history_delete AFTER DELETE ON conversation_workflow_assignment_history BEGIN UPDATE workspace_storage_accounts SET records_bytes=records_bytes-1024 WHERE workspace_id=OLD.workspace_id; END;

CREATE TABLE conversation_workflow_enrollment_failures (
 message_id TEXT PRIMARY KEY,workspace_id TEXT NOT NULL,workflow_id TEXT NOT NULL,
 revision INTEGER NOT NULL,error TEXT NOT NULL,attempted_at TEXT NOT NULL
);
CREATE TRIGGER storage_conversation_workflow_failure_insert AFTER INSERT ON conversation_workflow_enrollment_failures BEGIN
 INSERT OR IGNORE INTO workspace_storage_accounts(workspace_id) VALUES(NEW.workspace_id);
 SELECT CASE WHEN EXISTS(SELECT 1 FROM workspace_storage_accounts WHERE workspace_id=NEW.workspace_id AND records_bytes+1536>CASE WHEN plan_key='plus' AND paid_until>unixepoch() THEN plus_records_limit ELSE included_records_limit END) THEN RAISE(ABORT,'WORKSPACE_STORAGE_FULL') END;
 UPDATE workspace_storage_accounts SET records_bytes=records_bytes+1536 WHERE workspace_id=NEW.workspace_id;
END;
CREATE TRIGGER storage_conversation_workflow_failure_delete AFTER DELETE ON conversation_workflow_enrollment_failures BEGIN UPDATE workspace_storage_accounts SET records_bytes=records_bytes-1536 WHERE workspace_id=OLD.workspace_id; END;

-- Transaction-local assertions: inserted and removed in the same D1 batch.
-- RAISE aborts the entire batch, so stale activation cannot partly overwrite takeover.
CREATE TABLE conversation_workflow_mutation_guards (
 id TEXT PRIMARY KEY, message_id TEXT NOT NULL, workspace_id TEXT NOT NULL,
 expected_revision INTEGER NOT NULL, expected_assignment TEXT NOT NULL
);
CREATE TRIGGER conversation_workflow_mutation_guard BEFORE INSERT ON conversation_workflow_mutation_guards BEGIN
 SELECT CASE WHEN NOT EXISTS(SELECT 1 FROM conversation_state WHERE message_id=NEW.message_id AND workspace_id=NEW.workspace_id AND revision=NEW.expected_revision AND sync_lock IS NULL) THEN RAISE(ABORT,'Conversation context changed during workflow activation') END;
 SELECT CASE WHEN COALESCE((SELECT json_array(workflow_id,revision,status,first_step_index,assigned_at) FROM conversation_workflow_assignments WHERE message_id=NEW.message_id AND workspace_id=NEW.workspace_id),'null')!=NEW.expected_assignment THEN RAISE(ABORT,'Workflow assignment changed during activation') END;
END;
