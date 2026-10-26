CREATE TABLE company_materials (
 id TEXT PRIMARY KEY,
 workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
 filename TEXT NOT NULL,
 mime TEXT NOT NULL,
 kind TEXT NOT NULL CHECK(kind IN ('pdf','image')),
 byte_size INTEGER NOT NULL,
 digest TEXT NOT NULL,
 original_key TEXT NOT NULL,
 text_key TEXT NOT NULL,
 status TEXT NOT NULL DEFAULT 'Uploading' CHECK(status IN ('Uploading','Processing','Ready','Needs attention','Deleting')),
 analysis_json TEXT NOT NULL DEFAULT '{}',
 error TEXT NOT NULL DEFAULT '',
 revision INTEGER NOT NULL DEFAULT 1,
 lease_token TEXT,
 lease_until INTEGER NOT NULL DEFAULT 0,
 created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
 updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
 UNIQUE(workspace_id,digest)
);
CREATE INDEX company_material_jobs ON company_materials(status,lease_until);
CREATE INDEX company_material_workspace ON company_materials(workspace_id);
CREATE TABLE company_material_upload_tickets (
 token_hash TEXT PRIMARY KEY,
 workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
 user_id TEXT NOT NULL,
 expires_at INTEGER NOT NULL
);
