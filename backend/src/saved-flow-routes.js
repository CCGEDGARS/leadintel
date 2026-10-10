import FlowState from '../../customer/my-flows.js';
import {cookieValue,sha256} from './security.js';
import {WORKFLOW_STAGES,approvedContext,normalizeWorkflowConfig,approvalStatus,fingerprint} from './approved-workflow-engine.js';
import {parse,decode,encode,currentPayload,savedFlowRow,savedFlowPayload,savedFlowView,sharedHash} from './saved-flow-store.js';
import {getCustomerState,putCustomerState} from './customer-state.js';
import {runSavedFlows} from './saved-flow-runner.js';
const json=(v,status=200,cors={})=>new Response(JSON.stringify(v),{status,headers:{'Content-Type':'application/json','Cache-Control':'no-store',...cors}});
async function access(request,env,id){const token=cookieValue(request,'leadintel_session');if(!token)return null;const user=await env.DB.prepare("SELECT users.id FROM sessions JOIN users ON users.id=sessions.user_id WHERE sessions.token_hash=? AND sessions.expires_at>datetime('now')").bind(await sha256(token)).first();if(!user)return null;const member=await env.DB.prepare('SELECT role FROM workspace_members WHERE workspace_id=? AND user_id=?').bind(id,user.id).first();return member?{user,member}:null;}
const mainContext=p=>approvedContext({...p.main,messageStudio:p.outreach?.messageStudio});
const name=v=>{const result=String(v||'').trim();if(!result||result.length>100)throw Error('Enter a flow name of 1–100 characters');return result;};
async function audit(env,workspaceId,userId,action,id){await env.DB.prepare('INSERT INTO audit_events(id,workspace_id,user_id,event_type,entity_type,entity_id,metadata_json) VALUES(?,?,?,?,?,?,?)').bind(crypto.randomUUID(),workspaceId,userId,'saved_flow.'+action,'saved_flow',id,'{}').run();}
async function metrics(env,row){
 const sent=await env.DB.prepare("SELECT COUNT(DISTINCT lower(s.recipient)) AS n FROM outreach_automation_sequences s JOIN approved_workflow_runs r ON r.id=s.workflow_run_id JOIN outreach_automation_queue q ON q.sequence_id=s.id WHERE s.workspace_id=? AND r.flow_id=? AND q.status='sent' AND q.step_index=0 AND q.sent_at>=datetime('now','-30 days')").bind(row.workspace_id,row.id).first();
 const outcomes=await env.DB.prepare("SELECT COUNT(DISTINCT CASE WHEN a.activity_type='email.reply_received' AND COALESCE(json_extract(a.metadata_json,'$.category'),'') NOT IN('out_of_office','automatic_reply') THEN lower(s.recipient) END) AS replies,COUNT(DISTINCT CASE WHEN a.activity_type='meeting.booked' AND NOT EXISTS(SELECT 1 FROM crm_activities cancelled WHERE cancelled.workspace_id=a.workspace_id AND cancelled.activity_type='meeting.cancelled' AND json_extract(cancelled.metadata_json,'$.scheduled_event_uri')=json_extract(a.metadata_json,'$.scheduled_event_uri')) THEN lower(s.recipient) END) AS meetings FROM crm_activities a JOIN outreach_automation_sequences s ON s.id=json_extract(a.metadata_json,'$.automation_sequence_id') AND s.workspace_id=a.workspace_id JOIN approved_workflow_runs r ON r.id=s.workflow_run_id WHERE a.workspace_id=? AND r.flow_id=? AND EXISTS(SELECT 1 FROM outreach_automation_queue q WHERE q.sequence_id=s.id AND q.step_index=0 AND q.status='sent' AND q.sent_at>=datetime('now','-30 days'))").bind(row.workspace_id,row.id).first();
 return {period:'Last 30 days · automated email',providerConfirmedSent:Number(sent?.n)||0,delivered:null,opens:null,replies:Number(outcomes?.replies)||0,meetings:Number(outcomes?.meetings)||0,spending:null};
}
async function list(env,workspaceId,role){
 const current=await currentPayload(env,workspaceId),hash=await sharedHash(current),{results:rows=[]}=await env.DB.prepare('SELECT * FROM saved_flows WHERE workspace_id=? ORDER BY updated_at DESC,id LIMIT 10').bind(workspaceId).all();
 const flows=[];for(const row of rows){const payload=FlowState.composePayload(row.id==='legacy-'+workspaceId&&!current.main?.myFlow?.id?current:decode(row),current,row),sharedChanged=(row.shared_hash||await sharedHash(decode(row)))!==hash;
  if(sharedChanged&&row.status==='automatic'){await env.DB.prepare("UPDATE saved_flows SET status='needs_review',updated_at=CURRENT_TIMESTAMP WHERE workspace_id=? AND id=? AND revision=? AND status='automatic'").bind(workspaceId,row.id,row.revision).run();row.status='needs_review';}
  const review=parse(row.review_json,[]);if(sharedChanged)review.push({id:'business',label:'Shared business settings changed — review affected pages',step:2});
  flows.push({id:row.id,name:row.name,status:row.status==='automatic'&&sharedChanged?'needs_review':row.status,revision:row.revision,stateVersion:row.state_version,review,readiness:review.length?'Review required':row.approved_at?'Approved':'Approval needed',summary:FlowState.summary(payload,parse(row.config_json)),updatedAt:row.updated_at,nextRunAt:row.next_run_at,metrics:await metrics(env,row)});
 }
 const legacy=await env.DB.prepare("SELECT COUNT(*) AS n FROM approved_workflows WHERE workspace_id=? AND status='automatic'").bind(workspaceId).first();
 return {role,currentId:current.main?.myFlow?.id||rows.find(r=>r.id==='legacy-'+workspaceId)?.id||null,flows,limits:{saved:10,active:2},activeCount:rows.filter(r=>r.status==='automatic').length+(Number(legacy?.n)||0)};
}
async function stopFlow(env,row,action){
 const status=action==='stop'?'stopped':action==='manual'?'manual':'paused';
 const writes=[env.DB.prepare('UPDATE saved_flows SET status=?,updated_at=CURRENT_TIMESTAMP WHERE workspace_id=? AND id=? AND revision=?').bind(status,row.workspace_id,row.id,row.revision)];
 if(action==='stop')writes.push(env.DB.prepare("UPDATE approved_workflow_runs SET status='stopped',lease_token=NULL,lease_until=NULL WHERE workspace_id=? AND flow_id=? AND status IN ('running','blocked')").bind(row.workspace_id,row.id),env.DB.prepare("UPDATE outreach_automation_sequences SET status='cancelled',stop_reason='workflow_stopped' WHERE workspace_id=? AND workflow_run_id IN(SELECT id FROM approved_workflow_runs WHERE workspace_id=? AND flow_id=?) AND status='active'").bind(row.workspace_id,row.workspace_id,row.id));
 await env.DB.batch(writes);
 if(action==='stop')await env.DB.prepare("UPDATE outreach_automation_queue SET status='skipped',last_error_code='workflow_cancelled',updated_at=CURRENT_TIMESTAMP WHERE workspace_id=? AND status IN ('queued','waiting_window','blocked_limit','failed') AND sequence_id IN(SELECT id FROM outreach_automation_sequences WHERE workspace_id=? AND status='cancelled')").bind(row.workspace_id,row.workspace_id).run();
}
async function activate(env,row,auth,body){
 const view=await savedFlowView(env,row);if(view.blockers.length||view.stages.some(s=>!s.approved))throw Error([...view.blockers,...view.stages.filter(s=>!s.approved).map(s=>'Approve '+s.stage)].join('; '));
 if(body.action==='activate'&&body.approved!==true)throw Error('Final approval is required');if(body.action==='resume'&&!row.approved_at)throw Error('Final approval is required before resuming');
 const {results:active=[]}=await env.DB.prepare("SELECT * FROM saved_flows WHERE workspace_id=? AND id<>? AND status='automatic'").bind(row.workspace_id,row.id).all();
 const legacy=await env.DB.prepare("SELECT COUNT(*) AS n FROM approved_workflows WHERE workspace_id=? AND status='automatic'").bind(row.workspace_id).first();
 if(row.status!=='automatic'&&active.length+(Number(legacy?.n)||0)>=2)throw Error('Maximum 2 active flows per workspace. Pause a flow first.');
 const mailboxSettings=d=>({dailyLimit:d.dailyLimit,timezone:d.timezone,sendWindowStart:d.sendWindowStart,sendWindowEnd:d.sendWindowEnd,workingDays:d.workingDays});
 for(const other of active){const d=normalizeWorkflowConfig(parse(other.config_json)).delivery;if(await fingerprint(mailboxSettings(d))!==await fingerprint(mailboxSettings(view.config.delivery)))throw Error('Active flows share mailbox limits and sending windows. Match the active flow’s Delivery settings before activation.');}
 const d=view.config.delivery,sharedFollowups=Math.max(d.maxFollowups,...active.map(other=>normalizeWorkflowConfig(parse(other.config_json)).delivery.maxFollowups));const writes=await env.DB.batch([
 env.DB.prepare("UPDATE saved_flows SET status='automatic',approved_by=?,approved_at=COALESCE(approved_at,?),next_run_at=COALESCE(next_run_at,?),updated_at=CURRENT_TIMESTAMP WHERE workspace_id=? AND id=? AND revision=? AND context_hash=?").bind(auth.user.id,new Date().toISOString(),new Date().toISOString(),row.workspace_id,row.id,row.revision,await fingerprint(view.context)),
 env.DB.prepare("INSERT INTO outreach_automation_policies(workspace_id,mode,enabled,paused,emergency_stop,workspace_daily_limit,mailbox_daily_limit,timezone,send_window_start,send_window_end,working_days_json,max_followups,min_delay_minutes,max_delay_minutes,followup_delays_days_json,updated_by) SELECT ?,'automatic',1,0,0,?,?,?,?,?,?,?,8,18,'[3]',? WHERE EXISTS(SELECT 1 FROM saved_flows WHERE workspace_id=? AND id=? AND revision=? AND status='automatic') ON CONFLICT(workspace_id) DO UPDATE SET mode='automatic',enabled=1,paused=0,emergency_stop=0,workspace_daily_limit=excluded.workspace_daily_limit,mailbox_daily_limit=excluded.mailbox_daily_limit,timezone=excluded.timezone,send_window_start=excluded.send_window_start,send_window_end=excluded.send_window_end,working_days_json=excluded.working_days_json,max_followups=excluded.max_followups,min_delay_minutes=8,max_delay_minutes=18,followup_delays_days_json='[3]',updated_by=excluded.updated_by,updated_at=CURRENT_TIMESTAMP").bind(row.workspace_id,d.dailyLimit,d.dailyLimit,d.timezone,d.sendWindowStart,d.sendWindowEnd,JSON.stringify(d.workingDays),sharedFollowups,auth.user.id,row.workspace_id,row.id,row.revision)]);
 if(!writes[0]?.meta?.changes)throw Error('Flow changed. Refresh before activating.');
}
export async function handleSavedFlowRoute(request,env,cors={}){
 const url=new URL(request.url);if(url.pathname!=='/api/flows'&&!url.pathname.startsWith('/api/flows/'))return null;
 const workspaceId=url.searchParams.get('workspace_id')||'',auth=await access(request,env,workspaceId);if(!auth)return json({error:'Authenticated workspace membership required'},401,cors);
 const id=decodeURIComponent(url.pathname.slice('/api/flows/'.length));
 try{
  if(request.method==='GET'){
   if(url.pathname==='/api/flows')return json(await list(env,workspaceId,auth.member.role),200,cors);
   const row=await savedFlowRow(env,workspaceId,id);if(!row)return json({error:'Flow not found'},404,cors);return json({...await savedFlowView(env,row),role:auth.member.role},200,cors);
  }
  if(request.method!=='POST')return json({error:'Not found'},404,cors);
  if(auth.member.role!=='owner')return json({error:'Only the workspace owner can change saved flows'},403,cors);
  const body=await request.json().catch(()=>null);if(!body||typeof body!=='object')return json({error:'Flow action required'},400,cors);
  const state=await getCustomerState(env,workspaceId);
  if(url.pathname==='/api/flows'&&body.action==='create'){
   if(Number(body.workspaceVersion)!==state.version)throw Error('Workspace changed. Save and refresh before creating a flow.');
   const payload=state.payload,context=mainContext(payload),config=normalizeWorkflowConfig(body.config||{},context),newId=crypto.randomUUID();
   await env.DB.prepare("INSERT INTO saved_flows(id,workspace_id,name,payload_json,shared_hash,config_json,context_hash) VALUES(?,?,?,?,?,?,?)").bind(newId,workspaceId,name(body.name),encode(payload),await sharedHash(payload),JSON.stringify(config),await fingerprint(context)).run();
   await audit(env,workspaceId,auth.user.id,'create',newId);return json({id:newId,...await list(env,workspaceId,auth.member.role)},200,cors);
  }
  let row=await savedFlowRow(env,workspaceId,id);if(!row)return json({error:'Flow not found'},404,cors);
  if(body.revision!==row.revision)throw Error('Flow changed. Refresh before continuing.');
  const action=body.action;
  if(action==='duplicate'){
   const payload=FlowState.duplicatePayload(await savedFlowPayload(env,row),body.markets),newId=crypto.randomUUID(),context=mainContext(payload),config=normalizeWorkflowConfig(parse(row.config_json),context);
   await env.DB.prepare("INSERT INTO saved_flows(id,workspace_id,name,payload_json,shared_hash,review_json,config_json,context_hash) VALUES(?,?,?,?,?,?,?,?)").bind(newId,workspaceId,name(body.name),encode(payload),await sharedHash(state.payload),JSON.stringify(FlowState.reviewChecklist(payload)),JSON.stringify(config),await fingerprint(context)).run();
   await audit(env,workspaceId,auth.user.id,action,newId);return json({id:newId,...await list(env,workspaceId,auth.member.role)},200,cors);
  }
  if(action==='open'){
   if(Number(body.workspaceVersion)!==state.version)throw Error('Workspace changed. Save and refresh before switching flows.');
   let payload=await savedFlowPayload(env,row);
   if(Number.isInteger(body.step)&&body.step>=1&&body.step<=7){payload.main.step=body.step;payload.main.visibleStep=body.step;payload.main.activeJourneyStage=body.step;}
   if((row.shared_hash||await sharedHash(decode(row)))!==await sharedHash(state.payload)){payload.main.approved=false;payload.main.targetingConfirmation=null;if(payload.main.market)payload.main.market.strategyApproved=false;}
   const next=await putCustomerState(env,{workspaceId,userId:auth.user.id,expectedVersion:state.version,schemaVersion:1,payload:parse(encode(payload)),role:auth.member.role,allowFlowSwitch:true});if(next.conflict)throw Error('Workspace changed. Save and refresh before switching flows.');
   return json({id:row.id,name:row.name,state:next.state},200,cors);
  }
  if(action==='rename'){
   const update=await env.DB.prepare('UPDATE saved_flows SET name=?,updated_at=CURRENT_TIMESTAMP WHERE workspace_id=? AND id=? AND revision=?').bind(name(body.name),workspaceId,id,row.revision).run();if(!update.meta?.changes)throw Error('Flow changed. Refresh.');
  }else if(action==='review'){
   const required=parse(row.review_json,[]);if(!Array.isArray(body.confirmed)||required.some(item=>!body.confirmed.includes(item.id)))throw Error('Confirm every highlighted review item');
   const context=mainContext(await savedFlowPayload(env,row));if(!context.strategyApproved)throw Error('Open the flow and approve its market strategy before confirming the checklist');
   await env.DB.prepare("UPDATE saved_flows SET review_json='[]',shared_hash=?,updated_at=CURRENT_TIMESTAMP WHERE workspace_id=? AND id=? AND revision=?").bind(await sharedHash(state.payload),workspaceId,id,row.revision).run();
  }else if(action==='save'){
   const context=mainContext(await savedFlowPayload(env,row)),config=normalizeWorkflowConfig(body.config,context),stages=await approvalStatus(context,config,parse(row.approvals_json));
   const approvals=Object.fromEntries(stages.filter(s=>s.approved).map(s=>[s.stage,parse(row.approvals_json)[s.stage]]));
   const update=await env.DB.prepare("UPDATE saved_flows SET config_json=?,approvals_json=?,revision=revision+1,status='needs_review',approved_at=NULL,context_hash=?,shared_hash=?,updated_at=CURRENT_TIMESTAMP WHERE workspace_id=? AND id=? AND revision=?").bind(JSON.stringify(config),JSON.stringify(approvals),await fingerprint(context),await sharedHash(state.payload),workspaceId,id,row.revision).run();if(!update.meta?.changes)throw Error('Flow changed. Refresh.');
  }else if(action==='approve-stage'){
   const view=await savedFlowView(env,row),index=WORKFLOW_STAGES.indexOf(body.stage);if(index<0)throw Error('Unknown stage');if(view.stages.slice(0,index).some(s=>!s.approved))throw Error('Approve preceding stages first');
   if(body.stage==='profile'&&!view.context.profileApproved)throw Error('Approve the company profile first');if(body.stage==='strategy'&&!view.context.strategyApproved)throw Error('Approve the market strategy first');
   if(body.stage==='buyers'&&!view.config.buyers.roles.length)throw Error('Choose buyer roles');if(body.stage==='messages'&&(!view.config.messages.subject||!view.config.messages.body))throw Error('Write and review the template');
   const approvals=parse(row.approvals_json);approvals[body.stage]={hash:view.stages[index].hash,at:new Date().toISOString(),by:auth.user.id};
   const changed=await fingerprint(view.context)!==row.context_hash;
   const update=await env.DB.prepare("UPDATE saved_flows SET approvals_json=?,context_hash=?,shared_hash=?,revision=revision+?,status=CASE WHEN ? THEN 'needs_review' ELSE status END,approved_at=CASE WHEN ? THEN NULL ELSE approved_at END,updated_at=CURRENT_TIMESTAMP WHERE workspace_id=? AND id=? AND revision=?").bind(JSON.stringify(changed?{[body.stage]:approvals[body.stage]}:approvals),await fingerprint(view.context),await sharedHash(state.payload),changed?1:0,changed?1:0,changed?1:0,workspaceId,id,row.revision).run();if(!update.meta?.changes)throw Error('Flow changed. Refresh.');
  }else if(action==='activate'||action==='resume')await activate(env,row,auth,body);
  else if(['pause','manual','stop'].includes(action))await stopFlow(env,row,action);
  else if(action==='run'){
   if(row.status!=='automatic')throw Error('Activate this flow first');await runSavedFlows(env,{workspaceId,flowId:id,maxFlows:1});
  }else if(action==='retry'){
   if(row.status!=='automatic')throw Error('Resume this flow first');await env.DB.prepare("UPDATE approved_workflow_runs SET status='running',error_message=NULL,lease_token=NULL,lease_until=NULL,updated_at=CURRENT_TIMESTAMP WHERE workspace_id=? AND flow_id=? AND id=? AND revision=? AND status='blocked'").bind(workspaceId,id,String(body.runId||''),row.revision).run();
  }else return json({error:'Unknown flow action'},400,cors);
  await audit(env,workspaceId,auth.user.id,action,id);row=await savedFlowRow(env,workspaceId,id);return json({...await savedFlowView(env,row),role:auth.member.role},200,cors);
 }catch(cause){return json({error:String(cause.message||'Could not update flow')},409,cors);}
}
