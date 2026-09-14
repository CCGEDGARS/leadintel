const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');

const customerRoot=path.join(__dirname,'..');
const resiliencePath=path.join(customerRoot,'market-research-provider-resilience.js');
const evidenceViewPath=path.join(customerRoot,'evidence-view.js');
const appPath=path.join(customerRoot,'app.js');
const indexPath=path.join(customerRoot,'index.html');
const marketCssPath=path.join(customerRoot,'market.css');
const firecrawlRouterPath=path.join(customerRoot,'firecrawl-workspace-router.js');
const processMapPath=path.join(customerRoot,'process-map.js');

async function loadResilienceModule(){
  const source=fs.readFileSync(resiliencePath,'utf8');
  const encoded=Buffer.from(source).toString('base64');
  return import(`data:text/javascript;base64,${encoded}#${Date.now()}-${Math.random()}`);
}

test('Market Research gives OpenAI web search enough time and collapses repeated provider failures',()=>{
  assert.equal(fs.existsSync(resiliencePath),true,'provider resilience module must exist');
  const source=fs.readFileSync(resiliencePath,'utf8');
  assert.match(source,/OPENAI_TIMEOUT_FLOOR_MS\s*=\s*75000/,'OpenAI web search needs a 75s client timeout floor');
  assert.match(source,/label\s*===\s*['"]OpenAI search['"]/,'only OpenAI search should receive the longer timeout');
  assert.match(source,/dedupeFailureRows/,'repeated provider failures must be collapsed in the run report');
  assert.match(source,/MutationObserver/,'late research report renders must also be normalized');
});

test('provider resilience is loaded before research starts and wraps the OpenAI request',()=>{
  const evidenceView=fs.readFileSync(evidenceViewPath,'utf8');
  const app=fs.readFileSync(appPath,'utf8');
  assert.match(evidenceView,/market-research-provider-resilience\.js\?v=20260913-openai-retry-v2/);
  assert.match(app,/import\s*{\s*withOpenAiRetry\s*,\s*describePartialCoverage\s*}\s*from\s*['"]\.\/market-research-provider-resilience\.js\?v=20260913-openai-retry-v2['"]/);
  assert.match(app,/withOpenAiRetry\(\(\)=>LeadIntelMarket\.withTimeout\(/);
  assert.match(app,/describePartialCoverage\(/);
});

test('managed Firecrawl 404 retries the direct proxy instead of failing every research query immediately',()=>{
  const router=fs.readFileSync(firecrawlRouterPath,'utf8');
  const processMap=fs.readFileSync(processMapPath,'utf8');
  assert.match(router,/status===404/,'a backend-managed 404 must be retryable through the direct managed proxy');
  assert.match(router,/if\(!retryableStatus\(response\.status\)\)return response;[\s\S]*originalFetch\(input,options\)/,'retryable backend failures must fall through to the direct proxy');
  assert.match(processMap,/firecrawl-workspace-router\.js\?v=20260907-provider-resilience-v2/,'browser must receive the corrected router immediately');
});

test('OpenAI discovery retries one transient timeout and returns the recovered result',async()=>{
  const resilience=await loadResilienceModule();
  let attempts=0;
  const result=await resilience.withOpenAiRetry(async()=>{
    attempts++;
    if(attempts===1)throw new Error('OpenAI search timed out');
    return {available:true,results:[{url:'https://example.com/evidence'}]};
  },{sleep:async()=>{}});

  assert.equal(attempts,2);
  assert.equal(result.results[0].url,'https://example.com/evidence');
});

test('OpenAI discovery does not retry configuration or validation failures',async()=>{
  const resilience=await loadResilienceModule();
  let attempts=0;

  await assert.rejects(()=>resilience.withOpenAiRetry(async()=>{
    attempts++;
    throw new Error('OpenAI integration is required for web search');
  },{sleep:async()=>{}}),/integration is required/i);

  assert.equal(attempts,1);
});

test('OpenAI discovery reports a clear terminal message after both transient attempts fail',async()=>{
  const resilience=await loadResilienceModule();
  let attempts=0;

  await assert.rejects(()=>resilience.withOpenAiRetry(async()=>{
    attempts++;
    throw new Error('OpenAI request failed (502)');
  },{sleep:async()=>{}}),error=>{
    assert.equal(error.message,'OpenAI signal discovery remained unavailable after 2 attempts');
    return true;
  });

  assert.equal(attempts,2);
});

test('partial OpenAI coverage explains that Firecrawl evidence was preserved and how to recover',async()=>{
  const resilience=await loadResilienceModule();
  const copy=resilience.describePartialCoverage({modeLabel:'Market Scan',count:5,openAiStatus:'error',firecrawlStatus:'complete'});

  assert.deepEqual(copy,{
    status:'Market Scan completed with 5 evidence sources. Firecrawl succeeded; OpenAI discovery remained unavailable after an automatic retry.',
    title:'Research completed with limited coverage',
    intro:'5 public evidence sources were saved. Rerun Market Scan to retry the missing OpenAI discovery without losing these results.'
  });
  assert.equal(resilience.describePartialCoverage({modeLabel:'Market Scan',count:0,openAiStatus:'error',firecrawlStatus:'error'}),null);
});

test('research recovery assets are cache-busted and partial coverage uses neutral styling',()=>{
  const index=fs.readFileSync(indexPath,'utf8');
  const css=fs.readFileSync(marketCssPath,'utf8');
  assert.match(index,/market\.css\?v=20260913-openai-retry-v3/);
  assert.match(index,/app\.js\?v=20260914-discovery-signal-seeding-v2/);
  assert.match(css,/\.research-run-feedback\[data-status="partial"\]/);
});