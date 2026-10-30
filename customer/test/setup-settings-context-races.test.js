const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),{JSDOM}=require('jsdom');
const source=name=>fs.readFileSync(require.resolve('../'+name),'utf8').replace(/^import .*;\s*$/gm,'').replace(/^export .*;\s*$/gm,'');
const deferred=()=>{let resolve,reject;const promise=new Promise((a,b)=>{resolve=a;reject=b});return {promise,resolve,reject};};
const reply=(payload={},ok=true)=>({ok,json:async()=>payload});
function fixture(module,extra=''){
 const dom=new JSDOM('<div class="top-actions"></div><div id="toast"></div><section id="delivery-setup"><div class="delivery-settings-footer"></div></section>'+extra,{url:'https://example.test/',runScripts:'outside-only'}),w=dom.window,calls=[];
 const observers=[],Observer=w.MutationObserver;w.MutationObserver=class extends Observer{constructor(callback){super(callback);observers.push(this);}};w.AbortSignal=AbortSignal;w.LeadIntelServerBridge={workspace:null,session:{authenticated:false,user:{id:'u1'}}};w.LeadIntelPersonalLinkedIn={normalize:()=>''};w.LeadIntelAdditionalContactPolicy={readiness:()=>({eligible:true})};w.LeadIntelDialogs={confirm:async()=>true};
 w.fetch=async(url,options={})=>{calls.push({url,options});return reply(url.includes('/policy')?{policy:{enabled:false,phoneEnabled:false,provider:'treg',dailyLimit:5,monthlyLimit:150,maxPerCompany:1},role:'owner'}:{role:'owner',providers:[]});};
 const expose=module==='ai-settings.js'?'window.testSettings={saveProvider,activateProvider,refreshStatus,refreshAllStatus,checkApolloStatus,handleCommunicationAction,get status(){return status;},get busy(){return busy;}}':module==='service-settings-extension.js'?'window.testSettings={saveService,saveCalendly,disconnectService,disconnectCalendly,refreshServiceStatus,get status(){return serviceStatus;},get busy(){return busy;}}':'';
 w.eval(source(module)+'\n'+expose);w.LeadIntelServerBridge.workspace={id:'a',role:'owner'};w.LeadIntelServerBridge.session.authenticated=true;
 return {dom,w,calls,close:()=>{for(const observer of observers)observer.disconnect();w.close();}};
}
function switchContext(w,kind){if(kind==='workspace')w.LeadIntelServerBridge.workspace={id:'b',role:'owner'};else w.LeadIntelServerBridge.session.user={id:'u2'};}
for(const kind of ['workspace','user'])test('AI paid test consent cannot move to another '+kind,async()=>{
 const f=fixture('ai-settings.js');try{f.w.document.getElementById('ai-settings-drawer').hidden=false;await f.w.testSettings.refreshStatus();f.w.document.querySelector('[data-ai-key="openai"]').value='secret-test-key';const approval=deferred();f.w.LeadIntelDialogs.confirm=()=>approval.promise;const action=f.w.testSettings.saveProvider('openai');switchContext(f.w,kind);approval.resolve(true);await action;assert.equal(f.calls.filter(c=>c.options.method==='PUT').length,0);}finally{f.close();}
});
for(const method of ['disconnectService','disconnectCalendly'])test(method+' consent stays with its originating account',async()=>{
 const f=fixture('service-settings-extension.js');try{const approval=deferred();f.w.LeadIntelDialogs.confirm=()=>approval.promise;const action=f.w.testSettings[method]('firecrawl');switchContext(f.w,'user');approval.resolve(true);await action;assert.equal(f.calls.filter(c=>c.options.method==='DELETE').length,0);}finally{f.close();}
});
test('AI status from a previous user cannot become the same workspace current status',async()=>{
 const f=fixture('ai-settings.js');try{const response=deferred();f.w.fetch=()=>response.promise;const load=f.w.testSettings.refreshStatus();switchContext(f.w,'user');response.resolve(reply({role:'owner',providers:[{provider:'openai',configured:true,model:'old-user-model'}]}));await load;assert.equal(f.w.testSettings.status.providers.length,0);}finally{f.close();}
});
test('service status keeps the newest load when responses arrive backwards',async()=>{
 const f=fixture('service-settings-extension.js');try{const response=deferred();let n=0;f.w.fetch=async()=>++n<=4?response.promise:reply({role:'owner',providers:[{provider:'firecrawl',configured:true,key_hint:'new'}]});const old=f.w.testSettings.refreshServiceStatus();await f.w.testSettings.refreshServiceStatus();response.resolve(reply({role:'owner',providers:[{provider:'firecrawl',configured:true,key_hint:'old'}]}));await old;assert.equal(f.w.testSettings.status.providers[0].key_hint,'new');}finally{f.close();}
});
test('service save finishing after an account switch cannot refresh or publish that account',async()=>{
 const f=fixture('service-settings-extension.js','<input data-service-key="firecrawl" value="test-key">');try{const response=deferred();f.w.fetch=async(url,options={})=>{f.calls.push({url,options});return options.method==='PUT'?response.promise:reply({providers:[]});};let changes=0;f.w.addEventListener('leadintel:service-credential-changed',()=>changes++);const save=f.w.testSettings.saveService('firecrawl');switchContext(f.w,'user');response.resolve(reply({}));await save;assert.equal(changes,0);assert.equal(f.calls.length,1);assert.equal(f.w.testSettings.busy,'');}finally{f.close();}
});
test('Calendly connection finishing after an account switch cannot publish connected status',async()=>{
 const f=fixture('service-settings-extension.js','<input data-calendly-token value="test-token"><input data-calendly-url value="https://calendly.com/example">');try{const response=deferred();f.w.fetch=()=>response.promise;let changes=0;f.w.addEventListener('leadintel:calendly-status',()=>changes++);const save=f.w.testSettings.saveCalendly();switchContext(f.w,'user');response.resolve(reply({configured:true,connected:true}));await save;assert.equal(changes,0);assert.equal(f.w.testSettings.busy,'');}finally{f.close();}
});
test('paid preferences are unavailable to another user in the same workspace',async()=>{
 const f=fixture('additional-contact-services.js');try{await f.w.LeadIntelAdditionalContacts.load();assert.ok(f.w.LeadIntelAdditionalContacts.policy());switchContext(f.w,'user');assert.equal(f.w.LeadIntelAdditionalContacts.policy(),null);}finally{f.close();}
});
test('paid toggle resets busy controls after workspace changes during consent',async()=>{
 const f=fixture('additional-contact-services.js');try{f.w.fetch=async(url,options={})=>reply(url.includes('/policy')?{policy:{enabled:false,phoneEnabled:false,provider:'treg',dailyLimit:5,monthlyLimit:150,maxPerCompany:1},role:'owner'}:{providers:[{provider:'treg',configured:true,source:'customer'}]});await f.w.LeadIntelAdditionalContacts.load();const approval=deferred();f.w.LeadIntelDialogs.confirm=()=>approval.promise;f.w.document.querySelector('[data-paid-search-toggle]').click();switchContext(f.w,'workspace');f.w.dispatchEvent(new f.w.CustomEvent('leadintel:workspace-reset'));await f.w.LeadIntelAdditionalContacts.load();approval.resolve(true);await new Promise(r=>setImmediate(r));assert.equal(f.w.document.querySelector('[data-paid-search-toggle]').disabled,false);}finally{f.close();}
});
test('legacy optional research submission requires owner role and explicit paid consent',async()=>{
 const f=fixture('additional-contact-services.js','<form id="additional-contact-preferences"><input type="checkbox" name="enabled"><input name="dailyLimit"><input name="monthlyLimit"><input name="maxPerCompany"><button>Save</button></form><p id="additional-contact-status"></p>');try{f.w.fetch=async(url,options={})=>{f.calls.push({url,options});return reply(url.includes('/policy')?{policy:{enabled:false,phoneEnabled:false,provider:'apollo',dailyLimit:5,monthlyLimit:150,maxPerCompany:1},role:'member'}:{providers:[{provider:'apollo',configured:true,source:'customer'}]});};await f.w.LeadIntelAdditionalContacts.load();const form=f.w.document.getElementById('additional-contact-preferences');form.elements.enabled.checked=true;form.dispatchEvent(new f.w.Event('submit',{bubbles:true,cancelable:true}));await new Promise(r=>setImmediate(r));assert.equal(f.calls.filter(c=>c.options.method==='PUT').length,0);}finally{f.close();}
});
for(const action of ['activate','mailbox'])test(action+' approval cannot move to another account',async()=>{
 const f=fixture('ai-settings.js');try{
  f.w.fetch=async()=>reply({role:'owner',providers:[{provider:'openai',name:'OpenAI',configured:true,model:'test-model'}]});await f.w.testSettings.refreshStatus();const approval=deferred();f.w.LeadIntelDialogs.confirm=()=>approval.promise;let disconnects=0;f.w.LeadIntelServerBridge.disconnectGmail=async()=>{disconnects++;return {ok:true};};
  let pending;if(action==='activate')pending=f.w.testSettings.activateProvider('openai');else{const button=f.w.document.createElement('button');button.dataset.gmailAction='disconnect';pending=f.w.testSettings.handleCommunicationAction({target:button});}
  switchContext(f.w,'user');approval.resolve(true);await pending;assert.equal(disconnects,0);assert.equal(f.calls.filter(c=>c.options.method==='POST').length,0);
 }finally{f.close();}
});
test('an old AI save failure cannot replace a new account status or keep it busy',async()=>{
 const f=fixture('ai-settings.js');try{
  f.w.document.getElementById('ai-settings-drawer').hidden=false;await f.w.testSettings.refreshStatus();f.w.document.querySelector('[data-ai-key="openai"]').value='test-key';const response=deferred();f.w.fetch=async(url,options={})=>options.method==='PUT'?response.promise:reply({role:'owner',providers:[{provider:'openai',configured:true,model:'new-account-model'}]});const save=f.w.testSettings.saveProvider('openai');await Promise.resolve();switchContext(f.w,'user');f.w.dispatchEvent(new f.w.CustomEvent('leadintel:workspace-changed'));await f.w.testSettings.refreshStatus();response.resolve(reply({error:'old-account-failure'},false));await save;assert.equal(f.w.testSettings.status.providers[0].model,'new-account-model');assert.equal(f.w.testSettings.busy,'');assert.doesNotMatch(f.w.document.getElementById('toast').textContent,/old-account-failure/);await new Promise(r=>setImmediate(r));
 }finally{f.close();}
});
test('a previous policy failure cannot erase another user successful load',async()=>{
 const f=fixture('additional-contact-services.js');try{
  const response=deferred();f.w.fetch=()=>response.promise;const old=f.w.LeadIntelAdditionalContacts.load();switchContext(f.w,'user');f.w.fetch=async(url)=>reply(url.includes('/policy')?{role:'owner',policy:{enabled:true,phoneEnabled:false,provider:'treg',dailyLimit:2,monthlyLimit:60,maxPerCompany:1}}:{providers:[]});await f.w.LeadIntelAdditionalContacts.load();response.reject(Error('previous user failure'));await old;assert.equal(f.w.LeadIntelAdditionalContacts.policy().dailyLimit,2);
 }finally{f.close();}
});
const legacyForm='<form id="additional-contact-preferences"><input type="checkbox" name="enabled"><input name="dailyLimit"><input name="monthlyLimit"><input name="maxPerCompany"><button>Save</button></form><p id="additional-contact-status"></p>';
for(const approved of [false,true])test('legacy paid approval '+(approved?'persists only after consent without research or sending':'cancellation makes no provider changes'),async()=>{
 const f=fixture('additional-contact-services.js',legacyForm);try{
  let policy={enabled:false,phoneEnabled:false,provider:'apollo',dailyLimit:5,monthlyLimit:150,maxPerCompany:1};f.w.fetch=async(url,options={})=>{f.calls.push({url,options});if(options.method==='PUT'&&url.includes('/policy'))policy={...policy,...JSON.parse(options.body)};return reply(url.includes('/policy')?{role:'owner',policy}:{providers:[{provider:'apollo',configured:true,source:'customer',metadata:{phone_enrichment_enabled:false}}]});};await f.w.LeadIntelAdditionalContacts.load();const approval=deferred();f.w.LeadIntelDialogs.confirm=()=>approval.promise;const form=f.w.document.getElementById('additional-contact-preferences');form.elements.enabled.checked=true;form.dispatchEvent(new f.w.Event('submit',{cancelable:true}));assert.equal(f.calls.filter(c=>c.options.method==='PUT').length,0);approval.resolve(approved);await new Promise(r=>setImmediate(r));assert.equal(f.calls.filter(c=>c.options.method==='PUT').length,approved?2:0);assert.equal(f.w.LeadIntelAdditionalContacts.policy().enabled,approved);assert.equal(f.calls.some(c=>c.options.method==='POST'),false);assert.equal(form.elements.enabled.disabled,false);
 }finally{f.close();}
});
for(const module of ['service-settings-extension.js','ai-settings.js','additional-contact-services.js'])test(module+' emits bounded request traces without credential or payload contents',async()=>{
 const f=fixture(module);try{
  const records=[];f.w.LeadIntelSetupTrace={begin(action){const entry={action,id:'setup-op-123',steps:[]};records.push(entry);return {id:entry.id,checkpoint:(phase,outcome)=>entry.steps.push({phase,outcome}),finish:outcome=>entry.outcome=outcome};}};
  const observed=[];f.w.fetch=async(url,options={})=>{observed.push(options);return reply(url.includes('/policy')?{role:'owner',policy:{enabled:false,provider:'treg',dailyLimit:1,monthlyLimit:30,maxPerCompany:1}}:{role:'owner',providers:[]});};
  if(module==='service-settings-extension.js')await f.w.testSettings.refreshServiceStatus();else if(module==='ai-settings.js')await f.w.testSettings.refreshStatus();else await f.w.LeadIntelAdditionalContacts.load();
  assert.ok(records.length);assert.ok(records.every(r=>r.outcome==='pass'));assert.doesNotMatch(JSON.stringify(records),/https?:|workspace|api_key|test-key|personal_access_token/);assert.ok(records.every(r=>JSON.stringify(r.steps)===JSON.stringify([{phase:'request',outcome:'pending'},{phase:'response',outcome:'pass'}])));if(module!=='additional-contact-services.js')assert.ok(observed.every(o=>o.headers['X-LeadIntel-Operation-Id']==='setup-op-123'));
 }finally{f.close();}
});
test('AI status failure for a new user never retains the previous user connected providers',async()=>{
 const f=fixture('ai-settings.js');try{
  f.w.fetch=async()=>reply({role:'owner',providers:[{provider:'openai',configured:true,model:'private-old-user-model'}]});await f.w.testSettings.refreshStatus();switchContext(f.w,'user');f.w.fetch=async()=>reply({error:'temporarily unavailable'},false);await f.w.testSettings.refreshStatus();assert.equal(f.w.testSettings.status.providers.length,0);
 }finally{f.close();}
});
test('Apollo multistep diagnostics do not continue under another user context',async()=>{
 const f=fixture('ai-settings.js');try{
  const response=deferred();f.w.fetch=async(url,options={})=>{f.calls.push({url,options});return response.promise;};const check=f.w.testSettings.checkApolloStatus();switchContext(f.w,'user');response.resolve(reply({policy:{daily_credit_limit:3,monthly_credit_limit:30},usage:{daily:0,monthly:0}}));await check;assert.equal(f.calls.length,1);
 }finally{f.close();}
});
test('unsubmitted service credentials from an old account cannot be saved by a new user',async()=>{
 const f=fixture('service-settings-extension.js','<div data-service-extension="1"><input data-service-key="firecrawl" value="private-old-user-key"></div>');try{await f.w.testSettings.refreshServiceStatus();switchContext(f.w,'user');await f.w.testSettings.saveService('firecrawl');assert.equal(f.calls.filter(c=>c.options.method==='PUT').length,0);}finally{f.close();}
});
