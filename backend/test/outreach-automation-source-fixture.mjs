import canonicalMain from '../../customer/test/helpers/delivery-canonical-context.cjs';
import O from '../../customer/outreach-engine.js';
export function seedAutomationSource(db,{workspaceId='w1',userId='u1'}={}){
  const payload={main:canonicalMain(),outreach:{messageStudio:{}}};
  db.raw.exec('CREATE TABLE IF NOT EXISTS conversation_mailbox_locks(workspace_id TEXT PRIMARY KEY,lock_id TEXT NOT NULL,expires_at TEXT NOT NULL)');
  db.raw.exec('CREATE TABLE IF NOT EXISTS customer_workspace_state(workspace_id TEXT PRIMARY KEY,payload_json TEXT)');
  db.raw.prepare('INSERT OR IGNORE INTO customer_workspace_state(workspace_id,payload_json) VALUES(?,?)').run(workspaceId,JSON.stringify(payload));
  const saved=JSON.parse(db.raw.prepare('SELECT payload_json FROM customer_workspace_state WHERE workspace_id=?').get(workspaceId).payload_json),authority=O.messageSourceAuthority(saved.main,saved.outreach?.messageStudio||{});
  for(const sequence of db.raw.prepare('SELECT id FROM outreach_automation_sequences WHERE workspace_id=?').all(workspaceId))db.raw.prepare("INSERT INTO audit_events(id,workspace_id,user_id,event_type,entity_type,entity_id,metadata_json) SELECT ?,?,?,'outreach.sequence_source_authority','outreach_sequence',?,? WHERE NOT EXISTS(SELECT 1 FROM audit_events WHERE workspace_id=? AND event_type='outreach.sequence_source_authority' AND entity_id=?)").run(`source-${sequence.id}`,workspaceId,userId,sequence.id,JSON.stringify({version:1,sourceAuthority:authority}),workspaceId,sequence.id);
  return authority;
}
export const automationSourceAuthority=()=>O.messageSourceAuthority(canonicalMain(),{});
