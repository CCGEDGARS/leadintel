import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const __dirname=path.dirname(fileURLToPath(import.meta.url));
const source=fs.readFileSync(path.join(__dirname,'..','firecrawl-workspace-router.js'),'utf8');

function productionGateHelpers(){
  const start=source.indexOf('const GATE_RATE_LIMIT_CODES');
  const end=source.indexOf('function scraplingTarget');
  assert.ok(start>=0&&end>start,'gate retry helpers must exist in Firecrawl router');
  return new Function(`${source.slice(start,end)}; return {gateRateLimitDelayMs,fetchWithGateRetry,GATE_MAX_ATTEMPTS,GATE_MAX_WAIT_MS};`)();
}
const json=(body,status,headers={})=>new Response(JSON.stringify(body),{status,headers:{'Content-Type':'application/json',...headers}});

test('only a 429 from the workspace gate carries a wait; upstream errors and ordinary 429s are never retried',async()=>{
  const {gateRateLimitDelayMs}=productionGateHelpers();
  assert.equal(await gateRateLimitDelayMs(json({code:'FIRECRAWL_RATE_LIMIT',retry_after:7},429,{'Retry-After':'7'})),7000);
  assert.equal(await gateRateLimitDelayMs(json({code:'FIRECRAWL_UPSTREAM_RATE_LIMIT',retry_after:43},429)),43000);
  assert.equal(await gateRateLimitDelayMs(json({code:'FIRECRAWL_RATE_LIMIT',retry_after:900},429)),60000,'waits are capped');
  assert.equal(await gateRateLimitDelayMs(json({error:'Rate limit exceeded'},429)),0,'a 429 without the gate code is not ours');
  assert.equal(await gateRateLimitDelayMs(json({code:'FIRECRAWL_RATE_LIMIT'},503)),0);
  assert.equal(await gateRateLimitDelayMs(new Response('not json',{status:429})),0);
  assert.equal(await gateRateLimitDelayMs(json({ok:true},200)),0);
});

test('the router waits for the announced slot and retries at most three times, then hands back the last answer',async()=>{
  const {fetchWithGateRetry,GATE_MAX_ATTEMPTS}=productionGateHelpers();
  let calls=0;const sleeps=[];
  const gated=()=>{calls++;return calls<3?json({code:'FIRECRAWL_RATE_LIMIT',retry_after:2},429,{'Retry-After':'2'}):json({success:true,data:[]},200);};
  const ok=await fetchWithGateRetry(gated,{},{sleep:async ms=>{sleeps.push(ms);}});
  assert.equal(ok.status,200);assert.deepEqual(sleeps,[2000,2000]);assert.equal(calls,3);
  calls=0;sleeps.length=0;
  const always=()=>{calls++;return json({code:'FIRECRAWL_RATE_LIMIT',retry_after:1},429);};
  const last=await fetchWithGateRetry(always,{},{sleep:async ms=>{sleeps.push(ms);}});
  assert.equal(last.status,429);assert.equal(calls,GATE_MAX_ATTEMPTS);assert.equal(sleeps.length,GATE_MAX_ATTEMPTS-1);
  calls=0;
  const paid=()=>{calls++;return json({error:'Firecrawl search failed (429)'},429);};
  assert.equal((await fetchWithGateRetry(paid,{},{sleep:async()=>assert.fail('must not sleep for a non-gate 429')})).status,429);
  assert.equal(calls,1,'a provider 429 is not retried: it may have been billed');
});

test('an aborted request stops waiting and is not re-sent',async()=>{
  const {fetchWithGateRetry}=productionGateHelpers();
  const controller=new AbortController();let calls=0;
  const gated=()=>{calls++;return json({code:'FIRECRAWL_RATE_LIMIT',retry_after:5},429);};
  const r=await fetchWithGateRetry(gated,{signal:controller.signal},{sleep:async()=>{controller.abort();}});
  assert.equal(r.status,429);assert.equal(calls,1);
});
