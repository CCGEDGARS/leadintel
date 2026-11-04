import '../../customer/discovery-engine.js';
const D=globalThis.LeadIntelDiscovery;
const parse=value=>{try{return JSON.parse(value);}catch{return {};}};
// Only server-owned, same-context and same-identity receipts can save work.
export function prepareBuyerRecheck(input,history=[]){
 if(input.scope!=='selected_buyers')return;
 const previous=history.filter(row=>parse(row.input_json).workspaceContext===input.workspaceContext).map(row=>parse(row.result_json));
 const plans={};
 for(const person of input.candidate.people){
  const identity=D.buyerResearchIdentityKey(input.candidate,person),matches=previous.flatMap(candidate=>(candidate.people||[]).filter(p=>String(p.id)===String(person.id)&&D.buyerResearchIdentityKey(candidate,p)===identity));
  if(matches[0]){
   const saved=matches[0];
   for(const field of ['contactResearch','emailResearch','publicEmail','publicEmailUrl','publicEmailEvidence','publicEmailSourceCheck','publicPhone','publicPhoneUrl','publicPhoneEvidence','publicPhoneSourceCheck','linkedinIdentityEvidence','patternFindings','gmailMatches'])if(saved[field]!==undefined)person[field]=saved[field];
  }
  const receipts=matches.flatMap(p=>p.contactResearch?.checks?.followup?.queryLog||[]);
  plans[String(person.id)]=D.buyerRecheckPlan(input.candidate,person,receipts);
 }
 // Company research is retained for context, not rerun for a contact button.
 if(previous[0]){
  const shared=previous[0].buyerDiscovery||{};
  input.candidate.buyerDiscovery={...input.candidate.buyerDiscovery,...Object.fromEntries(['companyDossier','officialContactInventory','companyContacts'].filter(key=>shared[key]!==undefined).map(key=>[key,shared[key]]))};
  input.candidate.publicResearch={...previous[0].publicResearch};
  delete input.candidate.publicResearch.paidResearch;
  delete input.candidate.publicResearch.aiReview;
 }
 input.recheck={version:1,plans,maxActiveMs:120000};
}
