-- Existing workspaces retain per-run approval for metered public buyer research.
ALTER TABLE workspace_research_settings ADD COLUMN full_research_policy TEXT NOT NULL DEFAULT 'ask'
 CHECK(full_research_policy IN ('ask','free_only'));
