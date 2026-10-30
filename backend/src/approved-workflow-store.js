import {readOwnedPayload} from './workspace-record-store.js';
import {savedFlowAuthorized,savedFlowRow,sharedHash} from './saved-flow-store.js';
import FlowState from '../../customer/my-flows.js';
import {approvedContext,approvalStatus,normalizeWorkflowConfig,fingerprint} from './approved-workflow-engine.js';
export const parse=(s,f={})=>{try{return JSON.parse(s||'')??f;}catch{return f;}};
export async function workflowMain(env,workspaceId){const state=await env.DB.prepare('SELECT payload_json FROM customer_workspace_state WHERE workspace_id=?').bind(workspaceId).first();const payload=((await readOwnedPayload(env,workspaceId,state)).payload);return {...payload.main,messageStudio:payload.outreach?.messageStudio};}
export async function workflowRow(env,workspaceId){return env.DB.prepare('SELECT * FROM approved_workflows WHERE workspace_id=?').bind(workspaceId).first();}
// Use the same current control, owner and lease predicates for the last read
// before an action and for checkpoint/completion writes themselves.
export function workflowRunAuthority(row,run,token,at,snapshot){
  if(!snapshot?.valid)return {sql:'0',args:[]};
  const flowId=run.flow_id||null,table=flowId?'saved_flows':'approved_workflows';
  const sql=`status='running' AND lease_token=? AND workspace_id=? AND revision=? AND ${flowId?'flow_id=?':'flow_id IS NULL'} AND julianday(lease_until)>julianday(?) AND EXISTS(SELECT 1 FROM ${table} workflow JOIN workspace_members member ON member.workspace_id=workflow.workspace_id AND member.user_id=workflow.approved_by WHERE workflow.workspace_id=approved_workflow_runs.workspace_id AND workflow.revision=approved_workflow_runs.revision AND workflow.status='automatic' AND workflow.approved_at IS NOT NULL AND workflow.approved_by=? AND workflow.context_hash=? AND workflow.config_json=? ${flowId?"AND workflow.id=approved_workflow_runs.flow_id AND json_array_length(workflow.review_json)=0":''} ${snapshot?'AND workflow.approvals_json=?'+(flowId?' AND workflow.state_version=? AND workflow.payload_json=? AND workflow.shared_hash=?':''):''} AND member.role='owner')${snapshot?' AND EXISTS(SELECT 1 FROM customer_workspace_state source WHERE source.workspace_id=approved_workflow_runs.workspace_id AND source.version=? AND source.payload_json=?)':''}`;
  return {sql,args:[token,row.workspace_id,row.revision,...(flowId?[flowId]:[]),at,row.approved_by,row.context_hash,row.config_json,...(snapshot?[snapshot.control.approvals_json,...(flowId?[snapshot.control.state_version,snapshot.control.payload_json,snapshot.control.shared_hash]:[]),snapshot.workspace.version,snapshot.workspace.payload_json]:[])]};
}
// Decode and assess the exact source owners retained in this receipt. The final
// SQL read/write binds their versions and payloads; benign progress saves can
// obtain a new receipt without invalidating approval or replaying provider work.
export async function workflowExecutionSnapshot(env,row,run){
  const workspaceId=row.workspace_id,flowId=run.flow_id||null;
  const workspace=await readOwnedPayload(env,workspaceId,await env.DB.prepare('SELECT * FROM customer_workspace_state WHERE workspace_id=?').bind(workspaceId).first());
  if(!workspace.row)return {valid:false};
  const found=flowId?await savedFlowRow(env,workspaceId,flowId):await workflowRow(env,workspaceId);
  if(!found)return {valid:false};
  const saved=flowId?await readOwnedPayload(env,workspaceId,found,{flowId}):null,control=saved?.row||found;
  if(control.status!=='automatic'||Number(control.revision)!==Number(row.revision)||!control.approved_by||flowId&&parse(control.review_json,[]).length)return {valid:false};
  const member=await env.DB.prepare('SELECT role FROM workspace_members WHERE workspace_id=? AND user_id=?').bind(workspaceId,control.approved_by).first();if(member?.role!=='owner')return {valid:false};
  const payload=flowId?FlowState.composePayload(flowId==='legacy-'+workspaceId&&!workspace.payload.main?.myFlow?.id?workspace.payload:saved.payload,workspace.payload,control):workspace.payload;
  const context=approvedContext({...payload.main,messageStudio:payload.outreach?.messageStudio}),hash=await fingerprint(context);
  let valid=false;try{valid=hash===control.context_hash&&(await approvalStatus(context,normalizeWorkflowConfig(parse(control.config_json),context),parse(control.approvals_json))).every(stage=>stage.approved)&&(!flowId||(control.shared_hash||await sharedHash(saved.payload))===await sharedHash(workspace.payload));}catch{}
  const snapshot={valid,workspace:workspace.row,control};
  if(!valid){
    const changed=await env.DB.prepare(`UPDATE ${flowId?'saved_flows':'approved_workflows'} SET status='needs_review',approved_at=NULL,updated_at=CURRENT_TIMESTAMP WHERE workspace_id=? AND revision=? AND status='automatic' AND context_hash=? AND approvals_json=? ${flowId?'AND id=? AND state_version=? AND payload_json=?':''} AND EXISTS(SELECT 1 FROM customer_workspace_state source WHERE source.workspace_id=? AND source.version=? AND source.payload_json=?)`).bind(workspaceId,control.revision,control.context_hash,control.approvals_json,...(flowId?[flowId,control.state_version,control.payload_json]:[]),workspaceId,workspace.row.version,workspace.row.payload_json).run();
    snapshot.retry=!changed.meta?.changes;
  }
  return snapshot;
}
export async function workflowAuthorized(env,workspaceId,revision,flowId=null){
  if(flowId)return savedFlowAuthorized(env,workspaceId,revision,flowId);
  const row=await workflowRow(env,workspaceId);if(!row||row.status!=='automatic'||Number(row.revision)!==Number(revision)||!row.approved_by)return false;
  const member=await env.DB.prepare("SELECT role FROM workspace_members WHERE workspace_id=? AND user_id=?").bind(workspaceId,row.approved_by).first();if(member?.role!=='owner')return false;
  const context=approvedContext(await workflowMain(env,workspaceId)),hash=await fingerprint(context);
  let stagesApproved=false;try{stagesApproved=(await approvalStatus(context,normalizeWorkflowConfig(parse(row.config_json),context),parse(row.approvals_json))).every(stage=>stage.approved);}catch{}
  if(hash!==row.context_hash||!stagesApproved){await env.DB.prepare("UPDATE approved_workflows SET status='needs_review',approved_at=NULL,updated_at=CURRENT_TIMESTAMP WHERE workspace_id=? AND revision=? AND status='automatic'").bind(workspaceId,revision).run();return false;}return true;
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
