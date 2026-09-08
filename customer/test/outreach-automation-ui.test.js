const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');

const root=path.join(__dirname,'..');
const read=name=>fs.readFileSync(path.join(root,name),'utf8');

test('Outreach Automation panel exposes all safety controls and live status labels',()=>{
  const ui=read('outreach-automation-ui.js');
  for(const text of [
    'Outreach Automation','Manual','Automatic','10','20','30','50','Custom',
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

test('automation UI is loaded through the lightweight customer extension loader',()=>{
  const loader=read('content-variants.js');
  assert.match(loader,/outreach-automation-ui\.js/);
});

test('automation stylesheet exists and names the panel',()=>{
  const css=read('outreach-automation.css');
  assert.match(css,/\.outreach-automation-panel/);
  assert.match(css,/\.outreach-automation-grid/);
});
