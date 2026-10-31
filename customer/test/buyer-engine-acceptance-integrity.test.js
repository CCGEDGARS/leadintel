const test=require('node:test'),assert=require('node:assert/strict'),D=require('../discovery-engine.js');
async function researched(){
 const c={company:'Example',domain:'example.com',buyerRoles:['Procurement Director'],buyerSearchMode:'user_selected_target',people:[{id:'anna',name:'Anna Andersson',title:'Procurement Director',organization:'Example',publicNameUrl:'https://example.com/team'}]};
 await D.runMandatoryBuyerResearch(c,{search:async()=>[],readPage:async()=>({markdown:'Anna Andersson — Procurement Director at Example.',metadata:{sourceURL:'https://example.com/team'}})});
 assert.equal(D.buyerResearchCoveragePassed(c),true,'executed bounded plan is valid');return c;
}
test('coverage rejects substituted mandatory query plans through normalization and CRM projection',async()=>{
 for(const key of ['direct_email','gmail','phone','official','public','linkedin','deep']){
  const c=await researched();c.people[0].contactResearch.checks[key].queryLog[0].query='unrelated query';
  for(const row of [c,D.normalizeDiscoveryState({selectedProspects:[c]}).selectedProspects[0]])assert.equal(D.buyerResearchCoveragePassed(row),false,key+' must require its actual plan');
  const snapshot=require('../crm-engine.js').mapDiscoveryCandidateToCrm(c).intelligence.research_snapshot.buyerResearch;
  assert.equal(D.buyerResearchCoveragePassed({...c,people:snapshot.buyers,publicResearch:snapshot.publicResearch}),false);
 }
});
test('coverage rejects receipts belonging to a different person or an invented official page count',async()=>{
 for(const mutate of [c=>Object.assign(c.people[0],{name:'Other Buyer',publicName:'Other Buyer'}),c=>c.people[0].contactResearch.identityKey='another identity',c=>c.publicResearch.accountability.officialPageReads=[],c=>c.publicResearch.accountability.officialPageReads[0].url='https://other.example/team']){
  const c=await researched();mutate(c);assert.equal(D.buyerResearchCoveragePassed(c),false);
 }
});
test('coverage rejects an unresolved full-name buyer and an unperformed execution-priority deep wave',async()=>{
 const pending=await researched();pending.people[0].nameVerification='pending';assert.equal(D.buyerResearchCoveragePassed(pending),false);
 const c=await researched();c.people[0].roleReview={status:'unconfirmed',reason:'Current role uncorroborated'};c.people[0].title='CEO';
 await D.runMandatoryBuyerResearch(c,{search:async()=>[],readPage:async()=>({markdown:'Example business website'})});
 assert.equal(c.people[0].contactResearch.checks.deep.status,'complete');delete c.people[0].contactResearch.checks.deep;assert.equal(D.buyerResearchCoveragePassed(c),false);
});
test('AI review invalidates when mandatory execution receipts, role conflicts or later source evidence change',async()=>{
 for(const mutate of [c=>c.people[0].contactResearch.checks.gmail.queryLog[0].status='partial',c=>c.people[0].roleReview={status:'conflict',reason:'Former employee'},c=>c.people[0].linkedinProfileReview={status:'review_required',urls:['https://linkedin.com/in/other-person'],checkedAt:new Date().toISOString(),reason:'Ambiguous identity'},c=>c.evidence[5].text='Anna Andersson no longer works at Example.']){
  const c=await researched();c.evidence=Array.from({length:6},(_,i)=>({url:'https://example.com/source-'+i,text:'Anna Andersson Procurement Director Example evidence '+i}));
  c.publicResearch.aiReview={status:'complete',checkedAt:new Date().toISOString(),inputSignature:D.buyerReviewSignature(c),reviewedPersonIds:['anna']};mutate(c);
  assert.equal(D.buyerQualityAssessment(c).aiReviewStatus,'stale');
 }
});
test('official inventory coverage requires all six actual discovery receipts and its completed source ledger',async()=>{
 const c=await researched();await D.runOfficialContactResearch(c,{search:async()=>[],readPage:async url=>({url,markdown:'Example official company website contacts.'})});
 const checked=()=>D.buyerQualityAssessment(c).requirements.find(row=>row.id==='official_contacts').passed;
 assert.equal(checked(),true);
 const saved=structuredClone(c.buyerDiscovery.officialContactInventory);
 for(const mutate of [v=>v.research.queries.pop(),v=>v.research.queries[0].query='Other company',v=>v.research.reads[0].status='failed',v=>v.research.completedUrls=[],v=>v.research.pendingUrls=['https://example.com/unread']]){
  c.buyerDiscovery.officialContactInventory=structuredClone(saved);mutate(c.buyerDiscovery.officialContactInventory);assert.equal(checked(),false);
 }
});
test('mandatory people checked report excludes wrong-plan receipts and another identity',async()=>{
 const B=require('../buyer-outcome-benchmark.js');
 for(const mutate of [c=>c.people[0].contactResearch.checks.gmail.queryLog[0].query='Other person',c=>c.people[0].contactResearch.identityKey='wrong person']){
  const c=await researched();assert.equal(B.evaluate(c).coverage.mandatoryPeopleChecked,1);mutate(c);assert.equal(B.evaluate(c).coverage.mandatoryPeopleChecked,0);
 }
});
test('automatic Treg scope needs current selected-person AI review without a four-buyer gate',async()=>{
 const P=require('../additional-contact-policy.js'),c=await researched(),p=c.people[0];c.qualification={eligible:true,companyScore:85,researchedAt:new Date().toISOString()};
 assert.equal(P.readiness(c,p,{provider:'treg'}).eligible,true,'explicit manual lookup does not need automatic supervision');
 assert.equal(P.readiness(c,p,{provider:'treg',automatic:true}).eligible,false);
 const reviewed=()=>c.publicResearch.aiReview={status:'complete',checkedAt:new Date().toISOString(),inputSignature:D.buyerReviewSignature(c),reviewedPersonIds:[p.id],conflicts:[],findings:[]};
 reviewed();assert.equal(P.readiness(c,p,{provider:'treg',automatic:true}).eligible,true);
 c.publicResearch.aiReview.reviewedPersonIds=[];assert.equal(P.readiness(c,p,{provider:'treg',automatic:true}).eligible,false);
 reviewed();c.people[0].roleReview={status:'unconfirmed',reason:'Changed role evidence'};assert.equal(P.readiness(c,p,{provider:'treg',automatic:true}).eligible,false);
});
test('resume retries stale individual receipts even when the aggregate check timestamp is fresh',async()=>{
 const c=await researched(),log=c.people[0].contactResearch.checks.gmail.queryLog,query=log[0].query;log[0].checkedAt='2020-01-01T00:00:00Z';const calls=[];
 await D.runMandatoryBuyerResearch(c,{search:async q=>{calls.push(q);return [];}});
 assert.deepEqual(calls,[query]);assert.equal(D.buyerResearchCoveragePassed(c),true);
});
test('company source checkpoints expose completed receipts and queued sources before a later read stalls',async()=>{
 const c={company:'Example',domain:'example.com'},checkpoints=[];
 await D.runOfficialContactResearch(c,{maxDurationMs:25,search:async()=>[],readPage:async url=>url==='https://example.com/'?{url,markdown:'Example official website. [Contacts](https://example.com/contact)'}:new Promise(()=>{}),onCheckpoint:({inventory})=>checkpoints.push(structuredClone(inventory))});
 assert.ok(checkpoints.some(v=>v.research.completedUrls.includes('https://example.com/')&&v.research.pendingUrls.includes('https://example.com/contact')));
 assert.ok(checkpoints.some(v=>v.research.queries.length===3));
 const controller=new AbortController();controller.abort();let calls=0;await D.runOfficialContactResearch({company:'Example',domain:'example.com'},{signal:controller.signal,search:async()=>[],readPage:async()=>{throw Error('not reached');},onCheckpoint:()=>calls++});assert.equal(calls,0);
});
test('the initial durable official-source queue is checkpointed before the first read can stall',async()=>{
 const c={company:'Example',domain:'example.com'},checkpoints=[];
 await D.runOfficialContactResearch(c,{seedUrls:['https://example.com/team'],maxDurationMs:15,search:async()=>[],readPage:()=>new Promise(()=>{}),onCheckpoint:({inventory})=>checkpoints.push(structuredClone(inventory))});
 assert.ok(checkpoints.some(v=>v.research.pendingUrls.includes('https://example.com/team')&&v.research.queries.length===0&&v.research.reads.length===0));
});
test('the exact bounded AI review evidence survives normalization and CRM and invalidates changed passages',async()=>{
 const c=await researched();c.publicResearch.reviewEvidence=[{url:'https://example.com/team',title:'Team',excerpt:'Anna Andersson Procurement Director at Example.'}];
 c.publicResearch.aiReview={status:'complete',checkedAt:new Date().toISOString(),inputSignature:D.buyerReviewSignature(c),reviewedPersonIds:['anna']};
 const restored=D.normalizeDiscoveryState({selectedProspects:[c]}).selectedProspects[0];assert.deepEqual(restored.publicResearch.reviewEvidence,c.publicResearch.reviewEvidence);assert.equal(D.buyerQualityAssessment(restored).aiReviewStatus,'complete');
 const snapshot=require('../crm-engine.js').mapDiscoveryCandidateToCrm(restored).intelligence.research_snapshot.buyerResearch;assert.deepEqual(snapshot.publicResearch.reviewEvidence,c.publicResearch.reviewEvidence);
 restored.publicResearch.reviewEvidence[0].excerpt='Anna Andersson formerly worked at Example.';assert.equal(D.buyerQualityAssessment(restored).aiReviewStatus,'stale');
});
test('retained contact data rejects contradictory profile ownership and changed role context',()=>{
 const p={id:'anna',name:'Anna Andersson',title:'Procurement Director',organization:'Example',publicLinkedinUrl:'https://linkedin.com/in/anna-andersson'},base={version:1,domain:'example.com',personId:'anna',identityName:p.name,identityTitle:p.title,identityOrganization:p.organization,profile:{status:'provider_reported',linkedinUrl:p.publicLinkedinUrl,company:'Example'}};
 assert.ok(D.safeContactData(base,p,'example.com'));
 for(const value of [{...base,profile:{...base.profile,linkedinUrl:'https://linkedin.com/in/other-person'}},{...base,profile:{...base.profile,company:'Other company'}},{...base,identityTitle:'CEO'},{...base,identityOrganization:'Other company'}])assert.equal(D.safeContactData(value,p,'example.com'),null);
});
test('aggregate research cannot report checked identities when their mandatory query plan could not be generated',async()=>{
 const c={company:'Example',domain:'example.com',people:[{id:'invalid',name:'Anna Buyer123',title:'Procurement Director',organization:'Example',publicNameUrl:'https://example.com/team'}]};
 await D.runMandatoryBuyerResearch(c,{search:async()=>[],readPage:async()=>({markdown:'Example company website'})});
 assert.equal(c.publicResearch.accountability.checkedPeople,0);assert.equal(c.publicResearch.accountability.status,'partial');assert.equal(c.people[0].emailResearch.status,'partial');
});
test('an incomplete company-source receipt set cannot be cached as complete for thirty days',async()=>{
 const c={company:'Example',domain:'example.com'},readPage=async url=>({url,markdown:'Example contact info@example.com'});
 await D.runOfficialContactResearch(c,{search:async()=>[],readPage});assert.equal(D.officialContactCoveragePassed(c),true);
 const missing=c.buyerDiscovery.officialContactInventory.research.queries.pop().query,calls=[];
 await D.runOfficialContactResearch(c,{search:async q=>{calls.push(q);return [];},readPage});
 assert.deepEqual(calls,[missing]);assert.equal(D.officialContactCoveragePassed(c),true);
});
test('manual paid readiness uses selected receipts with the full learned-colleague query context and partial roster',async()=>{
 const P=require('../additional-contact-policy.js'),c=await researched(),p=c.people[0];c.qualification={eligible:true,companyScore:85,researchedAt:new Date().toISOString()};
 c.people.push({id:'colleague',name:'Bo Svensson',publicName:'Bo Svensson',title:'Engineering Director',organization:'Example',publicNameUrl:'https://example.com/team',publicEmail:'bo@example.com',publicEmailUrl:'https://example.com/team'});
 require('./helpers/buyer-research-receipts.cjs')(c);delete c.people[1].contactResearch;c.people[1].emailResearch={status:'partial'};
 c.publicResearch.accountability.status='partial';c.publicResearch.accountability.totalPeople=2;c.publicResearch.accountability.checkedPeople=1;
 for(const provider of ['apollo','hunter','treg'])assert.equal(P.readiness(c,p,{provider}).eligible,true,provider+' manual selected-person scope');
 assert.equal(P.readiness(c,p,{provider:'apollo',automatic:true}).eligible,false);
});
test('one reviewed ID cannot claim AI coverage for two retained people or an unidentified record',async()=>{
 for(const duplicate of [true,false]){
  const c=await researched();if(duplicate)c.people.push({...structuredClone(c.people[0]),name:'Bo Svensson',publicName:'Bo Svensson'});else c.people[0].id='';
  c.publicResearch.aiReview={status:'complete',checkedAt:new Date().toISOString(),inputSignature:D.buyerReviewSignature(c),reviewedPersonIds:c.people.map(p=>p.id)};
  assert.equal(D.buyerQualityAssessment(c).aiReviewStatus,'partial');
  c.qualification={eligible:true,companyScore:85,researchedAt:new Date().toISOString()};assert.equal(require('../additional-contact-policy.js').readiness(c,c.people[0],{provider:'treg',automatic:true}).eligible,false);
 }
});
test('a current full-context signature authorizes the reviewed automatic Treg scope while aggregate supervision remains partial',async()=>{
 const P=require('../additional-contact-policy.js'),c=await researched(),selected=c.people[0];
 c.people.push({id:'bo',name:'Bo Svensson',title:'Engineering Director',organization:'Example',publicNameUrl:'https://example.com/team',emailResearch:{status:'partial'}});
 c.qualification={eligible:true,companyScore:85,researchedAt:new Date().toISOString()};Object.assign(c.publicResearch.accountability,{status:'partial',totalPeople:2,checkedPeople:1});
 const review={status:'complete',checkedAt:new Date().toISOString(),reviewedPersonIds:[selected.id],findings:[],conflicts:[]};
 c.publicResearch.aiReview={...review,inputSignature:D.buyerReviewSignature({...c,people:[selected]})};assert.equal(P.readiness(c,selected,{automatic:true,provider:'treg'}).eligible,false,'private roster signature cannot represent retained full context');
 c.publicResearch.aiReview={...review,inputSignature:D.buyerReviewSignature(c)};
 assert.equal(P.readiness(c,selected,{automatic:true,provider:'treg'}).eligible,true);
 const q=D.buyerQualityAssessment(c);assert.equal(q.aiReviewStatus,'partial');assert.equal(q.researchPassed,false);assert.equal(q.passed,false);assert.deepEqual(c.publicResearch.aiReview.reviewedPersonIds,[selected.id]);
 c.people[1].organization='Another employer';assert.equal(P.readiness(c,selected,{automatic:true,provider:'treg'}).eligible,false,'a later full-context change invalidates its saved binding');
});
