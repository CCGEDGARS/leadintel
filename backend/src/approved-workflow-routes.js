import {contactRequestGuard} from './contact-operation-authority.js';
import {messageBatch,messageRowAssertion,messageSetAssertion} from './message-operation-authority.js';
import {readAdditionalContactPolicy} from './additional-contact-services.js';
import {storageErrorResponse} from './workspace-storage.js';
import {cookieValue,sha256} from './security.js';
import {WORKFLOW_STAGES,approvedContext,normalizeWorkflowConfig,approvalStatus,fingerprint,setupBlockers} from './approved-workflow-engine.js';
import {parse,workflowMain,workflowRow} from './approved-workflow-store.js';
import {automaticGmailDeliveryEnabled} from './outreach-automation.js';
import {apolloCapabilities,resolveWorkspaceServiceCredential} from './service-integrations.js';
import {runApprovedWorkflows} from './approved-workflow-runner.js';
const json=(v,status=200,cors={})=>new Response(JSON.stringify(v),{status,headers:{'Content-Type':'application/json','Cache-Control':'no-store',...cors}});
async function access(request,env,workspaceId){const token=cookieValue(request,'leadintel_session');if(!token)return null;const user=await env.DB.prepare("SELECT users.id FROM sessions JOIN users ON users.id=sessions.user_id WHERE sessions.token_hash=? AND sessions.expires_at>datetime('now')").bind(await sha256(token)).first();if(!user)return null;const member=await env.DB.prepare('SELECT role FROM workspace_members WHERE workspace_id=? AND user_id=?').bind(workspaceId,user.id).first();return member?{user,member}:null;}
function cancelStoppedWorkflowQueue(env,workspaceId){return env.DB.prepare("UPDATE outreach_automation_queue SET status='skipped',last_error_code='workflow_cancelled',last_error_message='The workflow was stopped or changed',updated_at=CURRENT_TIMESTAMP WHERE workspace_id=? AND status IN ('queued','waiting_window','blocked_limit','failed') AND sequence_id IN (SELECT id FROM outreach_automation_sequences WHERE workspace_id=? AND workflow_run_id IN (SELECT id FROM approved_workflow_runs WHERE flow_id IS NULL) AND status='cancelled')").bind(workspaceId,workspaceId);}
async function view(env,workspaceId){
  const row=await workflowRow(env,workspaceId),context=approvedContext(await workflowMain(env,workspaceId));
  const config=normalizeWorkflowConfig(parse(row?.config_json),context),stages=await approvalStatus(context,config,parse(row?.approvals_json));
  const blockers=setupBlockers(context,config);const gmail=await env.DB.prepare("SELECT status FROM gmail_connections WHERE workspace_id=? AND status='connected'").bind(workspaceId).first();
  if(!gmail)blockers.push('Connect Gmail for automatic delivery');if(!automaticGmailDeliveryEnabled(env)&&env.APPROVED_WORKFLOW_DELIVERY_MODE!=='enabled')blockers.push('Automatic delivery is disabled on the server');
  const apollo=await apolloCapabilities(env,workspaceId);
  const paidSearch=await readAdditionalContactPolicy(env,workspaceId);
  if(paidSearch.provider==='treg'){if((paidSearch.enabled||paidSearch.phoneEnabled)&&!(await resolveWorkspaceServiceCredential(env,workspaceId,'treg')).configured)blockers.push('Reconnect Treg in Settings');}else if(config.buyers.confirmContacts&&!apollo.email)blockers.push('Enable Apollo email enrichment in Apollo Settings');
  if(paidSearch.provider!=='treg'&&config.buyers.confirmPhone&&!apollo.phone)blockers.push('Enable Apollo phone enrichment in Apollo Settings');
  const {results:runs=[]}=await env.DB.prepare('SELECT id,revision,status,stage_index,error_message,created_at,updated_at,result_json FROM approved_workflow_runs WHERE workspace_id=? AND flow_id IS NULL ORDER BY created_at DESC LIMIT 10').bind(workspaceId).all();
  return {status:row?.status||'manual',revision:row?.revision||0,config,context,stages,blockers,runs:runs.map(run=>({...run,result:parse(run.result_json),result_json:undefined})),approvedAt:row?.approved_at||null,nextRunAt:row?.next_run_at||null};
}
export async function handleApprovedWorkflowRoute(request,env,cors={}){
  const url=new URL(request.url);if(!url.pathname.startsWith('/api/approved-workflow'))return null;
  const workspaceId=url.searchParams.get('workspace_id')||'',auth=await access(request,env,workspaceId);if(!auth)return json({error:'Authenticated workspace membership required'},401,cors);
  const context={workspaceId,userId:auth.user.id,role:auth.member.role};
  try{
    context.guard=await contactRequestGuard(request,env,context);await context.guard();
    const row=await workflowRow(env,workspaceId),source=await env.DB.prepare('SELECT * FROM customer_workspace_state WHERE workspace_id=?').bind(workspaceId).first();
    const assertions=[messageRowAssertion(env.DB,'approved_workflows','workspace_id=?',[workspaceId],row),messageRowAssertion(env.DB,'customer_workspace_state','workspace_id=?',[workspaceId],source)];
    const transact=async(writes,extra=[])=>{const result=await messageBatch(env,context,writes,[...assertions,...extra]);return writes.length?result.slice(-writes.length):[];};
    const respond=async(data)=>{await context.guard();return json({...data,role:auth.member.role},200,cors);};
    if(url.pathname==='/api/approved-workflow'&&request.method==='GET'){
      const data=await view(env,workspaceId);
      if(data.status==='automatic'&&data.stages.some(s=>!s.approved)){
        await transact([env.DB.prepare("UPDATE approved_workflows SET status='needs_review' WHERE workspace_id=? AND revision=?").bind(workspaceId,row.revision)]);data.status='needs_review';
      }
      return await respond(data);
    }
    if(auth.member.role!=='owner')return json({error:'Only the workspace owner can approve or control automatic execution'},403,cors);
    if(request.method!=='POST')return json({error:'Not found'},404,cors);
    const body=await request.json().catch(()=>null);await context.guard();if(!body)return json({error:'Workflow settings required'},400,cors);
    if(body.revision!==Number(row?.revision||0))return json({error:'Workflow changed. Refresh before continuing.'},409,cors);
    const action=body.action;
    if(action==='save'){
      const context=approvedContext(await workflowMain(env,workspaceId)),config=normalizeWorkflowConfig(body.config,context);
      const approvals=parse(row?.approvals_json);
      if(row&&await fingerprint(config)===await fingerprint(normalizeWorkflowConfig(parse(row.config_json),context))){await transact([]);return await respond(await view(env,workspaceId));}
      const writes=await transact([env.DB.prepare("INSERT INTO approved_workflows(workspace_id,revision,status,config_json,approvals_json,context_hash) VALUES(?,1,'manual',?,?,?) ON CONFLICT(workspace_id) DO UPDATE SET revision=approved_workflows.revision+1,status='needs_review',config_json=excluded.config_json,approvals_json=excluded.approvals_json,context_hash=excluded.context_hash,approved_at=NULL,updated_at=CURRENT_TIMESTAMP WHERE approved_workflows.revision=?").bind(workspaceId,JSON.stringify(config),JSON.stringify(approvals),await fingerprint(context),Number(row?.revision||0)),env.DB.prepare("UPDATE approved_workflow_runs SET status='stopped',lease_token=NULL,lease_until=NULL WHERE workspace_id=? AND flow_id IS NULL AND status IN ('running','blocked') AND revision<? AND EXISTS (SELECT 1 FROM approved_workflows WHERE workspace_id=? AND revision=? AND config_json=?)").bind(workspaceId,Number(row?.revision||0)+1,workspaceId,Number(row?.revision||0)+1,JSON.stringify(config)),env.DB.prepare("UPDATE outreach_automation_sequences SET status='cancelled',stop_reason='workflow_settings_changed' WHERE workspace_id=? AND workflow_run_id IN (SELECT id FROM approved_workflow_runs WHERE flow_id IS NULL) AND workflow_revision<? AND status='active'").bind(workspaceId,Number(row?.revision||0)+1),cancelStoppedWorkflowQueue(env,workspaceId)]);
      if(!writes[0]?.meta?.changes)return json({error:'Workflow changed. Refresh before saving.'},409,cors);
    }else if(action==='approve-stage'){
      if(!row)return json({error:'Save settings first'},409,cors);
      const data=await view(env,workspaceId),index=WORKFLOW_STAGES.indexOf(body.stage);if(index<0)throw new Error('Unknown stage');
      if(data.stages.slice(0,index).some(s=>!s.approved))throw new Error('Review and approve the preceding stages first');
      if(body.stage==='profile'&&!data.context.profileApproved)throw new Error('Approve the profile in Profile Review first');
      if(body.stage==='strategy'&&!data.context.strategyApproved)throw new Error('Approve the market strategy first');
      if(body.stage==='buyers'&&!data.config.buyers.roles.length)throw new Error('Choose buyer roles before approval');
      if(body.stage==='messages'&&(!data.config.messages.subject||!data.config.messages.body))throw new Error('Write the email template before approval');
      const approvals=parse(row.approvals_json);approvals[body.stage]={hash:data.stages[index].hash,at:new Date().toISOString(),by:auth.user.id};
      const contextHash=await fingerprint(data.context);
      if(contextHash!==row.context_hash){
        const updated=await transact([
          env.DB.prepare("UPDATE approved_workflows SET revision=revision+1,status='needs_review',approved_at=NULL,approved_by=NULL,approvals_json=?,context_hash=?,updated_at=CURRENT_TIMESTAMP WHERE workspace_id=? AND revision=?").bind(JSON.stringify(approvals),contextHash,workspaceId,row.revision),
          env.DB.prepare("UPDATE approved_workflow_runs SET status='stopped',lease_token=NULL,lease_until=NULL WHERE workspace_id=? AND flow_id IS NULL AND revision=? AND status IN ('running','blocked') AND EXISTS (SELECT 1 FROM approved_workflows WHERE workspace_id=? AND revision=? AND context_hash=?)").bind(workspaceId,row.revision,workspaceId,row.revision+1,contextHash),
          env.DB.prepare("UPDATE outreach_automation_sequences SET status='cancelled',stop_reason='workflow_context_changed' WHERE workspace_id=? AND workflow_run_id IN (SELECT id FROM approved_workflow_runs WHERE flow_id IS NULL) AND workflow_revision=? AND status='active' AND EXISTS (SELECT 1 FROM approved_workflows WHERE workspace_id=? AND revision=? AND context_hash=?)").bind(workspaceId,row.revision,workspaceId,row.revision+1,contextHash),cancelStoppedWorkflowQueue(env,workspaceId)
        ]);
        if(!updated[0]?.meta?.changes)return json({error:'Workflow changed. Refresh before approving.'},409,cors);
      }else await transact([env.DB.prepare("UPDATE approved_workflows SET approvals_json=?,updated_at=CURRENT_TIMESTAMP WHERE workspace_id=? AND revision=?").bind(JSON.stringify(approvals),workspaceId,row.revision)]);
    }else if(action==='activate'||action==='resume'){
      if(!row)throw new Error('Save and approve the workflow first');
      const policy=await env.DB.prepare('SELECT * FROM outreach_automation_policies WHERE workspace_id=?').bind(workspaceId).first(),gmail=await env.DB.prepare('SELECT * FROM gmail_connections WHERE workspace_id=?').bind(workspaceId).first(),services=await env.DB.prepare('SELECT provider AS id,* FROM workspace_service_integrations WHERE workspace_id=? ORDER BY provider').bind(workspaceId).all();
      const activationAssertions=[messageRowAssertion(env.DB,'outreach_automation_policies','workspace_id=?',[workspaceId],policy),messageRowAssertion(env.DB,'gmail_connections','workspace_id=?',[workspaceId],gmail),messageSetAssertion(env.DB,'SELECT provider AS id,* FROM workspace_service_integrations WHERE workspace_id=?',[workspaceId],services.results)];
      const data=await view(env,workspaceId);
      if(data.stages.some(s=>!s.approved)||data.blockers.length)throw new Error([...data.blockers,...data.stages.filter(s=>!s.approved).map(s=>`Approve ${s.stage}`)].join('; '));
      if(action==='activate'&&body.approved!==true)throw new Error('Final approval is required');
      if(action==='resume'&&(!row.approved_at||row.status==='needs_review'))throw new Error('Final approval is required before resuming');
      // Final workflow approval and the matching sender policy share one transaction.
      const contextHash=await fingerprint(data.context),approvedAt=new Date().toISOString();
      const updated=await transact([
        env.DB.prepare("UPDATE approved_workflows SET status='automatic',approved_by=?,approved_at=COALESCE(approved_at,?),next_run_at=COALESCE(next_run_at,?),updated_at=CURRENT_TIMESTAMP WHERE workspace_id=? AND revision=? AND context_hash=?").bind(auth.user.id,approvedAt,approvedAt,workspaceId,row.revision,contextHash),
        env.DB.prepare("INSERT INTO outreach_automation_policies(workspace_id,mode,enabled,paused,emergency_stop,workspace_daily_limit,mailbox_daily_limit,timezone,send_window_start,send_window_end,working_days_json,max_followups,min_delay_minutes,max_delay_minutes,followup_delays_days_json,updated_by) SELECT ?,'automatic',1,0,0,?,?,?,?,?,?,?,8,18,'[3]',? WHERE EXISTS(SELECT 1 FROM approved_workflows WHERE workspace_id=? AND revision=? AND context_hash=? AND status='automatic') ON CONFLICT(workspace_id) DO UPDATE SET mode='automatic',enabled=1,paused=0,emergency_stop=0,workspace_daily_limit=excluded.workspace_daily_limit,mailbox_daily_limit=excluded.mailbox_daily_limit,timezone=excluded.timezone,send_window_start=excluded.send_window_start,send_window_end=excluded.send_window_end,working_days_json=excluded.working_days_json,max_followups=excluded.max_followups,min_delay_minutes=8,max_delay_minutes=18,followup_delays_days_json='[3]',updated_by=excluded.updated_by,updated_at=CURRENT_TIMESTAMP").bind(workspaceId,data.config.delivery.dailyLimit,data.config.delivery.dailyLimit,data.config.delivery.timezone,data.config.delivery.sendWindowStart,data.config.delivery.sendWindowEnd,JSON.stringify(data.config.delivery.workingDays),data.config.delivery.maxFollowups,auth.user.id,workspaceId,row.revision,contextHash)
      ],activationAssertions);
      if(!updated[0]?.meta?.changes)throw new Error('Workflow changed. Refresh before activating.');
    }else if(['pause','stop','manual'].includes(action)){
      if(!row)throw new Error('Save settings first');const status={pause:'paused',stop:'stopped',manual:'manual'}[action];
      const statements=[env.DB.prepare('UPDATE approved_workflows SET status=?,updated_at=CURRENT_TIMESTAMP WHERE workspace_id=?').bind(status,workspaceId),env.DB.prepare('UPDATE outreach_automation_policies SET paused=1,updated_at=CURRENT_TIMESTAMP WHERE workspace_id=?').bind(workspaceId)];
      if(action==='stop')statements.push(env.DB.prepare("UPDATE approved_workflow_runs SET status='stopped',lease_token=NULL,lease_until=NULL WHERE workspace_id=? AND flow_id IS NULL AND status IN ('running','blocked')").bind(workspaceId),env.DB.prepare("UPDATE outreach_automation_sequences SET status='cancelled',stop_reason='workflow_stopped' WHERE workspace_id=? AND workflow_run_id IN (SELECT id FROM approved_workflow_runs WHERE flow_id IS NULL) AND status='active'").bind(workspaceId));
      if(action==='stop')statements.push(cancelStoppedWorkflowQueue(env,workspaceId));
      await transact(statements);
    }else if(action==='retry'){
      if(!row||row.status!=='automatic')throw new Error('Resume the approved workflow first');
      await transact([env.DB.prepare("UPDATE approved_workflow_runs SET status='running',error_message=NULL,lease_token=NULL,lease_until=NULL,updated_at=CURRENT_TIMESTAMP WHERE workspace_id=? AND flow_id IS NULL AND id=? AND revision=? AND status='blocked'").bind(workspaceId,String(body.runId||''),row.revision)]);
    }else if(action==='run'){
      if(!row||row.status!=='automatic')throw new Error('Activate the approved workflow first');await transact([]);await runApprovedWorkflows(env,{workspaceId,maxWorkspaces:1});
    }else return json({error:'Unknown workflow action'},400,cors);
    if(action!=='run')await messageBatch(env,context,[env.DB.prepare('INSERT INTO audit_events(id,workspace_id,user_id,event_type,entity_type,entity_id,metadata_json) VALUES(?,?,?,?,?,?,?)').bind(crypto.randomUUID(),workspaceId,auth.user.id,`approved_workflow.${action}`,'approved_workflow',workspaceId,JSON.stringify({stage:body.stage||null,revision:row?.revision||0}))]);
    return await respond(await view(env,workspaceId));
  }catch(cause){const storageError=storageErrorResponse(cause,cors);if(storageError)return storageError;return json({error:String(cause.message||'Could not update workflow')},cause.status||409,cors);}
}
