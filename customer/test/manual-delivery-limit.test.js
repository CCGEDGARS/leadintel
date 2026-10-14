const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const {JSDOM}=require('jsdom');
const source=fs.readFileSync(require.resolve('../outreach-automation-ui.js'),'utf8');
async function harness(mode='manual'){
 const dom=new JSDOM('<div id="brand-identity"></div>');
 const style=dom.window.document.createElement('style');style.textContent=fs.readFileSync(require.resolve('../outreach-automation.css'),'utf8');dom.window.document.head.appendChild(style);
 let policy={mode,preferredMode:mode,automaticDelivery:'manual_only',enabled:false,workspaceDailyLimit:37,mailboxDailyLimit:42};const saves=[];
 const bridge={session:{authenticated:true},workspace:{id:'w1'},getOutreachAutomationPolicy:async()=>({ok:true,role:'owner',policy:{...policy}}),getOutreachAutomationStatus:async()=>({ok:true,role:'owner'}),saveOutreachAutomationPolicy:async p=>{saves.push(p);policy={...p,preferredMode:p.mode};return {ok:true};}};
 const context={LeadIntelServerBridge:bridge};vm.createContext(context);vm.runInContext(source,context);context.document=dom.window.document;
 await context.LeadIntelOutreachAutomationUI.refresh();
 const doc=dom.window.document;
 const selectMode=value=>{const radio=doc.querySelector(`[name="delivery-setup-mode"][value="${value}"]`);radio.checked=true;radio.dispatchEvent(new dom.window.Event('change'));};
 const save=async()=>{doc.querySelector('#delivery-setup-save').click();await new Promise(resolve=>setImmediate(resolve));};
 return {dom,doc,saves,selectMode,save,refresh:context.LeadIntelOutreachAutomationUI.refresh};
}
test('manual setup hides daily limit, automatic reveals saved custom limit and switching preserves it',async t=>{
 const h=await harness();t.after(()=>h.dom.window.close());const controls=()=>h.doc.querySelector('#delivery-setup-limit').parentElement;
 assert.equal(h.dom.window.getComputedStyle(controls()).display,'none');assert.equal(h.doc.querySelector('#delivery-setup-save').hidden,false);
 h.selectMode('automatic');assert.notEqual(h.dom.window.getComputedStyle(controls()).display,'none');assert.equal(h.doc.querySelector('#delivery-setup-limit').value,'custom');assert.equal(h.doc.querySelector('#delivery-setup-custom').value,'37');
 h.selectMode('manual');assert.equal(h.dom.window.getComputedStyle(controls()).display,'none');h.selectMode('automatic');assert.equal(h.doc.querySelector('#delivery-setup-custom').value,'37');
});
test('manual save ignores hidden draft validation and preserves both saved automatic limits on reload',async t=>{
 const h=await harness('automatic');t.after(()=>h.dom.window.close());h.doc.querySelector('#delivery-setup-custom').value='0';h.selectMode('manual');await h.save();
 assert.equal(h.saves.length,1);assert.equal(h.saves[0].mode,'manual');assert.equal(h.saves[0].enabled,false);assert.equal(h.saves[0].workspaceDailyLimit,37);assert.equal(h.saves[0].mailboxDailyLimit,42);
 await h.refresh();h.selectMode('automatic');assert.equal(h.doc.querySelector('#delivery-setup-custom').value,'37');
});
test('automatic setup validates and saves a changed custom limit without activating sending',async t=>{
 const h=await harness();t.after(()=>h.dom.window.close());h.selectMode('automatic');h.doc.querySelector('#delivery-setup-custom').value='0';await h.save();assert.equal(h.saves.length,0);assert.match(h.doc.querySelector('#delivery-setup-message').textContent,/whole number/);
 h.doc.querySelector('#delivery-setup-custom').value='23';await h.save();assert.equal(h.saves.length,1);assert.equal(h.saves[0].workspaceDailyLimit,23);assert.equal(h.saves[0].enabled,false);assert.notEqual(h.dom.window.getComputedStyle(h.doc.querySelector('#delivery-setup-limit').parentElement).display,'none');
});
