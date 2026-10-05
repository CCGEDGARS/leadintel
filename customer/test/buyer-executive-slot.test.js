const test=require('node:test'),assert=require('node:assert/strict'),D=require('../discovery-engine.js');
const company={company:'Example',domain:'example.com',market:'Sweden'},profile={decisionMakers:'Procurement Director; Project Director; Project Manager'};
const buyer=(id,title,extra={})=>({id,name:'Anna Buyer'+id,publicName:'Anna Buyer'+id,title,organization:'Example',publicNameUrl:'https://example.com/team/'+id,identityEvidenceDate:new Date().toISOString(),...extra});
test('reserves one qualified executive even below the ten highest scores; top four stay score sorted',()=>{
 const rows=[...Array.from({length:11},(_,i)=>buyer('p'+i,'Head of Procurement')),buyer('ceo','CEO',{identityEvidenceDate:'',publicNameUrl:'https://linkedin.com/in/anna-ceo'})];
 const result=D.rankedBuyerShortlist(rows,profile,company),top=D.topFourResearchCandidates(rows,profile,company);
 assert.equal(result.people.length,10);assert.ok(result.people.some(p=>p.id==='ceo'));assert.equal(top.length,4);assert.ok(top.some(p=>p.id==='ceo'));assert.equal(result.executiveCoverage.status,'complete');
 assert.deepEqual(top.map(p=>p.id),result.priorityIds);assert.ok(top.every((p,i)=>!i||top[i-1].buyerQualification.total>=p.buyerQualification.total));
});
test('missing, stale, held, assistant and wrong-employer executives never fill the slot',()=>{
 const regular=Array.from({length:5},(_,i)=>buyer('p'+i,'Head of Procurement'));
 for(const extra of [{identityEvidenceDate:'2010-01-01'},{organization:'Other'},{opportunityScope:{status:'review_required',reason:'Wrong division'}},{title:'Assistant to CEO'}]){
  const result=D.rankedBuyerShortlist([...regular,buyer('ceo','CEO',extra)],profile,company);
  assert.equal(result.executiveCoverage.status,'incomplete');assert.deepEqual(result.priorityIds,['p0','p1','p2','p3']);
 }
});
test('executive discovery is planned first, across industries, with official and local role evidence',()=>{
 for(const offer of ['Metal structures','Inventory software','Leadership training']){
  const plan=D.buyerResearchPlan({...company,buyerFit:{purchase:offer}},profile);
  assert.match(plan.queries[0],/site:example.com/);assert.match(plan.queries[0],/CEO|Chief Executive/);assert.ok(plan.roles.includes('Executive leadership'));
  assert.ok(D.localBuyerRoleAliases('Executive leadership','Sweden').includes('Verkställande direktör'));
  assert.equal(D.buildApolloPeopleSearchPayload(company,profile).person_titles.includes('CEO'),true);
 }
});
test('only one executive is reserved; other places remain available to higher scoring relevant buyers',()=>{
 const rows=[buyer('ceo','CEO',{identityEvidenceDate:''}),buyer('coo','COO',{identityEvidenceDate:''}),...Array.from({length:4},(_,i)=>buyer('p'+i,'Head of Procurement'))];
 const top=D.topFourResearchCandidates(rows,profile,company);assert.equal(top.filter(D.isExecutiveBuyer).length,1);assert.equal(top.filter(p=>p.title==='Head of Procurement').length,3);
 const renamed=rows.map(p=>({...p,name:'Different Name'+p.id,publicName:'Different Name'+p.id}));assert.deepEqual(D.topFourResearchCandidates(renamed,profile,company).map(p=>p.id),top.map(p=>p.id));
});

test('small company owners and professional-firm managing partners can fill the executive place',()=>{
 for(const title of ['Owner','Managing Partner']){const rows=[buyer('leader',title),buyer('p','Procurement Director')];const result=D.rankedBuyerShortlist(rows,profile,company);assert.equal(result.executiveCoverage.personId,'leader');}
 assert.equal(D.isExecutiveBuyer({title:'Product Owner'}),false);assert.equal(D.isExecutiveBuyer({title:'Executive Assistant'}),false);
});
