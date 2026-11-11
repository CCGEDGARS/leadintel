import '../../customer/discovery-engine.js';
const D=globalThis.LeadIntelDiscovery;
export function websiteContactIdentity(person={}){
 const name=String(person.publicName||person.name||'').trim();
 if(!D.hasFullBuyerName(name)||[person.name,person.publicName].some(value=>/['’]s\s+(?:post|activity|article|profile|comment)\b|\bon\s+(?:linkedin|facebook|instagram)\s*$/i.test(String(value||'')))||D.hasContactEmploymentSubject(person.title))return false;
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
 if(person.identityConflict||['conflict','recruitment_contact'].includes(person.roleReview?.status)||research?.status!=='complete'||!(research.searches>0)||research.failed||!(age>=0&&age<30*86400000))return false;
 if(!D.BUYER_CONTACT_RESEARCH_POLICY.requiredChecks.every(key=>D.buyerResearchCheckPassed(candidate,person,key)))return false;
 if(!D.acceptedOfficialBuyerEmail(candidate,person)&&!D.buyerResearchCheckPassed(candidate,person,'deep'))return false;
 const independent=person.contactResearch?.checks?.independent;
 return !independent||independent.status==='not_needed'||independent.status==='complete'&&independent.queryLog?.length>0&&independent.queryLog.every(row=>row.status==='complete'&&(!row.sourceReads||row.sourceReads.every(r=>['complete','not_needed'].includes(r.status))));
}
