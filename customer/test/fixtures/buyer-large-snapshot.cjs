// Synthetic retained research at the same data boundaries as a mature workspace.
// No real customer information, credentials or provider execution is included.
module.exports=function largeBuyerSnapshot(candidate){
 const c=structuredClone(candidate),stamp=new Date().toISOString();
 const receipts=person=>({version:1,evidenceVersion:2,policyVersion:'20261021-adaptive-depth-v3',identityKey:[c.domain,c.company,person.name,person.title].join('|').toLowerCase(),checks:Object.fromEntries(['official','public','direct_email','phone','linkedin','gmail','deep'].map(check=>[check,{status:'partial',checkedAt:stamp,reason:'A previous source read is incomplete',queryLog:Array.from({length:check==='gmail'?3:check==='direct_email'||check==='deep'?2:1},(_,i)=>({query:person.name+' '+check+' '+i,status:'partial',searchStatus:'complete',resultCount:12,checkedAt:stamp,sourceReads:Array.from({length:12},(_,n)=>({url:'https://'+c.domain+'/research/'+check+'/'+i+'/'+n,status:'partial',checkedAt:stamp,reason:'Retained source extraction receipt with incomplete supporting evidence. '.repeat(2)}))}))}]))});
 for(const p of c.people||[])p.contactResearch=receipts(p);
 const people=c.people||[];
 c.buyerDiscovery={...(c.buyerDiscovery||{}),opportunityRoles:c.buyerRoles,pool:people.map(p=>structuredClone(p)),companyContacts:Array.from({length:20},(_,i)=>structuredClone(people[i%people.length])),resultDiagnostics:Array.from({length:80},(_,i)=>({source:'official',url:'https://'+c.domain+'/team',parsedName:people[i%people.length]?.name,parsedTitle:people[i%people.length]?.title,parsedCompany:c.company,accepted:true,companyVerification:'complete',roleMatching:'complete',sourceExcerpt:'Saved source context and read diagnostics. '.repeat(180)}))};
 c.publicResearch={...(c.publicResearch||{}),evidenceVersion:2,sources:['https://'+c.domain+'/team'],reviewEvidence:Array.from({length:20},()=>({url:'https://'+c.domain+'/team',excerpt:'Saved named company research. '.repeat(200)}))};
 return c;
};
