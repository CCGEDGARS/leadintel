const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const root=path.join(__dirname,'..');
const read=name=>fs.readFileSync(path.join(root,name),'utf8');

test('legacy manual Gmail delivery remains explicit and automation stays separate',()=>{
  const delivery=read('delivery-ui.js');
  const gmail=read('production-gmail-ui.js');
  const automation=read('outreach-automation-ui.js');
  assert.match(delivery,/Open Gmail draft/);
  assert.match(delivery,/Confirm sent/);
  assert.match(gmail,/sendGmail|send/i);
  assert.doesNotMatch(delivery,/enqueueOutreachAutomation\(/);
  assert.doesNotMatch(gmail,/enqueueOutreachAutomation\(/);
  assert.match(automation,/Add approved contact to automatic queue/);
  assert.match(automation,/enqueueOutreachAutomation/);
});

test('automatic handoff requires a Step 6 approved package and explicit Step 7 recipient',()=>{
  const handoff=read('outreach-automation-delivery-handoff.js');
  assert.match(handoff,/item&&item\.approved/);
  assert.match(handoff,/delivery\.selectedDomain/);
  assert.match(handoff,/delivery-recipient/);
  assert.match(handoff,/approved:true/);
  assert.doesNotMatch(handoff,/fetch\(/,'handoff must not send or call backend by itself');
});

test('automatic UI exposes fail-safe server controls before any queue action',()=>{
  const ui=read('outreach-automation-ui.js');
  const bridge=read('outreach-automation-bridge.js');
  for(const token of ['getOutreachAutomationPolicy','getOutreachAutomationStatus','saveOutreachAutomationPolicy','enqueueOutreachAutomation'])assert.match(bridge,new RegExp(token));
  assert.match(ui,/p\.mode===['"]automatic['"]/);
  assert.match(ui,/p\.enabled/);
  assert.match(ui,/gmail\?\.connected/);
  assert.match(ui,/approvedPackage/);
  assert.match(ui,/Emergency stop/);
  assert.match(ui,/Pause automation/);
});
