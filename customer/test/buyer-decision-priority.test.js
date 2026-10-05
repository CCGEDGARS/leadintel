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
 assert.equal(result.people.length,4);assert.deepEqual(result.recommendedIds,['done']);
 assert.equal(D.buyerResearchAssessment(rows[1]).status,'not_researched');assert.equal(D.buyerResearchAssessment(rows[2]).status,'incomplete');assert.equal(D.buyerResearchAssessment(rows[3]).status,'review_required');
});
test('the ten highest priority buyers retain their score order without reserving lower-ranked functions',()=>{
 const projects=Array.from({length:15},(_,i)=>buyer(String(i),'Project Director',{emailResearch:null}));
 const head=buyer('head','Head of Procurement'),eng=buyer('eng','Engineering Manager');
 const result=D.rankedBuyerShortlist([...projects,head,eng],profile,company);
 assert.equal(result.people.length,10);assert.deepEqual(result.recommendedIds,['head']);assert.ok(!result.people.some(p=>p.id==='eng'));
});
test('decision role, score version and research evidence survive normalization and CRM snapshot',()=>{
 const person=buyer('head','Head of Procurement');person.buyerQualification=D.qualifyBuyer(person,profile,company);
 const restored=D.normalizeDiscoveryState({selectedProspects:[{...company,buyerSearchMode:'user_selected_target',people:[person]}]}).selectedProspects[0];
 assert.equal(restored.people[0].buyerQualification.version,4);assert.equal(restored.people[0].buyerQualification.decisionRole,person.buyerQualification.decisionRole);
 const saved=C.mapDiscoveryCandidateToCrm(restored).intelligence.research_snapshot.buyerResearch.buyers[0];
 assert.equal(saved.qualification.version,4);assert.equal(saved.emailResearch.searches,3);
});
test('functional chief officers receive full role fit and purchasing responsibility outweighs a source-quality gap',()=>{
 for(const [functionName,decisionRole] of [['Procurement','Procurement Director'],['Engineering','Engineering Director'],['Marketing','Marketing Director']]){
  const q=D.qualifyBuyer(buyer('chief',`Chief ${functionName} Officer`),{decisionMakers:decisionRole},company);
  assert.equal(q.breakdown.role.points,20);
 }
 const chief=buyer('chief','Chief Procurement Officer',{publicNameUrl:'https://linkedin.com/in/chief'}),project=buyer('project','Projektchef');
 assert.ok(D.qualifyBuyer(chief,profile,company).total>D.qualifyBuyer(project,profile,company).total);
});
test('contact-only pages retain the role identity source, while dated role evidence controls freshness',()=>{
 const person=buyer('project','Project Director',{publicName:'Anna Buyerproject',publicNameUrl:'https://linkedin.com/in/anna',identityEvidenceDate:'2026-09-01'});
 const contact={url:'https://example.com/contact',markdown:'Anna Buyerproject anna.buyerproject@example.com'};
 const retained=D.matchPublicBuyerDetails([person],[contact],company.domain)[0];
 assert.equal(retained.publicEmailUrl,contact.url);assert.equal(retained.publicNameUrl,person.publicNameUrl);assert.equal(retained.identityEvidenceDate,person.identityEvidenceDate);
 const dated={url:'https://example.com/old-project',metadata:{publishedTime:'2013-05-01'},markdown:'Anna Buyerproject, Project Director, anna.buyerproject@example.com'};
 const old=D.matchPublicBuyerDetails([person],[dated],company.domain)[0];assert.equal(old.identityEvidenceDate,'2013-05-01');assert.equal(D.buyerResearchAssessment(old).status,'review_required');
});

test('recommendations remain ordered by score after reserving buying-function coverage',()=>{
 const result=D.rankedBuyerShortlist([buyer('chief','Chief Procurement Officer'),buyer('head','Head of Procurement'),buyer('project','Project Director'),buyer('manager','Project Manager')],profile,company);
 assert.equal(result.recommendedIds.length,4);assert.ok(result.people.slice(0,4).every((p,i,rows)=>!i||rows[i-1].buyerQualification.total>=p.buyerQualification.total));
});
test('known stale and future identity evidence cannot qualify even when a company email is verified',()=>{
 for(const identityEvidenceDate of ['2013-05-01','2099-01-01'])assert.equal(D.qualifyBuyer(buyer('old','Project Director',{identityEvidenceDate,email_status:'verified',work_email:'old@example.com'}),profile,company).eligible,false);
});

test('default research reserves relevant functional coverage, independent of easy contact data and customer names',()=>{
 for(const [companyName,role] of [['Factory Example','Procurement Director'],['Retail Example','Marketing Director'],['Legal Example','Finance Director']]){
  const context={company:companyName,domain:'example.com'},profile={decisionMakers:role+'; Project Director; Project Manager'};
  const rows=Array.from({length:10},(_,i)=>buyer(String(i),i<5?'Project Manager':role,{organization:companyName,emailResearch:null}));
  rows[0].work_email='easy@example.com';rows[0].email_status='verified';
  const chosen=D.topFourResearchCandidates(rows,profile,context);
  assert.equal(chosen.length,4);assert.ok(chosen.some(p=>p.title===role));if(role==='Procurement Director')assert.ok(chosen.some(p=>p.title==='Project Manager'));assert.ok(chosen.every((p,i)=>!i||chosen[i-1].buyerQualification.total>=p.buyerQualification.total));
  const renamed=rows.map(p=>({...p,name:'Different Person'+p.id,publicName:'Different Person'+p.id}));
  assert.deepEqual(D.topFourResearchCandidates(renamed,profile,context).map(p=>p.id),chosen.map(p=>p.id));
 }
});
test('four recommendations protect an operational buyer even below purchasing scores',()=>{
 const rows=[...Array.from({length:4},(_,i)=>buyer('head'+i,'Head of Procurement')),buyer('manager','Engineering Manager')];
 assert.deepEqual(D.rankedBuyerShortlist(rows,profile,company).recommendedIds,['head0','head1','head2','manager']);
});
test('partial contact refresh keeps the four highest-priority identities visible ahead of completed weaker buyers',()=>{
 const leaders=[buyer('chief','Chief Procurement Officer'),buyer('head','Head of Procurement'),buyer('director','Project Director'),buyer('manager','Project Manager')];
 const rows=[...leaders,buyer('easy1','Project Manager'),buyer('easy2','Project Manager')];
 for(const person of leaders.slice(0,3))person.emailResearch={status:'partial',searches:4,failed:1,checkedAt:now};
 const result=D.rankedBuyerShortlist(rows,profile,company);
 assert.deepEqual(result.people.slice(0,4).map(p=>p.id),leaders.map(p=>p.id));
 assert.deepEqual(result.priorityIds,leaders.map(p=>p.id));
 assert.deepEqual(result.recommendedIds,['manager']);
});
test('Gmail guesses persist as candidates, without becoming public contact evidence',()=>{
 const p=buyer('anna','Head of Procurement',{name:'Anna Smith',publicName:'Anna Smith',gmailCandidates:D.gmailGuessCandidates({name:'Anna Smith'})});
 assert.equal(p.gmailCandidates.length,3);assert.ok(p.gmailCandidates.every(row=>row.status==='guessed'));
 const saved=D.normalizeDiscoveryState({selectedProspects:[{...company,buyerSearchMode:'user_selected_target',people:[p]}]}).selectedProspects[0];
 assert.equal(saved.people[0].gmailCandidates.length,3);assert.equal(saved.people[0].patternFindings.length,0);assert.equal(saved.people[0].publicEmail,'');
 const snapshot=C.mapDiscoveryCandidateToCrm(saved).intelligence.research_snapshot.buyerResearch.buyers[0];assert.equal(snapshot.gmailCandidates.length,3);
});

test('v4 distinguishes seniority and purchasing remit without inventing budget authority',()=>{
 const rows=['CEO','Senior Vice President, Business Area','Head of Procurement','Project Director','Senior Project Manager','Project Manager'].map((title,i)=>buyer(String(i),title));
 const scores=rows.map(person=>D.qualifyBuyer(person,profile,company));
 assert.equal(new Set(scores.map(q=>q.breakdown.authority.points)).size,6);
 assert.ok(scores[2].total>scores[0].total&&scores[0].total>scores[1].total);
 assert.ok(scores[3].total>scores[4].total&&scores[4].total>scores[5].total);
 assert.ok(scores.every(q=>q.gaps.includes('Actual purchasing authority unconfirmed')));
 assert.equal(D.isExecutiveBuyer({title:'Head of Strategy Logistics, CEO Staff'}),false);
});
test('dated official responsibility for the named opportunity changes ranking and survives reload and CRM',()=>{
 for(const [organization,purchase] of [['Industrial Customer','sorting plant expansion'],['Retail Customer','store renovation'],['Legal Customer','document automation']]){
  const candidate={...company,company:organization,buyerFit:{purchase}},person=buyer('lead','Senior Project Manager',{organization,name:'Anna Smith'});
  const row={url:'https://example.com/news/opportunity',metadata:{publishedTime:now},content:`Anna Smith leads the ${purchase} and is responsible for supplier selection`};
  const linked=D.matchBuyerDecisionEvidence(person,[row],candidate),q=D.qualifyBuyer(linked,profile,candidate);
  assert.equal(q.breakdown.opportunity.points,15);assert.ok(q.total>D.qualifyBuyer(person,profile,candidate).total);
  assert.equal(q.gaps.includes('Responsibility for the specific opportunity and location unconfirmed'),false);
  linked.buyerQualification=q;
  const saved=D.normalizeDiscoveryState({selectedProspects:[{...candidate,buyerSearchMode:'user_selected_target',people:[linked]}]}).selectedProspects[0];
  assert.deepEqual(saved.people[0].decisionEvidence,linked.decisionEvidence);
  assert.equal(D.qualifyBuyer(saved.people[0],profile,saved).breakdown.opportunity.points,15);
  assert.equal(C.mapDiscoveryCandidateToCrm(saved).intelligence.research_snapshot.buyerResearch.buyers[0].decisionEvidence[0].url,row.url);
 }
});
test('unattributed, unrelated, stale, future, generated and third-party signals give no personal priority bonus',()=>{
 const candidate={...company,buyerFit:{purchase:'store renovation'}},person=buyer('lead','Project Manager',{name:'Anna Smith'});
 for(const row of [
  {content:'The company plans a store renovation led by Other Buyer'},
  {content:'Anna Smith is responsible for payroll'},
  {content:'Anna Smith works here. Other Buyer leads the store renovation'},
  {content:'Anna Smith is no longer responsible for the store renovation'},
  {content:'Anna Smith leads the store renovation',date:'2013-01-01'},
  {content:'Anna Smith leads the store renovation',date:'2099-01-01'},
  {content:'Anna Smith leads the store renovation',url:'https://unrelated.com/project'},
  {content:'Anna Smith leads the store renovation',evidenceKind:'model_summary'},
  {content:'Anna Smithsonian leads the store renovation'}
 ]){
  const enriched=D.matchBuyerDecisionEvidence(person,[{url:'https://example.com/project',date:now,...row}],candidate);
  assert.equal(D.qualifyBuyer(enriched,profile,candidate).breakdown.opportunity.points,0,JSON.stringify(row));
 }
 const tied=D.matchBuyerDecisionEvidence(person,[{url:'https://example.com/project',date:now,content:'Anna Smith leads the store renovation'}],candidate);
 assert.equal(D.qualifyBuyer({...tied,organization:'Other'},profile,candidate).total,null);
});

test('purchasing responsibility belonging to a different person cannot increase the named project lead bonus',()=>{
 const candidate={...company,buyerFit:{purchase:'store renovation'}},person=buyer('lead','Project Manager',{name:'Anna Smith'});
 const linked=D.matchBuyerDecisionEvidence(person,[{url:'https://example.com/news',date:now,content:'Anna Smith leads the store renovation. Other Buyer is responsible for procurement and supplier selection.'}],candidate);
 assert.equal(D.qualifyBuyer(linked,profile,candidate).breakdown.opportunity.points,12);
 assert.doesNotMatch(linked.decisionEvidence[0].quote,/Other Buyer/);
});
