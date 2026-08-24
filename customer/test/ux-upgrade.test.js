const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
function read(name){return fs.readFileSync(path.join(__dirname,'..',name),'utf8');}

test('customer workspace exposes a clickable seven-stage commercial process map',()=>{
  const html=read('index.html');
  const app=read('app.js');
  assert.match(html,/id="commercial-process-map"/);
  for(let step=1;step<=7;step++)assert.match(html,new RegExp(`data-process-step="${step}"`));
  assert.match(html,/Website/);
  assert.match(html,/Content & Scripts/);
  assert.match(html,/Delivery & Learning/);
  assert.match(app,/data-process-step/);
  assert.match(app,/openModule/);
});

test('Step 6 is visibly positioned as the Content and Outreach Studio',()=>{
  const ui=read('outreach-ui.js');
  assert.match(ui,/Content & Outreach Studio/);
  assert.match(ui,/Content & Scripts/);
  assert.doesNotMatch(ui,/<strong>Opportunity dossier<\/strong>/);
});

test('Content and Scripts includes five practical script formats with edit copy regenerate and approval controls',()=>{
  const ui=read('outreach-ui.js');
  for(const id of ['outreach-email-body','outreach-linkedin','outreach-call-opener','outreach-follow-up','outreach-objection-reply']){
    assert.match(ui,new RegExp(`id="${id}"`));
  }
  assert.match(ui,/data-copy-field="call"/);
  assert.match(ui,/data-copy-field="followup"/);
  assert.match(ui,/data-copy-field="objection"/);
  assert.match(ui,/id="regenerate-outreach"/);
  assert.match(ui,/id="approve-outreach"/);
});

test('workspace typography and dense commercial cards use readable responsive layout rules',()=>{
  const styles=read('styles.css');
  const market=read('market.css');
  assert.match(styles,/--workspace-text:\s*16px/);
  assert.match(styles,/\.process-map/);
  assert.match(styles,/\.process-stage/);
  assert.match(styles,/\.intelligence-banner\{[^}]*grid-template-columns:minmax\(0,1fr\) auto/s);
  assert.match(market,/\.icp-list\{[^}]*grid-template-columns:repeat\(2,minmax\(0,1fr\)\)/s);
  assert.match(market,/\.icp-card input[^}]*font:[^;}]*13px/s);
});
