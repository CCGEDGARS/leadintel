const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
function read(name){return fs.readFileSync(path.join(__dirname,'..',name),'utf8');}

test('customer onboarding exposes main website, extra links and PDF input',()=>{
  const html=read('index.html');
  assert.match(html,/id="company-website"/);
  assert.match(html,/id="additional-links"/);
  assert.match(html,/id="pdf-input"/);
});

test('customer onboarding contains all ten strategic questions',()=>{
  const html=read('index.html');
  const ids=['priority_offers','ideal_customer','lookalike_customers','buyer_roles','growth_markets','differentiation','buying_triggers','exclusions','opportunity_value','success_outcome'];
  ids.forEach(id=>assert.match(html,new RegExp(`data-question="${id}"`)));
});

test('profile screen includes review, edit and approval controls',()=>{
  const html=read('index.html');
  assert.match(html,/id="profile-editor"/);
  assert.match(html,/id="approve-profile"/);
  assert.match(html,/id="edit-profile"/);
});

test('market strategy step includes ICP, signal designer, research and activation controls',()=>{
  const html=read('index.html');
  assert.match(html,/data-step-marker="4"/);
  assert.match(html,/id="step-4"/);
  assert.match(html,/id="icp-list"/);
  assert.match(html,/id="signal-designer"/);
  assert.match(html,/id="add-custom-signal"/);
  assert.match(html,/id="run-market-research"/);
  assert.match(html,/id="market-opportunities"/);
  assert.match(html,/id="activate-market-strategy"/);
});

test('market opportunity UI exposes the five scoring dimensions',()=>{
  const html=read('index.html');
  for(const label of ['Fit','Intent','Timing','Value','Evidence'])assert.match(html,new RegExp(`>${label}<`));
});

test('customer app wires live Firecrawl market search with explicit cost guard',()=>{
  const app=read('app.js');
  assert.match(app,/firecrawl-search/);
  assert.match(app,/MAX_MARKET_RESEARCH_QUERIES\s*=\s*4/);
  assert.match(app,/LeadIntelMarket/);
});

test('customer page loads discovery engine and modular discovery UI',()=>{
  const html=read('index.html');
  assert.match(html,/src="discovery-engine\.js"/);
  assert.match(html,/src="discovery-ui\.js"/);
});

test('discovery UI injects Step 5, company discovery, decision makers and pipeline controls',()=>{
  const ui=read('discovery-ui.js');
  assert.match(ui,/data-step-marker="5"/);
  assert.match(ui,/id="step-5"/);
  assert.match(ui,/id="run-company-discovery"/);
  assert.match(ui,/id="company-candidates"/);
  assert.match(ui,/data-action="find-decision-makers"/);
  assert.match(ui,/data-action="save-pipeline"/);
  assert.match(ui,/id="customer-pipeline"/);
  assert.match(ui,/data-pipeline-stage/);
});

test('company discovery UI exposes the five company score dimensions',()=>{
  const ui=read('discovery-ui.js');
  for(const label of ['Fit','Signal','Evidence','Timing','Value'])assert.match(ui,new RegExp(`"${label}"`));
});

test('discovery UI wires Firecrawl and Apollo people search with hard caps',()=>{
  const ui=read('discovery-ui.js');
  const engine=read('discovery-engine.js');
  assert.match(ui,/MAX_DISCOVERY_QUERIES\s*=\s*4/);
  assert.match(ui,/MAX_DISCOVERY_RESULTS_PER_QUERY\s*=\s*5/);
  assert.match(ui,/firecrawl-search/);
  assert.match(ui,/LeadIntelDiscovery/);
  assert.match(engine,/q_organization_domains_list/);
});
