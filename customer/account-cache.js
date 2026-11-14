(function(root){
  'use strict';
  if(root.LeadIntelAccountCache||!root.localStorage)return;
  const traceStarted=Date.now(),traceEnabled=/(?:[?&])startup_trace=1(?:&|$)/.test(root.location?.search||'');
  root.LeadIntelStartupTrace=phase=>{if(traceEnabled)root.console?.info?.('LeadIntel startup: '+phase+' ('+(Date.now()-traceStarted)+' ms)');};
  root.LeadIntelStartupTrace('account cache loaded');
  if(traceEnabled&&root.MutationObserver){
    const NativeObserver=root.MutationObserver;
    root.MutationObserver=class extends NativeObserver{
      constructor(callback){
        const frame=String(new Error().stack||'').split('\n').find(line=>line.includes('/customer/')&&!line.includes('account-cache.js'))||'';
        const source=frame.match(/\/([\w-]+\.js)(?:\?[^:\s]*)?:(\d+):\d+/),label=source?source[1]+':'+source[2]:'anonymous';let calls=0;
        super(function(records,observer){const count=++calls,report=count===1||count===100||count===1000;
          if(report)root.LeadIntelStartupTrace('observer '+label+' #'+count+':start');
          try{return callback.call(this,records,observer);}finally{if(report)root.LeadIntelStartupTrace('observer '+label+' #'+count+':complete');}
        });
      }
    };
  }
  const CONTEXT_KEY='leadintel_account_context_v1';
  const ARCHIVE_PREFIX='leadintel_account_cache_v1:';
  const ARCHIVE_DATABASE='leadintel_account_archives_v1';
  const ARCHIVE_STORE='archives';
  const ARCHIVE_TIMEOUT_MS=8000;
  const SNAPSHOT_PIN_PREFIX='leadintel_archive_pending_v2:';
  const ARCHIVE_GZIP_FORMAT='leadintel-archive-gzip-v2';
  const ARCHIVE_LOCK='leadintel-account-archives-v2';
  const ARCHIVE_MAINTENANCE='leadintel_archive_maintenance_v2';
  const POINTER_FORMATS=new Set(['leadintel-indexed-workspace-snapshot-v1','leadintel-indexed-sync-recovery-v1']);
  const MAX_ARCHIVE_BYTES=64*1024*1024;
  const WORKSPACE_KEY='leadintel_customer_v2_workspace';
  const LEGACY_CLEANUP_KEY='leadintel_customer_v2_legacy_local_cleanup_20260901_v2';
  const storage=root.localStorage,session=root.sessionStorage;
  const proto=root.Storage?.prototype;
  const rawGet=proto?.getItem||storage.getItem;
  const rawSet=proto?.setItem||storage.setItem;
  const rawRemove=proto?.removeItem||storage.removeItem;
  const get=(store,key)=>store?rawGet.call(store,key):null;
  const set=(store,key,value)=>rawSet.call(store,key,value);
  const remove=(store,key)=>rawRemove.call(store,key);
  const parse=value=>{try{return JSON.parse(value||'null');}catch{return null;}};
  const scopedKey=key=>String(key).startsWith('leadintel_')&&key!==CONTEXT_KEY&&key!=='leadintel_auth_provider'&&!String(key).startsWith(ARCHIVE_PREFIX)&&key!==LEGACY_CLEANUP_KEY;
  let ticket=get(storage,CONTEXT_KEY);
  let context=parse(ticket)||{workspaceId:get(storage,WORKSPACE_KEY)||parse(get(storage,'leadintel_customer_v2_workspace_saved_snapshot_v1'))?.workspace_id||'',userId:''};
  let invalidated=false,verified=false,transitioning=false,databasePromise=null,archiveInitialization=null,archiveInitialized=false,archiveInitializationError=null,compressionCursor=0,compressionCursorLoaded=false;
  function current(){return !invalidated&&get(storage,CONTEXT_KEY)===ticket;}
  function invalidate(){if(invalidated)return;invalidated=true;root.document?.documentElement?.setAttribute('data-account-check','pending');root.location?.reload?.();}
  function assertCurrent(expected=ticket){if(!current()||expected!==ticket){invalidate();throw Object.assign(new Error('LeadIntel account changed. Refresh to continue.'),{code:'account_context_changed'});}}
  function assertAccessible(){assertCurrent();if(transitioning)throw new Error('LeadIntel is preserving the previous account.');}
  const after=(value,operation)=>value&&typeof value.then==='function'?value.then(operation):operation(value);
  function transition(operation){
    assertAccessible();transitioning=true;verified=false;root.document?.documentElement?.setAttribute('data-account-check','pending');
    try{const result=operation();if(result&&typeof result.then==='function')return result.finally(()=>{transitioning=false;});transitioning=false;return result;}
    catch(cause){transitioning=false;throw cause;}
  }
  const ARCHIVE_ERROR_NAMES=new Set(['Error','TypeError','AbortError','QuotaExceededError','UnknownError','InvalidStateError','NotFoundError','ConstraintError','DataError','ReadOnlyError','TransactionInactiveError','DataCloneError','VersionError','SecurityError','InvalidAccessError','NotAllowedError','TimeoutError']);
  const ARCHIVE_PHASES=new Set(['archive','archive_open','archive_open_blocked','archive_open_timeout','archive_upgrade','archive_read','archive_write','archive_read_request','archive_write_request','archive_read_transaction','archive_write_transaction','archive_read_timeout','archive_write_timeout']);
  const ARCHIVE_CATEGORIES=new Set(['quota','value_too_large','timeout','blocked','aborted','security','invalid_state','unknown']);
  function archiveError(cause,phase='archive'){
    const name=ARCHIVE_ERROR_NAMES.has(cause?.name)?cause.name:'Error',detail=String(cause?.message||'').slice(0,2048);
    // Use native names and bounded pattern classification only. Never retain a
    // provider/browser message, path, serialized value, or original cause.
    const category=phase==='archive_open_blocked'?'blocked':name==='QuotaExceededError'||/quota|disk (?:is )?full|(?:not enough|insufficient) (?:disk )?(?:space|storage)/i.test(detail)?'quota':/too large|exceeds? (?:the )?max|maximum (?:allowed )?(?:size|length)|value size/i.test(detail)?'value_too_large':name==='TimeoutError'||/timed? ?out|timeout/i.test(detail)?'timeout':name==='AbortError'?'aborted':['SecurityError','NotAllowedError'].includes(name)?'security':['InvalidStateError','TransactionInactiveError'].includes(name)?'invalid_state':'unknown';
    const safePhase=ARCHIVE_PHASES.has(phase)?phase:'archive';
    return Object.assign(new Error('Your browser could not safely preserve the workspace ('+name+' / '+safePhase+' / '+category+'). Existing drafts were kept.'),{name,code:'browser_archive_unavailable',phase:safePhase,category});
  }
  function archiveDatabase(){
    if(databasePromise)return databasePromise;
    databasePromise=new Promise((resolve,reject)=>{
      let finished=false,request;const timer=root.setTimeout?.(()=>finish(archiveError({name:'TimeoutError'},'archive_open_timeout')),ARCHIVE_TIMEOUT_MS);
      function finish(cause,db){if(finished){db?.close();return;}finished=true;root.clearTimeout?.(timer);if(cause)reject(cause);else resolve(db);}
      try{request=root.indexedDB.open(ARCHIVE_DATABASE,2);}catch(cause){finish(archiveError(cause,'archive_open'));return;}
      request.onupgradeneeded=event=>{try{if(!request.result.objectStoreNames.contains(ARCHIVE_STORE))request.result.createObjectStore(ARCHIVE_STORE);assertCurrent();if(event.oldVersion>0)updateContext(context.workspaceId||'',context.userId||'',true);}catch(cause){try{request.transaction?.abort();}catch{}finish(cause?.code==='account_context_changed'?cause:archiveError(cause,'archive_upgrade'));}};
      request.onerror=()=>finish(archiveError(request.error,'archive_open'));
      request.onblocked=()=>finish(archiveError(null,'archive_open_blocked'));
      request.onsuccess=()=>{const db=request.result;db.onversionchange=()=>{db.close();databasePromise=null;};finish(null,db);};
    });
    return databasePromise;
  }
  function archiveReady(){
    if(!root.indexedDB)return Promise.resolve();
    if(!archiveInitialization)archiveInitialization=archiveDatabase().then(()=>{assertCurrent();archiveInitialized=true;});
    return archiveInitialization;
  }
  function archiveLock(operation){return root.navigator?.locks?.request?root.navigator.locks.request(ARCHIVE_LOCK,{mode:'exclusive'},operation):operation();}
  function byteLength(value){if(Object.prototype.toString.call(value)==='[object ArrayBuffer]')return value.byteLength;if(ArrayBuffer.isView(value))return value.byteLength;if(value?.format===ARCHIVE_GZIP_FORMAT)return (value.data?.byteLength||0)+byteLength(JSON.stringify({format:value.format,decodedBytes:value.decodedBytes,index:value.index,indexHash:value.indexHash}));const text=typeof value==='string'?value:JSON.stringify(value);return root.TextEncoder?new root.TextEncoder().encode(text).byteLength:text.length*2;}
  async function decodeArchiveValue(value,rawText=false){
    if(value?.format!==ARCHIVE_GZIP_FORMAT)return typeof value==='string'?parse(value):value&&typeof value==='object'?value:null;
    if(!root.DecompressionStream||!Number.isSafeInteger(value.decodedBytes)||value.decodedBytes<0||value.decodedBytes>MAX_ARCHIVE_BYTES||Object.prototype.toString.call(value.data)!=='[object ArrayBuffer]')throw archiveError(null,'archive_read');
    const reader=new root.Blob([value.data]).stream().pipeThrough(new root.DecompressionStream('gzip')).getReader(),parts=[];let total=0;
    try{while(true){const part=await reader.read();if(part.done)break;total+=part.value.byteLength;if(total>value.decodedBytes)throw archiveError(null,'archive_read');parts.push(part.value);}if(total!==value.decodedBytes)throw archiveError(null,'archive_read');const text=await new root.Blob(parts).text();return rawText?text:JSON.parse(text);}catch(cause){try{await reader.cancel();}catch{}throw archiveError(cause,'archive_read');}
  }
  async function archiveIndexHash(frame,index){
    if(!root.crypto?.subtle)return null;
    const bytes=await new root.Blob([String(frame.decodedBytes),'\0',JSON.stringify(index),new Uint8Array(frame.data)]).arrayBuffer();
    return [...new Uint8Array(await root.crypto.subtle.digest('SHA-256',bytes))].map(value=>value.toString(16).padStart(2,'0')).join('');
  }
  async function verifiedArchiveIndex(frame){
    const index=frame?.index;
    if(frame?.format!==ARCHIVE_GZIP_FORMAT||!index||index.version!==1||index.consumer!=='leadintel-account-archive-v2'||typeof index.referencesComplete!=='boolean'||!Array.isArray(index.references)||index.references.length>1000||!index.references.every(key=>typeof key==='string'&&key.length<=2048&&key.startsWith(SNAPSHOT_PREFIX))||byteLength(JSON.stringify(index))>256*1024||!Number.isSafeInteger(frame.decodedBytes)||frame.decodedBytes<0||frame.decodedBytes>MAX_ARCHIVE_BYTES||Object.prototype.toString.call(frame.data)!=='[object ArrayBuffer]')return null;
    if(index.baseline!==null&&(!index.baseline||typeof index.baseline.workspaceId!=='string'||!Number.isSafeInteger(index.baseline.version)||index.baseline.version<0))return null;
    return frame.indexHash&&await archiveIndexHash(frame,index)===frame.indexHash?index:null;
  }
  async function encodeArchiveValue(text,eligibleBaseline=root.LeadIntelWorkspacePersistence?.isAcknowledgedBaseline){
    if(!root.CompressionStream||!root.DecompressionStream||!root.Blob||!root.Response||byteLength(text)>MAX_ARCHIVE_BYTES)return text;
    const data=await new root.Response(new root.Blob([text]).stream().pipeThrough(new root.CompressionStream('gzip'))).arrayBuffer();
    if(data.byteLength+128>=byteLength(text))return text;
    const frame={format:ARCHIVE_GZIP_FORMAT,decodedBytes:byteLength(text),data};
    const decoded=await decodeArchiveValue(frame,true);
    // JSON serialization is the exact record representation written by callers.
    if(decoded!==text)throw archiveError(null,'archive_write');
    if(root.crypto?.subtle){const record=JSON.parse(text),references=new Set(),referencesComplete=pointerReferences(record,references),baseline=eligibleBaseline?.(record)===true&&typeof record.workspace_id==='string'&&record.workspace_id.length<=512&&Number.isSafeInteger(record.server_version)?{workspaceId:record.workspace_id,version:record.server_version}:null;
      const bounded=[...references].filter(key=>key.length<=2048).sort().slice(0,1000);
      frame.index={version:1,consumer:'leadintel-account-archive-v2',referencesComplete:referencesComplete&&bounded.length===references.size,references:bounded,baseline};
      if(byteLength(JSON.stringify(frame.index))>256*1024){frame.index.references=[];frame.index.referencesComplete=false;}
      frame.indexHash=await archiveIndexHash(frame,frame.index);
    }
    return frame;
  }
  async function rawArchiveValue(key){let request;await archiveTransaction('readonly',store=>{request=store.get(key);});return request.result;}
  async function archiveTransaction(mode,operation){
    const db=await archiveDatabase();assertCurrent();
    return new Promise((resolve,reject)=>{
      const action=mode==='readonly'?'read':'write';
      let tx,result,finished=false;const timer=root.setTimeout?.(()=>{finish(archiveError({name:'TimeoutError'},'archive_'+action+'_timeout'));try{tx?.abort();}catch{}},ARCHIVE_TIMEOUT_MS);
      function finish(cause){if(finished)return;finished=true;root.clearTimeout?.(timer);if(cause)reject(cause);else resolve(result);}
      try{
        tx=db.transaction(ARCHIVE_STORE,mode);
        // A successful put request is not a committed backup. Wait for oncomplete.
        tx.oncomplete=()=>finish();
        tx.onabort=()=>finish(archiveError(tx.error,'archive_'+action+'_transaction'));
        tx.onerror=event=>{const request=event?.target&&event.target!==tx?event.target:null;finish(archiveError(request?.error||tx.error,'archive_'+action+(request?'_request':'_transaction')));};
        result=operation(tx.objectStore(ARCHIVE_STORE),cause=>{finish(cause?.code==='account_context_changed'?cause:archiveError(cause,'archive_'+action+'_transaction'));try{tx.abort();}catch{}});
      }catch(cause){finish(cause?.code==='account_context_changed'?cause:archiveError(cause,'archive_'+action+'_transaction'));try{tx?.abort();}catch{}}
    });
  }
  function storedArchive(key){
    const local=parse(get(storage,key));if(local||!root.indexedDB)return local;
    return rawArchiveValue(key).then(decodeArchiveValue);
  }
  function entries(store){const data={};if(!store)return data;for(let i=0;i<store.length;i++){const key=store.key(i);if(scopedKey(key)){const value=get(store,key);if(value!==null)Object.defineProperty(data,key,{value,enumerable:true});}}return data;}
  function checkpoint(){return root.indexedDB?archiveReady().then(()=>archiveLock(checkpointBody)):checkpointBody();}
  function checkpointBody(){
    assertCurrent();const data=entries(storage),sessionData=entries(session);
    if(!Object.keys(data).length&&!Object.keys(sessionData).length)return null;
    const workspaceId=context.workspaceId||get(storage,WORKSPACE_KEY)||parse(get(storage,'leadintel_customer_v2_workspace_saved_snapshot_v1'))?.workspace_id||'';
    // Unattributed guest/legacy data is preserved, but never adopted by a login.
    const archiveKey=ARCHIVE_PREFIX+(workspaceId?encodeURIComponent(workspaceId):'unassigned:'+Date.now().toString(36)+'-'+Math.random().toString(36).slice(2));
    const record={schemaVersion:1,workspaceId,userId:context.userId||'',savedAt:new Date().toISOString(),data,sessionData};
    const encoded=JSON.stringify(record);
    if(!root.indexedDB){set(storage,archiveKey,encoded);if(get(storage,archiveKey)!==encoded)throw new Error('Could not preserve the previous workspace.');return record;}
    const started=ticket,legacy=[];
    for(let index=0;index<storage.length;index++){const key=storage.key(index);if(String(key).startsWith(ARCHIVE_PREFIX))legacy.push([key,get(storage,key)]);}
    return compactArchivesLocked({eligibleBaseline:root.LeadIntelWorkspacePersistence?.isAcknowledgedBaseline}).then(async()=>{const copies=[];for(const [key,value] of legacy)copies.push([key,parse(value)===null?value:await encodeArchiveValue(value)]);return {current:await encodeArchiveValue(encoded),copies};}).then(compacted=>archiveTransaction('readwrite',store=>{assertCurrent(started);for(const [key,value] of compacted.copies)store.put(value,key);store.put(compacted.current,archiveKey);})).then(()=>{
      assertCurrent(started);
      // Retire a local duplicate only after every archive was committed elsewhere.
      for(const [key,value] of legacy)if(get(storage,key)===value)remove(storage,key);
      return record;
    });
  }
  const SNAPSHOT_PREFIX='leadintel_workspace_snapshot_v1:';
  async function saveRecoverySnapshot(record){
    await archiveReady();
    return archiveLock(()=>saveRecoverySnapshotLocked(record));
  }
  async function saveRecoverySnapshotLocked(record,eligibleBaseline){
    const started=ticket;assertCurrent(started);
    if(!root.indexedDB)throw archiveError(null,'archive_write');
    const key=SNAPSHOT_PREFIX+encodeURIComponent(record.workspace_id||'local')+':'+(record.server_version??'local')+':'+(root.crypto?.randomUUID?.()||Date.now().toString(36)+'-'+Math.random().toString(36).slice(2));
    const encoded=await encodeArchiveValue(JSON.stringify(record),eligibleBaseline);assertCurrent(started);
    await archiveTransaction('readwrite',store=>{store.put(encoded,key);store.put(JSON.stringify({format:'leadintel-archive-pending-v2',key,ownerTicket:started}),SNAPSHOT_PIN_PREFIX+key);});assertCurrent(started);return key;
  }
  async function readRecoverySnapshot(key){
    await archiveReady();
    const started=ticket;assertCurrent(started);
    if(!String(key).startsWith(SNAPSHOT_PREFIX)||!root.indexedDB)throw archiveError(null,'archive_read');
    const record=await storedArchive(key);assertCurrent(started);if(!record)throw archiveError(null,'archive_read');return record;
  }
  function archivePointerChanged(){return Object.assign(new Error('The saved recovery pointer changed. Existing drafts were kept; retry against the current saved version.'),{code:'archive_pointer_changed',phase:'archive_write'});}
  function pointerReferences(value,refs,depth=0,budget={remaining:250000}){
    if(--budget.remaining<0)return false;
    const serialized=typeof value==='string'&&/^[\s]*[\[{]/.test(value);
    if(depth>30)return !serialized&&(!value||typeof value!=='object');
    if(typeof value==='string'){if(!serialized)return true;const decoded=parse(value);return decoded!==null&&pointerReferences(decoded,refs,depth+1,budget);}
    if(!value||typeof value!=='object')return true;
    if(POINTER_FORMATS.has(value.format)&&typeof value.key==='string'&&value.key.startsWith(SNAPSHOT_PREFIX))refs.add(value.key);
    if(value.format==='leadintel-archive-pending-v2'&&typeof value.key==='string')refs.add(value.key);
    let complete=true;for(const item of Object.values(value))if(!pointerReferences(item,refs,depth+1,budget))complete=false;return complete;
  }
  function localReferenceState(){const rows=[];for(const store of [storage,session])if(store)for(let index=0;index<store.length;index++){const key=store.key(index);rows.push([store===storage?'local':'session',key,get(store,key)]);}return rows;}
  async function archiveKeys(){const keys=[];await archiveTransaction('readonly',store=>{const request=store.openKeyCursor();request.onsuccess=()=>{const cursor=request.result;if(cursor){keys.push(cursor.key);cursor.continue();}};});return keys;}
  async function archiveInventory(eligibleBaseline){
    const keys=await archiveKeys(),roots=localReferenceState(),references=new Set(),baselines=[],rawKeys=[],pins=new Set();let totalBytes=0,logicalBytes=0,scanned=0,rawCount=0,compressedCount=0,unknownCount=0,referencesComplete=true;
    for(const row of roots)if(!pointerReferences(row[2],references))referencesComplete=false;
    // Enumerate account roots even when a large legacy snapshot set exceeds the
    // bounded scan. A partial inventory may compress, but can never collect.
    const ordered=[...keys.filter(key=>String(key).startsWith(ARCHIVE_PREFIX)||String(key).startsWith(SNAPSHOT_PIN_PREFIX)),...keys.filter(key=>!String(key).startsWith(ARCHIVE_PREFIX)&&!String(key).startsWith(SNAPSHOT_PIN_PREFIX))];
    for(const key of ordered){
      if(scanned>=500)break;
      const raw=await rawArchiveValue(key);if(raw===undefined){scanned++;continue;}
      const size=byteLength(raw);if(totalBytes+size>MAX_ARCHIVE_BYTES){referencesComplete=false;break;}
      const index=await verifiedArchiveIndex(raw),logical=index?size:raw?.format===ARCHIVE_GZIP_FORMAT?Math.max(size,Number(raw.decodedBytes)||0):size;
      if(logicalBytes+logical>MAX_ARCHIVE_BYTES){referencesComplete=false;break;}
      scanned++;totalBytes+=size;logicalBytes+=logical;
      if(typeof raw==='string'){rawCount++;if(rawKeys.length<20&&!String(key).startsWith(SNAPSHOT_PIN_PREFIX)&&byteLength(raw)>=65536)rawKeys.push(key);}else if(raw?.format===ARCHIVE_GZIP_FORMAT)compressedCount++;else unknownCount++;
      if(index){for(const reference of index.references)references.add(reference);if(!index.referencesComplete)referencesComplete=false;if(String(key).startsWith(SNAPSHOT_PREFIX)&&eligibleBaseline&&index.baseline)baselines.push({key,workspaceId:index.baseline.workspaceId,version:index.baseline.version});continue;}
      let record;try{record=await decodeArchiveValue(raw);}catch{unknownCount++;referencesComplete=false;continue;}
      // Unknown records are retained, and their embedded pointers (including
      // conflict originals) protect referenced snapshots transitively as well.
      if(!pointerReferences(record,references))referencesComplete=false;
      if(String(key).startsWith(SNAPSHOT_PIN_PREFIX)&&record?.format==='leadintel-archive-pending-v2'){pins.add(record.key);references.add(record.key);}
      if(String(key).startsWith(SNAPSHOT_PREFIX)&&eligibleBaseline?.(record)===true&&typeof record.workspace_id==='string'&&Number.isSafeInteger(record.server_version))baselines.push({key,workspaceId:record.workspace_id,version:record.server_version});
    }
    return {keys,roots,references,baselines,rawKeys,pins,totalBytes,logicalBytes,scanned,rawCount,compressedCount,unknownCount,referencesComplete,scanComplete:scanned===keys.length,complete:referencesComplete&&scanned===keys.length};
  }
  async function publishArchiveDiagnostics(inventory,extra={}){
    let estimate={},timer;try{estimate=await Promise.race([Promise.resolve().then(()=>root.navigator?.storage?.estimate?.()||{}),new Promise(resolve=>{timer=root.setTimeout(()=>resolve({}),500);})])||{};}catch{}finally{root.clearTimeout(timer);}
    const collectionSkippedReason=!root.navigator?.locks?.request?'no_lock':!inventory.scanComplete?'partial_scan':!inventory.referencesComplete?'incomplete_refs':'none';
    const detail={schemaVersion:2,totalRecords:inventory.keys.length,scannedRecords:inventory.scanned,measuredBytes:inventory.totalBytes,scannedLogicalBytes:inventory.logicalBytes,measurementComplete:inventory.complete,rawRecords:inventory.rawCount,compressedRecords:inventory.compressedCount,pendingPins:inventory.pins.size,unknownRecords:inventory.unknownCount,eligibleAcknowledgedBaselines:inventory.baselines.length,referencedSnapshots:inventory.references.size,collectionSkippedReason,originUsageBytes:Number.isFinite(estimate.usage)?estimate.usage:null,originQuotaBytes:Number.isFinite(estimate.quota)?estimate.quota:null,...extra};
    root.document?.documentElement?.setAttribute('data-archive-storage-diagnostics',JSON.stringify(detail));
    if(root.CustomEvent)root.dispatchEvent?.(new root.CustomEvent('leadintel:archive-storage-diagnostics',{detail}));return detail;
  }
  async function compactArchivesLocked({eligibleBaseline=root.LeadIntelWorkspacePersistence?.isAcknowledgedBaseline}={}){
    if(!compressionCursorLoaded){const state=parse(await rawArchiveValue(ARCHIVE_MAINTENANCE));if(Number.isSafeInteger(state?.compressionCursor)&&state.compressionCursor>=0)compressionCursor=state.compressionCursor;compressionCursorLoaded=true;}
    const inventory=await archiveInventory(eligibleBaseline);let compressed=0,reclaimed=0,savedBytes=0,compressionBytes=0,compressionQuotaFailures=0,attempted=0;
    // Same-key replacement never discards a unique record. Compression and its
    // round-trip verification happen outside the short compare-and-put txn.
    const compressionKeys=inventory.keys.filter(key=>!String(key).startsWith(SNAPSHOT_PIN_PREFIX)&&key!==ARCHIVE_MAINTENANCE);
    for(let visited=0;visited<Math.min(compressionKeys.length,100)&&attempted<20;visited++){
      const key=compressionKeys[compressionCursor++%compressionKeys.length];
      const previous=await rawArchiveValue(key);if(typeof previous!=='string'||byteLength(previous)<65536||parse(previous)===null)continue;
      attempted++;
      compressionBytes+=byteLength(previous);if(compressionBytes>MAX_ARCHIVE_BYTES)break;
      const encoded=await encodeArchiveValue(previous,eligibleBaseline);if(typeof encoded==='string')continue;
      let changed=false;
      try{await archiveTransaction('readwrite',(store,fail)=>{const request=store.get(key);request.onsuccess=()=>{if(request.result===previous){try{store.put(encoded,key);changed=true;}catch(cause){fail(cause);}}};});}catch(cause){if(cause?.name==='QuotaExceededError'||cause?.category==='quota'){compressionQuotaFailures++;continue;}throw cause;}
      if(changed){compressed++;savedBytes+=byteLength(previous)-byteLength(encoded);}
    }
    // Without an origin-wide lock, or with incomplete roots, collection is
    // deliberately disabled. Compression remains a lossless CAS operation.
    if(root.navigator?.locks?.request&&inventory.complete&&eligibleBaseline&&JSON.stringify(inventory.roots)===JSON.stringify(localReferenceState())){
      let gcDecodedBytes=0;const newer=[];for(const row of inventory.baselines.filter(row=>inventory.references.has(row.key)&&!inventory.pins.has(row.key))){const raw=await rawArchiveValue(row.key),size=raw?.format===ARCHIVE_GZIP_FORMAT?raw.decodedBytes:byteLength(raw);if(gcDecodedBytes+size>MAX_ARCHIVE_BYTES)break;gcDecodedBytes+=size;const record=await decodeArchiveValue(raw);if(eligibleBaseline(record)===true&&record.workspace_id===row.workspaceId&&record.server_version===row.version)newer.push(row);}
      const candidates=inventory.baselines.filter(row=>!inventory.references.has(row.key)&&!inventory.pins.has(row.key)&&newer.some(next=>next.workspaceId===row.workspaceId&&next.version>row.version)).slice(0,20);
      for(const candidate of candidates){
        const raw=await rawArchiveValue(candidate.key),size=raw?.format===ARCHIVE_GZIP_FORMAT?raw.decodedBytes:byteLength(raw);if(gcDecodedBytes+size>MAX_ARCHIVE_BYTES)break;gcDecodedBytes+=size;const record=await decodeArchiveValue(raw);
        if(eligibleBaseline(record)!==true||record.workspace_id!==candidate.workspaceId||record.server_version!==candidate.version)continue;
        let removed=false;
        await archiveTransaction('readwrite',store=>{const request=store.get(candidate.key);request.onsuccess=()=>{const current=request.result;let same=typeof raw==='string'?current===raw:current?.format===ARCHIVE_GZIP_FORMAT&&current.decodedBytes===raw.decodedBytes&&current.indexHash===raw.indexHash&&JSON.stringify(current.index)===JSON.stringify(raw.index)&&current.data?.byteLength===raw.data?.byteLength;if(same&&typeof raw!=='string'){const a=new Uint8Array(current.data),b=new Uint8Array(raw.data);same=a.every((value,index)=>value===b[index]);}if(same&&JSON.stringify(inventory.roots)===JSON.stringify(localReferenceState())){store.delete(candidate.key);removed=true;}};});
        if(removed){reclaimed++;savedBytes+=byteLength(raw);}
      }
    }
    let cursorPersisted=false;if(compressed||reclaimed){try{await archiveTransaction('readwrite',store=>store.put(JSON.stringify({format:'leadintel-archive-maintenance-v2',compressionCursor}),ARCHIVE_MAINTENANCE));cursorPersisted=true;}catch{}}
    return publishArchiveDiagnostics(await archiveInventory(eligibleBaseline),{compressionAttemptedRecordsThisPass:attempted,compressedRecordsThisPass:compressed,reclaimedRecordsThisPass:reclaimed,savedBytesThisPass:savedBytes,compressionQuotaFailures,cursorPersisted});
  }
  async function compactRecoveryStorage(options={}){await archiveReady();return archiveLock(()=>compactArchivesLocked(options));}
  async function getRecoveryStorageDiagnostics({eligibleBaseline=root.LeadIntelWorkspacePersistence?.isAcknowledgedBaseline}={}){await archiveReady();return archiveLock(async()=>publishArchiveDiagnostics(await archiveInventory(eligibleBaseline)));}
  async function readRecoveryPointer(pointerKey,{workspaceId}={}){
    return archiveLock(async()=>{let raw=get(storage,pointerKey),pointer=parse(raw),record=null;
      if(!POINTER_FORMATS.has(pointer?.format)){assertCurrent();return {pointer,raw,record};}
      await archiveReady();const started=ticket;assertCurrent(started);raw=get(storage,pointerKey);pointer=parse(raw);
      if(POINTER_FORMATS.has(pointer?.format)){if(workspaceId&&pointer.workspace_id!==workspaceId)throw archiveError(null,'archive_read');record=await storedArchive(pointer.key);if(!record)throw archiveError(null,'archive_read');if(workspaceId&&record.workspace_id!==workspaceId)throw archiveError(null,'archive_read');}
      assertCurrent(started);if(get(storage,pointerKey)!==raw)throw archivePointerChanged();return {pointer,raw,record};});
  }
  async function publishRecoverySnapshot(record,{pointerKey,encodePointer,expectedPointer,eligibleBaseline}={}){
    await archiveReady();if(typeof pointerKey!=='string'||typeof encodePointer!=='function')throw archiveError(null,'archive_write');
    return archiveLock(async()=>{
      const started=ticket;assertCurrent(started);const previous=get(storage,pointerKey);if(expectedPointer!==undefined&&previous!==expectedPointer)throw archivePointerChanged();
      const pointer=parse(previous);if(POINTER_FORMATS.has(pointer?.format)){const current=await storedArchive(pointer.key);if(current?.server_synced===true&&record.server_synced===true&&current.workspace_id===record.workspace_id&&Number(current.server_version)>Number(record.server_version))throw archivePointerChanged();}
      await compactArchivesLocked({eligibleBaseline});assertCurrent(started);if(get(storage,pointerKey)!==previous)throw archivePointerChanged();
      const key=await saveRecoverySnapshotLocked(record,eligibleBaseline),encoded=encodePointer(key);if(typeof encoded!=='string')throw archiveError(null,'archive_write');const next=parse(encoded);
      if(!POINTER_FORMATS.has(next?.format)||next.key!==key||next.workspace_id!==record.workspace_id)throw archiveError(null,'archive_write');
      assertCurrent(started);if(get(storage,pointerKey)!==previous)throw archivePointerChanged();set(storage,pointerKey,encoded);if(get(storage,pointerKey)!==encoded)throw archivePointerChanged();
      await archiveTransaction('readwrite',store=>store.delete(SNAPSHOT_PIN_PREFIX+key));assertCurrent(started);return key;
    });
  }
  function hasLegacyArchives(){for(let index=0;index<storage.length;index++)if(String(storage.key(index)).startsWith(ARCHIVE_PREFIX))return true;return false;}
  function clearActive(){for(const store of [storage,session])for(const key of Object.keys(entries(store)))remove(store,key);}
  const LOCAL_CODEC_EPOCH='li2:';
  function updateContext(workspaceId='',userId='',codec=/^li[12]:/.test(String(context.epoch||''))){
    const random=root.crypto?.randomUUID?.()||Date.now().toString(36)+Math.random().toString(36).slice(2);
    const epoch=codec?LOCAL_CODEC_EPOCH+random.replace(/-/g,'').padEnd(32,'0').slice(0,32):random;
    const next={workspaceId,userId,epoch},nextTicket=JSON.stringify(next);
    // Persist first: a quota failure must not invalidate this tab's own ticket.
    set(storage,CONTEXT_KEY,nextTicket);context=next;ticket=nextTicket;
  }
  function prepareLocalStorageCodec(){
    assertAccessible();
    if(!String(context.epoch||'').startsWith(LOCAL_CODEC_EPOCH))updateContext(context.workspaceId||'',context.userId||'',true);
  }
  function detach(){return transition(()=>after(checkpoint(),()=>{assertCurrent();clearActive();updateContext();verified=false;return true;}));}
  function activate({workspaceId,userId}){
    if(root.indexedDB&&!archiveInitialized&&!archiveInitializationError)return archiveReady().catch(cause=>{archiveInitializationError=cause;}).then(()=>activate({workspaceId,userId}));
    assertAccessible();if(!workspaceId||!userId)throw new Error('Verified account and workspace are required.');
    if(context.workspaceId===workspaceId&&(!context.userId||context.userId===userId)){
      const finish=()=>{assertCurrent();if(!context.userId||!String(context.epoch||'').startsWith(LOCAL_CODEC_EPOCH))updateContext(workspaceId,userId,true);set(storage,WORKSPACE_KEY,workspaceId);verified=true;return {changed:false};};
      return root.indexedDB&&hasLegacyArchives()?transition(()=>after(checkpoint(),()=>({...finish(),changed:true}))):finish();
    }
    return transition(()=>after(checkpoint(),()=>after(storedArchive(ARCHIVE_PREFIX+encodeURIComponent(workspaceId)),archived=>{
      assertCurrent();clearActive();updateContext(workspaceId,userId,true);
      if(archived?.schemaVersion===1&&archived.workspaceId===workspaceId){
        for(const [key,value] of Object.entries(archived.data||{}))if(scopedKey(key)&&typeof value==='string')set(storage,key,value);
        for(const [key,value] of Object.entries(archived.sessionData||{}))if(scopedKey(key)&&key!=='leadintel_customer_v2_server_hydration'&&typeof value==='string')set(session,key,value);
      }
      set(storage,WORKSPACE_KEY,workspaceId);verified=true;return {changed:true};
    })));
  }
  function afterVerification(operation){
    let started=false;
    const run=()=>{
      if(started||!current()||transitioning||root.LeadIntelServerBridge?.ready!==true)return;
      started=true;root.removeEventListener?.('leadintel:server-ready',run);operation();
    };
    root.addEventListener?.('leadintel:server-ready',run);run();
  }
  function complete(){root.document?.documentElement?.removeAttribute('data-account-check');}
  function failed(cause){verified=false;root.document?.documentElement?.setAttribute('data-account-check','error');const message=root.document?.getElementById?.('account-recovery-message');if(!message)return;if(cause?.code==='browser_archive_unavailable'||cause?.name==='QuotaExceededError'){const name=ARCHIVE_ERROR_NAMES.has(cause?.name)?cause.name:'Error',phase=ARCHIVE_PHASES.has(cause?.phase)?cause.phase:'archive',category=ARCHIVE_CATEGORIES.has(cause?.category)?cause.category:'unknown';message.textContent='Your browser could not safely preserve the workspace ('+name+' / '+phase+' / '+category+'). Your local data is preserved. Keep your browser data and retry without clearing storage.';return;}const failure=root.LeadIntelServerBridge?.startupFailure;const code=String(failure?.code||cause?.code||'startup_failed').slice(0,80);const phase=String(failure?.phase||cause?.phase||'verification').slice(0,80);const path=String(failure?.requestPath||cause?.requestPath||'').slice(0,120);message.textContent='Startup check failed ('+code+' / '+phase+(path?' / '+path:'')+'). Your local data is preserved. Retry without clearing browser storage.';}
  const api={localCodecVersion:2,afterVerification,prepareLocalStorageCodec,saveRecoverySnapshot,readRecoverySnapshot,publishRecoverySnapshot,readRecoveryPointer,compactRecoveryStorage,getRecoveryStorageDiagnostics,checkpoint,detach,activate,current,complete,failed,hasWorkspace:()=>Boolean(context.workspaceId),CONTEXT_KEY,ARCHIVE_PREFIX};
  root.LeadIntelAccountCache=api;
  // Protect delayed work in old tabs, even before a storage event is delivered.
  if(proto){
    // Reads may initialize modules behind the hidden verification gate. Writes
    // stay locked until preservation finishes, and workspace requests stay denied.
    proto.getItem=function(key){if((this===storage||this===session)&&scopedKey(key))assertCurrent();return rawGet.call(this,key);};
    proto.setItem=function(key,value){if((this===storage||this===session)&&scopedKey(key))assertAccessible();return rawSet.call(this,key,value);};
    proto.removeItem=function(key){if((this===storage||this===session)&&scopedKey(key))assertAccessible();return rawRemove.call(this,key);};
    const clear=proto.clear;proto.clear=function(){if(this===storage||this===session)assertAccessible();return clear.call(this);};
  }
  if(typeof root.fetch==='function'){
    const fetch=root.fetch.bind(root);
    root.fetch=async function(input,options){
      const raw=typeof input==='string'?input:input?.url;let guarded=false,requestedWorkspace='',pathname='';
      try{const url=new URL(raw,root.location.href);guarded=[root.location.origin,'https://leadintel-api.edgars-7e7.workers.dev'].includes(url.origin)&&url.pathname.startsWith('/api/');requestedWorkspace=url.searchParams.get('workspace_id')||'';pathname=url.pathname;}catch{}
      const started=ticket;if(guarded){assertCurrent(started);if(requestedWorkspace&&context.workspaceId&&requestedWorkspace!==context.workspaceId)throw new Error('Workspace is not verified for this tab.');if(!verified&&!['/api/session','/api/workspaces','/api/logout','/api/health'].includes(pathname)&&!pathname.startsWith('/api/auth/'))throw new Error('Verify the signed-in account before starting workspace requests.');}
      const response=await fetch(input,options);if(guarded)assertCurrent(started);return response;
    };
  }
  root.addEventListener?.('storage',event=>{if(event.key===CONTEXT_KEY||event.key===null){if(!current())invalidate();}});
  if(root.indexedDB&&context.workspaceId){api.pending=archiveReady().catch(cause=>{
    // An inline-only workspace does not require IndexedDB. Preserve the native
    // diagnostic, but require successful storage before any actual archive I/O.
    archiveInitializationError=cause;
    const detail={schemaVersion:2,storageAvailable:false,name:ARCHIVE_ERROR_NAMES.has(cause?.name)?cause.name:'Error',phase:ARCHIVE_PHASES.has(cause?.phase)?cause.phase:'archive',category:ARCHIVE_CATEGORIES.has(cause?.category)?cause.category:'unknown'};
    root.document?.documentElement?.setAttribute('data-archive-storage-diagnostics',JSON.stringify(detail));
    if(root.CustomEvent)root.dispatchEvent?.(new root.CustomEvent('leadintel:archive-storage-diagnostics',{detail}));
  });}
  // The callback only detaches data; URL parameters never grant cache access.
  try{
    const url=new URL(root.location.href);
    if(context.workspaceId||url.searchParams.get('auth')==='success')root.document?.documentElement?.setAttribute('data-account-check','pending');
    if(url.searchParams.get('auth')==='success'&&url.searchParams.get('workspace_id')&&url.searchParams.get('workspace_id')!==context.workspaceId){const pending=api.pending?api.pending.then(()=>detach()):detach();if(pending&&typeof pending.then==='function'){api.pending=pending;pending.catch(failed);}}
  }catch(cause){failed(cause);}
})(typeof globalThis!=='undefined'?globalThis:this);
