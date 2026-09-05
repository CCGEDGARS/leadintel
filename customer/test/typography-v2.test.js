const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
function read(name){return fs.readFileSync(path.join(__dirname,'..',name),'utf8');}

test('premium layer defines one reusable readable typography scale',()=>{
  const css=read('premium.css');
  for(const token of ['--type-body:16px','--type-body-sm:15px','--type-secondary:13px','--type-meta:12px','--type-micro:10.5px','--type-control:14px']) assert.match(css,new RegExp(token.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')));
});

test('navigation and process rail no longer use tiny functional copy',()=>{
  const css=read('premium.css');
  assert.match(css,/\.steps li small\{[^}]*font-size:var\(--type-meta\)/s);
  assert.match(css,/\.process-map-head small\{[^}]*font-size:var\(--type-meta\)/s);
  assert.match(css,/\.process-stage strong\{[^}]*font-size:var\(--type-secondary\)/s);
  assert.match(css,/\.process-stage small\{[^}]*font-size:var\(--type-meta\)/s);
});

test('Discovery and pipeline use readable commercial-intelligence text sizes',()=>{
  const css=read('discovery.css');
  assert.match(css,/\.company-score-grid span\{[^}]*font:[^;}]*var\(--type-micro\)/s);
  assert.match(css,/\.candidate-meta>span\{[^}]*font:[^;}]*var\(--type-micro\)/s);
  assert.match(css,/\.candidate-evidence small\{[^}]*font-size:var\(--type-meta\)/s);
  assert.match(css,/\.people-list span,\.people-list small\{[^}]*font-size:var\(--type-meta\)/s);
  assert.match(css,/\.pipeline-row\{[^}]*font-size:var\(--type-secondary\)/s);
  assert.match(css,/\.pipeline-row\.header\{[^}]*font:[^;}]*var\(--type-micro\)/s);
});

test('Market, scripts, delivery and settings share the same readable scale',()=>{
  const market=read('market.css'),outreach=read('outreach.css'),delivery=read('delivery.css'),settings=read('ai-settings.css');
  assert.match(market,/\.strategy-banner span\{[^}]*font:[^;}]*var\(--type-micro\)/s);
  assert.match(market,/\.evidence-links a small\{[^}]*font-size:var\(--type-meta\)/s);
  assert.match(outreach,/\.dossier-card small\{[^}]*font-size:var\(--type-meta\)/s);
  assert.match(outreach,/\.draft-label\{[^}]*font-size:var\(--type-secondary\)/s);
  assert.match(delivery,/\.delivery-control-grid label\{[^}]*font-size:var\(--type-secondary\)/s);
  assert.match(delivery,/\.activity-row small\{[^}]*font-size:var\(--type-meta\)/s);
  assert.match(settings,/\.ai-settings-field\{[^}]*font-size:var\(--type-secondary\)/s);
  assert.match(settings,/\.ai-settings-btn\{[^}]*font:[^;}]*var\(--type-secondary\)/s);
});

test('current static shell assets are cache-busted together',()=>{
  const version='20260826-target-market-v1';
  const html=read('index.html');
  for(const asset of ['styles.css','market.css','premium.css','market-selector.css','profile-engine.js','market-engine.js','discovery-engine.js','app.js','process-map.js','discovery-ui.js']) assert.match(html,new RegExp(`${asset.replace('.','\\.')}\\?v=[a-zA-Z0-9-]+`));
});
