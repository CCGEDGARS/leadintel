import {loadConfirmationLevel} from './public-email-confirmation.js';
import '../../customer/contact-confirmation-policy.js';
import {resolveWorkspaceServiceCredential,hunterVerificationPolicy} from './service-integrations.js';
// Mailbox validity is separate from CRM identity verification. Both must pass.
export async function verifyAutomaticEmail(env,workspaceId,email,{fetcher=fetch,resolveCredential=resolveWorkspaceServiceCredential,readPolicy=hunterVerificationPolicy,companyDomain='',confirmationLevel}={}){
  const address=String(email||'').trim().toLowerCase();
  if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(address))return {verified:false,status:'not_found',reason:'Email not found'};
  try{
    const policy=await readPolicy(env,workspaceId);
    if(!policy.enabled){
      if(!companyDomain)return {verified:false,status:'needs_review',reason:'Verified company contact required',provider:'CRM'};
      const contact=await env.DB.prepare("SELECT c.* FROM crm_contacts c JOIN crm_companies co ON co.id=c.company_id AND co.workspace_id=c.workspace_id WHERE c.workspace_id=? AND c.normalized_email=? AND co.normalized_domain=? AND c.archived_at IS NULL AND co.deleted_at IS NULL AND co.lifecycle_status!='suppressed' LIMIT 1").bind(workspaceId,address,String(companyDomain).toLowerCase()).first();
      const attributable=String(contact?.name||'').trim().split(/\s+/).length>=2;
      const provider=['Apollo','Hunter'].includes(contact?.verification_provider)?contact.verification_provider.toLowerCase():String(contact?.source||'').toLowerCase();
      const minimum=confirmationLevel||await loadConfirmationLevel(env,workspaceId);
      const verified=attributable&&globalThis.LeadIntelContactPolicy.accepted({...contact,normalized_email:address},companyDomain,minimum);
      if(verified&&contact.email_status==='public_confirmed')return {verified:true,status:'public_confirmed',provider:'Public source',mailbox_verified:false};
      return {verified,status:verified?'verified':'needs_review',reason:verified?'':'An attributable provider-verified company email is required',provider:provider==='apollo'?'Apollo':provider==='hunter'?'Hunter':'CRM'};
    }
    if(companyDomain){
      const cached=await env.DB.prepare("SELECT name,email_status,public_email_url,verification_provider,verified_at FROM crm_contacts WHERE workspace_id=? AND normalized_email=? AND LOWER(email_status) IN ('verified','public_confirmed') AND archived_at IS NULL AND company_id IN (SELECT id FROM crm_companies WHERE workspace_id=? AND normalized_domain=? AND deleted_at IS NULL AND lifecycle_status!='suppressed') LIMIT 1").bind(workspaceId,address,workspaceId,String(companyDomain).toLowerCase()).first();
      if(String(cached?.name||'').trim().split(/\s+/).length<2)return {verified:false,status:'needs_review',reason:'Confirmed buyer identity is required',provider:'CRM'};
      if(cached.email_status==='public_confirmed'&&!globalThis.LeadIntelContactPolicy.accepted({...cached,normalized_email:address},companyDomain,'public_confirmed'))return {verified:false,status:'needs_review',reason:'Recheck the official buyer–email source before mailbox verification',provider:'CRM'};
      const age=Date.now()-Date.parse(cached?.verified_at||'');
      if(cached?.verification_provider==='Hunter'&&age>=0&&age<30*24*60*60*1000)return {verified:true,status:'verified',provider:'Hunter',cached:true};
    }
    const credential=await resolveCredential(env,workspaceId,'hunter');
    if(credential.source!=='customer'||!credential.apiKey)return {verified:false,status:'needs_review',reason:'Additional Hunter verification is enabled but its connection is unavailable'};
    const response=await fetcher(`https://api.hunter.io/v2/email-verifier?email=${encodeURIComponent(address)}`,{headers:{Accept:'application/json','X-API-KEY':credential.apiKey},signal:AbortSignal.timeout(20000)});
    if(!response.ok||response.status===202)return {verified:false,status:'needs_review',reason:'Email verification unavailable or pending. Review the provider connection and credits.'};
    const data=(await response.json()).data||{};
    const verified=String(data.email||'').toLowerCase()===address&&data.status==='valid'&&!data.accept_all&&!data.block;
    if(verified&&companyDomain)await env.DB.prepare("UPDATE crm_contacts SET email_status='verified',verification_provider='Hunter',verified_at=CURRENT_TIMESTAMP WHERE workspace_id=? AND normalized_email=? AND LOWER(email_status) IN ('verified','public_confirmed') AND archived_at IS NULL AND company_id IN (SELECT id FROM crm_companies WHERE workspace_id=? AND normalized_domain=? AND deleted_at IS NULL AND lifecycle_status!='suppressed')").bind(workspaceId,address,workspaceId,String(companyDomain).toLowerCase()).run();
    return {verified,status:verified?'verified':'needs_review',reason:verified?'':'Email verification failed or was inconclusive',provider:'Hunter'};
  }catch{return {verified:false,status:'needs_review',reason:'Email verification unavailable. Retry after reviewing the provider connection.'};}
}
