PRAGMA foreign_keys = ON;
CREATE TABLE buyer_research_jobs (
 id TEXT PRIMARY KEY,
 workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
 requested_by TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
 session_hash TEXT NOT NULL,
 domain TEXT NOT NULL,
 context_key TEXT NOT NULL,
 input_json TEXT NOT NULL CHECK(json_valid(input_json)),
 result_json TEXT NOT NULL DEFAULT '{}' CHECK(json_valid(result_json)),
 status TEXT NOT NULL DEFAULT 'queued' CHECK(status IN ('queued','running','needs_review','complete','failed','canceled')),
 phase TEXT NOT NULL DEFAULT 'official',
 last_error TEXT NOT NULL DEFAULT '',
 revision INTEGER NOT NULL DEFAULT 1,
 phase_ms INTEGER NOT NULL DEFAULT 0,
 phase_runs INTEGER NOT NULL DEFAULT 0,
 lease_token TEXT,
 lease_until INTEGER NOT NULL DEFAULT 0,
 next_at INTEGER NOT NULL DEFAULT 0,
 diagnostic_json TEXT NOT NULL DEFAULT '[]' CHECK(json_valid(diagnostic_json)),
 created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
 updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX buyer_research_one_active ON buyer_research_jobs(workspace_id,domain) WHERE status IN ('queued','running');
CREATE INDEX buyer_research_due ON buyer_research_jobs(status,next_at,lease_until);
CREATE INDEX buyer_research_workspace ON buyer_research_jobs(workspace_id,domain,created_at DESC);
CREATE TABLE buyer_research_tasks (
 job_id TEXT NOT NULL REFERENCES buyer_research_jobs(id) ON DELETE CASCADE,
 task_key TEXT NOT NULL,
 phase TEXT NOT NULL DEFAULT '',
 request_value TEXT NOT NULL DEFAULT '',
 kind TEXT NOT NULL CHECK(kind IN ('search','read','independent')),
 status TEXT NOT NULL CHECK(status IN ('running','complete','failed')),
 attempts INTEGER NOT NULL DEFAULT 0,
 result_json TEXT NOT NULL DEFAULT '{}' CHECK(json_valid(result_json)),
 error TEXT NOT NULL DEFAULT '',
 updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
 PRIMARY KEY(job_id,task_key)
);

-- Meter logical job content through the existing workspace record allowance.
CREATE TRIGGER storage_buyer_research_jobs_insert AFTER INSERT ON buyer_research_jobs BEGIN
 INSERT OR IGNORE INTO workspace_storage_accounts(workspace_id) VALUES(NEW.workspace_id);
 SELECT CASE WHEN EXISTS(SELECT 1 FROM workspace_storage_accounts WHERE workspace_id=NEW.workspace_id AND records_bytes+(length(CAST(NEW.input_json AS BLOB))+length(CAST(NEW.result_json AS BLOB))+length(CAST(NEW.diagnostic_json AS BLOB)))>CASE WHEN plan_key='plus' AND paid_until>unixepoch() THEN plus_records_limit ELSE included_records_limit END) THEN RAISE(ABORT,'WORKSPACE_STORAGE_FULL') END;
 UPDATE workspace_storage_accounts SET records_bytes=records_bytes+(length(CAST(NEW.input_json AS BLOB))+length(CAST(NEW.result_json AS BLOB))+length(CAST(NEW.diagnostic_json AS BLOB))) WHERE workspace_id=NEW.workspace_id;
END;
CREATE TRIGGER storage_buyer_research_jobs_update AFTER UPDATE ON buyer_research_jobs BEGIN
 SELECT CASE WHEN (length(CAST(NEW.input_json AS BLOB))+length(CAST(NEW.result_json AS BLOB))+length(CAST(NEW.diagnostic_json AS BLOB)))>(length(CAST(OLD.input_json AS BLOB))+length(CAST(OLD.result_json AS BLOB))+length(CAST(OLD.diagnostic_json AS BLOB))) AND EXISTS(SELECT 1 FROM workspace_storage_accounts WHERE workspace_id=NEW.workspace_id AND records_bytes+(length(CAST(NEW.input_json AS BLOB))+length(CAST(NEW.result_json AS BLOB))+length(CAST(NEW.diagnostic_json AS BLOB)))-(length(CAST(OLD.input_json AS BLOB))+length(CAST(OLD.result_json AS BLOB))+length(CAST(OLD.diagnostic_json AS BLOB)))>CASE WHEN plan_key='plus' AND paid_until>unixepoch() THEN plus_records_limit ELSE included_records_limit END) THEN RAISE(ABORT,'WORKSPACE_STORAGE_FULL') END;
 UPDATE workspace_storage_accounts SET records_bytes=records_bytes+(length(CAST(NEW.input_json AS BLOB))+length(CAST(NEW.result_json AS BLOB))+length(CAST(NEW.diagnostic_json AS BLOB)))-(length(CAST(OLD.input_json AS BLOB))+length(CAST(OLD.result_json AS BLOB))+length(CAST(OLD.diagnostic_json AS BLOB))) WHERE workspace_id=NEW.workspace_id;
END;
CREATE TRIGGER storage_buyer_research_jobs_delete AFTER DELETE ON buyer_research_jobs BEGIN
 UPDATE workspace_storage_accounts SET records_bytes=records_bytes-(length(CAST(OLD.input_json AS BLOB))+length(CAST(OLD.result_json AS BLOB))+length(CAST(OLD.diagnostic_json AS BLOB))) WHERE workspace_id=OLD.workspace_id;
END;

-- Meter logical job content through the existing workspace record allowance.
CREATE TRIGGER storage_buyer_research_tasks_insert AFTER INSERT ON buyer_research_tasks BEGIN
 INSERT OR IGNORE INTO workspace_storage_accounts(workspace_id) VALUES((SELECT workspace_id FROM buyer_research_jobs WHERE id=NEW.job_id));
 SELECT CASE WHEN EXISTS(SELECT 1 FROM workspace_storage_accounts WHERE workspace_id=(SELECT workspace_id FROM buyer_research_jobs WHERE id=NEW.job_id) AND records_bytes+(length(CAST(NEW.result_json AS BLOB))+length(CAST(NEW.error AS BLOB))+length(CAST(NEW.request_value AS BLOB)))>CASE WHEN plan_key='plus' AND paid_until>unixepoch() THEN plus_records_limit ELSE included_records_limit END) THEN RAISE(ABORT,'WORKSPACE_STORAGE_FULL') END;
 UPDATE workspace_storage_accounts SET records_bytes=records_bytes+(length(CAST(NEW.result_json AS BLOB))+length(CAST(NEW.error AS BLOB))+length(CAST(NEW.request_value AS BLOB))) WHERE workspace_id=(SELECT workspace_id FROM buyer_research_jobs WHERE id=NEW.job_id);
END;
CREATE TRIGGER storage_buyer_research_tasks_update AFTER UPDATE ON buyer_research_tasks BEGIN
 SELECT CASE WHEN (length(CAST(NEW.result_json AS BLOB))+length(CAST(NEW.error AS BLOB))+length(CAST(NEW.request_value AS BLOB)))>(length(CAST(OLD.result_json AS BLOB))+length(CAST(OLD.error AS BLOB))+length(CAST(OLD.request_value AS BLOB))) AND EXISTS(SELECT 1 FROM workspace_storage_accounts WHERE workspace_id=(SELECT workspace_id FROM buyer_research_jobs WHERE id=NEW.job_id) AND records_bytes+(length(CAST(NEW.result_json AS BLOB))+length(CAST(NEW.error AS BLOB))+length(CAST(NEW.request_value AS BLOB)))-(length(CAST(OLD.result_json AS BLOB))+length(CAST(OLD.error AS BLOB))+length(CAST(OLD.request_value AS BLOB)))>CASE WHEN plan_key='plus' AND paid_until>unixepoch() THEN plus_records_limit ELSE included_records_limit END) THEN RAISE(ABORT,'WORKSPACE_STORAGE_FULL') END;
 UPDATE workspace_storage_accounts SET records_bytes=records_bytes+(length(CAST(NEW.result_json AS BLOB))+length(CAST(NEW.error AS BLOB))+length(CAST(NEW.request_value AS BLOB)))-(length(CAST(OLD.result_json AS BLOB))+length(CAST(OLD.error AS BLOB))+length(CAST(OLD.request_value AS BLOB))) WHERE workspace_id=(SELECT workspace_id FROM buyer_research_jobs WHERE id=NEW.job_id);
END;
CREATE TRIGGER storage_buyer_research_tasks_delete AFTER DELETE ON buyer_research_tasks BEGIN
 UPDATE workspace_storage_accounts SET records_bytes=records_bytes-(length(CAST(OLD.result_json AS BLOB))+length(CAST(OLD.error AS BLOB))+length(CAST(OLD.request_value AS BLOB))) WHERE workspace_id=(SELECT workspace_id FROM buyer_research_jobs WHERE id=OLD.job_id);
END;

-- Delete task content while its parent still exists so cascaded cleanup is metered.
CREATE TRIGGER buyer_job_task_cleanup BEFORE DELETE ON buyer_research_jobs BEGIN
 DELETE FROM buyer_research_tasks WHERE job_id=OLD.id;
END;
