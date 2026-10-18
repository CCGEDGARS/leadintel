const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const root=path.join(__dirname,'..');
const ui=fs.readFileSync(path.join(root,'intelligence-sources-ui.js'),'utf8');
const processMap=fs.readFileSync(path.join(root,'process-map.js'),'utf8');

test('Step 4 exposes a dedicated Intelligence Sources registry',()=>{
  assert.match(ui,/Intelligence Sources/);
  assert.match(ui,/Add preferred source/i);
  assert.match(ui,/Test Access/);
  assert.match(ui,/Configure Signals/);
  assert.match(ui,/Mandatory source/);
  assert.match(ui,/Monitoring enabled/);
  assert.match(ui,/Source Health/);
  assert.match(ui,/NOT TESTED/);
  assert.match(ui,/FULL ACCESS/);
  assert.match(ui,/PARTIAL ACCESS/);
  assert.match(ui,/NO ACCESS/);
});

test('source UI uses workspace API and distinguishes public from authenticated access',()=>{
  assert.match(ui,/\/api\/intelligence-sources/);
  assert.match(ui,/Anonymous access/);
  assert.match(ui,/Authenticated access/);
  assert.match(ui,/Google sign-in/);
  assert.match(ui,/does not automatically give LeadIntel access/);
  assert.match(ui,/public/);
  assert.match(ui,/google/);
  assert.match(ui,/username_password/);
  assert.match(ui,/api_key/);
  assert.match(ui,/subscription/);
  assert.match(ui,/manual_only/);
});

test('mandatory source controls are gated by useful audited access and use active strategy signals',()=>{
  assert.match(ui,/\['full','partial'\]\.includes/);
  assert.match(ui,/state\(\)\?\.market\?\.signals/);
  assert.match(ui,/triggerIds/);
  assert.match(ui,/frequency/);
});

test('process map loads Preferred Sources with a versioned runtime',()=>{
  assert.match(processMap,/intelligence-sources-ui\.js\?v=20260915-preferred-sources-v1/);
});

test('Preferred Sources preserves its management and recommendation controls',()=>{
  assert.match(ui,/Preferred sources/);
  assert.match(ui,/Which websites should LeadIntel monitor\?/);
  assert.match(ui,/Add your own preferred source/);
  assert.match(ui,/\+ Add preferred source/);
  assert.match(ui,/Research &amp; recommend sources/);
  assert.match(ui,/You review every recommendation before anything is saved/);
  assert.match(ui,/0 monitoring/);
  assert.match(ui,/host\.append\(panel\)/);
});

test('assistant recommendations reuse verified live discovery and require selection before saving',()=>{
  assert.match(ui,/LeadIntelMarketResearchUx/);
  assert.match(ui,/discoverSources\(root,'deep'\)/);
  assert.match(ui,/data-recommended-source-index/);
  assert.match(ui,/Select at least one recommended website/);
  assert.match(ui,/Add selected sources/);
  assert.match(ui,/test access before monitoring/);
  assert.doesNotMatch(ui,/monitoring_enabled:true/);
});

test('preferred sources live inside Website Scanning monitoring, with no duplicate Strategy section',()=>{
  const {JSDOM}=require('jsdom'),vm=require('node:vm');
  const document=new JSDOM('<section id="step-4"><section class="research-panel"></section></section><div id="website-scanning-monitor"></div>').window.document;
  const code=ui.slice(ui.indexOf('  function ensurePanel()'),ui.indexOf('  function ensureModal()'));
  const context=vm.createContext({document});vm.runInContext(code+';ensurePanel()',context);
  const panel=document.querySelector('[data-intelligence-sources-panel]');
  assert.equal(panel.parentElement.id,'website-scanning-monitor');assert.equal(document.querySelector('#step-4 [data-intelligence-sources-panel]'),null);
  assert.equal(panel.querySelector('summary').textContent,'Preferred sources');
  vm.runInContext('ensurePanel()',context);assert.equal(document.querySelectorAll('[data-intelligence-sources-panel]').length,1);
  assert.ok(panel.querySelector('#preferred-source-url'));assert.ok(panel.querySelector('[data-open-intelligence-sources]'));
});
test('preferred sources wait for the monitoring host rather than attaching to Strategy during startup',()=>{
  const {JSDOM}=require('jsdom'),vm=require('node:vm');const document=new JSDOM('<section id="step-4"></section>').window.document;
  const code=ui.slice(ui.indexOf('  function ensurePanel()'),ui.indexOf('  function ensureModal()'));
  vm.runInNewContext(code+';ensurePanel()',{document});assert.equal(document.querySelector('[data-intelligence-sources-panel]'),null);
});
