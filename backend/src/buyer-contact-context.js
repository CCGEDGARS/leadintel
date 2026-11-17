import {findCrmCompanyByDomain,getCrmCompany} from './crm.js';
import '../../customer/discovery-engine.js';
import '../../customer/contact-confirmation-policy.js';
const D=globalThis.LeadIntelDiscovery,C=globalThis.LeadIntelContactPolicy;
const same=(a,b)=>String(a||'').trim().replace(/\s+/g,' ').toLowerCase()===String(b||'').trim().replace(/\s+/g,' ').toLowerCase();
const profile=value=>D.normalizeLinkedInUrl(value).replace(/^https?:\/\/(?:[a-z0-9-]+\.)*linkedin\.com(?=\/)/i,'https://linkedin.com');
const profiles=(person,includeConfirmed=true)=>[person.publicLinkedinUrl,person.linkedin_url,person.public_linkedin_url,person.linkedinUrl,person.linkedin,...(includeConfirmed?[person.linkedinConfirmedUrl]:[]),person.profile?.linkedinUrl].filter(value=>value!==undefined&&value!==null&&String(value).trim()).map(profile);
const coherent=aliases=>aliases.every(url=>/^https:\/\/linkedin\.com\/in\//i.test(url))&&new Set(aliases).size<=1;
function boundDetail(candidate,context,detail){
 const company=detail?.company;
 return Boolean(context.workspaceId&&company?.id&&String(company.workspace_id)===String(context.workspaceId)&&D.canonicalDomain(company.normalized_domain||company.domain||company.website)===D.canonicalDomain(candidate.domain)&&(!candidate.crmId||String(candidate.crmId)===String(company.id)));
}
// Only server-owned CRM records enter these callbacks. Person snapshots and
// generated provider-looking contactData never establish an accepted channel.
export function buyerContactOptions(candidate,context,detail){
 const bound=boundDetail(candidate,context,detail),companyId=bound?detail.company.id:undefined;
 const contacts=person=>!bound?[]:(detail.contacts||[]).filter(contact=>{
  if(String(contact.workspace_id)!==String(context.workspaceId)||String(contact.company_id)!==String(companyId)||contact.external_person_id&&String(contact.external_person_id)!==String(person.id)||!same(contact.name,person.publicName||person.name))return false;
  if(contact.title&&!same(contact.title,person.title)||contact.organization&&!same(contact.organization,person.organization))return false;
  return coherent([...profiles(person),...profiles(contact)]);
 });
 const address=contact=>String(contact.normalized_email||contact.work_email||contact.email||'').trim().toLowerCase();
 const selected=person=>{
  const matches=contacts(person);if(matches.length===1)return matches[0];
  const accepted=matches.filter(contact=>C.accepted(contact,candidate.domain,'public_confirmed')),addresses=new Set(accepted.map(address));
  return accepted.length&&addresses.size===1?accepted[0]:null;
 };
 return {workspaceId:context.workspaceId,companyId,contactForPerson:person=>selected(person)||{},confirmedEmail:person=>{
  if(person.opportunityScope?.status==='review_required'||person.identityStatus==='pending'||person.nameVerification==='pending'||candidate.buyerRolesChanged||!D.hasFullBuyerName(person.publicName||person.name)||!D.qualifyBuyer(person,{decisionMakers:person.matchedBuyerRole||person.title},candidate).eligible)return '';
  const contact=selected(person)||{};
  if(!coherent([...profiles(person,false),...profiles(contact,false)])||[...(candidate.publicResearch?.conflicts||[]),...(candidate.publicResearch?.aiReview?.conflicts||[])].some(row=>String(row.person_id)===String(person.id)))return '';
  if(contact.email_status==='public_listed'&&C.rejectedListing(address(contact),contact.public_email_url,person))return '';
  if(C.accepted(contact,candidate.domain,'provider_verified'))return address(contact);
  if(contact.archived_at||['invalid','undeliverable','bounced','rejected','suppressed'].includes(String(contact.email_status||'').toLowerCase()))return '';
  const published=D.acceptedOfficialBuyerEmail(candidate,person)||D.listedBuyerEmailSource(candidate,person)?.email,addresses=[contact.normalized_email,contact.work_email,contact.email].filter(value=>String(value||'').trim()).map(value=>String(value).trim().toLowerCase());
  return published&&addresses.every(email=>email===published)?published:'';
 }};
}
export async function loadBuyerContactContext(env,context,candidate,{detail}={}){
 if(detail===undefined){const company=await findCrmCompanyByDomain(env.DB,context.workspaceId,candidate.domain);detail=company?await getCrmCompany(env.DB,context,company.id):null;}
 const saved=boundDetail(candidate,context,detail)?detail:null;
 return {detail:saved,contactOptions:buyerContactOptions(candidate,context,saved)};
}
