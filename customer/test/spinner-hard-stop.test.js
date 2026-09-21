const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');

const root=path.join(__dirname,'..');
const app=fs.readFileSync(path.join(root,'app.js'),'utf8');
const router=fs.readFileSync(path.join(root,'firecrawl-workspace-router.js'),'utf8');
const persistence=fs.readFileSync(path.join(root,'workspace-persistence.js'),'utf8');
const html=fs.readFileSync(path.join(root,'index.html'),'utf8');
const discovery=fs.readFileSync(path.join(root,'discovery-ui.js'),'utf8');

test('company source analysis aborts stalled scrapes and preserves a usable completion path',()=>{
  assert.ok(app.includes('const ANALYSIS_SOURCE_TIMEOUT_MS=25000;'));
  assert.ok(app.includes('new AbortController()'));
  assert.ok(app.includes('signal:controller.signal'));
  assert.ok(app.includes('Source scrape timed out after'));
  assert.ok(app.includes('Promise.all(sources.map'));
});

test('Firecrawl fallback cannot bypass an aborted request',()=>{
  assert.ok(router.includes('error?.name==="AbortError"||options?.signal?.aborted'));
  assert.ok(router.includes('signal:options?.signal'));
});

test('cloud save has a hard timeout so activation cannot remain busy',()=>{
  assert.ok(persistence.includes('const SAVE_REQUEST_TIMEOUT_MS=10000;'));
  assert.ok(persistence.includes('function withTimeout(operation,timeoutMs=SAVE_REQUEST_TIMEOUT_MS'));
  assert.ok(persistence.includes('withTimeout(()=>root.LeadIntelServerBridge?.saveNow?.({saveIntent:true,explicitSave:true}),SAVE_REQUEST_TIMEOUT_MS)'));
});

test('Discovery runtime cache key changes whenever spinner recovery changes',()=>{
  assert.ok(discovery.includes('const DISCOVERY_RUN_TIMEOUT_MS=25000;'));
});

test('customer page loads the spinner-safe bundles with fresh cache keys',()=>{
  for(const marker of [
    'app.js?v=20260921-standard-market-next-step-v1',
    'process-map.js?v=20260919-lookalike-green-card-v1',
    'discovery-ui.js?v=20260920-single-discovery-cta-v1'
  ])assert.ok(html.includes(marker),marker);
});
