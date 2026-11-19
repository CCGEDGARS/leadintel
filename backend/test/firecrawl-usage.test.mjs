import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {DatabaseSync} from 'node:sqlite';
import {requestFirecrawl,reportedFirecrawlCredits,FIRECRAWL_RECEIPT_EVENT} from '../src/firecrawl-request.js';
import {readFirecrawlUsage,isFirecrawlUsageQuestion,firecrawlUsageAnswer,firecrawlUsageWindow} from '../src/firecrawl-usage.js';
import {providerCreditIssue} from '../src/provider-credit-health.js';
import {runCopilotTurn,shouldUseExternalResearch} from '../src/copilot-service.js';
import {needsDeepCopilotResearch} from '../src/copilot-research-jobs.js';

function fixture(t){
  const raw=new DatabaseSync(':memory:');t.after(()=>raw.close());
  raw.exec("CREATE TABLE audit_events(id TEXT PRIMARY KEY,workspace_id TEXT,user_id TEXT,event_type TEXT,entity_type TEXT,entity_id TEXT,metadata_json TEXT,created_at TEXT DEFAULT CURRENT_TIMESTAMP); CREATE TABLE workspace_service_integrations(workspace_id TEXT,provider TEXT,metadata_json TEXT,verified_at TEXT);"+fs.readFileSync(new URL('../migrations/0049_firecrawl_rate_gate.sql',import.meta.url),'utf8'));
  const DB={raw,prepare(sql){
    let args=[];
    return {bind(...values){args=values;return this;},async first(){return raw.prepare(sql).get(...args)||null;},async all(){return {results:raw.prepare(sql).all(...args)};},async run(){return {meta:{changes:Number(raw.prepare(sql).run(...args).changes)}};}};
  }};
  return {env:{DB},raw,credential:{apiKey:'NEVER_EXPOSE_CUSTOMER_KEY',row:{metadata_json:JSON.stringify({plan_credits:1000})}}};
}
const result=credits=>Response.json({success:true,data:{web:[{url:'https://example.test/team',markdown:'Public team details'}]},...(credits===undefined?{}:{creditsUsed:credits})});
test('all concurrent callers share the workspace gate; held requests do not reach Firecrawl or acquire billed credits',async t=>{
  const {env,credential}=fixture(t);let calls=0;
  const responses=await Promise.all(Array.from({length:12},(_,i)=>requestFirecrawl(env,'one','search',{credential,payload:{query:'PRIVATE_QUERY_'+i,limit:8,scrapeOptions:{formats:['markdown']}},purpose:i%2?'assistant_research':'company_list',fetchImpl:async()=>{calls++;return result(10);}})));
  assert.equal(calls,10);assert.equal(responses.filter(r=>r.status===429).length,2);
  const report=await readFirecrawlUsage(env,'one');assert.equal(report.available,true);assert.equal(report.selected.requests,10);assert.equal(report.selected.localBlocks,2);assert.equal(report.selected.reportedCredits,100);assert.equal(report.selected.estimatedCredits,100);assert.equal(report.selected.unreportedRequests,0);
  assert.doesNotMatch(JSON.stringify(report),/PRIVATE_QUERY|NEVER_EXPOSE|example\.test/);
});
test('receipts distinguish measured, missing and zero credit amounts, failures and deliberate repeats without leaking inputs',async t=>{
  const {env,credential,raw}=fixture(t);let calls=0;const payload={query:'PRIVATE_QUERY_WITH_PERSON',limit:4};
  for(const credits of [2,undefined,0])await requestFirecrawl(env,'one','search',{credential,payload,purpose:'buyer_research',fetchImpl:async()=>{calls++;return result(credits);}});
  await requestFirecrawl(env,'other','search',{credential,payload,fetchImpl:async()=>result(999)});
  await assert.rejects(requestFirecrawl(env,'one','scrape',{credential,payload:{url:'https://private-company.example/source?token=PRIVATE_TOKEN'},fetchImpl:async()=>{calls++;throw Error('PRIVATE_ERROR');}}),/PRIVATE_ERROR/);
  const report=await readFirecrawlUsage(env,'one');assert.equal(calls,4);assert.equal(report.selected.requests,4);assert.equal(report.selected.reportedCredits,2);assert.equal(report.selected.reportedRequests,2);assert.equal(report.selected.unreportedRequests,2);assert.equal(report.selected.repeatedRequests,2);assert.equal(report.selected.failed,1);
  assert.doesNotMatch(JSON.stringify(raw.prepare('SELECT metadata_json FROM audit_events').all()),/PRIVATE_|NEVER_EXPOSE|private-company/);
  const answer=firecrawlUsageAnswer(report);assert.match(answer,/total charge is unknown/);assert.match(answer,/does not prove a retry bug/);assert.doesNotMatch(answer,/999/);
});
test('402 is a confirmed credit issue, a bare 429 is not, and neither is retried by the transport',async t=>{
  const {env,credential}=fixture(t);let calls=0;
  await requestFirecrawl(env,'empty','search',{credential,payload:{query:'q'},fetchImpl:async()=>{calls++;return Response.json({error:'Payment required'},{status:402});}});
  assert.equal((await providerCreditIssue(env,'empty','firecrawl')).code,'credits_exhausted');
  await requestFirecrawl(env,'rate','search',{credential,payload:{query:'q'},fetchImpl:async()=>{calls++;return Response.json({error:'Too many requests'},{status:429,headers:{'Retry-After':'60'}});}});
  assert.equal(await providerCreditIssue(env,'rate','firecrawl'),null);
  const held=await requestFirecrawl(env,'rate','search',{credential,payload:{query:'q'},fetchImpl:async()=>assert.fail('The shared upstream hold must prevent a repeated provider call')});
  assert.equal(held.status,429);assert.equal(calls,2);assert.equal((await readFirecrawlUsage(env,'empty')).selected.creditFailures,1);
});
test('cancelled work never calls Firecrawl and unknown metadata cannot manufacture a balance or billed credits',async t=>{
  const {env,credential}=fixture(t);const controller=new AbortController();controller.abort(Error('Stopped'));
  await assert.rejects(requestFirecrawl(env,'one','search',{credential,signal:controller.signal,fetchImpl:async()=>assert.fail('Canceled request')}),/Stopped/);
  for(const value of [null,undefined,'',true,-1,'unknown'])assert.equal(reportedFirecrawlCredits({creditsUsed:value}),null);
  assert.equal(reportedFirecrawlCredits({data:{metadata:{creditsUsed:0}}}),0);
  const missing=await readFirecrawlUsage({DB:{prepare(){throw Error('PRIVATE_DATABASE_ERROR');}}},'one');assert.equal(missing.available,false);assert.match(firecrawlUsageAnswer(missing),/cannot determine/);assert.doesNotMatch(JSON.stringify(missing),/PRIVATE_DATABASE/);
  const empty=await readFirecrawlUsage(env,'one');assert.equal(empty.balance.remainingCredits,null);assert.match(firecrawlUsageAnswer(empty),/does not prove zero usage/);
});
test('Firecrawl support is scoped, dated and uses no AI, search or deep-research job even when a dashboard link is supplied',async t=>{
  const {env,credential,raw}=fixture(t);
  await requestFirecrawl(env,'one','search',{credential,payload:{query:'q'},fetchImpl:async()=>result(2)});
  raw.prepare("INSERT INTO workspace_service_integrations VALUES('one','firecrawl',?,?)").run(JSON.stringify({remaining_credits:0,credits_checked_at:'2026-11-17T10:00:00Z'}),'2026-11-17T09:00:00Z');
  const question='Firecrawl spent all free credits in 10 minutes. Check https://www.firecrawl.dev/app for duplicate requests.';
  assert.equal(isFirecrawlUsageQuestion(question),true);assert.equal(shouldUseExternalResearch({question}),false);assert.equal(needsDeepCopilotResearch(question),false);
  const turn=await runCopilotTurn({...env,COPILOT_TEST_PROVIDER:{generate:async()=>assert.fail('Support must not spend AI credits'),search:async()=>assert.fail('Support must not spend search credits')}},{workspaceId:'one',question});
  assert.equal(turn.model_calls,0);assert.equal(turn.search_calls,0);assert.equal(turn.research_used,false);assert.equal(turn.firecrawl_usage.selected.requests,1);assert.match(turn.answer,/Last saved balance: 0 credits/);assert.equal(turn.firecrawl_usage.balance.checkedAt,'2026-11-17T10:00:00.000Z');assert.match(turn.answer,/not a live balance/);assert.deepEqual(turn.action_proposals,[]);
  assert.equal(isFirecrawlUsageQuestion('How many credits did it use?', [{role:'user',content:'Firecrawl is connected'}]),true);assert.equal(isFirecrawlUsageQuestion('OpenAI credits ran out',[{role:'user',content:'Firecrawl is connected'}]),false);
  assert.equal(isFirecrawlUsageQuestion('What is the current price to buy 10000 Firecrawl credits?'),false);
  assert.equal(shouldUseExternalResearch({question:'What is the current price to buy 10000 Firecrawl credits?'}),true);
  const other=await runCopilotTurn(env,{workspaceId:'other',question});assert.equal(other.firecrawl_usage.selected.requests,0);assert.equal(other.firecrawl_usage.balance.remainingCredits,null);
});
test('dated investigation uses the requested UTC day and does not present newer events as historical charges',async t=>{
  const {env,credential,raw}=fixture(t);
  await requestFirecrawl(env,'one','search',{credential,payload:{query:'q'},fetchImpl:async()=>result(3)});
  const now=Date.now(),day=new Date(now-2*86400000).toISOString().slice(0,10);
  const report=await readFirecrawlUsage(env,'one',{question:'Firecrawl credits on '+day,now});assert.equal(report.selected.requests,0);assert.equal(report.last24Hours.requests,1);
  raw.prepare('UPDATE audit_events SET created_at=? WHERE event_type=?').run(day+'T12:00:00Z',FIRECRAWL_RECEIPT_EVENT);
  assert.equal((await readFirecrawlUsage(env,'one',{question:'Firecrawl credits on '+day,now})).selected.reportedCredits,3);
  assert.equal(firecrawlUsageWindow('last 9999 days',now).from,now-30*86400000);
});
test('every metered backend Firecrawl call uses the shared audited transport',()=>{
  for(const file of fs.readdirSync(new URL('../src/',import.meta.url)).filter(f=>f.endsWith('.js'))){const text=fs.readFileSync(new URL('../src/'+file,import.meta.url),'utf8');if(file!=='firecrawl-request.js')assert.doesNotMatch(text,/(?:fetch|fetchImpl)\(['"`]https:\/\/api\.firecrawl\.dev\/v2\/(?:scrape|search)/,file);}
});
