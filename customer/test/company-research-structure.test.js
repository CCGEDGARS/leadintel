const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const root=path.join(__dirname,'..');
const read=name=>fs.existsSync(path.join(root,name))?fs.readFileSync(path.join(root,name),'utf8'):'';

const processMap=read('process-map.js');
const ui=read('company-research-ui.js');
const router=read('firecrawl-workspace-router.js');
const app=read('app.js');
const handoff=read('company-profile-handoff.js');
const css=read('company-research.css');

test('Customer V2 loads the automatic company research module with Firecrawl workspace routing before research',()=>{
  assert.match(processMap,/firecrawl-workspace-router\.js\?v=20260914-spinner-hard-stop-v1/);
  assert.match(processMap,/company-research-security\.js\?v=20260906-authoritative-depth-v1/);
  assert.match(processMap,/company-research-ui\.js\?v=20260906-selector-language-v2/);
  assert.ok(processMap.indexOf('firecrawl-workspace-router.js')<processMap.indexOf('company-research-ui.js'),'Firecrawl router must load before company research');
  assert.match(processMap,/company-profile-handoff\.js\?v=20260826-intelligence-autofill-v1/);
  assert.match(ui,/company-research-engine\.js\?v=20260906-selector-language-v2/);
  assert.match(read('index.html'),/profile-engine\.js\?v=20260914-recommended-signals-v2/);
  assert.match(read('index.html'),/process-map\.js\?v=20260914-activation-timeout-v1/);
  assert.match(read('index.html'),/company-research-ui\.js\?v=20260906-selector-language-v2/);
});

test('Step 1 becomes research-first and intercepts legacy questionnaire navigation safely',()=>{
  assert.match(ui,/Research company & pre-fill context/);
  assert.match(ui,/to-questionnaire/);
  assert.match(ui,/capture:\s*true/);
  assert.match(ui,/stopImmediatePropagation\(\)/);
  assert.match(ui,/MAX_COMPANY_RESEARCH_QUERIES\s*=\s*3/);
  assert.match(ui,/MAX_RESULTS_PER_QUERY\s*=\s*4/);
});

test('company research discovers and scrapes authoritative internal pages before synthesis',()=>{
  assert.match(ui,/buildAuthoritativePageQueries/);
  assert.match(ui,/selectAuthoritativePageCandidates/);
  assert.match(ui,/authoritativeCandidates\.map/);
  assert.match(ui,/pageCategory/);
  assert.match(ui,/capDraftConfidence/);
});

test('research summary exposes authoritative coverage instead of relying on source count alone',()=>{
  assert.match(ui,/quality\?\.coverage/);
  assert.match(ui,/authoritative areas/);
  assert.match(ui,/Coverage incomplete/);
});

test('signed-in research transparently routes legacy Firecrawl calls through authenticated workspace endpoints',()=>{
  assert.match(router,/MANAGED_FIRECRAWL_ORIGIN='https:\/\/apollo-proxy\.edgars-7e7\.workers\.dev'/);
  assert.match(router,/\/api\/integrations\/services\/firecrawl\/\$\{kind\}/);
  assert.match(router,/bridge\?\.session\?\.authenticated/);
  assert.match(router,/workspace\?\.id/);
  assert.match(router,/credentials:'include'/);
  assert.doesNotMatch(`${router}\n${ui}`,/APOLLO_API_KEY|FIRECRAWL_API_KEY|access_token|refresh_token/);
  assert.match(ui,/FIRECRAWL_PROXY/,'unsigned/local research keeps the existing managed proxy fallback');
  assert.match(ui,/firecrawl-scrape/);
  assert.match(ui,/firecrawl-search/);
  assert.match(ui,/\/api\/ai\/generate/);
  assert.match(ui,/credentials:\s*['"]include['"]/);
});

test('Firecrawl router leaves unrelated fetches and local unsigned research untouched',()=>{
  assert.match(router,/if\(url\.origin!==MANAGED_FIRECRAWL_ORIGIN\)return null/);
  assert.match(router,/if\(!authenticated\)return null/);
  assert.match(router,/if\(!target\)return originalFetch\(input,options\)/);
});

test('Step 2 renders research summary, provenance, confidence and needs-input states',()=>{
  assert.match(ui,/Review what LeadIntel found\./);
  assert.match(ui,/research-summary/);
  assert.match(ui,/research-field-meta/);
  assert.match(ui,/Needs your input/);
  assert.match(ui,/confidence/i);
  assert.match(ui,/rel="noopener"/);
  assert.match(css,/\.research-summary/);
  assert.match(css,/\.research-field-meta/);
  assert.match(css,/\.research-confidence/);
});

test('fresh research persists answers and evidence into the existing main Customer V2 state then invalidates stale strategy',()=>{
  assert.match(ui,/leadintel_customer_v2_state/);
  assert.match(ui,/scrapedSources/);
  assert.match(ui,/answers/);
  assert.match(ui,/profile\s*=\s*null/);
  assert.match(ui,/approved\s*=\s*false/);
  assert.match(ui,/market\s*=\s*\{\}/);
});

test('company research resolves output language from the visible selector at run time',()=>{
  assert.match(ui,/language-select/);
  assert.match(ui,/resolveResearchLanguage/);
  assert.match(ui,/next\.uiLanguage\s*=\s*selectedLanguage/);
});

test('research reruns preserve reviewed answers through provenance-aware merge',()=>{
  assert.match(ui,/\.mergeDraft\(state\.answers\|\|\{\},draft,readMeta\(\)\.fields\|\|\{\}\)/);
  assert.match(ui,/Rerun company research/);
});

test('profile build consumes the collected public evidence instead of running the legacy source-only analyzer',()=>{
  assert.match(handoff,/analyze-company/);
  assert.match(handoff,/buildProfileFromResearch/);
  assert.match(handoff,/LeadIntelProfile\.buildCompanyIntelligenceProfile/);
  assert.match(handoff,/scrapedSources/);
  assert.match(handoff,/data-step-marker/);
  assert.match(handoff,/capture:\s*true/);
});

test('labels reset as a complete workspace reset and protects CRM records',()=>{
  const html=read('index.html');
  const resetBlock=app.match(/async function resetWorkspace\(\)\{[\s\S]*?\n\}\n\nfunction bind/)?.[0]||'';
  assert.match(html,/id="reset-workspace"[^>]*>Reset all workspace data</);
  assert.match(app,/Reset all workspace data/);
  assert.match(resetBlock,/leadintel_customer_v2_discovery/);
  assert.match(resetBlock,/bridge\.saveNow\(\)/);
  assert.doesNotMatch(resetBlock,/deleteCompany|crmDelete|method:\s*["']DELETE["']/i);
});
