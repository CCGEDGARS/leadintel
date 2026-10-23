import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {D1Fixture} from './writing-reference-fixture.mjs';
import {FIRECRAWL_WINDOW_MS,FIRECRAWL_DEFAULT_RETRY_AFTER_MS,FIRECRAWL_MAX_RETRY_AFTER_MS,firecrawlPlanLimits,firecrawlPlanFromRow,reserveFirecrawlRequest,recordFirecrawlRateLimit,parseRetryAfterMs,acquireFirecrawlSlot} from '../src/firecrawl-rate-gate.js';

function env(){const DB=new D1Fixture();DB.raw.exec(fs.readFileSync(new URL('../migrations/0049_firecrawl_rate_gate.sql',import.meta.url),'utf8'));return {DB};}
const T0=Date.parse('2026-10-23T12:00:00Z');

test('plan limits follow the Firecrawl rate-limit table by the largest plan allotment at or below the reported credits; unknown plans get no proactive limit',()=>{
  assert.equal(firecrawlPlanLimits(0),null);assert.equal(firecrawlPlanLimits(undefined),null);assert.equal(firecrawlPlanLimits('x'),null);
  assert.deepEqual([firecrawlPlanLimits(1000).name,firecrawlPlanLimits(1000).search,firecrawlPlanLimits(1000).scrape],['Free',10,10]);
  assert.deepEqual([firecrawlPlanLimits(500).name,firecrawlPlanLimits(1500).name,firecrawlPlanLimits(3000).name],['Free','Free','Free'],'a topped-up or legacy allotment below Hobby keeps Free limits');
  assert.deepEqual([firecrawlPlanLimits(5000).name,firecrawlPlanLimits(5000).search,firecrawlPlanLimits(7000).name],['Hobby',100,'Hobby']);
  assert.deepEqual([firecrawlPlanLimits(100000).name,firecrawlPlanLimits(100000).search,firecrawlPlanLimits(120000).name],['Standard',500,'Standard']);
  assert.deepEqual([firecrawlPlanLimits(500000).search,firecrawlPlanLimits(1000000).search,firecrawlPlanLimits(9e9).name],[5000,10000,'Scale']);
  assert.equal(firecrawlPlanFromRow({metadata_json:'{"plan_credits":1000}'}).name,'Free');
  assert.equal(firecrawlPlanFromRow({metadata_json:'not json'}),null);assert.equal(firecrawlPlanFromRow(null),null);
});

test('a burst admits exactly the plan limit per minute and refuses the rest with a wait until the window rolls over',async()=>{
  const e=env();
  const results=await Promise.all(Array.from({length:30},(_,i)=>reserveFirecrawlRequest(e,'w1','search',{limit:10,now:T0+i})));
  assert.equal(results.filter(r=>r.allowed).length,10);
  const refused=results.filter(r=>!r.allowed);assert.equal(refused.length,20);
  assert.ok(refused.every(r=>r.reason==='plan_limit'&&r.retryAfterMs>0&&r.retryAfterMs<=FIRECRAWL_WINDOW_MS));
  const row=await e.DB.prepare('SELECT count,prev_count FROM firecrawl_rate_gate WHERE workspace_id=? AND kind=?').bind('w1','search').first();
  assert.deepEqual([row.count,row.prev_count],[10,0],'refusals never inflate the admitted count');
});

test('the sliding window keeps the previous minute in the estimate instead of allowing a double burst at the boundary',async()=>{
  const e=env();
  for(let i=0;i<10;i++)assert.equal((await reserveFirecrawlRequest(e,'w1','search',{limit:10,now:T0+i*100})).allowed,true);
  const mid=await reserveFirecrawlRequest(e,'w1','search',{limit:10,now:T0+30000});
  assert.equal(mid.allowed,false);assert.ok(mid.retryAfterMs>=29000&&mid.retryAfterMs<=30001,`waits for the rollover, got ${mid.retryAfterMs}`);
  const justAfter=await reserveFirecrawlRequest(e,'w1','search',{limit:10,now:T0+FIRECRAWL_WINDOW_MS+1});
  assert.equal(justAfter.allowed,false,'10 admitted one minute ago still count almost fully');
  assert.ok(justAfter.retryAfterMs>0&&justAfter.retryAfterMs<=6100,`decay wait, got ${justAfter.retryAfterMs}`);
  const later=await reserveFirecrawlRequest(e,'w1','search',{limit:10,now:T0+FIRECRAWL_WINDOW_MS+7000});
  assert.equal(later.allowed,true,'after ~10 % decay one slot is free');
  const much=await reserveFirecrawlRequest(e,'w1','search',{limit:10,now:T0+3*FIRECRAWL_WINDOW_MS});
  assert.equal(much.allowed,true);
  const row=await e.DB.prepare('SELECT count,prev_count FROM firecrawl_rate_gate WHERE workspace_id=? AND kind=?').bind('w1','search').first();
  assert.deepEqual([row.count,row.prev_count],[1,0],'two idle minutes reset both windows');
});

test('search and scrape are separate counters and separate workspaces never share a row',async()=>{
  const e=env();
  for(let i=0;i<10;i++)await reserveFirecrawlRequest(e,'w1','search',{limit:10,now:T0+i});
  assert.equal((await reserveFirecrawlRequest(e,'w1','search',{limit:10,now:T0+20})).allowed,false);
  assert.equal((await reserveFirecrawlRequest(e,'w1','scrape',{limit:10,now:T0+20})).allowed,true);
  assert.equal((await reserveFirecrawlRequest(e,'w2','search',{limit:10,now:T0+20})).allowed,true);
});

test('an unknown plan is never throttled proactively, but an upstream 429 blocks every caller until the announced time',async()=>{
  const e=env();
  for(let i=0;i<50;i++)assert.equal((await reserveFirecrawlRequest(e,'w1','search',{limit:null,now:T0+i})).allowed,true);
  const until=await recordFirecrawlRateLimit(e,'w1','search',43000,{now:T0+100});
  assert.equal(until,T0+43100);
  const blocked=await reserveFirecrawlRequest(e,'w1','search',{limit:null,now:T0+200});
  assert.deepEqual([blocked.allowed,blocked.reason,blocked.retryAfterMs],[false,'upstream_429',42900]);
  assert.equal((await reserveFirecrawlRequest(e,'w1','scrape',{limit:null,now:T0+200})).allowed,true,'the block is per endpoint kind');
  assert.equal((await reserveFirecrawlRequest(e,'w1','search',{limit:null,now:T0+43101})).allowed,true);
  await recordFirecrawlRateLimit(e,'w1','search',5000,{now:T0+50000});
  await recordFirecrawlRateLimit(e,'w1','search',1000,{now:T0+50000});
  const row=await e.DB.prepare('SELECT blocked_until FROM firecrawl_rate_gate WHERE workspace_id=? AND kind=?').bind('w1','search').first();
  assert.equal(Number(row.blocked_until),T0+55000,'a shorter announcement never shortens an existing block');
});

test('retry-after is read from the header, then from the Firecrawl message, then defaults, and is capped',()=>{
  const res=(headers={})=>({headers:new Headers(headers)});
  assert.equal(parseRetryAfterMs(res({'Retry-After':'43'}),{}),43000);
  assert.equal(parseRetryAfterMs(res(),{error:'Rate limit exceeded. Consumed 11 req/min, remaining 0. Resets in 43s. Retry after 43 s'}),43000);
  assert.equal(parseRetryAfterMs(res(),{error:'retry after 2 minutes'}),120000);
  assert.equal(parseRetryAfterMs(res(),{error:'no hint'}),FIRECRAWL_DEFAULT_RETRY_AFTER_MS);
  assert.equal(parseRetryAfterMs(res({'Retry-After':'9999'}),{}),FIRECRAWL_MAX_RETRY_AFTER_MS);
  const now=T0;assert.equal(parseRetryAfterMs(res({'Retry-After':new Date(now+5000).toUTCString()}),{},{now}),5000);
});

test('acquire waits for the announced slot while the deadline allows, and reports the wait when it does not',async()=>{
  const e=env();let clock=T0;const sleeps=[];const sleep=async ms=>{sleeps.push(ms);clock+=ms;};const now=()=>clock;
  assert.equal((await acquireFirecrawlSlot(e,'w1','search',{limit:2,deadlineMs:70000,now,sleep})).allowed,true);
  assert.equal((await acquireFirecrawlSlot(e,'w1','search',{limit:2,deadlineMs:70000,now,sleep})).allowed,true);
  const third=await acquireFirecrawlSlot(e,'w1','search',{limit:2,deadlineMs:120000,now,sleep});
  assert.equal(third.allowed,true,'third request waited for a slot instead of failing');
  assert.ok(sleeps.length>=1&&third.waitedMs>=FIRECRAWL_WINDOW_MS&&third.waitedMs<=1.5*FIRECRAWL_WINDOW_MS+1000,`a burst at the limit frees one slot after the previous minute decays by half: waited ${third.waitedMs} ms over ${sleeps.length} sleeps`);
  const fourth=await acquireFirecrawlSlot(e,'w1','search',{limit:2,deadlineMs:1000,now,sleep});
  assert.equal(fourth.allowed,false);assert.ok(fourth.retryAfterMs>1000,'the caller learns how long the slot is away');
  const controller=new AbortController();controller.abort();
  const aborted=await acquireFirecrawlSlot(e,'w1','search',{limit:2,deadlineMs:120000,now,sleep,signal:controller.signal});
  assert.deepEqual([aborted.allowed,aborted.aborted],[false,true]);
});

test('storage problems fail open: research the customer asked for is never blocked by a D1 hiccup',async()=>{
  const broken={DB:{prepare(){throw new Error('D1 unavailable');}}};
  assert.equal((await reserveFirecrawlRequest(broken,'w1','search',{limit:1})).allowed,true);
  assert.equal((await acquireFirecrawlSlot(broken,'w1','search',{limit:1,deadlineMs:0})).allowed,true);
  assert.equal(typeof await recordFirecrawlRateLimit(broken,'w1','search',1000),'number');
});
