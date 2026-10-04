const test=require('node:test'),assert=require('node:assert/strict'),D=require('../discovery-engine.js');
const profile={decisionMakers:'Project Director; Project Manager; Strategic Sourcing Manager; Engineering Director; Engineering Manager; Operations Director'};
const company={company:'Example',domain:'example.com',market:'Sweden'};
const buyer=(extra={})=>({id:'a',name:'Anna Lind',title:'Projektchef',organization:'Example',publicNameUrl:'https://example.com/team/anna',...extra});
test('buyer qualification has transparent bounded components; an email cannot make a wrong identity qualify',()=>{
 const q=D.qualifyBuyer(buyer(),profile,company,{now:'2026-10-04'});
 assert.equal(q.eligible,true);assert.equal(q.total,Object.values(q.breakdown).reduce((sum,row)=>sum+row.points,0));assert.ok(q.total<100);assert.ok(q.gaps.includes('Identity source date unknown'));
 const bad=D.qualifyBuyer(buyer({organization:'Other',email_status:'verified',work_email:'anna@example.com'}),profile,company);
 assert.equal(bad.eligible,false);assert.equal(bad.total,null);
 assert.equal(D.qualifyBuyer(buyer({name:'Anna L.'}),profile,company).eligible,false);
});
test('qualification uses dated identity evidence, marks title authority as inferred and preserves scores after reload',()=>{
 const dated=buyer({identityEvidenceDate:'2026-09-01'}),old=buyer({identityEvidenceDate:'2020-01-01'});
 assert.ok(D.qualifyBuyer(dated,profile,company,{now:'2026-10-04'}).total>D.qualifyBuyer(old,profile,company,{now:'2026-10-04'}).total);
 const ranked=D.rankedBuyerShortlist([dated],profile,company).people;
 assert.match(ranked[0].buyerQualification.breakdown.authority.basis,/inferred.*title/i);
 const saved=D.normalizeDiscoveryState({selectedProspects:[{...company,buyerSearchMode:'user_selected_target',people:ranked}]}).selectedProspects[0].people[0];
 assert.deepEqual(saved.buyerQualification,ranked[0].buyerQualification);assert.equal(saved.identityEvidenceDate,dated.identityEvidenceDate);
});
test('adaptive coverage targets missing functions with diverse sources and does not equate many project buyers with complete coverage',()=>{
 const plan=D.buyerCoveragePlan(Array.from({length:10},(_,i)=>buyer({id:String(i)})),profile,company);
 assert.deepEqual(plan.missing,['Procurement / sourcing','Engineering','Operations']);
 assert.ok(plan.queries.some(q=>q.includes('site:example.com')&&q.includes('Teknisk chef')));
 assert.ok(plan.queries.some(q=>q.includes('linkedin.com/in/')));assert.ok(plan.queries.length<=8);
 const complete=D.buyerCoveragePlan([buyer(),buyer({title:'Strategisk inköpare'}),buyer({title:'Teknisk chef'}),buyer({title:'Driftchef'})],profile,company);
 assert.deepEqual(complete.missing,[]);assert.deepEqual(complete.queries,[]);
});
test('pending identities are not duplicated into the full-name pool or lost when saving a buyer in a twenty-person pool',()=>{
 const pool=Array.from({length:20},(_,i)=>buyer({id:String(i),name:`Anna Buyer${i}`}));
 const pending=buyer({id:'pending',name:'Åsa G.',identityStatus:'pending'});
 const merged=D.mergeBuyerPool(pool,[pending],profile);
 assert.equal(merged.length,21);assert.equal(merged.filter(p=>p.id==='pending').length,1);assert.equal(merged.filter(p=>p.identityStatus==='pending').length,1);
});
test('qualification remains portable across legal and retail workspaces and never scores unsupported employment',()=>{
 for(const [name,role] of [['Law Company','General Counsel'],['Furniture Company','Retail Director']]){
  const p={decisionMakers:role},c={company:name,domain:'other.example'};
  assert.equal(D.qualifyBuyer(buyer({title:role,organization:name,publicNameUrl:'https://other.example/team'}),p,c).eligible,true);
  assert.equal(D.qualifyBuyer(buyer(),p,c).eligible,false);
 }
});
test('contact verification outcomes and buyer evidence scores persist in durable CRM intelligence',()=>{
 const C=require('../crm-engine.js');
 const person=buyer({contactVerification:{status:'not_verified',checkedAt:'2026-10-04T12:00:00Z',issues:['Provider did not confirm an attributable company email']}});
 person.buyerQualification=D.qualifyBuyer(person,profile,company);
 const candidate={...company,people:[person],buyerDiscovery:{coverageFollowUp:{status:'complete',queries:3,results:12}}};
 const stored=D.normalizeDiscoveryState({selectedProspects:[{...candidate,buyerSearchMode:'user_selected_target'}]}).selectedProspects[0];
 assert.deepEqual(stored.people[0].contactVerification,person.contactVerification);
 const snapshot=C.mapDiscoveryCandidateToCrm(stored).intelligence.research_snapshot.buyerResearch;
 assert.deepEqual(snapshot.buyers[0].qualification,person.buyerQualification);assert.equal(snapshot.buyers[0].contactVerification.status,'not_verified');assert.equal(snapshot.coverageFollowUp.queries,3);
});
test('accepted external identity evidence survives repeated reloads; unsupported sources are rejected',()=>{
 const source='https://supplier.example/news/customer-project',person={id:'public-anna',name:'Anna Andersson',publicName:'Anna Andersson',publicNameUrl:source,title:'Project Manager',organization:'Example',identityEvidenceDate:'2026-10-01'};
 const candidate={company:'Example',domain:'example.com',people:[person],buyerDiscovery:{opportunityRoles:['Project Manager'],pool:[person],resultDiagnostics:[{parsedName:person.name,parsedCompany:'Example',parsedTitle:person.title,url:source,accepted:true,companyVerification:'complete',roleMatching:'complete'}]}};
 let state=D.normalizeDiscoveryState({pipeline:[candidate]});state=D.normalizeDiscoveryState(state);
 assert.equal(state.pipeline[0].people[0].publicNameUrl,source);assert.equal(D.qualifyBuyer(state.pipeline[0].people[0],{decisionMakers:'Project Manager'},candidate).eligible,true);
 const legacy={...candidate,people:[{...person,publicName:'',publicNameUrl:''}]};assert.equal(D.normalizeDiscoveryState({pipeline:[legacy]}).pipeline[0].people[0].publicNameUrl,source);
 const unsupported={...candidate,buyerDiscovery:{pool:[person],resultDiagnostics:[]}};assert.equal(D.normalizeDiscoveryState({pipeline:[unsupported]}).pipeline[0].people[0].publicNameUrl,'');
});
test('a populated project pool cannot crowd out engineering, operations or pending identities',()=>{
 const projects=Array.from({length:52},(_,i)=>buyer({id:'p'+i,name:'Project Buyer '+String.fromCharCode(65+i)+'sson',title:'Project Director'}));
 const extra=[buyer({id:'eng',name:'Anna Engineer',title:'Engineering Manager'}),buyer({id:'ops',name:'Anna Operations',title:'Operations Director'})];
 const pending=Array.from({length:4},(_,i)=>({id:'pending'+i,name:'Anna',firstName:'Anna',title:'Project Manager',organization:'Example',identityStatus:'pending'}));
 const pool=D.mergeBuyerPool([], [...projects,...extra,...pending],profile);
 assert.ok(pool.some(p=>p.id==='eng'));assert.ok(pool.some(p=>p.id==='ops'));assert.equal(pool.filter(p=>p.identityStatus==='pending').length,4);
 const shortlist=D.rankedBuyerShortlist(pool,profile,company);assert.ok(shortlist.people.some(p=>p.id==='eng'));assert.ok(shortlist.people.some(p=>p.id==='ops'));
});
test('dated high-qualification evidence survives the pool cap ahead of undated project titles',()=>{
 const projects=Array.from({length:52},(_,i)=>buyer({id:'p'+i,name:'Project Buyer '+String.fromCharCode(65+i)+'sson',title:'Project Director',publicNameUrl:'https://linkedin.com/in/director'+i}));
 const fresh=buyer({id:'fresh',name:'Anna Project',title:'Project Manager',identityEvidenceDate:new Date().toISOString()});
 const pool=D.mergeBuyerPool([], [...projects,fresh],profile);
 assert.ok(pool.some(p=>p.id==='fresh'));assert.ok(D.rankedBuyerShortlist(pool,profile,company).people.some(p=>p.id==='fresh'));
});

test('equivalent procurement leadership titles outrank managers on comparable evidence across workspaces',()=>{
 for(const organization of ['Industrial Seller Target','Legal Customer','Furniture Buyer']){
  const c={company:organization,domain:'example.com'},p={decisionMakers:'Project Manager; Procurement Director; Engineering Director'};
  const rows=['Project Manager','Head of Procurement','Procurement Director','Head of Engineering'].map((title,i)=>buyer({id:String(i),name:'Anna Buyer '+String.fromCharCode(65+i)+'sson',title,organization,identityEvidenceDate:'2026-10-01'}));
  const scores=rows.map(row=>D.qualifyBuyer(row,p,c,{now:'2026-10-04'}));
  assert.equal(scores[1].breakdown.role.points,25);assert.equal(scores[1].total,scores[2].total);assert.ok(scores[1].total>scores[0].total);assert.ok(scores[3].total>scores[0].total);
  assert.match(scores[1].breakdown.authority.basis,/inferred.*unconfirmed/);assert.ok(scores[1].gaps.includes('Actual purchasing authority unconfirmed'));
  assert.equal(D.rankedBuyerShortlist(rows,p,c).people[0].title,'Head of Procurement');
  const deputy=D.qualifyBuyer({...rows[1],title:'Deputy Head of Procurement'},p,c,{now:'2026-10-04'});assert.ok(deputy.total<scores[1].total);
  assert.equal(D.qualifyBuyer({...rows[1],organization:'Other'},p,c).total,null);
 }
});
test('authority-weighted scores preserve their model version and component limits through reload and CRM',()=>{
 const C=require('../crm-engine.js'),p={decisionMakers:'Procurement Director'},person=buyer({title:'Head of Procurement'});person.buyerQualification=D.qualifyBuyer(person,p,company);
 const saved=D.normalizeDiscoveryState({selectedProspects:[{...company,buyerSearchMode:'user_selected_target',people:[person]}]}).selectedProspects[0];
 assert.deepEqual(saved.people[0].buyerQualification,person.buyerQualification);assert.equal(saved.people[0].buyerQualification.version,2);
 assert.equal(saved.people[0].buyerQualification.breakdown.authority.max,25);assert.equal(C.mapDiscoveryCandidateToCrm(saved).intelligence.research_snapshot.buyerResearch.buyers[0].qualification.version,2);
});
test('foreign-country and subsidiary buyers remain reviewable but cannot enter the highlighted opportunity shortlist',()=>{
 const candidate={company:'Example',domain:'example.com',market:'Sweden'},profile={decisionMakers:'Engineering Manager; Operations Director'};
 const foreign={id:'uk',name:'Anna Buyer',title:'UK Engineering Manager',organization:'Example',publicLinkedinUrl:'https://linkedin.com/in/anna'};
 const subsidiary=D.matchBuyerScopeEvidence({id:'sub',name:'Bob Buyer',title:'Operations Director',organization:'Example',publicLinkedinUrl:'https://linkedin.com/in/bob'},[{url:'https://linkedin.com/in/bob',title:'Bob Buyer - Example Minerals | LinkedIn'}],candidate);
 assert.equal(D.qualifyBuyer(foreign,profile,candidate).eligible,false);assert.equal(D.qualifyBuyer(subsidiary,profile,candidate).eligible,false);
 assert.equal(D.rankedBuyerShortlist([foreign,subsidiary],profile,candidate).recommendedIds.length,0);
 const reloaded=D.normalizeDiscoveryState({selectedProspects:[{...candidate,buyerSearchMode:'user_selected_target',people:[subsidiary]}]}).selectedProspects[0].people[0];
 assert.equal(reloaded.opportunityScope.status,'review_required');
 const unrelated=D.matchBuyerScopeEvidence(foreign,[{url:'https://linkedin.com/in/other',title:'Anna Buyer - Example Minerals | LinkedIn'}],candidate);assert.equal(unrelated.opportunityScope,undefined);
});
