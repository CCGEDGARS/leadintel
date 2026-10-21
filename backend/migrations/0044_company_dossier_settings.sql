CREATE TABLE IF NOT EXISTS workspace_research_settings (
 workspace_id TEXT PRIMARY KEY REFERENCES workspaces(id) ON DELETE CASCADE,
 primary_provider TEXT CHECK(primary_provider IN ('openai','anthropic','gemini')),
 secondary_provider TEXT CHECK(secondary_provider IN ('openai','anthropic','gemini')),
 updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS workspace_company_dossiers (
 workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
 domain TEXT NOT NULL,
 context_key TEXT NOT NULL,
 payload_json TEXT NOT NULL,
 successful_json TEXT,
 updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
 PRIMARY KEY(workspace_id,domain)
);
