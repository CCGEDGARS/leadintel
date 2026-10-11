(function(root){
  'use strict';
  if(root.LeadIntelAccountCache||!root.localStorage)return;
  const CONTEXT_KEY='leadintel_account_context_v1';
  const ARCHIVE_PREFIX='leadintel_account_cache_v1:';
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
  const scopedKey=key=>String(key).startsWith('leadintel_')&&key!==CONTEXT_KEY&&!String(key).startsWith(ARCHIVE_PREFIX)&&key!==LEGACY_CLEANUP_KEY;
  let ticket=get(storage,CONTEXT_KEY);
  let context=parse(ticket)||{workspaceId:get(storage,WORKSPACE_KEY)||parse(get(storage,'leadintel_customer_v2_workspace_saved_snapshot_v1'))?.workspace_id||'',userId:''};
  let invalidated=false,verified=false;
  function current(){return !invalidated&&get(storage,CONTEXT_KEY)===ticket;}
  function invalidate(){if(invalidated)return;invalidated=true;root.document?.documentElement?.setAttribute('data-account-check','pending');root.location?.reload?.();}
  function assertCurrent(expected=ticket){if(!current()||expected!==ticket){invalidate();throw new Error('LeadIntel account changed. Refresh to continue.');}}
  function entries(store){const data={};if(!store)return data;for(let i=0;i<store.length;i++){const key=store.key(i);if(scopedKey(key)){const value=get(store,key);if(value!==null)Object.defineProperty(data,key,{value,enumerable:true});}}return data;}
  function checkpoint(){
    assertCurrent();const data=entries(storage),sessionData=entries(session);
    if(!Object.keys(data).length&&!Object.keys(sessionData).length)return null;
    const workspaceId=context.workspaceId||get(storage,WORKSPACE_KEY)||parse(get(storage,'leadintel_customer_v2_workspace_saved_snapshot_v1'))?.workspace_id||'';
    // Unattributed guest/legacy data is preserved, but never adopted by a login.
    const archiveKey=ARCHIVE_PREFIX+(workspaceId?encodeURIComponent(workspaceId):'unassigned:'+Date.now().toString(36)+'-'+Math.random().toString(36).slice(2));
    const record={schemaVersion:1,workspaceId,userId:context.userId||'',savedAt:new Date().toISOString(),data,sessionData};
    const encoded=JSON.stringify(record);set(storage,archiveKey,encoded);
    if(get(storage,archiveKey)!==encoded)throw new Error('Could not preserve the previous workspace.');
    return record;
  }
  function clearActive(){for(const store of [storage,session])for(const key of Object.keys(entries(store)))remove(store,key);}
  function updateContext(workspaceId='',userId=''){
    context={workspaceId,userId,epoch:root.crypto?.randomUUID?.()||Date.now().toString(36)+'-'+Math.random().toString(36).slice(2)};
    ticket=JSON.stringify(context);set(storage,CONTEXT_KEY,ticket);
  }
  function detach(){checkpoint();clearActive();updateContext();verified=false;return true;}
  function activate({workspaceId,userId}){
    assertCurrent();if(!workspaceId||!userId)throw new Error('Verified account and workspace are required.');
    if(context.workspaceId===workspaceId&&(!context.userId||context.userId===userId)){
      if(!context.userId)updateContext(workspaceId,userId);
      set(storage,WORKSPACE_KEY,workspaceId);verified=true;return {changed:false};
    }
    checkpoint();const archived=parse(get(storage,ARCHIVE_PREFIX+encodeURIComponent(workspaceId)));
    clearActive();updateContext(workspaceId,userId);
    if(archived?.schemaVersion===1&&archived.workspaceId===workspaceId){
      for(const [key,value] of Object.entries(archived.data||{}))if(scopedKey(key)&&typeof value==='string')set(storage,key,value);
      for(const [key,value] of Object.entries(archived.sessionData||{}))if(scopedKey(key)&&key!=='leadintel_customer_v2_server_hydration'&&typeof value==='string')set(session,key,value);
    }
    set(storage,WORKSPACE_KEY,workspaceId);verified=true;return {changed:true};
  }
  function complete(){root.document?.documentElement?.removeAttribute('data-account-check');}
  function failed(){verified=false;root.document?.documentElement?.setAttribute('data-account-check','error');}
  const api={checkpoint,detach,activate,current,complete,failed,hasWorkspace:()=>Boolean(context.workspaceId),CONTEXT_KEY,ARCHIVE_PREFIX};
  root.LeadIntelAccountCache=api;
  // Protect delayed work in old tabs, even before a storage event is delivered.
  if(proto){
    proto.getItem=function(key){if((this===storage||this===session)&&scopedKey(key))assertCurrent();return rawGet.call(this,key);};
    proto.setItem=function(key,value){if((this===storage||this===session)&&scopedKey(key))assertCurrent();return rawSet.call(this,key,value);};
    proto.removeItem=function(key){if((this===storage||this===session)&&scopedKey(key))assertCurrent();return rawRemove.call(this,key);};
    const clear=proto.clear;proto.clear=function(){if(this===storage||this===session)assertCurrent();return clear.call(this);};
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
    if(url.searchParams.get('auth')==='success'&&url.searchParams.get('workspace_id')&&url.searchParams.get('workspace_id')!==context.workspaceId)detach();
    if(context.workspaceId||url.searchParams.get('auth')==='success')root.document?.documentElement?.setAttribute('data-account-check','pending');
  }catch{failed();}
})(typeof globalThis!=='undefined'?globalThis:this);
