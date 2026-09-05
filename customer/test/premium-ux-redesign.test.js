const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
function read(name){return fs.readFileSync(path.join(__dirname,'..',name),'utf8');}

test('commercial journey renders as one premium non-wrapping rail instead of native-looking buttons',()=>{
  const styles=read('premium.css');
  assert.match(styles,/\.process-track\{[^}]*display:flex[^}]*flex-wrap:nowrap[^}]*overflow-x:auto/s);
  assert.match(styles,/\.process-stage\{[^}]*appearance:none[^}]*border:0[^}]*background:transparent/s);
  assert.match(styles,/\.process-stage::before/);
  assert.match(styles,/\.process-stage\.active[^}]*color:var\(--ink\)/s);
});

test('sidebar is simplified and duplicate future-module stack is removed',()=>{
  const html=read('index.html');
  const styles=read('premium.css');
  assert.doesNotMatch(html,/class="future-stack"/);
  assert.match(styles,/\.progress-panel\{[^}]*width:auto/s);
  assert.match(styles,/\.steps li\.active\{[^}]*box-shadow:none/s);
});

test('workspace uses executive typography and constrained readable content width',()=>{
  const styles=read('premium.css');
  assert.match(styles,/\.content\{[^}]*max-width:1180px/s);
  assert.match(styles,/\.hero-copy h1\{[^}]*font-size:44px/s);
  assert.match(styles,/\.profile-header h1\{[^}]*font-size:40px/s);
  assert.match(styles,/\.panel\{[^}]*border-radius:18px/s);
});

test('optional source inputs stay compact instead of dominating onboarding',()=>{
  const html=read('index.html');
  const styles=read('compact-sources.css');
  assert.match(html,/compact-sources\.css\?v=20260826-compact-sources-v1/);
  assert.match(html,/id="additional-links" rows="3"/);
  assert.match(styles,/#additional-links\{[^}]*height:108px[^}]*min-height:108px[^}]*max-height:180px/s);
  assert.match(styles,/\.upload-zone\{[^}]*min-height:118px/s);
  assert.match(styles,/@media\(max-width:680px\)[\s\S]*#additional-links\{[^}]*height:96px[^}]*min-height:96px/s);
  assert.match(styles,/@media\(max-width:680px\)[\s\S]*\.upload-zone\{[^}]*min-height:104px/s);
});

test('Discovery empty state is compact and the primary action dominates',()=>{
  const discovery=read('discovery.css');
  assert.match(discovery,/\.discovery-panel \.market-empty[^}]*padding:18px/s);
  assert.match(discovery,/\.pipeline-panel \.market-empty[^}]*padding:16px/s);
  assert.match(discovery,/\.discovery-panel \.market-research-head[^}]*align-items:center/s);
  assert.match(discovery,/\.company-score-legend\{[^}]*background:transparent/s);
});

test('target market release assets are versioned together so browsers cannot mix onboarding generations',()=>{
  const html=read('index.html');
  const version='20260826-target-market-v1';
  for(const asset of ['styles.css','market.css','premium.css','market-selector.css','profile-engine.js','market-engine.js','discovery-engine.js','app.js','process-map.js','discovery-ui.js']){
    assert.match(html,new RegExp(asset.replace('.','\\.')+`\\?v=[a-zA-Z0-9-]+`));
  }
});

test('target market selector has a dedicated responsive styling layer',()=>{
  const html=read('index.html');
  const selector=read('market-selector.css');
  assert.match(html,/market-selector\.css\?v=20260826-target-market-v1/);
  assert.match(selector,/\.market-chip\.selected/);
  assert.match(selector,/\.selected-market-chip/);
  assert.match(selector,/@media\(max-width:720px\)/);
});

test('dynamic Customer V2 modules keep their own stable cache contract',()=>{
  for(const file of ['discovery-ui.js','outreach-ui.js','delivery-ui.js']){
    const source=read(file);
    assert.match(source,/20260828-master-crm-v1/);
    assert.match(source,/\?v=/);
  }
  const bridge=read('server-bridge.js');
  assert.match(bridge,/20260828-master-crm-v1/);
  assert.match(bridge,/server\.css/);
  assert.match(bridge,/\?v=/);
});

test('Step 6 terminology is consistently Content and Scripts across the current UI',()=>{
  const discovery=read('discovery-ui.js');
  const outreach=read('outreach-ui.js');
  const delivery=read('delivery-ui.js');
  assert.doesNotMatch(discovery,/Opportunity Dossiers/);
  assert.doesNotMatch(outreach,/<strong>Opportunity dossier<\/strong>/);
  assert.doesNotMatch(delivery,/← Dossier/);
  assert.match(discovery,/Content & Outreach Studio/);
  assert.match(outreach,/Content & Scripts/);
  assert.match(delivery,/Content & Scripts/);
});
