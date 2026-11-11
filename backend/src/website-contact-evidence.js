import '../../customer/discovery-engine.js';
const D=globalThis.LeadIntelDiscovery;
export function websiteContactRole(value){
 const text=String(value||'').toLowerCase();
 if(/administrerende\s+direktør|adm\.?\s*direktør|verkställande\s+direktör/.test(text))return 'ceo';
 for(const [code,words] of [['ceo','chief executive officer'],['cfo','chief financial officer'],['coo','chief operating officer'],['cto','chief technology officer'],['cio','chief information officer'],['cmo','chief marketing officer'],['chro','chief human resources officer']])if(new RegExp('\\b'+code+'\\b').test(text)||text.includes(words))return code;
 return text.trim();
}
export function websiteFreeResearchComplete(candidate,person){
 // Coverage is independent of the Buyer recommendation's two-provider
 // executive/committee rule. Actual identity conflicts still block it.
 const research=person.emailResearch,age=Date.now()-Date.parse(research?.checkedAt||'');
 if(person.identityConflict||['conflict','recruitment_contact'].includes(person.roleReview?.status)||research?.status!=='complete'||!(research.searches>0)||research.failed||!(age>=0&&age<30*86400000))return false;
 if(!D.BUYER_CONTACT_RESEARCH_POLICY.requiredChecks.every(key=>D.buyerResearchCheckPassed(candidate,person,key)))return false;
 if(!D.acceptedOfficialBuyerEmail(candidate,person)&&!D.buyerResearchCheckPassed(candidate,person,'deep'))return false;
 const independent=person.contactResearch?.checks?.independent;
 return !independent||independent.status==='not_needed'||independent.status==='complete'&&independent.queryLog?.length>0&&independent.queryLog.every(row=>row.status==='complete'&&(!row.sourceReads||row.sourceReads.every(r=>['complete','not_needed'].includes(r.status))));
}
