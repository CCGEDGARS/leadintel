const test=require('node:test'),assert=require('node:assert/strict');
const D=require('../discovery-engine.js'),B=require('../buyer-outcome-benchmark.js'),C=require('../crm-engine.js');
const reference=require('./fixtures/company-contact-reference.cjs');
const now=new Date().toISOString(),old='2013-01-01T00:00:00Z';
// Same independent industry/role matrix used by buyer-decision-priority and
// buyer-contact-evidence-v3. These are contract fixtures, not live yield data.
function fixture(company='Factory Example',role='Procurement Director',domain='factory.example'){
 const roles=['CEO','COO',role,'Engineering Manager'];
 const c={company,domain,buyerSearchMode:'user_selected_target',buyerRoles:roles,people:roles.map((title,i)=>({id:'p'+i,name:['Anna Andersson','Bo Svensson','Cecilia Berg','David Lind'][i],publicName:['Anna Andersson','Bo Svensson','Cecilia Berg','David Lind'][i],title,organization:company,publicNameUrl:`https://${domain}/team`,identityEvidenceDate:now,emailResearch:{status:'complete',searches:12,failed:0,checkedAt:now},contactResearch:{version:1,evidenceVersion:2,policyVersion:D.BUYER_CONTACT_RESEARCH_POLICY.version,identityKey:[domain,company,['Anna Andersson','Bo Svensson','Cecilia Berg','David Lind'][i],title].join('|').toLowerCase(),checks:Object.fromEntries([...D.BUYER_CONTACT_RESEARCH_POLICY.requiredChecks,'deep'].map(name=>[name,{status:'complete',checkedAt:now,...(name==='linkedin'?{profileMatchVersion:1}:{}),queryLog:Array.from({length:name==='gmail'?3:name==='direct_email'?2:1},(_,i)=>({query:name+' retained source query '+i,status:'complete',checkedAt:now,resultCount:0}))}]))}}))};
 c.publicResearch={accountability:{...D.createBuyerResearchAccountability(),status:'complete',startedAt:now,completedAt:now,totalPeople:4,checkedPeople:4,officialPages:1,officialPageReads:[{url:`https://${domain}/team`,sourceRead:true,checkedAt:now}]}};
 c.buyerDiscovery={officialContactInventory:{version:1,domain,checkedAt:now,sourcePages:[`https://${domain}/team`],contacts:[],channels:[],research:{policyVersion:D.OFFICIAL_CONTACT_RESEARCH_POLICY.version,status:'complete',checkedAt:now,readPages:1,queries:[],failures:[]}}};
 return reviewed(require('./helpers/buyer-research-receipts.cjs')(c,now));
}
function reviewed(c){c.publicResearch.aiReview={status:'complete',provider:'gemini',checkedAt:now,inputSignature:D.buyerReviewSignature(c),reviewedPersonIds:c.people.map(p=>p.id),findings:[],conflicts:[]};return c;}
function contact(c,p,status='verified'){
 return {name:p.name,external_person_id:p.id,work_email:`${p.id}@${c.domain}`,email_status:status,verification_provider:status==='verified'?'Treg':'Public source',public_email_url:`https://${c.domain}/team`,verified_at:now};
}
function evaluate(c,rows={},options={}){return B.evaluate(c,{now,contactForPerson:p=>rows[p.id],...options});}
test('research, supervision and the two-email commercial target remain separate',()=>{
 const c=fixture(),report=evaluate(c);
 assert.equal(report.coverage.researchPassed,true);assert.equal(report.coverage.supervisorStatus,'complete');assert.equal(report.outcomes.priorityBuyers,4);assert.equal(report.outcomes.usablePriorityEmails,0);assert.equal(report.status,'needs_attention');assert.ok(report.blockers.some(row=>row.id==='emails'&&row.action));
 const rows=Object.fromEntries(c.people.slice(0,2).map(p=>[p.id,contact(c,p)])),ready=evaluate(c,rows);
 assert.equal(ready.status,'requirements_met');assert.equal(ready.outcomes.usablePriorityEmails,2);assert.equal(ready.execution.totalCostKnown,false);
});
test('report counts policy-accepted contacts without inferring email yield from guesses, Gmail or phones',()=>{
 const c=fixture(),rows={};
 c.people.forEach((p,i)=>{p.gmailCandidates=D.gmailGuessCandidates(p);p.gmailMatches=[{email:'possible@gmail.com',url:'https://association.example/contact'}];p.publicPhone='123456789';rows[p.id]={...contact(c,p),...(i===0?{work_email:'anna@gmail.com'}:i===1?{email_status:'guessed'}:i===2?{work_email:'info@'+c.domain}:{work_email:'p3@sub.'+c.domain})};});
 const report=evaluate(c,rows);assert.equal(report.outcomes.usablePriorityEmails,0);assert.ok(report.people.every(row=>row.confirmation==='unconfirmed'));
});
test('official company email acceptance also applies to legacy provider-only settings',()=>{
 const c=fixture(),p=c.people[0],row=contact(c,p,'public_confirmed');
 Object.assign(p,{publicEmail:row.work_email,publicEmailUrl:row.public_email_url,publicEmailSourceCheck:{status:'confirmed',email:row.work_email,url:row.public_email_url,checkedAt:now}});reviewed(c);
 assert.equal(evaluate(c,{p0:row}).outcomes.sourceConfirmedPriorityEmails,1);assert.equal(evaluate(c,{p0:row}).outcomes.usablePriorityEmails,1);
 const strict=evaluate(c,{p0:row},{confirmationLevel:'provider_verified'});assert.equal(strict.outcomes.sourceConfirmedPriorityEmails,1);assert.equal(strict.outcomes.usablePriorityEmails,1);
 row.verified_at=old;assert.equal(evaluate(c,{p0:row}).outcomes.usablePriorityEmails,0);
 p.publicEmailSourceCheck.checkedAt=old;assert.equal(evaluate(c,{p0:row}).outcomes.sourceConfirmedPriorityEmails,0);
});
test('read official email evidence is usable before a redundant CRM confirmation request',()=>{
 const c=fixture(),p=c.people[0];Object.assign(p,{publicEmail:'anna.andersson@'+c.domain,publicEmailUrl:p.publicNameUrl,publicEmailEvidence:{version:2,url:p.publicNameUrl,quote:'Anna Andersson — CEO. anna.andersson@'+c.domain,sourceKind:'official',sourceRead:true,checkedAt:now}});
 const report=evaluate(c,{}, {confirmationLevel:'provider_verified'});assert.equal(report.outcomes.usablePriorityEmails,1);assert.equal(report.people.find(row=>row.personId===p.id).usableEmail,p.publicEmail);
});
test('exact contact identity and company bindings reject cross-company or wrong-person reuse',()=>{
 const a=fixture(),b=fixture('Legal Example','Finance Director','legal.example'),rows={p0:contact(a,a.people[0]),p1:{...contact(b,b.people[1]),name:a.people[1].name}};
 assert.equal(evaluate(b,rows).outcomes.usablePriorityEmails,1);
 for(const change of [{name:'Other Person'},{external_person_id:'different-person'},{work_email:'p0@factory.example'}])assert.equal(evaluate(b,{p0:{...contact(b,b.people[0]),...change}}).outcomes.usablePriorityEmails,0);
});
test('conflicting roles hold the person outcome while preserving previously returned contacts',()=>{
 const c=fixture(),rows={p0:contact(c,c.people[0]),p1:contact(c,c.people[1])};c.publicResearch.conflicts=[{person_id:'p0',reason:'Current employer evidence conflicts'}];
 const before=JSON.stringify({c,rows}),r=evaluate(c,rows);assert.equal(r.outcomes.usablePriorityEmails,1);assert.equal(r.coverage.supervisorStatus,'complete');assert.ok(r.blockers.some(row=>row.id==='ai_review'));assert.equal(JSON.stringify({c,rows}),before);
});
test('partial, stale and missing per-query evidence never become completed research',()=>{
 for(const mutate of [c=>c.people[0].contactResearch.checks.gmail.queryLog.pop(),c=>c.people[0].contactResearch.checks.direct_email.queryLog[0].status='partial',c=>c.people[0].contactResearch.checks.phone.checkedAt=old,c=>c.publicResearch.accountability.status='partial']){
  const c=fixture();mutate(c);const r=evaluate(c);assert.equal(r.coverage.researchPassed,false);assert.equal(r.status,'needs_attention');
 }
 const c=fixture();c.publicResearch.aiReview.reviewedPersonIds.pop();assert.equal(evaluate(c).coverage.supervisorStatus,'partial');
 c.publicResearch.aiReview.checkedAt=old;assert.equal(evaluate(c).coverage.supervisorStatus,'stale');
});
test('industry and company names do not alter qualification or contact metrics',()=>{
 const reports=[['Factory Example','Procurement Director','factory.example'],['Retail Example','Marketing Director','retail.example'],['Legal Example','Finance Director','legal.example']].map(args=>{const c=fixture(...args);return evaluate(c,Object.fromEntries(c.people.slice(0,2).map(p=>[p.id,contact(c,p)])));});
 for(const report of reports){assert.equal(report.outcomes.usablePriorityEmails,2);assert.equal(report.outcomes.priorityBuyers,4);assert.equal(report.coverage.researchPassed,true);}
});
test('a retained official contact inventory does not promote unrelated staff into priority buyers',()=>{
 const inventory=D.officialCompanyContactInventory([reference.staff],reference.company);
 const c={...reference.company,buyerRoles:['CEO','Procurement Director'],people:inventory.contacts};
 const report=evaluate(c);assert.equal(report.outcomes.usablePriorityEmails,0);assert.ok(report.outcomes.priorityBuyers<4);assert.ok(report.blockers.some(row=>row.id==='four_buyers'));
});
test('retained paid receipts and elapsed research time are reported without invented total cost or provider usage',()=>{
 const c=fixture(),p=c.people[0];p.contactData={version:1,domain:c.domain,personId:p.id,identityName:p.name,status:'partial',checkedAt:now,costMicro:75000,callIds:['call-1','call-1'],phone:{status:'provider_listed'}};
 c.publicResearch.accountability.startedAt=new Date(Date.parse(now)-2400).toISOString();D.recordBuyerResearchTool(c.publicResearch.accountability,{provider:'grounded',status:'succeeded',results:0});
 const r=evaluate(c);assert.equal(r.execution.publicResearchElapsedMs,2400);assert.equal(r.execution.recordedPaidCostMicro,75000);assert.deepEqual(r.execution.paidCallIds,['call-1']);assert.equal(r.outcomes.usablePriorityEmails,0);assert.equal(r.coverage.tools.find(t=>t.provider==='grounded').succeeded,1);assert.equal(r.coverage.tools.find(t=>t.provider==='apollo').attempted,0);
 p.contactData.domain='another.example';assert.equal(evaluate(c).execution.recordedPaidCostMicro,null);
 delete c.publicResearch.accountability.completedAt;assert.equal(evaluate(c).execution.publicResearchElapsedMs,null);
});
test('empty unstarted state and an executed empty attempt have distinct outcome labels',()=>{
 assert.equal(evaluate({company:'Unknown',domain:'unknown.example',people:[]}).status,'not_started');
 assert.equal(evaluate({company:'Unknown',domain:'unknown.example',people:[],peopleStatus:'empty',buyerDiscovery:{checkedAt:now}}).status,'needs_attention');
});
test('normalization and CRM snapshots retain source checks and receipts; evaluator never overwrites saved work',()=>{
 const c=fixture(),p=c.people[0],row=contact(c,p,'public_confirmed');Object.assign(p,{publicEmail:row.work_email,publicEmailUrl:row.public_email_url,publicEmailSourceCheck:{status:'confirmed',email:row.work_email,url:row.public_email_url,checkedAt:now},kept:true});reviewed(c);
 p.contactData={version:1,domain:c.domain,personId:p.id,identityName:p.name,status:'partial',checkedAt:now,costMicro:75000,callIds:['saved-call'],profile:{status:'not_found'},phone:{status:'provider_listed',number:'12345'}};
 const restored=D.normalizeDiscoveryState({selectedProspects:[c]}).selectedProspects[0],before=JSON.stringify(restored),r=evaluate(restored,{p0:row});
 assert.equal(r.outcomes.usablePriorityEmails,1);assert.equal(JSON.stringify(restored),before);
 const snapshot=C.mapDiscoveryCandidateToCrm(restored).intelligence.research_snapshot.buyerResearch.buyers[0];assert.equal(snapshot.publicEmail,p.publicEmail);assert.equal(snapshot.contactData.callIds[0],'saved-call');
});
function unsortedRoster(){
 const c=fixture();c.buyerRoles.push('Project Manager');
 const extra=Array.from({length:4},(_,i)=>({...structuredClone(c.people[3]),id:'extra'+i,name:['Eva Karlsson','Fredrik Holm','Greta Lund','Henrik Dahl'][i],publicName:['Eva Karlsson','Fredrik Holm','Greta Lund','Henrik Dahl'][i],title:'Project Manager'}));
 c.people=[...extra,...c.people];c.publicResearch.accountability.checkedPeople=8;c.publicResearch.accountability.totalPeople=8;return reviewed(require('./helpers/buyer-research-receipts.cjs')(c,now));
}
test('deep-wave acceptance follows ranked priority buyers even when retained roster order differs',()=>{
 const c=unsortedRoster(),priority=D.rankedBuyerShortlist(c.people,{decisionMakers:c.buyerRoles},c).priorityIds;
 assert.deepEqual(new Set(priority),new Set(['p0','p1','p2','p3']));
 delete c.people.find(p=>p.id==='p2').contactResearch.checks.deep;
 assert.equal(D.buyerResearchCoveragePassed(c),false,'a missing priority deep check cannot hide behind the array-first four');
});
test('nonpriority identities need their mandatory checks but do not consume the four deep-wave places',()=>{
 const c=unsortedRoster();for(const p of c.people.filter(p=>p.id.startsWith('extra')))delete p.contactResearch.checks.deep;
 assert.equal(D.buyerResearchCoveragePassed(c),true);
});
test('previously returned nonpriority contacts stay visible without replacing relevant priority buyers',()=>{
 const c=unsortedRoster(),p=c.people[0],saved=contact(c,p),before=JSON.stringify(c),r=evaluate(c,{[p.id]:saved});
 assert.equal(r.outcomes.usableOtherEmails,1);assert.equal(r.outcomes.usablePriorityEmails,0);assert.equal(r.outcomes.priorityBuyers,4);assert.equal(JSON.stringify(c),before);
});
test('accepted buyer counts expose distinct addresses separately rather than imply two mailbox addresses',()=>{
 const c=fixture(),rows={p0:contact(c,c.people[0]),p1:{...contact(c,c.people[1]),work_email:'p0@'+c.domain}},r=evaluate(c,rows);
 assert.equal(r.outcomes.usablePriorityEmails,2);assert.equal(r.outcomes.uniquePriorityEmailAddresses,1);
});
test('mandatory execution escalates the same ranked priority identities used for coverage',async()=>{
 const c=unsortedRoster();for(const p of c.people){delete p.contactResearch;p.emailResearch={status:'not_searched'};}
 await D.runMandatoryBuyerResearch(c,{search:async()=>[],readPage:async()=>({markdown:'Factory Example company contact page.'})});
 for(const p of c.people)assert.equal(p.contactResearch.checks.deep.status,p.id.startsWith('extra')?'not_needed':'complete',p.id);
});
test('a public pool without supported executive priority still receives four research escalation places',async()=>{
 const c=fixture();c.buyerRoles=['COO'];c.people=Array.from({length:10},(_,i)=>({id:'pool'+i,name:'Pool Buyer'+i,publicName:'Pool Buyer'+i,title:'COO',organization:c.company,publicNameUrl:'https://linkedin.com/in/pool-'+i,publicLinkedinUrl:'https://linkedin.com/in/pool-'+i}));
 assert.equal(D.rankedBuyerShortlist(c.people,{decisionMakers:c.buyerRoles},c).priorityIds.length,0);
 await D.runMandatoryBuyerResearch(c,{search:async()=>[],readPage:async()=>({markdown:'Factory Example company contact page.'})});
 assert.equal(c.people.filter(p=>p.contactResearch.checks.deep?.status==='complete').length,4);
 assert.equal(D.buyerQualityAssessment(c).passed,false,'research escalation does not manufacture a qualified committee');
});
function paidData(c,p,callIds,costMicro){return {version:1,domain:c.domain,personId:p.id,identityName:p.name,status:'partial',checkedAt:now,costMicro,callIds,phone:{status:'not_found'}};}
test('missing or zero receipt cost remains unknown',()=>{
 for(const [ids,cost] of [[[],0],[[],75000],[['call-1'],0],[['call-1'],1.5]]){const c=fixture();c.people[0].contactData=paidData(c,c.people[0],ids,cost);assert.equal(evaluate(c).execution.recordedPaidCostMicro,null);}
});
test('exact duplicate paid receipt groups count once and ambiguous overlapping groups stay unknown',()=>{
 for(const [a,b,cost] of [[['one'],['one'],75000],[['one','two'],['two','three'],null]]){
  const c=fixture();c.people[0].contactData=paidData(c,c.people[0],a,75000);c.people[1].contactData=paidData(c,c.people[1],b,75000);assert.equal(evaluate(c).execution.recordedPaidCostMicro,cost);
 }
 const c=fixture();c.people[0].contactData=paidData(c,c.people[0],['one'],75000);c.people[1].contactData=paidData(c,c.people[1],['one'],90000);assert.equal(evaluate(c).execution.recordedPaidCostMicro,null);
});
