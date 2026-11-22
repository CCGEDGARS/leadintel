import test from 'node:test';
import assert from 'node:assert/strict';
import {buyerJobsFixture,workspaceId} from './buyer-research-jobs-fixture.mjs';
import {startBuyerJob} from '../src/buyer-research-store.js';
import {requestFirecrawl,firecrawlRequestCeiling} from '../src/firecrawl-request.js';
import {createBuyerSourceSearch} from '../src/buyer-source-search.js';
import {buyerRunCreditLimit,buyerCreditWindowKey,createBuyerCreditMeter,readBuyerCredits} from '../src/buyer-research-credits.js';

// 21 Nov 2026: one Buyers run for one small company spent about 2,700 Firecrawl credits; about 150 had been
// announced, and the platform's own receipts saw 1,151 of them. Before anything can stop a run, the run has to be
// counted where the requests are sent: per job, per explicit start or resume, with requests whose cost Firecrawl
// did not report counted at the most they can cost. Counting only; nothing in this file stops a job.
const credential={apiKey:'fixture-key',row:{metadata_json:JSON.stringify({plan_credits:100000})}};
const answer=credits=>Response.json({success:true,data:{web:[{url:'https://company.example/team',title:'Team',description:'People'}]},...(credits===undefined?{}:{creditsUsed:credits})});
const counted=(f,jobId)=>f.DB.raw.prepare('SELECT window_started_at,reported,unreported,requests,unreported_requests FROM buyer_research_credits WHERE job_id=? ORDER BY window_started_at').all(jobId).map(row=>({...row}));
async function job(t){const f=await buyerJobsFixture(t),row=await startBuyerJob(f.env,workspaceId,f.users.owner,f.body),input=JSON.parse(row.input_json);return {f,row,input,key:buyerCreditWindowKey(row,input)};}

test('the expected ceiling of one run grows with the people researched: 100 credits and 100 per person, one to ten people',()=>{
  assert.deepEqual([0,1,2,3,10,25,undefined,'x'].map(buyerRunCreditLimit),[200,200,300,400,1100,1100,200,200]);
});

test('the worst case of one request follows the page limits the transport sets',()=>{
  assert.equal(firecrawlRequestCeiling('search',{query:'q',limit:8}),2);
  assert.equal(firecrawlRequestCeiling('search',{query:'q',limit:8,scrapeOptions:{formats:['markdown'],parsers:[{type:'pdf',maxPages:2},'image']}}),18);
  assert.equal(firecrawlRequestCeiling('search',{query:'q',limit:25,scrapeOptions:{formats:['markdown'],parsers:[{type:'pdf',maxPages:2},'image']}}),56);
  assert.equal(firecrawlRequestCeiling('scrape',{url:'https://company.example/a.pdf',parsers:[{type:'pdf',maxPages:10},'image']}),10);
  assert.equal(firecrawlRequestCeiling('scrape',{url:'https://company.example/a.pdf',parsers:[]}),1);
});

test('the window of a count is the explicit start or resume of the job',async t=>{
  const {row,input,key}=await job(t);
  assert.equal(key,input.executionWindowStartedAt);assert.ok(Number.isFinite(Date.parse(key)));
  assert.equal(buyerCreditWindowKey({created_at:'2026-11-22 01:02:03'},{}),'2026-11-22 01:02:03');
  assert.equal(buyerCreditWindowKey(row,{...input,executionWindowStartedAt:'2026-11-22T10:00:00.000Z'}),'2026-11-22T10:00:00.000Z');
});

test('a meter adds reported credits and, apart from them, the worst case of requests with no reported cost',async t=>{
  const {f,row,key}=await job(t),meter=createBuyerCreditMeter(f.env,row.id,key);
  await meter.charge({reported:7,worstCase:18});await meter.charge({reported:null,worstCase:18});await meter.charge({reported:0,worstCase:2});
  assert.deepEqual(counted(f,row.id),[{window_started_at:key,reported:7,unreported:18,requests:3,unreported_requests:1}]);
  const later=createBuyerCreditMeter(f.env,row.id,'2026-11-23T08:00:00.000Z');await later.charge({reported:5,worstCase:10});
  const read=await readBuyerCredits(f.env,row.id,key);
  assert.deepEqual(read.window,{reported:7,unreported:18,requests:3,unreportedRequests:1,used:25});
  assert.deepEqual(read.total,{reported:12,unreported:18,requests:4,unreportedRequests:1,used:30});
  assert.deepEqual((await readBuyerCredits(f.env,row.id,'never-started')).window,{reported:0,unreported:0,requests:0,unreportedRequests:0,used:0});
});

test('a count that could not be written goes in with the next one, or when the slice ends',async t=>{
  const {f,row,key}=await job(t);let fail=true;
  const flaky={DB:{prepare(sql){if(fail&&/buyer_research_credits/.test(sql))return {bind(){return this;},async run(){throw Error('D1 unavailable');}};return f.env.DB.prepare(sql);}}};
  const meter=createBuyerCreditMeter(flaky,row.id,key);
  await meter.charge({reported:4,worstCase:18});assert.deepEqual(counted(f,row.id),[]);
  fail=false;await meter.charge({reported:null,worstCase:10});
  assert.deepEqual(counted(f,row.id),[{window_started_at:key,reported:4,unreported:10,requests:2,unreported_requests:1}]);
  fail=true;await meter.charge({reported:6,worstCase:18});fail=false;await meter.flush();await meter.flush();
  assert.deepEqual(counted(f,row.id),[{window_started_at:key,reported:10,unreported:10,requests:3,unreported_requests:1}]);
});

test('the transport tells the meter what each sent request cost, and nothing for a request that was not sent or not billed',async t=>{
  const {f,row,key}=await job(t),charges=[],meter={charge:async value=>{charges.push(value);}};
  const reading={query:'q',limit:8,scrapeOptions:{formats:['markdown']}};
  await requestFirecrawl(f.env,workspaceId,'search',{credential,payload:reading,meter,fetchImpl:async()=>answer(7)});
  await requestFirecrawl(f.env,workspaceId,'search',{credential,payload:reading,meter,fetchImpl:async()=>answer()});
  await assert.rejects(requestFirecrawl(f.env,workspaceId,'scrape',{credential,payload:{url:'https://company.example/team'},meter,fetchImpl:async()=>{throw Error('connection reset');}}),/connection reset/);
  assert.deepEqual(charges,[{reported:7,worstCase:18},{reported:null,worstCase:18},{reported:null,worstCase:10}]);
  charges.length=0;
  // 22 Nov live: three page reads that Firecrawl answered with an error and one the platform gave up on were
  // counted at 40 credits; the balance fell by one. Firecrawl bills a returned document, so an error answer costs
  // nothing unless it reports a cost itself; only the request nobody waited for stays unknown.
  await requestFirecrawl(f.env,workspaceId,'search',{credential,payload:{query:'q',limit:8},meter,fetchImpl:async()=>Response.json({success:false,error:'Internal error'},{status:500})});
  await requestFirecrawl(f.env,workspaceId,'scrape',{credential,payload:{url:'https://company.example/blocked'},meter,fetchImpl:async()=>Response.json({success:false,error:'This website is not supported'},{status:403})});
  await requestFirecrawl(f.env,workspaceId,'scrape',{credential,payload:{url:'https://company.example/soft'},meter,fetchImpl:async()=>Response.json({success:false,error:'Scrape failed'})});
  assert.deepEqual(charges,[],'An error answer without a reported cost is not billed');
  await requestFirecrawl(f.env,workspaceId,'scrape',{credential,payload:{url:'https://company.example/billed'},meter,fetchImpl:async()=>Response.json({success:false,error:'Scrape failed after the check',creditsUsed:5},{status:500})});
  assert.deepEqual(charges,[{reported:5,worstCase:10}],'A cost the error answer reports is counted');
  charges.length=0;
  await requestFirecrawl(f.env,workspaceId,'search',{credential,payload:reading,meter,fetchImpl:async()=>Response.json({error:'Payment required'},{status:402})});
  await requestFirecrawl(f.env,workspaceId,'search',{credential,payload:reading,meter,fetchImpl:async()=>Response.json({error:'Rate limit'},{status:429,headers:{'Retry-After':'1'}})});
  assert.deepEqual(charges,[],'A refused request is not billed');
  const real=createBuyerCreditMeter(f.env,row.id,key);
  await requestFirecrawl(f.env,workspaceId,'scrape',{credential,payload:{url:'https://company.example/contact'},meter:real,fetchImpl:async()=>Response.json({success:true,data:{markdown:'Contact page'},creditsUsed:1})});
  assert.deepEqual(counted(f,row.id),[{window_started_at:key,reported:1,unreported:0,requests:1,unreported_requests:0}]);
});

test('a meter that fails never breaks the request it counts',async t=>{
  const {f}=await job(t),meter={charge:async()=>{throw Error('meter broken');}};
  const response=await requestFirecrawl(f.env,workspaceId,'search',{credential,payload:{query:'q',limit:8},meter,fetchImpl:async()=>answer(2)});
  assert.equal(response.status,200);assert.equal((await response.json()).creditsUsed,2);
});

test('the Buyers search hands its meter to every Firecrawl request it sends',async t=>{
  const {f,row,key}=await job(t),meter=createBuyerCreditMeter(f.env,row.id,key);
  const search=createBuyerSourceSearch(f.env,workspaceId,{meter,credential:async()=>credential,fetchImpl:async()=>answer(6),grounded:async()=>assert.fail('A search with results needs no fallback')});
  await search('people of the company');await search('"Robert Lund" "Forge Industries" email',{limit:5});
  assert.deepEqual(counted(f,row.id),[{window_started_at:key,reported:12,unreported:0,requests:2,unreported_requests:0}]);
});

test('a running Buyers job counts its own searches and the page reads that fall back to Firecrawl, in its run window',async t=>{
  const {runBuyerResearchJobs}=await import('../src/buyer-research-runner.js'),{encryptSecret,importAesKey}=await import('../src/oauth.js');
  const {f,row,key}=await job(t);
  f.env.OAUTH_TOKEN_ENCRYPTION_KEY=Buffer.alloc(32,17).toString('base64');
  const encrypted=await encryptSecret('controlled-firecrawl-key',await importAesKey(f.env.OAUTH_TOKEN_ENCRYPTION_KEY));
  f.DB.raw.prepare("INSERT INTO workspace_service_integrations(workspace_id,provider,encrypted_api_key,key_hint,metadata_json) VALUES(?,'firecrawl',?,'test','{}')").run(workspaceId,encrypted);
  const sent={search:0,scrape:0};
  t.mock.method(globalThis,'fetch',async(input,options)=>{
    const url=new URL(typeof input==='string'?input:input.url);
    if(url.hostname==='api.firecrawl.dev'&&url.pathname==='/v2/search'){sent.search++;return Response.json({success:true,creditsUsed:3,data:[{url:'https://forge.example/team',title:'Forge Industries team',description:'Robert Lund, Head of Procurement at Forge Industries'}]});}
    if(url.hostname==='api.firecrawl.dev'&&url.pathname==='/v2/scrape'){sent.scrape++;return Response.json({success:true,creditsUsed:1,data:{markdown:'## Robert Lund\n\nHead of Procurement at Forge Industries. Phone and e-mail on request through the switchboard of the company.',metadata:{sourceURL:JSON.parse(options.body).url,statusCode:200}}});}
    // The company's own pages refuse a direct read, so each read falls back to Firecrawl.
    if(url.hostname==='forge.example')return new Response('Access denied',{status:403});
    throw Error('Unexpected external request in the controlled run: '+url.origin+url.pathname);
  });
  const services={dossier:async()=>({status:'complete',people:[],facts:[],channels:[],sources:[],passes:[]}),independent:async()=>({status:'not_configured',results:[]}),registry:async()=>({status:'not_found'}),review:async()=>({provider:'controlled-review',supervisor:{status:'complete',reviewedPersonIds:['robert'],findings:[]},conflicts:[]})};
  await runBuyerResearchJobs(f.env,{jobId:row.id,maxJobs:1,windowMs:20000,services});
  assert.ok(sent.search>0&&sent.scrape>0,'The controlled run must send searches and fall back to Firecrawl for a page: '+JSON.stringify(sent));
  assert.deepEqual(counted(f,row.id),[{window_started_at:key,reported:3*sent.search+sent.scrape,unreported:0,requests:sent.search+sent.scrape,unreported_requests:0}]);
});

test('the job view shows what the current run window has spent and what a run of this size is expected to stay under',async t=>{
  const {readBuyerJob,publicBuyerJob}=await import('../src/buyer-research-store.js');
  const {f,row,key}=await job(t);
  await createBuyerCreditMeter(f.env,row.id,'2026-11-01T08:00:00.000Z').charge({reported:100,worstCase:18});
  const meter=createBuyerCreditMeter(f.env,row.id,key);await meter.charge({reported:240,worstCase:18});await meter.charge({reported:null,worstCase:18});
  const view=await publicBuyerJob(f.env,await readBuyerJob(f.env,workspaceId,{id:row.id}));
  // The job has just started (no people researched yet), so nothing is called "above expected" so far.
  assert.deepEqual(view.progress.credits,{used:258,reported:240,unreported:18,requests:2,unreportedRequests:1,expected:200,aboveExpected:false,total:358,totalUnreported:18,totalUnreportedRequests:1});
  f.DB.raw.prepare("UPDATE buyer_research_jobs SET phase='contacts' WHERE id=?").run(row.id);
  assert.equal((await publicBuyerJob(f.env,await readBuyerJob(f.env,workspaceId,{id:row.id}))).progress.credits.aboveExpected,true);
});

test('a job view whose count cannot be read carries no count and is still served',async t=>{
  const {readBuyerJob,publicBuyerJob}=await import('../src/buyer-research-store.js');
  const {f,row}=await job(t),saved=await readBuyerJob(f.env,workspaceId,{id:row.id});
  const broken={...f.env,DB:{...f.env.DB,prepare(sql){if(/FROM buyer_research_credits/.test(sql))return {bind(){return this;},async all(){throw Error('no such table: buyer_research_credits');}};return f.env.DB.prepare(sql);},batch:f.env.DB.batch?.bind(f.env.DB)}};
  const view=await publicBuyerJob(broken,saved);
  assert.equal(view.progress.credits,null);assert.equal(view.id,row.id);
});

test('after a resume the view still carries everything the job has spent, and the expected spend follows the people this run researches',async t=>{
  const {readBuyerJob,publicBuyerJob}=await import('../src/buyer-research-store.js');
  const {f,row,input,key}=await job(t),meter=createBuyerCreditMeter(f.env,row.id,key);
  for(let n=0;n<3;n++)await meter.charge({reported:900,worstCase:18});
  const people=Array.from({length:10},(_,n)=>({id:'p'+n,name:'Person '+n,publicName:'Person '+n,title:'Buyer',organization:'Forge Industries',kept:true}));
  const resumedAt=new Date(Date.now()+1000).toISOString();
  f.DB.raw.prepare("UPDATE buyer_research_jobs SET phase='contacts',input_json=?,result_json=? WHERE id=?").run(JSON.stringify({...input,executionWindowStartedAt:resumedAt,scope:'selected_buyers',personIds:['p1']}),JSON.stringify({...input.candidate,people}),row.id);
  const credits=(await publicBuyerJob(f.env,await readBuyerJob(f.env,workspaceId,{id:row.id}))).progress.credits;
  assert.equal(credits.used,0,'The new run window has spent nothing yet');assert.equal(credits.total,2700);
  assert.equal(credits.expected,200,'One selected person, not the ten on the roster');assert.equal(credits.aboveExpected,false);
  f.DB.raw.prepare("UPDATE buyer_research_jobs SET input_json=json_set(input_json,'$.scope','all_buyers') WHERE id=?").run(row.id);
  assert.equal((await publicBuyerJob(f.env,await readBuyerJob(f.env,workspaceId,{id:row.id}))).progress.credits.expected,1100);
});
