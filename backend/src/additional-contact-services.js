import {findTregWorkEmail} from './treg-contact-research.js';
import {findHunterWorkEmail} from './hunter-contact-research.js';
import '../../customer/discovery-engine.js';
import '../../customer/contact-confirmation-policy.js';
import '../../customer/additional-contact-policy.js';
import {getCrmCompany} from './crm.js';
import {enrichCrmContact} from './crm-routes.js';
import {confirmPublicWorkEmail} from './public-email-confirmation.js';
import {withWorkspaceServiceCredentials,resolveWorkspaceServiceCredential} from './service-integrations.js';
import {sha256,cookieValue} from './security.js';
import {APOLLO_PEOPLE_SEARCH_URL} from './enrichment.js';
import {loadConfirmationLevel} from './contact-confirmation-policy.js';
const D=globalThis.LeadIntelDiscovery,P=globalThis.LeadIntelAdditionalContactPolicy,C=globalThis.LeadIntelContactPolicy;
const json=(value,status=200,cors={})=>new Response(JSON.stringify(value),{status,headers:{'Content-Type':'application/json','Cache-Control':'no-store',...cors}});
const fail=(message,status=409,code='ADDITIONAL_CONTACT_HOLD')=>Object.assign(new Error(message),{status,code});
// Interrupted Treg phases may already be billed. Keep their reservation until
// the same idempotent lookup settles; only proven pre-dispatch holds release it.
const budgetAttempt="(status!='retryable' OR (provider='treg' AND COALESCE(json_extract(result_json,'$.provider_started'),1)!=0))";
export async function readAdditionalContactPolicy(env,workspaceId){
  const row=await env.DB.prepare('SELECT * FROM additional_contact_policies WHERE workspace_id=?').bind(workspaceId).first();
  return {enabled:row?.enabled===1,phoneEnabled:row?.phone_enabled===1,dailyLimit:row?.daily_limit??3,monthlyLimit:row?.monthly_limit??30,maxPerCompany:row?.max_per_company??2,provider:row?.provider||'treg',updatedAt:row?.updated_at||null};
}
export async function saveAdditionalContactPolicy(env,context,input){
  if(context.role!=='owner')throw fail('Only the workspace owner can approve additional services',403);
  if(input?.phoneEnabled!==undefined&&typeof input.phoneEnabled!=='boolean')throw fail('Choose a valid phone permission',400);
  if(typeof input?.enabled!=='boolean'||!Number.isInteger(input.dailyLimit)||input.dailyLimit<1||input.dailyLimit>50||!Number.isInteger(input.monthlyLimit)||input.monthlyLimit<input.dailyLimit||input.monthlyLimit>1000||![1,2].includes(input.maxPerCompany))throw fail('Choose valid daily/monthly limits and one or two buyers per company',400);
  const provider=input.provider||'apollo';if(!['apollo','treg'].includes(provider))throw fail('Unsupported paid research provider',400);
  const previous=await readAdditionalContactPolicy(env,context.workspaceId),phoneEnabled=input.phoneEnabled??(previous.provider===provider&&previous.phoneEnabled);
  if(provider==='treg'&&(input.enabled||phoneEnabled)&&!(await resolveWorkspaceServiceCredential(env,context.workspaceId,'treg')).configured)throw fail('Connect your Treg team token in Settings before activation.',409,'ADDITIONAL_CONTACT_PROVIDER_REQUIRED');
  await env.DB.prepare(`INSERT INTO additional_contact_policies(workspace_id,enabled,daily_limit,monthly_limit,max_per_company,approved_by,provider,phone_enabled) VALUES(?,?,?,?,?,?,?,?) ON CONFLICT(workspace_id) DO UPDATE SET enabled=excluded.enabled,daily_limit=excluded.daily_limit,monthly_limit=excluded.monthly_limit,max_per_company=excluded.max_per_company,approved_by=excluded.approved_by,provider=excluded.provider,phone_enabled=excluded.phone_enabled,updated_at=CURRENT_TIMESTAMP`).bind(context.workspaceId,Number(input.enabled),input.dailyLimit,input.monthlyLimit,input.maxPerCompany,context.userId,provider,Number(phoneEnabled)).run();
  return readAdditionalContactPolicy(env,context.workspaceId);
}
async function reservationHold(env,context,companyId,personId,month,enforceCompany=true){
  const policy=await readAdditionalContactPolicy(env,context.workspaceId);
  const counts=await env.DB.prepare(`SELECT
    SUM(CASE WHEN created_at>=date('now') THEN 1 ELSE 0 END) AS daily,
    SUM(CASE WHEN month=? THEN 1 ELSE 0 END) AS monthly,
    COUNT(DISTINCT CASE WHEN company_id=? AND month=? AND person_id!=? THEN person_id END) AS company
    FROM additional_contact_attempts WHERE workspace_id=? AND ${budgetAttempt}`).bind(month,companyId,month,String(personId),context.workspaceId).first();
  for(const [scope,limit] of [['daily',policy.dailyLimit],['monthly',policy.monthlyLimit],['company',policy.maxPerCompany]]){
    if(scope==='company'&&!enforceCompany)continue;
    const used=Number(counts?.[scope])||0;
    if(used>=limit)return fail(`LeadIntel ${scope} lookup limit reached (${used}/${limit}). No provider lookup was started. ${scope==='daily'?'Wait until the next UTC day or ask the owner to review Setup limits.':scope==='monthly'?'Wait until next month or ask the owner to review Setup limits.':'Ask the owner to review the buyers-per-company limit in Setup.'}`,429,'ADDITIONAL_CONTACT_'+scope.toUpperCase()+'_LIMIT');
  }
  return fail('Research permission changed or reservation could not be acquired. No provider lookup was started. Reload Setup before retrying.',409,'ADDITIONAL_CONTACT_RESERVATION_HOLD');
}
function fromSnapshot(detail){
  const s=detail.intelligence?.research_snapshot||{},r=s.buyerResearch||{};
  return {company:detail.company.company_name,domain:detail.company.normalized_domain,market:s.market,fitDescription:s.fitDescription,buyerRoles:s.buyerRoles,buyerRolesChanged:s.buyerRolesChanged,evidence:detail.intelligence?.evidence||[],lifecycle_status:detail.company.lifecycle_status,qualification:s.qualification,buyerFit:s.buyerFit,publicResearch:r.publicResearch,buyerDiscovery:r.discovery,people:r.buyers||[]};
}
function reuseAttempt(attempt,detail,person,confirmationLevel){
  const result=JSON.parse(attempt.result_json||'{}');
  if(result.contact){
    const current=detail.contacts?.find(c=>c.id===result.contact.id&&String(c.external_person_id)===String(person.id)&&String(c.name).trim().toLowerCase()===String(person.publicName||person.name).trim().toLowerCase()&&C.accepted(c,detail.company.normalized_domain,confirmationLevel));
    if(!current)return {cached:true,request:{status:'needs_review'},reason:'The previous contact is no longer active or confirmed. Review it in CRM.'};
    return {...result,contact:current,cached:true,request:{status:attempt.status}};
  }
  return {...result,cached:true,request:{status:attempt.status}};
}
async function resolvePerson(env,candidate,person){
  if(!String(person.id).startsWith('public-')&&!String(person.id).startsWith('person-'))return person;
  const response=await fetch(APOLLO_PEOPLE_SEARCH_URL,{method:'POST',headers:{'Content-Type':'application/json','X-Api-Key':env.APOLLO_API_KEY},body:JSON.stringify(D.buildApolloPeopleSearchPayload(candidate,{decisionMakers:person.title})),signal:AbortSignal.timeout(25000)});
  if(!response.ok)throw fail('Apollo identity search is unavailable',502);
  const people=D.normalizeApolloPeople(await response.json()),name=String(person.publicName||person.name).toLowerCase().trim();
  const profile=D.normalizeLinkedInUrl(person.publicLinkedinUrl||person.linkedin_url);
  const matches=people.filter(p=>profile&&D.normalizeLinkedInUrl(p.linkedin_url)===profile||String(p.name).toLowerCase().trim()===name);
  if(matches.length!==1)throw fail('No unique provider identity matched this qualified buyer');
  return {...person,id:matches[0].id};
}
function requireAutomaticReview(candidate,person){
  const review=D.safeBuyerAiReview(candidate.publicResearch?.aiReview),checked=Date.parse(review?.checkedAt||''),affects=row=>!row.person_id||String(row.person_id)===String(person.id);
  if(!review||review.status!=='complete'||review.inputSignature!==D.buyerReviewSignature(candidate)||!Number.isFinite(checked)||checked>Date.now()+300000||Date.now()-checked>30*86400000||!review.reviewedPersonIds.includes(String(person.id))||[...review.findings,...review.conflicts].some(affects))throw fail('Recheck this buyer with Buyer Agent before automatic paid research; its AI evidence review is incomplete or stale.',409,'ADDITIONAL_CONTACT_REVIEW_REQUIRED');
}
export async function lookupAdditionalEmail(env,context,companyId,input={},deps={}){
  const checkCancelled=()=>{if(deps.signal?.aborted)throw fail('Contact research was cancelled. No further provider lookup was started.',499,'ADDITIONAL_CONTACT_CANCELLED');};
  const parentGuard=async()=>{checkCancelled();await deps.guard?.();checkCancelled();};
  checkCancelled();
  if(!['owner','researcher','sales'].includes(context.role))throw fail('Workspace role is not permitted',403);
  const providerName=input.provider||'apollo';
  if(!['apollo','hunter','treg'].includes(providerName))throw fail('Unknown email provider',400);
  if(providerName==='hunter'&&(input.hunter_approved!==true||input.automatic===true))throw fail('Hunter requires its own manual approval for finding and verification',403,'ADDITIONAL_CONTACT_APPROVAL_REQUIRED');
  const dataLookup=input.data_lookup===true,includePhone=input.phone_approved===true,includeEmail=input.email_lookup!==false;
  if((dataLookup||includePhone)&&(providerName!=='treg'||includePhone&&!dataLookup||input.automatic!==true&&input.approved!==true))throw fail('Data research requires explicit approval',403,'ADDITIONAL_CONTACT_APPROVAL_REQUIRED');
  const policy=await readAdditionalContactPolicy(env,context.workspaceId);
  if(providerName==='treg'&&(policy.provider!=='treg'||includeEmail&&!policy.enabled||includePhone&&!policy.phoneEnabled||!includeEmail&&!includePhone))throw fail('The requested paid email or phone search is off. Activate it in Setup.',403,'ADDITIONAL_CONTACT_APPROVAL_REQUIRED');
  if(input.automatic===true?(providerName!=='treg'&&(!policy.enabled||policy.provider!==providerName)):input.approved!==true)throw fail('Paid contact research requires explicit approval',403,'ADDITIONAL_CONTACT_APPROVAL_REQUIRED');
  const detail=await (deps.getCompany||getCrmCompany)(env.DB,context,companyId),candidate=fromSnapshot(detail);
  const person=candidate.people.find(p=>String(p.id)===String(input.person_id));
  if(!person)throw fail('Qualified buyer is missing from the saved company research');
  const readiness=P.readiness(candidate,person,{automatic:input.automatic===true,provider:providerName});if(!readiness.eligible)throw fail(readiness.reason);
  const confirmationLevel=await loadConfirmationLevel(env,context.workspaceId);
  let existing=detail.contacts?.filter(c=>String(c.external_person_id)===String(person.id)&&String(c.name).trim().toLowerCase()===String(person.publicName||person.name).trim().toLowerCase()).find(c=>C.accepted(c,candidate.domain,confirmationLevel));
  const canonicalTitle=value=>{const title=String(value||'').trim().toLowerCase(),name=String(person.publicName||person.name).trim().toLowerCase();return title.startsWith(name)?title.slice(name.length).replace(/^[\s—–:|-]+/,'').trim():title;};
  const canonicalMatch=c=>String(c.id)===String(input.contact_id)&&String(c.name).trim().toLowerCase()===String(person.publicName||person.name).trim().toLowerCase()&&canonicalTitle(c.title)===canonicalTitle(person.title)&&(!c.linkedin_url||!D.normalizeLinkedInUrl(person.publicLinkedinUrl||person.linkedin_url)||D.normalizeLinkedInUrl(c.linkedin_url)===D.normalizeLinkedInUrl(person.publicLinkedinUrl||person.linkedin_url))&&C.accepted(c,candidate.domain,confirmationLevel);
  if(input.contact_id){
    const canonical=includePhone&&!includeEmail&&detail.contacts?.find(canonicalMatch);
    if(!canonical)throw fail('The saved contact no longer matches this researched buyer identity.');
    existing=canonical;
  }
  if(existing&&!dataLookup)return {contact:existing,cached:true,request:{status:'already_confirmed',credits_used:0}};
  if(input.automatic===true){
    if(providerName==='treg'){
      requireAutomaticReview(candidate,person);
    }
    const targets=P.targets(candidate,{maxPerCompany:providerName==='treg'?1:policy.maxPerCompany,provider:providerName,confirmedEmail:p=>includePhone?false:detail.contacts?.some(c=>String(c.external_person_id)===String(p.id)&&String(c.name).trim().toLowerCase()===String(p.publicName||p.name).trim().toLowerCase()&&C.accepted(c,candidate.domain,confirmationLevel))});
    if(!targets.some(p=>String(p.id)===String(person.id)))throw fail('Only the strongest missing-email buyers are approved for automatic lookup');
  }
  checkCancelled();
  // An official published address must finish its no-reveal confirmation before buying data.
  if(person.publicEmail&&person.publicEmailUrl&&C.publicSource(person.publicEmail,person.publicName||person.name,person.publicEmailUrl,candidate.domain)){
    try{
      const contact=await (deps.confirmPublic||confirmPublicWorkEmail)(env,context,companyId,{name:person.publicName||person.name,title:person.title,person_id:person.id,email:person.publicEmail,source_url:person.publicEmailUrl});
      if(confirmationLevel==='public_confirmed')existing=contact;
      if(confirmationLevel==='public_confirmed'&&!dataLookup)return {contact,cached:true,request:{status:'public_confirmed',credits_used:0}};
    }catch(error){if(error.code!=='PUBLIC_EMAIL_NOT_ATTRIBUTED')throw error;}
  }
  const provider=await env.DB.prepare('SELECT metadata_json FROM workspace_service_integrations WHERE workspace_id=? AND provider=?').bind(context.workspaceId,providerName).first();
  let capabilities={};try{capabilities=JSON.parse(provider?.metadata_json||'{}');}catch{}
  if(providerName==='treg'?!(await (deps.credential||resolveWorkspaceServiceCredential)(env,context.workspaceId,'treg')).configured:providerName==='apollo'?(!env.APOLLO_API_KEY||capabilities.email_enrichment_enabled!==true):capabilities.additional_verification_enabled!==true)throw fail('Connect and enable the selected email provider in Settings',409,'ADDITIONAL_CONTACT_PROVIDER_REQUIRED');
  const month=new Date().toISOString().slice(0,7),args=[context.workspaceId,companyId,String(person.id),month,providerName];
  let cached=await env.DB.prepare('SELECT status,result_json FROM additional_contact_attempts WHERE workspace_id=? AND company_id=? AND person_id=? AND month=? AND provider=?').bind(...args).first();
  if(cached){
    if(cached.status==='retryable'&&(providerName==='treg'?JSON.parse(cached.result_json||'{}').provider_started===false:input.automatic!==true&&input.approved===true)){
      await env.DB.prepare("DELETE FROM additional_contact_attempts WHERE workspace_id=? AND company_id=? AND person_id=? AND month=? AND provider=? AND status='retryable' AND (?!='treg' OR json_extract(result_json,'$.provider_started')=0)").bind(...args,providerName).run();
      cached=null;
    }
    else if(!(providerName==='treg'&&(['processing','retryable'].includes(cached.status)||dataLookup)))return reuseAttempt(cached,detail,person,confirmationLevel);
  }
  const enforceCompany=providerName!=='treg'||input.automatic===true;
  // A single SQLite statement reserves all three limits and the identity key atomically.
  const resuming=providerName==='treg'&&cached&&(['processing','retryable'].includes(cached.status)||dataLookup);
  await parentGuard();
  const reserved=resuming?{meta:{changes:1}}:await env.DB.prepare(`INSERT OR IGNORE INTO additional_contact_attempts(workspace_id,company_id,person_id,month,provider) SELECT ?,?,?,?,? WHERE (SELECT COUNT(*) FROM additional_contact_attempts WHERE workspace_id=? AND ${budgetAttempt} AND created_at>=date('now'))<COALESCE((SELECT daily_limit FROM additional_contact_policies WHERE workspace_id=?),3) AND (SELECT COUNT(*) FROM additional_contact_attempts WHERE workspace_id=? AND ${budgetAttempt} AND month=?)<COALESCE((SELECT monthly_limit FROM additional_contact_policies WHERE workspace_id=?),30) AND (?=0 OR (SELECT COUNT(DISTINCT person_id) FROM additional_contact_attempts WHERE workspace_id=? AND company_id=? AND ${budgetAttempt} AND month=? AND person_id!=?)<COALESCE((SELECT max_per_company FROM additional_contact_policies WHERE workspace_id=?),2)) AND (?=0 OR EXISTS(SELECT 1 FROM additional_contact_policies WHERE workspace_id=? AND ((?=0 OR enabled=1) AND (?=0 OR phone_enabled=1))))`).bind(...args,context.workspaceId,context.workspaceId,context.workspaceId,month,context.workspaceId,Number(enforceCompany),context.workspaceId,companyId,month,String(person.id),context.workspaceId,Number(input.automatic===true),context.workspaceId,Number(providerName!=='treg'||includeEmail),Number(providerName==='treg'&&includePhone)).run();
  if(!reserved?.meta?.changes){const duplicate=await env.DB.prepare('SELECT status,result_json FROM additional_contact_attempts WHERE workspace_id=? AND company_id=? AND person_id=? AND month=? AND provider=?').bind(...args).first();if(duplicate)return reuseAttempt(duplicate,detail,person,confirmationLevel);throw await reservationHold(env,context,companyId,person.id,month,enforceCompany);}
  let providerStarted=false;
  const guard=async({phase}={})=>{
    await parentGuard();
    const fresh=await (deps.getCompany||getCrmCompany)(env.DB,context,companyId),active=fromSnapshot(fresh);
    const selected=active.people.find(p=>String(p.id)===String(person.id)&&String(p.publicName||p.name)===String(person.publicName||person.name)&&p.title===person.title&&D.normalizeLinkedInUrl(p.publicLinkedinUrl||p.linkedin_url)===D.normalizeLinkedInUrl(person.publicLinkedinUrl||person.linkedin_url));
    if(['suppressed','archived'].includes(fresh.company.lifecycle_status)||active.domain!==candidate.domain||!selected)throw fail('Workspace company or buyer changed; reload the saved research.');
    const currentReadiness=P.readiness(active,selected,{automatic:input.automatic===true,provider:providerName});if(!currentReadiness.eligible)throw fail(currentReadiness.reason);
    if(input.contact_id&&!fresh.contacts?.some(canonicalMatch))throw fail('The saved contact changed; reload before phone research.');
    if(providerName!=='treg'&&input.automatic===true){
      const current=await readAdditionalContactPolicy(env,context.workspaceId);
      if(!current.enabled||current.provider!==providerName)throw fail('Paid contact research requires explicit approval',403,'ADDITIONAL_CONTACT_APPROVAL_REQUIRED');
    }
    if(providerName==='treg'){
      if(input.automatic===true)requireAutomaticReview(active,selected);
      const current=await readAdditionalContactPolicy(env,context.workspaceId);
      if(current.provider!=='treg'||(phase==='phone'?!current.phoneEnabled:phase?includeEmail&&!current.enabled:includeEmail&&!current.enabled||includePhone&&!current.phoneEnabled))throw fail('Paid search was deactivated.');
    }
    await parentGuard();
  };
  try{
    if(providerName==='treg'){
      await guard();providerStarted=true;
      const result=await (deps.findTreg||findTregWorkEmail)(env,context,candidate,person,companyId,{attemptKey:month,guard,dataLookup,includePhone,includeEmail,existingContact:existing||null});
      await env.DB.prepare('UPDATE additional_contact_attempts SET status=?,result_json=?,updated_at=CURRENT_TIMESTAMP WHERE workspace_id=? AND company_id=? AND person_id=? AND month=? AND provider=?').bind(result.contact&&C.accepted(result.contact,candidate.domain,confirmationLevel)?'verified':result.request?.status==='processing'?'processing':'not_found',JSON.stringify(result),...args).run();return result;
    }
    if(providerName==='hunter'){
      await guard();providerStarted=true;
      const result=await (deps.findHunter||findHunterWorkEmail)(env,context,candidate,person,companyId,{guard});
      await env.DB.prepare('UPDATE additional_contact_attempts SET status=?,result_json=?,updated_at=CURRENT_TIMESTAMP WHERE workspace_id=? AND company_id=? AND person_id=? AND month=? AND provider=?').bind(result.contact?'verified':'not_found',JSON.stringify(result),...args).run();return result;
    }
    const resolved=await (deps.resolvePerson||((p)=>resolvePerson(env,candidate,p)))(person);
    const request=new Request('https://leadintel.internal/enrich',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({person_id:resolved.id,name:person.publicName||person.name,title:person.title,allow_personal_email:false,phone_lookup:false}),...(deps.signal?{signal:deps.signal}:{})});
    await guard();providerStarted=true;
    const response=await (deps.enrich||enrichCrmContact)(request,env,{}, {context,guard},companyId),result=await response.json();
    if(!response.ok)throw fail(result.error||'Additional services are unavailable',response.status,result.code);
    if(result.contact&&(!C.accepted(result.contact,candidate.domain,'provider_verified')||String(result.contact.name).trim().toLowerCase()!==String(person.publicName||person.name).trim().toLowerCase()))throw fail('Provider result did not confirm this exact buyer and company email');
    if(result.contact?.id&&String(resolved.id)!==String(person.id)){
      await env.DB.prepare('UPDATE crm_contacts SET external_person_id=? WHERE id=? AND workspace_id=?').bind(String(person.id),result.contact.id,context.workspaceId).run();
      result.contact.external_person_id=String(person.id);
    }
    const status=result.contact?'verified':'not_found';
    result.research={provider:'apollo',status,checkedAt:new Date().toISOString()};
    await env.DB.prepare('UPDATE additional_contact_attempts SET status=?,result_json=?,updated_at=CURRENT_TIMESTAMP WHERE workspace_id=? AND company_id=? AND person_id=? AND month=? AND provider=?').bind(status,JSON.stringify(result),...args).run();return result;
  }catch(error){
    const retryable=error.code==='TREG_RETRY_SAME_LOOKUP'||!providerStarted||['CRM_APOLLO_CREDIT_LIMIT','CRM_APOLLO_CAPABILITY_DISABLED','CRM_ENRICHMENT_POLICY_MISSING','CRM_APOLLO_NOT_CONFIGURED'].includes(error.code);
    await env.DB.prepare("UPDATE additional_contact_attempts SET status=?,result_json=?,updated_at=CURRENT_TIMESTAMP WHERE workspace_id=? AND company_id=? AND person_id=? AND month=? AND provider=?").bind(retryable?'retryable':'needs_review',JSON.stringify({error:error.message,code:error.code,provider_started:providerStarted||Boolean(resuming)}),...args).run();throw error;
  }
}
export async function handleAdditionalContactRoute(request,env,cors={}){
  const url=new URL(request.url);if(!url.pathname.startsWith('/api/additional-contact-services/'))return null;
  try{
    const workspaceId=url.searchParams.get('workspace_id');if(!workspaceId)throw fail('workspace_id is required',400);
    const token=cookieValue(request,'leadintel_session'),hash=token?await sha256(token):'';
    const user=hash?await env.DB.prepare("SELECT user_id FROM sessions WHERE token_hash=? AND expires_at>datetime('now')").bind(hash).first():null;
    if(!user)throw fail('Authentication required',401);
    const member=await env.DB.prepare('SELECT role FROM workspace_members WHERE workspace_id=? AND user_id=?').bind(workspaceId,user.user_id).first();if(!member)throw fail('Workspace access denied',403);
    const context={workspaceId,userId:user.user_id,role:member.role};
    if(url.pathname.endsWith('/policy')){
      if(request.method==='GET')return json({policy:await readAdditionalContactPolicy(env,workspaceId),role:member.role},200,cors);
      if(request.method==='PUT')return json({policy:await saveAdditionalContactPolicy(env,context,await request.json())},200,cors);
    }
    if(url.pathname.endsWith('/email')&&request.method==='POST'){
      const input=await request.json(),runtime=await withWorkspaceServiceCredentials(request,env);
      return json(await lookupAdditionalEmail(runtime,context,String(input.company_id||''),input,{signal:request.signal}),200,cors);
    }
    throw fail('Method not allowed',405);
  }catch(error){return json({error:error.message,code:error.code||'ADDITIONAL_CONTACT_HOLD'},error.status||500,cors);}
}
