-- Status checks find the latest billing evidence within one workspace/provider.
-- Equality keys preserve SQLite's implicit rowid order and avoid sorting/scanning
-- the entire workspace audit history for every configured provider.
CREATE INDEX IF NOT EXISTS audit_provider_health_idx
 ON audit_events(workspace_id,entity_type,entity_id);
