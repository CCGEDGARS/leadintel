const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');

const customerRoot=path.join(__dirname,'..');
const resiliencePath=path.join(customerRoot,'market-research-provider-resilience.js');
const evidenceViewPath=path.join(customerRoot,'evidence-view.js');
const firecrawlRouterPath=path.join(customerRoot,'firecrawl-workspace-router.js');
const processMapPath=path.join(customerRoot,'process-map.js');

test('Market Research gives OpenAI web search enough time and collapses repeated provider failures',()=>{
  assert.equal(fs.existsSync(resiliencePath),true,'provider resilience module must exist');
  const source=fs.readFileSync(resiliencePath,'utf8');
  assert.match(source,/OPENAI_TIMEOUT_FLOOR_MS\s*=\s*75000/,'OpenAI web search needs a 75s client timeout floor');
  assert.match(source,/label\s*===\s*['"]OpenAI search['"]/,'only OpenAI search should receive the longer timeout');
  assert.match(source,/dedupeFailureRows/,'repeated provider failures must be collapsed in the run report');
  assert.match(source,/MutationObserver/,'late research report renders must also be normalized');
});

test('provider resilience module is loaded with a fresh browser cache version',()=>{
  const source=fs.readFileSync(evidenceViewPath,'utf8');
  assert.match(source,/market-research-provider-resilience\.js\?v=20260907-provider-resilience-v1/);
});

test('managed Firecrawl 404 retries the direct proxy instead of failing every research query immediately',()=>{
  const router=fs.readFileSync(firecrawlRouterPath,'utf8');
  const processMap=fs.readFileSync(processMapPath,'utf8');
  assert.match(router,/status===404/,'a backend-managed 404 must be retryable through the direct managed proxy');
  assert.match(router,/if\(!retryableStatus\(response\.status\)\)return response;[\s\S]*originalFetch\(input,options\)/,'retryable backend failures must fall through to the direct proxy');
  assert.match(processMap,/firecrawl-workspace-router\.js\?v=20260907-provider-resilience-v2/,'browser must receive the corrected router immediately');
});
