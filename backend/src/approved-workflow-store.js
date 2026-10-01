import {approvedContext,fingerprint} from './approved-workflow-engine.js';
export const parse=(s,f={})=>{try{return JSON.parse(s||'')??f;}catch{return f;}};
export async function workflowMain(env,workspaceId){const state=await env.DB.prepare('SELECT payload_json FROM customer_workspace_state WHERE workspace_id=?').bind(workspaceId).first();return parse(state?.payload_json).main||{};}
export async function workflowRow(env,workspaceId){return env.DB.prepare('SELECT * FROM approved_workflows WHERE workspace_id=?').bind(workspaceId).first();}
export async function workflowAuthorized(env,workspaceId,revision){
  const row=await workflowRow(env,workspaceId);if(!row||row.status!=='automatic'||Number(row.revision)!==Number(revision)||!row.approved_by)return false;
  const member=await env.DB.prepare("SELECT role FROM workspace_members WHERE workspace_id=? AND user_id=?").bind(workspaceId,row.approved_by).first();if(member?.role!=='owner')return false;
  const hash=await fingerprint(approvedContext(await workflowMain(env,workspaceId)));
  if(hash!==row.context_hash){await env.DB.prepare("UPDATE approved_workflows SET status='needs_review',updated_at=CURRENT_TIMESTAMP WHERE workspace_id=? AND revision=? AND status='automatic'").bind(workspaceId,revision).run();return false;}return true;
}
export async function workflowDeliveryAuthorized(env,sequence){
  if(!sequence.workflow_run_id)return true;
  if(!await workflowAuthorized(env,sequence.workspace_id,sequence.workflow_revision))return false;
  const row=await workflowRow(env,sequence.workspace_id),delivery=parse(row.config_json).delivery;
  const policy=await env.DB.prepare('SELECT * FROM outreach_automation_policies WHERE workspace_id=?').bind(sequence.workspace_id).first();
  if(!delivery||!policy)return false;
  if(Number(policy.workspace_daily_limit)!==delivery.dailyLimit||Number(policy.mailbox_daily_limit)!==delivery.dailyLimit||policy.timezone!==delivery.timezone||policy.send_window_start!==delivery.sendWindowStart||policy.send_window_end!==delivery.sendWindowEnd||JSON.stringify(parse(policy.working_days_json,[]))!==JSON.stringify(delivery.workingDays)||Number(policy.max_followups)!==delivery.maxFollowups||Number(policy.min_delay_minutes)!==8||Number(policy.max_delay_minutes)!==18||JSON.stringify(parse(policy.followup_delays_days_json,[]))!==JSON.stringify([3])){
    await env.DB.prepare("UPDATE approved_workflows SET status='needs_review',approved_at=NULL,updated_at=CURRENT_TIMESTAMP WHERE workspace_id=? AND revision=?").bind(sequence.workspace_id,sequence.workflow_revision).run();return false;
  }
  const run=await env.DB.prepare('SELECT status,workspace_id,revision FROM approved_workflow_runs WHERE id=?').bind(sequence.workflow_run_id).first();
  return run?.status==='completed'&&run.workspace_id===sequence.workspace_id&&Number(run.revision)===Number(sequence.workflow_revision);
}
