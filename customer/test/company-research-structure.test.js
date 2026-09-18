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
const supportLoader=read('shell-support-loader.js');

test('Customer V2 loads the automatic company research module with Firecrawl workspace routing before research',()=>{
  assert.match(processMap,/firecrawl-workspace-router\.js\?v=20260914-spinner-hard-stop-v1/);
  assert.match(processMap,/company-research-security\.js\?v=20260918-translation-fidelity-v3/);
  assert.match(processMap,/company-research-ui\.js\?v=20260918-translation-fidelity-v3/);
  assert.ok(processMap.indexOf('firecrawl-workspace-router.js')<processMap.indexOf('company-research-ui.js'),'Firecrawl router must load before company research');
  assert.match(processMap,/company-profile-handoff\.js\?v=20260826-intelligence-autofill-v1/);
  assert.match(ui,/company-research-engine\.js\?v=20260918-translation-fidelity-v3/);
  assert.match(read('index.html'),/profile-engine\.js\?v=20260916-commercial-brief-v1/);
  assert.match(read('index.html'),/process-map\.js\?v=20260918-classic-scope-v1/);
  assert.match(supportLoader,/company-research-ui\.js\?v=20260918-translation-fidelity-v3/);
});

test('Stage 1 exposes the primary next action directly after required market selection',()=>{
  const html=read('index.html');
  const marketStart=html.indexOf('id="target-market-selector"');
  const action=html.indexOf('class="step-actions stage1-primary-action"',marketStart);
  const optionalLinks=html.indexOf('<h3>Additional links</h3>');
  assert.ok(marketStart>=0&&action>marketStart&&action<optionalLinks);
  assert.match(html,/id="to-questionnaire">Continue to Company Research/);
});

test('Step 2 waits for an explicit research confirmation and explains the next action',()=>{
  assert.match(ui,/Continue to Company Research/);
  assert.match(ui,/rerun-company-research/);
  assert.match(ui,/Setup complete — ready for company research/);
  assert.match(ui,/Usually takes up to 1 minute/);
  assert.match(ui,/Website required/);
  assert.match(ui,/Market required/);
  assert.doesNotMatch(ui,/function scheduleInitialCompanyResearch/);
  assert.doesNotMatch(ui,/LeadIntelWebsiteActivation\?\.isWebsiteActive/);
  assert.doesNotMatch(ui,/stopImmediatePropagation\(\)/);
  assert.match(ui,/MAX_COMPANY_RESEARCH_QUERIES\s*=\s*3/);
  assert.match(ui,/MAX_RESULTS_PER_QUERY\s*=\s*4/);
  assert.match(ui,/COMPANY_RESEARCH_REQUEST_TIMEOUT_MS\s*=\s*25000/);
  assert.match(ui,/COMPANY_RESEARCH_RUN_TIMEOUT_MS\s*=\s*60000/);
  assert.match(ui,/new AbortController\(\)/);
  assert.match(ui,/Promise\.allSettled/);
  assert.match(ui,/stopped safely/);
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
  assert.match(ui,/Build your Commercial Intelligence Brief\./);
  assert.match(ui,/research-summary/);
  assert.match(ui,/Research could not complete/);
  assert.match(ui,/failureAt/);
  assert.match(ui,/Start company research/);
  assert.match(ui,/research-primary/);
  assert.match(css,/\.research-summary-failed/);
  assert.match(ui,/research-field-meta/);
  assert.match(ui,/Needs your input/);
  assert.match(ui,/confidence/i);
  assert.match(ui,/rel="noopener"/);
  assert.match(css,/\.research-summary/);
  assert.match(css,/\.research-rerun\.research-primary/);
  assert.match(css,/\.research-rerun\{[^}]*color:#0d5d4f/);
  assert.match(css,/@media\(prefers-reduced-motion:reduce\)/);
  assert.match(css,/\.research-field-meta/);
  assert.match(css,/\.research-confidence/);
});

test('Step 2 remains editable while prerequisites or research are incomplete',()=>{
  assert.match(ui,/function companyResearchReady/);
  assert.doesNotMatch(ui,/function returnToStepOneIfIncomplete/);
  assert.doesNotMatch(ui,/setTimeout\(returnToStepOneIfIncomplete,0\)/);
  assert.match(ui,/Needs your input/);
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

test('research preserves an English master and rejects translations that collapse commercial detail',()=>{
  const language=read('content-language.js');
  assert.match(ui,/const researchLanguage='en'/);
  assert.match(ui,/next\\.uiLanguage\\s*=\\s*selectedLanguage/);
  assert.match(language,/never summarize, shorten, generalize/);
  assert.match(language,/Translation lost source detail or meaning/);
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


test('workspace interface stays English while selected language affects only dynamic research content',()=>{
  const html=read('index.html');
  assert.match(ui,/Build your Commercial Intelligence Brief\./);
  assert.match(html,/Define who LeadIntel should find\./);
  assert.match(html,/Buying Signals/);
  assert.match(html,/Commercial Message/);
  assert.match(ui,/Rerun company research/);
  assert.match(ui,/Needs your input/);
  assert.doesNotMatch(ui+'\n'+html,/STEP2_COPY|applyStep2Copy|AI atbalsts|Izveidojiet komerciālās inteliģences kopsavilkumu/);
  assert.match(ui,/data-research-translatable/);
  assert.match(ui,/translateEditor\(window,editor,language\)/);
});
