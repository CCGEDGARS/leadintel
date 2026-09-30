import {normalizeEmail} from './gmail.js';

export async function isContactSuppressed(db,workspaceId,address){
  const email=normalizeEmail(address);
  if(!email||!workspaceId)return false;
  const row=await db.prepare('SELECT email FROM outreach_contact_suppression WHERE workspace_id=? AND email=?').bind(workspaceId,email).first();
  return Boolean(row);
}

export async function suppressContact(db,workspaceId,address,{reason='manual',source=''}={}){
  const email=normalizeEmail(address);
  if(!workspaceId||!email)throw new Error('A valid contact email and workspace are required');
  if(!['unsubscribe','manual','objection'].includes(reason))throw new Error('Invalid suppression reason');
  await db.prepare(`INSERT INTO outreach_contact_suppression(workspace_id,email,reason,source) VALUES(?,?,?,?) ON CONFLICT(workspace_id,email) DO UPDATE SET reason=CASE WHEN outreach_contact_suppression.reason='unsubscribe' THEN 'unsubscribe' ELSE excluded.reason END,source=excluded.source,updated_at=CURRENT_TIMESTAMP`).bind(workspaceId,email,reason,String(source).slice(0,200)).run();
  await db.batch([
    db.prepare(`UPDATE outreach_automation_queue SET status='skipped',last_error_code='contact_suppressed',last_error_message='Contact is on the workspace do-not-contact list',updated_at=CURRENT_TIMESTAMP WHERE workspace_id=? AND recipient=? AND status IN ('queued','waiting_window','blocked_limit','failed')`).bind(workspaceId,email),
    db.prepare(`UPDATE outreach_automation_sequences SET status='cancelled',stop_reason='contact_suppressed',updated_at=CURRENT_TIMESTAMP WHERE workspace_id=? AND recipient=? AND status='active'`).bind(workspaceId,email)
  ]);
  return email;
}
