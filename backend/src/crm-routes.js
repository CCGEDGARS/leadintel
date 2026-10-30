import {storageErrorResponse} from './workspace-storage.js';
import {reserveCrmEnrichment} from './apollo-crm-reservation.js';
import {applyApolloCrmPhoneResult} from './apollo-crm-webhook.js';
import {apolloCreditUsage} from './apollo-credit-policy.js';
import {apolloCapabilities} from './service-integrations.js';
import {confirmPublicWorkEmail} from './public-email-confirmation.js';
import {sha256,cookieValue} from './security.js';
import {buildApolloMatchUrl,provenBusinessEmail,publicPersonSummary,strongPersonalEmail} from './enrichment.js';
import {apolloWebhookSigningSecret,buildApolloCrmWebhookUrl,handleApolloCrmWebhook} from './apollo-crm-webhook.js';
import {
  listCrmCompanies,listCrmActivities,getCrmCompany,upsertCrmCompany,updateCrmCompany,
  setCrmPipelineStage,removeCrmFromPipeline,archiveCrmCompany,restoreCrmCompany,
  suppressCrmCompany,markCrmCustomer,deleteCrmCompany,upsertCrmContacts,
  patchCrmContact,archiveCrmContact,appendCrmActivity,writeCrmRecord
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
function routeError(cause,cors){const storageError=storageErrorResponse(cause,cors);if(storageError)return storageError;const status=Number(cause?.status)||500;const safeStatus=status>=400&&status<600?status:500;return error(safeStatus===500?'Internal server error':String(cause?.message||'CRM request failed'),safeStatus,cors,cause?.code);}
function workspace(url){return String(url.searchParams.get('workspace_id')||'').trim();}
function parseCompanyPath(path){const match=path.match(/^\/api\/crm\/companies\/([^/]+)(?:\/(pipeline|archive|restore|suppress|mark-customer|contacts|activities|enrich-contact|confirm-public-email))?$/);return match?{id:decodeURIComponent(match[1]),action:match[2]||''}:null;}
function parseContactPath(path){const match=path.match(/^\/api\/crm\/contacts\/([^/]+)$/);return match?{id:decodeURIComponent(match[1])}:null;}
const WRITER_ROLES=['owner','researcher','sales'];
const CLIENT_ACTIVITY_TYPES=new Set(['company.website_scanned','dossier.built','content.approved','email.sent','email.reply_received','meeting.recorded','proposal.recorded','deal.won','deal.lost','contact.linkedin_confirmed','contact.linkedin_message_sent']);

function isHttpsUrl(value){try{return new URL(String(value||'')).protocol==='https:';}catch{return false;}}
const crmEnrichmentUsage=apolloCreditUsage;
function immediateApolloCredits(person){return person&&clean(person.id||person.person_id,180)?1:0;}

export async function enrichCrmContact(request,env,cors,access,companyId){
  const guard=async()=>{
    try{
      if(request.signal.aborted)throw Object.assign(Error('Contact research was cancelled.'),{status:499,code:'CRM_ENRICHMENT_CANCELLED'});
      await access.guard?.();
      if(request.signal.aborted)throw Object.assign(Error('Contact research was cancelled.'),{status:499,code:'CRM_ENRICHMENT_CANCELLED'});
    }catch(cause){cause.enrichmentHold=true;throw cause;}
  };
  await guard();
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
  if(phoneRequested){
    try{const consent=await env.DB.prepare('SELECT provider,phone_enabled FROM additional_contact_policies WHERE workspace_id=?').bind(access.context.workspaceId).first();if(consent?.provider==='treg'&&consent.phone_enabled!==1)return error('Paid phone research is OFF. Enable it in Step 1 or Settings before requesting a phone.',409,cors,'CRM_PHONE_LOOKUP_DISABLED');}catch(cause){if(!/no such table/i.test(String(cause.message)))throw cause;}
  }
  if(phoneRequested&&String(policy.phone_lookup_mode||'on_request')==='disabled')return error('Phone enrichment is disabled by workspace policy',409,cors,'CRM_PHONE_LOOKUP_DISABLED');
  if(phoneRequested&&!isHttpsUrl(env.APOLLO_WEBHOOK_URL))return error('Apollo phone enrichment requires a configured HTTPS webhook',409,cors,'CRM_APOLLO_WEBHOOK_REQUIRED');
  const webhookSecret=apolloWebhookSigningSecret(env);
  if(phoneRequested&&!webhookSecret)return error('Apollo phone enrichment requires server signing material',409,cors,'CRM_APOLLO_WEBHOOK_SECRET_REQUIRED');

  let selectedContact=null;
  if(body.contact_id){selectedContact=await env.DB.prepare('SELECT * FROM crm_contacts WHERE id=? AND workspace_id=? AND company_id=? AND archived_at IS NULL').bind(clean(body.contact_id,160),access.context.workspaceId,companyId).first();if(!selectedContact||String(selectedContact.source).toLowerCase()==='apollo'&&selectedContact.external_person_id&&selectedContact.external_person_id!==personId||body.name&&clean(body.name,180).toLowerCase()!==clean(selectedContact.name,180).toLowerCase())return error('Selected buyer identity does not match the CRM contact',409,cors,'CRM_PHONE_IDENTITY_MISMATCH');}
  const existing=await env.DB.prepare(`SELECT * FROM crm_contacts WHERE workspace_id=? AND company_id=? AND source='apollo' AND external_person_id=? AND LOWER(email_status)='verified' AND archived_at IS NULL AND normalized_email IS NOT NULL`).bind(access.context.workspaceId,companyId,personId).first();
  if(existing&&!phoneRequested)return json({request:{status:'already_verified',credits_used:0},contact:existing,duplicate:true},200,cors);

  // Idempotency: do not buy the same phone reveal again while a previous
  // request is active, or after an actual number has already been returned.
  // Scope both checks to the authenticated workspace and exact Apollo person.
  if(phoneRequested){
    const prior=await env.DB.prepare(`SELECT * FROM crm_enrichment_requests
      WHERE workspace_id=? AND company_id=? AND provider='apollo'
        AND person_provider_id=? AND phone_requested=1
        AND status IN ('processing','pending_phone')
      ORDER BY created_at DESC LIMIT 1`).bind(access.context.workspaceId,companyId,personId).first();
    if(prior)return json({request:{id:prior.id,status:prior.status,provider_request_id:prior.provider_request_id||null,credits_used:Number(prior.credits_used)||0,credits_reserved:Number(prior.credits_reserved)||0},duplicate:true,reason:'phone_request_already_pending'},200,cors);
    const savedPhone=await env.DB.prepare(`SELECT * FROM crm_contacts
      WHERE workspace_id=? AND company_id=? AND source='apollo' AND external_person_id=?
      AND archived_at IS NULL AND phone_number IS NOT NULL AND TRIM(phone_number)<>''
      AND LOWER(phone_status) IN ('verified','provider_listed')
      ORDER BY updated_at DESC LIMIT 1`).bind(access.context.workspaceId,companyId,personId).first();
    if(savedPhone||selectedContact?.phone_number&&['verified','provider_listed'].includes(String(selectedContact.phone_status).toLowerCase()))return json({request:{status:'already_verified',credits_used:0},contact:savedPhone||selectedContact,duplicate:true,reason:'existing_verified_phone'},200,cors);
  }
  const capabilities=await apolloCapabilities(env,access.context.workspaceId);
  if(phoneRequested?!capabilities.phone:!capabilities.email)return error('Enable Apollo '+(phoneRequested?'phone':'email')+' enrichment in Settings before using credits',409,cors,'CRM_APOLLO_CAPABILITY_DISABLED');
  const reserved=phoneRequested?9:1;const usage=await crmEnrichmentUsage(env.DB,access.context.workspaceId);
  if(usage.daily+reserved>Number(policy.daily_credit_limit)||usage.monthly+reserved>Number(policy.monthly_credit_limit))return error('Apollo enrichment blocked by workspace credit limit',429,cors,'CRM_APOLLO_CREDIT_LIMIT');

  const requestId=`CRM-ENR-${uuid()}`;const role=clean(body.title||body.role,180)||'Decision maker';const created=stamp();
  const values=[requestId,access.context.workspaceId,companyId,selectedContact?.id||null,'apollo',personId,role,'processing',personalApproved?1:0,phoneRequested?1:0,reserved,0,'{}',access.context.userId,created,created];
  const reservation=await reserveCrmEnrichment(env.DB,{values,workspaceId:access.context.workspaceId,companyId,personId,contactId:selectedContact?.id,phone:phoneRequested,reserved},policy);
  if(!reservation){
    const prior=phoneRequested?await env.DB.prepare("SELECT * FROM crm_enrichment_requests WHERE workspace_id=? AND company_id=? AND provider='apollo' AND person_provider_id=? AND phone_requested=1 ORDER BY created_at DESC,rowid DESC LIMIT 1").bind(access.context.workspaceId,companyId,personId).first():null;
    if(prior)return json({request:{id:prior.id,status:prior.status,credits_used:Number(prior.credits_used)||0,credits_reserved:Number(prior.credits_reserved)||0},duplicate:true,reason:'phone_request_already_recorded'},200,cors);
    return error('Apollo enrichment blocked by workspace credit limit or retained phone evidence',429,cors,'CRM_APOLLO_CREDIT_LIMIT');
  }
  let dispatched=false,definiteFailure=false;

  try{
    await guard();
    if(phoneRequested){
      if(!selectedContact)selectedContact=(await upsertCrmContacts(env.DB,access.context,companyId,[{external_person_id:personId,name:clean(body.name,180)||'Decision maker',title:role,source:'apollo'}]))[0];
      await env.DB.prepare('UPDATE crm_enrichment_requests SET contact_id=? WHERE id=?').bind(selectedContact.id,requestId).run();
    }
    const webhookUrl=phoneRequested?await buildApolloCrmWebhookUrl(env.APOLLO_WEBHOOK_URL,requestId,webhookSecret):'';
    const matchUrl=buildApolloMatchUrl({personId,personalEmail:personalApproved,phoneLookup:phoneRequested,webhookUrl});
    await guard();dispatched=true;
    const response=await fetch(matchUrl,{method:'POST',headers:{'Content-Type':'application/json','Cache-Control':'no-cache','Accept':'application/json','X-Api-Key':env.APOLLO_API_KEY}});
    if(!response.ok){definiteFailure=response.status>=400&&response.status<500&&response.status!==408;throw Object.assign(new Error(`Apollo match returned ${response.status}`),{code:`apollo_match_${response.status}`});}
    const matched=await response.json().catch(()=>({}));const person=matched.person||{};
    const actualName=clean(person.name||[person.first_name,person.last_name].filter(Boolean).join(' '),180),expectedName=clean(body.contact_id?selectedContact?.name:body.name,180);
    const profile=value=>{try{const url=new URL(value);return /(^|\.)linkedin\.com$/.test(url.hostname)?url.pathname.replace(/\/$/,'').toLowerCase():'';}catch{return '';}};
    const expectedProfile=profile(selectedContact?.public_linkedin_url||selectedContact?.linkedin_url),actualProfile=profile(person.linkedin_url);
    if(person.id&&(String(person.id)!==personId||expectedName&&actualName&&expectedName.normalize('NFC').toLowerCase()!==actualName.normalize('NFC').toLowerCase()||expectedProfile&&actualProfile&&expectedProfile!==actualProfile))throw Object.assign(new Error('Apollo returned a different person identity'),{code:'CRM_APOLLO_IDENTITY_MISMATCH',providerCredits:immediateApolloCredits(person)});
    const summary={...publicPersonSummary(person),identity_verified:Boolean(String(person.id||'')===personId&&actualName&&(!expectedName||expectedName.normalize('NFC').toLowerCase()===actualName.normalize('NFC').toLowerCase()))};const creditsUsed=immediateApolloCredits(person);const providerRequestId=clean(matched.request_id||matched.requestId,180)||null;
    await env.DB.prepare(`UPDATE crm_enrichment_requests SET provider_request_id=?,credits_used=credits_used+?,response_summary_json=json_patch(?,response_summary_json),updated_at=? WHERE id=?`).bind(providerRequestId,creditsUsed,JSON.stringify(summary),stamp(),requestId).run();
    await guard();
    const businessEmail=provenBusinessEmail(person,domain);const personalEmail=personalApproved?strongPersonalEmail(person,domain,role,personId):'';const selectedEmail=summary.identity_verified?(businessEmail||personalEmail):'';
    const emailType=businessEmail?'work':personalEmail?'personal':null;const emailStatus=businessEmail?'Verified':personalEmail?'Strong match':null;const confidence=businessEmail?'verified':personalEmail?'high':null;
    const personName=clean(person.name||[person.first_name,person.last_name].filter(Boolean).join(' ')||body.name,180)||'Decision maker';const personTitle=clean(person.title||body.title||body.role,180)||null;

    let contact=selectedContact;
    if(selectedEmail||phoneRequested){
      const saved=selectedContact?[selectedContact]:await upsertCrmContacts(env.DB,access.context,companyId,[{external_person_id:personId,name:personName,title:personTitle,work_email:selectedEmail||undefined,email_status:emailStatus||undefined,linkedin_url:clean(person.linkedin_url,1000)||undefined,source:'apollo'}]);
      contact=saved[0]||null;
      if(contact&&summary.identity_verified){if(!body.contact_id&&summary.identity_verified)await writeCrmRecord(env.DB,access.context,'UPDATE crm_contacts SET name=?,title=COALESCE(?,title) WHERE id=? AND workspace_id=?',[actualName,personTitle,contact.id,access.context.workspaceId]);await writeCrmRecord(env.DB,access.context,`UPDATE crm_contacts SET work_email=COALESCE(?,work_email),normalized_email=COALESCE(?,normalized_email),email_status=COALESCE(?,email_status),email_type=COALESCE(?,email_type),match_confidence=COALESCE(?,match_confidence),verification_provider=CASE WHEN ? IS NOT NULL THEN 'Apollo' ELSE verification_provider END,verified_at=COALESCE(?,verified_at),phone_status=CASE WHEN ?=1 AND NOT EXISTS (SELECT 1 FROM crm_enrichment_requests WHERE id=? AND webhook_received_at IS NOT NULL) AND NOT (TRIM(COALESCE(phone_number,''))<>'' AND LOWER(COALESCE(phone_status,'')) IN ('verified','provider_listed')) THEN 'pending' ELSE phone_status END,updated_at=? WHERE id=? AND workspace_id=?`,[selectedEmail||null,selectedEmail||null,emailStatus,emailType,confidence,selectedEmail||null,selectedEmail?stamp():null,phoneRequested?1:0,requestId,stamp(),contact.id,access.context.workspaceId]);contact=await env.DB.prepare(`SELECT * FROM crm_contacts WHERE id=? AND workspace_id=?`).bind(contact.id,access.context.workspaceId).first();}
    }

    const status=phoneRequested?'pending_phone':selectedEmail?'verified':'not_found';const completed=status==='pending_phone'?null:stamp();
    await env.DB.prepare(`UPDATE crm_enrichment_requests SET status=CASE WHEN webhook_received_at IS NULL THEN ? WHEN ?=1 THEN CASE WHEN json_extract(response_summary_json,'$.phone_found')=1 THEN 'verified' ELSE 'not_found' END ELSE status END,contact_id=?,provider_request_id=?,response_summary_json=json_patch(?,response_summary_json),completed_at=CASE WHEN webhook_received_at IS NULL THEN ? ELSE completed_at END,updated_at=? WHERE id=?`).bind(status,summary.identity_verified?1:0,contact?.id||null,providerRequestId,JSON.stringify(summary),completed,stamp(),requestId).run();
    const settled=await env.DB.prepare('SELECT * FROM crm_enrichment_requests WHERE id=?').bind(requestId).first();
    if(phoneRequested&&settled.webhook_received_at)contact=await applyApolloCrmPhoneResult(env.DB,settled);
    await appendCrmActivity(env.DB,access.context,{companyId,contactId:contact?.id||null,type:'contact.enriched',summary:selectedEmail?`${personName} contact verified`:phoneRequested?`${personName} phone enrichment requested`:`${personName} had no verified company email`,metadata:{provider:'Apollo',request_id:requestId,provider_request_id:providerRequestId,person_provider_id:personId,email_status:emailStatus,phone_status:phoneRequested?'pending':null,credits_used:creditsUsed,credits_reserved:reserved}});
    return json({request:{id:requestId,status:settled.status,provider_request_id:providerRequestId,credits_used:Number(settled.credits_used)||0,credits_reserved:reserved},contact,reason:selectedEmail?null:phoneRequested?'phone_pending':'verified_company_email_not_returned'},selectedEmail?201:200,cors);
  }catch(cause){
    const code=clean(cause?.code,120)||'apollo_failed';const message=clean(cause?.message,500)||'Apollo enrichment failed';
    if(cause?.providerCredits)await env.DB.prepare("UPDATE crm_enrichment_requests SET credits_used=credits_used+?,response_summary_json=json_set(response_summary_json,'$.identity_verified',0) WHERE id=?").bind(cause.providerCredits,requestId).run();
    if(cause.enrichmentHold&&!phoneRequested){
      // A submitted lookup may already be charged. Retain its settled receipt
      // and budget while keeping a cancelled/replaced buyer out of CRM.
      await env.DB.prepare("UPDATE crm_enrichment_requests SET status='cancelled',credits_reserved=?,response_summary_json=json_set(response_summary_json,'$.budget_retained',?),error_code=?,error_message=?,completed_at=?,updated_at=? WHERE id=?").bind(dispatched?reserved:0,dispatched?1:0,code,message,stamp(),stamp(),requestId).run();
      return error(message,Number(cause.status)||409,cors,code);
    }
    if(phoneRequested&&dispatched&&!definiteFailure){
      await env.DB.prepare("UPDATE crm_enrichment_requests SET status='pending_phone',error_code=?,error_message=?,updated_at=? WHERE id=? AND webhook_received_at IS NULL").bind(code==='CRM_APOLLO_IDENTITY_MISMATCH'?code:'apollo_outcome_unknown',code==='CRM_APOLLO_IDENTITY_MISMATCH'?'Provider identity does not match the selected buyer; review required':'Provider outcome is uncertain; waiting for callback before another paid attempt',stamp(),requestId).run();
      const retained=await env.DB.prepare('SELECT * FROM crm_enrichment_requests WHERE id=?').bind(requestId).first();
      return json({request:{id:requestId,status:retained.status,credits_reserved:reserved},contact:retained.webhook_received_at?await applyApolloCrmPhoneResult(env.DB,retained):selectedContact,reason:'apollo_outcome_unknown'},202,cors);
    }
    await env.DB.prepare(`UPDATE crm_enrichment_requests SET status='failed',credits_reserved=0,error_code=?,error_message=?,completed_at=?,updated_at=? WHERE id=? AND webhook_received_at IS NULL`).bind(code,message,stamp(),stamp(),requestId).run();
    await appendCrmActivity(env.DB,access.context,{companyId,type:'contact.enrichment_failed',summary:'Apollo contact enrichment failed',metadata:{provider:'Apollo',request_id:requestId,person_provider_id:personId,code}});
    return error(message,502,cors,code);
  }
}

// Verification is established by the dedicated provider/source confirmation paths.
function untrustedContact(input){const contact=input&&typeof input==='object'?input:{};const status=String(contact.email_status||'').trim().toLowerCase();return {...contact,email_status:!status||['verified','public_confirmed'].includes(status)?'public_unverified':contact.email_status};}

export async function handleCrmRoute(request,env,corsOverride={}){
  const url=new URL(request.url);const path=url.pathname;const cors=corsOverride||{};
  if(!path.startsWith('/api/crm/'))return null;
  const workspaceId=workspace(url);if(!workspaceId)return error('workspace_id is required',400,cors,'CRM_WORKSPACE_REQUIRED');
  try{
    if(path==='/api/crm/companies'){
      const access=await requireMember(request,env,workspaceId,request.method==='POST'?WRITER_ROLES:[]);if(access.error)return error(access.error,access.status,cors);
      if(request.method==='GET')return json(await listCrmCompanies(env.DB,access.context,{q:url.searchParams.get('q')||'',lifecycle:url.searchParams.get('lifecycle')||'',pipeline_stage:url.searchParams.get('pipeline_stage')||'',limit:url.searchParams.get('limit')||'',cursor:url.searchParams.get('cursor')||''}),200,cors);
      if(request.method==='POST'){const body=await request.json().catch(()=>null);if(!body)return error('CRM company payload is required',400,cors,'CRM_PAYLOAD_REQUIRED');const result=await upsertCrmCompany(env.DB,access.context,{...body,...(Array.isArray(body.contacts)?{contacts:body.contacts.map(untrustedContact)}:{})});return json(result,result.created?201:200,cors);}
      return error('Method not allowed',405,cors);
    }

    const company=parseCompanyPath(path);
    if(company){
      const isDelete=request.method==='DELETE'&&!company.action;const roles=isDelete?['owner']:WRITER_ROLES;const readOnly=request.method==='GET';const access=await requireMember(request,env,workspaceId,readOnly?[]:roles);if(access.error)return error(access.error,access.status,cors);
      if(!company.action){
        if(request.method==='GET'){
          const detail=await getCrmCompany(env.DB,access.context,company.id);
          let inbox=[];try{inbox=(await env.DB.prepare("SELECT * FROM crm_enrichment_requests WHERE workspace_id=? AND company_id=? AND provider='apollo' AND phone_requested=1 AND webhook_received_at IS NOT NULL AND COALESCE(json_extract(response_summary_json,'$.projection_applied'),0)=0 ORDER BY created_at DESC LIMIT 50").bind(workspaceId,company.id).all()).results||[];}catch(error){if(!/no such table/i.test(String(error.message)))throw error;}
          for(const row of inbox)await applyApolloCrmPhoneResult(env.DB,row);
          return json(inbox.length?await getCrmCompany(env.DB,access.context,company.id):detail,200,cors);
        }
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
      if(company.action==='confirm-public-email'&&request.method==='POST'){return json({contact:await confirmPublicWorkEmail(env,access.context,company.id,await request.json())},200,cors);}
      if(company.action==='enrich-contact'){
        if(request.method==='POST')return enrichCrmContact(request,env,cors,access,company.id);
        return error('Method not allowed',405,cors);
      }
      if(company.action==='contacts'){
        if(request.method==='POST'){const body=await request.json().catch(()=>null);const contacts=Array.isArray(body)?body:Array.isArray(body?.contacts)?body.contacts:[];return json({contacts:await upsertCrmContacts(env.DB,access.context,company.id,contacts.map(untrustedContact))},200,cors);}
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
