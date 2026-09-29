CREATE TABLE workspace_service_integrations_next (
  workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  provider TEXT NOT NULL CHECK (provider IN ('apollo','firecrawl','hunter')),
  encrypted_api_key TEXT NOT NULL,
  key_hint TEXT NOT NULL,
  metadata_json TEXT NOT NULL DEFAULT '{}',
  verified_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  last_used_at TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (workspace_id, provider)
);

INSERT INTO workspace_service_integrations_next
  (workspace_id,provider,encrypted_api_key,key_hint,metadata_json,verified_at,last_used_at,created_at,updated_at)
SELECT workspace_id,provider,encrypted_api_key,key_hint,metadata_json,verified_at,last_used_at,created_at,updated_at
FROM workspace_service_integrations;

DROP TABLE workspace_service_integrations;
ALTER TABLE workspace_service_integrations_next RENAME TO workspace_service_integrations;
CREATE INDEX workspace_service_integrations_workspace_idx
  ON workspace_service_integrations(workspace_id, updated_at DESC);
