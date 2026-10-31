import {assertReviewedRecipient,reviewedRecipient} from './reviewed-recipient.js';
import ContactPolicy from '../../customer/contact-confirmation-policy.js';
import {loadConfirmationLevel} from './contact-confirmation-policy.js';
import {sha256} from './security.js';
export function queuedRecipientIdentity(contact={},company={}){return JSON.stringify({id:contact.id||'',companyId:contact.company_id||'',name:contact.name||'',title:contact.title||'',email:contact.normalized_email||'',workEmail:contact.work_email||'',profile:contact.linkedin_url||'',publicProfile:contact.public_linkedin_url||'',personId:contact.external_person_id||'',emailStatus:contact.email_status||'',source:contact.source||'',verificationProvider:contact.verification_provider||'',publicEmailUrl:contact.public_email_url||'',verifiedAt:contact.verified_at||'',company:company.company_name||'',domain:company.normalized_domain||''});}
export async function queuedRecipientBinding(contact,company){return 'recipient-v2:'+await sha256(queuedRecipientIdentity(contact,company));}
export async function queuedRecipientCurrent(env,sequence){
 const campaign=String(sequence.contact_identity||'').startsWith('campaign:');
 if(!campaign&&!String(sequence.contact_identity||'').startsWith('recipient-v2:'))return false;
 const company=await env.DB.prepare("SELECT * FROM crm_companies WHERE workspace_id=? AND normalized_domain=? AND deleted_at IS NULL AND lifecycle_status NOT IN ('suppressed','archived')").bind(sequence.workspace_id,sequence.domain).first();if(!company)return false;
 const contact=await env.DB.prepare('SELECT * FROM crm_contacts WHERE workspace_id=? AND company_id=? AND normalized_email=? AND archived_at IS NULL').bind(sequence.workspace_id,company.id,sequence.recipient).first();if(!contact)return false;try{assertReviewedRecipient(reviewedRecipient(contact,company),contact,company);}catch{return false;}return Boolean(contact)&&ContactPolicy.accepted(contact,sequence.domain,await loadConfirmationLevel(env,sequence.workspace_id))&&(campaign||await queuedRecipientBinding(contact,company)===sequence.contact_identity);
}
