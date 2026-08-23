const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const ui=fs.readFileSync(path.join(__dirname,'..','production-gmail-ui.js'),'utf8');
const delivery=fs.readFileSync(path.join(__dirname,'..','delivery-ui.js'),'utf8');

test('delivery UI loads production server and Gmail modules',()=>{
  assert.match(delivery,/server-bridge\.js/);assert.match(delivery,/production-gmail-ui\.js/);assert.match(delivery,/loadProductionSaas/);
});

test('production Gmail UI exposes connect send sync disconnect controls',()=>{
  for(const id of ['connect-gmail','send-with-gmail','sync-gmail-replies','disconnect-gmail','production-gmail-status'])assert.match(ui,new RegExp(`id=\\"${id}\\"|id="${id}"`));
  assert.match(ui,/connectGmail/);assert.match(ui,/sendGmail/);assert.match(ui,/syncReplies/);assert.match(ui,/disconnectGmail/);
});

test('production send remains explicit and manual Compose fallback remains in delivery UI',()=>{
  assert.match(ui,/confirm\(`Send this approved email/);assert.match(ui,/q\('confirm-delivery-sent'\)\?\.click\(\)/);assert.match(delivery,/Open Gmail draft/);assert.match(delivery,/Confirm sent/);
});

test('production Gmail UI handles synced replies through existing delivery engine and does not store OAuth tokens',()=>{
  assert.match(ui,/LeadIntelDelivery\.recordReply/);assert.match(ui,/LeadIntelDelivery\.recommendedPipelineStage/);assert.doesNotMatch(ui,/access_token|refresh_token|localStorage\.setItem\([^\n]*token/i);
});
