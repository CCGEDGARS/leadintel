const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const {JSDOM}=require('jsdom');
const OLD='1'.repeat(40),NEW='2'.repeat(40);
function harness(){
 const dom=new JSDOM(`<meta name="leadintel-release" content="${OLD}"><input id="draft" value="My unfinished message">`,{url:'https://leadintel.ccgroup.lv/customer/?tab=settings#profile'});
 const listeners={},calls=[],navigation=[],context={document:dom.window.document,location:{href:dom.window.location.href,assign:url=>navigation.push(url)},URL,AbortSignal,fetch:async(url,options)=>{calls.push({url,options});return {ok:true,json:async()=>({service:'leadintel-customer',commit:NEW})};},addEventListener:(event,fn)=>{listeners[event]=fn;},setInterval:()=>1,setTimeout,clearTimeout};
 vm.createContext(context);vm.runInContext(fs.readFileSync(require.resolve('../release-freshness.js'),'utf8'),context);
 return {dom,context,listeners,calls,navigation,api:context.LeadIntelReleaseFreshness};
}
test('an older loaded page detects a release change without discarding drafts or reloading automatically',async t=>{
 const h=harness();t.after(()=>h.dom.window.close());await h.api.check();assert.equal(h.calls[0].options.cache,'no-store');assert.ok(new URL(h.calls[0].url).searchParams.has('check'));
 assert.match(h.dom.window.document.querySelector('#leadintel-release-notice').textContent,/Update available/);assert.equal(h.navigation.length,0);assert.equal(h.dom.window.document.querySelector('#draft').value,'My unfinished message');assert.equal(typeof h.listeners.focus,'function');assert.equal(typeof h.listeners.pageshow,'function');
});
test('update saves dirty workspace before cache-busted navigation and preserves page URL context',async t=>{
 const h=harness();t.after(()=>h.dom.window.close());await h.api.check();let dirty=true,saves=0;
 h.context.LeadIntelWorkspacePersistence={hasUnsavedChanges:()=>dirty,saveWorkspace:async options=>{assert.equal(options.automatic,true);saves++;dirty=false;return true;}};
 assert.equal(await h.api.update(),true);assert.equal(saves,1);const url=new URL(h.navigation[0]);assert.equal(url.searchParams.get('release'),NEW);assert.equal(url.searchParams.get('tab'),'settings');assert.equal(url.hash,'#profile');
});
test('failed save or fresh edits during save hold refresh and preserve local input',async t=>{
 const h=harness();t.after(()=>h.dom.window.close());await h.api.check();
 for(const saved of [false,true]){h.context.LeadIntelWorkspacePersistence={hasUnsavedChanges:()=>true,saveWorkspace:async()=>saved};assert.equal(await h.api.update(),false);assert.equal(h.navigation.length,0);}
 assert.match(h.dom.window.document.querySelector('#leadintel-release-notice').textContent,/Save your changes/);assert.equal(h.dom.window.document.querySelector('#draft').value,'My unfinished message');
});
test('unchanged, invalid, unavailable and out-of-order release replies do not trigger a false update',async t=>{
 const h=harness();t.after(()=>h.dom.window.close());
 for(const data of [{service:'leadintel-customer',commit:OLD},{service:'other-app',commit:NEW},{service:'leadintel-customer',commit:'bad'}]){h.context.fetch=async()=>({ok:true,json:async()=>data});await h.api.check();assert.equal(h.dom.window.document.querySelector('#leadintel-release-notice'),null);}
 h.context.fetch=async()=>{throw Error('offline');};await h.api.check();assert.equal(h.navigation.length,0);
 let resolve;h.context.fetch=()=>new Promise(done=>resolve=done);const pending=h.api.check();await h.api.check();resolve({ok:true,json:async()=>({service:'leadintel-customer',commit:NEW})});await pending;assert.equal(h.dom.window.document.querySelectorAll('#leadintel-release-notice').length,1);
});
