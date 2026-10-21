import {loadConfirmationLevel} from './public-email-confirmation.js';
import '../../customer/contact-confirmation-policy.js';
// Delivery reuses confirmed evidence. Paid verification is a separately approved contact action.
export async function verifyAutomaticEmail(env,workspaceId,email,{companyDomain='',confirmationLevel}={}){
  const address=String(email||'').trim().toLowerCase();
  if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(address))return {verified:false,status:'not_found',reason:'Email not found'};
  try{
    if(!companyDomain)return {verified:false,status:'needs_review',reason:'Verified company contact required',provider:'CRM'};
    const contact=await env.DB.prepare("SELECT c.* FROM crm_contacts c JOIN crm_companies co ON co.id=c.company_id AND co.workspace_id=c.workspace_id WHERE c.workspace_id=? AND c.normalized_email=? AND co.normalized_domain=? AND c.archived_at IS NULL AND co.deleted_at IS NULL AND co.lifecycle_status NOT IN ('suppressed','archived') LIMIT 1").bind(workspaceId,address,String(companyDomain).toLowerCase()).first();
    const minimum=confirmationLevel||await loadConfirmationLevel(env,workspaceId);
    const verified=String(contact?.name||'').trim().split(/\s+/).length>=2&&globalThis.LeadIntelContactPolicy.accepted({...contact,normalized_email:address},companyDomain,minimum);
    if(verified&&contact.email_status==='public_confirmed')return {verified:true,status:'public_confirmed',provider:'Public source',mailbox_verified:false};
    const provider=[contact?.verification_provider,contact?.source].find(value=>['apollo','hunter','treg'].includes(String(value||'').toLowerCase()));
    return {verified,status:verified?'verified':'needs_review',reason:verified?'':contact?.email_status==='public_confirmed'?'Recheck the official source, or separately approve provider verification for this contact.':'Confirm the company email in Buyers. Paid contact research requires approval.',provider:provider?/treg/i.test(provider)?'Treg':/hunter/i.test(provider)?'Hunter':'Apollo':'CRM',...(verified&&/hunter/i.test(provider||'')?{cached:true}:{})};
  }catch{return {verified:false,status:'needs_review',reason:'Email confirmation unavailable. Retry the saved contact check.'};}
}
