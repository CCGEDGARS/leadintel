-- Legacy flows retain their shared-settings contract until the owner explicitly
-- saves a protected version. New flows use independent snapshots.
ALTER TABLE saved_flows ADD COLUMN snapshot_policy TEXT NOT NULL DEFAULT 'legacy_shared' CHECK(snapshot_policy IN ('legacy_shared','pinned'));
ALTER TABLE saved_flows ADD COLUMN latest_version INTEGER NOT NULL DEFAULT 0;
CREATE TABLE saved_flow_versions (
 workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
 flow_id TEXT NOT NULL REFERENCES saved_flows(id) ON DELETE CASCADE,
 version INTEGER NOT NULL CHECK(version>0),
 name TEXT NOT NULL,
 payload_json TEXT NOT NULL CHECK(json_valid(payload_json)),
 config_json TEXT NOT NULL CHECK(json_valid(config_json)),
 created_by TEXT NOT NULL REFERENCES users(id),
 created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
 PRIMARY KEY(flow_id,version)
);
CREATE INDEX saved_flow_versions_workspace ON saved_flow_versions(workspace_id,flow_id,version);
CREATE TRIGGER saved_flow_version_scope BEFORE INSERT ON saved_flow_versions
WHEN NOT EXISTS(SELECT 1 FROM saved_flows WHERE id=NEW.flow_id AND workspace_id=NEW.workspace_id)
BEGIN SELECT RAISE(ABORT,'Saved workflow version workspace mismatch'); END;
CREATE TRIGGER saved_flow_version_immutable BEFORE UPDATE ON saved_flow_versions
BEGIN SELECT RAISE(ABORT,'Saved workflow versions are immutable'); END;
