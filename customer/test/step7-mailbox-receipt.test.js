const test=require('node:test'),assert=require('node:assert/strict');
const {mailRuntime,providerReceipt}=require('./helpers/production-mail-runtime.js'),D=require('../delivery-engine.js');
function deferred(){let resolve;return {promise:new Promise(done=>resolve=done),resolve};}
for(const provider of ['gmail','microsoft'])for(const change of ['workspace','user'])test(provider+' validated provider receipt remains recoverable only in its original '+change,async()=>{
 const gate=deferred(),h=mailRuntime(provider,()=>gate.promise);
 try{
  const pending=h.send();while(!h.calls.length)await new Promise(setImmediate);
  if(change==='workspace')h.b.workspace.id='w2';else h.b.session.user.id='u2';
  const replacement=JSON.stringify({selectedDomain:'replacement.example',opportunities:[]});h.w.localStorage.setItem('leadintel_customer_v2_delivery',replacement);
  gate.resolve(providerReceipt(provider,'sent',{}, {crm_activity_id:'canonical-mail-activity'}));const result=await pending;
  assert.equal(result.providerConfirmed,true);assert.equal(result.syncWarning,true);assert.equal(h.records,0);assert.equal(h.saves,0);assert.equal(h.w.localStorage.getItem('leadintel_customer_v2_delivery'),replacement);
  const original=D.readSubmissionReceipt(h.w.sessionStorage,'w1','u1',h.pkg,'alex@buyer.example');assert.equal(original.status,'sent');assert.equal(original.provider,provider);assert.equal(original.providerMessageId,provider==='gmail'?'gmail-one':'receipt-one');assert.equal(original.crmActivityId,'canonical-mail-activity');
  assert.equal(D.readSubmissionReceipt(h.w.sessionStorage,h.b.workspace.id,h.b.session.user.id,h.pkg,'alex@buyer.example'),null);
 }finally{h.w.close();}
});
for(const provider of ['gmail','microsoft'])test(provider+' carries the canonical server activity identity into Delivery recording',async()=>{const h=mailRuntime(provider,providerReceipt(provider,'sent',{}, {crm_activity_id:'canonical-mail-activity'}));try{let metadata;h.w.LeadIntelDeliveryUI.confirmSent=async value=>{metadata=value;return {ok:true};};assert.equal((await h.send()).providerConfirmed,true);assert.equal(metadata.crmActivityId,'canonical-mail-activity');assert.equal(h.calls[0].payload.reviewedApprovedAt,h.pkg.approvedAt);}finally{h.w.close();}});
