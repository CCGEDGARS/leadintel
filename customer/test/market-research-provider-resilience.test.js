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

test('Market Research caps OpenAI wait time and collapses repeated provider failures',()=>{
  assert.equal(fs.existsSync(resiliencePath),true,'provider resilience module must exist');
  const source=fs.readFileSync(resiliencePath,'utf8');
  assert.doesNotMatch(source,/OPENAI_TIMEOUT_FLOOR_MS\s*=\s*75000/,'OpenAI must not turn a 30s budget into a 75s attempt');
  assert.match(source,/dedupeFailureRows/,'repeated provider failures must be collapsed in the run report');
  assert.match(source,/MutationObserver/,'late research report renders must also be normalized');
});

test('provider resilience is loaded before research starts and wraps the OpenAI request',()=>{
  const evidenceView=fs.readFileSync(evidenceViewPath,'utf8');
  const app=fs.readFileSync(appPath,'utf8');
  assert.match(evidenceView,/market-research-provider-resilience\.js\?v=20260916-latency-fix-v2/);
  assert.match(app,/import\s*{\s*withOpenAiRetry\s*,\s*cleanOpenAiResearchQuery\s*,\s*describePartialCoverage\s*}\s*from\s*['"]\.\/market-research-provider-resilience\.js\?v=20260916-latency-fix-v2['"]/);
  assert.match(app,/withOpenAiRetry\(\(\)=>LeadIntelMarket\.withTimeout\(/);
  assert.match(app,/describePartialCoverage\(/);
});

test('managed Firecrawl 404 retries the direct proxy instead of failing every research query immediately',()=>{
  const router=fs.readFileSync(firecrawlRouterPath,'utf8');
  const processMap=fs.readFileSync(processMapPath,'utf8');
  assert.match(router,/status===404/,'a backend-managed 404 must be retryable through the direct managed proxy');
  assert.match(router,/if\(!retryableStatus\(response\.status\)\)return response;[\s\S]*originalFetch\(input,options\)/,'retryable backend failures must fall through to the direct proxy');
  assert.match(processMap,/firecrawl-workspace-router\.js\?v=20260914-spinner-hard-stop-v1/,'browser must receive the corrected router immediately');
});

test('OpenAI discovery automatically retries a timeout once',async()=>{
  const resilience=await loadResilienceModule();
  let attempts=0;
  await assert.rejects(()=>resilience.withOpenAiRetry(async()=>{
    attempts++;
    throw new Error('OpenAI search timed out');
  },{sleep:async()=>{}}),/remained unavailable after 2 attempts/i);

  assert.equal(attempts,2);
});

test('OpenAI research queries are concise, deduplicated and use one language',async()=>{
  const resilience=await loadResilienceModule();
  const cleaned=resilience.cleanOpenAiResearchQuery('Sweden Drawing development and mechanical engineering Swedish industrial manufacturers, Swedish industrial manufacturers, engineering Facility expansion ziņas paziņojums paplašināšanās');
  assert.equal(cleaned,'Sweden Drawing development and mechanical engineering Swedish industrial manufacturers engineering Facility expansion');
  assert.ok(cleaned.length<=180);
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
    status:'Market Scan completed with 5 evidence sources. Firecrawl succeeded; OpenAI discovery was unavailable within the research time limit.',
    title:'Research completed with limited coverage',
    intro:'5 public evidence sources were saved. Retry only OpenAI discovery without losing these results.'
  });
  assert.equal(resilience.describePartialCoverage({modeLabel:'Market Scan',count:0,openAiStatus:'error',firecrawlStatus:'error'}),null);
});

test('research completion is prominent while provider gaps remain explicit',()=>{
  const index=fs.readFileSync(indexPath,'utf8');
  const css=fs.readFileSync(marketCssPath,'utf8');
  const app=fs.readFileSync(appPath,'utf8');
  assert.match(index,/market\.css\?v=20260920-centered-discovery-cta-v1/);
  assert.match(index,/app\.js\?v=20260920-simplified-research-handoff-v1/);
  assert.match(index,/id="market-research-status" role="status" aria-live="polite"/);
  assert.match(app,/complete-with-warning/);
  assert.match(app,/research-status-icon/);
  assert.match(app,/source\$\{count===1\?"":"s"\} saved/);
  assert.match(css,/\.research-panel>\.research-status\[data-status="complete"\]/);
  assert.match(css,/\.research-status-icon/);
  assert.match(css,/\.research-status-copy em/);
  assert.match(app,/const show=status==="error"/);
});

test('partial coverage offers an OpenAI-only recovery that preserves Firecrawl evidence',()=>{
  const app=fs.readFileSync(appPath,'utf8');
  assert.match(app,/async function retryOpenAiDiscovery\(/);
  assert.match(app,/const preservedResults=\[\.\.\.state\.market\.researchResults\]/);
  assert.match(app,/state\.market\.researchResults=LeadIntelMarket\.mergeResearchResults\(preservedResults/);
  assert.match(app,/data-extend-openai/);
  assert.match(app,/Retry OpenAI/);
  assert.match(app,/openAiRetryStatus/);
});


test('partial research offers one inline OpenAI extension action with live countdown progress',()=>{
  const app=fs.readFileSync(appPath,'utf8');
  assert.match(app,/Retry OpenAI/);
  assert.match(app,/data-extend-openai/);
  assert.match(app,/function openAiRetryStatus/);
  assert.match(app,/s remaining/);
  assert.match(app,/OpenAI \${current}\/\${total} queries/);
  assert.match(app,/startOpenAiCountdown/);
  assert.doesNotMatch(app,/Extend with OpenAI/);
});
