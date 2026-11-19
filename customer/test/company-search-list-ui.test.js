const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),{webcrypto}=require('node:crypto'),{JSDOM}=require('jsdom'),M=require('../company-lists.js');
const tick=()=>new Promise(r=>setTimeout(r,5)),until=async predicate=>{for(let i=0;i<200;i++){if(predicate())return;await tick();}assert.fail('Timed out waiting for UI state');},gate=()=>{let resolve;return {promise:new Promise(r=>resolve=r),resolve:v=>resolve(v)};};
async function setup(t){
 const dom=new JSDOM('<body><div id="step-5"><section class="discovery-panel"><div class="discovery-controls"></div></section></div></body>',{url:'https://app.example/',runScripts:'outside-only'}),w=dom.window;const observers=[],Observer=w.MutationObserver;w.MutationObserver=class extends Observer{constructor(fn){super(fn);observers.push(this);}};t.after(()=>{observers.forEach(o=>o.disconnect());w.close();});
 Object.defineProperty(w.crypto,'subtle',{value:webcrypto.subtle});w.TextEncoder=TextEncoder;w.AbortSignal=AbortSignal;w.LeadIntelCompanyLists=M;
 w.LeadIntelServerBridge={session:{authenticated:true,user:{id:'user'}},workspace:{id:'one',role:'owner'}};
 let snapshot=M.normalizeSearchSnapshot({rows:[{company:'First company',website:'https://first.example/'}]}),postGate=null,readGate=null,posted=0,saved=new Map(),downloads=0;
 w.LeadIntelDiscoveryUI={getCompanyListSnapshot:()=>({snapshot,busy:false})};w.URL.createObjectURL=()=>{downloads++;return 'blob:fixture';};w.URL.revokeObjectURL=()=>{};w.HTMLAnchorElement.prototype.click=()=>{};
 w.fetch=async(url,options)=>{const workspace=new URL(url).searchParams.get('workspace_id');if(options.method==='POST'){posted++;const body=JSON.parse(options.body),result={id:'saved',name:body.name,criteria:{kind:'search_snapshot',fingerprint:body.fingerprint,context:body.snapshot.context},results:body.snapshot.rows};if(postGate)await postGate.promise;saved.set(workspace,result);return {ok:true,json:async()=>({list:result})};}const result=saved.get(workspace)||null;if(readGate)await readGate.promise;return {ok:true,json:async()=>({list:result})};};
 w.eval(fs.readFileSync(path.join(__dirname,'../company-lists-ui.js'),'utf8'));w.document.dispatchEvent(new w.Event('DOMContentLoaded'));for(let i=0;i<5;i++)await tick();
 return {w,button:id=>w.document.getElementById(id),posted:()=>posted,downloads:()=>downloads,holdPost:()=>postGate=gate(),holdRead:()=>readGate=gate(),change:()=>{snapshot=M.normalizeSearchSnapshot({rows:[{company:'Changed company'}]});return w.LeadIntelCompanyListUI.refreshSearch();},async save(){const before=posted;w.document.getElementById('save-company-search-list').click();await until(()=>posted>before);if(!postGate)await until(()=>!w.document.getElementById('export-company-search-list').disabled);}};
}
test('export stays disabled during save; changed results and late responses cannot authorize the new list',async t=>{
 const h=await setup(t),g=h.holdPost();await h.save();assert.equal(h.button('export-company-search-list').disabled,true);assert.equal(h.posted(),1);
 await h.change();g.resolve();for(let i=0;i<10;i++)await tick();assert.equal(h.button('export-company-search-list').disabled,true);assert.match(h.button('company-search-list-status').textContent,/Results have since changed/);assert.equal(h.downloads(),0);
});
test('a workspace change discards an in-flight acknowledgment and never downloads another workspace list',async t=>{
 const h=await setup(t),g=h.holdPost();await h.save();h.w.LeadIntelServerBridge.workspace.id='two';h.w.dispatchEvent(new h.w.Event('leadintel:account-changed'));g.resolve();for(let i=0;i<10;i++)await tick();assert.equal(h.button('export-company-search-list').disabled,true);assert.equal(h.downloads(),0);
});
test('an earlier empty read cannot erase the successful Save acknowledgment',async t=>{
 const h=await setup(t),g=h.holdRead(),reading=h.change();for(let i=0;i<5;i++)await tick();await h.save();assert.equal(h.button('export-company-search-list').disabled,false);g.resolve();await reading;assert.equal(h.button('export-company-search-list').disabled,false);
});
