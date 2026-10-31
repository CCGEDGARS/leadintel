import {normalizeDomain,normalizeEmail} from './crm.js';
import ContactPolicy from '../../customer/contact-confirmation-policy.js';
import {loadConfirmationLevel} from './contact-confirmation-policy.js';
import {messageRowAssertion} from './message-operation-authority.js';
const text=value=>String(value||'').trim().replace(/\s+/g,' ').toLowerCase();
const profile=value=>text(value).replace(/^https?:\/\/(?:[a-z]+\.)?linkedin\.com\//,'linkedin.com/').replace(/\/$/,'');
const fail=()=>{throw Object.assign(Error('Saved script recipient or company changed. Select the current buyer and review your preserved draft before saving.'),{status:409,code:'CRM_SCRIPT_CONTEXT_CHANGED'});};
export async function validateCrmScriptPackage(env,context,companyId,activity){
 const snapshot=activity.metadata?.script_package;if(snapshot===undefined)return [];
 const item=snapshot?.item;if(snapshot?.version!==1||!item||typeof item!=='object'||Array.isArray(item))fail();
 const company=await env.DB.prepare('SELECT * FROM crm_companies WHERE id=? AND workspace_id=? AND deleted_at IS NULL').bind(companyId,context.workspaceId).first();
 if(!company||normalizeDomain(item.domain)!==company.normalized_domain||text(item.company)!==text(company.company_name))fail();
 const people=Array.isArray(item.dossier?.people)?item.dossier.people:[],matches=people.filter(person=>String(person.id)===String(item.selectedPersonId));if(matches.length!==1)fail();const person=matches[0];
 const addresses=[person.email,person.work_email,person.normalized_email].filter(value=>value!==undefined&&value!==null&&String(value).trim()).map(normalizeEmail);if(addresses.some(value=>!value)||new Set(addresses).size>1)fail();const email=addresses[0]||'',contactId=person.contact_id||person.contactId||'';
 const {results:contacts=[]}=await env.DB.prepare('SELECT * FROM crm_contacts WHERE workspace_id=? AND company_id=? AND archived_at IS NULL').bind(context.workspaceId,companyId).all();
 const candidates=contacts.filter(contact=>contactId?contact.id===contactId:contact.id===String(person.id)||contact.external_person_id===String(person.id)||email&&contact.normalized_email===email);
 const same=contact=>{const names=[person.name,person.publicName].filter(Boolean);if(!names.length||names.some(name=>text(name)!==text(contact.name)))return false;if(person.title&&text(person.title)!==text(contact.title))return false;const profiles=[person.linkedinConfirmedUrl,person.publicLinkedinUrl,person.linkedin_url,person.linkedinUrl].filter(Boolean);if(profiles.some(value=>profile(value)!==profile(contact.linkedin_url)))return false;if(email&&[contact.normalized_email,contact.work_email].filter(Boolean).some(value=>normalizeEmail(value)!==email))return false;return true;};
 const valid=candidates.filter(same);if(valid.length!==1)fail();const contact=valid[0],level=await loadConfirmationLevel(env,context.workspaceId);if((item.channel||'email')==='email'&&(!email||!ContactPolicy.accepted(contact,company.normalized_domain,level)))fail();
 if(item.approved){const authority=item.approvalAuthority?.recipient;if(item.approvalAuthority?.version!==2||!authority||String(authority.id)!==String(item.selectedPersonId)||text(authority.name)!==text(contact.name)||authority.email&&normalizeEmail(authority.email)!==email||authority.linkedin&&profile(authority.linkedin)!==profile(contact.linkedin_url)||authority.contactId&&authority.contactId!==contact.id)fail();}
 const policy=await env.DB.prepare('SELECT config_json FROM approved_workflows WHERE workspace_id=?').bind(context.workspaceId).first();
 return [messageRowAssertion(env.DB,'crm_contacts','workspace_id=? AND id=?',[context.workspaceId,contact.id],contact),messageRowAssertion(env.DB,'crm_companies','workspace_id=? AND id=?',[context.workspaceId,companyId],company),messageRowAssertion(env.DB,'approved_workflows','workspace_id=?',[context.workspaceId],policy)];
}
