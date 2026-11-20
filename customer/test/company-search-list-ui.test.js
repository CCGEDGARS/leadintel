const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),{webcrypto}=require('node:crypto'),{JSDOM}=require('jsdom'),M=require('../company-lists.js');
const tick=()=>new Promise(r=>setTimeout(r,5)),until=async predicate=>{for(let i=0;i<200;i++){if(predicate())return;await tick();}assert.fail('Timed out waiting for UI state');},gate=()=>{let resolve;return {promise:new Promise(r=>resolve=r),resolve:v=>resolve(v)};};
async function setup(t){
 const dom=new JSDOM('<body><div id="step-5"><section class="discovery-panel"><div class="discovery-controls"></div></section></div></body>',{url:'https://app.example/',runScripts:'outside-only'}),w=dom.window;const observers=[],Observer=w.MutationObserver;w.MutationObserver=class extends Observer{constructor(fn){super(fn);observers.push(this);}};t.after(()=>{observers.forEach(o=>o.disconnect());w.close();});
 Object.defineProperty(w.crypto,'subtle',{value:webcrypto.subtle});w.TextEncoder=TextEncoder;w.AbortSignal=AbortSignal;w.LeadIntelCompanyLists=M;
 w.LeadIntelServerBridge={session:{authenticated:true,user:{id:'user'}},workspace:{id:'one',role:'owner'}};
 let snapshot=M.normalizeSearchSnapshot({rows:[{company:'First company',website:'https://first.example/'}]}),postGate=null,readGate=null,posted=0,saved=new Map(),downloads=0,downloaded;
 w.LeadIntelDiscoveryUI={getCompanyListSnapshot:()=>({snapshot,busy:false})};w.Blob=Blob;w.URL.createObjectURL=blob=>{downloads++;downloaded=blob;return 'blob:fixture';};w.URL.revokeObjectURL=()=>{};w.HTMLAnchorElement.prototype.click=()=>{};
 w.fetch=async(url,options)=>{const workspace=new URL(url).searchParams.get('workspace_id');if(options.method==='POST'){posted++;const body=JSON.parse(options.body),result={id:'saved_'+body.fingerprint,name:body.name,criteria:{kind:'search_snapshot',fingerprint:body.fingerprint,context:body.snapshot.context},results:body.snapshot.rows};if(postGate)await postGate.promise;saved.set(workspace,result);return {ok:true,json:async()=>({list:result})};}const params=new URL(url).searchParams,stored=saved.get(workspace);const result=stored&&(params.has('id')?params.get('id')===stored.id:params.get('search_snapshot')===stored.criteria.fingerprint)?stored:null;if(readGate)await readGate.promise;return {ok:true,json:async()=>({list:result})};};
 w.eval(fs.readFileSync(path.join(__dirname,'../company-lists-ui.js'),'utf8'));w.document.dispatchEvent(new w.Event('DOMContentLoaded'));for(let i=0;i<5;i++)await tick();
 return {w,button:id=>w.document.getElementById(id),posted:()=>posted,downloads:()=>downloads,downloaded:()=>downloaded.text(),deleteSaved:()=>saved.clear(),holdPost:()=>postGate=gate(),holdRead:()=>readGate=gate(),change:(sellerWebsite='')=>{snapshot=M.normalizeSearchSnapshot({context:{sellerWebsite},rows:[{company:'Changed company'}]});return w.LeadIntelCompanyListUI.refreshSearch();},async save(){const before=posted;w.document.getElementById('save-company-search-list').click();await until(()=>posted>before);if(!postGate)await until(()=>!w.document.getElementById('export-company-search-list').disabled);}};
}
test('changed results during save allow export of the acknowledged rows only',async t=>{
 const h=await setup(t),g=h.holdPost();await h.save();assert.equal(h.button('export-company-search-list').disabled,true);assert.equal(h.posted(),1);
 await h.change();g.resolve();const exp=h.button('export-company-search-list');await until(()=>!exp.disabled);
 assert.equal(exp.textContent,'Export saved copy');assert.match(h.button('company-search-list-status').textContent,/1 compan(y|ies)/);
 assert.equal(h.downloads(),0);exp.click();await until(()=>h.downloads()===1);assert.equal(h.posted(),1);
 const csv=await h.downloaded();assert.match(csv,/First company/);assert.doesNotMatch(csv,/Changed company/);
 await h.save();assert.equal(exp.textContent,'Export list');exp.click();await until(()=>h.downloads()===2);
 const updated=await h.downloaded();assert.match(updated,/Changed company/);assert.doesNotMatch(updated,/First company/);
});
test('a workspace change discards an in-flight acknowledgment and never downloads another workspace list',async t=>{
 const h=await setup(t),g=h.holdPost();await h.save();h.w.LeadIntelServerBridge.workspace.id='two';h.w.dispatchEvent(new h.w.Event('leadintel:account-changed'));g.resolve();for(let i=0;i<10;i++)await tick();assert.equal(h.button('export-company-search-list').disabled,true);assert.equal(h.downloads(),0);
});
test('an earlier empty read cannot erase the successful Save acknowledgment',async t=>{
 const h=await setup(t),g=h.holdRead(),reading=h.change();for(let i=0;i<5;i++)await tick();await h.save();assert.equal(h.button('export-company-search-list').disabled,false);g.resolve();await reading;assert.equal(h.button('export-company-search-list').disabled,false);
});

test('export completes for the originally saved copy if the live rows change during download',async t=>{
 const h=await setup(t);await h.save();const g=h.holdRead();h.button('export-company-search-list').click();
 await until(()=>h.button('export-company-search-list').disabled);const changed=h.change();g.resolve();await changed;
 await until(()=>h.downloads()===1);assert.equal(h.posted(),1);
});

test('a deleted saved copy cannot be downloaded',async t=>{
 const h=await setup(t);await h.save();h.deleteSaved();const exp=h.button('export-company-search-list');
 exp.click();await until(()=>h.button('company-search-list-status').textContent.includes('no longer available'));
 assert.equal(exp.disabled,true);assert.equal(h.downloads(),0);
});
test('a seller change cannot expose the earlier saved copy as the export target',async t=>{
 const h=await setup(t);await h.save();await h.change('https://another-seller.example/');
 assert.equal(h.button('export-company-search-list').disabled,true);assert.equal(h.downloads(),0);
});
test('a workspace change during export cannot download the captured list',async t=>{
 const h=await setup(t);await h.save();const g=h.holdRead();
 h.button('export-company-search-list').click();await until(()=>h.button('export-company-search-list').disabled);
 h.w.LeadIntelServerBridge.workspace.id='two';h.w.dispatchEvent(new h.w.Event('leadintel:account-changed'));
 g.resolve();for(let i=0;i<10;i++)await tick();assert.equal(h.downloads(),0);assert.equal(h.button('export-company-search-list').disabled,true);
});
