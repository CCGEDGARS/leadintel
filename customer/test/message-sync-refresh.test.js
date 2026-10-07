const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),{JSDOM}=require('jsdom');
const read=name=>fs.readFileSync(require.resolve('../'+name),'utf8');
test('finishing sync recovery refreshes Messages after controls are unlocked without editing the draft',()=>{
 for(const failed of [false,true]){
  const dom=new JSDOM('<section class="step-view"><textarea id="draft">My edited Latvian draft</textarea></section><div id="server-conflict-actions"><button id="server-use-server"></button><button id="server-keep-local"></button></div>',{runScripts:'outside-only'}),w=dom.window;
  w.root=w;w.bridge={conflict:true};let renders=0,unlockedAtRender=false;
  w.cancelPendingScriptGeneration=()=>{};w.renderMessageWorkspace=()=>{renders++;unlockedAtRender=!w.document.querySelector('#server-keep-local').disabled&&!w.bridge.resolvingSync;};
  const server=read('server-bridge.js'),ui=read('outreach-ui.js');w.eval(server.slice(server.indexOf('function setConflictBusy('),server.indexOf('function resolveConflictUseServer(')));
  w.eval(ui.slice(ui.indexOf("for(const event of ['leadintel:server-conflict'")));
  w.setConflictBusy(true);assert.equal(renders,1);w.bridge.conflict=failed;
  w.setConflictBusy(false);assert.equal(renders,2);assert.equal(unlockedAtRender,true);assert.equal(w.bridge.conflict,failed);assert.equal(w.document.querySelector('#draft').value,'My edited Latvian draft');
 }
});
test('ordinary server-synced events refresh readiness without cancelling draft generation',()=>{
 const w=new JSDOM('',{runScripts:'outside-only'}).window;w.bridge={resolvingSync:false};w.crmBridge=()=>w.bridge;let renders=0,cancels=0;w.renderMessageWorkspace=()=>renders++;w.cancelPendingScriptGeneration=()=>cancels++;
 const ui=read('outreach-ui.js');w.eval(ui.slice(ui.indexOf("for(const event of ['leadintel:server-conflict'")));
 w.dispatchEvent(new w.CustomEvent('leadintel:server-synced'));assert.equal(renders,1);assert.equal(cancels,0);
 w.bridge.resolvingSync=true;w.dispatchEvent(new w.CustomEvent('leadintel:server-synced'));assert.equal(renders,1);
});
