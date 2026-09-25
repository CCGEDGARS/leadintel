const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const outreachEngine = require('../outreach-engine.js');
function read(name){return fs.readFileSync(path.join(__dirname,'..',name),'utf8');}

test('customer workspace exposes a clickable seven-stage commercial process map',()=>{
  const html=read('index.html');
  const processMap=read('process-map.js');
  assert.match(html,/id="commercial-process-map"/);
  for(let step=1;step<=7;step++)assert.match(html,new RegExp(`data-process-step="${step}"`));
  assert.match(html,/Website/);
  for(const label of ['Setup','Profile','Strategy','Companies','Buyers','Messages','Delivery'])assert.match(html,new RegExp(label));
  assert.match(html,/src="process-map\.js(?:\?[^\"]*)?"/);
  assert.match(processMap,/data-process-step/);
  assert.match(processMap,/data-workflow-stage/);
  assert.match(processMap,/dispatchEvent/);
  assert.match(processMap,/leadintel:module-opened/);
});

test('Step 6 is visibly positioned as Messages',()=>{
  const ui=read('outreach-ui.js');
  const nextAction=read('workflow-next-action.js');
  assert.match(ui,/Step 6 · Messages/);
  assert.match(nextAction,/Continue to Delivery/);
  assert.doesNotMatch(ui,/<strong>Opportunity dossier<\/strong>/);
});

test('Companies and Buyers read the same CRM-backed pipeline snapshot',()=>{
  const discovery=read('discovery-ui.js');
  const outreach=read('outreach-ui.js');
  assert.match(discovery,/LeadIntelDiscoveryUI=\{open:openDiscoveryFromHandoff\};window\.LeadIntelDiscoveryUI\.getPipeline=pipelineRows/);
  assert.match(outreach,/function pipeline\(\)\{const shared=window\.LeadIntelDiscoveryUI\?\.getPipeline\?\.\(\);return Array\.isArray\(shared\)\?shared:/);
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

test('outreach engine generates and persists practical sales scripts',()=>{
  const drafts=outreachEngine.buildOutreachDrafts({company:'Acme',recommendedOffer:'AI automation',matchedSignals:[{name:'expansion'}],evidence:[]},{firstName:'Anna'},{companyName:'LeadIntel'},'consultative');
  assert.ok(drafts.callOpener);
  assert.ok(drafts.followUp);
  assert.ok(drafts.objectionReply);
  const normalized=outreachEngine.normalizeOutreachState({selectedDomain:'acme.com',items:[{domain:'acme.com',drafts}]});
  assert.equal(normalized.items[0].drafts.callOpener,drafts.callOpener);
  assert.equal(normalized.items[0].drafts.followUp,drafts.followUp);
  assert.equal(normalized.items[0].drafts.objectionReply,drafts.objectionReply);
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
