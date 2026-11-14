const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const {IDBFactory}=require('fake-indexeddb');
const source=fs.readFileSync(require.resolve('../account-cache.js'),'utf8'),DBNAME='leadintel_account_archives_v1',PREFIX='leadintel_workspace_snapshot_v1:',PINS='leadintel_archive_pending_v2:',PTR='leadintel_customer_v2_workspace_saved_snapshot_v1';
function locks(){let tail=Promise.resolve();return {request(_key,_options,operation){const result=tail.then(operation);tail=result.catch(()=>{});return result;}};}
function setup({indexedDB=new IDBFactory(),values=new Map([['leadintel_customer_v2_workspace','w1']]),sharedLocks=locks(),compression=true,onSet,onCompress}={}){
 class Storage{constructor(map){this.map=map;}get length(){return this.map.size;}key(i){return [...this.map.keys()][i]??null;}getItem(k){return this.map.get(k)??null;}setItem(k,v){onSet?.(k,v);this.map.set(k,String(v));}removeItem(k){this.map.delete(k);}}
 const attributes=new Map(),events=[],root={indexedDB,Storage,localStorage:new Storage(values),sessionStorage:new Storage(new Map()),navigator:{locks:sharedLocks,storage:{estimate:async()=>({usage:12345,quota:99999})}},TextEncoder,TextDecoder,ArrayBuffer,Uint8Array,Blob,Response:class extends Response{async arrayBuffer(){const data=await super.arrayBuffer();await onCompress?.();return data;}},CompressionStream:compression?CompressionStream:undefined,DecompressionStream:compression?DecompressionStream:undefined,crypto:require('node:crypto').webcrypto,setTimeout,clearTimeout,URL,console,location:{href:'https://example.test/customer/',search:'',reload(){}},document:{documentElement:{setAttribute:(k,v)=>attributes.set(k,v),removeAttribute:k=>attributes.delete(k)},getElementById:()=>null},CustomEvent:class{constructor(type,{detail}){this.type=type;this.detail=detail;}},dispatchEvent:event=>events.push(event)};
 vm.runInNewContext(source,root);return {root,api:root.LeadIntelAccountCache,indexedDB,values,attributes,events};
}
async function openDB(indexedDB,version=2){return new Promise((resolve,reject)=>{const request=indexedDB.open(DBNAME,version);request.onsuccess=()=>resolve(request.result);request.onerror=()=>reject(request.error);});}
async function write(indexedDB,key,value){const db=await openDB(indexedDB);await new Promise((resolve,reject)=>{const tx=db.transaction('archives','readwrite');tx.objectStore('archives').put(value,key);tx.oncomplete=resolve;tx.onabort=()=>reject(tx.error);});db.close();}
async function raw(indexedDB,key){const db=await openDB(indexedDB);const value=await new Promise((resolve,reject)=>{const tx=db.transaction('archives'),r=tx.objectStore('archives').get(key);r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);});db.close();return value;}
const baseline=(version,value='business')=>({schema_version:1,workspace_id:'w1',server_version:version,server_synced:true,server_payload:{value},data:{value}});
const eligible=record=>record?.schema_version===1&&record.server_synced===true&&JSON.stringify(record.data)===JSON.stringify(record.server_payload);
const pointer=key=>JSON.stringify({format:'leadintel-indexed-workspace-snapshot-v1',workspace_id:'w1',key});
const publish=(r,record,expected=r.values.get(PTR)??null)=>r.api.publishRecoverySnapshot(record,{pointerKey:PTR,encodePointer:pointer,expectedPointer:expected,eligibleBaseline:eligible});

test('a 9 MB acknowledged baseline publishes losslessly, reopens, and reports only aggregate storage metadata',async()=>{
 const r=setup();await r.api.pending;const record=baseline(2,'Evidence ā😀 '.repeat(350000));assert.ok(Buffer.byteLength(JSON.stringify(record))>9000000);
 const key=await publish(r,record),stored=await raw(r.indexedDB,key);assert.equal(stored.format,'leadintel-archive-gzip-v2');assert.ok(stored.data.byteLength<100000);
 const reopened=setup({indexedDB:r.indexedDB,values:r.values,sharedLocks:r.root.navigator.locks});await reopened.api.pending;
 const read=await reopened.api.readRecoveryPointer(PTR,{workspaceId:'w1'});assert.equal(JSON.stringify(read.record),JSON.stringify(record));assert.equal(read.raw,pointer(key));assert.equal(await raw(r.indexedDB,PINS+key),undefined);
 const diagnostic=await reopened.api.getRecoveryStorageDiagnostics();assert.equal(diagnostic.originUsageBytes,12345);assert.equal(diagnostic.originQuotaBytes,99999);assert.ok(reopened.attributes.has('data-archive-storage-diagnostics'));assert.doesNotMatch(JSON.stringify(diagnostic),/Evidence|business|snapshot_v1:|w1/);
});

test('GC reclaims only unreferenced superseded acknowledged baselines and protects all archive/conflict/pending roots',async()=>{
 const r=setup({compression:false});await r.api.pending;
 for(const [suffix,record]of [['old',baseline(1)],['current',baseline(3)],['archived',baseline(1)],['original',baseline(1)],['unknown',{workspace_id:'w1',data:{unique:'unknown'}}],['draft',{...baseline(1),server_synced:false}],['delta',{...baseline(1),data:{value:'unsaved'}}],['pinned',baseline(1)]])await write(r.indexedDB,PREFIX+suffix,JSON.stringify(record));
 r.values.set(PTR,pointer(PREFIX+'current'));
 await write(r.indexedDB,'leadintel_account_cache_v1:other',JSON.stringify({data:{saved:pointer(PREFIX+'archived')},sessionData:{}}));
 await write(r.indexedDB,PREFIX+'conflict',JSON.stringify({workspace_id:'w1',original:{local:{saved:pointer(PREFIX+'original')}}}));
 await write(r.indexedDB,PINS+'pin',JSON.stringify({format:'leadintel-archive-pending-v2',key:PREFIX+'pinned'}));
 const result=await r.api.compactRecoveryStorage({eligibleBaseline:eligible});assert.equal(result.reclaimedRecordsThisPass,1);assert.equal(await raw(r.indexedDB,PREFIX+'old'),undefined);
 for(const suffix of ['current','archived','original','unknown','draft','delta','pinned','conflict'])assert.ok(await raw(r.indexedDB,PREFIX+suffix),suffix+' must survive');
});

test('unavailable cross-tab locks disable GC while retaining same-key lossless compression',async()=>{
 const r=setup({sharedLocks:undefined});delete r.root.navigator.locks;await r.api.pending;await write(r.indexedDB,PREFIX+'old',JSON.stringify(baseline(1,'x'.repeat(100000))));await write(r.indexedDB,PREFIX+'new',JSON.stringify(baseline(2)));r.values.set(PTR,pointer(PREFIX+'new'));
 const result=await r.api.compactRecoveryStorage({eligibleBaseline:eligible});assert.equal(result.reclaimedRecordsThisPass,0);assert.equal((await raw(r.indexedDB,PREFIX+'old')).format,'leadintel-archive-gzip-v2');
});

test('failed pointer publication preserves the prior pointer and durable pending snapshot',async()=>{
 let fail=false;const r=setup({onSet(key){if(fail&&key===PTR)throw Object.assign(Error('quota'),{name:'QuotaExceededError'});}});await r.api.pending;
 const first=await publish(r,baseline(1));fail=true;await assert.rejects(publish(r,baseline(2)),{name:'QuotaExceededError'});assert.equal(r.values.get(PTR),pointer(first));
 const diagnostic=await r.api.getRecoveryStorageDiagnostics();assert.equal(diagnostic.pendingPins,1);assert.equal(diagnostic.totalRecords,3);
 await r.api.compactRecoveryStorage({eligibleBaseline:eligible});assert.equal((await r.api.getRecoveryStorageDiagnostics()).pendingPins,1);
});

test('two tabs cannot overwrite a changed publication pointer or regress an acknowledged revision',async()=>{
 const r=setup(),other=setup({indexedDB:r.indexedDB,values:r.values,sharedLocks:r.root.navigator.locks});await r.api.pending;await other.api.pending.catch(()=>{});
 // The first schema upgrade fences the concurrently initialized tab; reopen it.
 const fresh=setup({indexedDB:r.indexedDB,values:r.values,sharedLocks:r.root.navigator.locks});await fresh.api.pending;
 const before=r.values.get(PTR)??null;const key=await publish(r,baseline(3),before);
 await assert.rejects(publish(fresh,baseline(4),before),error=>error.code==='archive_pointer_changed');assert.equal(r.values.get(PTR),pointer(key));
 await assert.rejects(publish(fresh,baseline(2)),error=>error.code==='archive_pointer_changed');
});

test('compression CAS cannot overwrite a record changed while gzip was being prepared',async()=>{
 let release,started;const gate=new Promise(resolve=>release=resolve),ready=new Promise(resolve=>started=resolve);let pause=true;
 const r=setup({onCompress:async()=>{if(pause){started();await gate;pause=false;}}});await r.api.pending;const key=PREFIX+'shared';await write(r.indexedDB,key,JSON.stringify({workspace_id:'w1',data:'old '.repeat(30000)}));
 const pending=r.api.compactRecoveryStorage();await ready;const replacement=JSON.stringify({workspace_id:'w1',data:'new unique value'});await write(r.indexedDB,key,replacement);release();await pending;assert.equal(await raw(r.indexedDB,key),replacement);
});

test('v2 migration preserves drafts but fences a paused v1 writer after its commit',async()=>{
 const indexedDB=new IDBFactory(),values=new Map([['leadintel_customer_v2_workspace','w1'],['leadintel_customer_v2_state','retained draft'],['leadintel_account_context_v1',JSON.stringify({workspaceId:'w1',userId:'u1',epoch:'li2:old'})]]);
 const request=indexedDB.open(DBNAME,1);await new Promise((resolve,reject)=>{request.onupgradeneeded=()=>request.result.createObjectStore('archives');request.onsuccess=resolve;request.onerror=reject;});request.result.onversionchange=()=>request.result.close();const oldTicket=values.get('leadintel_account_context_v1');
 const r=setup({indexedDB,values});await r.api.pending;assert.notEqual(values.get('leadintel_account_context_v1'),oldTicket);assert.equal(values.get('leadintel_customer_v2_state'),'retained draft');assert.ok(JSON.parse(values.get('leadintel_account_context_v1')).epoch.startsWith('li2:'));
 await assert.rejects(openDB(indexedDB,1),{name:'VersionError'});
});

test('incomplete deep or malformed reference walks disable collection; serialized array references survive',async()=>{
 for(const kind of ['deep','array','malformed']){
  const r=setup({compression:false});await r.api.pending;await write(r.indexedDB,PREFIX+'old',JSON.stringify(baseline(1)));await write(r.indexedDB,PREFIX+'current',JSON.stringify(baseline(2)));r.values.set(PTR,pointer(PREFIX+'current'));
  let ref=JSON.parse(pointer(PREFIX+'old'));if(kind==='deep')for(let i=0;i<40;i++)ref={nested:ref};if(kind==='array')ref=JSON.stringify([ref]);if(kind==='malformed')ref='[{unknown serialized recovery';
  await write(r.indexedDB,PREFIX+'unknown',JSON.stringify({data:ref}));const diagnostic=await r.api.compactRecoveryStorage({eligibleBaseline:eligible});
  assert.ok(await raw(r.indexedDB,PREFIX+'old'),kind);assert.equal(diagnostic.reclaimedRecordsThisPass,0);if(kind!=='array')assert.equal(diagnostic.measurementComplete,false);
 }
});

test('corrupt unrelated compressed records are retained without blocking a new protected publication',async()=>{
 const r=setup();await r.api.pending;const corrupt={format:'leadintel-archive-gzip-v2',decodedBytes:10,data:new Uint8Array([1,2,3]).buffer};await write(r.indexedDB,PREFIX+'corrupt',corrupt);
 const key=await publish(r,baseline(2));assert.ok(await raw(r.indexedDB,key));assert.ok(await raw(r.indexedDB,PREFIX+'corrupt'));const diagnostic=await r.api.getRecoveryStorageDiagnostics();assert.equal(diagnostic.measurementComplete,false);assert.ok(diagnostic.unknownRecords>0);
});

test('oversized logical archive scans stay partial and never collect against incomplete references',async()=>{
 const r=setup({compression:false});await r.api.pending;await write(r.indexedDB,PREFIX+'old',JSON.stringify(baseline(1)));await write(r.indexedDB,PREFIX+'new',JSON.stringify(baseline(2)));r.values.set(PTR,pointer(PREFIX+'new'));
 await write(r.indexedDB,PREFIX+'zz-large',{format:'leadintel-archive-gzip-v2',decodedBytes:64*1024*1024+1,data:new Uint8Array([1]).buffer});
 const diagnostic=await r.api.compactRecoveryStorage({eligibleBaseline:eligible});assert.equal(diagnostic.measurementComplete,false);assert.ok(diagnostic.scannedLogicalBytes<=64*1024*1024);assert.ok(await raw(r.indexedDB,PREFIX+'old'));
});

test('an unresolved storage estimate cannot hold publication or the archive lock indefinitely',async()=>{
 const r=setup();r.root.navigator.storage.estimate=()=>new Promise(()=>{});await r.api.pending;const started=Date.now();await publish(r,baseline(1));assert.ok(Date.now()-started<2000);assert.equal(JSON.parse(r.attributes.get('data-archive-storage-diagnostics')).originQuotaBytes,null);
});

test('inline-only startup remains usable without IndexedDB while required indexed reads stay closed',async()=>{
 const indexedDB={open(){throw Object.assign(Error('Blocked'),{name:'SecurityError'});}},r=setup({indexedDB});await r.api.pending;
 const inline=JSON.stringify({schema_version:1,workspace_id:'w1',data:{draft:'kept'}});r.values.set(PTR,inline);await r.api.activate({workspaceId:'w1',userId:'u1'});
 const result=await r.api.readRecoveryPointer(PTR,{workspaceId:'w1'});assert.equal(result.raw,inline);assert.equal(result.record,null);assert.equal(r.api.current(),true);
 r.values.set(PTR,pointer(PREFIX+'missing'));await assert.rejects(r.api.readRecoveryPointer(PTR,{workspaceId:'w1'}),error=>error.code==='browser_archive_unavailable');assert.equal(r.values.get(PTR),pointer(PREFIX+'missing'));
});

function quotaDatabase(){
 const indexedDB=new IDBFactory(),open=indexedDB.open.bind(indexedDB),account={limit:Infinity,used:0,rejectCompressed:0};let committed=new Map();
 const size=value=>typeof value==='string'?Buffer.byteLength(value):value?.format==='leadintel-archive-gzip-v2'?value.data.byteLength+128:Buffer.byteLength(JSON.stringify(value));
 indexedDB.open=(...args)=>{const request=open(...args);request.addEventListener('success',()=>{const db=request.result,transaction=db.transaction.bind(db);db.transaction=(...args)=>{const tx=transaction(...args);if(args[1]!=='readwrite')return tx;const pending=new Map(committed),objectStore=tx.objectStore.bind(tx);tx.addEventListener('complete',()=>{committed=pending;account.used=[...committed.values()].reduce((a,b)=>a+b,0);});tx.objectStore=name=>{const store=objectStore(name),put=store.put.bind(store),remove=store.delete.bind(store);store.put=(value,key)=>{const next=new Map(pending);next.set(key,size(value));if(account.rejectCompressed>0&&value?.format==='leadintel-archive-gzip-v2'){account.rejectCompressed--;throw new DOMException('Origin capacity exhausted','QuotaExceededError');}if([...next.values()].reduce((a,b)=>a+b,0)>account.limit)throw new DOMException('Origin capacity exhausted','QuotaExceededError');pending.set(key,size(value));return put(value,key);};store.delete=key=>{pending.delete(key);return remove(key);};return store;};return tx;};});return request;};return {indexedDB,account};
}

test('native quota on an in-place compression preserves old data and still permits strictly eligible GC',async()=>{
 const {indexedDB,account}=quotaDatabase(),r=setup({indexedDB});await r.api.pending;
 await write(indexedDB,PREFIX+'old',JSON.stringify(baseline(1,'known acknowledged evidence '.repeat(5000))));await write(indexedDB,PREFIX+'new',JSON.stringify(baseline(2)));await write(indexedDB,PREFIX+'unknown',JSON.stringify({data:'unique unsynced draft'}));r.values.set(PTR,pointer(PREFIX+'new'));account.rejectCompressed=1;
 const diagnostic=await r.api.compactRecoveryStorage({eligibleBaseline:eligible});assert.equal(diagnostic.compressionQuotaFailures,1);assert.equal(diagnostic.reclaimedRecordsThisPass,1);assert.equal(await raw(indexedDB,PREFIX+'old'),undefined);assert.ok(await raw(indexedDB,PREFIX+'unknown'));
});

test('near-capacity publication first frees bytes by lossless same-key compression without deleting unique versions',async()=>{
 const {indexedDB,account}=quotaDatabase(),r=setup({indexedDB});await r.api.pending;const first=baseline(1,'Evidence ā😀 '.repeat(350000)),oldKey=PREFIX+'legacy';await write(indexedDB,oldKey,JSON.stringify(first));r.values.set(PTR,pointer(oldKey));account.limit=account.used+1000;
 const second=baseline(2,'Changed evidence ā😀 '.repeat(250000)),key=await publish(r,second);assert.ok(account.used<account.limit);
 assert.equal(JSON.stringify(await r.api.readRecoverySnapshot(oldKey)),JSON.stringify(first));assert.equal(JSON.stringify((await r.api.readRecoveryPointer(PTR,{workspaceId:'w1'})).record),JSON.stringify(second));assert.ok(await raw(indexedDB,key));
});

test('successive bounded passes progress beyond 64 MB, resume after reopen, and collect only superseded acknowledged versions',async()=>{
 const r=setup();await r.api.pending;const value='Evidence '.repeat(500000);
 for(let version=1;version<=10;version++)await write(r.indexedDB,PREFIX+String(version).padStart(2,'0'),JSON.stringify(baseline(version,value)));
 const draftKey=PREFIX+'unique-draft',draft={schema_version:1,workspace_id:'w1',server_synced:false,data:{draft:'Unique unsaved evidence '.repeat(100000)}};await write(r.indexedDB,draftKey,JSON.stringify(draft));r.values.set(PTR,pointer(PREFIX+'10'));
 const first=await r.api.compactRecoveryStorage({eligibleBaseline:eligible});assert.ok(first.compressedRecordsThisPass>0);assert.equal(first.reclaimedRecordsThisPass,0);assert.equal(first.cursorPersisted,true);
 const reopened=setup({indexedDB:r.indexedDB,values:r.values,sharedLocks:r.root.navigator.locks});await reopened.api.pending;let reclaimed=0;
 for(let pass=0;pass<4;pass++){const result=await reopened.api.compactRecoveryStorage({eligibleBaseline:eligible});reclaimed+=result.reclaimedRecordsThisPass;assert.ok(result.compressionAttemptedRecordsThisPass<=20);}
 assert.equal(reclaimed,9);for(let version=1;version<10;version++)assert.equal(await raw(r.indexedDB,PREFIX+String(version).padStart(2,'0')),undefined);
 assert.equal((await raw(r.indexedDB,PREFIX+'10')).format,'leadintel-archive-gzip-v2');assert.equal(JSON.stringify(await reopened.api.readRecoverySnapshot(draftKey)),JSON.stringify(draft));assert.equal((await reopened.api.readRecoveryPointer(PTR,{workspaceId:'w1'})).record.server_version,10);
 const final=await reopened.api.getRecoveryStorageDiagnostics();assert.equal(final.measurementComplete,true);assert.equal(final.collectionSkippedReason,'none');
});

test('a corrupt or oversized gzip reference index is not trusted as a complete reference inventory',async()=>{
 const r=setup();await r.api.pending;await write(r.indexedDB,PREFIX+'old',JSON.stringify(baseline(1)));await write(r.indexedDB,PREFIX+'new',JSON.stringify(baseline(2)));r.values.set(PTR,pointer(PREFIX+'new'));
 // No digest proof: declared index cannot suppress real deep references.
 let reference=JSON.parse(pointer(PREFIX+'old'));for(let i=0;i<40;i++)reference={nested:reference};const unknown={schema_version:1,workspace_id:'w1',data:{reference,text:'evidence '.repeat(10000)}};const key=await r.api.saveRecoverySnapshot(unknown),frame=await raw(r.indexedDB,key);frame.index.referencesComplete=true;frame.index.references=[];await write(r.indexedDB,key,frame);
 const result=await r.api.compactRecoveryStorage({eligibleBaseline:eligible});assert.ok(await raw(r.indexedDB,PREFIX+'old'));assert.equal(result.measurementComplete,false);
});
