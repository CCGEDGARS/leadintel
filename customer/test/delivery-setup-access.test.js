const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const {mailRuntime}=require('./helpers/production-mail-runtime.js');
const tick=()=>new Promise(resolve=>setImmediate(resolve));
test('Delivery navigation is available before profile, strategy or messages without granting access to research',()=>{
 const P=require('../profile-engine.js'),W=require('../workspace-isolation.js'),storage={getItem:()=>null};
 assert.equal(P.canAccessModule({},7),true);assert.equal(W.safeStep(storage,{},7),7);
 assert.equal(P.canAccessModule({},5),false);assert.equal(W.safeStep(storage,{},6),1);
 const app=fs.readFileSync(require.resolve('../app.js'),'utf8'),c={window:{}};vm.createContext(c);vm.runInContext(app.slice(app.indexOf('function campaignModuleAllowed('),app.indexOf('function persistNavigationStep(')),c);
 assert.equal(c.campaignModuleAllowed(7),true);assert.equal(c.campaignModuleAllowed(6),false);
});
test('connected mail cannot send with no approved package and canceling the exact preview does not submit',async()=>{
 const h=mailRuntime();try{
  let review;h.w.LeadIntelDialogs.confirm=async(message,options)=>{review={message,options};return false;};
  await h.send();assert.equal(h.calls.length,0);assert.match(review.message,/sender@north.example/);assert.match(review.message,/alex@buyer.example/);assert.match(review.message,/When: Now/);assert.ok(review.message.includes(h.pkg.drafts.emailBody));assert.equal(review.options.action,'Send email');
  h.w.localStorage.setItem('leadintel_customer_v2_outreach','{"items":[]}');h.w.dispatchEvent(new h.w.CustomEvent('leadintel:module-opened',{detail:{step:7}}));
  assert.equal(h.q('send-with-gmail').disabled,true);assert.equal(h.q('delivery-empty-state').hidden,false);assert.equal(h.q('open-gmail-draft').disabled,true);
 }finally{h.w.close();}
});
async function settings({automaticDelivery='enabled',approved=true}={}){
 const h=mailRuntime();let p={automaticDelivery,mode:'manual',preferredMode:'manual',enabled:false,workingDays:[1,7],workspaceDailyLimit:5,mailboxDailyLimit:5},saves=[],queued=0;
 if(!approved)h.w.localStorage.setItem('leadintel_customer_v2_outreach','{"items":[]}');
 h.b.getOutreachAutomationPolicy=async()=>({ok:true,role:'owner',policy:p});h.b.getOutreachAutomationStatus=async()=>({ok:true,role:'owner'});h.b.listSuppressedContacts=async()=>({ok:true,contacts:[]});
 h.b.saveOutreachAutomationPolicy=async next=>{saves.push(next);p={...next,automaticDelivery,preferredMode:next.mode};return {ok:true};};h.b.enqueueOutreachAutomation=async()=>{queued++;return {ok:true};};h.b.listCrmCompanies=async()=>({ok:true,companies:[]});
 h.w.eval(fs.readFileSync(require.resolve('../outreach-automation-delivery-handoff.js'),'utf8'));h.w.eval(fs.readFileSync(require.resolve('../outreach-automation-ui.js'),'utf8'));await h.w.LeadIntelOutreachAutomationUI.refresh();await new Promise(resolve=>setTimeout(resolve,5));
 return {...h,saves,get queued(){return queued;}};
}
test('settings save/reload keeps an automatic plan off and preserves Sunday without any message',async()=>{
 const h=await settings({automaticDelivery:'manual_only',approved:false});try{
  h.q('oa-mode').value='automatic';h.q('oa-timezone').value='Europe/Stockholm';h.q('oa-followups').value='0';h.q('oa-save').click();await tick();await tick();
  assert.equal(h.saves.length,1);assert.equal(h.saves[0].enabled,false);assert.deepEqual(Array.from(h.saves[0].workingDays),[1,7]);assert.equal(h.queued,0);assert.equal(h.calls.length,0);
  await h.w.LeadIntelOutreachAutomationUI.refresh();assert.equal(h.q('oa-mode').value,'automatic');assert.equal(h.q('oa-timezone').value,'Europe/Stockholm');assert.equal(h.q('oa-followups').value,'0');assert.equal(h.q('oa-activate').disabled,true);
 }finally{h.w.close();}
});
for(const decision of ['cancel','edited','accept'])test('explicit automatic activation '+decision+' retains reviewed authority',async()=>{
 const h=await settings();try{
  let review;h.w.LeadIntelDialogs.confirm=async text=>{review=text;if(decision==='edited')h.q('oa-timezone').value='UTC';return decision!=='cancel';};
  h.q('oa-activate').click();await tick();await tick();
  assert.match(review,/Schedule:/);assert.match(review,/Limits:/);assert.match(review,/Follow-ups:/);assert.match(review,/alex@buyer.example/);assert.ok(review.includes(h.pkg.drafts.emailBody));
  assert.equal(h.saves.length,decision==='accept'?1:0);if(decision==='accept')assert.equal(h.saves[0].enabled,true);assert.equal(h.calls.length,0);
 }finally{h.w.close();}
});
