CREATE TABLE IF NOT EXISTS customer_brand_assets (
  id TEXT PRIMARY KEY NOT NULL CHECK(length(id) = 43),
  workspace_id TEXT NOT NULL,
  validation TEXT NOT NULL,
  mime_type TEXT NOT NULL,
  byte_size INTEGER NOT NULL CHECK(byte_size > 0 AND byte_size <= 5242880),
  width INTEGER NOT NULL CHECK(width > 0 AND width <= 6000),
  height INTEGER NOT NULL CHECK(height > 0 AND height <= 6000),
  content_sha256 TEXT NOT NULL CHECK(length(content_sha256) = 64),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_customer_brand_assets_workspace
  ON customer_brand_assets(workspace_id, id);

CREATE TABLE IF NOT EXISTS customer_brand_asset_chunks (
  asset_id TEXT NOT NULL,
  chunk_index INTEGER NOT NULL CHECK(chunk_index >= 0),
  chunk_data BLOB NOT NULL,
  PRIMARY KEY (asset_id, chunk_index),
  FOREIGN KEY (asset_id) REFERENCES customer_brand_assets(id) ON DELETE CASCADE
);
