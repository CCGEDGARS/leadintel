const test=require('node:test'),assert=require('node:assert/strict'),D=require('../discovery-engine.js'),C=require('../crm-engine.js');
const profile={decisionMakers:'Procurement Director; Project Director; Project Manager; Engineering Manager; Operations Director'};
const now=new Date().toISOString(),company={company:'Example',domain:'example.com',market:'Sweden'};
const buyer=(id,title,extra={})=>({id,name:`Anna Buyer${id}`,title,organization:'Example',publicNameUrl:`https://example.com/team/${id}`,emailResearch:{status:'complete',searches:3,failed:0,checkedAt:now},...extra});
test('department purchasing leadership outranks equivalent project delivery leadership without claiming budget authority',()=>{
 for(const organization of ['Example','Retail Group','Legal Services']){
  const q=p=>D.qualifyBuyer({...p,organization},profile,{...company,company:organization});
  const purchasing=q(buyer('p','Head of Procurement')),project=q(buyer('d','Projektchef')),manager=q(buyer('m','Projektledare'));
  assert.ok(purchasing.total>project.total&&project.total>manager.total);
  assert.equal(purchasing.decisionRole,'Purchasing / supplier selection');assert.equal(project.decisionRole,'Project leadership / delivery');
  assert.ok(purchasing.gaps.includes('Actual purchasing authority unconfirmed'));
 }
});
test('unresearched, failed, stale and future-dated buyers remain visible without recommendation',()=>{
 const rows=[buyer('done','Project Director'),buyer('none','Procurement Director',{emailResearch:null}),buyer('partial','Operations Director',{emailResearch:{status:'partial',searches:3,failed:1,checkedAt:now}}),buyer('old','Engineering Manager',{identityEvidenceDate:'2013-01-01'}),buyer('future','Procurement Director',{identityEvidenceDate:'2099-01-01'}),buyer('fake','Procurement Director',{emailResearch:{status:'complete',searches:0,checkedAt:now}})];
 const result=D.rankedBuyerShortlist(rows,profile,company);
 assert.equal(result.people.length,6);assert.deepEqual(result.recommendedIds,['done']);
 assert.equal(D.buyerResearchAssessment(rows[1]).status,'not_researched');assert.equal(D.buyerResearchAssessment(rows[2]).status,'incomplete');assert.equal(D.buyerResearchAssessment(rows[3]).status,'review_required');
});
test('researched function coverage survives a larger unresearched project pool',()=>{
 const projects=Array.from({length:15},(_,i)=>buyer(String(i),'Project Director',{emailResearch:null}));
 const head=buyer('head','Head of Procurement'),eng=buyer('eng','Engineering Manager');
 const result=D.rankedBuyerShortlist([...projects,head,eng],profile,company);
 assert.equal(result.people.length,10);assert.deepEqual(result.recommendedIds,['head','eng']);
});
test('decision role, score version and research evidence survive normalization and CRM snapshot',()=>{
 const person=buyer('head','Head of Procurement');person.buyerQualification=D.qualifyBuyer(person,profile,company);
 const restored=D.normalizeDiscoveryState({selectedProspects:[{...company,buyerSearchMode:'user_selected_target',people:[person]}]}).selectedProspects[0];
 assert.equal(restored.people[0].buyerQualification.version,3);assert.equal(restored.people[0].buyerQualification.decisionRole,person.buyerQualification.decisionRole);
 const saved=C.mapDiscoveryCandidateToCrm(restored).intelligence.research_snapshot.buyerResearch.buyers[0];
 assert.equal(saved.qualification.version,3);assert.equal(saved.emailResearch.searches,3);
});
