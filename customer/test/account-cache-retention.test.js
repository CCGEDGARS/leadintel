const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const {IDBFactory}=require('fake-indexeddb');
const source=fs.readFileSync(require.resolve('../account-cache.js'),'utf8'),DBNAME='leadintel_account_archives_v1',PREFIX='leadintel_workspace_snapshot_v1:',PINS='leadintel_archive_pending_v2:',PTR='leadintel_customer_v2_workspace_saved_snapshot_v1';
function locks(){let tail=Promise.resolve();return {request(_key,_options,operation){const result=tail.then(operation);tail=result.catch(()=>{});return result;}};}
function setup({indexedDB=new IDBFactory(),values=new Map([['leadintel_customer_v2_workspace','w1']]),sharedLocks=locks(),compression=true,onSet,onCompress}={}){
 class Storage{constructor(map){this.map=map;}get length(){return this.map.size;}key(i){return [...this.map.keys()][i]??null;}getItem(k){return this.map.get(k)??null;}setItem(k,v){onSet?.(k,v);this.map.set(k,String(v));}removeItem(k){this.map.delete(k);}}
 const attributes=new Map(),events=[],root={indexedDB,Storage,localStorage:new Storage(values),sessionStorage:new Storage(new Map()),navigator:{locks:sharedLocks,storage:{estimate:async()=>({usage:12345,quota:99999})}},TextEncoder,TextDecoder,ArrayBuffer,Uint8Array,Blob,Response:class extends Response{async arrayBuffer(){const data=await super.arrayBuffer();await onCompress?.();return data;}},CompressionStream:compression?CompressionStream:undefined,DecompressionStream:compression?DecompressionStream:undefined,crypto:require('node:crypto').webcrypto,setTimeout,clearTimeout,URL,console,location:{href:'https://example.test/customer/',search:'',reload(){}},document:{documentElement:{setAttribute:(k,v)=>attributes.set(k,v),removeAttribute:k=>attributes.delete(k)},getElementById:()=>null},CustomEvent:class{constructor(type,{detail}){this.type=type;this.detail=detail;}},dispatchEvent:event=>events.push(event)};
 vm.runInNewContext(source,root);return {root,api:root.LeadIntelAccountCache,indexedDB,values,attributes,events};
}
async function openDB(indexedDB,version=3){return new Promise((resolve,reject)=>{const request=indexedDB.open(DBNAME,version);request.onsuccess=()=>resolve(request.result);request.onerror=()=>reject(request.error);});}
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

test('v3 migration preserves drafts but fences a paused v1 writer after its commit',async()=>{
 const indexedDB=new IDBFactory(),values=new Map([['leadintel_customer_v2_workspace','w1'],['leadintel_customer_v2_state','retained draft'],['leadintel_account_context_v1',JSON.stringify({workspaceId:'w1',userId:'u1',epoch:'li2:old'})]]);
 const request=indexedDB.open(DBNAME,1);await new Promise((resolve,reject)=>{request.onupgradeneeded=()=>request.result.createObjectStore('archives');request.onsuccess=resolve;request.onerror=reject;});request.result.onversionchange=()=>request.result.close();const oldTicket=values.get('leadintel_account_context_v1');
 const r=setup({indexedDB,values});await r.api.pending;assert.notEqual(values.get('leadintel_account_context_v1'),oldTicket);assert.equal(values.get('leadintel_customer_v2_state'),'retained draft');assert.ok(JSON.parse(values.get('leadintel_account_context_v1')).epoch.startsWith('li2:'));
 await assert.rejects(openDB(indexedDB,1),{name:'VersionError'});await assert.rejects(openDB(indexedDB,2),{name:'VersionError'});
});

test('incomplete deep or malformed reference walks disable collection; serialized array references survive',async()=>{
 for(const kind of ['deep','array','malformed']){
  const r=setup({compression:false});await r.api.pending;await write(r.indexedDB,PREFIX+'old',JSON.stringify(baseline(1)));await write(r.indexedDB,PREFIX+'current',JSON.stringify(baseline(2)));r.values.set(PTR,pointer(PREFIX+'current'));
  let ref=JSON.parse(pointer(PREFIX+'old'));if(kind==='deep')for(let i=0;i<40;i++)ref={nested:ref};if(kind==='array')ref=JSON.stringify([ref]);if(kind==='malformed')ref='[{"key":"'+PREFIX+'old"';
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

test('an indexed acknowledged-shaped record outside the owned snapshot namespace is compressed but never collected',async()=>{
 const r=setup();await r.api.pending;
 const unknownKey='foreign-owner:retained-acknowledged-shape',record=baseline(1,'Retained unknown-namespace business evidence. '.repeat(3000)),currentKey=PREFIX+'newer-owned-baseline';
 await write(r.indexedDB,unknownKey,JSON.stringify(record));await write(r.indexedDB,currentKey,JSON.stringify(baseline(2)));r.values.set(PTR,pointer(currentKey));
 await r.api.compactRecoveryStorage({eligibleBaseline:eligible});
 const indexed=await raw(r.indexedDB,unknownKey);assert.equal(indexed.format,'leadintel-archive-gzip-v2');assert.equal(indexed.index.baseline.version,1,'the frame has a vetted acknowledgement index but no snapshot-key ownership');assert.ok(indexed.indexHash);
 const second=await r.api.compactRecoveryStorage({eligibleBaseline:eligible});assert.equal(second.reclaimedRecordsThisPass,0,'a newer referenced baseline grants no ownership of foreign keys');
 const retained=await raw(r.indexedDB,unknownKey);assert.ok(retained,'unknown-namespace data must survive indexed collection');
 const text=await new Response(new Blob([retained.data]).stream().pipeThrough(new DecompressionStream('gzip'))).text();
 const digest=value=>require('node:crypto').createHash('sha256').update(value).digest('hex');assert.equal(digest(text),digest(JSON.stringify(record)),'retained foreign data stays byte-exact');assert.ok(await raw(r.indexedDB,currentKey));
});

function legacyReferenceFrame(record){
 const text=JSON.stringify(record),compressed=require('node:zlib').gzipSync(text),frame={format:'leadintel-archive-gzip-v2',decodedBytes:Buffer.byteLength(text),data:Uint8Array.from(compressed).buffer,index:{version:1,consumer:'leadintel-account-archive-v2',referencesComplete:false,references:[],baseline:eligible(record)?{workspaceId:record.workspace_id,version:record.server_version}:null}};
 frame.indexHash=require('node:crypto').createHash('sha256').update(String(frame.decodedBytes)+'\0'+JSON.stringify(frame.index)).update(compressed).digest('hex');return frame;
}

test('freeform Markdown and JSON-like source text cannot hold acknowledged-history collection without a literal snapshot namespace',async()=>{
 const r=setup({compression:false});await r.api.pending;
 const sources={markdown:'[Official source](https://source.example/report)',fragment:'{Published announcement: planned expansion',arrayTitle:'[Research report] opening this year'};
 await write(r.indexedDB,PREFIX+'old',JSON.stringify(baseline(1,sources)));await write(r.indexedDB,PREFIX+'new',JSON.stringify(baseline(2,sources)));r.values.set(PTR,pointer(PREFIX+'new'));
 const result=await r.api.compactRecoveryStorage({eligibleBaseline:eligible});assert.equal(result.measurementComplete,true);assert.equal(result.reclaimedRecordsThisPass,1);assert.equal(await raw(r.indexedDB,PREFIX+'old'),undefined);
});

test('legacy gzip reference proofs are retrofitted in place with identical gzip bytes and exact decoded content',async()=>{
 const r=setup();await r.api.pending;const record=baseline(1,{source:'[Official report](https://source.example/report)',text:'Source-backed evidence ā😀 '.repeat(5000)}),key=PREFIX+'legacy-proof',frame=legacyReferenceFrame(record);
 await write(r.indexedDB,key,frame);r.values.set(PTR,pointer(key));
 const result=await r.api.compactRecoveryStorage({eligibleBaseline:eligible}),updated=await raw(r.indexedDB,key);assert.equal(result.reindexedRecordsThisPass,1);assert.equal(updated.index.version,3);assert.equal(updated.index.consumer,'leadintel-account-archive-v3-decoded-references-v3');assert.equal(updated.index.referencesComplete,true);
 assert.deepEqual(Buffer.from(updated.data),Buffer.from(frame.data));assert.equal(updated.decodedBytes,frame.decodedBytes);assert.equal(JSON.stringify(await r.api.readRecoverySnapshot(key)),JSON.stringify(record));
 await publish(r,baseline(2,record.data.value));await r.api.compactRecoveryStorage({eligibleBaseline:eligible});assert.equal(await raw(r.indexedDB,key),undefined);
});

test('retrofit preserves incomplete malformed operational-pointer and deep-reference holds',async()=>{
 const r=setup();await r.api.pending;await write(r.indexedDB,PREFIX+'old',JSON.stringify(baseline(1)));await write(r.indexedDB,PREFIX+'new',JSON.stringify(baseline(2)));r.values.set(PTR,pointer(PREFIX+'new'));
 const record={schema_version:1,workspace_id:'w1',server_synced:false,data:{brokenPointer:'[{"key":"'+PREFIX+'old"',bulk:'Preserved data '.repeat(10000)}};const key=PREFIX+'legacy-broken';await write(r.indexedDB,key,legacyReferenceFrame(record));
 const result=await r.api.compactRecoveryStorage({eligibleBaseline:eligible});assert.equal(result.reindexedRecordsThisPass,1);assert.equal((await raw(r.indexedDB,key)).index.referencesComplete,false);assert.equal(result.measurementComplete,false);assert.ok(await raw(r.indexedDB,PREFIX+'old'));assert.equal(JSON.stringify(await r.api.readRecoverySnapshot(key)),JSON.stringify(record));
});

test('retrofit CAS cannot replace a different record published while the old gzip was decoding',async()=>{
 const r=setup();await r.api.pending;const key=PREFIX+'legacy-race',record={workspace_id:'w1',data:{text:'[Official](https://source.example) '+ 'safe '.repeat(20000)}};await write(r.indexedDB,key,legacyReferenceFrame(record));let calls=0,release,started;const gate=new Promise(resolve=>release=resolve),ready=new Promise(resolve=>started=resolve),NativeBlob=r.root.Blob;
 r.root.Blob=class extends NativeBlob{async text(){const value=await super.text();if(++calls===2){started();await gate;}return value;}};
 const pending=r.api.compactRecoveryStorage();await ready;const replacement=JSON.stringify({workspace_id:'w1',data:{draft:'A newer unique manual edit'}});await write(r.indexedDB,key,replacement);release();await pending;assert.equal(await raw(r.indexedDB,key),replacement);
});

test('bounded retrofit resumes beyond a 64 MB legacy-gzip prefix and eventually restores normal collection',async()=>{
 const r=setup();await r.api.pending;const value={source:'[Official report](https://source.example)',bulk:'Evidence '.repeat(500000)};
 for(let version=1;version<=10;version++)await write(r.indexedDB,PREFIX+'legacy-'+String(version).padStart(2,'0'),legacyReferenceFrame(baseline(version,value)));
 r.values.set(PTR,pointer(PREFIX+'legacy-10'));const first=await r.api.compactRecoveryStorage({eligibleBaseline:eligible});assert.ok(first.reindexedRecordsThisPass>0);assert.ok(first.reindexedRecordsThisPass<10);assert.equal(first.cursorPersisted,true);
 const reopened=setup({indexedDB:r.indexedDB,values:r.values,sharedLocks:r.root.navigator.locks});await reopened.api.pending;let reclaimed=first.reclaimedRecordsThisPass;
 for(let pass=0;pass<4;pass++){const result=await reopened.api.compactRecoveryStorage({eligibleBaseline:eligible});reclaimed+=result.reclaimedRecordsThisPass;assert.ok(result.compressionAttemptedRecordsThisPass<=20);}
 assert.equal(reclaimed,9);const current=await raw(r.indexedDB,PREFIX+'legacy-10');assert.equal(current.index.version,3);assert.equal(current.index.referencesComplete,true);assert.equal((await reopened.api.readRecoveryPointer(PTR,{workspaceId:'w1'})).record.server_version,10);assert.equal((await reopened.api.getRecoveryStorageDiagnostics()).measurementComplete,true);
});

const RECOVERY_PTR='leadintel_customer_v2_sync_recovery_v1';
const recoveryBundle=value=>({main:{value},discovery:{},outreach:{},delivery:{},meta:{}});
function recoveryEnvelope(revision,{workspace='w1',original,createdAt,source='safe_merge'}={}){
 const first=original||{local:recoveryBundle('Original manual work'),server:{workspace_id:workspace,schema_version:1,version:1,payload:recoveryBundle('Original server work')}};
 return {schema_version:1,workspace_id:workspace,created_at:createdAt||new Date(Date.UTC(2026,10,14,12,0,revision)).toISOString(),source,conflict:null,original:first,local:recoveryBundle('Latest manual revision '+revision),server:{workspace_id:workspace,schema_version:1,version:revision+1,payload:recoveryBundle('Latest server revision '+revision)}};
}
const recoveryPointer=(key,workspace='w1')=>JSON.stringify({format:'leadintel-indexed-sync-recovery-v1',workspace_id:workspace,key});
const publishRecovery=(r,record)=>r.api.publishRecoverySnapshot(record,{pointerKey:RECOVERY_PTR,expectedPointer:r.values.get(RECOVERY_PTR)??null,encodePointer:key=>recoveryPointer(key,record.workspace_id)});

test('twenty large conflict-recovery publications retain one immutable original and the latest pair without UUID history growth',async()=>{
 const r=setup();r.root.LeadIntelStateBudget=require('../state-budget.js');await r.api.pending;const original={local:recoveryBundle('Original evidence '.repeat(100000)),server:{workspace_id:'w1',schema_version:1,version:1,payload:recoveryBundle('Original server evidence '.repeat(100000))}};let latest;
 for(let revision=1;revision<=20;revision++){
  latest=recoveryEnvelope(revision,{original});latest.local.discovery.evidence='Local evidence '.repeat(100000);latest.server.payload.discovery.evidence='Server evidence '.repeat(100000);
  await publishRecovery(r,r.root.LeadIntelStateBudget.packRecoveryRecord(latest));
  const count=(await r.api.getRecoveryStorageDiagnostics()).totalRecords;assert.ok(count<=3,'only current, one publication predecessor and maintenance may remain');
 }
 const stored=r.root.LeadIntelStateBudget.restoreRecoveryRecord((await r.api.readRecoveryPointer(RECOVERY_PTR,{workspaceId:'w1'})).record);assert.equal(JSON.stringify(stored.original),JSON.stringify(original));assert.equal(JSON.stringify(stored.local),JSON.stringify(latest.local));assert.equal(JSON.stringify(stored.server),JSON.stringify(latest.server));
});

test('known superseded recovery retirement protects every referenced, pinned, newer, unknown and other-lineage container',async()=>{
 const r=setup({compression:false});await r.api.pending;const current=recoveryEnvelope(10),cases={old:recoveryEnvelope(2),otherLineage:recoveryEnvelope(2,{original:{local:recoveryBundle('Different original'),server:{workspace_id:'w1',schema_version:1,version:1,payload:recoveryBundle('Different server original')}}}),otherWorkspace:recoveryEnvelope(2,{workspace:'w2'}),future:recoveryEnvelope(12),newerServer:{...recoveryEnvelope(2),server:{workspace_id:'w1',schema_version:1,version:50,payload:recoveryBundle('Newer contacts')}},pinned:recoveryEnvelope(2),archived:recoveryEnvelope(2),originalReference:recoveryEnvelope(2),unknown:{...recoveryEnvelope(2),unknownManualField:'Keep unique work'},browserDraft:{server_synced:false,data:{manual:'Unique unsynced draft'}}};
 for(const [label,record]of Object.entries(cases))await write(r.indexedDB,PREFIX+label,JSON.stringify(record));await write(r.indexedDB,PREFIX+'current-recovery',JSON.stringify(current));r.values.set(RECOVERY_PTR,recoveryPointer(PREFIX+'current-recovery'));
 await write(r.indexedDB,PINS+'recovery',JSON.stringify({format:'leadintel-archive-pending-v2',key:PREFIX+'pinned'}));await write(r.indexedDB,'leadintel_account_cache_v1:other',JSON.stringify({data:{recovery:recoveryPointer(PREFIX+'archived')}}));await write(r.indexedDB,PREFIX+'unknown-root',JSON.stringify({original:{pointer:recoveryPointer(PREFIX+'originalReference')}}));
 const result=await r.api.compactRecoveryStorage();assert.equal(result.retiredRecoveryEnvelopesThisPass,1);assert.equal(await raw(r.indexedDB,PREFIX+'old'),undefined);for(const label of Object.keys(cases).filter(label=>label!=='old'))assert.ok(await raw(r.indexedDB,PREFIX+label),label);
 assert.equal(JSON.stringify((await r.api.readRecoveryPointer(RECOVERY_PTR,{workspaceId:'w1'})).record),JSON.stringify(current));
});

test('an unpublished newer envelope is not an authority for retiring the committed recovery pair',async()=>{
 let fail=false;const r=setup({onSet(key){if(fail&&key===RECOVERY_PTR)throw new DOMException('Quota','QuotaExceededError');}});await r.api.pending;const first=recoveryEnvelope(1);const key=await publishRecovery(r,first);fail=true;
 await assert.rejects(publishRecovery(r,recoveryEnvelope(2)),{name:'QuotaExceededError'});await r.api.compactRecoveryStorage();assert.ok(await raw(r.indexedDB,key));assert.equal(r.values.get(RECOVERY_PTR),recoveryPointer(key));assert.equal((await r.api.getRecoveryStorageDiagnostics()).pendingPins,1);
});

test('retirement cannot delete a candidate whose exact frame changed after lineage validation',async()=>{
 const r=setup({compression:false});await r.api.pending;const key=PREFIX+'changing';await write(r.indexedDB,key,JSON.stringify(recoveryEnvelope(1)));await write(r.indexedDB,PREFIX+'authority',JSON.stringify(recoveryEnvelope(3)));r.values.set(RECOVERY_PTR,recoveryPointer(PREFIX+'authority'));
 const prototype=require('fake-indexeddb').IDBDatabase.prototype,transaction=prototype.transaction;let replaced=false;
 try{prototype.transaction=function(...args){const tx=transaction.apply(this,args);if(args[1]==='readwrite'&&!replaced){replaced=true;tx.objectStore('archives').put(JSON.stringify({manual:'A newer unrelated unsynced record'}),key);}return tx;};const result=await r.api.compactRecoveryStorage();assert.equal(replaced,true,'the concurrent replacement must actually execute');assert.equal(result.retiredRecoveryEnvelopesThisPass,0);assert.equal((await raw(r.indexedDB,key)).includes('newer unrelated'),true);}finally{prototype.transaction=transaction;}
});

test('rotating recovery retirement resumes after twenty protected nonmatching records and a fresh tab',async()=>{
 const r=setup({compression:false});await r.api.pending;for(let i=0;i<20;i++)await write(r.indexedDB,PREFIX+String(i).padStart(2,'0')+'-unknown',JSON.stringify({manual:'Unique protected work '+i}));
 await write(r.indexedDB,PREFIX+'zz-eligible',JSON.stringify(recoveryEnvelope(1)));await write(r.indexedDB,PREFIX+'authority',JSON.stringify(recoveryEnvelope(3)));r.values.set(RECOVERY_PTR,recoveryPointer(PREFIX+'authority'));
 const first=await r.api.compactRecoveryStorage();assert.equal(first.retiredRecoveryEnvelopesThisPass,0);assert.equal(first.recoveryCandidatesVisited,20);assert.equal(first.cursorPersisted,true);
 const next=setup({indexedDB:r.indexedDB,values:r.values,sharedLocks:r.root.navigator.locks,compression:false});await next.api.pending;const result=await next.api.compactRecoveryStorage();assert.equal(result.retiredRecoveryEnvelopesThisPass,1);assert.equal(await raw(r.indexedDB,PREFIX+'zz-eligible'),undefined);for(let i=0;i<20;i++)assert.ok(await raw(r.indexedDB,PREFIX+String(i).padStart(2,'0')+'-unknown'));
});

test('a foreign workspace recovery pointer cannot authorize retiring any recovery envelope',async()=>{
 const r=setup({compression:false});await r.api.pending;await write(r.indexedDB,PREFIX+'old',JSON.stringify(recoveryEnvelope(1,{workspace:'w2'})));await write(r.indexedDB,PREFIX+'current',JSON.stringify(recoveryEnvelope(3,{workspace:'w2'})));r.values.set(RECOVERY_PTR,recoveryPointer(PREFIX+'current','w2'));
 const result=await r.api.compactRecoveryStorage();assert.equal(result.retiredRecoveryEnvelopesThisPass,0);assert.ok(await raw(r.indexedDB,PREFIX+'old'));
});

test('a corrupt live recovery authority disables recovery retirement without breaking unrelated maintenance',async()=>{
 const r=setup({compression:false});await r.api.pending;await write(r.indexedDB,PREFIX+'old',JSON.stringify(recoveryEnvelope(1)));await write(r.indexedDB,PREFIX+'current',JSON.stringify({unknown:'Corrupt or incomplete recovery authority'}));r.values.set(RECOVERY_PTR,recoveryPointer(PREFIX+'current'));
 const result=await r.api.compactRecoveryStorage();assert.equal(result.retiredRecoveryEnvelopesThisPass,0);assert.ok(await raw(r.indexedDB,PREFIX+'old'));
});

test('packed recovery retirement stays closed until the actual recovery codec is available',async()=>{
 const B=require('../state-budget.js'),r=setup({compression:false});await r.api.pending;const original={local:recoveryBundle('Original evidence '.repeat(10000)),server:{workspace_id:'w1',schema_version:1,version:1,payload:recoveryBundle('Original server evidence '.repeat(10000))}};
 await write(r.indexedDB,PREFIX+'old-packed',JSON.stringify(B.packRecoveryRecord(recoveryEnvelope(1,{original}))));await write(r.indexedDB,PREFIX+'current-packed',JSON.stringify(B.packRecoveryRecord(recoveryEnvelope(3,{original}))));r.values.set(RECOVERY_PTR,recoveryPointer(PREFIX+'current-packed'));
 const before=await r.api.compactRecoveryStorage();assert.equal(before.retiredRecoveryEnvelopesThisPass,0);assert.ok(await raw(r.indexedDB,PREFIX+'old-packed'));
 r.root.LeadIntelStateBudget=B;const after=await r.api.compactRecoveryStorage();assert.equal(after.retiredRecoveryEnvelopesThisPass,1);assert.equal(await raw(r.indexedDB,PREFIX+'old-packed'),undefined);
});

test('more than 64 MB of legacy gzip can be verified and retired without requiring a successful large proof rewrite',async()=>{
 const {indexedDB,account}=quotaDatabase(),r=setup({indexedDB});await r.api.pending;const crypto=require('node:crypto'),parts=Array.from({length:4},()=>crypto.randomBytes(750000).toString('base64')),original={local:recoveryBundle(parts[0]),server:{workspace_id:'w1',schema_version:1,version:1,payload:recoveryBundle(parts[1])}};
 let current;for(let revision=1;revision<=23;revision++){current=recoveryEnvelope(revision,{original});current.local=recoveryBundle(parts[2]);current.local.main.revision=revision;current.server.payload=recoveryBundle(parts[3]);current.server.payload.main.revision=revision;await write(indexedDB,PREFIX+'legacy-recovery-'+String(revision).padStart(2,'0'),legacyReferenceFrame(current));}
 assert.ok(account.used>64*1024*1024);r.values.set(RECOVERY_PTR,recoveryPointer(PREFIX+'legacy-recovery-23'));account.limit=account.used+1000;account.rejectCompressed=1000;
 const result=await r.api.compactRecoveryStorage();assert.ok(result.compressionQuotaFailures>0);assert.ok(result.retiredRecoveryEnvelopesThisPass>0);assert.equal(result.measurementComplete,true);assert.ok(account.used<account.limit-1000000);
 const stored=(await r.api.readRecoveryPointer(RECOVERY_PTR,{workspaceId:'w1'})).record;assert.equal(JSON.stringify(stored.original),JSON.stringify(original));assert.equal(JSON.stringify(stored.local),JSON.stringify(current.local));assert.equal(JSON.stringify(stored.server),JSON.stringify(current.server));
 account.rejectCompressed=0;const next=recoveryEnvelope(24,{original});next.local=recoveryBundle(parts[2]);next.server.payload=recoveryBundle(parts[3]);await publishRecovery(r,next);assert.equal((await r.api.readRecoveryPointer(RECOVERY_PTR,{workspaceId:'w1'})).record.server.version,25);
});

async function referenceFixture(){const r=setup({compression:false});r.root.LeadIntelStateBudget=require('../state-budget.js');await r.api.pending;await write(r.indexedDB,PREFIX+'protected-baseline',JSON.stringify(baseline(1)));await write(r.indexedDB,PREFIX+'current-baseline',JSON.stringify(baseline(2)));r.values.set(PTR,pointer(PREFIX+'current-baseline'));return r;}

test('decoded packed recovery originals preserve embedded object references to older acknowledged baselines',async()=>{
 const r=await referenceFixture(),B=r.root.LeadIntelStateBudget,record=recoveryEnvelope(3);record.original.local.main.pointer=JSON.parse(pointer(PREFIX+'protected-baseline'));record.local.discovery.evidence='Source evidence '.repeat(10000);record.original.local.discovery.evidence=record.local.discovery.evidence;record.server.payload.discovery.evidence=record.local.discovery.evidence;
 const packed=B.packRecoveryRecord(record);assert.equal(packed.format,'leadintel-sync-recovery-refs-v1');await write(r.indexedDB,PREFIX+'packed-recovery-holder',JSON.stringify(packed));
 const result=await r.api.compactRecoveryStorage({eligibleBaseline:eligible});assert.equal(result.measurementComplete,true);assert.ok(result.referencedSnapshots>=2);assert.equal(result.reclaimedRecordsThisPass,0);assert.ok(await raw(r.indexedDB,PREFIX+'protected-baseline'));
});

test('decoded packed originals also protect older recovery envelopes against owner retirement',async()=>{
 const r=setup({compression:false});r.root.LeadIntelStateBudget=require('../state-budget.js');await r.api.pending;await write(r.indexedDB,PREFIX+'protected-recovery',JSON.stringify(recoveryEnvelope(1)));await write(r.indexedDB,PREFIX+'current-recovery',JSON.stringify(recoveryEnvelope(3)));r.values.set(RECOVERY_PTR,recoveryPointer(PREFIX+'current-recovery'));
 const holder=recoveryEnvelope(4);holder.original.local.main.pointer=JSON.parse(recoveryPointer(PREFIX+'protected-recovery'));holder.original.local.discovery.evidence='Repeated protected evidence '.repeat(10000);await write(r.indexedDB,PREFIX+'packed-original-holder',JSON.stringify(r.root.LeadIntelStateBudget.packRecoveryRecord(holder)));
 const result=await r.api.compactRecoveryStorage();assert.equal(result.measurementComplete,true);assert.equal(result.retiredRecoveryEnvelopesThisPass,0);assert.ok(await raw(r.indexedDB,PREFIX+'protected-recovery'));
});

test('packed LZW workspace snapshots protect pointers hidden in their decoded data strings',async()=>{
 const r=await referenceFixture(),B=r.root.LeadIntelStateBudget,record={schema_version:1,server_synced:false,workspace_id:'w1',data:{pointer:pointer(PREFIX+'protected-baseline'),evidence:'Repeated evidence ā😀 '.repeat(10000)}};
 const packed=B.packWorkspaceSnapshot(record);assert.equal(packed.format,'leadintel-workspace-snapshot-lzw-v1');await write(r.indexedDB,PREFIX+'packed-workspace-holder',JSON.stringify(packed));
 const result=await r.api.compactRecoveryStorage({eligibleBaseline:eligible});assert.equal(result.measurementComplete,true);assert.equal(result.reclaimedRecordsThisPass,0);assert.ok(await raw(r.indexedDB,PREFIX+'protected-baseline'));
});

test('missing or invalid packed-record decoders keep collection closed instead of trusting opaque tagged arrays',async()=>{
 for(const kind of ['recovery','workspace','unknown']){const r=await referenceFixture(),B=r.root.LeadIntelStateBudget;let packed;
  if(kind==='recovery'){const record=recoveryEnvelope(3);record.original.local.main.pointer=JSON.parse(pointer(PREFIX+'protected-baseline'));record.original.local.discovery.evidence='Repeated evidence '.repeat(10000);packed=B.packRecoveryRecord(record);}
  if(kind==='workspace')packed=B.packWorkspaceSnapshot({schema_version:1,workspace_id:'w1',data:{pointer:pointer(PREFIX+'protected-baseline'),evidence:'Repeated evidence '.repeat(10000)}});
  if(kind==='unknown')packed={format:'leadintel-workspace-snapshot-lzw-v999',data:{opaque:'Unknown future encoding'}};
  await write(r.indexedDB,PREFIX+'packed-holder',JSON.stringify(packed));delete r.root.LeadIntelStateBudget;const before=await r.api.compactRecoveryStorage({eligibleBaseline:eligible});assert.equal(before.measurementComplete,false);assert.ok(await raw(r.indexedDB,PREFIX+'protected-baseline'));
  r.root.LeadIntelStateBudget=B;const after=await r.api.compactRecoveryStorage({eligibleBaseline:eligible});assert.equal(after.measurementComplete,kind!=='unknown');assert.ok(await raw(r.indexedDB,PREFIX+'protected-baseline'));
 }
});

function encodedLocalSection(value){const values=new Map([['leadintel_customer_v2_state',JSON.stringify(value)]]);class Storage{getItem(k){return values.get(k)??null;}setItem(k,v){values.set(k,String(v));}}const root={Storage,localStorage:new Storage(),TextEncoder,TextDecoder,Buffer,console,LeadIntelAccountCache:{localCodecVersion:2,prepareLocalStorageCodec(){}}};vm.runInNewContext(fs.readFileSync(require.resolve('../state-budget.js'),'utf8'),root);return values.get('leadintel_customer_v2_state');}

test('account archives retain object references hidden in raw local-storage section compression',async()=>{
 const r=await referenceFixture(),encoded=encodedLocalSection({pointer:JSON.parse(pointer(PREFIX+'protected-baseline')),evidence:'Repeated evidence '.repeat(10000)});assert.ok(encoded.startsWith('leadintel-local-section-lzw-v1:'));
 await write(r.indexedDB,'leadintel_account_cache_v1:compressed-owner',JSON.stringify({schemaVersion:1,workspaceId:'w1',data:{leadintel_customer_v2_state:encoded},sessionData:{}}));const result=await r.api.compactRecoveryStorage({eligibleBaseline:eligible});assert.equal(result.measurementComplete,true);assert.ok(await raw(r.indexedDB,PREFIX+'protected-baseline'));
});

test('a deeply nested known local codec remains incomplete at the traversal boundary',async()=>{
 const r=await referenceFixture();let nested=encodedLocalSection({pointer:JSON.parse(pointer(PREFIX+'protected-baseline')),evidence:'Repeated evidence '.repeat(10000)});for(let i=0;i<40;i++)nested={nested};await write(r.indexedDB,PREFIX+'deep-local',JSON.stringify({data:nested}));const result=await r.api.compactRecoveryStorage({eligibleBaseline:eligible});assert.equal(result.measurementComplete,false);assert.ok(await raw(r.indexedDB,PREFIX+'protected-baseline'));
});
