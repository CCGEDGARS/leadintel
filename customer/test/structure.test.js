const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
function read(name){return fs.readFileSync(path.join(__dirname,'..',name),'utf8');}

test('customer onboarding exposes mandatory website and hybrid target market selector plus optional sources',()=>{
  const html=read('index.html');
  assert.match(html,/id="company-website"/);
  assert.match(html,/id="target-market-selector"/);
  assert.match(html,/data-target-market="Sweden"/);
  assert.match(html,/data-target-market="Germany"/);
  assert.match(html,/data-target-market="Nordics"/);
  assert.match(html,/data-target-market="DACH"/);
  assert.match(html,/id="custom-target-market"/);
  assert.match(html,/id="add-target-market"/);
  assert.match(html,/id="clear-target-markets"/);
  assert.match(html,/id="selected-target-markets"/);
  assert.match(html,/id="additional-links"/);
  assert.match(html,/id="pdf-input"/);
});

test('customer onboarding contains all ten strategic questions with target-market question reframed as optional focus',()=>{
  const html=read('index.html');
  const ids=['priority_offers','ideal_customer','lookalike_customers','buyer_roles','growth_markets','differentiation','buying_triggers','exclusions','opportunity_value','success_outcome'];
  ids.forEach(id=>assert.match(html,new RegExp(`data-question="${id}"`)));
  assert.match(html,/Within your selected markets/i);
});

test('strategic intake is clearly optional enrichment',()=>{
  const html=read('index.html');
  assert.match(html,/Optional enrichment/);
  assert.match(html,/skip these questions/i);
  assert.doesNotMatch(html,/These ten answers control what the system prioritizes/);
  assert.doesNotMatch(html,/Approval gate/);
});

test('website plus target market unlocks sidebar modules while enrichment remains optional',()=>{
  const app=read('app.js');
  const discovery=read('discovery-ui.js');
  const outreach=read('outreach-ui.js');
  const delivery=read('delivery-ui.js');
  assert.match(app,/LeadIntelProfile\.canAccessModule/);
  assert.match(app,/function openModule/);
  assert.match(app,/targetMarkets/);
  assert.match(app,/data-target-market/);
  assert.match(app,/Choose at least one target market/);
  assert.match(app,/querySelector\("\.steps"\).*addEventListener/s);
  assert.match(app,/MutationObserver/,'dynamic Steps 5–7 must inherit visible unlocked state after injection');
  assert.match(app,/\[1,2,3,4,5,6,7\]\.includes\(Number\(raw\.step\)\)/,'app reload must preserve Steps 5–7');
  assert.doesNotMatch(app,/Complete \$\{missing\.length\} required question/);
  assert.doesNotMatch(discovery,/Activate Market Strategy before Discovery/);
  assert.doesNotMatch(outreach,/Save at least one company to Pipeline first/);
  assert.doesNotMatch(delivery,/Approve at least one outreach package first/);
});

test('dynamic Steps 5–7 persist navigation and reopen themselves after reload',()=>{
  const discovery=read('discovery-ui.js');
  const outreach=read('outreach-ui.js');
  const delivery=read('delivery-ui.js');
  assert.match(discovery,/persistMainStep/);
  assert.match(discovery,/mainState\(\)\.step===5/);
  assert.match(outreach,/persistMainStep/);
  assert.match(outreach,/mainState\(\)\.step===6/);
  assert.match(delivery,/persistMainStep/);
  assert.match(delivery,/readJson\(MAIN_STORAGE_KEY\)\.step===7/);
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

test('unresearched opportunity card renders only its selected-market title and zero total',()=>{
  const app=read('app.js');
  assert.match(app,/opp\.profileOnly\?`<article class="opportunity-card[^`]+opp\.score\.total[^`]+<\/article>`:/s);
  assert.doesNotMatch(app,/opp\.profileOnly\?[\s\S]{0,800}opportunity-hypothesis/);
});

test('customer app wires live Firecrawl market search with explicit per-mode cost guards',()=>{
  const app=read('app.js'),engine=read('market-engine.js');
  assert.match(app,/firecrawl-search/);
  assert.match(engine,/quick:Object\.freeze\(\{maxQueries:4,resultsPerQuery:5,maxStoredResults:20\}\)/);
  assert.match(engine,/deep:Object\.freeze\(\{maxQueries:12,resultsPerQuery:8,maxStoredResults:80\}\)/);
  assert.match(engine,/intelligence:Object\.freeze\(\{maxQueries:24,resultsPerQuery:10,maxStoredResults:200\}\)/);
  assert.match(app,/LeadIntelMarket/);
});

test('customer page loads discovery engine and modular discovery UI',()=>{
  const html=read('index.html');
  assert.match(html,/src="discovery-engine\.js(?:\?[^\"]*)?"/);
  assert.match(html,/src="discovery-ui\.js(?:\?[^\"]*)?"/);
});

test('discovery UI injects Step 5, company discovery, decision makers and pipeline controls',()=>{
  const ui=read('discovery-ui.js');
  assert.match(ui,/data-step-marker="5"/);
  assert.match(ui,/id="step-5"/);
  assert.match(ui,/id="run-company-discovery"/);
  assert.match(ui,/id="company-candidates"/);
  assert.match(ui,/data-action="find-decision-makers"/);
  assert.match(ui,/data-action="save-crm"/);
  assert.match(ui,/data-action="add-pipeline"/);
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

test('discovery module loads outreach engine and modular outreach UI',()=>{
  const ui=read('discovery-ui.js');
  assert.match(ui,/outreach-engine\.js/);
  assert.match(ui,/outreach-ui\.js/);
  assert.match(ui,/loadOutreachModules/);
});

test('outreach UI injects Step 6 opportunity dossier and human approval controls',()=>{
  const ui=read('outreach-ui.js');
  for(const pattern of [
    /data-step-marker="6"/,/id="step-6"/,/id="outreach-company-select"/,/id="build-opportunity-dossier"/,
    /id="dossier-why-now"/,/id="dossier-evidence"/,/id="dossier-hypotheses"/,/id="outreach-email-subject"/,
    /id="outreach-email-body"/,/id="outreach-linkedin"/,/id="approve-outreach"/,/id="mark-contacted"/
  ]) assert.match(ui,pattern);
});

test('outreach UI uses one official scrape and two-search hard cap without auto-send',()=>{
  const ui=read('outreach-ui.js');
  assert.match(ui,/MAX_DOSSIER_SEARCH_QUERIES\s*=\s*2/);
  assert.match(ui,/firecrawl-scrape/);
  assert.match(ui,/firecrawl-search/);
  assert.match(ui,/LeadIntelOutreach/);
  assert.doesNotMatch(ui,/gmail|sendEmail|send-message|linkedin.*post/i);
});
