const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const root=path.join(__dirname,'..');
const read=name=>fs.existsSync(path.join(root,name))?fs.readFileSync(path.join(root,name),'utf8'):'';

const processMap=read('process-map.js');
const ui=read('company-research-ui.js');
const css=read('company-research.css');

test('Customer V2 loads the automatic company research module from the existing process shell',()=>{
  assert.match(processMap,/company-research-ui\.js\?v=20260826-intelligence-autofill-v1/);
  assert.match(ui,/company-research-engine\.js\?v=20260826-intelligence-autofill-v1/);
});

test('Step 1 becomes research-first and intercepts legacy questionnaire navigation safely',()=>{
  assert.match(ui,/Research company & pre-fill context/);
  assert.match(ui,/to-questionnaire/);
  assert.match(ui,/capture:\s*true/);
  assert.match(ui,/stopImmediatePropagation\(\)/);
  assert.match(ui,/MAX_COMPANY_RESEARCH_QUERIES\s*=\s*3/);
  assert.match(ui,/MAX_RESULTS_PER_QUERY\s*=\s*4/);
});

test('automatic research reuses Firecrawl scrape/search and authenticated workspace AI generation',()=>{
  assert.match(ui,/firecrawl-scrape/);
  assert.match(ui,/firecrawl-search/);
  assert.match(ui,/\/api\/ai\/generate/);
  assert.match(ui,/credentials:\s*['"]include['"]/);
  assert.doesNotMatch(ui,/api_key|access_token|refresh_token/i);
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

test('research reruns preserve non-empty answers through the research engine merge contract',()=>{
  assert.match(ui,/\.mergeDraft\(state\.answers\|\|\{\},draft\)/);
  assert.match(ui,/Rerun company research/);
});

test('profile build consumes the collected public evidence instead of running the legacy source-only analyzer',()=>{
  assert.match(ui,/analyze-company/);
  assert.match(ui,/buildProfileFromResearch/);
  assert.match(ui,/LeadIntelProfile\.buildCompanyIntelligenceProfile/);
  assert.match(ui,/scrapedSources/);
  assert.match(ui,/data-step-marker/);
});