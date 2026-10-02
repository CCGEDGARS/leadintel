const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const source=fs.readFileSync(require.resolve('../outreach-automation-ui.js'),'utf8');
function harness(overrides={}){
 const listeners={},control={value:'5',addEventListener:()=>{}};
 const card={appendChild(){},innerHTML:'',querySelector(selector){if(selector==='#delivery-setup-retry')return this.innerHTML.includes('id="delivery-setup-retry"')?{addEventListener:(event,fn)=>{listeners.retry=fn}}:null;return control;},querySelectorAll:()=>[]};
 const bridge={session:{authenticated:true},workspace:{id:'w1'},getOutreachAutomationPolicy:async()=>({ok:true,role:'owner',policy:{mode:'manual',workspaceDailyLimit:5}}),getOutreachAutomationStatus:async()=>({ok:true,role:'owner'}),...overrides};
 const context={LeadIntelServerBridge:bridge};vm.createContext(context);vm.runInContext(source,context);
 context.document={createElement:()=>({appendChild(){}}),getElementById:id=>id==='brand-identity'?{}:id==='delivery-setup'?card:null,querySelector:()=>null};
 return {context,bridge,card,listeners,refresh:context.LeadIntelOutreachAutomationUI.refresh};
}
test('signed-in policy failure shows its error and retry instead of false sign-in message',async()=>{
 const h=harness({getOutreachAutomationPolicy:async()=>({ok:false,error:'Policy request timed out'})});await h.refresh();assert.match(h.card.innerHTML,/Policy request timed out/);assert.doesNotMatch(h.card.innerHTML,/Sign in to save/);assert.match(h.card.innerHTML,/<fieldset[^>]*disabled/);assert.equal(typeof h.listeners.retry,'function');
 h.bridge.getOutreachAutomationPolicy=async()=>({ok:true,role:'owner',policy:{mode:'manual'}});await h.listeners.retry();assert.doesNotMatch(h.card.innerHTML,/<fieldset[^>]*disabled/);
});
test('live status failure does not disable successfully loaded owner preferences',async()=>{
 const h=harness({getOutreachAutomationStatus:async()=>({ok:false,error:'Status unavailable'})});await h.refresh();assert.doesNotMatch(h.card.innerHTML,/<fieldset[^>]*disabled/);assert.doesNotMatch(h.card.innerHTML,/Sign in to save/);
});
test('late settings response cannot render policy for another workspace',async()=>{
 let resolve;const h=harness({getOutreachAutomationPolicy:()=>new Promise(done=>{resolve=done})});const pending=h.refresh();h.bridge.workspace.id='w2';resolve({ok:true,role:'owner',policy:{mode:'automatic'}});await pending;assert.doesNotMatch(h.card.innerHTML,/value="automatic" checked/);
});
test('signed-out user remains disabled without requesting protected settings',async()=>{
 const h=harness({session:{authenticated:false},getOutreachAutomationPolicy:()=>{throw Error('must not request')}});await h.refresh();assert.match(h.card.innerHTML,/Sign in to save/);assert.match(h.card.innerHTML,/<fieldset[^>]*disabled/);
});
test('intentless bridge save delegates to persistence owner instead of rejected synthetic PUT',async()=>{
 const text=fs.readFileSync(require.resolve('../server-bridge.js'),'utf8'),context={bridge:{session:{authenticated:true},workspace:{id:'w1'},stateVersion:9},root:{LeadIntelWorkspacePersistence:{saveWorkspace:async options=>{assert.equal(options.automatic,true);context.saved=true;return true;}}},resetRecordMatchesWorkspace:()=>false,SERVER_RESET_PENDING_KEY:"reset",clearTimeout:()=>{},saveTimer:null};
 vm.createContext(context);vm.runInContext(text.slice(text.indexOf('async function saveNow('),text.indexOf('async function saveWorkspaceState(')),context);const result=await context.saveNow();assert.equal(result.saved,true);assert.equal(result.version,9);assert.equal(context.saved,true);
 context.bridge.session.authenticated=false;context.saved=false;assert.equal((await context.saveNow()).saved,false);assert.equal(context.saved,false);
});
