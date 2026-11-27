import {startBuyerPhone} from './buyer-phone-lookup.js';
import {websiteContactRole,websiteNameKey,websiteProfileKey,websitePaidReadiness} from './website-contact-evidence.js';
import {enrichCrmContact} from './crm-routes.js';
import {lookupAdditionalEmail} from './additional-contact-services.js';
import {mergeTregContactData,tregLookupAccounting} from './treg-contact-research.js';
import {withWorkspaceServiceCredentials,searchWorkspaceApolloPeople} from './service-integrations.js';
import {contactSql as sql,contactParse as parse,contactCompanyAuthority,contactError,readWebsiteContacts,websiteContactView} from './website-contact-store.js';
import '../../customer/discovery-engine.js';
const D=globalThis.LeadIntelDiscovery;
const identity=p=>JSON.stringify([String(p.id),p.publicName||p.name,p.title,p.organization,p.publicLinkedinUrl||p.linkedin_url||'']);

// Server-created scope only. Neither the generic additional-contact route nor
// a client candidate can supply a qualification override or research receipt.
export async function websitePaidScope(env,context,body){
 if(body.approved!==true||!['email','phone'].includes(body.channel)||!['apollo','treg','hunter'].includes(body.provider))throw contactError('Approve one named person, provider and contact channel.',403,'WEBSITE_CONTACT_APPROVAL_REQUIRED');
 if(body.channel==='phone'&&!['treg','apollo'].includes(body.provider))throw contactError('Phone research uses the enabled phone provider.',400);
 const row=await readWebsiteContacts(env,context.workspaceId,{id:body.jobId});
 if(!row||row.revision!==body.revision)throw contactError('Research evidence changed. Review it before approving paid research.');
 const input=parse(row.input_json),state=parse(row.state_json),people=state.people||[],person=people.find(p=>String(p.id)===String(body.personId));
 if(!person||people.filter(p=>String(p.id)===String(body.personId)).length!==1)throw contactError('Choose one current researched contact.');
 const original=identity(person),freeRevision=state.freeRevision;
 const personSql=`EXISTS(SELECT 1 FROM json_each(website_contact_jobs.state_json,'$.people') p WHERE CAST(json_extract(p.value,'$.id') AS TEXT)=? AND COALESCE(NULLIF(json_extract(p.value,'$.publicName'),''),json_extract(p.value,'$.name'),'')=? AND COALESCE(json_extract(p.value,'$.title'),'')=? AND COALESCE(json_extract(p.value,'$.organization'),'')=? AND COALESCE(NULLIF(json_extract(p.value,'$.publicLinkedinUrl'),''),json_extract(p.value,'$.linkedin_url'),'')=? AND (json_extract(p.value,'$.freeResearchStatus')='complete' OR (json_extract(p.value,'$.identityCheck.status')='confirmed' AND json_extract(p.value,'$.identityCheck.identityKey')=? AND json_extract(p.value,'$.identityCheck.checkedAt')=?)))`;
 const personArgs=[String(person.id),person.publicName||person.name,person.title||'',person.organization||'',person.publicLinkedinUrl||person.linkedin_url||'',person.identityCheck?.identityKey||'',person.identityCheck?.checkedAt||''];
 const scopeAuthority=()=>({sql:`EXISTS(SELECT 1 FROM website_contact_jobs WHERE id=? AND workspace_id=? AND company_id=? AND status IN ('complete','incomplete') AND json_extract(state_json,'$.freeRevision')=? AND ${personSql} AND ${contactCompanyAuthority}) AND EXISTS(SELECT 1 FROM sessions s JOIN workspace_members m ON m.user_id=s.user_id WHERE s.token_hash=? AND s.expires_at>datetime('now') AND m.workspace_id=? AND m.user_id=? AND m.role=?)`,args:[row.id,context.workspaceId,row.company_id,freeRevision,...personArgs,context.sessionHash,context.workspaceId,context.userId,context.role]});
 const guard=async()=>{const a=scopeAuthority();if(!(await sql(env,`SELECT 1 AS allowed WHERE ${a.sql}`,...a.args).first()))throw contactError('Company, contact evidence or research authority changed.');};guard.writeAuthority=scopeAuthority;
 const current=async()=>{await guard();const fresh=await readWebsiteContacts(env,context.workspaceId,{id:row.id}),saved=parse(fresh.state_json),selected=saved.people.find(p=>String(p.id)===String(person.id));if(identity(selected)!==original)throw contactError('The selected contact changed.');return {fresh,saved,selected};};
 const candidate=async detail=>{const {saved}=await current();if(detail.company.id!==row.company_id||detail.company.company_name!==input.company||detail.company.normalized_domain!==input.domain)throw contactError('The saved company changed.');return {company:input.company,domain:input.domain,people:saved.people,publicResearch:{},lifecycle_status:detail.company.lifecycle_status};};
 const readiness=async(_candidate,selected)=>{
  const {selected:server}=await current(),candidate={company:input.company,domain:input.domain,managementLimit:input.managementLimit,people:[server]};
  const ready=websitePaidReadiness(candidate,server);
  return {...ready,eligible:identity(selected)===original&&ready.eligible};
 };
 const currentData=async()=>{const {selected}=await current();return {saved:selected,data:selected.contactData||null};};
 const resolvePerson=async(runtime,selected)=>{
  const {saved}=await current(),candidate={company:input.company,domain:input.domain},name=String(selected.publicName||selected.name).trim().toLowerCase(),profile=D.normalizeLinkedInUrl(selected.publicLinkedinUrl||selected.linkedin_url);

  const matches=raw=>[...new Map(D.traceIdentityBuyers({people:raw.filter(p=>String(p.id||'').trim())},candidate,{collectAllCompanyContacts:true}).people.filter(p=>websiteNameKey(p.publicName||p.name)===websiteNameKey(name)&&(profile?websiteProfileKey(p.linkedin_url)===websiteProfileKey(profile):websiteContactRole(p.title)===websiteContactRole(selected.title))).map(p=>[String(p.id),p])).values()];
  const directory=(saved.tasks||[]).find(t=>t.kind==='apollo'&&t.value==='management-company-identities'&&t.status==='complete'&&!t.archived);
  let found=matches([...(saved.apolloPeople||[]),...(directory?.result?.people||[])]);
  if(found.length!==1){const result=await searchWorkspaceApolloPeople(runtime,context.workspaceId,{domain:input.domain,person_titles:[selected.title]},{userId:context.userId,guard});await guard();found=matches(result.people||[]);}
  if(found.length!==1)throw contactError('Apollo did not supply one exact current company identity. Public results remain saved.',409,'WEBSITE_CONTACT_APOLLO_IDENTITY_REQUIRED');
  return {...selected,id:found[0].id};
 };
 const saveData=async(data,{guard:providerGuard,includeEmail,includePhone,attemptKey,writeAuthority})=>{
  for(let attempt=0;attempt<4;attempt++){
   await providerGuard();const {fresh,saved,selected}=await current(),merged=mergeTregContactData(selected.contactData,data,{includeEmail,includePhone});
   Object.assign(merged,await tregLookupAccounting(env,context,{company:input.company,domain:input.domain},selected,row.company_id,attemptKey,merged));selected.contactData=merged;
   const a=writeAuthority?.()||scopeAuthority(),written=await sql(env,`UPDATE website_contact_jobs SET state_json=?,revision=revision+1,updated_at=CURRENT_TIMESTAMP WHERE id=? AND workspace_id=? AND state_json=? AND ${a.sql}`,JSON.stringify(saved),row.id,context.workspaceId,fresh.state_json,...a.args).run();if(written.meta.changes)return merged;
  }throw contactError('Another contact result is being saved. Retry this same lookup.');
 };
 const phoneSelection=()=>({sql:"SELECT json_extract(p.value,'$.contactData.phone.number') FROM website_contact_jobs j,json_each(j.state_json,'$.people') p WHERE j.id=? AND j.workspace_id=? AND CAST(json_extract(p.value,'$.id') AS TEXT)=? LIMIT 1",args:[row.id,context.workspaceId,String(person.id)]});
 const scope={candidate,readiness,currentData,saveData,phoneSelection,resolvePerson};
 await guard();const ready=await readiness({company:input.company,domain:input.domain},person);if(!ready.eligible)throw contactError(ready.reason,409,ready.code);
 return {scope,guard,row,person};
}

export async function lookupWebsiteContact(request,env,context,body,deps={}){
 const {scope,guard,row,person}=await websitePaidScope(env,context,body);
 const view=await websiteContactView(env,row),shown=view.people.find(p=>p.id===person.id);
 if(!shown||view.researchBlocked)throw contactError('Review the current company and person before purchase.');
 const card=shown.publishedStaffCard,crm=shown.savedContact;
 const email=body.channel==='email'&&(D.acceptedOfficialBuyerEmail(view,shown)||card?.email||crm?.email_status==='verified'&&crm.work_email);
 const phone=body.channel==='phone'&&(card?.phone||shown.contactData?.phone?.number||['verified','provider_listed'].includes(String(crm?.phone_status).toLowerCase())&&crm.phone_number);
 if(email||phone)return {cached:true,contact:crm,reason:'Reused the saved '+body.channel+' for this person.',request:{status:'already_confirmed',credits_used:0}};
 if(body.channel==='phone'&&crm?.phone_status==='pending'&&!body.phone_sequence)return {duplicate:true,reason:'phone_request_already_pending',request:{status:'pending_phone'}};
 const runtime=await withWorkspaceServiceCredentials(request,env);await guard();
 if(body.provider==='apollo'&&body.channel==='phone'){
  const resolved=await scope.resolvePerson(runtime,person);await guard();
  // Retain the exact directory ID so the signed, asynchronous CRM webhook
  // result can be shown on the source identity after reopening the shortlist.
  if(!(person.identitySourceIds||[]).includes(resolved.id)){
   const state=parse(row.state_json),selected=state.people.find(p=>p.id===person.id);
   selected.identitySourceIds=[...new Set([...(selected.identitySourceIds||[]),resolved.id])];
   const authority=guard.writeAuthority(),saved=await sql(env,`UPDATE website_contact_jobs SET state_json=?,revision=revision+1 WHERE id=? AND workspace_id=? AND state_json=? AND ${authority.sql}`,JSON.stringify(state),row.id,context.workspaceId,row.state_json,...authority.args).run();
   if(!saved.meta.changes)throw contactError('Contact research changed. Reopen the saved contact.');
  }
  if(body.phone_sequence===true)return startBuyerPhone(runtime,context,row.company_id,person,resolved.id,{guard,signal:request.signal,websiteJob:row.id,enrich:deps.enrich});
  const lookup=new Request('https://leadintel.internal/enrich',{method:'POST',body:JSON.stringify({person_id:resolved.id,name:person.publicName||person.name,title:person.title,phone_lookup:true}),signal:request.signal});
  const response=await (deps.enrich||enrichCrmContact)(lookup,runtime,{},{context,guard},row.company_id),result=await response.json();
  if(!response.ok)throw contactError(result.error||'Apollo phone lookup unavailable.',response.status,result.code);
  return result;
 }
 // These inputs are constructed here: automatic/combined/reveal flags supplied
 // by the browser never acquire authority over a sibling channel.
 return (deps.lookup||lookupAdditionalEmail)(runtime,{workspaceId:context.workspaceId,userId:context.userId,role:context.role,writeAuthority:guard.writeAuthority},row.company_id,{person_id:String(body.personId),approved:true,automatic:false,provider:body.provider,hunter_approved:body.provider==='hunter',email_lookup:body.channel==='email',data_lookup:body.channel==='phone',phone_approved:body.channel==='phone'},{signal:request.signal,guard,researchScope:scope,...deps.providerDeps});
}
