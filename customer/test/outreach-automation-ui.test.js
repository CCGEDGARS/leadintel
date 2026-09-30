const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');

const root=path.join(__dirname,'..');
const read=name=>fs.readFileSync(path.join(root,name),'utf8');

test('Outreach Automation panel exposes all safety controls and live status labels',()=>{
  const ui=read('outreach-automation-ui.js');
  for(const text of [
    'Outreach Automation','Manual','Automatic','5','10','20','Custom',
    'Mailbox daily limit','Working days','Timezone','Send window','Delay range',
    'Follow-ups','Pause automation','Resume automation','Emergency stop',
    'Sent today','Queue','Next send','Queue preview','Blocked reason'
  ]) assert.match(ui,new RegExp(text.replace(/[.*+?^${}()|[\]\\]/g,'\\$&'),'i'),`missing ${text}`);
  assert.match(ui,/approved contacts may be emailed without per-message confirmation/i);
  assert.match(ui,/window\.confirm/);
});

test('owner mutation and non-owner read-only behavior are explicit',()=>{
  const ui=read('outreach-automation-ui.js');
  assert.match(ui,/function isOwner\(\)/);
  assert.match(ui,/===['"]owner['"]/);
  assert.match(ui,/node\.disabled\s*=\s*true/);
  assert.match(ui,/saveOutreachAutomationPolicy/);
  assert.match(ui,/getOutreachAutomationPolicy/);
  assert.match(ui,/getOutreachAutomationStatus/);
});

test('approved contact queue action is explicit and gated by automatic mode and Gmail',()=>{
  const ui=read('outreach-automation-ui.js');
  assert.match(ui,/Add approved contact to automatic queue/i);
  assert.match(ui,/enqueueOutreachAutomation/);
  assert.match(ui,/serverPolicy\(\)/);
  assert.match(ui,/\.mode===['"]automatic['"]/);
  assert.match(ui,/\.enabled/);
  assert.match(ui,/gmail/i);
  assert.match(ui,/leadintel:approved-outreach-package/);
});

test('automation UI is loaded through the Setup and Delivery lazy loader',()=>{
  const processMap=read('process-map.js');
  const loader=read('outreach-automation-loader.js');
  assert.match(processMap,/outreach-automation-loader\.js/);
  assert.match(loader,/outreach-automation-ui\.js/);
  assert.match(loader,/maybeLoad\(event\.detail\?\.step\)/);
  assert.match(loader,/Number\(step\)===1\|\|Number\(step\)===7/);
});

test('setup offers the same server-backed limits under brand identity',()=>{
  const ui=read('outreach-automation-ui.js');
  assert.match(ui,/document\.getElementById\('brand-identity'\)/);
  assert.match(ui,/brand\.after\(card\)/);
  assert.match(ui,/saveOutreachAutomationPolicy/);
  assert.match(ui,/Saving a limit will not send email/);
  assert.match(ui,/delivery-setup-mode/);
  assert.match(ui,/Connect Gmail before enabling automatic delivery/);
  assert.match(ui,/root\.confirm\('Activate automatic Gmail delivery/);
  assert.match(ui,/Meeting requests/);
});

test('automation stylesheet exists and names the panel',()=>{
  const css=read('outreach-automation.css');
  assert.match(css,/\.outreach-automation-panel/);
  assert.match(css,/\.outreach-automation-grid/);
});

test('automation panel waits for Delivery instead of appearing in Messages during Setup',()=>{
  const ui=read('outreach-automation-ui.js');
  assert.match(ui,/document\.querySelector\('\.step-view\[data-step="7"\]'\)/);
  assert.match(ui,/if\(!destination\)return/);
  assert.doesNotMatch(ui,/\.step-view\[data-step="6"\]/);
});

test('manual Delivery keeps workspace-wide do-not-contact controls visible',()=>{
  const ui=read('outreach-automation-ui.js');const bridge=read('outreach-automation-bridge.js');
  assert.match(ui,/renderSuppression\(destination\)/);
  assert.match(ui,/Do not contact/);
  assert.match(ui,/suppressOutreachContact/);
  assert.match(ui,/listSuppressedContacts/);
  assert.match(bridge,/api\/outreach-automation\/suppression/);
});
