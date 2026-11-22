import test from 'node:test';
import assert from 'node:assert/strict';
import app from '../src/app.js';
import {buyerJobsFixture,workspaceId,foreignWorkspaceId} from './buyer-research-jobs-fixture.mjs';
import {startBuyerJob,readBuyerJob,publicBuyerJob} from '../src/buyer-research-store.js';
import {requestFirecrawl} from '../src/firecrawl-request.js';
import {createBuyerSourceSearch} from '../src/buyer-source-search.js';
import {readPublicBuyerPage} from '../src/service-integrations.js';
import {runBuyerResearchJobs} from '../src/buyer-research-runner.js';
import {buyerRunCreditLimit,buyerCreditLimitFor,buyerCreditWindowKey,createBuyerCreditMeter,readBuyerCredits} from '../src/buyer-research-credits.js';

// 22 Nov 2026, stage 2 of the credit brake. Stage 1 counts what one Buyers run spends at Firecrawl. This file is
// about stopping: when the count of the current run window has reached what a company of this size usually needs
// (100 credits and 100 per person researched), the next Firecrawl request is not sent, the job pauses like the
// 30-minute pause does (needs review, saved work kept, "Resume buyer research"), and a resume starts a new count.
// Only requests to Firecrawl are held back: reading a page directly, saved results and the review cost no credits.
const credential={apiKey:'fixture-key',row:{metadata_json:JSON.stringify({plan_credits:100000})}};
const answer=credits=>Response.json({success:true,creditsUsed:credits,data:{web:[{url:'https://company.example/team',title:'Team',description:'People'}]}});
const limitError=error=>{assert.equal(error.code,'CREDIT_LIMIT');assert.match(error.message,/paused/i);return true;};
async function job(t){const f=await buyerJobsFixture(t),row=await startBuyerJob(f.env,workspaceId,f.users.owner,f.body),input=JSON.parse(row.input_json);return {f,row,input,key:buyerCreditWindowKey(row,input)};}
const receipts=f=>f.DB.raw.prepare("SELECT count(*) n FROM audit_events WHERE event_type='service.firecrawl_request'").get().n;

test('a meter admits requests until the count of its run window reaches the limit, earlier slices included',async t=>{
  const {f,row,key}=await job(t);
  const meter=createBuyerCreditMeter(f.env,row.id,key,{spent:150,limit:()=>200});
  meter.admit();await meter.charge({reported:49,worstCase:18});meter.admit();
  await meter.charge({reported:null,worstCase:10});
  assert.throws(()=>meter.admit(),limitError);
  assert.match((()=>{try{meter.admit();}catch(error){return error.message;}})(),/about 209 Firecrawl credits.*200/);
});

// 19-22 Nov, production receipts: every answered Buyers request reported its cost (323 of 323); the requests with
// no reported cost were the interrupted ones, 90 of 430. Counted at the worst case (10 for a page, 18 for a search)
// they would pause ordinary runs; measured live they were billed one credit each. Toward the limit they count at
// the ordinary price of their kind; the page keeps showing the worst case.
test('a request with no reported cost counts toward the limit at its ordinary price, in this slice and in the next',async t=>{
  const {f,row,key}=await job(t),meter=createBuyerCreditMeter(f.env,row.id,key,{limit:()=>12});
  for(let n=0;n<5;n++){meter.admit();await meter.charge({reported:null,worstCase:10,estimate:1});}
  meter.admit();
  const saved=(await readBuyerCredits(f.env,row.id,key)).window;
  assert.equal(saved.used,50,'The page shows the worst case');assert.equal(saved.counted,5,'The limit counts the ordinary price');
  const next=createBuyerCreditMeter(f.env,row.id,key,{spent:saved.counted,limit:()=>12});
  next.admit();await next.charge({reported:7,worstCase:18,estimate:10});
  assert.throws(()=>next.admit(),limitError);
  const interrupted=[];
  await assert.rejects(requestFirecrawl(f.env,workspaceId,'scrape',{credential,payload:{url:'https://company.example/slow'},meter:{charge:async value=>{interrupted.push(value);}},fetchImpl:async()=>{throw Error('connection reset');}}),/connection reset/);
  await assert.rejects(requestFirecrawl(f.env,workspaceId,'search',{credential,payload:{query:'q',limit:8,scrapeOptions:{formats:['markdown']}},meter:{charge:async value=>{interrupted.push(value);}},fetchImpl:async()=>{throw Error('connection reset');}}),/connection reset/);
  assert.deepEqual(interrupted,[{reported:null,worstCase:10,estimate:1},{reported:null,worstCase:18,estimate:10}]);
});

test('the limit is read when a request asks, so it grows with the people found during the run',async t=>{
  const {f,row,key}=await job(t);let people=1;
  const meter=createBuyerCreditMeter(f.env,row.id,key,{spent:250,limit:()=>buyerRunCreditLimit(people)});
  assert.throws(()=>meter.admit(),limitError);people=3;meter.admit();
});

test('a meter without a limit never refuses, and the limit callback is told once when it is reached',async t=>{
  const {f,row,key}=await job(t);
  const free=createBuyerCreditMeter(f.env,row.id,key);await free.charge({reported:5000,worstCase:18});free.admit();
  const reached=[],meter=createBuyerCreditMeter(f.env,row.id,key,{spent:10,limit:()=>10,onLimit:error=>reached.push(error.code)});
  for(let n=0;n<3;n++)assert.throws(()=>meter.admit(),limitError);
  assert.deepEqual(reached,['CREDIT_LIMIT']);
});

test('the transport sends nothing, writes no receipt and counts nothing once the meter refuses',async t=>{
  const {f,row,key}=await job(t),meter=createBuyerCreditMeter(f.env,row.id,key,{spent:200,limit:()=>200});let sent=0;
  for(const [kind,payload] of [['search',{query:'q',limit:8}],['scrape',{url:'https://company.example/team'}]])
    await assert.rejects(requestFirecrawl(f.env,workspaceId,kind,{credential,payload,meter,fetchImpl:async()=>{sent++;return answer(3);}}),limitError);
  assert.equal(sent,0);assert.equal(receipts(f),0);
  assert.equal(f.DB.raw.prepare('SELECT count(*) n FROM buyer_research_credits WHERE job_id=?').get(row.id).n,0);
});

test('a Buyers search that is refused does not turn to the AI web search instead',async t=>{
  const {f,row,key}=await job(t),meter=createBuyerCreditMeter(f.env,row.id,key,{spent:200,limit:()=>200});let sent=0,grounded=0;
  const search=createBuyerSourceSearch(f.env,workspaceId,{meter,credential:async()=>credential,fetchImpl:async()=>{sent++;return answer(3);},grounded:async()=>{grounded++;return {status:'complete',results:[]};}});
  await assert.rejects(search('people of the company'),limitError);
  assert.equal(sent,0);assert.equal(grounded,0);
});

test('a page read is refused only where it would fall back to Firecrawl; a direct read costs nothing and goes on',async t=>{
  const {f,row,key}=await job(t),{encryptSecret,importAesKey}=await import('../src/oauth.js');
  f.env.OAUTH_TOKEN_ENCRYPTION_KEY=Buffer.alloc(32,17).toString('base64');
  f.DB.raw.prepare("INSERT INTO workspace_service_integrations(workspace_id,provider,encrypted_api_key,key_hint,metadata_json) VALUES(?,'firecrawl',?,'test','{}')").run(workspaceId,await encryptSecret('controlled-firecrawl-key',await importAesKey(f.env.OAUTH_TOKEN_ENCRYPTION_KEY)));
  const meter=createBuyerCreditMeter(f.env,row.id,key,{spent:200,limit:()=>200});let firecrawl=0;
  t.mock.method(globalThis,'fetch',async input=>{
    const url=new URL(typeof input==='string'?input:input.url);
    if(url.hostname==='api.firecrawl.dev'){firecrawl++;return Response.json({success:true,creditsUsed:1,data:{markdown:'Robert Lund, Head of Procurement at Forge Industries, reachable through the switchboard.'}});}
    if(url.pathname==='/open')return new Response('<html><body><main><h1>Team</h1><p>Robert Lund is Head of Procurement at Forge Industries and buys steel for the plant.</p></main></body></html>',{headers:{'Content-Type':'text/html'}});
    return new Response('Access denied',{status:403});
  });
  const open=await readPublicBuyerPage(f.env,workspaceId,'https://forge.example/open',{meter});
  assert.match(JSON.stringify(open.data),/Robert Lund/);
  await assert.rejects(readPublicBuyerPage(f.env,workspaceId,'https://forge.example/closed',{meter}),limitError);
  assert.equal(firecrawl,0);
});

test('a lower limit can be set for one workspace to see the pause live; it never raises the limit and never applies elsewhere',()=>{
  assert.equal(buyerCreditLimitFor({},workspaceId,3),400);
  const env={BUYER_CREDIT_LIMIT_TEST:workspaceId+':40'};
  assert.equal(buyerCreditLimitFor(env,workspaceId,3),40);
  assert.equal(buyerCreditLimitFor(env,foreignWorkspaceId,3),400);
  assert.equal(buyerCreditLimitFor({BUYER_CREDIT_LIMIT_TEST:workspaceId+':9000'},workspaceId,3),400);
  for(const broken of ['',workspaceId,workspaceId+':',workspaceId+':-5',workspaceId+':abc',':40',workspaceId+':0'])assert.equal(buyerCreditLimitFor({BUYER_CREDIT_LIMIT_TEST:broken},workspaceId,3),400,broken);
});

// The runs below go through the real runner with a controlled network: every search reports 3 credits, the
// company's own pages refuse a direct read so each read falls back to Firecrawl at 1 credit.
async function controlledRun(t,{limit}={}){
  const {encryptSecret,importAesKey}=await import('../src/oauth.js');
  const {f,row,input,key}=await job(t);
  f.env.OAUTH_TOKEN_ENCRYPTION_KEY=Buffer.alloc(32,17).toString('base64');
  if(limit!==undefined)f.env.BUYER_CREDIT_LIMIT_TEST=workspaceId+':'+limit;
  f.DB.raw.prepare("INSERT INTO workspace_service_integrations(workspace_id,provider,encrypted_api_key,key_hint,metadata_json) VALUES(?,'firecrawl',?,'test','{}')").run(workspaceId,await encryptSecret('controlled-firecrawl-key',await importAesKey(f.env.OAUTH_TOKEN_ENCRYPTION_KEY)));
  const sent={search:0,scrape:0,other:0};
  t.mock.method(globalThis,'fetch',async(request,options)=>{
    const url=new URL(typeof request==='string'?request:request.url);
    if(url.hostname==='api.firecrawl.dev'&&url.pathname==='/v2/search'){sent.search++;return Response.json({success:true,creditsUsed:3,data:[{url:'https://forge.example/team',title:'Forge Industries team',description:'Robert Lund, Head of Procurement at Forge Industries'}]});}
    if(url.hostname==='api.firecrawl.dev'&&url.pathname==='/v2/scrape'){sent.scrape++;return Response.json({success:true,creditsUsed:1,data:{markdown:'## Robert Lund\n\nHead of Procurement at Forge Industries. Phone and e-mail on request through the switchboard of the company.',metadata:{sourceURL:JSON.parse(options.body).url,statusCode:200}}});}
    if(url.hostname==='forge.example')return new Response('Access denied',{status:403});
    sent.other++;throw Error('Unexpected external request in the controlled run: '+url.origin+url.pathname);
  });
  const services={dossier:async()=>({status:'complete',people:[],facts:[],channels:[],sources:[],passes:[]}),independent:async()=>({status:'not_configured',results:[]}),registry:async()=>({status:'not_found'}),review:async()=>({provider:'controlled-review',supervisor:{status:'complete',reviewedPersonIds:['robert'],findings:[]},conflicts:[]})};
  const run=()=>runBuyerResearchJobs(f.env,{jobId:row.id,maxJobs:1,windowMs:20000,services});
  const saved=()=>readBuyerJob(f.env,workspaceId,{id:row.id});
  const count=()=>f.DB.raw.prepare('SELECT window_started_at,reported+unreported used,requests FROM buyer_research_credits WHERE job_id=? ORDER BY window_started_at').all(row.id).map(entry=>({...entry}));
  return {f,row,input,key,sent,services,run,saved,count,total:()=>sent.search+sent.scrape};
}

test('a run whose window has already reached the limit sends no Firecrawl request and pauses with its phase and saved work kept',async t=>{
  const r=await controlledRun(t);
  await createBuyerCreditMeter(r.f.env,r.row.id,r.key).charge({reported:200,worstCase:18});
  const before=await r.saved();
  await r.run();
  const row=await r.saved(),diagnostics=JSON.parse(row.diagnostic_json);
  assert.equal(r.total(),0,'Nothing may be sent at Firecrawl: '+JSON.stringify(r.sent));
  assert.equal(row.status,'needs_review');assert.equal(row.phase,before.phase,'The phase is kept for the resume');
  assert.equal(diagnostics.at(-1).code,'credit_limit');assert.match(diagnostics.at(-1).reason,/200 Firecrawl credits/);
  assert.equal(r.f.DB.raw.prepare("SELECT count(*) n FROM buyer_research_tasks WHERE job_id=? AND status='failed'").get(r.row.id).n,0,'A held-back request is not a failed check');
  const view=await publicBuyerJob(r.f.env,row);
  assert.equal(view.progress.windowPaused,true);assert.match(view.progress.label,/paused/i);assert.match(view.progress.label,/Firecrawl credits/);
  await r.run();
  assert.equal(r.total(),0,'A paused job cannot silently restart');assert.equal((await r.saved()).revision,row.revision);
});

test('a run pauses in the middle once its own requests reach the limit, and the requests already answered stay counted',async t=>{
  const r=await controlledRun(t,{limit:9});
  await r.run();
  const row=await r.saved(),[count]=r.count();
  assert.equal(row.status,'needs_review');assert.equal(JSON.parse(row.diagnostic_json).at(-1).code,'credit_limit');
  assert.ok(r.total()>0,'The run must have sent requests before the limit: '+JSON.stringify(r.sent));
  assert.ok(count.used>=9,'The pause comes only at the limit: '+JSON.stringify(count));
  assert.ok(count.used<=9+3*6,'Nothing new is sent after the limit; what was already sent is counted: '+JSON.stringify({count,sent:r.sent}));
  assert.equal(count.requests,r.total());
  const sentAtPause=r.total();await r.run();assert.equal(r.total(),sentAtPause);
});

test('resume starts a new count: the paused job continues in the same phase and sends requests again',async t=>{
  const r=await controlledRun(t,{limit:9});
  await r.run();
  const paused=await r.saved(),sentAtPause=r.total();
  assert.equal(JSON.parse(paused.diagnostic_json).at(-1).code,'credit_limit');
  const url=r.f.env.APP_ORIGIN+'/api/buyers/research?workspace_id='+workspaceId,headers={Cookie:'leadintel_session='+r.f.users.owner.token,'Content-Type':'application/json'};
  await new Promise(resolve=>setTimeout(resolve,5));
  const resume=await app.fetch(new Request(url,{method:'POST',headers,body:JSON.stringify({action:'resume',jobId:r.row.id,expectedRevision:paused.revision})}),r.f.env,{});
  assert.equal(resume.status,200);const resumed=(await resume.json()).job;
  assert.equal(resumed.status,'queued');assert.equal(resumed.phase,paused.phase);assert.equal(resumed.progress.windowPaused,false);
  assert.equal(resumed.progress.credits.used,0,'The new run window has spent nothing yet');assert.ok(resumed.progress.credits.total>=9);
  await r.run();
  assert.ok(r.total()>sentAtPause,'The resumed run may spend again: '+JSON.stringify(r.sent));
  assert.equal(r.count().length,2,'One count per run window');
});

test('interrupted requests of earlier slices do not pause a run whose billed spend is far below the limit',async t=>{
  const r=await controlledRun(t);
  const earlier=createBuyerCreditMeter(r.f.env,r.row.id,r.key);
  for(let n=0;n<30;n++)await earlier.charge({reported:null,worstCase:10,estimate:1});
  await r.run();
  const row=await r.saved();
  assert.ok(r.total()>0,'300 by the worst case, 30 at the ordinary price, limit 200: '+JSON.stringify(r.sent));
  assert.ok(!JSON.parse(row.diagnostic_json).some(entry=>entry.code==='credit_limit'));
});

test('a job with no count and no limit reached runs as before',async t=>{
  const r=await controlledRun(t);
  r.f.DB.raw.prepare("UPDATE buyer_research_jobs SET input_json=json_remove(input_json,'$.executionWindowStartedAt') WHERE id=?").run(r.row.id);
  await r.run();
  const row=await r.saved();
  assert.ok(r.total()>0);assert.ok(!JSON.parse(row.diagnostic_json).some(entry=>entry.code==='credit_limit'));
});

test('a slice that needs no Firecrawl request is not paused although the count is above the limit',async t=>{
  const r=await controlledRun(t);
  await createBuyerCreditMeter(r.f.env,r.row.id,r.key).charge({reported:5000,worstCase:18});
  r.f.DB.raw.prepare("UPDATE buyer_research_jobs SET phase='review' WHERE id=?").run(r.row.id);
  await r.run();
  const row=await r.saved();
  assert.equal(r.total(),0);assert.ok(!JSON.parse(row.diagnostic_json).some(entry=>entry.code==='credit_limit'),'The review spends no Firecrawl credits: '+row.diagnostic_json);
});

test('the pause is recognised when another note follows it, and no longer after the job has been resumed',async t=>{
  const {f,row}=await job(t),at=new Date(Date.now()+1000).toISOString(),later=new Date(Date.now()+2000).toISOString();
  const pause={phase:'contacts',code:'credit_limit',reason:'Research paused after using 204 Firecrawl credits, more than the 200 a company of this size usually needs.',at};
  const set=diagnostics=>f.DB.raw.prepare("UPDATE buyer_research_jobs SET status='needs_review',phase='contacts',diagnostic_json=? WHERE id=?").run(JSON.stringify(diagnostics),row.id);
  const view=async()=>(await publicBuyerJob(f.env,await readBuyerJob(f.env,workspaceId,{id:row.id}))).progress;
  set([pause,{phase:'contacts',reason:'Phase time budget reached; saved work retained',at:later}]);
  assert.equal((await view()).windowPaused,true);assert.match((await view()).label,/204 Firecrawl credits/);
  set([pause,{phase:'contacts',code:'resumed',reason:'Resumed unfinished research',at:later},{phase:'contacts',reason:'Review remaining gaps',at:later}]);
  assert.equal((await view()).windowPaused,false);
  set([{...pause,at:new Date(Date.now()-3600000).toISOString()}]);
  f.DB.raw.prepare("UPDATE buyer_research_jobs SET input_json=json_set(input_json,'$.executionWindowStartedAt',?) WHERE id=?").run(new Date().toISOString(),row.id);
  assert.equal((await view()).windowPaused,false,'A pause of an earlier run window is history');
});

test('with a lowered limit the job view names that limit as what the run is expected to stay under',async t=>{
  const r=await controlledRun(t,{limit:9});
  await r.run();
  const credits=(await publicBuyerJob(r.f.env,await r.saved())).progress.credits;
  assert.equal(credits.expected,9);assert.ok(credits.used>=9);
});

test('a refusal that reaches the runner without its own abort still ends the slice as the pause, not as a failed check',async t=>{
  const r=await controlledRun(t);
  const refusal=()=>Object.assign(Error('Research paused after using 200 Firecrawl credits; a company of this size usually needs up to 200.'),{code:'CREDIT_LIMIT'});
  await runBuyerResearchJobs(r.f.env,{jobId:r.row.id,maxJobs:1,windowMs:20000,services:{...r.services,search:async()=>{throw refusal();},read:async()=>{throw refusal();}}});
  const row=await r.saved(),diagnostics=JSON.parse(row.diagnostic_json);
  assert.equal(row.status,'needs_review');assert.equal(diagnostics.at(-1).code,'credit_limit');
  assert.equal(r.f.DB.raw.prepare("SELECT count(*) n FROM buyer_research_tasks WHERE job_id=? AND status='failed'").get(r.row.id).n,0);
});

test('the one-time recovery of old interrupted jobs leaves a job alone whose last note is the credit pause',async t=>{
  const {recoverInterruptedContactJob}=await import('../src/buyer-research-store.js');
  const {f,row,input}=await job(t);
  const stale=diagnostics=>f.DB.raw.prepare("UPDATE buyer_research_jobs SET status='needs_review',phase='done',lease_token=NULL,lease_until=0,diagnostic_json=?,input_json=json_set(json_remove(input_json,'$.contactSourceScope'),'$.contactContinuationVersion',0),result_json=? WHERE id=?").run(JSON.stringify(diagnostics),JSON.stringify({...input.candidate,buyerDiscovery:{officialContactInventory:{research:{status:'partial',discoveryScope:'old'}}}}),row.id);
  stale([{phase:'contacts',code:'credit_limit',reason:'Research paused after using 204 Firecrawl credits; a company of this size usually needs up to 200.',at:new Date().toISOString()}]);
  assert.equal(await recoverInterruptedContactJob(f.env,{jobId:row.id}),null);
  assert.equal((await readBuyerJob(f.env,workspaceId,{id:row.id})).status,'needs_review');
  stale([{phase:'contacts',reason:'Phase time budget reached; saved work retained',at:new Date().toISOString()}]);
  assert.ok(await recoverInterruptedContactJob(f.env,{jobId:row.id}),'The same job without the pause is one the recovery picks up, so the pause is what held it back');
});

// From the adversarial review of 22 Nov (each was a failing test against the first version).
test('a pause at the first request of a later official slice keeps the official phase, and resume continues there',async t=>{
  const r=await controlledRun(t);
  r.f.DB.raw.prepare("UPDATE buyer_research_jobs SET phase='official',phase_runs=2 WHERE id=?").run(r.row.id);
  await createBuyerCreditMeter(r.f.env,r.row.id,r.key).charge({reported:200,worstCase:18});
  await r.run();
  const paused=await r.saved(),diagnostics=JSON.parse(paused.diagnostic_json);
  assert.equal(r.total(),0);assert.equal(diagnostics.at(-1).code,'credit_limit','The pause is the last note: '+paused.diagnostic_json);
  assert.equal(paused.phase,'official','The pause must keep the phase it stopped in');
  await new Promise(resolve=>setTimeout(resolve,5));
  const url=r.f.env.APP_ORIGIN+'/api/buyers/research?workspace_id='+workspaceId,headers={Cookie:'leadintel_session='+r.f.users.owner.token,'Content-Type':'application/json'};
  const resume=await app.fetch(new Request(url,{method:'POST',headers,body:JSON.stringify({action:'resume',jobId:r.row.id,expectedRevision:paused.revision})}),r.f.env,{});
  assert.equal((await resume.json()).job.phase,'official');
});

test('the page check of a published address in the paid phase is counted in the job\'s window; it is one page per buyer and is not held back',async t=>{
  const {paidCandidate}=await import('./paid-candidate-fixture.mjs'),{controlledLookup}=await import('./paid-lookup-fixture.mjs'),{upsertCrmCompany,upsertCrmIntelligence}=await import('../src/crm.js'),{createRequire}=await import('node:module'),{encryptSecret,importAesKey}=await import('../src/oauth.js');
  const require=createRequire(import.meta.url),Crm=require('../../customer/crm-engine.js'),D=require('../../customer/discovery-engine.js'),withReceipts=require('../../customer/test/helpers/buyer-research-receipts.cjs');
  const f=await buyerJobsFixture(t),c=paidCandidate();
  for(const person of c.people){person.publicEmail=person.name.toLowerCase().replace(/ /g,'.')+'@forge.example';person.publicEmailUrl='https://forge.example/team';}
  withReceipts(c);c.publicResearch.aiReview={...c.publicResearch.aiReview,inputSignature:D.buyerReviewSignature(c)};
  const context={workspaceId,userId:f.users.owner.id,role:'owner'},company=(await upsertCrmCompany(f.env.DB,context,{company:c.company,domain:c.domain})).company;c.crmId=company.id;await upsertCrmIntelligence(f.env.DB,context,c.crmId,Crm.mapDiscoveryCandidateToCrm(c).intelligence);
  f.DB.raw.prepare("INSERT INTO additional_contact_policies(workspace_id,enabled,phone_enabled,provider,daily_limit,monthly_limit,max_per_company,approved_by,automatic_buyer_limit) VALUES(?,1,1,'treg',10,100,2,?,1)").run(workspaceId,f.users.owner.id);
  const started=await startBuyerJob(f.env,workspaceId,f.users.owner,{candidate:c,paidResearch:true});f.DB.raw.prepare("UPDATE buyer_research_jobs SET phase='paid',result_json=? WHERE id=?").run(JSON.stringify(c),started.id);
  f.env.OAUTH_TOKEN_ENCRYPTION_KEY=Buffer.alloc(32,17).toString('base64');
  f.DB.raw.prepare("INSERT INTO workspace_service_integrations(workspace_id,provider,encrypted_api_key,key_hint,metadata_json) VALUES(?,'firecrawl',?,'test','{}')").run(workspaceId,await encryptSecret('controlled-firecrawl-key',await importAesKey(f.env.OAUTH_TOKEN_ENCRYPTION_KEY)));
  const row=await readBuyerJob(f.env,workspaceId,{id:started.id}),key=buyerCreditWindowKey(row,JSON.parse(row.input_json));
  await createBuyerCreditMeter(f.env,started.id,key).charge({reported:5000,worstCase:18});
  const firecrawl=[];
  t.mock.method(globalThis,'fetch',async(request,options)=>{
    const url=new URL(typeof request==='string'?request:request.url);
    if(url.hostname==='api.firecrawl.dev'){firecrawl.push(JSON.parse(options.body).url);return Response.json({success:true,creditsUsed:1,data:{markdown:'Team page without addresses',metadata:{sourceURL:JSON.parse(options.body).url,statusCode:200}}});}
    if(url.hostname==='forge.example')return new Response('Access denied',{status:403});
    throw Error('Unexpected external request in the controlled paid phase: '+url.href);
  });
  const paidLookup=await controlledLookup(f,[]);
  for(let n=0;n<3;n++)await runBuyerResearchJobs(f.env,{jobId:started.id,maxJobs:1,windowMs:3000,services:{paidLookup}});
  const after=await readBuyerJob(f.env,workspaceId,{id:started.id}),count=(await readBuyerCredits(f.env,started.id,key)).window;
  assert.ok(firecrawl.length>=1&&firecrawl.length<=c.people.length,'One page check per buyer with a published address: '+JSON.stringify(firecrawl));
  assert.equal(count.requests,1+firecrawl.length,'Each of those requests is in the count: '+JSON.stringify(count));
  assert.equal(count.reported,5000+firecrawl.length);
  assert.ok(!JSON.parse(after.diagnostic_json).some(entry=>entry.code==='credit_limit'),'The paid phase is not paused by it: '+after.diagnostic_json);
});

test('the view calls a run "above expected" by the same count that pauses it, not by the worst case',async t=>{
  const {f,row,key}=await job(t),meter=createBuyerCreditMeter(f.env,row.id,key);
  await meter.charge({reported:100,worstCase:18});
  for(let n=0;n<19;n++)await meter.charge({reported:null,worstCase:10,estimate:1});
  f.DB.raw.prepare("UPDATE buyer_research_jobs SET phase='contacts' WHERE id=?").run(row.id);
  const credits=(await publicBuyerJob(f.env,await readBuyerJob(f.env,workspaceId,{id:row.id}))).progress.credits;
  assert.equal(credits.used,290,'The page still shows the worst case');assert.equal(credits.expected,200);
  assert.equal(credits.aboveExpected,false,'119 counted toward a limit of 200');
});

// 22 Nov live (Midtjydsk Beton, limit lowered to 30): a run window counted 30 credits where Firecrawl billed 93.
// Seventeen page reads had been interrupted and counted at one credit each; six of them were PDF files of the
// company's site, which are billed per page up to the page limit.
test('an interrupted read of a PDF address counts toward the limit at its page limit, any other page at one credit',async t=>{
  const {f}=await job(t),charges=[],meter={charge:async value=>{charges.push(value);}};
  const interrupted=url=>assert.rejects(requestFirecrawl(f.env,workspaceId,'scrape',{credential,payload:{url},meter,fetchImpl:async()=>{throw Error('connection reset');}}),/connection reset/);
  await interrupted('https://company.example/wp-content/uploads/2025/04/EPD_901412-beton.pdf');
  await interrupted('https://company.example/files/Leverand%C3%B8rvejledning.PDF?download=1');
  await interrupted('https://company.example/docs/guide.pdf#page=2');
  await interrupted('https://company.example/om-os');
  await interrupted('https://company.example/pdf-guides/');
  assert.deepEqual(charges.map(charge=>[charge.worstCase,charge.estimate]),[[10,10],[10,10],[10,10],[10,1],[10,1]]);
});
