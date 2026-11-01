(function(root){
  "use strict";

  const EXPLICIT_SAVE_KEY="leadintel_customer_v2_workspace_explicit_save_v1";
  const SNAPSHOT_KEY="leadintel_customer_v2_workspace_saved_snapshot_v1";
  const FORCE_RESET_KEY="leadintel_customer_v2_force_reset_save_v1";
  const SERVER_RESET_PENDING_KEY="leadintel_customer_v2_reset_pending_v1";
  const RESET_PENDING_KEY=SERVER_RESET_PENDING_KEY;
  const WORKSPACE_KEY="leadintel_customer_v2_workspace";
  const HYDRATION_KEY="leadintel_customer_v2_server_hydration";
  const DIRTY_KEY="leadintel_customer_v2_server_dirty";
  const VERSION_KEY="leadintel_customer_v2_server_versions";
  const CONFLICT_KEY="leadintel_customer_v2_server_conflict";
  const API_BASE="https://leadintel-api.edgars-7e7.workers.dev";
  const SAVE_REQUEST_TIMEOUT_MS=45000;
  const AUTOSAVE_DEBOUNCE_MS=2200;

  const WORKSPACE_DATA_KEYS=Object.freeze([
    "leadintel_customer_v2_state",
    "leadintel_customer_v2_discovery",
    "leadintel_customer_v2_outreach",
    "leadintel_customer_v2_delivery",
    "leadintel_customer_v2_discovery_meta",
    "leadintel_customer_v2_website_activation_v1",
    "leadintel_customer_v2_research_meta_v1"
  ]);

  let snapshotEncoded=null,snapshotDecoded=null;
  let nativeFetch=null;
  let dirtySinceSave=false;
  let saveBusy=false;
  let autoSaveTimer=null;
  let saveError="";
  let lastSyncBudget=null;
  let codecWorker=null,codecJobId=0;
  const codecJobs=new Map();

  function runCodec(operation,value,options){
    if(typeof root.Worker!=='function')return root.LeadIntelStateBudget?.[operation]?.(value,options)||value;
    if(!codecWorker){
      codecWorker=new root.Worker(new URL('workspace-codec-worker.js?v=20261020-v1&research-storage=20261101-v1',root.location.href));
      codecWorker.onmessage=event=>{const job=codecJobs.get(event.data?.id);if(!job)return;codecJobs.delete(event.data.id);root.clearTimeout(job.timer);if(event.data.error)job.reject(new Error(event.data.error));else job.resolve(event.data.result);};
      codecWorker.onerror=()=>failCodec(new Error('Workspace encoding failed; your local data was preserved'));
      codecWorker.onmessageerror=()=>failCodec(new Error('Workspace encoding response could not be read'));
    }
    return new Promise((resolve,reject)=>{
      const id=++codecJobId,timer=root.setTimeout(()=>failCodec(new Error('Workspace encoding timed out')),30000);
      codecJobs.set(id,{resolve,reject,timer});
      try{codecWorker.postMessage({id,operation,value,options});}catch(cause){failCodec(cause);}
    });
  }
  function failCodec(cause){codecWorker?.terminate();codecWorker=null;for(const job of codecJobs.values()){root.clearTimeout(job.timer);job.reject(cause);}codecJobs.clear();}
  function encodeRecoveryRecord(record){return runCodec('packRecoveryRecord',record);}

  function safeJson(value,fallback=null){try{return JSON.parse(value);}catch{return fallback;}}
  function isObject(value){return Boolean(value&&typeof value==="object"&&!Array.isArray(value));}
  function readSnapshot(){const raw=root.localStorage?.getItem(SNAPSHOT_KEY)||"";if(raw===snapshotEncoded)return snapshotDecoded;const stored=safeJson(raw,null),parsed=root.LeadIntelStateBudget?.restoreWorkspaceSnapshot?.(stored)||stored;snapshotDecoded=isObject(parsed)&&isObject(parsed.data)?parsed:null;snapshotEncoded=raw;return snapshotDecoded;}
  const INDEXED_SNAPSHOT_FORMAT='leadintel-indexed-workspace-snapshot-v1';
  async function loadStoredSnapshot(){
    const raw=root.localStorage?.getItem(SNAPSHOT_KEY)||'',pointer=safeJson(raw,null);
    if(pointer?.format!==INDEXED_SNAPSHOT_FORMAT)return;
    const snapshot=await root.LeadIntelAccountCache?.readRecoverySnapshot(pointer.key);
    if(!snapshot?.data||(snapshot.workspace_id||'')!==pointer.workspace_id)throw new Error('Recovery snapshot is unavailable for this workspace.');
    if(root.localStorage?.getItem(SNAPSHOT_KEY)===raw){snapshotEncoded=raw;snapshotDecoded=snapshot;}
  }
  function persistSnapshot(snapshot){
    // Large snapshots contain both the local draft and the acknowledged cloud
    // baseline. Encoding them synchronously freezes the page during autosave.
    const large=Object.values(snapshot.data||{}).some(value=>typeof value==='string'&&value.length>=65536);
    const packed=large?runCodec('packWorkspaceSnapshot',snapshot):root.LeadIntelStateBudget?.packWorkspaceSnapshot?.(snapshot)||snapshot;
    return packed&&typeof packed.then==='function'?packed.then(value=>storeSnapshot(snapshot,value)):storeSnapshot(snapshot,packed);
  }
  function storeSnapshot(snapshot,packed){
    const activeWorkspace=root.LeadIntelServerBridge?.workspace?.id||root.localStorage?.getItem(WORKSPACE_KEY);
    if(activeWorkspace&&snapshot.workspace_id!==activeWorkspace)throw new Error('Workspace changed during snapshot encoding; local data was preserved');
    const previous=readSnapshot();if(previous?.server_synced&&previous.workspace_id===snapshot.workspace_id&&previous.server_version>snapshot.server_version)return previous;
    try{const encoded=JSON.stringify(packed);root.localStorage?.setItem(SNAPSHOT_KEY,encoded);snapshotEncoded=encoded;snapshotDecoded=snapshot;return snapshot;}
    catch(cause){
      if(cause?.name!=='QuotaExceededError'||!root.LeadIntelAccountCache?.saveRecoverySnapshot)throw cause;
      return root.LeadIntelAccountCache.saveRecoverySnapshot(snapshot).then(key=>{
        const current=readSnapshot();if(current?.server_synced&&current.workspace_id===snapshot.workspace_id&&current.server_version>snapshot.server_version)return current;
        const pointer=JSON.stringify({format:INDEXED_SNAPSHOT_FORMAT,workspace_id:snapshot.workspace_id||'',key});
        root.localStorage.setItem(SNAPSHOT_KEY,pointer);snapshotEncoded=pointer;snapshotDecoded=snapshot;return snapshot;
      });
    }
  }
  function isBrowserOnlySnapshot(){return readSnapshot()?.server_synced===false;}
  function isExplicitlySaved(){return root.localStorage?.getItem(EXPLICIT_SAVE_KEY)==="1"&&Boolean(readSnapshot());}
  function markExplicitlySaved(){root.localStorage?.setItem(EXPLICIT_SAVE_KEY,"1");return true;}
  function clearExplicitSave(){root.localStorage?.removeItem(EXPLICIT_SAVE_KEY);root.localStorage?.removeItem(SNAPSHOT_KEY);dirtySinceSave=false;root.clearTimeout?.(autoSaveTimer);autoSaveTimer=null;return true;}

  function currentWorkspaceData(){
    const data={};
    for(const key of WORKSPACE_DATA_KEYS){const value=root.localStorage?.getItem(key);if(value!==null&&value!==undefined)data[key]=value;}
    return data;
  }
  function hasText(value){return Boolean(String(value??"").trim());}
  function hasItems(value){return Array.isArray(value)&&value.length>0;}
  function hasAnswers(value){return isObject(value)&&Object.values(value).some(hasText);}
  function hasMarketData(value){
    if(!isObject(value))return false;
    return hasItems(value.icps)||hasItems(value.signals)||hasItems(value.researchQueries)||hasItems(value.researchResults)||hasItems(value.opportunities)||hasText(value.lastResearchAt)||value.strategyApproved===true||hasText(value.strategyApprovedAt);
  }
  function hasMainData(main){
    if(!isObject(main))return false;
    return hasText(main.website)||hasItems(main.targetMarkets)||hasItems(main.additionalLinks)||hasItems(main.documents)||hasItems(main.scrapedSources)||hasAnswers(main.answers)||Boolean(main.profile)||main.approved===true||Number(main.step)>1||hasMarketData(main.market);
  }
  function hasMeaningfulWorkspaceData(){
    const data=currentWorkspaceData();
    const main=safeJson(data["leadintel_customer_v2_state"]||"{}",{});
    if(hasMainData(main))return true;
    for(const key of ["leadintel_customer_v2_discovery","leadintel_customer_v2_outreach","leadintel_customer_v2_delivery"]){
      const value=safeJson(data[key]||"{}",{});if(isObject(value)&&Object.keys(value).length)return true;
    }
    return ["leadintel_customer_v2_discovery_meta","leadintel_customer_v2_website_activation_v1","leadintel_customer_v2_research_meta_v1"].some(key=>hasText(data[key]));
  }
  function captureWorkspaceSnapshot(){const snapshot={schema_version:1,server_synced:false,workspace_id:root.LeadIntelServerBridge?.workspace?.id||root.localStorage?.getItem(WORKSPACE_KEY)||'',saved_at:new Date().toISOString(),data:currentWorkspaceData()};return persistSnapshot(snapshot);}
  function sameWorkspaceData(a,b){const left=isObject(a)?a:{};const right=isObject(b)?b:{};const keys=[...new Set([...Object.keys(left),...Object.keys(right)])].sort();return keys.every(key=>String(left[key]??"")===String(right[key]??""));}
  function hasLocalChangesSinceSnapshot(){const snapshot=readSnapshot();return Boolean(snapshot&&!sameWorkspaceData(currentWorkspaceData(),snapshot.data));}
  function protectLocalChanges(){
    const workspaceId=String(root.localStorage?.getItem(WORKSPACE_KEY)||"");
    if(!workspaceId||root.localStorage?.getItem(DIRTY_KEY))return;
    const versions=safeJson(root.localStorage?.getItem(VERSION_KEY)||"{}",{});
    const baseVersion=Math.max(0,Number(versions?.[workspaceId])||0);
    root.localStorage?.setItem(DIRTY_KEY,JSON.stringify({workspace_id:workspaceId,base_version:baseVersion,updated_at:Date.now()}));
  }
  function restoreSavedSnapshot(){
    const snapshot=readSnapshot();if(!snapshot)return false;const current=currentWorkspaceData();if(sameWorkspaceData(current,snapshot.data))return false;
    for(const key of WORKSPACE_DATA_KEYS)root.localStorage?.removeItem(key);
    for(const [key,value] of Object.entries(snapshot.data)){if(WORKSPACE_DATA_KEYS.includes(key)&&typeof value==="string")root.localStorage?.setItem(key,value);}
    root.localStorage?.removeItem(DIRTY_KEY);dirtySinceSave=false;return true;
  }
  function clearWorkspaceData(){
    let changed=false;
    for(const key of WORKSPACE_DATA_KEYS){if(root.localStorage?.getItem(key)!==null)changed=true;root.localStorage?.removeItem(key);}
    if(root.localStorage?.getItem(DIRTY_KEY)!==null)changed=true;
    root.localStorage?.removeItem(DIRTY_KEY);root.sessionStorage?.removeItem(HYDRATION_KEY);root.sessionStorage?.removeItem(CONFLICT_KEY);return changed;
  }
  function prepareForLoad(){
    if(!isExplicitlySaved())return false;
    if(hasMeaningfulWorkspaceData())return false;
    return restoreSavedSnapshot();
  }

  function payloadFromSnapshot(){
    const snapshot=readSnapshot();if(!snapshot)return {};
    const data=snapshot.data||{};const parseKey=key=>{const parsed=safeJson(data[key]||"{}",{});return isObject(parsed)?parsed:{}};
    return {
      main:parseKey("leadintel_customer_v2_state"),
      discovery:parseKey("leadintel_customer_v2_discovery"),
      outreach:parseKey("leadintel_customer_v2_outreach"),
      delivery:parseKey("leadintel_customer_v2_delivery"),
      meta:{discovery:parseKey("leadintel_customer_v2_discovery_meta"),persistence:{explicit_saved:true}}
    };
  }
  function syncedBase(workspaceId){
    const snapshot=readSnapshot();
    if(!snapshot?.server_synced||snapshot.workspace_id!==workspaceId||!Number.isSafeInteger(snapshot.server_version))return null;
    const localPayload=payloadFromSnapshot();
    // Older snapshots kept only the browser representation. Reconstruct the
    // same deterministic cloud encoding once, then keep exact acknowledgements.
    try{const cloud=snapshot.server_payload||root.LeadIntelStateBudget?.prepareForSync?.(localPayload)?.payload||localPayload;
      return {workspaceId,version:snapshot.server_version,payload:root.LeadIntelStateBudget?.restoreFromSync?.(cloud)||cloud,localPayload};
    }catch{return null;}
  }
  function buildActivationRecord(main={}){
    const activation=isObject(main.websiteActivation)?main.websiteActivation:{};const sources=Array.isArray(main.scrapedSources)?main.scrapedSources:[];const source=sources.find(item=>item?.type==="website"&&String(item?.text||"").trim());
    if(activation.status!=="active"||!activation.url||!source)return null;
    return {status:"active",url:activation.url,title:activation.title||source.title||"",description:activation.description||"",activatedAt:activation.activatedAt||"",contentChars:Number(activation.contentChars)||String(source.text||"").length,source:{type:"website",url:activation.url,title:activation.title||source.title||"",text:String(source.text||""),status:"ready"}};
  }
  function snapshotFromServerPayload(payload={},options={}){
    if(!isObject(payload))return null;
    const previous=readSnapshot(),workspaceId=options.workspaceId||root.LeadIntelServerBridge?.workspace?.id||'';
    if(previous?.server_synced&&previous.workspace_id===workspaceId&&Number.isSafeInteger(options.version)&&previous.server_version>options.version)return previous;
    const serverPayload=payload;payload=root.LeadIntelStateBudget?.restoreFromSync?.(payload)||payload;const data={};
    if(isObject(payload.main))data["leadintel_customer_v2_state"]=JSON.stringify(payload.main);
    if(isObject(payload.discovery))data["leadintel_customer_v2_discovery"]=JSON.stringify(payload.discovery);
    if(isObject(payload.outreach))data["leadintel_customer_v2_outreach"]=JSON.stringify(payload.outreach);
    if(isObject(payload.delivery))data["leadintel_customer_v2_delivery"]=JSON.stringify(payload.delivery);
    if(isObject(payload.meta?.discovery))data["leadintel_customer_v2_discovery_meta"]=JSON.stringify(payload.meta.discovery);
    const activation=buildActivationRecord(payload.main||{});if(activation)data["leadintel_customer_v2_website_activation_v1"]=JSON.stringify(activation);
    const snapshot={schema_version:1,server_synced:true,workspace_id:options.workspaceId||root.LeadIntelServerBridge?.workspace?.id||"",server_version:Number.isSafeInteger(options.version)?options.version:null,saved_at:new Date().toISOString(),server_payload:serverPayload,data:options.localData||data};const finish=()=>{markExplicitlySaved();dirtySinceSave=typeof options.dirty==='boolean'?options.dirty||!sameWorkspaceData(currentWorkspaceData(),snapshot.data):!sameWorkspaceData(currentWorkspaceData(),data);return snapshot;};const saved=persistSnapshot(snapshot);return saved&&typeof saved.then==='function'?saved.then(value=>value===snapshot?finish():value):finish();
  }

  function jsonResponse(payload,status=200){return new Response(JSON.stringify(payload),{status,headers:{"Content-Type":"application/json"}});}
  function customerStateUrl(input){try{const raw=typeof input==="string"?input:input?.url;const url=new URL(raw,root.location?.href||API_BASE);const siteOrigin=new URL(root.location?.href||API_BASE).origin;return (url.origin===API_BASE||url.origin===siteOrigin)&&url.pathname==="/api/customer/state"?url:null;}catch{return null;}}
  function requestMethod(input,init={}){return String(init?.method||(typeof Request!=="undefined"&&input instanceof Request?input.method:"GET")||"GET").toUpperCase();}
  function withPersistenceMetadata(body,explicitSaved){const next=isObject(body)?{...body}:{};const payload=isObject(next.payload)?{...next.payload}:{};const meta=isObject(payload.meta)?{...payload.meta}:{};meta.persistence={explicit_saved:Boolean(explicitSaved)};payload.meta=meta;next.payload=payload;return next;}
  function prepareSyncPayload(payload,{explicitSaved=isExplicitlySaved()}={}){
    const next=withPersistenceMetadata({payload},explicitSaved).payload;
    if(!root.LeadIntelStateBudget?.prepareForSync)return next;
    const bridge=root.LeadIntelServerBridge,limit=bridge?.workspaceRecordCodec==='workspace-records-v1'?Number(bridge.workspaceMaxSyncBytes)||8*1024*1024:Number(root.LeadIntelStateBudget.MAX_SYNC_BYTES)||500*1024;
    const options={maxSyncBytes:limit,allowSectionPacking:bridge?.workspaceStateCodec==='workspace-sections-v1',allowBundlePacking:bridge?.workspaceBundleCodec==='workspace-bundle-v1',allowCompressionPacking:bridge?.workspaceCompressionCodec==='workspace-lzw-v2'};
    const finish=prepared=>{lastSyncBudget={bytes:Number(prepared.bytes)||0,limit,exceeded:false,checkedAt:Date.now()};return prepared.payload;};
    const failed=error=>{lastSyncBudget={bytes:null,limit,exceeded:/500 KB|sync limit|transfer limit/i.test(String(error?.message||'')),checkedAt:Date.now()};throw error;};
    try{const prepared=runCodec('prepareForSync',next,options);return prepared&&typeof prepared.then==='function'?prepared.then(finish,failed):finish(prepared);}catch(error){return failed(error);}
  }
  function blankServerPayload(originalScripts={}){return {main:{},discovery:{},outreach:Object.keys(originalScripts).length?{messageStudio:{originalScripts}}:{},delivery:{},meta:{discovery:{},persistence:{explicit_saved:false}}};}
  function readResetIntent(){const raw=root.localStorage?.getItem(RESET_PENDING_KEY);if(!raw)return null;if(raw==="1")return {workspace_id:""};const parsed=safeJson(raw,null);return isObject(parsed)?parsed:null;}
  function resetIntentMatchesUrl(url){const intent=readResetIntent();if(!intent)return false;const intended=String(intent.workspace_id||"");const actual=String(url?.searchParams?.get?.("workspace_id")||"");return !intended||!actual||intended===actual;}
  function recordResetIntent(){
    if(root.localStorage?.getItem(RESET_PENDING_KEY))return true;
    const workspaceId=String(root.LeadIntelServerBridge?.workspace?.id||root.localStorage?.getItem(WORKSPACE_KEY)||"");
    root.localStorage?.setItem(RESET_PENDING_KEY,JSON.stringify({workspace_id:workspaceId,requested_at:Date.now()}));return true;
  }

  async function clearPendingServerReset(url,stateResponse){
    const workspaceId=url.searchParams.get("workspace_id")||"";const currentVersion=Math.max(0,Number(stateResponse?.version)||0);
    const response=await nativeFetch(url.toString(),{method:"PUT",credentials:"include",headers:{"Accept":"application/json","Content-Type":"application/json"},body:JSON.stringify({schema_version:1,version:currentVersion,payload:blankServerPayload(stateResponse?.payload?.outreach?.messageStudio?.originalScripts||{})})});
    const result=await response.clone().json().catch(()=>({}));
    if(response.ok){root.localStorage?.removeItem(RESET_PENDING_KEY);root.sessionStorage?.removeItem(FORCE_RESET_KEY);const version=Math.max(0,Number(result.version)||currentVersion);if(workspaceId)root.sessionStorage?.setItem(HYDRATION_KEY,`${workspaceId}:${version}`);return {version,payload:blankServerPayload(stateResponse?.payload?.outreach?.messageStudio?.originalScripts||{})};}
    return {version:currentVersion,payload:stateResponse?.payload||{}};
  }

  function installFetchBoundary(){
    if(!root.fetch||root.__leadintelPersistenceFetchInstalled)return;root.__leadintelPersistenceFetchInstalled=true;nativeFetch=root.fetch.bind(root);
    root.fetch=async function(input,init={}){
      const {leadintelSaveIntent=false,leadintelExplicitSave=false,leadintelPreparedSync=false,leadintelLocalDataAtSaveStart,leadintelNetworkReadComplete,...requestInit}=init||{};const url=customerStateUrl(input);if(!url)return nativeFetch(input,requestInit);const method=requestMethod(input,requestInit);
      if(method==="GET"){
        // Reuse the parsed body after snapshot work: its original network stream
        // may expire while a large recovery baseline is being prepared.
        const response=await nativeFetch(input,requestInit);if(!response.ok)return response;const body=await response.clone().json();if(requestInit.signal?.aborted)throw requestInit.signal.reason||new DOMException('Workspace read canceled','AbortError');const workspaceId=url.searchParams.get("workspace_id")||"";
        if(resetIntentMatchesUrl(url)){const cleared=await clearPendingServerReset(url,body);leadintelNetworkReadComplete?.();return jsonResponse(cleared,200);}
        leadintelNetworkReadComplete?.();
        if(isExplicitlySaved()&&hasLocalChangesSinceSnapshot()){
          dirtySinceSave=true;protectLocalChanges();root.setTimeout?.(renderPersistenceStatus,0);
          return jsonResponse(body,response.status);
        }
        if(body?.payload?.meta?.persistence?.explicit_saved===true||(Number(body.version)>0&&["main","discovery","outreach","delivery"].some(key=>isObject(body.payload?.[key])&&Object.keys(body.payload[key]).length))){
          const versions=safeJson(root.localStorage?.getItem(VERSION_KEY)||'{}',{});
          const sameRevision=isExplicitlySaved()&&readSnapshot()?.server_synced===true&&Number(versions[workspaceId])===Number(body.version);
          await snapshotFromServerPayload(body.payload,{workspaceId,version:Number(body.version),...(sameRevision?{localData:currentWorkspaceData(),dirty:false}:{})});return jsonResponse(body,response.status);
        }
        const version=Math.max(0,Number(body?.version)||0);if(workspaceId)root.sessionStorage?.setItem(HYDRATION_KEY,`${workspaceId}:${version}`);
        if(isExplicitlySaved())return jsonResponse({...body,payload:payloadFromSnapshot()},response.status);
        return jsonResponse({...body,payload:{}},response.status);
      }
      if(method==="PUT"){
        const forceReset=root.sessionStorage?.getItem(FORCE_RESET_KEY)==="1"||resetIntentMatchesUrl(url);const saveIntent=leadintelSaveIntent===true;const explicitSave=leadintelExplicitSave===true;const parsed=safeJson(typeof requestInit?.body==="string"?requestInit.body:"{}",{});const localDataAtPutStart=leadintelLocalDataAtSaveStart||currentWorkspaceData();
        if(!saveIntent&&!forceReset){root.setTimeout?.(renderPersistenceStatus,0);return jsonResponse({version:Math.max(0,Number(parsed?.version)||0),saved:false},200);}
        const next=withPersistenceMetadata(parsed,!forceReset&&(explicitSave||isExplicitlySaved()));if(forceReset)next.payload.meta.persistence={explicit_saved:false};
        if(!leadintelPreparedSync)next.payload=await prepareSyncPayload(next.payload,{explicitSaved:!forceReset&&(explicitSave||isExplicitlySaved())});
        const response=await nativeFetch(input,{...requestInit,body:JSON.stringify(next)});const result=await response.clone().json().catch(error=>{if(response.ok)throw error;return {};});if(requestInit.signal?.aborted)throw requestInit.signal.reason||new DOMException('Workspace save canceled','AbortError');
        // The network response and body are complete. Durable browser storage
        // remains awaited, but must not be rejected by the network deadline.
        leadintelNetworkReadComplete?.();const persisted=response.ok&&result?.saved!==false;
        if(persisted){if(forceReset){root.sessionStorage?.removeItem(FORCE_RESET_KEY);root.localStorage?.removeItem(RESET_PENDING_KEY);root.setTimeout?.(renderPersistenceStatus,0);}else if(explicitSave||(saveIntent&&isExplicitlySaved()))await snapshotFromServerPayload(next.payload,{workspaceId:url.searchParams.get("workspace_id"),version:Number(result.version),localData:localDataAtPutStart,dirty:!sameWorkspaceData(currentWorkspaceData(),localDataAtPutStart)});}
        // The server acknowledgement is already parsed. Snapshot work can
        // outlast the request deadline and invalidate the original stream.
        return jsonResponse(result,response.status);
      }
      return nativeFetch(input,requestInit);
    };
  }

  function disableServerAutosave(){if(typeof Storage!=="undefined"&&Storage.prototype)Storage.prototype.__leadintelServerPatched=true;}
  function hasUnsavedChanges(){return dirtySinceSave||hasLocalChangesSinceSnapshot()||(!isExplicitlySaved()&&hasMeaningfulWorkspaceData());}
  function persistenceLabel(){if(root.LeadIntelServerBridge?.conflict)return "Sync conflict · local and server versions preserved";if(saveBusy)return "Saving workspace…";if(saveError)return `${saveError} · changes kept in this browser`;if(!hasMeaningfulWorkspaceData()&&!hasUnsavedChanges())return "New workspace · ready";if(!isExplicitlySaved())return "Unsaved draft · saving shortly";if(hasUnsavedChanges())return "Unsaved changes · saving shortly";return isBrowserOnlySnapshot()?"Saved in this browser · cloud sync pending":"Saved automatically to LeadIntel";}
  function renderPersistenceStatus(){const label=persistenceLabel();const status=root.document?.querySelector?.(".autosave");if(status)status.innerHTML=`<i></i>${label}`;const visibleStatus=root.document?.getElementById?.("workspace-save-state");if(visibleStatus){visibleStatus.textContent=label;if(!saveError)visibleStatus.title="";}const bar=root.document?.querySelector?.(".workspace-save-bar");if(bar)bar.dataset.state=saveError?"error":saveBusy?"saving":hasUnsavedChanges()?"unsaved":isExplicitlySaved()?"saved":"new";const button=root.document?.getElementById?.("save-workspace");if(button){button.textContent=saveBusy?"Saving…":root.LeadIntelServerBridge?.conflict?"Keep my local changes":saveError?"Retry save":"Save now";button.disabled=saveBusy;}}
  function toast(message){const el=root.document?.getElementById?.("toast");if(!el)return;el.textContent=message;el.classList.add("show");clearTimeout(toast.t);toast.t=setTimeout(()=>el.classList.remove("show"),2400);}
  function waitForBridge(timeout=1800){if(root.LeadIntelServerBridge?.ready===true||(root.LeadIntelServerBridge?.ready===undefined&&root.LeadIntelServerBridge?.session!=null))return Promise.resolve(root.LeadIntelServerBridge);return new Promise(resolve=>{let done=false;const finish=()=>{if(done)return;done=true;root.removeEventListener?.("leadintel:server-ready",finish);resolve(root.LeadIntelServerBridge||null);};root.addEventListener?.("leadintel:server-synced",()=>{saveError="";dirtySinceSave=hasLocalChangesSinceSnapshot();renderPersistenceStatus();});root.addEventListener?.("leadintel:server-conflict",()=>{root.clearTimeout?.(autoSaveTimer);autoSaveTimer=null;renderPersistenceStatus();});root.addEventListener?.("leadintel:server-ready",finish,{once:true});root.setTimeout?.(finish,timeout);});}

  function withTimeout(operation,timeoutMs=SAVE_REQUEST_TIMEOUT_MS,label="Workspace save"){
    const schedule=root.setTimeout||setTimeout;const cancel=root.clearTimeout||clearTimeout;
    return new Promise((resolve,reject)=>{
      let settled=false;
      const finish=(callback,value)=>{if(settled)return;settled=true;cancel(timer);callback(value);};
      const timer=schedule(()=>finish(reject,new Error(label+" timed out")),Math.max(1,Number(timeoutMs)||SAVE_REQUEST_TIMEOUT_MS));
      Promise.resolve().then(operation).then(value=>finish(resolve,value),error=>finish(reject,error));
    });
  }

  async function saveWorkspace({automatic=false}={}){
    if(saveBusy)return false;saveBusy=true;renderPersistenceStatus();
    try{const bridge=await waitForBridge();if(bridge?.ready===false)throw new Error("Workspace is still loading; retry save");if(automatic&&bridge?.conflict)throw new Error("conflict");if(bridge?.session?.authenticated&&bridge?.workspace){const result=await withTimeout(()=>bridge.conflict?bridge.resolveConflictKeepLocal?.():bridge.saveNow?.({saveIntent:true,explicitSave:true}),SAVE_REQUEST_TIMEOUT_MS);if(result?.retryable){dirtySinceSave=true;saveError="";if(!automatic)toast("Changes kept locally · sync is retrying");return false;}if(!result?.saved)throw new Error(result?.conflict?"conflict":"Workspace could not be saved to LeadIntel");if(!automatic)toast("Workspace saved");}else{await captureWorkspaceSnapshot();markExplicitlySaved();dirtySinceSave=false;if(!automatic)toast("Workspace saved in this browser");}saveError="";return true;}
    catch(error){dirtySinceSave=true;const detail=String(error?.message||"");saveError=root.LeadIntelServerBridge?.conflict||detail==="conflict"?"Sync conflict · keep your local changes":/timed out|timeout/i.test(detail)?"Sync timed out · retry save":/500 KB|sync limit|transfer limit/i.test(detail)?"Workspace exceeds sync limit · data preserved":/failed to fetch|network/i.test(detail)?"Could not reach LeadIntel · retry save":"Sync failed · retry save";const status=root.document?.getElementById?.("workspace-save-state");if(status)status.title=/Section sizes:/.test(detail)?`${detail} Active codec: ${root.LeadIntelStateBudget?.syncCodecVersion||'legacy'}; server compression: ${root.LeadIntelServerBridge?.workspaceCompressionCodec||'none'}.`:"";if(!automatic)toast(saveError);return false;}
    finally{saveBusy=false;renderPersistenceStatus();if(!saveError&&hasUnsavedChanges())scheduleAutoSave();}
  }
  function scheduleAutoSave(){if(root.LeadIntelServerBridge?.conflict){renderPersistenceStatus();return;}if(root.localStorage?.getItem(RESET_PENDING_KEY)||!hasMeaningfulWorkspaceData())return;root.clearTimeout?.(autoSaveTimer);autoSaveTimer=root.setTimeout?.(()=>{autoSaveTimer=null;if(saveBusy){scheduleAutoSave();return;}if(hasUnsavedChanges()||(isBrowserOnlySnapshot()&&root.LeadIntelServerBridge?.session?.authenticated&&root.LeadIntelServerBridge?.workspace))void saveWorkspace({automatic:true});},AUTOSAVE_DEBOUNCE_MS);renderPersistenceStatus();}
  function ensureSaveButton(){let button=root.document?.getElementById?.("save-workspace");if(!button){const actions=root.document?.querySelector?.(".top-actions");if(!actions)return false;button=root.document.createElement("button");button.className="ghost-btn";button.type="button";button.id="save-workspace";actions.insertBefore(button,root.document.getElementById("reset-workspace")||null);}if(button.dataset.workspaceSaveBound==="1")return false;button.dataset.workspaceSaveBound="1";button.addEventListener("click",()=>{root.clearTimeout?.(autoSaveTimer);autoSaveTimer=null;void saveWorkspace();});renderPersistenceStatus();return true;}
  function noteWorkspaceEdit(event){const target=event?.target;if(target?.closest&& !target.closest(".workspace"))return;if(target?.closest?.("#save-workspace,#reset-workspace,#ai-settings-drawer"))return;dirtySinceSave=true;saveError="";protectLocalChanges();scheduleAutoSave();}
  function handleResetClick(event){
    const button=event?.target?.closest?.("#reset-workspace");if(!button||button.dataset.resetArmed!=="true")return false;
    root.sessionStorage?.setItem(FORCE_RESET_KEY,"1");recordResetIntent();clearExplicitSave();root.setTimeout?.(()=>root.sessionStorage?.removeItem(FORCE_RESET_KEY),5000);root.setTimeout?.(renderPersistenceStatus,0);return true;
  }
  function installUi(){
    ensureSaveButton();root.document?.addEventListener?.("input",noteWorkspaceEdit,true);root.document?.addEventListener?.("change",noteWorkspaceEdit,true);
    root.document?.addEventListener?.("click",event=>{if(event.target?.closest?.("[data-target-market],[data-remove-target-market],[data-remove-doc],[data-remove-signal],[data-opportunity-active],#add-target-market,#clear-target-markets,#add-custom-signal"))noteWorkspaceEdit(event);},true);
    root.document?.addEventListener?.("click",handleResetClick,true);
    root.addEventListener?.("leadintel:website-activated",()=>{dirtySinceSave=true;saveError="";protectLocalChanges();scheduleAutoSave();});root.addEventListener?.("leadintel:workspace-dirty",()=>{dirtySinceSave=true;saveError="";protectLocalChanges();scheduleAutoSave();});root.addEventListener?.("leadintel:sender-identity-changed",()=>{dirtySinceSave=true;saveError="";protectLocalChanges();scheduleAutoSave();});root.addEventListener?.("leadintel:server-synced",()=>{saveError="";dirtySinceSave=hasLocalChangesSinceSnapshot();renderPersistenceStatus();});root.addEventListener?.("leadintel:server-conflict",()=>{root.clearTimeout?.(autoSaveTimer);autoSaveTimer=null;renderPersistenceStatus();});root.addEventListener?.("leadintel:server-ready",()=>{if(hasUnsavedChanges()||isBrowserOnlySnapshot())scheduleAutoSave();else renderPersistenceStatus();});renderPersistenceStatus();
  }

  disableServerAutosave();installFetchBoundary();
  const explicitlySaved=isExplicitlySaved();
  const hadMeaningfulUnsavedData=!explicitlySaved&&hasMeaningfulWorkspaceData();
  const changed=prepareForLoad();
  if(changed&&(explicitlySaved||hadMeaningfulUnsavedData)&&root.location?.reload){root.location.reload();return;}
  if(root.document?.readyState==="loading")root.document.addEventListener("DOMContentLoaded",installUi,{once:true});else installUi();

  const ready=loadStoredSnapshot().then(()=>{if(prepareForLoad())root.location?.reload?.();}).catch(cause=>{root.LeadIntelLocalRecoveryWarning={code:'snapshot_read_failed',message:String(cause?.message||cause)};root.console?.warn?.('LeadIntel recovery snapshot is unavailable; continuing authenticated server verification without modifying the stored recovery pointer.',cause);});
  function syncBudget(){return lastSyncBudget;}
  root.LeadIntelWorkspacePersistence={ready,EXPLICIT_SAVE_KEY,SNAPSHOT_KEY,FORCE_RESET_KEY,SERVER_RESET_PENDING_KEY,RESET_PENDING_KEY,WORKSPACE_DATA_KEYS,isExplicitlySaved,hasUnsavedChanges,markExplicitlySaved,clearExplicitSave,currentWorkspaceData,hasMeaningfulWorkspaceData,captureWorkspaceSnapshot,restoreSavedSnapshot,clearWorkspaceData,prepareForLoad,snapshotFromServerPayload,syncedBase,saveWorkspace,renderPersistenceStatus,handleResetClick,syncBudget,prepareSyncPayload,encodeRecoveryRecord};
})(typeof globalThis!=="undefined"?globalThis:this);
