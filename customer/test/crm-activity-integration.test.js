const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const root=path.join(__dirname,'..');
const outreach=fs.readFileSync(path.join(root,'outreach-ui.js'),'utf8');
const delivery=fs.readFileSync(path.join(root,'delivery-ui.js'),'utf8');
const deliveryEngine=fs.readFileSync(path.join(root,'delivery-engine.js'),'utf8');
const gmail=fs.readFileSync(path.join(root,'production-gmail-ui.js'),'utf8');

test('Campaign Studio writes dossier and approval events to durable CRM',()=>{
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
  const guard=delivery.slice(delivery.indexOf('async function outboundAllowed('),delivery.indexOf('function injectDeliveryUI('));
  const compose=delivery.slice(delivery.indexOf('async function openGmailDraft('),delivery.indexOf('async function confirmSent('));
  assert.match(guard,/await durableCompany\(domain,owner\);requireDeliveryAction\(owner\)/);
  assert.match(guard,/\['suppressed','archived'\]\.includes\(resolved\.company\?\.lifecycle_status\)/);
  assert.match(guard,/\['suppressed','archived'\]\.includes\(detail\.company\.lifecycle_status\)/);
  assert.match(guard,/Restore the CRM company/);
  assert.match(compose,/await outboundAllowed\(pkg\.domain,\{owner,pkg,recipient:owner\.recipient\}\);requireDeliveryAction\(owner\);if\(!allowed\.ok\)/);
  assert.ok(compose.indexOf('await outboundAllowed(')<compose.indexOf('window.open('));
});

test('Gmail API send hands its idempotency key to Delivery confirmation',()=>{
  assert.match(gmail,/leadintel_gmail_crm_activity_key/);
  assert.match(gmail,/deterministicKey/);
});
