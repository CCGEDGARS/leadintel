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
  let invalidated=false,verified=false,transitioning=false,databasePromise=null;
  function current(){return !invalidated&&get(storage,CONTEXT_KEY)===ticket;}
  function invalidate(){if(invalidated)return;invalidated=true;root.document?.documentElement?.setAttribute('data-account-check','pending');root.location?.reload?.();}
  function assertCurrent(expected=ticket){if(!current()||expected!==ticket){invalidate();throw new Error('LeadIntel account changed. Refresh to continue.');}}
  function assertAccessible(){assertCurrent();if(transitioning)throw new Error('LeadIntel is preserving the previous account.');}
  const after=(value,operation)=>value&&typeof value.then==='function'?value.then(operation):operation(value);
  function transition(operation){
    assertAccessible();transitioning=true;verified=false;root.document?.documentElement?.setAttribute('data-account-check','pending');
    try{const result=operation();if(result&&typeof result.then==='function')return result.finally(()=>{transitioning=false;});transitioning=false;return result;}
    catch(cause){transitioning=false;throw cause;}
  }
  function archiveError(){return Object.assign(new Error('Your browser could not safely preserve the workspace. Existing drafts were kept.'),{code:'browser_archive_unavailable'});}
  function archiveDatabase(){
    if(databasePromise)return databasePromise;
    databasePromise=new Promise((resolve,reject)=>{
      let finished=false,request;const timer=root.setTimeout?.(()=>finish(archiveError()),ARCHIVE_TIMEOUT_MS);
      function finish(cause,db){if(finished){db?.close();return;}finished=true;root.clearTimeout?.(timer);if(cause)reject(cause);else resolve(db);}
      try{request=root.indexedDB.open(ARCHIVE_DATABASE,1);}catch{finish(archiveError());return;}
      request.onupgradeneeded=()=>{if(!request.result.objectStoreNames.contains(ARCHIVE_STORE))request.result.createObjectStore(ARCHIVE_STORE);};
      request.onerror=request.onblocked=()=>finish(archiveError());
      request.onsuccess=()=>{const db=request.result;db.onversionchange=()=>{db.close();databasePromise=null;};finish(null,db);};
    });
    return databasePromise;
  }
  async function archiveTransaction(mode,operation){
    const db=await archiveDatabase();assertCurrent();
    return new Promise((resolve,reject)=>{
      let tx,result,finished=false;const timer=root.setTimeout?.(()=>{try{tx?.abort();}catch{}finish(archiveError());},ARCHIVE_TIMEOUT_MS);
      function finish(cause){if(finished)return;finished=true;root.clearTimeout?.(timer);if(cause)reject(cause);else resolve(result);}
      try{
        tx=db.transaction(ARCHIVE_STORE,mode);
        // A successful put request is not a committed backup. Wait for oncomplete.
        tx.oncomplete=()=>finish();tx.onabort=tx.onerror=()=>finish(archiveError());
        result=operation(tx.objectStore(ARCHIVE_STORE));
      }catch(cause){try{tx?.abort();}catch{}finish(cause);}
    });
  }
  function storedArchive(key){
    const local=parse(get(storage,key));if(local||!root.indexedDB)return local;
    let request;return archiveTransaction('readonly',store=>{request=store.get(key);}).then(()=>parse(request.result));
  }
  function entries(store){const data={};if(!store)return data;for(let i=0;i<store.length;i++){const key=store.key(i);if(scopedKey(key)){const value=get(store,key);if(value!==null)Object.defineProperty(data,key,{value,enumerable:true});}}return data;}
  function checkpoint(){
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
    return archiveTransaction('readwrite',store=>{assertCurrent(started);for(const [key,value] of legacy)store.put(value,key);store.put(encoded,archiveKey);}).then(()=>{
      assertCurrent(started);
      // Retire a local duplicate only after every archive was committed elsewhere.
      for(const [key,value] of legacy)if(get(storage,key)===value)remove(storage,key);
      return record;
    });
  }
  const SNAPSHOT_PREFIX='leadintel_workspace_snapshot_v1:';
  async function saveRecoverySnapshot(record){
    const started=ticket;assertCurrent(started);
    if(!root.indexedDB)throw archiveError();
    const key=SNAPSHOT_PREFIX+encodeURIComponent(record.workspace_id||'local')+':'+(record.server_version??'local')+':'+(root.crypto?.randomUUID?.()||Date.now().toString(36)+'-'+Math.random().toString(36).slice(2));
    await archiveTransaction('readwrite',store=>store.put(JSON.stringify(record),key));assertCurrent(started);return key;
  }
  async function readRecoverySnapshot(key){
    const started=ticket;assertCurrent(started);
    if(!String(key).startsWith(SNAPSHOT_PREFIX)||!root.indexedDB)throw archiveError();
    const record=await storedArchive(key);assertCurrent(started);if(!record)throw archiveError();return record;
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
  function failed(cause){verified=false;root.document?.documentElement?.setAttribute('data-account-check','error');const message=root.document?.getElementById?.('account-recovery-message');if(!message)return;if(cause?.code==='browser_archive_unavailable'||cause?.name==='QuotaExceededError'){message.textContent='Your browser could not safely preserve the workspace. Keep your browser data and try again.';return;}const failure=root.LeadIntelServerBridge?.startupFailure;const code=String(failure?.code||cause?.code||'startup_failed').slice(0,80);const phase=String(failure?.phase||cause?.phase||'verification').slice(0,80);const path=String(failure?.requestPath||cause?.requestPath||'').slice(0,120);message.textContent='Startup check failed ('+code+' / '+phase+(path?' / '+path:'')+'). Your local data is preserved. Retry without clearing browser storage.';}
  const api={localCodecVersion:2,afterVerification,prepareLocalStorageCodec,saveRecoverySnapshot,readRecoverySnapshot,checkpoint,detach,activate,current,complete,failed,hasWorkspace:()=>Boolean(context.workspaceId),CONTEXT_KEY,ARCHIVE_PREFIX};
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
  // The callback only detaches data; URL parameters never grant cache access.
  try{
    const url=new URL(root.location.href);
    if(context.workspaceId||url.searchParams.get('auth')==='success')root.document?.documentElement?.setAttribute('data-account-check','pending');
    if(url.searchParams.get('auth')==='success'&&url.searchParams.get('workspace_id')&&url.searchParams.get('workspace_id')!==context.workspaceId){const pending=detach();if(pending&&typeof pending.then==='function'){api.pending=pending;pending.catch(failed);}}
  }catch(cause){failed(cause);}
})(typeof globalThis!=='undefined'?globalThis:this);
