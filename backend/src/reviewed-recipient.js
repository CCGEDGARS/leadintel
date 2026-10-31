import {normalizeDomain,normalizeEmail} from './crm.js';
const identity=value=>String(value||'').trim().replace(/\s+/g,' ').toLowerCase();
const profile=value=>identity(value).replace(/^https?:\/\/(?:[a-z]+\.)?linkedin\.com\//,'linkedin.com/').replace(/\/$/,'');
export function assertReviewedRecipient(snapshot,contact,company){
 const deny=()=>{throw Object.assign(Error('The reviewed recipient identity changed or is missing. Reopen Buyers and review this exact draft before delivery.'),{status:409,code:'REVIEWED_RECIPIENT_CHANGED'});};
 if(!snapshot||typeof snapshot!=='object'||Array.isArray(snapshot)||['name','title','email','linkedin','companyDomain'].some(key=>typeof snapshot[key]!=='string'))deny();
 const email=normalizeEmail(snapshot.email),contactId=snapshot.contactId||snapshot.contact_id||'',personId=String(snapshot.id||'');
 if(!personId&&!contactId||personId&&personId!==contact.id&&(contact.external_person_id?personId!==String(contact.external_person_id):contactId!==contact.id))deny();
 for(const name of [snapshot.publicName,snapshot.suppliedName].filter(Boolean))if(identity(name)!==identity(contact.name))deny();
 if(!email||email!==normalizeEmail(contact.normalized_email)||contact.work_email&&email!==normalizeEmail(contact.work_email)||identity(snapshot.name)!==identity(contact.name)||identity(snapshot.title)!==identity(contact.title)||profile(snapshot.linkedin)!==profile(contact.linkedin_url)||normalizeDomain(snapshot.companyDomain)!==company.normalized_domain||contactId&&contactId!==contact.id)deny();
 if(snapshot.company&&identity(snapshot.company)!==identity(company.company_name))deny();
 return true;
}
export function reviewedRecipient(contact,company){return {id:contact.id,contactId:contact.id,name:contact.name||'',title:contact.title||'',email:contact.normalized_email||contact.work_email||'',linkedin:contact.linkedin_url||'',company:company.company_name||'',companyDomain:company.normalized_domain||''};}
