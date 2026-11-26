CREATE TABLE workspace_research_settings_next (
 workspace_id TEXT PRIMARY KEY REFERENCES workspaces(id) ON DELETE CASCADE,
 primary_provider TEXT CHECK(primary_provider IN ('openai','anthropic','gemini','perplexity')),
 secondary_provider TEXT CHECK(secondary_provider IN ('openai','anthropic','gemini','perplexity')),
 updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

INSERT INTO workspace_research_settings_next(workspace_id,primary_provider,secondary_provider,updated_at)
 SELECT workspace_id,primary_provider,secondary_provider,updated_at FROM workspace_research_settings;
DROP TABLE workspace_research_settings;
ALTER TABLE workspace_research_settings_next RENAME TO workspace_research_settings;
