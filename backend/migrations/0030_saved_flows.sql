CREATE TABLE saved_flows (
 id TEXT PRIMARY KEY,
 workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
 name TEXT NOT NULL,
 state_version INTEGER NOT NULL DEFAULT 1,
 payload_json TEXT NOT NULL DEFAULT '{}' CHECK(json_valid(payload_json)),
 shared_hash TEXT NOT NULL DEFAULT '',
 review_json TEXT NOT NULL DEFAULT '[]' CHECK(json_valid(review_json)),
 revision INTEGER NOT NULL DEFAULT 1,
 status TEXT NOT NULL DEFAULT 'paused' CHECK(status IN ('manual','automatic','paused','stopped','needs_review')),
 config_json TEXT NOT NULL DEFAULT '{}' CHECK(json_valid(config_json)),
 approvals_json TEXT NOT NULL DEFAULT '{}' CHECK(json_valid(approvals_json)),
 context_hash TEXT NOT NULL DEFAULT '',
 approved_by TEXT REFERENCES users(id) ON DELETE SET NULL,
 approved_at TEXT,
 next_run_at TEXT,
 created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
 updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX saved_flows_workspace ON saved_flows(workspace_id,updated_at DESC);
CREATE TRIGGER saved_flow_limit BEFORE INSERT ON saved_flows
WHEN (SELECT COUNT(*) FROM saved_flows WHERE workspace_id=NEW.workspace_id)>=10
BEGIN SELECT RAISE(ABORT,'Maximum 10 saved flows per workspace'); END;
CREATE TRIGGER saved_flow_active_limit BEFORE UPDATE OF status ON saved_flows
WHEN NEW.status='automatic' AND OLD.status!='automatic' AND
 (SELECT COUNT(*) FROM saved_flows WHERE workspace_id=NEW.workspace_id AND status='automatic')+
 (SELECT COUNT(*) FROM approved_workflows WHERE workspace_id=NEW.workspace_id AND status='automatic')>=2
BEGIN SELECT RAISE(ABORT,'Maximum 2 active flows per workspace'); END;
CREATE TRIGGER saved_flow_active_insert_limit BEFORE INSERT ON saved_flows
WHEN NEW.status='automatic' AND (SELECT COUNT(*) FROM saved_flows WHERE workspace_id=NEW.workspace_id AND status='automatic')>=2
BEGIN SELECT RAISE(ABORT,'Maximum 2 active flows per workspace'); END;
ALTER TABLE approved_workflow_runs ADD COLUMN flow_id TEXT REFERENCES saved_flows(id);
DROP INDEX approved_workflow_single_run;
CREATE UNIQUE INDEX approved_workflow_single_run ON approved_workflow_runs(workspace_id,COALESCE(flow_id,'')) WHERE status='running';
-- Preserve existing approvals and runs; never duplicate a scheduler or outreach queue.
INSERT INTO saved_flows(id,workspace_id,name,payload_json,revision,status,config_json,approvals_json,context_hash,approved_by,approved_at,next_run_at,updated_at)
SELECT 'legacy-'||w.workspace_id,w.workspace_id,'Saved workflow',COALESCE(s.payload_json,'{}'),w.revision,w.status,w.config_json,w.approvals_json,w.context_hash,w.approved_by,w.approved_at,w.next_run_at,w.updated_at
FROM approved_workflows w LEFT JOIN customer_workspace_state s ON s.workspace_id=w.workspace_id;
UPDATE approved_workflow_runs SET flow_id='legacy-'||workspace_id WHERE workspace_id IN (SELECT workspace_id FROM approved_workflows);
UPDATE approved_workflows SET status='stopped';
CREATE TRIGGER legacy_workflow_active_limit BEFORE UPDATE OF status ON approved_workflows
WHEN NEW.status='automatic' AND OLD.status!='automatic' AND (SELECT COUNT(*) FROM saved_flows WHERE workspace_id=NEW.workspace_id AND status='automatic')>=2
BEGIN SELECT RAISE(ABORT,'Maximum 2 active flows per workspace'); END;
