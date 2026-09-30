import {allowedOrigin,corsHeaders,sha256,cookieValue} from './security.js';
import {normalizeEmail} from './gmail.js';
import {isContactSuppressed,suppressContact} from './contact-suppression.js';
import {validateEmailContent} from './email-content.js';
import {defaultAutomationPolicy,normalizeAutomationPolicy,localClockParts,nextEnabledWindow,automaticGmailDeliveryEnabled} from './outreach-automation.js';

const uuid=()=>crypto.randomUUID();
const json=(value,status=200,headers={})=>new Response(JSON.stringify(value),{status,headers:{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store',...headers}});
const error=(message,status,headers,extra={})=>json({error:message,...extra},status,headers);

async function sessionUser(request,env){const token=cookieValue(request,'leadintel_session');if(!token)return null;const tokenHash=await sha256(token);return env.DB.prepare(`SELECT users.id,users.email,users.display_name,users.role,sessions.expires_at FROM sessions JOIN users ON users.id=sessions.user_id WHERE sessions.token_hash=? AND sessions.expires_at>datetime('now')`).bind(tokenHash).first();}
async function membership(env,workspaceId,userId){return env.DB.prepare('SELECT role FROM workspace_members WHERE workspace_id=? AND user_id=?').bind(workspaceId,userId).first();}
async function requireMember(request,env,workspaceId,roles=[]){const user=await sessionUser(request,env);if(!user)return {error:'Authentication required',status:401};const member=await membership(env,workspaceId,user.id);if(!member)return {error:'Workspace access denied',status:403};if(roles.length&&!roles.includes(member.role))return {error:'Workspace role is not permitted',status:403};return {user,member};}
async function audit(env,{workspaceId,userId,type,entityType='outreach_automation_policy',entityId=workspaceId,metadata={}}){await env.DB.prepare(`INSERT INTO audit_events(id,workspace_id,user_id,event_type,entity_type,entity_id,metadata_json) VALUES(?,?,?,?,?,?,?)`).bind(uuid(),workspaceId,userId,type,entityType,entityId,JSON.stringify(metadata)).run();}

function parseJsonArray(value,fallback){try{const parsed=JSON.parse(String(value??''));return Array.isArray(parsed)?parsed:fallback;}catch{return fallback;}}
function rowToPolicy(row){if(!row)return defaultAutomationPolicy();return normalizeAutomationPolicy({
  mode:row.mode,enabled:Boolean(row.enabled),paused:Boolean(row.paused),emergencyStop:Boolean(row.emergency_stop),
  workspaceDailyLimit:Number(row.workspace_daily_limit),mailboxDailyLimit:Number(row.mailbox_daily_limit),
  workingDays:parseJsonArray(row.working_days_json,[1,2,3,4,5]),timezone:row.timezone,
  sendWindowStart:row.send_window_start,sendWindowEnd:row.send_window_end,minDelayMinutes:Number(row.min_delay_minutes),maxDelayMinutes:Number(row.max_delay_minutes),
  maxFollowups:Number(row.max_followups),followupDelaysDays:parseJsonArray(row.followup_delays_days_json,[3,7]),replyPollIntervalMinutes:Number(row.reply_poll_interval_minutes)
},defaultAutomationPolicy());}
async function policyRow(env,workspaceId){return env.DB.prepare(`SELECT * FROM outreach_automation_policies WHERE workspace_id=?`).bind(workspaceId).first();}
async function policyFor(env,workspaceId){return rowToPolicy(await policyRow(env,workspaceId));}
function exposedPolicy(env,policy){const manualOnly=!automaticGmailDeliveryEnabled(env);return {...policy,mode:manualOnly?'manual':policy.mode,enabled:manualOnly?false:policy.enabled,automaticDelivery:manualOnly?'manual_only':'enabled'};}
function safeNow(env){const injected=String(env.OUTREACH_AUTOMATION_TEST_NOW||'').trim();const date=injected?new Date(injected):new Date();return Number.isFinite(date.getTime())?date:new Date();}
function zonedLocalToUtc({year,month,day,hour=0,minute=0},timeZone){const target=Date.UTC(year,month-1,day,hour,minute);let guess=target;for(let i=0;i<4;i++){const observed=localClockParts(new Date(guess),timeZone);const observedUtc=Date.UTC(observed.year,observed.month-1,observed.day,observed.hour,observed.minute);const diff=target-observedUtc;if(!diff)break;guess+=diff;}return new Date(guess);}
function localDayBounds(now,timeZone){const local=localClockParts(now,timeZone);const start=zonedLocalToUtc({year:local.year,month:local.month,day:local.day},timeZone);const nextCalendar=new Date(Date.UTC(local.year,local.month-1,local.day+1));const end=zonedLocalToUtc({year:nextCalendar.getUTCFullYear(),month:nextCalendar.getUTCMonth()+1,day:nextCalendar.getUTCDate()},timeZone);return {start:start.toISOString(),end:end.toISOString()};}
function normalizeDomain(value){return String(value||'').trim().toLowerCase().replace(/^https?:\/\//,'').replace(/^www\./,'').split(/[/?#]/)[0].slice(0,253);}
function cleanText(value,max){return String(value??'').trim().slice(0,max);}
function safeIso(value){const date=new Date(value);return Number.isFinite(date.getTime())?date.toISOString():'';}

async function savePolicy(env,workspaceId,userId,policy){await env.DB.prepare(`INSERT INTO outreach_automation_policies(workspace_id,mode,enabled,paused,emergency_stop,workspace_daily_limit,mailbox_daily_limit,working_days_json,timezone,send_window_start,send_window_end,min_delay_minutes,max_delay_minutes,max_followups,followup_delays_days_json,reply_poll_interval_minutes,updated_by,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,CURRENT_TIMESTAMP) ON CONFLICT(workspace_id) DO UPDATE SET mode=excluded.mode,enabled=excluded.enabled,paused=excluded.paused,emergency_stop=excluded.emergency_stop,workspace_daily_limit=excluded.workspace_daily_limit,mailbox_daily_limit=excluded.mailbox_daily_limit,working_days_json=excluded.working_days_json,timezone=excluded.timezone,send_window_start=excluded.send_window_start,send_window_end=excluded.send_window_end,min_delay_minutes=excluded.min_delay_minutes,max_delay_minutes=excluded.max_delay_minutes,max_followups=excluded.max_followups,followup_delays_days_json=excluded.followup_delays_days_json,reply_poll_interval_minutes=excluded.reply_poll_interval_minutes,updated_by=excluded.updated_by,updated_at=CURRENT_TIMESTAMP`).bind(workspaceId,policy.mode,policy.enabled?1:0,policy.paused?1:0,policy.emergencyStop?1:0,policy.workspaceDailyLimit,policy.mailboxDailyLimit,JSON.stringify(policy.workingDays),policy.timezone,policy.sendWindowStart,policy.sendWindowEnd,policy.minDelayMinutes,policy.maxDelayMinutes,policy.maxFollowups,JSON.stringify(policy.followupDelaysDays),policy.replyPollIntervalMinutes,userId).run();}

async function enqueueSequence(request,env,cors,workspaceId){
  const access=await requireMember(request,env,workspaceId,['owner']);if(access.error)return error(access.error,access.status,cors);
  const body=await request.json().catch(()=>null);if(!body)return error('Approved outreach snapshot is required',400,cors);
  const policy=await policyFor(env,workspaceId);if(!automaticGmailDeliveryEnabled(env))return error('Automatic Gmail delivery is disabled. Use the explicit Send with Gmail action instead.',409,cors,{code:'AUTOMATIC_GMAIL_DISABLED'});if(policy.mode!=='automatic'||!policy.enabled)return error('Automatic outreach is not enabled for this workspace',409,cors,{code:'AUTOMATION_DISABLED'});
  if(policy.paused)return error('Automatic outreach is paused',409,cors,{code:'AUTOMATION_PAUSED'});
  if(policy.emergencyStop)return error('Automatic outreach emergency stop is active',409,cors,{code:'AUTOMATION_EMERGENCY_STOP'});
  if(body.approved!==true)return error('Explicitly approved outreach is required',400,cors,{code:'OUTREACH_NOT_APPROVED'});
  const domain=normalizeDomain(body.domain),recipient=normalizeEmail(body.recipient),subject=cleanText(body.subject,500),messageBody=cleanText(body.body,100000),followupBody=cleanText(body.followup_body,100000),approvedAt=safeIso(body.approved_at),contactIdentity=cleanText(body.contact_identity,500);
  if(!domain||!recipient||!subject||!messageBody||!approvedAt)return error('Valid domain, recipient, subject, body and approval timestamp are required',400,cors);
  let messageHtml='',followupHtml='';try{messageHtml=validateEmailContent({body:messageBody,html_body:body.html_body}).htmlBody;if(followupBody)followupHtml=validateEmailContent({body:followupBody,html_body:body.followup_html_body}).htmlBody;}catch(cause){return error(String(cause?.message||'Invalid email content'),400,cors,{code:'AUTOMATION_EMAIL_CONTENT_INVALID'});}
  const connection=await env.DB.prepare(`SELECT workspace_id,google_email,status FROM gmail_connections WHERE workspace_id=? AND status='connected'`).bind(workspaceId).first();if(!connection)return error('Gmail is not connected for this workspace',409,cors,{code:'GMAIL_NOT_CONNECTED'});
  const company=await env.DB.prepare(`SELECT id,lifecycle_status FROM crm_companies WHERE workspace_id=? AND normalized_domain=? AND deleted_at IS NULL LIMIT 1`).bind(workspaceId,domain).first();if(company?.lifecycle_status==='suppressed')return error('Suppressed companies cannot receive automated outreach',409,cors,{code:'CRM_COMPANY_SUPPRESSED'});
  if(!company)return error('Save the target company in CRM before automatic delivery',409,cors,{code:'CRM_COMPANY_REQUIRED'});
  if(await isContactSuppressed(env.DB,workspaceId,recipient))return error('Contact is on the do-not-contact list',409,cors,{code:'CONTACT_SUPPRESSED'});
  const verified=await env.DB.prepare(`SELECT id FROM crm_contacts WHERE workspace_id=? AND company_id=? AND normalized_email=? AND LOWER(email_status)='verified' AND archived_at IS NULL LIMIT 1`).bind(workspaceId,company.id,recipient).first();
  if(!verified)return error('Automatic delivery requires a verified work email on this CRM company',409,cors,{code:'CRM_EMAIL_NOT_VERIFIED'});
  const sourcePackageKey=await sha256(`${workspaceId}|${domain}|${recipient}|${approvedAt}`);const sequenceId=`auto-seq-${sourcePackageKey.slice(0,24)}`;const queueId=`auto-q-${sourcePackageKey.slice(0,24)}-0`;const idempotencyKey=`auto-${sourcePackageKey}-0`;
  const existing=await env.DB.prepare(`SELECT * FROM outreach_automation_sequences WHERE workspace_id=? AND source_package_key=?`).bind(workspaceId,sourcePackageKey).first();
  if(existing){const {results=[]}=await env.DB.prepare(`SELECT * FROM outreach_automation_queue WHERE sequence_id=? ORDER BY step_index`).bind(existing.id).all();return json({sequence:existing,queue_items:results,duplicate:true},200,cors);}
  const previous=await env.DB.prepare(`SELECT id FROM outreach_automation_sequences WHERE workspace_id=? AND recipient=? AND status IN ('active','completed','stopped_reply') LIMIT 1`).bind(workspaceId,recipient).first();
  const alreadySent=await env.DB.prepare(`SELECT id FROM gmail_messages WHERE workspace_id=? AND recipient=? AND status='sent' LIMIT 1`).bind(workspaceId,recipient).first();
  if(previous||alreadySent)return error('This recipient already has outreach recorded; review before sending again',409,cors,{code:'AUTOMATION_RECIPIENT_ALREADY_CONTACTED'});
  const now=safeNow(env);let scheduled;try{scheduled=nextEnabledWindow(policy,now);}catch{return error('No eligible automatic sending window is available',409,cors,{code:'NO_SEND_WINDOW'});}
  const statements=[
    env.DB.prepare(`INSERT OR IGNORE INTO outreach_automation_sequences(id,workspace_id,gmail_connection_workspace_id,source_package_key,domain,recipient,contact_identity,approved_at,initial_subject,initial_body,followup_body,followup_html_body,status,created_by) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?)`).bind(sequenceId,workspaceId,connection.workspace_id,sourcePackageKey,domain,recipient,contactIdentity,approvedAt,subject,messageBody,followupBody,followupHtml,'active',access.user.id),
    env.DB.prepare(`INSERT OR IGNORE INTO outreach_automation_queue(id,workspace_id,sequence_id,gmail_connection_workspace_id,step_index,recipient,subject,body,html_body,status,earliest_send_at,scheduled_send_at,idempotency_key) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?)`).bind(queueId,workspaceId,sequenceId,connection.workspace_id,0,recipient,subject,messageBody,messageHtml,'queued',scheduled,scheduled,idempotencyKey)
  ];
  const results=await env.DB.batch(statements);const inserted=Number(results?.[0]?.meta?.changes||0)>0;
  const sequence=await env.DB.prepare(`SELECT * FROM outreach_automation_sequences WHERE id=?`).bind(sequenceId).first();const {results:queueItems=[]}=await env.DB.prepare(`SELECT * FROM outreach_automation_queue WHERE sequence_id=? ORDER BY step_index`).bind(sequenceId).all();
  if(!sequence||!queueItems.length)return error('Unable to create automated outreach sequence',500,cors);
  if(inserted)await audit(env,{workspaceId,userId:access.user.id,type:'outreach_automation.sequence_enqueued',entityType:'outreach_automation_sequence',entityId:sequenceId,metadata:{domain,recipient,approved_at:approvedAt,queue_item_ids:queueItems.map(item=>item.id)}});
  return json({sequence,queue_items:queueItems,duplicate:!inserted},inserted?201:200,cors);
}

export async function handleOutreachAutomationRoute(request,env,corsOverride){
  const url=new URL(request.url);const path=url.pathname;if(!path.startsWith('/api/outreach-automation/'))return null;
  const cors=corsOverride??corsHeaders(allowedOrigin(request,env.APP_ORIGIN));const workspaceId=url.searchParams.get('workspace_id')||'';
  if(path==='/api/outreach-automation/suppression'&&request.method==='GET'){
    const access=await requireMember(request,env,workspaceId);if(access.error)return error(access.error,access.status,cors);
    const {results=[]}=await env.DB.prepare('SELECT email,reason,source,created_at,updated_at FROM outreach_contact_suppression WHERE workspace_id=? ORDER BY updated_at DESC LIMIT 200').bind(workspaceId).all();
    return json({contacts:results},200,cors);
  }
  if(path==='/api/outreach-automation/suppression'&&request.method==='POST'){
    const access=await requireMember(request,env,workspaceId,['owner']);if(access.error)return error(access.error,access.status,cors);
    const body=await request.json().catch(()=>null);const address=normalizeEmail(body?.email);if(!address)return error('Valid contact email is required',400,cors);
    const reason=['manual','objection'].includes(body?.reason)?body.reason:'manual';
    const email=await suppressContact(env.DB,workspaceId,address,{reason,source:'workspace_owner'});
    await audit(env,{workspaceId,userId:access.user.id,type:'outreach.contact_suppressed',entityType:'contact_suppression',entityId:email,metadata:{reason}});
    return json({email,suppressed:true},200,cors);
  }
  if(path==='/api/outreach-automation/policy'&&request.method==='GET'){
    const access=await requireMember(request,env,workspaceId);if(access.error)return error(access.error,access.status,cors);
    const row=await policyRow(env,workspaceId);return json({policy:exposedPolicy(env,rowToPolicy(row)),role:access.member.role,updatedAt:row?.updated_at||null},200,cors);
  }
  if(path==='/api/outreach-automation/policy'&&request.method==='PUT'){
    const access=await requireMember(request,env,workspaceId,['owner']);if(access.error)return error(access.error,access.status,cors);const body=await request.json().catch(()=>null);if(!body)return error('Automation policy payload is required',400,cors);if(!automaticGmailDeliveryEnabled(env)&&(body.mode==='automatic'||body.enabled===true))return error('Automatic Gmail delivery is disabled. Use the explicit Send with Gmail action instead.',409,cors);
    const before=await policyFor(env,workspaceId);let after;try{after=normalizeAutomationPolicy(body,before);}catch(cause){return error(String(cause?.message||'Invalid automation policy'),400,cors);}
    await savePolicy(env,workspaceId,access.user.id,after);await audit(env,{workspaceId,userId:access.user.id,type:'outreach_automation.policy_updated',metadata:{before,after}});return json({policy:exposedPolicy(env,after),role:access.member.role},200,cors);
  }
  if(path==='/api/outreach-automation/status'&&request.method==='GET'){
    const access=await requireMember(request,env,workspaceId);if(access.error)return error(access.error,access.status,cors);const policy=await policyFor(env,workspaceId);const now=safeNow(env);const bounds=localDayBounds(now,policy.timezone);
    const sent=await env.DB.prepare(`SELECT COUNT(*) count FROM gmail_messages WHERE workspace_id=? AND status='sent' AND sent_at>=? AND sent_at<?`).bind(workspaceId,bounds.start,bounds.end).first();
    const connection=await env.DB.prepare(`SELECT google_email FROM gmail_connections WHERE workspace_id=? AND status='connected'`).bind(workspaceId).first();
    const queue=await env.DB.prepare(`SELECT SUM(CASE WHEN status IN ('queued','waiting_window') THEN 1 ELSE 0 END) queued,SUM(CASE WHEN status='blocked_limit' THEN 1 ELSE 0 END) blocked,MIN(CASE WHEN status IN ('queued','waiting_window','blocked_limit') THEN scheduled_send_at END) next_send FROM outreach_automation_queue WHERE workspace_id=?`).bind(workspaceId).first();
    const outcomes=await env.DB.prepare(`SELECT (SELECT COUNT(*) FROM outreach_automation_queue WHERE workspace_id=? AND status='sent') sent,(SELECT COUNT(*) FROM outreach_automation_queue WHERE workspace_id=? AND status='failed') failed,(SELECT COUNT(*) FROM outreach_automation_processed_replies WHERE workspace_id=?) replies,(SELECT COUNT(*) FROM outreach_automation_processed_replies WHERE workspace_id=? AND category IN ('positive','meeting_request')) interested,(SELECT COUNT(*) FROM outreach_automation_processed_replies WHERE workspace_id=? AND category='meeting_request') meetings`).bind(workspaceId,workspaceId,workspaceId,workspaceId,workspaceId).first();
    const count=Number(sent?.count)||0;return json({policy:exposedPolicy(env,policy),role:access.member.role,usage:{workspaceSentToday:count,workspaceLimit:policy.workspaceDailyLimit,mailboxSentToday:count,mailboxLimit:policy.mailboxDailyLimit,mailboxEmail:connection?.google_email||''},queue:{queued:Number(queue?.queued)||0,blockedByLimit:Number(queue?.blocked)||0,nextEligibleSendAt:queue?.next_send||null},activity:{sent:Number(outcomes?.sent)||0,failed:Number(outcomes?.failed)||0,replies:Number(outcomes?.replies)||0,interested:Number(outcomes?.interested)||0,meetingRequests:Number(outcomes?.meetings)||0},day:{start:bounds.start,end:bounds.end,timezone:policy.timezone}},200,cors);
  }
  if(path==='/api/outreach-automation/sequences'&&request.method==='POST')return enqueueSequence(request,env,cors,workspaceId);
  return error('Not found',404,cors);
}
