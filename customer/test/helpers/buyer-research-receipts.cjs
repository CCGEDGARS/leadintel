const D=require('../../discovery-engine.js');
module.exports=function receipts(candidate,stamp=new Date().toISOString()){
 for(const p of candidate.people||[]){
  const plan=D.buyerResearchQueryPlan(candidate,p);
  p.contactResearch={version:1,evidenceVersion:2,...p.contactResearch,identityKey:D.buyerResearchIdentityKey(candidate,p),policyVersion:D.BUYER_CONTACT_RESEARCH_POLICY.version,checks:Object.fromEntries(Object.entries(plan).map(([key,queries])=>[key,{status:'complete',checkedAt:stamp,attempts:1,...(key==='linkedin'?{profileMatchVersion:1}:{}),queryLog:queries.map(query=>({query,status:'complete',checkedAt:stamp,resultCount:0}))}]))};
 }
 if(candidate.publicResearch?.accountability)candidate.publicResearch.accountability.officialPageReads=[{url:'https://'+candidate.domain+'/team',sourceRead:true,checkedAt:stamp}];
 const inventory=candidate.buyerDiscovery?.officialContactInventory;
 if(inventory?.research){const url='https://'+candidate.domain+'/team';Object.assign(inventory.research,{queries:D.officialContactResearchQueries(candidate).map(query=>({query,status:'complete',results:0})),reads:[{url,status:'complete',reason:''}],completedUrls:[url],pendingUrls:[],failures:[],discoveryTruncated:false});}
 return candidate;
};
