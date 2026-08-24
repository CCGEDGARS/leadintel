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

test('Discovery empty state is compact and the primary action dominates',()=>{
  const discovery=read('discovery.css');
  assert.match(discovery,/\.discovery-panel \.market-empty[^}]*padding:18px/s);
  assert.match(discovery,/\.pipeline-panel \.market-empty[^}]*padding:16px/s);
  assert.match(discovery,/\.discovery-panel \.market-research-head[^}]*align-items:center/s);
  assert.match(discovery,/\.company-score-legend\{[^}]*background:transparent/s);
});

test('production assets are versioned so deployments cannot mix stale CSS and JS',()=>{
  const html=read('index.html');
  assert.match(html,/styles\.css\?v=20260824-typography-v2/);
  assert.match(html,/market\.css\?v=20260824-typography-v2/);
  assert.match(html,/premium\.css\?v=20260824-typography-v2/);
  assert.match(html,/app\.js\?v=20260824-typography-v2/);
  assert.match(html,/process-map\.js\?v=20260824-typography-v2/);
  assert.match(html,/discovery-ui\.js\?v=20260824-typography-v2/);
});

test('dynamic Customer V2 modules keep their own stable cache contract',()=>{
  for(const file of ['discovery-ui.js','outreach-ui.js','delivery-ui.js']){
    const source=read(file);
    assert.match(source,/20260824-premium/);
    assert.match(source,/\?v=/);
  }
  const bridge=read('server-bridge.js');
  assert.match(bridge,/20260824-premium/);
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
