-- Preserve full body separately from source-derived authored text used for intent.
ALTER TABLE gmail_replies ADD COLUMN authored_text TEXT;
-- Supervised follow-ups are independent of legacy automation activation.
CREATE TABLE conversation_state (
 message_id TEXT PRIMARY KEY REFERENCES gmail_messages(id) ON DELETE CASCADE,
 workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
 revision INTEGER NOT NULL DEFAULT 0,
 initial_body TEXT NOT NULL DEFAULT '',
 rfc_message_id TEXT,
 last_synced_at TEXT,
 last_sync_attempt_at TEXT,
 sync_error TEXT,
 crm_sync_error TEXT,
 sync_lock TEXT,
 sync_lock_until TEXT,
 manual_sent_at TEXT,
 status TEXT NOT NULL DEFAULT 'monitoring',
 summary TEXT NOT NULL DEFAULT '',
 next_action TEXT NOT NULL DEFAULT 'Review the conversation and approve exact follow-ups if appropriate',
 reason TEXT NOT NULL DEFAULT 'No reviewed follow-up plan is active',
 due_at TEXT,
 task_status TEXT,
 task_reply_id TEXT
);
CREATE INDEX conversation_state_poll ON conversation_state(last_sync_attempt_at,workspace_id);
CREATE TABLE conversation_plans (
 id TEXT PRIMARY KEY,
 message_id TEXT NOT NULL UNIQUE REFERENCES gmail_messages(id) ON DELETE CASCADE,
 workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
 status TEXT NOT NULL DEFAULT 'active',
 approved_by TEXT NOT NULL REFERENCES users(id),
 approved_at TEXT NOT NULL,
 context_version TEXT NOT NULL,
 mailbox_identity TEXT NOT NULL,
 company_id TEXT NOT NULL,
 contact_id TEXT NOT NULL,
 company_revision TEXT NOT NULL,
 contact_revision TEXT NOT NULL,
 policy_revision TEXT NOT NULL,
 error TEXT,
 created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX conversation_plans_due ON conversation_plans(workspace_id,status);
CREATE TABLE conversation_plan_steps (
 id TEXT PRIMARY KEY,
 plan_id TEXT NOT NULL REFERENCES conversation_plans(id) ON DELETE CASCADE,
 workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
 step_index INTEGER NOT NULL,
 body TEXT NOT NULL,
 subject TEXT NOT NULL,
 days INTEGER NOT NULL,
 scheduled_at TEXT NOT NULL,
 status TEXT NOT NULL DEFAULT 'queued',
 sent_at TEXT,
 attempted_at TEXT,
 gmail_message_id TEXT,
 error TEXT,
 UNIQUE(plan_id,step_index)
);
CREATE INDEX conversation_steps_due ON conversation_plan_steps(status,scheduled_at);
-- Durable CRM outbox: mailbox capture and sending do not depend on CRM availability.
CREATE TABLE conversation_events (
 id TEXT PRIMARY KEY,
 message_id TEXT NOT NULL REFERENCES gmail_messages(id) ON DELETE CASCADE,
 workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
 provider_message_id TEXT NOT NULL,
 direction TEXT NOT NULL,
 body TEXT NOT NULL,
 occurred_at TEXT NOT NULL,
 category TEXT,
 crm_synced_at TEXT,
 ready INTEGER NOT NULL DEFAULT 1 CHECK(ready IN (0,1)),
 UNIQUE(workspace_id,provider_message_id,direction)
);
CREATE INDEX conversation_events_recovery ON conversation_events(message_id,crm_synced_at);
CREATE TABLE conversation_mailbox_locks (
 workspace_id TEXT PRIMARY KEY REFERENCES workspaces(id) ON DELETE CASCADE,
 lock_id TEXT NOT NULL,
 expires_at TEXT NOT NULL
);

-- Reserve metadata before side effects, then account retained text exactly.
CREATE TRIGGER storage_conversation_state_insert AFTER INSERT ON conversation_state BEGIN
 INSERT OR IGNORE INTO workspace_storage_accounts(workspace_id) VALUES(NEW.workspace_id);
 SELECT CASE WHEN EXISTS(SELECT 1 FROM workspace_storage_accounts WHERE workspace_id=NEW.workspace_id AND records_bytes+(2048+length(CAST(NEW.initial_body AS BLOB)))>CASE WHEN plan_key='plus' AND paid_until>unixepoch() THEN plus_records_limit ELSE included_records_limit END) THEN RAISE(ABORT,'WORKSPACE_STORAGE_FULL') END;
 UPDATE workspace_storage_accounts SET records_bytes=records_bytes+(2048+length(CAST(NEW.initial_body AS BLOB))) WHERE workspace_id=NEW.workspace_id;
END;
CREATE TRIGGER storage_conversation_state_update AFTER UPDATE ON conversation_state BEGIN
 SELECT CASE WHEN NEW.workspace_id IS NOT OLD.workspace_id THEN RAISE(ABORT,'WORKSPACE_STORAGE_SCOPE_IMMUTABLE') END;
 SELECT CASE WHEN (2048+length(CAST(NEW.initial_body AS BLOB)))>(2048+length(CAST(OLD.initial_body AS BLOB))) AND EXISTS(SELECT 1 FROM workspace_storage_accounts WHERE workspace_id=NEW.workspace_id AND records_bytes+(2048+length(CAST(NEW.initial_body AS BLOB)))-(2048+length(CAST(OLD.initial_body AS BLOB)))>CASE WHEN plan_key='plus' AND paid_until>unixepoch() THEN plus_records_limit ELSE included_records_limit END) THEN RAISE(ABORT,'WORKSPACE_STORAGE_FULL') END;
 UPDATE workspace_storage_accounts SET records_bytes=records_bytes+(2048+length(CAST(NEW.initial_body AS BLOB)))-(2048+length(CAST(OLD.initial_body AS BLOB))) WHERE workspace_id=NEW.workspace_id;
END;
CREATE TRIGGER storage_conversation_state_delete AFTER DELETE ON conversation_state BEGIN
 UPDATE workspace_storage_accounts SET records_bytes=records_bytes-(2048+length(CAST(OLD.initial_body AS BLOB))) WHERE workspace_id=OLD.workspace_id;
END;

-- Reserve metadata before side effects, then account retained text exactly.
CREATE TRIGGER storage_conversation_plans_insert AFTER INSERT ON conversation_plans BEGIN
 INSERT OR IGNORE INTO workspace_storage_accounts(workspace_id) VALUES(NEW.workspace_id);
 SELECT CASE WHEN EXISTS(SELECT 1 FROM workspace_storage_accounts WHERE workspace_id=NEW.workspace_id AND records_bytes+(2048)>CASE WHEN plan_key='plus' AND paid_until>unixepoch() THEN plus_records_limit ELSE included_records_limit END) THEN RAISE(ABORT,'WORKSPACE_STORAGE_FULL') END;
 UPDATE workspace_storage_accounts SET records_bytes=records_bytes+(2048) WHERE workspace_id=NEW.workspace_id;
END;
CREATE TRIGGER storage_conversation_plans_update AFTER UPDATE ON conversation_plans BEGIN
 SELECT CASE WHEN NEW.workspace_id IS NOT OLD.workspace_id THEN RAISE(ABORT,'WORKSPACE_STORAGE_SCOPE_IMMUTABLE') END;
 SELECT CASE WHEN (2048)>(2048) AND EXISTS(SELECT 1 FROM workspace_storage_accounts WHERE workspace_id=NEW.workspace_id AND records_bytes+(2048)-(2048)>CASE WHEN plan_key='plus' AND paid_until>unixepoch() THEN plus_records_limit ELSE included_records_limit END) THEN RAISE(ABORT,'WORKSPACE_STORAGE_FULL') END;
 UPDATE workspace_storage_accounts SET records_bytes=records_bytes+(2048)-(2048) WHERE workspace_id=NEW.workspace_id;
END;
CREATE TRIGGER storage_conversation_plans_delete AFTER DELETE ON conversation_plans BEGIN
 UPDATE workspace_storage_accounts SET records_bytes=records_bytes-(2048) WHERE workspace_id=OLD.workspace_id;
END;

-- Reserve metadata before side effects, then account retained text exactly.
CREATE TRIGGER storage_conversation_plan_steps_insert AFTER INSERT ON conversation_plan_steps BEGIN
 INSERT OR IGNORE INTO workspace_storage_accounts(workspace_id) VALUES(NEW.workspace_id);
 SELECT CASE WHEN EXISTS(SELECT 1 FROM workspace_storage_accounts WHERE workspace_id=NEW.workspace_id AND records_bytes+(1024+length(CAST(NEW.body AS BLOB))+length(CAST(NEW.subject AS BLOB)))>CASE WHEN plan_key='plus' AND paid_until>unixepoch() THEN plus_records_limit ELSE included_records_limit END) THEN RAISE(ABORT,'WORKSPACE_STORAGE_FULL') END;
 UPDATE workspace_storage_accounts SET records_bytes=records_bytes+(1024+length(CAST(NEW.body AS BLOB))+length(CAST(NEW.subject AS BLOB))) WHERE workspace_id=NEW.workspace_id;
END;
CREATE TRIGGER storage_conversation_plan_steps_update AFTER UPDATE ON conversation_plan_steps BEGIN
 SELECT CASE WHEN NEW.workspace_id IS NOT OLD.workspace_id THEN RAISE(ABORT,'WORKSPACE_STORAGE_SCOPE_IMMUTABLE') END;
 SELECT CASE WHEN (1024+length(CAST(NEW.body AS BLOB))+length(CAST(NEW.subject AS BLOB)))>(1024+length(CAST(OLD.body AS BLOB))+length(CAST(OLD.subject AS BLOB))) AND EXISTS(SELECT 1 FROM workspace_storage_accounts WHERE workspace_id=NEW.workspace_id AND records_bytes+(1024+length(CAST(NEW.body AS BLOB))+length(CAST(NEW.subject AS BLOB)))-(1024+length(CAST(OLD.body AS BLOB))+length(CAST(OLD.subject AS BLOB)))>CASE WHEN plan_key='plus' AND paid_until>unixepoch() THEN plus_records_limit ELSE included_records_limit END) THEN RAISE(ABORT,'WORKSPACE_STORAGE_FULL') END;
 UPDATE workspace_storage_accounts SET records_bytes=records_bytes+(1024+length(CAST(NEW.body AS BLOB))+length(CAST(NEW.subject AS BLOB)))-(1024+length(CAST(OLD.body AS BLOB))+length(CAST(OLD.subject AS BLOB))) WHERE workspace_id=NEW.workspace_id;
END;
CREATE TRIGGER storage_conversation_plan_steps_delete AFTER DELETE ON conversation_plan_steps BEGIN
 UPDATE workspace_storage_accounts SET records_bytes=records_bytes-(1024+length(CAST(OLD.body AS BLOB))+length(CAST(OLD.subject AS BLOB))) WHERE workspace_id=OLD.workspace_id;
END;

-- Reserve metadata before side effects, then account retained text exactly.
CREATE TRIGGER storage_conversation_events_insert AFTER INSERT ON conversation_events BEGIN
 INSERT OR IGNORE INTO workspace_storage_accounts(workspace_id) VALUES(NEW.workspace_id);
 SELECT CASE WHEN EXISTS(SELECT 1 FROM workspace_storage_accounts WHERE workspace_id=NEW.workspace_id AND records_bytes+(1024+length(CAST(NEW.body AS BLOB)))>CASE WHEN plan_key='plus' AND paid_until>unixepoch() THEN plus_records_limit ELSE included_records_limit END) THEN RAISE(ABORT,'WORKSPACE_STORAGE_FULL') END;
 UPDATE workspace_storage_accounts SET records_bytes=records_bytes+(1024+length(CAST(NEW.body AS BLOB))) WHERE workspace_id=NEW.workspace_id;
END;
CREATE TRIGGER storage_conversation_events_update AFTER UPDATE ON conversation_events BEGIN
 SELECT CASE WHEN NEW.workspace_id IS NOT OLD.workspace_id THEN RAISE(ABORT,'WORKSPACE_STORAGE_SCOPE_IMMUTABLE') END;
 SELECT CASE WHEN (1024+length(CAST(NEW.body AS BLOB)))>(1024+length(CAST(OLD.body AS BLOB))) AND EXISTS(SELECT 1 FROM workspace_storage_accounts WHERE workspace_id=NEW.workspace_id AND records_bytes+(1024+length(CAST(NEW.body AS BLOB)))-(1024+length(CAST(OLD.body AS BLOB)))>CASE WHEN plan_key='plus' AND paid_until>unixepoch() THEN plus_records_limit ELSE included_records_limit END) THEN RAISE(ABORT,'WORKSPACE_STORAGE_FULL') END;
 UPDATE workspace_storage_accounts SET records_bytes=records_bytes+(1024+length(CAST(NEW.body AS BLOB)))-(1024+length(CAST(OLD.body AS BLOB))) WHERE workspace_id=NEW.workspace_id;
END;
CREATE TRIGGER storage_conversation_events_delete AFTER DELETE ON conversation_events BEGIN
 UPDATE workspace_storage_accounts SET records_bytes=records_bytes-(1024+length(CAST(OLD.body AS BLOB))) WHERE workspace_id=OLD.workspace_id;
END;

CREATE TRIGGER storage_gmail_reply_authored_insert AFTER INSERT ON gmail_replies WHEN NEW.authored_text IS NOT NULL BEGIN
 INSERT OR IGNORE INTO workspace_storage_accounts(workspace_id) VALUES(NEW.workspace_id);
 SELECT CASE WHEN EXISTS(SELECT 1 FROM workspace_storage_accounts WHERE workspace_id=NEW.workspace_id AND records_bytes+length(CAST(NEW.authored_text AS BLOB))>CASE WHEN plan_key='plus' AND paid_until>unixepoch() THEN plus_records_limit ELSE included_records_limit END) THEN RAISE(ABORT,'WORKSPACE_STORAGE_FULL') END;
 UPDATE workspace_storage_accounts SET records_bytes=records_bytes+length(CAST(NEW.authored_text AS BLOB)) WHERE workspace_id=NEW.workspace_id;
END;
CREATE TRIGGER storage_gmail_reply_authored_update AFTER UPDATE OF authored_text ON gmail_replies BEGIN
 SELECT CASE WHEN COALESCE(length(CAST(NEW.authored_text AS BLOB)),0)>COALESCE(length(CAST(OLD.authored_text AS BLOB)),0) AND EXISTS(SELECT 1 FROM workspace_storage_accounts WHERE workspace_id=NEW.workspace_id AND records_bytes+COALESCE(length(CAST(NEW.authored_text AS BLOB)),0)-COALESCE(length(CAST(OLD.authored_text AS BLOB)),0)>CASE WHEN plan_key='plus' AND paid_until>unixepoch() THEN plus_records_limit ELSE included_records_limit END) THEN RAISE(ABORT,'WORKSPACE_STORAGE_FULL') END;
 UPDATE workspace_storage_accounts SET records_bytes=records_bytes+COALESCE(length(CAST(NEW.authored_text AS BLOB)),0)-COALESCE(length(CAST(OLD.authored_text AS BLOB)),0) WHERE workspace_id=NEW.workspace_id;
END;
CREATE TRIGGER storage_gmail_reply_authored_delete AFTER DELETE ON gmail_replies BEGIN
 UPDATE workspace_storage_accounts SET records_bytes=records_bytes-COALESCE(length(CAST(OLD.authored_text AS BLOB)),0) WHERE workspace_id=OLD.workspace_id;
END;
