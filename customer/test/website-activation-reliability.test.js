const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const {JSDOM}=require('jsdom');
const activation=require('../website-activation.js');
const profile=require('../profile-engine.js');
const inputSync=require('../website-input-sync.js');
const script=fs.readFileSync(require.resolve('../website-activation.js'),'utf8');
const MAIN=activation.STORAGE_KEY, ACCOUNT='leadintel_account_context_v1';
function deferred(){let resolve,reject;const promise=new Promise((yes,no)=>{resolve=yes;reject=no;});return {promise,resolve,reject};}
function runtime(){
 const dom=new JSDOM('<div class="source-panel"><div class="url-row"><input id="company-website" value="https://seller.example/"></div></div>',{url:'https://app.example/',runScripts:'outside-only'});
 const w=dom.window;
 w.localStorage.setItem(ACCOUNT,'account-a');
 w.localStorage.setItem(MAIN,JSON.stringify({website:'https://seller.example/',companyContextWebsite:'https://seller.example/',answers:{offer:'Approved offer'},documents:[{name:'catalog.pdf'}],scrapedSources:[{type:'website',url:'https://seller.example/',text:'Saved evidence'}]}));
 w.LeadIntelServerBridge={ready:true,workspace:{id:'workspace-a'},session:{authenticated:true,user:{id:'user-a'}}};
 let fetches=0;
 w.fetch=async()=>{fetches++;return {ok:true,json:async()=>({data:{markdown:'Fresh public company evidence',metadata:{title:'Seller'}}})};};
 w.eval(script);w.document.dispatchEvent(new w.Event('DOMContentLoaded'));
 return {w,api:w.LeadIntelWebsiteActivation,input:w.document.getElementById('company-website'),status:w.document.getElementById('website-activation-status'),button:w.document.getElementById('activate-website'),fetches:()=>fetches,close:()=>w.close()};
}
for(const [label,save] of [['false',async()=>false],['rejection',async()=>{throw new Error('Network unavailable');}]])test(`failed persistence (${label}) reports failure while retaining loaded evidence`,async()=>{
 const r=runtime();try{
  r.w.LeadIntelWorkspacePersistence={saveWorkspace:save};
  assert.equal(await r.api.activateWebsite(),false);
  assert.equal(r.status.dataset.state,'error');
  assert.match(r.status.textContent,/sav/i);
  const state=JSON.parse(r.w.localStorage.getItem(MAIN));
  assert.equal(state.scrapedSources[0].text,'Fresh public company evidence');
  assert.equal(state.answers.offer,'Approved offer');
  assert.equal(r.button.disabled,false);
 }finally{r.close();}
});
test('bridge persistence refusal cannot report successful activation',async()=>{
 const r=runtime();try{r.w.LeadIntelServerBridge.saveNow=async()=>({saved:false,conflict:true});assert.equal(await r.api.activateWebsite(),false);assert.equal(r.status.dataset.state,'error');}finally{r.close();}
});
for(const kind of ['account','workspace','session','website'])test(`a ${kind} change during persistence cannot display the previous activation result`,async()=>{
 const r=runtime(),save=deferred(),started=deferred();try{
  r.w.LeadIntelWorkspacePersistence={saveWorkspace:()=>{started.resolve();return save.promise;}};
  const pending=r.api.activateWebsite();await started.promise;
  if(kind==='account')r.w.localStorage.setItem(ACCOUNT,'account-b');
  if(kind==='workspace')r.w.LeadIntelServerBridge.workspace={id:'workspace-b'};
  if(kind==='session')r.w.LeadIntelServerBridge.session={authenticated:false};
  if(kind==='website')r.input.value='https://other.example/';
  r.w.localStorage.setItem(MAIN,JSON.stringify({website:'https://other.example/',answers:{offer:'Other workspace'}}));
  r.w.localStorage.removeItem(activation.ACTIVATION_KEY);
  const before=r.w.localStorage.getItem(MAIN);save.resolve(true);
  assert.equal(await pending,false);
  assert.equal(r.w.localStorage.getItem(MAIN),before);
  assert.notEqual(r.status.dataset.state,'active');
  assert.doesNotMatch(r.status.textContent,/Seller/);
  assert.equal(r.button.disabled,false);
 }finally{r.close();}
});
test('a workspace switch by an activation listener cannot save the replacement workspace',async()=>{
 const r=runtime();try{
  r.input.value='https://new.example/';let saved=0;
  r.w.LeadIntelWorkspacePersistence={saveWorkspace:async()=>{saved++;return true;}};
  r.w.addEventListener('leadintel:website-activated',()=>{
   r.w.localStorage.setItem(ACCOUNT,'account-b');r.w.localStorage.setItem(MAIN,JSON.stringify({website:'https://other.example/',step:4}));
  });
  assert.equal(await r.api.activateWebsite(),false);assert.equal(saved,0);assert.equal(JSON.parse(r.w.localStorage.getItem(MAIN)).step,4);
 }finally{r.close();}
});
test('an invalid account context is rejected before requesting website evidence',async()=>{
 const r=runtime();try{r.w.LeadIntelAccountCache={current:()=>false};assert.equal(await r.api.activateWebsite(),false);assert.equal(r.fetches(),0);}finally{r.close();}
});
for(const url of ['ftp://seller.example/file','mailto:sales@seller.example','javascript://seller.example','https://user:secret@seller.example/'])test(`non-public URL syntax is rejected: ${url.split(':')[0]}`,()=>{
 assert.equal(activation.normalizeUrl(url),'');assert.equal(profile.normalizeUrl(url),'');assert.equal(inputSync.normalizeUrl(url),'');
});
for(const [value,want] of [[' seller.example ','https://seller.example/'],['HTTP://SELLER.EXAMPLE/path#section','http://seller.example/path'],['münchen.example','https://xn--mnchen-3ya.example/'],['seller.example:8443/services','https://seller.example:8443/services'],['',''],['not a website','']])test(`website URL normalization is consistent for ${JSON.stringify(value)}`,()=>{
 for(const api of [activation,profile,inputSync])assert.equal(api.normalizeUrl(value),want);
});
for(const [label,reply] of [['HTTP failure',{ok:false,status:403,json:async()=>({error:'Access denied'})}],['empty website',{ok:true,json:async()=>({data:{markdown:'   '}})}]])test(`${label} leaves saved company evidence unchanged and releases the button`,async()=>{
 const r=runtime();try{
  const before=r.w.localStorage.getItem(MAIN);r.w.fetch=async()=>reply;
  assert.equal(await r.api.activateWebsite(),false);assert.equal(r.w.localStorage.getItem(MAIN),before);
  assert.equal(r.status.dataset.state,'error');assert.equal(r.button.disabled,false);
 }finally{r.close();}
});
test('empty or invalid website cannot start activation',async()=>{
 const r=runtime();try{for(const value of ['', 'not a website', 'https://user:secret@seller.example/']){r.input.value=value;assert.equal(await r.api.activateWebsite(),false);assert.equal(r.status.dataset.state,'error');}assert.equal(r.fetches(),0);}finally{r.close();}
});
test('duplicate install and repeated clicks keep one activation in flight',async()=>{
 const r=runtime(),fetch=deferred();try{
  let fetches=0;r.w.fetch=()=>{fetches++;return fetch.promise;};r.api.install();r.api.install();
  r.button.click();r.button.dispatchEvent(new r.w.MouseEvent('click',{bubbles:true}));
  assert.equal(await r.api.activateWebsite(),false);assert.equal(fetches,1);
  fetch.resolve({ok:true,json:async()=>({data:{markdown:'Readable evidence'}})});
  await new Promise(resolve=>setImmediate(resolve));
  assert.equal(r.status.dataset.state,'active');assert.equal(r.button.disabled,false);
 }finally{r.close();}
});
test('readable redirected website evidence activates the selected URL and survives reload',async()=>{
 const r=runtime();try{
  r.w.fetch=async()=>({ok:true,json:async()=>({data:{markdown:'Redirected public company evidence',metadata:{sourceURL:'https://www.seller.example/about',title:'Seller'}}})});
  r.w.LeadIntelWorkspacePersistence={saveWorkspace:async()=>true};
  assert.equal(await r.api.activateWebsite(),true);
  const state=JSON.parse(r.w.localStorage.getItem(MAIN));assert.equal(state.website,'https://seller.example/');
  assert.equal(state.scrapedSources[0].text,'Redirected public company evidence');
  r.w.eval(script);assert.equal(r.w.LeadIntelWebsiteActivation.isCurrentWebsiteActive('https://seller.example/'),true);
  assert.equal(r.w.document.querySelectorAll('#activate-website').length,1);
 }finally{r.close();}
});
test('a persistence timeout releases pending state, preserves evidence and allows retry',async()=>{
 const r=runtime(),save=deferred(),started=deferred();try{
  const timers=new Map();let sequence=0;r.w.setTimeout=(fn,ms)=>{const id=++sequence;timers.set(id,{fn,ms});return id;};r.w.clearTimeout=id=>timers.delete(id);
  r.w.LeadIntelWorkspacePersistence={saveWorkspace:()=>{started.resolve();return save.promise;}};
  const pending=r.api.activateWebsite();await started.promise;
  const timeout=[...timers.values()].find(row=>row.ms===10000);assert.ok(timeout);timeout.fn();
  assert.equal(await pending,false);assert.equal(r.status.dataset.state,'error');assert.match(r.status.textContent,/timed out/i);assert.equal(r.button.disabled,false);assert.equal(timers.size,0);
  assert.equal(JSON.parse(r.w.localStorage.getItem(MAIN)).scrapedSources[0].text,'Fresh public company evidence');
  save.resolve(true);await Promise.resolve();assert.equal(r.status.dataset.state,'error');
  r.w.LeadIntelWorkspacePersistence.saveWorkspace=async()=>true;assert.equal(await r.api.activateWebsite(),true);assert.equal(r.status.dataset.state,'active');
 }finally{r.close();}
});
test('workspace hydration must complete before activation can request or replace evidence',async()=>{
 const r=runtime();try{const before=r.w.localStorage.getItem(MAIN);r.w.LeadIntelServerBridge.ready=false;assert.equal(await r.api.activateWebsite(),false);assert.equal(r.fetches(),0);assert.equal(r.w.localStorage.getItem(MAIN),before);}finally{r.close();}
});
test('a bridge becoming unavailable during scraping preserves the saved company context',async()=>{
 const r=runtime(),fetch=deferred();try{
  const before=r.w.localStorage.getItem(MAIN);r.w.fetch=()=>fetch.promise;
  const pending=r.api.activateWebsite();r.w.LeadIntelServerBridge.ready=false;
  fetch.resolve({ok:true,json:async()=>({data:{markdown:'Late response'}})});
  assert.equal(await pending,false);assert.equal(r.w.localStorage.getItem(MAIN),before);assert.equal(r.button.disabled,false);
 }finally{r.close();}
});
