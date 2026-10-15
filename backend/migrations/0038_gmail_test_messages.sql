-- Test sends have their own ledger; never included in campaign delivery/reply queries.
CREATE TABLE gmail_test_messages (
 id TEXT PRIMARY KEY,
 workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
 user_id TEXT NOT NULL REFERENCES users(id),
 idempotency_key TEXT NOT NULL, request_hash TEXT NOT NULL,
 recipient TEXT NOT NULL, subject TEXT NOT NULL,
 status TEXT NOT NULL CHECK(status IN ('sending','sent','failed')),
 gmail_message_id TEXT, sent_at TEXT,
 created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
 UNIQUE(workspace_id,user_id,idempotency_key)
);
-- Reserve a fixed 2 KB metadata budget before Gmail is called, so recording
-- a provider-confirmed result never fails merely because storage became full.
CREATE TRIGGER storage_gmail_test_insert AFTER INSERT ON gmail_test_messages BEGIN
 INSERT OR IGNORE INTO workspace_storage_accounts(workspace_id) VALUES(NEW.workspace_id);
 SELECT CASE WHEN EXISTS(SELECT 1 FROM workspace_storage_accounts WHERE workspace_id=NEW.workspace_id AND records_bytes+2048>CASE WHEN plan_key='plus' AND paid_until>unixepoch() THEN plus_records_limit ELSE included_records_limit END) THEN RAISE(ABORT,'WORKSPACE_STORAGE_FULL') END;
 UPDATE workspace_storage_accounts SET records_bytes=records_bytes+2048 WHERE workspace_id=NEW.workspace_id;
END;
CREATE TRIGGER storage_gmail_test_scope BEFORE UPDATE ON gmail_test_messages BEGIN
 SELECT CASE WHEN NEW.workspace_id IS NOT OLD.workspace_id OR NEW.user_id IS NOT OLD.user_id THEN RAISE(ABORT,'WORKSPACE_STORAGE_SCOPE_IMMUTABLE') END;
END;
CREATE TRIGGER storage_gmail_test_delete AFTER DELETE ON gmail_test_messages BEGIN
 UPDATE workspace_storage_accounts SET records_bytes=records_bytes-2048 WHERE workspace_id=OLD.workspace_id;
END;
