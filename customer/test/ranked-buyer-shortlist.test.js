const test=require('node:test'),assert=require('node:assert/strict'),D=require('../discovery-engine.js');
const profile={decisionMakers:'Project Director; Project Manager; CAPEX Manager; Investment Project Manager; Procurement Director; Procurement Manager; Strategic Sourcing Manager; Purchasing Manager; Engineering Director; Engineering Manager; Technical Manager; Operations Director'};
const buyer=(id,title='Project Manager',extra={})=>({id,name:`Anna Buyer${id}`,title,organization:'Example',publicNameUrl:`https://example.com/team/${id}`,emailResearch:{status:'complete',searches:3,failed:0,checkedAt:new Date().toISOString()},...extra});
test('ten qualified buyers contain the four highest-score recommendations',()=>{
 const pool=Array.from({length:15},(_,i)=>buyer(String(i)));
 pool.push(buyer('buying','Procurement Director'),buyer('technical','Technical Manager'),buyer('ops','Operations Director'));
 const result=D.rankedBuyerShortlist(pool,profile,{company:'Example'});
 assert.equal(result.people.length,10);assert.equal(result.recommendedIds.length,4);
 assert.ok(result.recommendedIds.every(id=>result.people.some(p=>p.id===id)));
 assert.deepEqual(new Set(result.people.slice(0,4).map(p=>p.id)),new Set(['buying','ops','0','1']));
});
test('research selection includes all ten candidates while recommendations stay limited to four',()=>{
 const people=Array.from({length:10},(_,i)=>buyer(String(i)));
 people[9].roleReview={status:'unconfirmed',reason:'Role requires source review'};
 const selected=D.buyerResearchCandidates(people,profile,{company:'Example'});
 assert.equal(selected.length,10);assert.equal(new Set(selected.map(p=>p.id)).size,10);
 assert.ok(selected.some(p=>p.id==='9'));assert.equal(D.rankedBuyerShortlist(selected,profile,{company:'Example'}).recommendedIds.length,4);
 assert.equal(D.buyerResearchCandidates([...people,...people],profile,{company:'Example'}).length,10);
});
test('contradiction review for every retained person survives save and reload',()=>{
 const people=Array.from({length:10},(_,i)=>buyer(String(i)));
 const conflicts=people.map(p=>({person_id:p.id,reason:'Current role contradicted'}));
 const saved=D.normalizeDiscoveryState({selectedProspects:[{company:'Example',domain:'example.com',buyerSearchMode:'user_selected_target',people,publicResearch:{conflicts}}]}).selectedProspects[0];
 assert.equal(saved.publicResearch.conflicts.length,10);assert.ok(saved.publicResearch.conflicts.some(p=>p.person_id==='9'));
});
test('an incomplete high-score candidate cannot displace the fourth researched recommendation',()=>{
 const people=Array.from({length:10},(_,i)=>buyer(String(i),'Procurement Director'));
 people[0].emailResearch={status:'partial',searches:8,failed:1,checkedAt:new Date().toISOString()};
 const result=D.rankedBuyerShortlist(people,{decisionMakers:'Procurement Director'},{company:'Example'});
 assert.deepEqual(result.recommendedIds,['1','2','3','4']);assert.equal(result.people.length,10);
 assert.ok(result.people.some(p=>p.id==='0'&&p.emailResearch.status==='partial'));
});
test('research readiness does not bypass executive source support or exceed two leadership places',()=>{
 const people=[buyer('ceo','CEO'),buyer('coo','COO'),buyer('owner','Owner'),buyer('purchasing','Procurement Director')];
 let result=D.rankedBuyerShortlist(people,{decisionMakers:'Procurement Director'},{company:'Example',domain:'example.com'});
 assert.equal(result.priorityIds.filter(id=>['ceo','coo','owner'].includes(id)).length,2);
 const unsupported=buyer('outside','CEO',{publicNameUrl:'https://news.example/old-profile'});
 result=D.rankedBuyerShortlist([unsupported,buyer('p1','Procurement Director')],{decisionMakers:'Procurement Director'},{company:'Example',domain:'example.com'});
 assert.ok(!result.priorityIds.includes('outside'));
});
test('unresolved, wrong employer, former, unsourced and irrelevant pinned buyers cannot fill the ten',()=>{
 const pool=[buyer('good'),buyer('pending','Project Manager',{identityStatus:'pending'}),buyer('one','Project Manager',{name:'Anna'}),buyer('wrong','Project Manager',{organization:'Other'}),buyer('former','Former Project Manager'),buyer('unsourced','Project Manager',{publicNameUrl:''}),buyer('creative','Content Production Manager',{kept:true})];
 const result=D.rankedBuyerShortlist(pool,profile,{company:'Example'});
 assert.deepEqual(result.people.map(p=>p.id),['good']);assert.deepEqual(result.recommendedIds,['good']);
});
test('ten identities, ranking and contact-search failure states survive save and reload',()=>{
 const people=Array.from({length:10},(_,i)=>buyer(String(i),'Project Manager',{emailResearch:{status:'partial',searches:3,failed:1,checkedAt:'2026-10-04T12:00:00Z'}}));
 const ranked=D.rankedBuyerShortlist(people,profile,{company:'Example'}).people;
 const reload=D.normalizeDiscoveryState(JSON.parse(JSON.stringify({selectedProspects:[{company:'Example',domain:'example.com',buyerSearchMode:'user_selected_target',people:ranked,buyerDiscovery:{pool:people,researchIncomplete:true}}]}))).selectedProspects[0];
 assert.equal(reload.people.length,10);assert.ok(reload.people.every(p=>p.identityStatus==='confirmed'&&p.emailResearch.status==='partial'&&p.matchedBuyerRole));
 assert.equal(reload.buyerDiscovery.researchIncomplete,true);
});
test('shortlist qualification follows legal and retail roles without customer-specific defaults',()=>{
 for(const [company,role] of [['Law Firm','General Counsel'],['Furniture Shop','Retail Director']]){
  const result=D.rankedBuyerShortlist([buyer('fit',role,{organization:company}),buyer('wrong-role','Project Manager',{organization:company})],{decisionMakers:role},{company});
  assert.deepEqual(result.people.map(p=>p.id),['fit']);
 }
});
test('surname initials never qualify as full identities or supply contact-name patterns',()=>{
 const partial=buyer('initial','Project Manager',{name:'Åsa G.'});
 assert.equal(D.hasFullBuyerName(partial.name),false);assert.equal(D.hasFullBuyerName('Anna M. Lind'),true);
 assert.equal(D.rankedBuyerShortlist([partial],profile,{company:'Example'}).people.length,0);
 assert.equal(D.normalizeApolloPeople({people:[partial]})[0].identityStatus,'pending');
});
test('job headings and position labels never become buyer identities',()=>{
 const names=['Warehouse Associate','Key Responsibilities','JOB DESCRIPTION','Product Owner'];
 for(const name of names){const person=buyer(name,'Production Manager',{name});assert.equal(D.hasFullBuyerName(name),false);assert.equal(D.rankedBuyerShortlist([person],{decisionMakers:'Production Manager'},{company:'Example'}).people.length,0);}
 for(const name of ['John Job','Anna Key','Tony Ten Eyck','Ann-Sofie Zaks'])assert.equal(D.hasFullBuyerName(name),true);
});
test('local titles preserve manager/director distinctions and prefer specific technical roles',()=>{
 const people=D.selectDecisionMakers([buyer('manager','Projektledare'),buyer('director','Projektchef'),buyer('technical','Teknisk projektledare'),buyer('sourcing','Strategisk inköpare')],profile,10);
 assert.equal(people.find(p=>p.id==='manager').matchedBuyerRole,'Project Manager');
 assert.equal(people.find(p=>p.id==='director').matchedBuyerRole,'Project Director');
 assert.equal(people.find(p=>p.id==='technical').matchedBuyerRole,'Engineering Manager');
 assert.equal(people.find(p=>p.id==='sourcing').matchedBuyerRole,'Strategic Sourcing Manager');
});
