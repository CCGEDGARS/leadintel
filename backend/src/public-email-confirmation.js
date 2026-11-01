import '../../customer/contact-confirmation-policy.js';
import '../../customer/discovery-engine.js';
import {requireWorkspaceServiceCredential,resolveWorkspaceServiceCredential,fetchDirectPublicPage} from './service-integrations.js';
import {getCrmCompany,upsertCrmContacts,appendCrmActivity,writeCrmRecord} from './crm.js';
const policy=globalThis.LeadIntelContactPolicy;
export {loadConfirmationLevel} from './contact-confirmation-policy.js';
export async function confirmPublicWorkEmail(env,context,companyId,input={}, {loadPage,guard=context.guard||(async()=>{})}={}){
  context={...context,guard,writeAuthority:context.writeAuthority||guard.writeAuthority};
  await guard();const detail=await getCrmCompany(env.DB,context,companyId),company=detail.company;
  const name=String(input.name||'').trim(),email=String(input.email||'').trim().toLowerCase(),source=String(input.source_url||'');
  if(['suppressed','archived'].includes(company.lifecycle_status)||!policy.publicSource(email,name,source,company.normalized_domain))throw Object.assign(new Error('An exact full-name and official company-email source is required'),{status:409,code:'PUBLIC_EMAIL_SOURCE_REQUIRED'});
  const existing=detail.contacts?.find(c=>String(c.normalized_email||'').toLowerCase()===email);
  if(existing&&String(existing.name||'').trim().toLowerCase()!==name.toLowerCase())throw Object.assign(new Error('This email is already associated with another buyer; review the identity conflict'),{status:409,code:'PUBLIC_EMAIL_IDENTITY_CONFLICT'});
  if(existing&&policy.accepted(existing,company.normalized_domain,'public_confirmed'))return existing;
  const attributable=row=>{
    const actual=row?.metadata?.sourceURL||row?.metadata?.url||source;
    return policy.publicSource(email,name,actual,company.normalized_domain)&&globalThis.LeadIntelDiscovery.sourcedBuyerEmails({name,title:input.title},company.normalized_domain,[{url:actual,markdown:row?.markdown||row?.content||row?.text,sourceRead:true}],company.company_name).some(item=>item.email===email);
  };
  let row,sourceMethod='public_scrape';
  if(loadPage)row=await loadPage(source);else{
    await guard();try{row=(await fetchDirectPublicPage(source)).data;sourceMethod='direct_public_html';}catch(cause){if([404,410].includes(cause?.status))throw Object.assign(new Error('The official email-source page is no longer available; find a current source'),{status:409,code:'PUBLIC_EMAIL_NOT_ATTRIBUTED'});}
    if(row&&!policy.publicSource(email,name,row.metadata?.sourceURL||row.metadata?.url||source,company.normalized_domain))throw Object.assign(new Error('The official page redirected outside the company source'),{status:409,code:'PUBLIC_EMAIL_NOT_ATTRIBUTED'});
    if(!attributable(row)){
      sourceMethod='public_scrape';
      const credential=await requireWorkspaceServiceCredential(env,context.workspaceId,'firecrawl');
      const url='https://api.firecrawl.dev/v2/scrape';
      const headers={'Content-Type':'application/json',Accept:'application/json'};if(credential.source==='customer')headers.Authorization=`Bearer ${credential.apiKey}`;
      await guard();const response=await fetch(url,{method:'POST',headers,body:JSON.stringify({url:source,formats:['markdown'],onlyMainContent:false}),signal:AbortSignal.timeout(20000)});
      if(!response.ok)throw Object.assign(new Error('Official email-source check is unavailable'),{status:502});
      const payload=await response.json();row=payload.data||payload;
    }
  }
  await guard();const actual=row?.metadata?.sourceURL||row?.metadata?.url||source;
  if(!attributable(row))throw Object.assign(new Error('The official page did not confirm this exact person and email'),{status:409,code:'PUBLIC_EMAIL_NOT_ATTRIBUTED'});
  await guard();const contacts=await upsertCrmContacts(env.DB,context,companyId,[{name,title:input.title,external_person_id:input.person_id,work_email:email,email_status:'public_unverified',source:'public_research',public_email_url:actual,public_name_url:actual}]);
  const contact=contacts[0];if(!contact)throw new Error('Could not save public confirmation');
  await guard();if(!policy.accepted(contact,company.normalized_domain,'provider_verified'))await writeCrmRecord(env.DB,context,"UPDATE crm_contacts SET email_status='public_confirmed',verification_provider='Public source',verified_at=?,public_email_url=? WHERE id=? AND workspace_id=? AND company_id=? AND (LOWER(COALESCE(email_status,''))!='verified' OR (LOWER(COALESCE(verification_provider,'')) NOT IN ('apollo','hunter','treg') AND LOWER(COALESCE(source,'')) NOT IN ('apollo','hunter','treg')))",[new Date().toISOString(),actual,contact.id,context.workspaceId,companyId]);
  await guard();await appendCrmActivity(env.DB,context,{company_id:companyId,contact_id:contact.id,type:'contact.public_email_confirmed',summary:'Official source confirms the buyer–email link; mailbox delivery unverified',metadata:{email,source_url:actual,source_method:sourceMethod}});
  return (await getCrmCompany(env.DB,context,companyId)).contacts.find(c=>c.id===contact.id);
}
