const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const root=path.join(__dirname,'..');
const handoff=fs.readFileSync(path.join(root,'outreach-automation-delivery-handoff.js'),'utf8');
const delivery=fs.readFileSync(path.join(root,'delivery-ui.js'),'utf8');
const processMap=fs.readFileSync(path.join(root,'process-map.js'),'utf8');
const loader=fs.readFileSync(path.join(root,'outreach-automation-loader.js'),'utf8');

test('Delivery handoff emits approved package plus explicit recipient without auto-enqueueing',()=>{
  assert.match(handoff,/leadintel:approved-outreach-package/);
  assert.match(handoff,/delivery-recipient/);
  assert.match(handoff,/approvedAt/);
  assert.match(handoff,/emailSubject/);
  assert.match(handoff,/buildApprovedSendPayload/);
  assert.match(handoff,/followUp/);
  assert.match(handoff,/contact_identity/);
  assert.doesNotMatch(handoff,/enqueueOutreachAutomation\(/,'handoff may announce but must never enqueue automatically');
  assert.doesNotMatch(delivery,/enqueueOutreachAutomation\(/,'legacy manual Delivery must remain explicit');
});

test('handoff refreshes when approved opportunity or recipient changes and is loaded lazily for Delivery',()=>{
  assert.match(handoff,/announceApprovedAutomationPackage/);
  assert.match(handoff,/delivery-company-select/);
  assert.match(handoff,/delivery-recipient/);
  assert.match(handoff,/addEventListener\('input'/);
  assert.match(handoff,/addEventListener\('change'/);
  assert.match(processMap,/outreach-automation-loader\.js/);
  assert.match(loader,/outreach-automation-delivery-handoff\.js/);
});

test('early handoff waits for Delivery readiness and then announces the exact selected buyer',()=>{
  const {JSDOM}=require('jsdom'),engine=require('../delivery-engine.js');
  const dom=new JSDOM('<input id="delivery-recipient" value="bob@buyer.test">',{url:'https://example.test/customer/',runScripts:'outside-only'}),w=dom.window,timers=[],announced=[];
  try{
    const O=require('../outreach-engine.js');w.LeadIntelOutreach=O;const make=id=>{const item={domain:'buyer.test',company:'Buyer',channel:'email',selectedPersonId:id,dossier:{domain:'buyer.test',company:'Buyer',people:[{id,name:id,email:id+'@buyer.test'}]},drafts:{emailSubject:'Hello '+id,emailBody:'Message for '+id},campaignScenario:{id:'core',language:'en',resolvedLanguage:'en'},localizationStatus:'complete',localizationApprovalBlocked:false,localizationProvenance:{provider:'manual',model:'reviewed',language:'en',selectionSource:'manual'}};return O.approveOutreachItem(item,item.drafts,'2026-10-24T10:00:00Z');},alice=make('alice'),bob=make('bob');
    w.localStorage.setItem('leadintel_customer_v2_outreach',JSON.stringify({items:[alice,bob]}));
    w.localStorage.setItem('leadintel_customer_v2_delivery',JSON.stringify({selectedDomain:'buyer.test',selectedPackageKey:engine.packageKey(bob)}));
    w.setTimeout=fn=>{timers.push(fn);return timers.length;};
    w.addEventListener('leadintel:approved-outreach-package',e=>announced.push(e.detail));
    w.eval(handoff);w.document.dispatchEvent(new w.Event('DOMContentLoaded'));
    assert.doesNotThrow(()=>timers.splice(0).forEach(fn=>fn()));
    assert.equal(announced.length,0,'no approximate package before the Delivery engine is loaded');
    w.LeadIntelDelivery=engine;w.dispatchEvent(new w.CustomEvent('leadintel:delivery-ready'));
    assert.equal(announced.length,1);assert.equal(announced[0].subject,'Hello bob');assert.equal(announced[0].recipient,'bob@buyer.test');
    announced.length=0;
    w.localStorage.setItem('leadintel_customer_v2_outreach',JSON.stringify({items:[{...bob,approved:false}]}));
    w.dispatchEvent(new w.CustomEvent('leadintel:delivery-ready'));
    assert.equal(announced.length,0,'canonical approval filtering excludes an unapproved package');
  }finally{w.close();}
});
