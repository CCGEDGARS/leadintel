import {savedFlowAuthorized,savedFlowRow} from './saved-flow-store.js';
import stateBudget from '../../customer/state-budget.js';
import {approvedContext,fingerprint} from './approved-workflow-engine.js';
export const parse=(s,f={})=>{try{return JSON.parse(s||'')??f;}catch{return f;}};
export async function workflowMain(env,workspaceId){const state=await env.DB.prepare('SELECT payload_json FROM customer_workspace_state WHERE workspace_id=?').bind(workspaceId).first();const payload=stateBudget.restoreFromSync(parse(state?.payload_json));return {...payload.main,messageStudio:payload.outreach?.messageStudio};}
export async function workflowRow(env,workspaceId){return env.DB.prepare('SELECT * FROM approved_workflows WHERE workspace_id=?').bind(workspaceId).first();}
export async function workflowAuthorized(env,workspaceId,revision,flowId=null){
  if(flowId)return savedFlowAuthorized(env,workspaceId,revision,flowId);
  const row=await workflowRow(env,workspaceId);if(!row||row.status!=='automatic'||Number(row.revision)!==Number(revision)||!row.approved_by)return false;
  const member=await env.DB.prepare("SELECT role FROM workspace_members WHERE workspace_id=? AND user_id=?").bind(workspaceId,row.approved_by).first();if(member?.role!=='owner')return false;
  const hash=await fingerprint(approvedContext(await workflowMain(env,workspaceId)));
  if(hash!==row.context_hash){await env.DB.prepare("UPDATE approved_workflows SET status='needs_review',updated_at=CURRENT_TIMESTAMP WHERE workspace_id=? AND revision=? AND status='automatic'").bind(workspaceId,revision).run();return false;}return true;
}
export async function workflowDeliveryAuthorized(env,sequence){
  if(!sequence.workflow_run_id)return true;
  const run=await env.DB.prepare('SELECT * FROM approved_workflow_runs WHERE id=?').bind(sequence.workflow_run_id).first();
  if(!await workflowAuthorized(env,sequence.workspace_id,sequence.workflow_revision,run?.flow_id))return false;
  const row=run?.flow_id?await savedFlowRow(env,sequence.workspace_id,run.flow_id):await workflowRow(env,sequence.workspace_id),delivery=parse(row.config_json).delivery;
  const policy=await env.DB.prepare('SELECT * FROM outreach_automation_policies WHERE workspace_id=?').bind(sequence.workspace_id).first();
  if(!delivery||!policy)return false;
  if(Number(policy.workspace_daily_limit)!==delivery.dailyLimit||Number(policy.mailbox_daily_limit)!==delivery.dailyLimit||policy.timezone!==delivery.timezone||policy.send_window_start!==delivery.sendWindowStart||policy.send_window_end!==delivery.sendWindowEnd||JSON.stringify(parse(policy.working_days_json,[]))!==JSON.stringify(delivery.workingDays)||(run?.flow_id?Number(policy.max_followups)<delivery.maxFollowups:Number(policy.max_followups)!==delivery.maxFollowups)||Number(policy.min_delay_minutes)!==8||Number(policy.max_delay_minutes)!==18||JSON.stringify(parse(policy.followup_delays_days_json,[]))!==JSON.stringify([3])){
    if(run?.flow_id)await env.DB.prepare("UPDATE saved_flows SET status='needs_review',approved_at=NULL,updated_at=CURRENT_TIMESTAMP WHERE workspace_id=? AND id=? AND revision=?").bind(sequence.workspace_id,run.flow_id,sequence.workflow_revision).run();
    else await env.DB.prepare("UPDATE approved_workflows SET status='needs_review',approved_at=NULL,updated_at=CURRENT_TIMESTAMP WHERE workspace_id=? AND revision=?").bind(sequence.workspace_id,sequence.workflow_revision).run();return false;
  }
  return run?.status==='completed'&&run.workspace_id===sequence.workspace_id&&Number(run.revision)===Number(sequence.workflow_revision);
}
