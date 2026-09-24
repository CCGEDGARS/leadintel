import {sha256,cookieValue} from './security.js';
import {buildApolloMatchUrl,provenBusinessEmail,publicPersonSummary,strongPersonalEmail} from './enrichment.js';
import {apolloWebhookSigningSecret,buildApolloCrmWebhookUrl,handleApolloCrmWebhook} from './apollo-crm-webhook.js';
import {
  listCrmCompanies,listCrmActivities,getCrmCompany,upsertCrmCompany,updateCrmCompany,
  setCrmPipelineStage,removeCrmFromPipeline,archiveCrmCompany,restoreCrmCompany,
  suppressCrmCompany,markCrmCustomer,deleteCrmCompany,upsertCrmContacts,
  patchCrmContact,archiveCrmContact,appendCrmActivity
} from './crm.js';

export {handleApolloCrmWebhook};

const json=(value,status=200,headers={})=>new Response(JSON.stringify(value),{status,headers:{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store',...headers}});
const error=(message,status,headers,code)=>json({error:message,...(code?{code}:{})},status,headers);
const uuid=()=>crypto.randomUUID();
const stamp=()=>new Date().toISOString();
const clean=(value,max=1000)=>String(value??'').replace(/\s+/g,' ').trim().slice(0,max);

async function sessionUser(request,env){const token=cookieValue(request,'leadintel_session');if(!token)return null;const tokenHash=await sha256(token);return env.DB.prepare(`SELECT users.id,users.email,users.display_name,users.role,sessions.expires_at FROM sessions JOIN users ON users.id=sessions.user_id WHERE sessions.token_hash=? AND sessions.expires_at>datetime('now')`).bind(tokenHash).first();}
async function membership(env,workspaceId,userId){return env.DB.prepare('SELECT role FROM workspace_members WHERE workspace_id=? AND user_id=?').bind(workspaceId,userId).first();}
async function requireMember(request,env,workspaceId,roles=[]){const user=await sessionUser(request,env);if(!user)return {error:'Authentication required',status:401};const member=await membership(env,workspaceId,user.id);if(!member)return {error:'Workspace access denied',status:403};if(roles.length&&!roles.includes(member.role))return {error:'Workspace role is not permitted',status:403};return {user,member,context:{workspaceId,userId:user.id,role:member.role}};}
function routeError(cause,cors){const status=Number(cause?.status)||500;const safeStatus=status>=400&&status<600?status:500;return error(safeStatus===500?'Internal server error':String(cause?.message||'CRM request failed'),safeStatus,cors,cause?.code);}
function workspace(url){return String(url.searchParams.get('workspace_id')||'').trim();}
function parseCompanyPath(path){const match=path.match(/^\/api\/crm\/companies\/([^/]+)(?:\/(pipeline|archive|restore|suppress|mark-customer|contacts|activities|enrich-contact))?$/);return match?{id:decodeURIComponent(match[1]),action:match[2]||''}:null;}
function parseContactPath(path){const match=path.match(/^\/api\/crm\/contacts\/([^/]+)$/);return match?{id:decodeURIComponent(match[1])}:null;}
const WRITER_ROLES=['owner','researcher','sales'];
const CLIENT_ACTIVITY_TYPES=new Set(['dossier.built','content.approved','email.sent','email.reply_received','meeting.recorded','proposal.recorded','deal.won','deal.lost']);

function isHttpsUrl(value){try{return new URL(String(value||'')).protocol==='https:';}catch{return false;}}
async function crmEnrichmentUsage(db,workspaceId){const daily=await db.prepare(`SELECT COALESCE(SUM(credits_reserved),0) value FROM crm_enrichment_requests WHERE workspace_id=? AND created_at>=date('now') AND status NOT IN ('cancelled','failed')`).bind(workspaceId).first();const monthly=await db.prepare(`SELECT COALESCE(SUM(credits_reserved),0) value FROM crm_enrichment_requests WHERE workspace_id=? AND created_at>=date('now','start of month') AND status NOT IN ('cancelled','failed')`).bind(workspaceId).first();return {daily:Number(daily?.value)||0,monthly:Number(monthly?.value)||0};}
function immediateApolloCredits(person){return person&&clean(person.id||person.person_id,180)?1:0;}

async function enrichCrmContact(request,env,cors,access,companyId){
  const body=await request.json().catch(()=>null);if(!body||typeof body!=='object')return error('Apollo person selection is required',400,cors,'CRM_ENRICHMENT_PAYLOAD_REQUIRED');
  const detail=await getCrmCompany(env.DB,access.context,companyId);const company=detail.company;
  if(company.lifecycle_status==='suppressed')return error('Suppressed companies cannot be enriched',409,cors,'CRM_COMPANY_SUPPRESSED');
  const domain=clean(company.normalized_domain,253);if(!domain)return error('A verified company domain is required before enrichment',409,cors,'CRM_COMPANY_DOMAIN_REQUIRED');
  const personId=clean(body.person_id||body.personId,180);if(!personId)return error('Apollo person ID is required',400,cors,'CRM_APOLLO_PERSON_REQUIRED');
  if(!env.APOLLO_API_KEY)return error('Apollo API connection is not configured',503,cors,'CRM_APOLLO_NOT_CONFIGURED');

  const policy=await env.DB.prepare(`SELECT daily_credit_limit,monthly_credit_limit,retry_after_days,allow_personal_email,phone_lookup_mode FROM enrichment_policies WHERE workspace_id=?`).bind(access.context.workspaceId).first();
  if(!policy)return error('Apollo enrichment policy is not configured',503,cors,'CRM_ENRICHMENT_POLICY_MISSING');
  const personalRequested=Boolean(body.allow_personal_email);if(personalRequested&&access.context.role!=='owner')return error('Only the workspace owner can approve a personal-email exception',403,cors,'CRM_PERSONAL_EMAIL_OWNER_ONLY');
  const personalApproved=personalRequested&&Boolean(policy.allow_personal_email);
  const phoneRequested=Boolean(body.phone_lookup||body.phoneLookup);
  if(phoneRequested&&String(policy.phone_lookup_mode||'on_request')==='disabled')return error('Phone enrichment is disabled by workspace policy',409,cors,'CRM_PHONE_LOOKUP_DISABLED');
  if(phoneRequested&&!isHttpsUrl(env.APOLLO_WEBHOOK_URL))return error('Apollo phone enrichment requires a configured HTTPS webhook',409,cors,'CRM_APOLLO_WEBHOOK_REQUIRED');
  const webhookSecret=apolloWebhookSigningSecret(env);
  if(phoneRequested&&!webhookSecret)return error('Apollo phone enrichment requires server signing material',409,cors,'CRM_APOLLO_WEBHOOK_SECRET_REQUIRED');

  const existing=await env.DB.prepare(`SELECT * FROM crm_contacts WHERE workspace_id=? AND company_id=? AND source='apollo' AND external_person_id=? AND archived_at IS NULL AND normalized_email IS NOT NULL`).bind(access.context.workspaceId,companyId,personId).first();
  if(existing&&!phoneRequested)return json({request:{status:'already_verified',credits_used:0},contact:existing,duplicate:true},200,cors);

  const reserved=phoneRequested?9:1;const usage=await crmEnrichmentUsage(env.DB,access.context.workspaceId);
  if(usage.daily+reserved>Number(policy.daily_credit_limit)||usage.monthly+reserved>Number(policy.monthly_credit_limit))return error('Apollo enrichment blocked by workspace credit limit',429,cors,'CRM_APOLLO_CREDIT_LIMIT');

  const requestId=`CRM-ENR-${uuid()}`;const role=clean(body.title||body.role,180)||'Decision maker';const created=stamp();
  await env.DB.prepare(`INSERT INTO crm_enrichment_requests(id,workspace_id,company_id,contact_id,provider,person_provider_id,role_requested,status,personal_email_requested,phone_requested,credits_reserved,credits_used,response_summary_json,requested_by,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`).bind(requestId,access.context.workspaceId,companyId,null,'apollo',personId,role,'processing',personalApproved?1:0,phoneRequested?1:0,reserved,0,'{}',access.context.userId,created,created).run();

  try{
    const webhookUrl=phoneRequested?await buildApolloCrmWebhookUrl(env.APOLLO_WEBHOOK_URL,requestId,webhookSecret):'';
    const matchUrl=buildApolloMatchUrl({personId,personalEmail:personalApproved,phoneLookup:phoneRequested,webhookUrl});
    const response=await fetch(matchUrl,{method:'POST',headers:{'Content-Type':'application/json','Cache-Control':'no-cache','Accept':'application/json','X-Api-Key':env.APOLLO_API_KEY}});
    if(!response.ok)throw Object.assign(new Error(`Apollo match returned ${response.status}`),{code:`apollo_match_${response.status}`});
    const matched=await response.json().catch(()=>({}));const person=matched.person||{};const summary=publicPersonSummary(person);const creditsUsed=immediateApolloCredits(person);const providerRequestId=clean(matched.request_id||matched.requestId,180)||null;
    const businessEmail=provenBusinessEmail(person,domain);const personalEmail=personalApproved?strongPersonalEmail(person,domain,role,personId):'';const selectedEmail=businessEmail||personalEmail;
    const emailType=businessEmail?'work':personalEmail?'personal':null;const emailStatus=businessEmail?'Verified':personalEmail?'Strong match':null;const confidence=businessEmail?'verified':personalEmail?'high':null;
    const personName=clean(person.name||[person.first_name,person.last_name].filter(Boolean).join(' ')||body.name,180)||'Decision maker';const personTitle=clean(person.title||body.title||body.role,180)||null;

    let contact=null;
    if(selectedEmail||phoneRequested){
      const saved=await upsertCrmContacts(env.DB,access.context,companyId,[{external_person_id:personId,name:personName,title:personTitle,work_email:selectedEmail||undefined,email_status:emailStatus||undefined,linkedin_url:clean(person.linkedin_url,1000)||undefined,source:'apollo'}]);
      contact=saved[0]||null;
      if(contact){const phoneStatus=phoneRequested?'pending':null;await env.DB.prepare(`UPDATE crm_contacts SET email_type=?,match_confidence=?,verification_provider='Apollo',verified_at=?,phone_status=?,updated_at=? WHERE id=? AND workspace_id=?`).bind(emailType,confidence,selectedEmail?stamp():null,phoneStatus,stamp(),contact.id,access.context.workspaceId).run();contact=await env.DB.prepare(`SELECT * FROM crm_contacts WHERE id=? AND workspace_id=?`).bind(contact.id,access.context.workspaceId).first();}
    }

    const status=phoneRequested?'pending_phone':selectedEmail?'verified':'not_found';const completed=status==='pending_phone'?null:stamp();
    await env.DB.prepare(`UPDATE crm_enrichment_requests SET status=?,contact_id=?,provider_request_id=?,credits_used=?,response_summary_json=?,completed_at=?,updated_at=? WHERE id=?`).bind(status,contact?.id||null,providerRequestId,creditsUsed,JSON.stringify(summary),completed,stamp(),requestId).run();
    await appendCrmActivity(env.DB,access.context,{companyId,contactId:contact?.id||null,type:'contact.enriched',summary:selectedEmail?`${personName} contact verified`:phoneRequested?`${personName} phone enrichment requested`:`${personName} had no verified company email`,metadata:{provider:'Apollo',request_id:requestId,provider_request_id:providerRequestId,person_provider_id:personId,email_status:emailStatus,phone_status:phoneRequested?'pending':null,credits_used:creditsUsed,credits_reserved:reserved}});
    return json({request:{id:requestId,status,provider_request_id:providerRequestId,credits_used:creditsUsed,credits_reserved:reserved},contact,reason:selectedEmail?null:phoneRequested?'phone_pending':'verified_company_email_not_returned'},selectedEmail?201:200,cors);
  }catch(cause){
    const code=clean(cause?.code,120)||'apollo_failed';const message=clean(cause?.message,500)||'Apollo enrichment failed';
    await env.DB.prepare(`UPDATE crm_enrichment_requests SET status='failed',credits_reserved=0,error_code=?,error_message=?,completed_at=?,updated_at=? WHERE id=?`).bind(code,message,stamp(),stamp(),requestId).run();
    await appendCrmActivity(env.DB,access.context,{companyId,type:'contact.enrichment_failed',summary:'Apollo contact enrichment failed',metadata:{provider:'Apollo',request_id:requestId,person_provider_id:personId,code}});
    return error(message,502,cors,code);
  }
}

export async function handleCrmRoute(request,env,corsOverride={}){
  const url=new URL(request.url);const path=url.pathname;const cors=corsOverride||{};
  if(!path.startsWith('/api/crm/'))return null;
  const workspaceId=workspace(url);if(!workspaceId)return error('workspace_id is required',400,cors,'CRM_WORKSPACE_REQUIRED');
  try{
    if(path==='/api/crm/companies'){
      const access=await requireMember(request,env,workspaceId,request.method==='POST'?WRITER_ROLES:[]);if(access.error)return error(access.error,access.status,cors);
      if(request.method==='GET')return json(await listCrmCompanies(env.DB,access.context,{q:url.searchParams.get('q')||'',lifecycle:url.searchParams.get('lifecycle')||'',pipeline_stage:url.searchParams.get('pipeline_stage')||'',limit:url.searchParams.get('limit')||'',cursor:url.searchParams.get('cursor')||''}),200,cors);
      if(request.method==='POST'){const body=await request.json().catch(()=>null);if(!body)return error('CRM company payload is required',400,cors,'CRM_PAYLOAD_REQUIRED');const result=await upsertCrmCompany(env.DB,access.context,body);return json(result,result.created?201:200,cors);}
      return error('Method not allowed',405,cors);
    }

    const company=parseCompanyPath(path);
    if(company){
      const isDelete=request.method==='DELETE'&&!company.action;const roles=isDelete?['owner']:WRITER_ROLES;const readOnly=request.method==='GET';const access=await requireMember(request,env,workspaceId,readOnly?[]:roles);if(access.error)return error(access.error,access.status,cors);
      if(!company.action){
        if(request.method==='GET')return json(await getCrmCompany(env.DB,access.context,company.id),200,cors);
        if(request.method==='PATCH'){const body=await request.json().catch(()=>null);if(!body)return error('CRM company patch is required',400,cors);return json({company:await updateCrmCompany(env.DB,access.context,company.id,body)},200,cors);}
        if(request.method==='DELETE')return json(await deleteCrmCompany(env.DB,access.context,company.id),200,cors);
        return error('Method not allowed',405,cors);
      }
      if(company.action==='pipeline'){
        if(request.method==='POST'){const body=await request.json().catch(()=>({}));return json({company:await setCrmPipelineStage(env.DB,access.context,company.id,body.stage||'Discovered')},200,cors);}
        if(request.method==='DELETE')return json({company:await removeCrmFromPipeline(env.DB,access.context,company.id)},200,cors);
        return error('Method not allowed',405,cors);
      }
      if(company.action==='archive'&&request.method==='POST')return json({company:await archiveCrmCompany(env.DB,access.context,company.id)},200,cors);
      if(company.action==='restore'&&request.method==='POST')return json({company:await restoreCrmCompany(env.DB,access.context,company.id)},200,cors);
      if(company.action==='suppress'&&request.method==='POST')return json({company:await suppressCrmCompany(env.DB,access.context,company.id)},200,cors);
      if(company.action==='mark-customer'&&request.method==='POST')return json({company:await markCrmCustomer(env.DB,access.context,company.id)},200,cors);
      if(company.action==='enrich-contact'){
        if(request.method==='POST')return enrichCrmContact(request,env,cors,access,company.id);
        return error('Method not allowed',405,cors);
      }
      if(company.action==='contacts'){
        if(request.method==='POST'){const body=await request.json().catch(()=>null);const contacts=Array.isArray(body)?body:Array.isArray(body?.contacts)?body.contacts:[];return json({contacts:await upsertCrmContacts(env.DB,access.context,company.id,contacts)},200,cors);}
        return error('Method not allowed',405,cors);
      }
      if(company.action==='activities'){
        if(request.method==='GET')return json(await listCrmActivities(env.DB,access.context,company.id,{limit:url.searchParams.get('limit')||'',cursor:url.searchParams.get('cursor')||''}),200,cors);
        if(request.method==='POST'){const body=await request.json().catch(()=>null);if(!body||!CLIENT_ACTIVITY_TYPES.has(String(body.type||body.activity_type||'')))return error('Unsupported CRM activity type',400,cors,'CRM_ACTIVITY_INVALID');const result=await appendCrmActivity(env.DB,access.context,{...body,companyId:company.id});return json(result,200,cors);}
        return error('Method not allowed',405,cors);
      }
      return error('Not found',404,cors);
    }

    const contact=parseContactPath(path);
    if(contact){const access=await requireMember(request,env,workspaceId,WRITER_ROLES);if(access.error)return error(access.error,access.status,cors);if(request.method==='PATCH'){const body=await request.json().catch(()=>null);if(!body)return error('CRM contact patch is required',400,cors);return json({contact:await patchCrmContact(env.DB,access.context,contact.id,body)},200,cors);}if(request.method==='DELETE')return json(await archiveCrmContact(env.DB,access.context,contact.id),200,cors);return error('Method not allowed',405,cors);}

    return error('Not found',404,cors);
  }catch(cause){return routeError(cause,cors);}
}
