import '../../customer/discovery-engine.js';
const D=globalThis.LeadIntelDiscovery;
export const websiteNameKey=value=>String(value||'').normalize('NFKD').replace(/\p{M}/gu,'').toLowerCase().replace(/\s+/g,' ').trim();
// Compare the stable professional profile path; retain actual source URLs.
export function websiteProfileKey(value){const url=D.normalizeProfessionalLinkedInUrl(value);return url?new URL(url).pathname.toLowerCase():'';}
export function websiteIdentitySupport(candidate,person){
 const blocked=person.identityConflict||person.linkedinProfileReview?.status==='review_required'||person.opportunityScope?.status==='review_required'||['conflict','recruitment_contact'].includes(person.roleReview?.status);
 if(blocked)return {eligible:false,kind:'review',reason:'Resolve the conflicting identity or current-employer evidence.'};
 if(!websiteContactIdentity(person)||!D.hasFullBuyerName(person.publicName||person.name)||!person.title)return {eligible:false,kind:'missing',reason:'A full professional identity and role are required.'};
 if(person.identityOrigin==='official'&&D.canonicalDomain(person.publicNameUrl)===candidate.domain)return {eligible:true,kind:'official'};
 const evidence=person.linkedinIdentityEvidence,profile=websiteProfileKey(person.publicLinkedinUrl||person.linkedin_url),age=Date.now()-Date.parse(evidence?.checkedAt||'');
 if(profile&&websiteProfileKey(evidence?.url)===profile&&websiteNameKey(evidence?.name)===websiteNameKey(person.publicName||person.name)&&websiteNameKey(evidence?.organization)===websiteNameKey(candidate.company)&&websiteNameKey(person.organization)===websiteNameKey(candidate.company)&&age>=0&&age<30*86400000)return {eligible:true,kind:'professional_profile'};
 return {eligible:false,kind:'unconfirmed',reason:'Confirm this person and current company from an official source or a unique professional profile match.'};
}
export function websiteContactIdentity(person={}){
 if(!D.isIndependentContactPerson(person))return false;
 const source=person.publicNameUrl||'';
 if(!source)return person.identityOrigin==='apollo';
 try{const url=new URL(source);if(/(^|\.)linkedin\.com$/i.test(url.hostname)&&!D.normalizeProfessionalLinkedInUrl(source))return false;return ['https:','http:'].includes(url.protocol);}catch{return false;}
}
export function websiteContactRole(value){
 const text=String(value||'').toLowerCase();
 if(/administrerende\s+direktør|adm\.?\s*direktør|verkställande\s+direktör/.test(text))return 'ceo';
 for(const [code,words] of [['ceo','chief executive officer'],['cfo','chief financial officer'],['coo','chief operating officer'],['cto','chief technology officer'],['cio','chief information officer'],['cmo','chief marketing officer'],['chro','chief human resources officer']])if(new RegExp('\\b'+code+'\\b').test(text)||text.includes(words))return code;
 return text.trim();
}
export function websiteFreeResearchComplete(candidate,person){
 if(!websiteContactIdentity(person))return false;
 // Coverage is independent of the Buyer recommendation's two-provider
 // executive/committee rule. Actual identity conflicts still block it.
 const research=person.emailResearch,age=Date.now()-Date.parse(research?.checkedAt||'');
 if(person.identityConflict||person.linkedinProfileReview?.status==='review_required'||person.opportunityScope?.status==='review_required'||['conflict','recruitment_contact'].includes(person.roleReview?.status)||research?.status!=='complete'||!(research.searches>0)||research.failed||!(age>=0&&age<30*86400000))return false;
 if(!D.BUYER_CONTACT_RESEARCH_POLICY.requiredChecks.every(key=>D.buyerResearchCheckPassed(candidate,person,key)))return false;
 if(!D.acceptedOfficialBuyerEmail(candidate,person)&&!D.buyerResearchCheckPassed(candidate,person,'deep'))return false;
 const independent=person.contactResearch?.checks?.independent;
 return !independent||independent.status==='not_needed'||independent.status==='complete'&&independent.queryLog?.length>0&&independent.queryLog.every(row=>row.status==='complete'&&(!row.sourceReads||row.sourceReads.every(r=>['complete','not_needed'].includes(r.status))));
}
