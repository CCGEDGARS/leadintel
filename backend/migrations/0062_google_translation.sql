-- Cloud Translation is a separate optional workspace-owned connection.
-- Never reuse Gemini, Gmail OAuth or a global translation API key.
CREATE TABLE IF NOT EXISTS workspace_google_translation_integrations (
 workspace_id TEXT PRIMARY KEY REFERENCES workspaces(id) ON DELETE CASCADE,
 encrypted_api_key TEXT NOT NULL,
 configured_by TEXT REFERENCES users(id) ON DELETE SET NULL,
 verified_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
 last_used_at TEXT,
 created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
 updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
