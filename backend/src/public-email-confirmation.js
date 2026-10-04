import '../../customer/contact-confirmation-policy.js';
import '../../customer/discovery-engine.js';
import {resolveWorkspaceServiceCredential} from './service-integrations.js';
import {getCrmCompany,upsertCrmContacts,appendCrmActivity} from './crm.js';
const policy=globalThis.LeadIntelContactPolicy;
export {loadConfirmationLevel} from './contact-confirmation-policy.js';
export async function confirmPublicWorkEmail(env,context,companyId,input={}, {loadPage}={}){
  const detail=await getCrmCompany(env.DB,context,companyId),company=detail.company;
  const name=String(input.name||'').trim(),email=String(input.email||'').trim().toLowerCase(),source=String(input.source_url||'');
  if(['suppressed','archived'].includes(company.lifecycle_status)||!policy.publicSource(email,name,source,company.normalized_domain))throw Object.assign(new Error('An exact full-name and official company-email source is required'),{status:409,code:'PUBLIC_EMAIL_SOURCE_REQUIRED'});
  const existing=detail.contacts?.find(c=>String(c.normalized_email||'').toLowerCase()===email);
  if(existing&&String(existing.name||'').trim().toLowerCase()!==name.toLowerCase())throw Object.assign(new Error('This email is already associated with another buyer; review the identity conflict'),{status:409,code:'PUBLIC_EMAIL_IDENTITY_CONFLICT'});
  if(existing&&policy.accepted(existing,company.normalized_domain,'public_confirmed'))return existing;
  let row;
  if(loadPage)row=await loadPage(source);else{
    const credential=await resolveWorkspaceServiceCredential(env,context.workspaceId,'firecrawl');
    const url=credential.source==='customer'?'https://api.firecrawl.dev/v2/scrape':`${env.FIRECRAWL_PROXY_URL||'https://apollo-proxy.edgars-7e7.workers.dev'}/firecrawl-scrape`;
    const headers={'Content-Type':'application/json',Accept:'application/json'};if(credential.source==='customer')headers.Authorization=`Bearer ${credential.apiKey}`;
    const response=await fetch(url,{method:'POST',headers,body:JSON.stringify({url:source,formats:['markdown']}),signal:AbortSignal.timeout(20000)});
    if(!response.ok)throw Object.assign(new Error('Official email-source check is unavailable'),{status:502});
    const payload=await response.json();row=payload.data||payload;
  }
  const actual=row?.metadata?.sourceURL||row?.metadata?.url||source;
  if(!policy.publicSource(email,name,actual,company.normalized_domain)||!globalThis.LeadIntelDiscovery.sourcedBuyerEmails({name},company.normalized_domain,[{url:actual,markdown:row?.markdown||row?.content||row?.text}]).some(item=>item.email===email))throw Object.assign(new Error('The official page did not confirm this exact person and email'),{status:409,code:'PUBLIC_EMAIL_NOT_ATTRIBUTED'});
  const contacts=await upsertCrmContacts(env.DB,context,companyId,[{name,title:input.title,external_person_id:input.person_id,work_email:email,email_status:'public_unverified',source:'public_research',public_email_url:actual,public_name_url:actual}]);
  const contact=contacts[0];if(!contact)throw new Error('Could not save public confirmation');
  if(contact.email_status!=='verified')await env.DB.prepare("UPDATE crm_contacts SET email_status='public_confirmed',verification_provider='Public source',verified_at=?,public_email_url=? WHERE id=? AND workspace_id=? AND company_id=? AND LOWER(COALESCE(email_status,''))!='verified'").bind(new Date().toISOString(),actual,contact.id,context.workspaceId,companyId).run();
  await appendCrmActivity(env.DB,context,{company_id:companyId,contact_id:contact.id,type:'contact.public_email_confirmed',summary:'Official source confirms the buyer–email link; mailbox delivery unverified',metadata:{email,source_url:actual}});
  return (await getCrmCompany(env.DB,context,companyId)).contacts.find(c=>c.id===contact.id);
}
