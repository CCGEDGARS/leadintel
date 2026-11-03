const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const {JSDOM}=require('jsdom');
const source=fs.readFileSync(require.resolve('../outreach-automation-ui.js'),'utf8');
const tick=()=>new Promise(setImmediate);
function deferred(){let resolve;const promise=new Promise(done=>resolve=done);return {promise,resolve};}
async function harness(t){
 const dom=new JSDOM('<div id="brand-identity"></div>');t.after(()=>dom.window.close());
 let policy={mode:'manual',preferredMode:'manual',automaticDelivery:'manual_only',enabled:false,workspaceDailyLimit:10,mailboxDailyLimit:10};
 const saves=[],bridge={session:{authenticated:true},workspace:{id:'one',role:'owner'},getOutreachAutomationPolicy:async()=>({ok:true,role:'owner',policy:{...policy}}),getOutreachAutomationStatus:async()=>({ok:true,role:'owner'}),saveOutreachAutomationPolicy:async value=>{saves.push(value);policy={...value,preferredMode:value.mode};return {ok:true};}};
 const context={LeadIntelServerBridge:bridge};vm.createContext(context);vm.runInContext(source,context);context.document=dom.window.document;
 const refresh=context.LeadIntelOutreachAutomationUI.refresh;await refresh();
 const doc=dom.window.document,mode=value=>doc.querySelector(`[name="delivery-setup-mode"][value="${value}"]`),select=value=>{mode(value).checked=true;mode(value).dispatchEvent(new dom.window.Event('change'));};
 return {doc,bridge,saves,refresh,select,mode,dom};
}
test('Setup keeps all preference controls locked until the saved policy refresh finishes',async t=>{
 const h=await harness(t),saved=deferred(),status=deferred(),original=h.bridge.saveOutreachAutomationPolicy;
 h.bridge.saveOutreachAutomationPolicy=async value=>{await saved.promise;return original(value);};
 h.bridge.getOutreachAutomationStatus=()=>status.promise;
 h.select('automatic');h.doc.querySelector('#delivery-setup-save').click();await tick();
 assert.equal(h.mode('manual').matches(':disabled'),true,'cannot edit while PUT is pending');
 assert.equal(h.doc.querySelector('#delivery-setup-limit').disabled,true);
 saved.resolve();await tick();
 assert.equal(h.mode('automatic').checked,true,'refresh must retain the submitted choice');
 assert.equal(h.mode('manual').matches(':disabled'),true,'post-write refresh is still pending');
 assert.equal(h.doc.querySelector('#delivery-setup-save').disabled,true);
 assert.doesNotMatch(h.doc.querySelector('#delivery-setup-message').textContent,/Settings saved/);
 status.resolve({ok:true,role:'owner'});await tick();
 assert.equal(h.mode('automatic').checked,true);assert.equal(h.mode('manual').matches(':disabled'),false);
 assert.equal(h.doc.querySelector('#delivery-setup-save').disabled,false);
 assert.match(h.doc.querySelector('#delivery-setup-message').textContent,/Settings saved/);
 h.select('manual');h.doc.querySelector('#delivery-setup-save').click();await tick();
 assert.deepEqual(h.saves.map(value=>value.mode),['automatic','manual']);
 assert.ok(h.saves.every(value=>value.enabled===false),'preference saves must not activate sending');
});
test('a late background refresh preserves an unsaved mode and custom limit',async t=>{
 const h=await harness(t),status=deferred();h.bridge.getOutreachAutomationStatus=()=>status.promise;
 const refreshing=h.refresh();h.select('automatic');
 const choice=h.doc.querySelector('#delivery-setup-limit');choice.value='custom';choice.dispatchEvent(new h.dom.window.Event('change'));
 const custom=h.doc.querySelector('#delivery-setup-custom');custom.value='23';custom.dispatchEvent(new h.dom.window.Event('input'));
 status.resolve({ok:true,role:'owner'});await refreshing;
 assert.equal(h.mode('automatic').checked,true);assert.equal(h.doc.querySelector('#delivery-setup-custom').value,'23');
 assert.match(h.doc.querySelector('#delivery-setup-badge').textContent,/Save to keep/);
 h.doc.querySelector('#delivery-setup-save').click();await tick();
 assert.equal(h.saves[0].workspaceDailyLimit,23);assert.equal(h.saves[0].enabled,false);
});
test('a failed save keeps the editable draft and cannot leak it to a different workspace',async t=>{
 const h=await harness(t);h.bridge.saveOutreachAutomationPolicy=async()=>({ok:false,error:'Connection interrupted. Retry.'});
 h.select('automatic');h.doc.querySelector('#delivery-setup-save').click();await tick();
 assert.equal(h.mode('automatic').checked,true);assert.equal(h.mode('manual').matches(':disabled'),false);
 assert.match(h.doc.querySelector('#delivery-setup-message').textContent,/Connection interrupted/);
 h.bridge.workspace={id:'two',role:'owner'};await h.refresh();
 assert.equal(h.mode('manual').checked,true);assert.doesNotMatch(h.doc.querySelector('#delivery-setup-badge').textContent,/Save to keep/);
});
test('an acknowledged save with a failed policy refresh keeps the submitted preference and honest recovery',async t=>{
 const h=await harness(t);h.select('automatic');h.bridge.getOutreachAutomationPolicy=async()=>({ok:false,error:'Post-save policy unavailable'});
 h.doc.querySelector('#delivery-setup-save').click();await tick();
 assert.equal(h.saves[0].mode,'automatic');assert.equal(h.mode('automatic').checked,true);
 assert.doesNotMatch(h.doc.querySelector('#delivery-setup-message').textContent,/Settings saved\./);
 assert.match(h.doc.querySelector('#delivery-setup-message').textContent,/saved.*refresh|saved.*reload/i);
 assert.ok(h.doc.querySelector('#delivery-setup-retry'));
 h.bridge.getOutreachAutomationPolicy=async()=>({ok:true,role:'owner',policy:{...h.saves[0],preferredMode:'automatic'}});
 await h.refresh();assert.equal(h.mode('automatic').checked,true);assert.equal(h.doc.querySelector('#delivery-setup-save').disabled,false);
 assert.doesNotMatch(h.doc.querySelector('#delivery-setup-badge').textContent,/Save to keep/);
});
test('a superseded post-save refresh waits for the current refresh acknowledgement',async t=>{
 const h=await harness(t),first=deferred(),second=deferred();let reads=0;
 h.bridge.getOutreachAutomationStatus=()=>++reads===1?first.promise:second.promise;
 h.select('automatic');h.doc.querySelector('#delivery-setup-save').click();await tick();
 const newer=h.refresh();first.resolve({ok:true,role:'owner'});await tick();
 assert.equal(h.mode('automatic').checked,true);assert.equal(h.doc.querySelector('#delivery-setup-save').disabled,true);
 assert.doesNotMatch(h.doc.querySelector('#delivery-setup-message').textContent,/Settings saved\./);
 second.resolve({ok:true,role:'owner'});await newer;await tick();
 assert.equal(h.mode('automatic').checked,true);assert.equal(h.doc.querySelector('#delivery-setup-save').disabled,false);
 assert.match(h.doc.querySelector('#delivery-setup-message').textContent,/Settings saved\./);
});
test('mailbox status loading cannot erase a draft owned by the same workspace',async t=>{
 const h=await harness(t);h.select('automatic');h.bridge.gmail={loading:false,loaded:true,connected:false};await h.refresh();
 assert.equal(h.mode('automatic').checked,true);assert.match(h.doc.querySelector('#delivery-setup-badge').textContent,/Save to keep/);
 assert.equal(h.saves.length,0);
});
test('mailbox status changes keep an in-flight preference single flight until its own acknowledgement',async t=>{
 const h=await harness(t),pending=deferred(),original=h.bridge.saveOutreachAutomationPolicy;
 h.bridge.saveOutreachAutomationPolicy=async value=>{await pending.promise;return original(value);};
 h.select('automatic');h.doc.querySelector('#delivery-setup-save').click();await tick();
 h.bridge.gmail={loading:false,loaded:true,connected:false};await h.refresh();
 assert.equal(h.mode('manual').matches(':disabled'),true);assert.equal(h.doc.querySelector('#delivery-setup-save').disabled,true);
 h.doc.querySelector('#delivery-setup-save').click();assert.equal(h.saves.length,0);
 pending.resolve();await tick();
 assert.equal(h.saves.length,1);assert.equal(h.saves[0].mode,'automatic');assert.equal(h.mode('automatic').checked,true);
 assert.match(h.doc.querySelector('#delivery-setup-message').textContent,/Settings saved\./);
 assert.equal(h.doc.querySelector('#delivery-setup-save').disabled,false);
});
