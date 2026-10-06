CREATE TABLE writing_reference_workspaces (
 workspace_id TEXT PRIMARY KEY REFERENCES workspaces(id), revision INTEGER NOT NULL DEFAULT 0
);
CREATE TABLE writing_reference_slots (
 workspace_id TEXT NOT NULL REFERENCES workspaces(id), slot INTEGER NOT NULL CHECK(slot BETWEEN 1 AND 3),
 source_id TEXT, revision INTEGER NOT NULL DEFAULT 0, PRIMARY KEY(workspace_id,slot)
);
CREATE TABLE writing_reference_sources (
 id TEXT PRIMARY KEY, workspace_id TEXT NOT NULL REFERENCES workspaces(id), slot INTEGER NOT NULL CHECK(slot BETWEEN 1 AND 3),
 revision INTEGER NOT NULL DEFAULT 1, filename TEXT NOT NULL, mime TEXT NOT NULL, content_hash TEXT NOT NULL,
 original_key TEXT NOT NULL, text_key TEXT NOT NULL, status TEXT NOT NULL,
 active INTEGER NOT NULL DEFAULT 0 CHECK(active IN (0,1)), instruction TEXT NOT NULL DEFAULT '',
 coverage_json TEXT NOT NULL, summary TEXT NOT NULL DEFAULT '', techniques_json TEXT NOT NULL DEFAULT '[]',
 error_code TEXT NOT NULL DEFAULT '', catalogue_key TEXT NOT NULL DEFAULT '', created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
 updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX writing_reference_scope ON writing_reference_sources(workspace_id,status);
CREATE TABLE writing_reference_chunks (
 source_id TEXT NOT NULL REFERENCES writing_reference_sources(id), chunk_id TEXT NOT NULL,
 status TEXT NOT NULL DEFAULT 'Pending', attempts INTEGER NOT NULL DEFAULT 0,
 techniques_json TEXT NOT NULL DEFAULT '[]', PRIMARY KEY(source_id,chunk_id)
);
CREATE TABLE writing_reference_jobs (
 source_id TEXT PRIMARY KEY REFERENCES writing_reference_sources(id), workspace_id TEXT NOT NULL,
 state TEXT NOT NULL DEFAULT 'Pending', lease_id TEXT, lease_until INTEGER NOT NULL DEFAULT 0,
 attempts INTEGER NOT NULL DEFAULT 0, next_at INTEGER NOT NULL DEFAULT 0
);
CREATE TABLE writing_reference_uploads (
 id TEXT PRIMARY KEY, workspace_id TEXT NOT NULL, source_id TEXT NOT NULL,
 original_key TEXT NOT NULL, text_key TEXT NOT NULL, expires_at INTEGER NOT NULL
);
CREATE TABLE writing_reference_upload_tickets (
 token_hash TEXT PRIMARY KEY, workspace_id TEXT NOT NULL, user_id TEXT NOT NULL,
 slot INTEGER NOT NULL, expected_revision INTEGER NOT NULL, expected_source_id TEXT,
 expected_slot_revision INTEGER NOT NULL, expires_at INTEGER NOT NULL
);
