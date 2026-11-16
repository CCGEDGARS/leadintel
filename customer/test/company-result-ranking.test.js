const test=require('node:test'),assert=require('node:assert/strict'),D=require('../discovery-engine.js');
const at='2026-11-16T12:00:00Z';
const company=(name,score,extra={})=>({company:name,domain:name.toLowerCase()+'.example',researchedAt:at,qualified:true,marketVerified:true,fitVerified:true,buyerVerified:true,qualification:{qualificationKind:'company',score,eligible:true,commercial:{}},...extra});
const options={assess:c=>c.currentQualification||c.qualification||{},isCurrent:c=>!c.stale};
test('new higher scores join the cumulative top ten without erasing lower existing results',()=>{
 const saved=Array.from({length:12},(_,i)=>company('Old'+i,90-i));
 const state={qualityVersion:D.DISCOVERY_QUALITY_VERSION,candidates:[...saved,company('New',97)],potentialMatches:[company('Review',62,{needsRecheck:true})]};
 const before=JSON.stringify(state),view=D.rankCompanyResults(state,options);
 assert.equal(view.total,14);assert.equal(view.visible.length,10);assert.equal(view.other.length,4);
 assert.equal(view.rows[0].candidate.company,'New');assert.deepEqual(view.rows.map(r=>r.score),[97,...saved.map(c=>c.qualification.score),62]);
 assert.equal(JSON.stringify(state),before,'display ranking must not mutate evidence or selections');
 assert.equal(D.rankCompanyResults(JSON.parse(before),options).total,14);
});
test('a fresh lower reassessment replaces an older high-scoring selected copy and aliases count once',()=>{
 const old=company('Acme',98,{domain:'careers.acme.example',researchedAt:'2026-11-01T00:00:00Z'}),fresh=company('Acme',64,{domain:'acme.example'});
 const view=D.rankCompanyResults({candidates:[fresh],potentialMatches:[{...old,domain:'jobs.acme.example'}],selectedProspects:[{...old,people:[{name:'Saved Buyer'}]}]},options);
 assert.equal(view.total,1);assert.equal(view.rows[0].score,64);assert.equal(view.rows[0].storedIndex,0);assert.equal(view.rows[0].candidate,fresh);
});
test('previous company scores remain labelled while unknown and opportunity-only scores stay unscored',()=>{
 const old=company('Previous',91,{stale:true,currentQualification:{score:null,commercial:null,eligible:false}}),unknown={company:'Unknown',domain:'unknown.example'},opportunity={company:'Opportunity',domain:'opportunity.example',stale:true,qualification:{score:88,qualificationKind:'opportunity'}};
 const view=D.rankCompanyResults({potentialMatches:[old,unknown,opportunity]},options);
 assert.equal(view.rows[0].score,91);assert.equal(view.rows[0].scoreState,'previous');assert.equal(view.rows[0].actionable,false);
 assert.ok(view.rows.slice(1).every(row=>row.score===null&&row.scoreState==='pending'));assert.equal(view.pendingCount,3);
});
test('selected-only companies remain in the inventory without granting a new action or discarding their contacts',()=>{
 const c=company('Saved',84,{people:[{id:'buyer',name:'Original Buyer',kept:true}]});const state={selectedProspects:[c],pipeline:[c]};
 const view=D.rankCompanyResults(state,options);assert.equal(view.total,1);assert.equal(view.rows[0].storedIndex,-1);assert.equal(view.rows[0].candidate.people[0].id,'buyer');
});
test('ties are stable and missing/null/invalid scores never become a manufactured zero',()=>{
 const state={candidates:[company('Zulu',70),company('Alpha',70)],potentialMatches:[company('Unknown',null),company('Invalid',150)]};
 const a=D.rankCompanyResults(state,options),b=D.rankCompanyResults(JSON.parse(JSON.stringify(state)),options);
 assert.deepEqual(a.rows.map(r=>r.candidate.company),['Alpha','Zulu','Invalid','Unknown']);assert.deepEqual(a.rows.map(r=>r.score),[70,70,null,null]);assert.deepEqual(a.rows.map(r=>r.score),b.rows.map(r=>r.score));
});
test('a newer incomplete assessment owns the record and retains an older score only as previous',()=>{
 const old=company('Acme',98,{researchedAt:'2026-11-01T00:00:00Z'}),fresh=company('Acme',null,{needsRecheck:true,currentQualification:{score:null,commercial:null,eligible:false}});
 const view=D.rankCompanyResults({candidates:[fresh],selectedProspects:[old]},options);
 assert.equal(view.total,1);assert.equal(view.rows[0].candidate,fresh);assert.equal(view.rows[0].score,98);assert.equal(view.rows[0].scoreState,'previous');assert.equal(view.rows[0].actionable,false);
});
test('a newer saved-evidence assessment date outranks an older selected assessment despite an old website-read date',()=>{
 const old=company('Acme',95,{researchedAt:'2026-11-15T00:00:00Z',qualification:{qualificationKind:'company',score:95,eligible:true,commercial:{},researchedAt:'2026-11-15T00:00:00Z'}}),fresh=company('Acme',60,{researchedAt:'2026-11-01T00:00:00Z',qualification:{qualificationKind:'company',score:60,eligible:true,commercial:{},researchedAt:'2026-11-16T00:00:00Z'}});
 const view=D.rankCompanyResults({candidates:[fresh],selectedProspects:[old]},options);assert.equal(view.rows[0].candidate,fresh);assert.equal(view.rows[0].score,60);
});
