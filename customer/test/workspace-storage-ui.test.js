const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),{JSDOM}=require('jsdom');
const file=path.join(__dirname,'../workspace-storage-ui.js');
const payload=(workspace='w1',over={})=>({workspace_id:workspace,plan:{key:'included',name:'Included'},records:{used_bytes:4000000,limit_bytes:100000000,state:'available',measured:true,percent:4},files:{used_bytes:0,limit_bytes:1000000000,state:'available',measured:true,percent:0},billing:{setup_required:true,checkout_ready:false,can_upgrade:false,can_manage:false,status:'not_subscribed',payment_issue:false},upgrade:{records_limit_bytes:500000000,files_limit_bytes:10000000000},...over});
function mount({authenticated=true,fetcher}={}){
 assert.ok(fs.existsSync(file),'workspace storage panel is missing');
 const w=new JSDOM('<html><head></head><body><aside id="ai-settings-drawer"><div id="ai-engine-summary"></div></aside></body></html>',{url:'https://app.test/customer/',runScripts:'outside-only'}).window;
 w.LeadIntelServerBridge={ready:true,session:{authenticated,user:{id:'u1'}},workspace:authenticated?{id:'w1',role:'owner'}:null};
 const calls=[];w.fetch=async(url,options)=>{calls.push({url,options});return fetcher?fetcher(url,options):{ok:true,json:async()=>payload(new URL(url).searchParams.get('workspace_id'))};};
 w.eval(fs.readFileSync(file,'utf8'));return {w,calls};
}
test('authenticated settings show real usage and included/upgrade amounts without pretending checkout is active',async()=>{
 const {w}=mount();try{await w.LeadIntelStorage.refresh();const card=w.document.getElementById('workspace-storage-card');assert.match(card.textContent,/4 MB/);assert.match(card.textContent,/100 MB/);assert.match(card.textContent,/1 GB/);assert.match(card.textContent,/500 MB/);assert.match(card.textContent,/10 GB/);assert.equal(card.querySelector('[data-storage-action="checkout"]').disabled,true);assert.match(card.textContent,/Billing setup/);}finally{w.close();}
});
test('a public shared link requests no storage data and never shows another account usage',async()=>{
 const {w,calls}=mount({authenticated:false});try{await w.LeadIntelStorage.refresh();assert.equal(calls.length,0);assert.match(w.document.getElementById('workspace-storage-card').textContent,/Sign in/);assert.equal(w.document.querySelector('progress'),null);}finally{w.close();}
});
test('full storage and payment failure are red; connection failure is yellow',async()=>{
 let failure=false;const {w}=mount({fetcher:async()=>{if(failure)throw Error('network');return {ok:true,json:async()=>payload('w1',{records:{used_bytes:100000000,limit_bytes:100000000,state:'full',measured:true,percent:100},billing:{setup_required:false,checkout_ready:true,can_upgrade:true,can_manage:true,status:'past_due',payment_issue:true}})};}});
 try{await w.LeadIntelStorage.refresh();assert.ok(w.document.querySelector('#workspace-storage-card.is-error'));assert.ok(w.LeadIntelStorage.attentionItems().every(x=>x.severity==='error'));failure=true;await w.LeadIntelStorage.refresh();assert.ok(w.document.querySelector('[data-storage-connection].is-warning'));}finally{w.close();}
});
test('a late response from another workspace cannot overwrite the new user storage meter',async()=>{
 let finish;const {w}=mount({fetcher:async()=>new Promise(r=>{finish=r;})});try{const old=w.LeadIntelStorage.refresh();w.LeadIntelServerBridge.workspace={id:'w2',role:'owner'};w.dispatchEvent(new w.CustomEvent('leadintel:workspace-changed'));finish({ok:true,json:async()=>payload('w1')});await old;assert.doesNotMatch(w.document.getElementById('workspace-storage-card').textContent,/4 MB/);}finally{w.close();}
});
