const test=require('node:test'),assert=require('node:assert/strict'),D=require('../discovery-engine.js');
const profile={decisionMakers:'Project Director; Project Manager; CAPEX Manager; Investment Project Manager; Procurement Director; Procurement Manager; Strategic Sourcing Manager; Purchasing Manager; Engineering Director; Engineering Manager; Technical Manager; Operations Director'};
const buyer=(id,title='Project Manager',extra={})=>({id,name:`Anna Buyer${id}`,title,organization:'Example',publicNameUrl:`https://example.com/team/${id}`,...extra});
test('ten qualified buyers contain four highlighted recommendations and cover all twelve committee roles',()=>{
 const pool=Array.from({length:15},(_,i)=>buyer(String(i)));
 pool.push(buyer('buying','Procurement Director'),buyer('technical','Technical Manager'),buyer('ops','Operations Director'));
 const result=D.rankedBuyerShortlist(pool,profile,{company:'Example'});
 assert.equal(result.people.length,10);assert.equal(result.recommendedIds.length,4);
 assert.ok(result.recommendedIds.every(id=>result.people.some(p=>p.id===id)));
 assert.deepEqual(new Set(result.people.slice(0,4).map(p=>p.id)),new Set(['0','buying','technical','ops']));
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
test('local titles preserve manager/director distinctions and prefer specific technical roles',()=>{
 const people=D.selectDecisionMakers([buyer('manager','Projektledare'),buyer('director','Projektchef'),buyer('technical','Teknisk projektledare'),buyer('sourcing','Strategisk inköpare')],profile,10);
 assert.equal(people.find(p=>p.id==='manager').matchedBuyerRole,'Project Manager');
 assert.equal(people.find(p=>p.id==='director').matchedBuyerRole,'Project Director');
 assert.equal(people.find(p=>p.id==='technical').matchedBuyerRole,'Engineering Manager');
 assert.equal(people.find(p=>p.id==='sourcing').matchedBuyerRole,'Strategic Sourcing Manager');
});
