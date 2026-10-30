import {resolveWorkspaceServiceCredential} from './service-integrations.js';
import {upsertCrmContacts,appendCrmActivity,getCrmCompany} from './crm.js';
const fail=(message,status=409,code='ADDITIONAL_CONTACT_HUNTER')=>Object.assign(Error(message),{status,code});
const identity=value=>String(value||'').normalize('NFKD').replace(/\p{M}/gu,'').replace(/[^\p{L}\p{N}]/gu,'').toLowerCase();
export async function findHunterWorkEmail(env,context,candidate,person,companyId,deps={}){
 const guard=deps.guard||async function(){};await guard();
 const credential=await (deps.credential||resolveWorkspaceServiceCredential)(env,context.workspaceId,'hunter');
 if(credential.source!=='customer'||!credential.apiKey)throw fail('Connect your Hunter account in Settings.',409,'ADDITIONAL_CONTACT_PROVIDER_REQUIRED');
 const name=String(person.publicName||person.name||'').trim().replace(/^(?:Dr\.?|Prof\.?)\s+/i,''),parts=name.split(/\s+/),first=parts.shift(),last=parts.join(' ');
 if(!first||!last)throw fail('Hunter requires this buyer’s full first and last name.');
 const domain=candidate.domain;
 const lookup=async(path,params)=>{
  await guard();
  let response;try{response=await (deps.fetch||fetch)(`https://api.hunter.io/v2/${path}?${new URLSearchParams(params)}`,{headers:{Accept:'application/json','X-API-KEY':credential.apiKey},signal:AbortSignal.timeout(20000)});}catch{throw fail('Hunter did not complete the request. Review the saved attempt before retrying.',502);}
  const payload=await response.json().catch(()=>({}));
  if(!response.ok)throw fail(response.status===402?'Hunter credits exhausted or payment required.':response.status===401?'Hunter rejected the saved API key.':`Hunter request failed (${response.status}).`,response.status>=400&&response.status<500?response.status:502);
  await guard();return payload.data||{};
 };
 const data=await lookup('email-finder',{domain,first_name:first,last_name:last}),email=String(data.email||'').trim().toLowerCase();
 const checkedAt=new Date().toISOString();
 if(!email)return {contact:null,reason:'Hunter completed email finding and returned no address.',research:{provider:'hunter',status:'not_found',checkedAt}};
 // A delivery result alone cannot establish whose mailbox this is.
 if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)||email.split('@')[1]!==domain||identity(data.first_name)!==identity(first)||identity(data.last_name)!==identity(last))throw fail('Hunter did not match this exact buyer and company domain.');
 let verification=data.verification||{};
 const age=verification.date?Date.now()-Date.parse(verification.date):0;
 if(verification.status!=='valid'||!Number.isFinite(age)||age<0||age>30*86400000)verification=await lookup('email-verifier',{email});
 if(verification.email&&String(verification.email).toLowerCase()!==email)throw fail('Hunter verification returned a different address.');
 const valid=verification.status==='valid'&&!verification.accept_all&&!verification.block&&!data.accept_all;
 if(!valid)return {contact:null,reason:'Hunter found a candidate but did not confirm deliverability. It remains unconfirmed.',research:{provider:'hunter',status:'unconfirmed',checkedAt}};
 const evidence={status:'valid',deliverability:'deliverable',checked_at:checkedAt};
 const save=deps.save||(async()=>{
  const detail=await getCrmCompany(env.DB,context,companyId);
  if(['suppressed','archived'].includes(detail.company.lifecycle_status))throw fail('This company is blocked in CRM.');
  if(detail.contacts.some(c=>String(c.work_email||c.normalized_email||'').toLowerCase()===email&&identity(c.name)!==identity(person.publicName||person.name)))throw fail('This address is associated with another buyer. Review the identity conflict.');
  await guard();
  const contacts=await upsertCrmContacts(env.DB,context,companyId,[{external_person_id:person.id,name:person.publicName||person.name,title:person.title,work_email:email,email_status:'verified',source:'hunter',linkedin_url:person.publicLinkedinUrl||person.linkedin_url}]);
  const contact=contacts[0];if(!contact)throw fail('Hunter email could not be saved.');
  await env.DB.prepare("UPDATE crm_contacts SET email_status='verified',email_type='work',match_confidence='verified',verification_provider='Hunter',verified_at=?,updated_at=? WHERE id=? AND workspace_id=? AND company_id=?").bind(checkedAt,checkedAt,contact.id,context.workspaceId,companyId).run();
  await env.DB.prepare("UPDATE workspace_service_integrations SET last_used_at=CURRENT_TIMESTAMP,updated_at=CURRENT_TIMESTAMP WHERE workspace_id=? AND provider='hunter'").bind(context.workspaceId).run();
  await appendCrmActivity(env.DB,context,{companyId,contactId:contact.id,type:'contact.enriched',summary:'Hunter confirmed a named buyer’s work email',metadata:{provider:'Hunter',person_provider_id:person.id}});
  return {...contact,email_status:'verified',verification_provider:'Hunter',verified_at:checkedAt};
 });
 await guard();
 return {contact:await save(email,evidence),verification:evidence,research:{provider:'hunter',status:'verified',checkedAt},request:{status:'verified'}};
}
