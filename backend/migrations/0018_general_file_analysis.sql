PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS copilot_files (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  created_by TEXT REFERENCES users(id) ON DELETE SET NULL,
  original_name TEXT NOT NULL,
  extension TEXT NOT NULL,
  mime_type TEXT NOT NULL,
  byte_size INTEGER NOT NULL CHECK (byte_size >= 0),
  sha256 TEXT NOT NULL,
  r2_key TEXT NOT NULL UNIQUE,
  extraction_status TEXT NOT NULL DEFAULT 'pending' CHECK (extraction_status IN ('pending','complete','partial','failed','deleting')),
  coverage_json TEXT NOT NULL DEFAULT '{}' CHECK (json_valid(coverage_json)),
  warnings_json TEXT NOT NULL DEFAULT '[]' CHECK (json_valid(warnings_json)),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  deleted_at TEXT,
  UNIQUE(id,workspace_id)
);
CREATE INDEX IF NOT EXISTS copilot_files_workspace_created_idx
  ON copilot_files(workspace_id,created_at DESC);
CREATE INDEX IF NOT EXISTS copilot_files_expiry_idx
  ON copilot_files(created_at,id,workspace_id) WHERE deleted_at IS NULL;

CREATE TABLE IF NOT EXISTS copilot_file_extractions (
  file_id TEXT PRIMARY KEY REFERENCES copilot_files(id) ON DELETE CASCADE,
  blocks_json TEXT NOT NULL CHECK (json_valid(blocks_json)),
  evidence_index_json TEXT NOT NULL CHECK (json_valid(evidence_index_json)),
  character_count INTEGER NOT NULL DEFAULT 0 CHECK (character_count >= 0),
  cell_count INTEGER NOT NULL DEFAULT 0 CHECK (cell_count >= 0),
  extractor_version TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS copilot_file_analyses (
  id TEXT PRIMARY KEY,
  file_id TEXT NOT NULL,
  workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  created_by TEXT REFERENCES users(id) ON DELETE SET NULL,
  request TEXT NOT NULL,
  canonical_result_json TEXT NOT NULL DEFAULT '{}' CHECK (json_valid(canonical_result_json)),
  provider TEXT NOT NULL DEFAULT '',
  model TEXT NOT NULL DEFAULT '',
  usage_json TEXT NOT NULL DEFAULT '{}' CHECK (json_valid(usage_json)),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','running','completed','failed','deleting')),
  retained INTEGER NOT NULL DEFAULT 0 CHECK (retained IN (0,1)),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  retained_at TEXT,
  deleted_at TEXT,
  FOREIGN KEY(file_id,workspace_id) REFERENCES copilot_files(id,workspace_id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS copilot_file_analyses_workspace_retained_idx
  ON copilot_file_analyses(workspace_id,retained,updated_at DESC);
CREATE INDEX IF NOT EXISTS copilot_file_analyses_file_idx
  ON copilot_file_analyses(file_id,created_at DESC);
CREATE INDEX IF NOT EXISTS copilot_file_analyses_cleanup_idx
  ON copilot_file_analyses(file_id,retained) WHERE deleted_at IS NULL;

CREATE TABLE IF NOT EXISTS copilot_file_analysis_messages (
  id TEXT PRIMARY KEY,
  analysis_id TEXT NOT NULL REFERENCES copilot_file_analyses(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('user','assistant')),
  content TEXT NOT NULL,
  evidence_json TEXT NOT NULL DEFAULT '[]' CHECK (json_valid(evidence_json)),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS copilot_file_analysis_messages_analysis_idx
  ON copilot_file_analysis_messages(analysis_id,created_at);
