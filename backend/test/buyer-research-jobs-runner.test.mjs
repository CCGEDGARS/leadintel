import test from 'node:test';
import assert from 'node:assert/strict';
import {startBuyerJob,commandBuyerJob,readBuyerJob} from '../src/buyer-research-store.js';
import {runDossierResearch} from '../src/company-dossier.js';
import {buyerJobsFixture,workspaceId} from './buyer-research-jobs-fixture.mjs';

const team='https://forge.example/team';
const page=(url,text='Robert Lund — Head of Procurement — Forge Industries')=>({url,markdown:text,metadata:{sourceURL:url,source:'direct-fallback'}});
const namedContact='### Robert Lund\nHead of Procurement\nPhone: +46 70 123 45 67\n[robert.lund@forge.example](mailto:robert.lund@forge.example)\nForge Industries';
async function run(env,options){const {runBuyerResearchJobs}=await import('../src/buyer-research-runner.js');return runBuyerResearchJobs(env,{maxJobs:1,windowMs:2000,...options});}
const emptySearch=()=>Object.assign([],{searchProviders:['grounded'],researchTrace:[{provider:'grounded',status:'succeeded',operation:'search',results:0}]});
function services(overrides={}){return {search:async()=>emptySearch(),read:async url=>page(url),dossier:async()=>({status:'complete',people:[],facts:[],channels:[],sources:[],passes:[]}),independent:async()=>({status:'not_configured',reason:'No independent test connection',results:[]}),review:async()=>({provider:'controlled-review',supervisor:{status:'complete',reviewedPersonIds:['robert'],findings:[]},conflicts:[],summary:'Reviewed supplied evidence'}),...overrides};}
function deferred(){let resolve;const promise=new Promise(done=>resolve=done);return {promise,resolve};}
test('fresh official role evidence clears a saved role hold before an incomplete dossier can hide the retained buyers',async t=>{
 const f=await buyerJobsFixture(t);f.body.candidate.buyerRolesChanged=true;
 const job=await startBuyerJob(f.env,workspaceId,f.users.owner,f.body);
 await run(f.env,{jobId:job.id,services:services({read:async url=>page(url,namedContact)})});
 const saved=JSON.parse((await readBuyerJob(f.env,workspaceId,{id:job.id})).result_json);
 assert.equal(saved.buyerRolesChanged,false);assert.equal(saved.people.find(person=>person.id==='robert').publicEmail,'robert.lund@forge.example');
 assert.ok(globalThis.LeadIntelDiscovery.rankedBuyerShortlist(saved.people,f.payload.main.profile,saved).priorityIds.length>0);
});

test('completed search and page receipts survive a processing slice and are reused on the next contacts pass',async t=>{
 const f=await buyerJobsFixture(t),job=await startBuyerJob(f.env,workspaceId,f.users.owner,f.body),started=deferred(),held=deferred(),queries=[],reads=[];let interrupted=false;
 f.DB.raw.prepare("UPDATE buyer_research_jobs SET phase='contacts' WHERE id=?").run(job.id);
 const controlled=services({search:async query=>{queries.push(query);if(!interrupted&&query.includes('"robert.lund@gmail.com"')){interrupted=true;started.resolve();await held.promise;}return emptySearch();},read:async url=>{reads.push(url);return page(url);}});
 const first=run(f.env,{jobId:job.id,windowMs:2000,services:controlled});
 try{
  await Promise.race([started.promise,first.then(()=>{throw Error('Contact runner ended before the controlled Gmail query');})]);await first;
  const partial=await readBuyerJob(f.env,workspaceId,{id:job.id});assert.equal(partial.status,'queued');assert.equal(partial.phase,'contacts');
  const complete=f.DB.raw.prepare("SELECT task_key,result_json FROM buyer_research_tasks WHERE job_id=? AND kind='search' AND status='complete'").all(job.id);assert.ok(complete.length>=5,'actual earlier mandatory searches were durably saved');
  const oldQueries=queries.slice(0,-1),oldReads=reads.slice(),next=await run(f.env,{jobId:job.id,services:controlled});assert.equal(next[0].phase,'review');
  for(const query of oldQueries)assert.equal(queries.filter(value=>value===query).length,1,'successful query was reused: '+query);assert.deepEqual(reads,oldReads,'the fully read official body is restored from the task ledger');
  const saved=await readBuyerJob(f.env,workspaceId,{id:job.id}),candidate=JSON.parse(saved.result_json);assert.equal(candidate.people[0].contactResearch.checks.gmail.status,'complete');assert.deepEqual(candidate.people[0].contactResearch.checks.gmail.queryLog[0].providers,['grounded']);assert.equal(candidate.publicResearch.accountability.tools.find(row=>row.provider==='grounded').succeeded,new Set(queries).size);assert.equal(candidate.publicResearch.accountability.tools.find(row=>row.provider==='direct').succeeded,1);
  const beforeLate=f.DB.raw.prepare('SELECT * FROM buyer_research_tasks WHERE job_id=? ORDER BY task_key').all(job.id);held.resolve();await new Promise(resolve=>setImmediate(resolve));assert.deepEqual(f.DB.raw.prepare('SELECT * FROM buyer_research_tasks WHERE job_id=? ORDER BY task_key').all(job.id),beforeLate,'expired first-slice results cannot overwrite resumed receipts');
 }finally{held.resolve();await first;}
});

test('cancel during an actual source read prevents late source and candidate writes',async t=>{
 const f=await buyerJobsFixture(t),job=await startBuyerJob(f.env,workspaceId,f.users.owner,f.body),started=deferred(),held=deferred(),original=job.result_json;
 const work=run(f.env,{jobId:job.id,services:services({read:async url=>{started.resolve();await held.promise;return page(url,'Robert Lund — Head of Procurement — Forge Industries\nrobert@forge.example');}})});
 try{
  await Promise.race([started.promise,work.then(()=>{throw Error('Official runner ended before its source read');})]);
  const current=await readBuyerJob(f.env,workspaceId,{id:job.id}),canceled=await commandBuyerJob(f.env,workspaceId,f.users.owner,{action:'cancel',jobId:job.id,expectedRevision:current.revision});held.resolve();await work;
  const saved=await readBuyerJob(f.env,workspaceId,{id:job.id});assert.equal(saved.status,'canceled');assert.equal(saved.revision,canceled.revision);assert.equal(saved.result_json,original);assert.equal(f.DB.raw.prepare("SELECT count(*) n FROM buyer_research_tasks WHERE job_id=? AND status='complete'").get(job.id).n,0);
  assert.deepEqual(await run(f.env,{jobId:job.id,services:services({search:async()=>assert.fail('Canceled jobs cannot restart providers')})}),[]);
 }finally{held.resolve();await work;}
});

test('revoked membership during source work blocks late receipts and retains the prior candidate',async t=>{
 const f=await buyerJobsFixture(t),job=await startBuyerJob(f.env,workspaceId,f.users.owner,f.body),started=deferred(),held=deferred(),original=job.result_json;
 const work=run(f.env,{jobId:job.id,services:services({read:async url=>{started.resolve();await held.promise;return page(url,'Robert Lund — Head of Procurement — Forge Industries\nrobert@forge.example');}})});
 try{
  await Promise.race([started.promise,work.then(()=>{throw Error('Official runner ended before its source read');})]);f.DB.raw.prepare("UPDATE workspace_members SET role='viewer' WHERE workspace_id=? AND user_id=?").run(workspaceId,f.users.owner.id);held.resolve();await work;
  const saved=await readBuyerJob(f.env,workspaceId,{id:job.id});assert.equal(saved.status,'canceled');assert.equal(saved.result_json,original);assert.equal(saved.lease_token,null);assert.equal(f.DB.raw.prepare("SELECT count(*) n FROM buyer_research_tasks WHERE job_id=? AND status='complete'").get(job.id).n,0);
 }finally{held.resolve();await work;}
});

test('an expired lease can be reclaimed and the superseded worker cannot overwrite the new saved projection',async t=>{
 const f=await buyerJobsFixture(t),job=await startBuyerJob(f.env,workspaceId,f.users.owner,f.body),started=deferred(),held=deferred();let reads=0;
 const named=email=>`### Robert Lund\nHead of Procurement\n[${email}](mailto:${email})\nForge Industries`;
 const controlled=services({read:async url=>{reads++;if(reads===1){started.resolve();await held.promise;return page(url,named('wrong@forge.example'));}return page(url,named('robert@forge.example'));}}),old=run(f.env,{jobId:job.id,services:controlled});
 try{
  await Promise.race([started.promise,old.then(()=>{throw Error('Official runner ended before its source read');})]);f.DB.raw.prepare('UPDATE buyer_research_jobs SET lease_until=0 WHERE id=?').run(job.id);
  const next=await run(f.env,{jobId:job.id,services:controlled});assert.ok(next.length);const accepted=await readBuyerJob(f.env,workspaceId,{id:job.id});assert.ok(JSON.parse(accepted.result_json).people.some(person=>person.publicEmail==='robert@forge.example'),JSON.stringify({next,result:JSON.parse(accepted.result_json),diagnostics:accepted.diagnostic_json,reads}));
  const tasks=f.DB.raw.prepare('SELECT * FROM buyer_research_tasks WHERE job_id=? ORDER BY task_key').all(job.id);held.resolve();await old;const after=await readBuyerJob(f.env,workspaceId,{id:job.id});assert.equal(after.result_json,accepted.result_json);assert.equal(after.revision,accepted.revision);assert.deepEqual(f.DB.raw.prepare('SELECT * FROM buyer_research_tasks WHERE job_id=? ORDER BY task_key').all(job.id),tasks);
 }finally{held.resolve();await old;}
});

test('failed source tasks have bounded automatic attempts and are retried only after explicit resume resets their budget',async t=>{
 const f=await buyerJobsFixture(t),job=await startBuyerJob(f.env,workspaceId,f.users.owner,f.body);f.DB.raw.prepare("UPDATE buyer_research_jobs SET phase='contacts' WHERE id=?").run(job.id);let reads=0;
 const controlled=services({read:async()=>{reads++;throw Error('Controlled source unavailable');}});
 for(let i=0;i<3;i++)await run(f.env,{jobId:job.id,services:controlled});assert.equal(reads,2);const failed=f.DB.raw.prepare("SELECT * FROM buyer_research_tasks WHERE job_id=? AND kind='read'").get(job.id);assert.equal(failed.attempts,2);assert.equal(failed.status,'failed');
 const current=await readBuyerJob(f.env,workspaceId,{id:job.id});if(['queued','running'].includes(current.status))await commandBuyerJob(f.env,workspaceId,f.users.owner,{action:'cancel',jobId:job.id,expectedRevision:current.revision});const stopped=await readBuyerJob(f.env,workspaceId,{id:job.id});await commandBuyerJob(f.env,workspaceId,f.users.owner,{action:'resume',jobId:job.id,expectedRevision:stopped.revision});f.DB.raw.prepare("UPDATE buyer_research_jobs SET phase='contacts' WHERE id=?").run(job.id);
 await run(f.env,{jobId:job.id,services:controlled});assert.equal(reads,3);assert.equal(f.DB.raw.prepare("SELECT attempts FROM buyer_research_tasks WHERE job_id=? AND kind='read'").get(job.id).attempts,1);
});

test('an unavailable independent provider stays failed and retryable instead of being cached as a successful task',async t=>{
 const f=await buyerJobsFixture(t),job=await startBuyerJob(f.env,workspaceId,f.users.owner,f.body);f.DB.raw.prepare("UPDATE buyer_research_jobs SET phase='contacts' WHERE id=?").run(job.id);let calls=0;
 const controlled=services({independent:async()=>{calls++;return calls<=2?{status:'unavailable',reason:'Controlled independent provider unavailable',results:[]}:{status:'complete',web_search:true,results:[]};}});
 await run(f.env,{jobId:job.id,services:controlled});const first=f.DB.raw.prepare("SELECT * FROM buyer_research_tasks WHERE job_id=? AND kind='independent'").get(job.id);assert.equal(first.status,'failed');assert.equal(first.attempts,1);assert.equal(calls,1);
 await run(f.env,{jobId:job.id,services:controlled});const second=f.DB.raw.prepare("SELECT * FROM buyer_research_tasks WHERE job_id=? AND kind='independent'").get(job.id);assert.equal(second.status,'failed');assert.equal(second.attempts,2);assert.equal(calls,2);assert.equal(JSON.parse((await readBuyerJob(f.env,workspaceId,{id:job.id})).result_json).people[0].contactResearch.checks.independent.status,'partial');
 const current=await readBuyerJob(f.env,workspaceId,{id:job.id});if(['queued','running'].includes(current.status))await commandBuyerJob(f.env,workspaceId,f.users.owner,{action:'cancel',jobId:job.id,expectedRevision:current.revision});const stopped=await readBuyerJob(f.env,workspaceId,{id:job.id});await commandBuyerJob(f.env,workspaceId,f.users.owner,{action:'resume',jobId:job.id,expectedRevision:stopped.revision});f.DB.raw.prepare("UPDATE buyer_research_jobs SET phase='contacts' WHERE id=?").run(job.id);
 await run(f.env,{jobId:job.id,services:controlled});assert.equal(calls,3);assert.equal(f.DB.raw.prepare("SELECT status FROM buyer_research_tasks WHERE job_id=? AND kind='independent'").get(job.id).status,'complete');assert.equal(JSON.parse((await readBuyerJob(f.env,workspaceId,{id:job.id})).result_json).people[0].contactResearch.checks.independent.status,'complete');
});

test('cached independent results do not inflate executed tool counters when their selected source is retried',async t=>{
 const f=await buyerJobsFixture(t),job=await startBuyerJob(f.env,workspaceId,f.users.owner,f.body),external='https://association.example/robert';f.DB.raw.prepare("UPDATE buyer_research_jobs SET phase='contacts' WHERE id=?").run(job.id);let independentCalls=0,searchCalls=0,failedReads=0;
 const controlled=services({search:async()=>{searchCalls++;return emptySearch();},read:async url=>{if(url===external){failedReads++;throw Error('Controlled relevant source unavailable');}return page(url);},independent:async()=>{independentCalls++;return {provider:'gemini',status:'complete',web_search:true,results:[{url:external,title:'Robert Lund — Forge Industries business contact'}]};}});
 await run(f.env,{jobId:job.id,services:controlled});const first=await readBuyerJob(f.env,workspaceId,{id:job.id}),before=JSON.parse(first.result_json),savedIndependent=f.DB.raw.prepare("SELECT * FROM buyer_research_tasks WHERE job_id=? AND kind='independent'").get(job.id),actualSearches=searchCalls;
 assert.equal(first.phase,'contacts');assert.equal(savedIndependent.status,'complete');assert.equal(savedIndependent.attempts,1);assert.equal(before.people[0].contactResearch.checks.independent.status,'partial');assert.equal(before.publicResearch.accountability.tools.find(row=>row.provider==='gemini').succeeded,1);
 await run(f.env,{jobId:job.id,services:controlled});const candidate=JSON.parse((await readBuyerJob(f.env,workspaceId,{id:job.id})).result_json),gemini=candidate.publicResearch.accountability.tools.find(row=>row.provider==='gemini'),receipt=candidate.people[0].contactResearch.checks.independent.queryLog[0],reused=f.DB.raw.prepare("SELECT * FROM buyer_research_tasks WHERE job_id=? AND kind='independent'").get(job.id),read=f.DB.raw.prepare("SELECT * FROM buyer_research_tasks WHERE job_id=? AND kind='read' AND request_value=?").get(job.id,external);
 assert.equal(independentCalls,1);assert.equal(failedReads,2);assert.equal(searchCalls,actualSearches);assert.equal(reused.result_json,savedIndependent.result_json);assert.equal(reused.attempts,1);assert.equal(read.status,'failed');assert.equal(read.attempts,2);
 assert.deepEqual({attempted:gemini.attempted,succeeded:gemini.succeeded,failed:gemini.failed,skipped:gemini.skipped,results:gemini.results},{attempted:1,succeeded:1,failed:0,skipped:0,results:1});assert.equal(candidate.publicResearch.accountability.tools.find(row=>row.provider==='grounded').succeeded,actualSearches);assert.equal(receipt.searchStatus,'complete');assert.equal(receipt.status,'partial');assert.deepEqual(receipt.providers,['gemini']);assert.equal(receipt.sourceReads[0].status,'partial');
});

test('actual failed extractor chains and provider exceptions retain counters without replaying completed searches',async t=>{
 const f=await buyerJobsFixture(t),job=await startBuyerJob(f.env,workspaceId,f.users.owner,f.body);f.DB.raw.prepare("UPDATE buyer_research_jobs SET phase='contacts' WHERE id=?").run(job.id);let reads=0,failedSearches=0,successfulSearches=0,independentCalls=0;
 const controlled=services({search:async query=>{if(query.startsWith('site:linkedin.com/in/')){failedSearches++;throw Object.assign(Error('Controlled indexed-profile search unavailable'),{researchTrace:[{provider:'grounded',operation:'search',status:'failed',reason:'Controlled indexed-profile search unavailable'}]});}successfulSearches++;return emptySearch();},read:async()=>{reads++;throw Object.assign(Error('Controlled extractors unavailable'),{researchTrace:['direct','firecrawl','scrapling'].map(provider=>({provider,operation:'extract',status:'failed',reason:'Controlled source read unavailable'}))});},independent:async()=>{independentCalls++;throw Error('Controlled independent request failed');}});
 await run(f.env,{jobId:job.id,services:controlled});const completed=f.DB.raw.prepare("SELECT task_key FROM buyer_research_tasks WHERE job_id=? AND status='complete' ORDER BY task_key").all(job.id),actualSuccessfulSearches=successfulSearches;
 await run(f.env,{jobId:job.id,services:controlled});const candidate=JSON.parse((await readBuyerJob(f.env,workspaceId,{id:job.id})).result_json),tools=candidate.publicResearch.accountability.tools;
 assert.equal(reads,2);assert.equal(failedSearches,2);assert.equal(independentCalls,2);assert.equal(successfulSearches,actualSuccessfulSearches);assert.deepEqual(f.DB.raw.prepare("SELECT task_key FROM buyer_research_tasks WHERE job_id=? AND status='complete' ORDER BY task_key").all(job.id),completed);
 for(const provider of ['direct','firecrawl','scrapling','gemini']){const row=tools.find(tool=>tool.provider===provider);assert.deepEqual({attempted:row.attempted,failed:row.failed,succeeded:row.succeeded,results:row.results},{attempted:2,failed:2,succeeded:0,results:0},provider);}
 const grounded=tools.find(row=>row.provider==='grounded');assert.equal(grounded.failed,2);assert.equal(grounded.succeeded,actualSuccessfulSearches);assert.equal(grounded.attempted,actualSuccessfulSearches+2);assert.equal(candidate.people[0].contactResearch.checks.linkedin.status,'partial');assert.equal(candidate.people[0].contactResearch.checks.independent.status,'partial');
});

test('conflicting source locations cannot become accepted official evidence and the failed read remains retryable',async t=>{
 const f=await buyerJobsFixture(t),job=await startBuyerJob(f.env,workspaceId,f.users.owner,f.body);f.DB.raw.prepare("UPDATE buyer_research_jobs SET phase='contacts' WHERE id=?").run(job.id);let valid=false,reads=0;
 const controlled=services({read:async url=>{reads++;return {url,markdown:namedContact,metadata:{sourceURL:valid?url:'https://foreign.example/team',source:'direct-fallback'}};}});
 await run(f.env,{jobId:job.id,services:controlled});const first=await readBuyerJob(f.env,workspaceId,{id:job.id}),candidate=JSON.parse(first.result_json),failed=f.DB.raw.prepare("SELECT * FROM buyer_research_tasks WHERE job_id=? AND kind='read'").get(job.id);
 assert.equal(candidate.people[0].publicEmail||'','');assert.equal(globalThis.LeadIntelDiscovery.acceptedOfficialBuyerEmail(candidate,candidate.people[0]),'');assert.equal(candidate.publicResearch.accountability.officialPages,0);assert.equal(failed.status,'failed');assert.equal(failed.attempts,1);assert.equal(reads,1);
 valid=true;await run(f.env,{jobId:job.id,services:controlled});const recovered=JSON.parse((await readBuyerJob(f.env,workspaceId,{id:job.id})).result_json);assert.equal(globalThis.LeadIntelDiscovery.acceptedOfficialBuyerEmail(recovered,recovered.people[0]),'robert.lund@forge.example');const task=f.DB.raw.prepare("SELECT * FROM buyer_research_tasks WHERE job_id=? AND kind='read'").get(job.id);assert.equal(task.status,'complete');assert.equal(task.attempts,2);assert.equal(reads,2);
});

test('a seller context change during an awaited source read blocks its receipt and candidate publication',async t=>{
 const f=await buyerJobsFixture(t),job=await startBuyerJob(f.env,workspaceId,f.users.owner,f.body),started=deferred(),held=deferred();f.DB.raw.prepare("UPDATE buyer_research_jobs SET phase='contacts' WHERE id=?").run(job.id);
 const work=run(f.env,{jobId:job.id,services:services({read:async url=>{started.resolve();await held.promise;return page(url,namedContact);}})});
 try{
  await Promise.race([started.promise,work.then(()=>{throw Error('Contact runner ended before the controlled source read');})]);f.DB.raw.prepare("UPDATE customer_workspace_state SET payload_json=json_set(payload_json,'$.main.website','https://changed-seller.example/'),version=version+1 WHERE workspace_id=?").run(workspaceId);held.resolve();await work;
  const saved=await readBuyerJob(f.env,workspaceId,{id:job.id});assert.equal(saved.status,'canceled');assert.equal(saved.result_json,job.result_json);assert.equal(saved.lease_token,null);assert.equal(f.DB.raw.prepare("SELECT count(*) n FROM buyer_research_tasks WHERE job_id=? AND kind='read' AND status='complete'").get(job.id).n,0);
 }finally{held.resolve();await work;}
});

test('terminal incomplete research resumes its earliest missing phase without replaying completed official or dossier work',async t=>{
 const f=await buyerJobsFixture(t),job=await startBuyerJob(f.env,workspaceId,f.users.owner,f.body),fact='Forge Industries manufactures industrial machinery.';let independentReady=false,independentCalls=0,searches=0,reads=0,dossiers=0,reviews=0;
 const controlled=services({search:async()=>{searches++;return emptySearch();},read:async url=>{reads++;return page(url,'Robert Lund — Head of Procurement — Forge Industries\n'+fact);},dossier:async(_env,_workspace,company)=>{dossiers++;return runDossierResearch({connections:[{provider:'openai',model:'fixture'},{provider:'anthropic',model:'fixture'}],company,search:async()=>({web_search:true,results:[{url:team}]}),read:async()=>({url:team,text:fact}),extract:async()=>({facts:[{kind:'fit',text:fact,quote:fact,sourceUrl:team}],people:[],channels:[]})});},independent:async()=>{independentCalls++;return independentReady?{status:'complete',web_search:true,results:[]}:{status:'unavailable',reason:'Controlled independent provider unavailable',results:[]};},review:async()=>{reviews++;return {provider:'controlled-review',supervisor:{status:'complete',reviewedPersonIds:['robert'],findings:[]},conflicts:[]};}});
 let terminal;for(let i=0;i<9;i++){await run(f.env,{jobId:job.id,services:controlled});terminal=await readBuyerJob(f.env,workspaceId,{id:job.id});if(terminal.status==='needs_review')break;}
 assert.equal(terminal.status,'needs_review');assert.equal(terminal.phase,'done');assert.equal(JSON.parse(terminal.result_json).people[0].contactResearch.checks.independent.status,'partial');assert.equal(independentCalls,2);assert.equal(dossiers,1);
 const before={searches,reads,dossiers,reviews};independentReady=true;const resumed=await commandBuyerJob(f.env,workspaceId,f.users.owner,{action:'resume',jobId:job.id,expectedRevision:terminal.revision});assert.equal(resumed.id,job.id);assert.equal(resumed.status,'queued');assert.equal(resumed.phase,'contacts');
 await run(f.env,{jobId:job.id,services:controlled});const restored=await readBuyerJob(f.env,workspaceId,{id:job.id});assert.equal(JSON.parse(restored.result_json).people[0].contactResearch.checks.independent.status,'complete');assert.equal(independentCalls,3);assert.equal(searches,before.searches);assert.equal(reads,before.reads);assert.equal(dossiers,before.dossiers);assert.equal(reviews,before.reviews);assert.equal(restored.phase,'review');
});

test('completed dossier is reused without provider dispatch',async t=>{
 const f=await buyerJobsFixture(t),job=await startBuyerJob(f.env,workspaceId,f.users.owner,f.body),candidate=JSON.parse(job.result_json);
 candidate.buyerDiscovery={...candidate.buyerDiscovery,companyDossier:{status:'complete',people:[],facts:[],sources:[],channels:[],passes:[]}};
 f.DB.raw.prepare("UPDATE buyer_research_jobs SET phase='dossier',result_json=? WHERE id=?").run(JSON.stringify(candidate),job.id);
 await run(f.env,{jobId:job.id,services:services({dossier:async()=>assert.fail('completed company research must not repeat')})});
 assert.equal((await readBuyerJob(f.env,workspaceId,{id:job.id})).phase,'identities');
});
test('exhausted dossier budget advances to buyers without another provider request',async t=>{
 const f=await buyerJobsFixture(t),job=await startBuyerJob(f.env,workspaceId,f.users.owner,f.body);
 f.DB.raw.prepare("UPDATE buyer_research_jobs SET phase='dossier',phase_ms=360000 WHERE id=?").run(job.id);
 await run(f.env,{jobId:job.id,services:services({dossier:async()=>assert.fail('exhausted phase must advance')})});
 const saved=await readBuyerJob(f.env,workspaceId,{id:job.id});assert.equal(saved.phase,'identities');assert.match(saved.diagnostic_json,/time limit reached/);assert.equal(JSON.parse(saved.result_json).people.length,1);
});
