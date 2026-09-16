const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const root=path.join(__dirname,'..');
const outreach=fs.readFileSync(path.join(root,'outreach-ui.js'),'utf8');
const delivery=fs.readFileSync(path.join(root,'delivery-ui.js'),'utf8');
const deliveryEngine=fs.readFileSync(path.join(root,'delivery-engine.js'),'utf8');
const gmail=fs.readFileSync(path.join(root,'production-gmail-ui.js'),'utf8');

test('Content & Scripts writes dossier and approval events to durable CRM',()=>{
  assert.match(outreach,/recordCrmActivity/);
  assert.match(outreach,/dossier\.built/);
  assert.match(outreach,/content\.approved/);
  assert.match(outreach,/addCrmToPipeline/);
  assert.match(outreach,/Ready for Outreach/);
});

test('manual Delivery writes durable send, reply and outcome events',()=>{
  assert.match(delivery,/buildSentCrmActivity/);
  assert.match(deliveryEngine,/type:["']email\.sent["']/);
  for(const type of ['email.reply_received','meeting.recorded','proposal.recorded','deal.won','deal.lost'])assert.match(delivery,new RegExp(type.replace('.','\\.')));
  assert.match(delivery,/recordCrmActivity/);
  assert.match(delivery,/addCrmToPipeline/);
  assert.match(delivery,/markCrmCustomer/);
});

test('manual outbound checks durable CRM suppression before opening Gmail compose',()=>{
  assert.match(delivery,/lifecycle_status\s*===\s*["']suppressed["']/);
  assert.match(delivery,/Suppressed/);
});

test('Gmail API send hands its idempotency key to Delivery confirmation',()=>{
  assert.match(gmail,/leadintel_gmail_crm_activity_key/);
  assert.match(gmail,/deterministicKey/);
});
