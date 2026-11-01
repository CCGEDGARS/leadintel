const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const source=fs.readFileSync(require.resolve('../state-budget.js'),'utf8');
const keys=['state','discovery','outreach','delivery','discovery_meta'].map(name=>'leadintel_customer_v2_'+name);
function runtime(values=new Map(),quota=5*1024*1024){
 class Storage{
  constructor(map){this.values=map;}
  getItem(key){return this.values.get(String(key))??null;}
  setItem(key,value){const next=new Map(this.values);next.set(String(key),String(value));if([...next].reduce((n,[k,v])=>n+2*(k.length+v.length),0)>quota)throw Object.assign(Error('Browser quota exceeded'),{name:'QuotaExceededError'});this.values.set(String(key),String(value));}
  removeItem(key){this.values.delete(String(key));}
 }
 const localStorage=new Storage(values),sessionStorage=new Storage(new Map());
 const root={Storage,localStorage,sessionStorage,TextEncoder,TextDecoder,Buffer};
 vm.runInNewContext(source,root);return {root,localStorage,sessionStorage,values};
}
function largeOutreach(){return JSON.stringify({messages:Array.from({length:50},(_,i)=>({id:'message-'+i,body:'Keep the approved script exactly. ÄÖå € 😀\n'.repeat(1700),approved:i%2===0,source:{url:'https://source.example/'+i}}))});}
function expandedResearch(){const sources=Array.from({length:108},(_,i)=>({url:`https://company${i}.example/operations`,text:('Source '+i+' describes production, equipment installation and engineering. Ä €\n').repeat(420),sourceRead:true}));return {status:'running',rawResults:sources,candidates:sources.map((source,i)=>({company:'Company '+i,domain:'company'+i+'.example',evidence:[source],research:{sources:[source]}})),selectedProspects:[{company:'Saved',domain:'saved.example',notes:'Preserve manual choice'}]};}
test('a 108-page research checkpoint above 8 MB persists losslessly inside native local quota and reopens',()=>{
 const value=JSON.stringify(expandedResearch());assert.ok(Buffer.byteLength(value)>8*1024*1024);
 const r=runtime();assert.doesNotThrow(()=>r.localStorage.setItem(keys[1],value));assert.equal(r.localStorage.getItem(keys[1]),value);
 assert.ok(2*r.values.get(keys[1]).length<5*1024*1024);assert.equal(runtime(r.values).localStorage.getItem(keys[1]),value);
});
test('large discovery cloud packing keeps every source and selected company without increasing the transfer ceiling',()=>{
 const input={main:{website:'https://seller.example'},discovery:expandedResearch(),outreach:{draft:'Manual draft'},delivery:{},meta:{}};
 const b=runtime().root.LeadIntelStateBudget,result=b.prepareForSync(input,{allowCompressionPacking:true,allowBundlePacking:true,maxSyncBytes:8*1024*1024});
 assert.equal(b.MAX_SYNC_BYTES,500*1024);assert.equal(b.MAX_RECORD_SYNC_BYTES,8*1024*1024);assert.ok(result.bytes<=500*1024);assert.equal(JSON.stringify(b.restoreFromSync(result.payload))===JSON.stringify(input),true,'Every original source and manual record must round-trip exactly');
});
test('noncanonical large JSON preserves whitespace and escaped user wording through local reload',()=>{
 const value='  '+JSON.stringify({notes:'Exact \\"quoted\\" wording\n'.repeat(10000)},null,2)+'\n';const r=runtime();r.localStorage.setItem(keys[1],value);assert.equal(runtime(r.values).localStorage.getItem(keys[1]),value);
});
test('unsupported older account codec cannot publish a new-format section',()=>{
 const r=runtime();r.root.LeadIntelAccountCache={prepareLocalStorageCodec(){},localCodecVersion:1};r.localStorage.setItem(keys[1],'{"notes":"Existing"}');
 assert.throws(()=>r.localStorage.setItem(keys[1],JSON.stringify({rows:Array.from({length:20},()=>({body:'Quoted evidence. '.repeat(3000)}))})),/Refresh to upgrade/);assert.equal(r.localStorage.getItem(keys[1]),'{"notes":"Existing"}');
});
test('new discovery references still reject expansion above their bounded research allowance',()=>{
 const b=runtime().root.LeadIntelStateBudget,large='x'.repeat(600000);
 assert.throws(()=>b.restoreFromSync({discovery:{format:'leadintel-discovery-refs-v2',keys:['sources'],values:[large],value:[1,0,[2,...Array.from({length:60},()=>[0,0])]]}}),/safe restore limit/);
});
test('outreach exceeding browser quota remains exactly readable after save and reload',()=>{
 const value=largeOutreach(),r=runtime();
 assert.ok(2*value.length>5*1024*1024);
 assert.doesNotThrow(()=>r.localStorage.setItem(keys[2],value));
 assert.equal(r.localStorage.getItem(keys[2]),value);
 assert.ok(r.values.get(keys[2]).length<value.length/2);
 const reopened=runtime(r.values);assert.equal(reopened.localStorage.getItem(keys[2]),value);
 const edited=JSON.stringify({...JSON.parse(value),notes:'Unsynced new edit'});reopened.localStorage.setItem(keys[2],edited);
 assert.equal(runtime(reopened.values).localStorage.getItem(keys[2]),edited);
});
test('existing workspace sections are compacted before hydration needs more space',()=>{
 const value=JSON.stringify({notes:'Existing sourced research. '.repeat(20000)}),values=new Map(keys.map(key=>[key,value]));
 const r=runtime(values,6*1024*1024);
 assert.ok([...values.values()].every(raw=>raw.length<value.length/2));
 for(const key of keys)assert.equal(r.localStorage.getItem(key),value);
 assert.doesNotThrow(()=>r.localStorage.setItem(keys[2],largeOutreach()));
});
test('small legacy JSON, unrelated keys and session storage retain Web Storage semantics',()=>{
 const r=runtime();r.localStorage.setItem(keys[2],' { "draft": "keep spacing" } ');
 assert.equal(r.localStorage.getItem(keys[2]),' { "draft": "keep spacing" } ');
 r.localStorage.setItem('other-app','untouched');assert.equal(r.values.get('other-app'),'untouched');
 r.sessionStorage.setItem(keys[2],'session draft');assert.equal(r.sessionStorage.getItem(keys[2]),'session draft');
 assert.equal(r.localStorage.getItem('missing'),null);
});
test('cached reads observe replacement and deletion from another tab',()=>{
 const value=largeOutreach(),first=runtime();first.localStorage.setItem(keys[2],value);
 const second=runtime(first.values);assert.equal(second.localStorage.getItem(keys[2]),value);
 first.localStorage.setItem(keys[2],JSON.stringify({draft:'Other tab edit'}));
 assert.equal(second.localStorage.getItem(keys[2]),JSON.stringify({draft:'Other tab edit'}));
 first.localStorage.removeItem(keys[2]);assert.equal(second.localStorage.getItem(keys[2]),null);
});
test('a rejected write preserves the previous record instead of truncating it',()=>{
 const r=runtime(new Map(),1000);r.localStorage.setItem(keys[2],'{"draft":"Original"}');
 assert.throws(()=>r.localStorage.setItem(keys[2],JSON.stringify({draft:'x'.repeat(5000)})),{name:'QuotaExceededError'});
 assert.equal(r.localStorage.getItem(keys[2]),'{"draft":"Original"}');
});
test('the local decoder is installed before any application script reads saved records',()=>{
 const html=fs.readFileSync(require.resolve('../index.html'),'utf8');
 const tag=html.match(/<script\s+src="state-budget\.js[^\"]*"[^>]*><\/script>/);
 assert.ok(tag,'the storage decoder must load synchronously');
 assert.ok(html.indexOf(tag[0])>html.indexOf('src="account-cache.js'));
 assert.ok(html.indexOf(tag[0])<html.indexOf('<script defer'));
});
test('native browser Storage can persist and reopen a section larger than its quota',()=>{
 // jsdom counts UTF-16 code units; the real-browser failure is a 5 MiB byte quota.
 const {JSDOM}=require('jsdom'),w=new JSDOM('',{url:'https://leadintel.example/',runScripts:'outside-only',storageQuota:5*1024*1024/2}).window;
 try{
  Object.assign(w,{TextEncoder,TextDecoder});const value=largeOutreach();
  assert.throws(()=>w.localStorage.setItem(keys[2],value),{name:'QuotaExceededError'});
  w.eval(source);w.localStorage.setItem(keys[2],value);assert.equal(w.localStorage.getItem(keys[2]),value);
  const reopened=runtime(new Map([[keys[2],w.localStorage[keys[2]]]]));assert.equal(reopened.localStorage.getItem(keys[2]),value);
 }finally{w.close();}
});

test('escape-heavy sections within the cloud section bound persist without double-serialization overflow',()=>{
 const value=JSON.stringify({messages:[{body:'"\\\\'.repeat(1150000)}]});
 assert.ok(Buffer.byteLength(value)<8*1024*1024);assert.ok(value.length*2>5*1024*1024);
 const r=runtime();assert.doesNotThrow(()=>r.localStorage.setItem(keys[2],value));
 assert.equal(runtime(r.values).localStorage.getItem(keys[2]),value);
});
