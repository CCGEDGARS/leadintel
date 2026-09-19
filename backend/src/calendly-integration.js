import {sha256,cookieValue,randomToken,constantTimeEqual} from './security.js';
import {importAesKey,encryptSecret,decryptSecret} from './oauth.js';

const CALENDLY_API='https://api.calendly.com';
const EVENT_TYPES=new Set(['invitee.created','invitee.canceled']);
const json=(value,status=200,headers={})=>new Response(JSON.stringify(value),{status,headers:{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store',...headers}});
const clean=(value,max=1000)=>String(value??'').replace(/[\r\n]+/g,' ').trim().slice(0,max);
const keyHint=value=>`••••${String(value||'').slice(-4)}`;

async function sessionUser(request,env){
  const token=cookieValue(request,'leadintel_session');if(!token)return null;
  const tokenHash=await sha256(token);
  return env.DB.prepare(`SELECT users.id,users.email,users.display_name,users.role,sessions.expires_at FROM sessions JOIN users ON users.id=sessions.user_id WHERE sessions.token_hash=? AND sessions.expires_at>datetime('now')`).bind(tokenHash).first();
}
async function requireOwner(request,env,workspaceId){
  const user=await sessionUser(request,env);if(!user)return {error:'Authentication required',status:401};
  const member=await env.DB.prepare('SELECT role FROM workspace_members WHERE workspace_id=? AND user_id=?').bind(workspaceId,user.id).first();
  if(!member)return {error:'Workspace access denied',status:403};
  if(member.role!=='owner')return {error:'Workspace owner access is required',status:403};
  return {user,member};
}
async function requireMember(request,env,workspaceId){
  const user=await sessionUser(request,env);if(!user)return {error:'Authentication required',status:401};
  const member=await env.DB.prepare('SELECT role FROM workspace_members WHERE workspace_id=? AND user_id=?').bind(workspaceId,user.id).first();
  return member?{user,member}:{error:'Workspace access denied',status:403};
}
async function audit(env,{workspaceId,userId=null,type,metadata={}}){
  try{await env.DB.prepare(`INSERT INTO audit_events(id,workspace_id,user_id,event_type,entity_type,entity_id,metadata_json) VALUES(?,?,?,?,?,?,?)`).bind(crypto.randomUUID(),workspaceId,userId,type,'workspace_calendly_integration',workspaceId,JSON.stringify(metadata)).run();}catch{}
}
function validCalendlyApiUri(value,kind){
  let url;try{url=new URL(String(value||''));}catch{throw new Error(`Calendly ${kind} response is invalid`);}
  if(url.protocol!=='https:'||url.hostname!=='api.calendly.com')throw new Error(`Calendly ${kind} response is invalid`);
  return url.href;
}
export function normalizeCalendlyUrl(value){
  let url;try{url=new URL(String(value||'').trim());}catch{throw new Error('A valid Calendly scheduling URL is required');}
  if(url.protocol!=='https:'||url.hostname.toLowerCase()!=='calendly.com'||url.pathname.split('/').filter(Boolean).length<2)throw new Error('A valid Calendly scheduling URL is required');
  url.hash='';return url.href.replace(/\/$/,'');
}
function validatePersonalAccessToken(value){
  const token=String(value||'').trim();if(token.length<20||token.length>8192||/[\r\n]/.test(token))throw new Error('A valid Calendly personal access token is required');return token;
}
async function calendlyRequest(path,{token,method='GET',body,fetchImpl=fetch}={}){
  const target=path.startsWith(CALENDLY_API)?validCalendlyApiUri(path,'API URI'):`${CALENDLY_API}${path}`;
  const response=await fetchImpl(target,{method,headers:{Accept:'application/json',Authorization:`Bearer ${token}`,...(body?{'Content-Type':'application/json'}:{})},...(body?{body:JSON.stringify(body)}:{})});
  const payload=await response.json().catch(()=>({}));
  if(!response.ok)throw new Error(clean(payload?.message||payload?.title||`Calendly request failed (${response.status})`,180));
  return payload;
}
async function verifyCalendlyToken(token,{fetchImpl=fetch}={}){
  const payload=await calendlyRequest('/users/me',{token,fetchImpl});const resource=payload?.resource||{};
  return {userUri:validCalendlyApiUri(resource.uri,'user'),organizationUri:validCalendlyApiUri(resource.current_organization,'organization'),name:clean(resource.name||resource.email,120)};
}
async function deleteRemoteSubscription(uri,token,fetchImpl=fetch){
  if(!uri||!token)return;try{await calendlyRequest(uri,{token,method:'DELETE',fetchImpl});}catch{}
}
function integrationStatus(row,role){
  return {role,configured:Boolean(row),connected:row?.status==='connected',scheduling_url:row?.scheduling_url||'',token_hint:row?.token_hint||'',verified_at:row?.verified_at||null,last_event_at:row?.last_event_at||null,status:row?.status||'not_connected'};
}
function webhookParts(body){
  const event=clean(body?.event,80);if(!EVENT_TYPES.has(event))return null;
  const payload=body?.payload&&typeof body.payload==='object'?body.payload:{};
  const email=clean(payload.email,320).toLowerCase();
  const inviteeUri=clean(payload.uri,1000);const scheduledEventUri=clean(typeof payload.event==='string'?payload.event:payload.scheduled_event?.uri,1000);
  if(!email||!email.includes('@')||!inviteeUri)return null;
  return {event,payload,email,inviteeUri,scheduledEventUri,createdAt:clean(body.created_at,80)||new Date().toISOString()};
}
async function matchingOutreach(env,workspaceId,email){
  return env.DB.prepare(`SELECT s.id sequence_id,s.domain,s.created_by,c.id company_id,p.id contact_id,c.pipeline_stage
    FROM outreach_automation_sequences s
    LEFT JOIN crm_companies c ON c.workspace_id=s.workspace_id AND c.normalized_domain=lower(s.domain) AND c.deleted_at IS NULL
    LEFT JOIN crm_contacts p ON p.workspace_id=s.workspace_id AND p.company_id=c.id AND lower(p.normalized_email)=lower(s.recipient) AND p.archived_at IS NULL
    WHERE s.workspace_id=? AND lower(s.recipient)=lower(?)
    ORDER BY CASE s.status WHEN 'active' THEN 0 ELSE 1 END,s.created_at DESC LIMIT 1`).bind(workspaceId,email).first();
}
async function insertActivity(env,{id,workspaceId,match,type,parts}){
  if(!match?.company_id)return;
  const title=type==='meeting.booked'?'Calendly meeting booked':'Calendly meeting cancelled';
  await env.DB.prepare(`INSERT OR IGNORE INTO crm_activities(id,workspace_id,company_id,contact_id,activity_type,channel,direction,subject,summary,metadata_json,occurred_at,created_at,actor_user_id) VALUES(?,?,?,?,?,'calendly','inbound',?,?,?, ?,CURRENT_TIMESTAMP,?)`)
    .bind(id,workspaceId,match.company_id,match.contact_id||null,type,title,title,JSON.stringify({invitee_uri:parts.inviteeUri,scheduled_event_uri:parts.scheduledEventUri,invitee_email:parts.email,automation_sequence_id:match.sequence_id}),parts.createdAt,match.created_by||null).run();
}
export async function processCalendlyWebhook(env,{workspaceId,secret,body}){
  const row=await env.DB.prepare(`SELECT * FROM workspace_calendly_integrations WHERE workspace_id=? AND status='connected'`).bind(workspaceId).first();
  if(!row||!secret||!constantTimeEqual(await sha256(secret),row.webhook_secret_hash))return {accepted:false,reason:'unauthorized'};
  const parts=webhookParts(body);if(!parts)return {accepted:false,reason:'unsupported_event'};
  const eventId=`cal-${await sha256(`${workspaceId}|${parts.event}|${parts.inviteeUri}|${parts.createdAt}`)}`;
  const duplicate=await env.DB.prepare('SELECT id FROM calendly_webhook_events WHERE id=?').bind(eventId).first();
  if(duplicate)return {accepted:true,duplicate:true,matched:true,event:parts.event};
  const match=await matchingOutreach(env,workspaceId,parts.email);
  if(match){
    if(parts.event==='invitee.created'){
      await env.DB.prepare(`UPDATE outreach_automation_queue SET status='skipped',last_error_code='meeting_booked',last_error_message='Pending automatic follow-up cancelled because a Calendly meeting was booked',updated_at=CURRENT_TIMESTAMP WHERE sequence_id IN (SELECT id FROM outreach_automation_sequences WHERE workspace_id=? AND lower(recipient)=lower(?)) AND status IN ('queued','waiting_window','blocked_limit','failed')`).bind(workspaceId,parts.email).run();
      await env.DB.prepare(`UPDATE outreach_automation_sequences SET status='cancelled',stop_reason='meeting_booked',updated_at=CURRENT_TIMESTAMP WHERE workspace_id=? AND lower(recipient)=lower(?) AND status='active'`).bind(workspaceId,parts.email).run();
      if(match.company_id&&!['Meeting','Proposal','Won','Lost'].includes(match.pipeline_stage))await env.DB.prepare(`UPDATE crm_companies SET pipeline_stage='Meeting',updated_at=CURRENT_TIMESTAMP WHERE id=? AND workspace_id=?`).bind(match.company_id,workspaceId).run();
      await insertActivity(env,{id:`${eventId}-booked`,workspaceId,match,type:'meeting.booked',parts});
    }else await insertActivity(env,{id:`${eventId}-cancelled`,workspaceId,match,type:'meeting.cancelled',parts});
  }
  await env.DB.prepare(`INSERT OR IGNORE INTO calendly_webhook_events(id,workspace_id,event_type,invitee_uri,scheduled_event_uri,invitee_email,payload_json,received_at,processed_at) VALUES(?,?,?,?,?,?,?,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP)`).bind(eventId,workspaceId,parts.event,parts.inviteeUri,parts.scheduledEventUri||null,parts.email,JSON.stringify(body)).run();
  await env.DB.prepare(`UPDATE workspace_calendly_integrations SET last_event_at=CURRENT_TIMESTAMP,updated_at=CURRENT_TIMESTAMP WHERE workspace_id=?`).bind(workspaceId).run();
  await audit(env,{workspaceId,userId:match?.created_by||null,type:parts.event==='invitee.created'?'calendly.meeting_booked':'calendly.meeting_cancelled',metadata:{matched:Boolean(match),invitee_email:parts.email,sequence_id:match?.sequence_id||null,company_id:match?.company_id||null}});
  return {accepted:true,duplicate:false,matched:Boolean(match),event:parts.event};
}
export async function handleCalendlyWebhook(request,env){
  if(request.method!=='POST')return json({error:'Method not allowed'},405);
  const segments=new URL(request.url).pathname.split('/').filter(Boolean);const workspaceId=clean(segments[3],120),secret=clean(segments[4],200);
  if(!workspaceId||!secret)return json({error:'Webhook not found'},404);
  const body=await request.json().catch(()=>null);if(!body)return json({error:'Invalid JSON payload'},400);
  const result=await processCalendlyWebhook(env,{workspaceId,secret,body});
  if(!result.accepted&&result.reason==='unauthorized')return json({error:'Unauthorized'},401);
  if(!result.accepted)return json({received:true,ignored:true,reason:result.reason},202);
  return json({received:true,duplicate:result.duplicate,matched:result.matched},200);
}
export async function handleCalendlyIntegrationRoute(request,env,cors={}){
  const url=new URL(request.url);if(!url.pathname.startsWith('/api/integrations/calendly/'))return null;
  const workspaceId=clean(url.searchParams.get('workspace_id'),120);if(!workspaceId)return json({error:'workspace_id is required'},400,cors);
  if(url.pathname==='/api/integrations/calendly/status'&&request.method==='GET'){
    const access=await requireMember(request,env,workspaceId);if(access.error)return json({error:access.error},access.status,cors);
    const row=await env.DB.prepare('SELECT scheduling_url,token_hint,status,verified_at,last_event_at FROM workspace_calendly_integrations WHERE workspace_id=?').bind(workspaceId).first();
    return json(integrationStatus(row,access.member.role),200,cors);
  }
  if(url.pathname==='/api/integrations/calendly/connect'&&request.method==='PUT'){
    const access=await requireOwner(request,env,workspaceId);if(access.error)return json({error:access.error},access.status,cors);
    if(!String(env.OAUTH_TOKEN_ENCRYPTION_KEY||'').trim())return json({error:'Credential encryption is not configured'},503,cors);
    const body=await request.json().catch(()=>null);let token,schedulingUrl;
    try{token=validatePersonalAccessToken(body?.personal_access_token);schedulingUrl=normalizeCalendlyUrl(body?.scheduling_url);}catch(error){return json({error:error.message},400,cors);}
    let identity;try{identity=await verifyCalendlyToken(token);}catch(error){return json({error:error.message},422,cors);}
    const secret=randomToken(32);const callback=`${url.origin}/api/webhooks/calendly/${encodeURIComponent(workspaceId)}/${secret}`;
    let subscription;try{subscription=await calendlyRequest('/webhook_subscriptions',{token,method:'POST',body:{url:callback,events:['invitee.created','invitee.canceled'],organization:identity.organizationUri,user:identity.userUri,scope:'user'}});}catch(error){return json({error:error.message},422,cors);}
    const subscriptionUri=validCalendlyApiUri(subscription?.resource?.uri,'webhook subscription');
    const previous=await env.DB.prepare('SELECT encrypted_personal_access_token,webhook_subscription_uri FROM workspace_calendly_integrations WHERE workspace_id=?').bind(workspaceId).first();
    try{
      const key=await importAesKey(env.OAUTH_TOKEN_ENCRYPTION_KEY);const encrypted=await encryptSecret(token,key);
      await env.DB.prepare(`INSERT INTO workspace_calendly_integrations(workspace_id,scheduling_url,encrypted_personal_access_token,token_hint,user_uri,organization_uri,webhook_subscription_uri,webhook_secret_hash,status,verified_at,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,'connected',CURRENT_TIMESTAMP,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP) ON CONFLICT(workspace_id) DO UPDATE SET scheduling_url=excluded.scheduling_url,encrypted_personal_access_token=excluded.encrypted_personal_access_token,token_hint=excluded.token_hint,user_uri=excluded.user_uri,organization_uri=excluded.organization_uri,webhook_subscription_uri=excluded.webhook_subscription_uri,webhook_secret_hash=excluded.webhook_secret_hash,status='connected',verified_at=CURRENT_TIMESTAMP,updated_at=CURRENT_TIMESTAMP`).bind(workspaceId,schedulingUrl,encrypted,keyHint(token),identity.userUri,identity.organizationUri,subscriptionUri,await sha256(secret)).run();
      if(previous?.webhook_subscription_uri&&previous.encrypted_personal_access_token){try{const oldToken=await decryptSecret(previous.encrypted_personal_access_token,key);await deleteRemoteSubscription(previous.webhook_subscription_uri,oldToken);}catch{}}
      await audit(env,{workspaceId,userId:access.user.id,type:'calendly.connected',metadata:{scheduling_url:schedulingUrl}});
      return json({...integrationStatus({scheduling_url:schedulingUrl,token_hint:keyHint(token),status:'connected',verified_at:new Date().toISOString(),last_event_at:null},access.member.role),name:identity.name},200,cors);
    }catch(error){await deleteRemoteSubscription(subscriptionUri,token);return json({error:'Unable to save Calendly configuration'},500,cors);}
  }
  if(url.pathname==='/api/integrations/calendly/disconnect'&&request.method==='DELETE'){
    const access=await requireOwner(request,env,workspaceId);if(access.error)return json({error:access.error},access.status,cors);
    const row=await env.DB.prepare('SELECT encrypted_personal_access_token,webhook_subscription_uri FROM workspace_calendly_integrations WHERE workspace_id=?').bind(workspaceId).first();
    if(row&&env.OAUTH_TOKEN_ENCRYPTION_KEY){try{const key=await importAesKey(env.OAUTH_TOKEN_ENCRYPTION_KEY);const token=await decryptSecret(row.encrypted_personal_access_token,key);await deleteRemoteSubscription(row.webhook_subscription_uri,token);}catch{}}
    const result=await env.DB.prepare('DELETE FROM workspace_calendly_integrations WHERE workspace_id=?').bind(workspaceId).run();
    await audit(env,{workspaceId,userId:access.user.id,type:'calendly.disconnected'});
    return json({disconnected:Number(result?.meta?.changes||0)>0},200,cors);
  }
  return json({error:'Not found'},404,cors);
}
