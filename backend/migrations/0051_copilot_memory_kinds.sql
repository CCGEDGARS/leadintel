-- Ask LeadIntel remembers more than decisions (CTO, 2026-10-25): durable facts the person states and reminders with a due date.
-- SQLite cannot widen a CHECK constraint in place, so the table is rebuilt (it held 0 rows in production on 2026-10-25) and the
-- storage accounting triggers from 0031 are restored verbatim afterwards.
CREATE TABLE copilot_memories_v2 (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  kind TEXT NOT NULL CHECK (kind IN ('decision','preference','constraint','fact','reminder')),
  fingerprint TEXT NOT NULL,
  value_json TEXT NOT NULL CHECK (json_valid(value_json)),
  due_at TEXT,
  created_by TEXT REFERENCES users(id) ON DELETE SET NULL,
  source_conversation_id TEXT REFERENCES copilot_conversations(id) ON DELETE SET NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  archived_at TEXT,
  UNIQUE(workspace_id,fingerprint)
);
INSERT INTO copilot_memories_v2(id,workspace_id,kind,fingerprint,value_json,created_by,source_conversation_id,created_at,updated_at,archived_at)
  SELECT id,workspace_id,kind,fingerprint,value_json,created_by,source_conversation_id,created_at,updated_at,archived_at FROM copilot_memories;
DROP TRIGGER IF EXISTS storage_copilot_memories_insert;
DROP TRIGGER IF EXISTS storage_copilot_memories_update;
DROP TRIGGER IF EXISTS storage_copilot_memories_delete;
DROP TABLE copilot_memories;
ALTER TABLE copilot_memories_v2 RENAME TO copilot_memories;
CREATE INDEX IF NOT EXISTS copilot_memories_workspace_idx ON copilot_memories(workspace_id,archived_at,updated_at DESC);
CREATE INDEX IF NOT EXISTS copilot_memories_due_idx ON copilot_memories(workspace_id,due_at);
CREATE TRIGGER storage_copilot_memories_insert AFTER INSERT ON copilot_memories BEGIN
 INSERT OR IGNORE INTO workspace_storage_accounts(workspace_id) VALUES(NEW.workspace_id);
 SELECT CASE WHEN (COALESCE(length(CAST(NEW."kind" AS BLOB)),0)+COALESCE(length(CAST(NEW."fingerprint" AS BLOB)),0)+COALESCE(length(CAST(NEW."value_json" AS BLOB)),0))>0 AND EXISTS(SELECT 1 FROM workspace_storage_accounts WHERE workspace_id=NEW.workspace_id AND records_bytes+(COALESCE(length(CAST(NEW."kind" AS BLOB)),0)+COALESCE(length(CAST(NEW."fingerprint" AS BLOB)),0)+COALESCE(length(CAST(NEW."value_json" AS BLOB)),0))>(CASE WHEN plan_key='plus' AND paid_until>unixepoch() THEN plus_records_limit ELSE included_records_limit END)) THEN RAISE(ABORT,'WORKSPACE_STORAGE_FULL') END;
 UPDATE workspace_storage_accounts SET records_bytes=records_bytes+(COALESCE(length(CAST(NEW."kind" AS BLOB)),0)+COALESCE(length(CAST(NEW."fingerprint" AS BLOB)),0)+COALESCE(length(CAST(NEW."value_json" AS BLOB)),0)) WHERE workspace_id=NEW.workspace_id;
END;
CREATE TRIGGER storage_copilot_memories_update AFTER UPDATE ON copilot_memories BEGIN
 SELECT CASE WHEN NEW.workspace_id IS NOT OLD.workspace_id THEN RAISE(ABORT,'WORKSPACE_STORAGE_SCOPE_IMMUTABLE') END;
 SELECT CASE WHEN NOT(0) AND (COALESCE(length(CAST(NEW."kind" AS BLOB)),0)+COALESCE(length(CAST(NEW."fingerprint" AS BLOB)),0)+COALESCE(length(CAST(NEW."value_json" AS BLOB)),0))>(COALESCE(length(CAST(OLD."kind" AS BLOB)),0)+COALESCE(length(CAST(OLD."fingerprint" AS BLOB)),0)+COALESCE(length(CAST(OLD."value_json" AS BLOB)),0)) AND EXISTS(SELECT 1 FROM workspace_storage_accounts WHERE workspace_id=NEW.workspace_id AND records_bytes+(COALESCE(length(CAST(NEW."kind" AS BLOB)),0)+COALESCE(length(CAST(NEW."fingerprint" AS BLOB)),0)+COALESCE(length(CAST(NEW."value_json" AS BLOB)),0))-(COALESCE(length(CAST(OLD."kind" AS BLOB)),0)+COALESCE(length(CAST(OLD."fingerprint" AS BLOB)),0)+COALESCE(length(CAST(OLD."value_json" AS BLOB)),0))>(CASE WHEN plan_key='plus' AND paid_until>unixepoch() THEN plus_records_limit ELSE included_records_limit END)) THEN RAISE(ABORT,'WORKSPACE_STORAGE_FULL') END;
 UPDATE workspace_storage_accounts SET records_bytes=records_bytes+(COALESCE(length(CAST(NEW."kind" AS BLOB)),0)+COALESCE(length(CAST(NEW."fingerprint" AS BLOB)),0)+COALESCE(length(CAST(NEW."value_json" AS BLOB)),0))-(COALESCE(length(CAST(OLD."kind" AS BLOB)),0)+COALESCE(length(CAST(OLD."fingerprint" AS BLOB)),0)+COALESCE(length(CAST(OLD."value_json" AS BLOB)),0)) WHERE workspace_id=NEW.workspace_id;
END;
CREATE TRIGGER storage_copilot_memories_delete AFTER DELETE ON copilot_memories BEGIN
 UPDATE workspace_storage_accounts SET records_bytes=records_bytes-(COALESCE(length(CAST(OLD."kind" AS BLOB)),0)+COALESCE(length(CAST(OLD."fingerprint" AS BLOB)),0)+COALESCE(length(CAST(OLD."value_json" AS BLOB)),0)) WHERE workspace_id=OLD.workspace_id;
END;
