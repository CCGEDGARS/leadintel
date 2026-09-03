(function(root){
  "use strict";

  const EXPLICIT_SAVE_KEY="leadintel_customer_v2_workspace_explicit_save_v1";
  const SNAPSHOT_KEY="leadintel_customer_v2_workspace_saved_snapshot_v1";
  const SAVE_INTENT_KEY="leadintel_customer_v2_explicit_save_intent_v1";
  const FORCE_RESET_KEY="leadintel_customer_v2_force_reset_save_v1";
  const RESET_PENDING_KEY="leadintel_customer_v2_reset_pending_v1";
  const WORKSPACE_KEY="leadintel_customer_v2_workspace";
  const HYDRATION_KEY="leadintel_customer_v2_server_hydration";
  const DIRTY_KEY="leadintel_customer_v2_server_dirty";
  const CONFLICT_KEY="leadintel_customer_v2_server_conflict";
  const API_BASE="https://leadintel-api.edgars-7e7.workers.dev";

  const WORKSPACE_DATA_KEYS=Object.freeze([
    "leadintel_customer_v2_state",
    "leadintel_customer_v2_discovery",
    "leadintel_customer_v2_outreach",
    "leadintel_customer_v2_delivery",
    "leadintel_customer_v2_discovery_meta",
    "leadintel_customer_v2_website_activation_v1",
    "leadintel_customer_v2_research_meta_v1"
  ]);

  let nativeFetch=null;
  let dirtySinceSave=false;
  let saveBusy=false;

  function safeJson(value,fallback=null){try{return JSON.parse(value);}catch{return fallback;}}
  function isObject(value){return Boolean(value&&typeof value==="object"&&!Array.isArray(value));}
  function readSnapshot(){const parsed=safeJson(root.localStorage?.getItem(SNAPSHOT_KEY)||"",null);return isObject(parsed)&&isObject(parsed.data)?parsed:null;}
  function isExplicitlySaved(){return root.localStorage?.getItem(EXPLICIT_SAVE_KEY)==="1"&&Boolean(readSnapshot());}
  function markExplicitlySaved(){root.localStorage?.setItem(EXPLICIT_SAVE_KEY,"1");return true;}
  function clearExplicitSave(){root.localStorage?.removeItem(EXPLICIT_SAVE_KEY);root.localStorage?.removeItem(SNAPSHOT_KEY);dirtySinceSave=false;return true;}

  function currentWorkspaceData(){
    const data={};
    for(const key of WORKSPACE_DATA_KEYS){const value=root.localStorage?.getItem(key);if(value!==null&&value!==undefined)data[key]=value;}
    return data;
  }
  function captureWorkspaceSnapshot(){const snapshot={schema_version:1,saved_at:new Date().toISOString(),data:currentWorkspaceData()};root.localStorage?.setItem(SNAPSHOT_KEY,JSON.stringify(snapshot));return snapshot;}
  function sameWorkspaceData(a,b){const left=isObject(a)?a:{};const right=isObject(b)?b:{};const keys=[...new Set([...Object.keys(left),...Object.keys(right)])].sort();return keys.every(key=>String(left[key]??"")===String(right[key]??""));}
  function restoreSavedSnapshot(){
    const snapshot=readSnapshot();if(!snapshot)return false;const current=currentWorkspaceData();if(sameWorkspaceData(current,snapshot.data))return false;
    for(const key of WORKSPACE_DATA_KEYS)root.localStorage?.removeItem(key);
    for(const [key,value] of Object.entries(snapshot.data)){if(WORKSPACE_DATA_KEYS.includes(key)&&typeof value==="string")root.localStorage?.setItem(key,value);}
    root.localStorage?.removeItem(DIRTY_KEY);return true;
  }
  function clearWorkspaceData(){
    let changed=false;
    for(const key of WORKSPACE_DATA_KEYS){if(root.localStorage?.getItem(key)!==null)changed=true;root.localStorage?.removeItem(key);}
    if(root.localStorage?.getItem(DIRTY_KEY)!==null)changed=true;
    root.localStorage?.removeItem(DIRTY_KEY);root.sessionStorage?.removeItem(HYDRATION_KEY);root.sessionStorage?.removeItem(CONFLICT_KEY);return changed;
  }
  function prepareForLoad(){
    if(!isExplicitlySaved()){const changed=clearWorkspaceData();root.localStorage?.removeItem(SNAPSHOT_KEY);return changed;}
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
  function buildActivationRecord(main={}){
    const activation=isObject(main.websiteActivation)?main.websiteActivation:{};const sources=Array.isArray(main.scrapedSources)?main.scrapedSources:[];const source=sources.find(item=>item?.type==="website"&&String(item?.text||"").trim());
    if(activation.status!=="active"||!activation.url||!source)return null;
    return {status:"active",url:activation.url,title:activation.title||source.title||"",description:activation.description||"",activatedAt:activation.activatedAt||"",contentChars:Number(activation.contentChars)||String(source.text||"").length,source:{type:"website",url:activation.url,title:activation.title||source.title||"",text:String(source.text||""),status:"ready"}};
  }
  function snapshotFromServerPayload(payload={}){
    if(!isObject(payload))return null;const data={};
    if(isObject(payload.main))data["leadintel_customer_v2_state"]=JSON.stringify(payload.main);
    if(isObject(payload.discovery))data["leadintel_customer_v2_discovery"]=JSON.stringify(payload.discovery);
    if(isObject(payload.outreach))data["leadintel_customer_v2_outreach"]=JSON.stringify(payload.outreach);
    if(isObject(payload.delivery))data["leadintel_customer_v2_delivery"]=JSON.stringify(payload.delivery);
    if(isObject(payload.meta?.discovery))data["leadintel_customer_v2_discovery_meta"]=JSON.stringify(payload.meta.discovery);
    const activation=buildActivationRecord(payload.main||{});if(activation)data["leadintel_customer_v2_website_activation_v1"]=JSON.stringify(activation);
    const snapshot={schema_version:1,saved_at:new Date().toISOString(),data};root.localStorage?.setItem(SNAPSHOT_KEY,JSON.stringify(snapshot));markExplicitlySaved();dirtySinceSave=false;return snapshot;
  }

  function jsonResponse(payload,status=200){return new Response(JSON.stringify(payload),{status,headers:{"Content-Type":"application/json"}});}
  function customerStateUrl(input){try{const raw=typeof input==="string"?input:input?.url;const url=new URL(raw,root.location?.href||API_BASE);return url.origin===API_BASE&&url.pathname==="/api/customer/state"?url:null;}catch{return null;}}
  function requestMethod(input,init={}){return String(init?.method||(typeof Request!=="undefined"&&input instanceof Request?input.method:"GET")||"GET").toUpperCase();}
  function withPersistenceMetadata(body,explicitSaved){const next=isObject(body)?{...body}:{};const payload=isObject(next.payload)?{...next.payload}:{};const meta=isObject(payload.meta)?{...payload.meta}:{};meta.persistence={explicit_saved:Boolean(explicitSaved)};payload.meta=meta;next.payload=payload;return next;}
  function blankServerPayload(){return {main:{},discovery:{},outreach:{},delivery:{},meta:{discovery:{},persistence:{explicit_saved:false}}};}
  function readResetIntent(){const raw=root.localStorage?.getItem(RESET_PENDING_KEY);if(!raw)return null;if(raw==="1")return {workspace_id:""};const parsed=safeJson(raw,null);return isObject(parsed)?parsed:null;}
  function resetIntentMatchesUrl(url){const intent=readResetIntent();if(!intent)return false;const intended=String(intent.workspace_id||"");const actual=String(url?.searchParams?.get?.("workspace_id")||"");return !intended||!actual||intended===actual;}
  function recordResetIntent(){
    if(root.localStorage?.getItem(RESET_PENDING_KEY))return true;
    const workspaceId=String(root.LeadIntelServerBridge?.workspace?.id||root.localStorage?.getItem(WORKSPACE_KEY)||"");
    root.localStorage?.setItem(RESET_PENDING_KEY,JSON.stringify({workspace_id:workspaceId,requested_at:Date.now()}));return true;
  }

  async function clearPendingServerReset(url,stateResponse){
    const workspaceId=url.searchParams.get("workspace_id")||"";const currentVersion=Math.max(0,Number(stateResponse?.version)||0);
    const response=await nativeFetch(url.toString(),{method:"PUT",credentials:"include",headers:{"Accept":"application/json","Content-Type":"application/json"},body:JSON.stringify({schema_version:1,version:currentVersion,payload:blankServerPayload()})});
    const result=await response.clone().json().catch(()=>({}));
    if(response.ok){root.localStorage?.removeItem(RESET_PENDING_KEY);root.sessionStorage?.removeItem(FORCE_RESET_KEY);const version=Math.max(0,Number(result.version)||currentVersion);if(workspaceId)root.sessionStorage?.setItem(HYDRATION_KEY,`${workspaceId}:${version}`);return {version,payload:{}};}
    return {version:currentVersion,payload:{}};
  }

  function installFetchBoundary(){
    if(!root.fetch||root.__leadintelPersistenceFetchInstalled)return;root.__leadintelPersistenceFetchInstalled=true;nativeFetch=root.fetch.bind(root);
    root.fetch=async function(input,init={}){
      const url=customerStateUrl(input);if(!url)return nativeFetch(input,init);const method=requestMethod(input,init);
      if(method==="GET"){
        const response=await nativeFetch(input,init);if(!response.ok)return response;const body=await response.clone().json().catch(()=>({}));const workspaceId=url.searchParams.get("workspace_id")||"";
        if(resetIntentMatchesUrl(url)){const cleared=await clearPendingServerReset(url,body);return jsonResponse(cleared,200);}
        if(body?.payload?.meta?.persistence?.explicit_saved===true){snapshotFromServerPayload(body.payload);return response;}
        const version=Math.max(0,Number(body?.version)||0);if(workspaceId)root.sessionStorage?.setItem(HYDRATION_KEY,`${workspaceId}:${version}`);
        if(isExplicitlySaved())return jsonResponse({...body,payload:payloadFromSnapshot()},response.status);
        return jsonResponse({...body,payload:{}},response.status);
      }
      if(method==="PUT"){
        const forceReset=root.sessionStorage?.getItem(FORCE_RESET_KEY)==="1"||resetIntentMatchesUrl(url);const saveIntent=root.sessionStorage?.getItem(SAVE_INTENT_KEY)==="1";const parsed=safeJson(typeof init?.body==="string"?init.body:"{}",{});
        if(!saveIntent&&!forceReset){root.setTimeout?.(renderPersistenceStatus,0);return jsonResponse({version:Math.max(0,Number(parsed?.version)||0),saved:false},200);}
        const next=withPersistenceMetadata(parsed,!forceReset&&isExplicitlySaved());if(forceReset)next.payload.meta.persistence={explicit_saved:false};
        const response=await nativeFetch(input,{...init,body:JSON.stringify(next)});
        if(response.ok){if(forceReset){root.sessionStorage?.removeItem(FORCE_RESET_KEY);root.localStorage?.removeItem(RESET_PENDING_KEY);root.setTimeout?.(renderPersistenceStatus,0);}if(saveIntent&&isExplicitlySaved())captureWorkspaceSnapshot();}
        return response;
      }
      return nativeFetch(input,init);
    };
  }

  function disableServerAutosave(){if(typeof Storage!=="undefined"&&Storage.prototype)Storage.prototype.__leadintelServerPatched=true;}
  function persistenceLabel(){if(!isExplicitlySaved())return "Unsaved draft · not saved";return dirtySinceSave?"Unsaved changes · click Save workspace":"Workspace saved";}
  function renderPersistenceStatus(){const status=root.document?.querySelector?.(".autosave");if(status)status.innerHTML=`<i></i>${persistenceLabel()}`;const button=root.document?.getElementById?.("save-workspace");if(button){button.textContent=isExplicitlySaved()?(dirtySinceSave?"Save changes":"Saved ✓"):"Save workspace";button.disabled=saveBusy;}}
  function toast(message){const el=root.document?.getElementById?.("toast");if(!el)return;el.textContent=message;el.classList.add("show");clearTimeout(toast.t);toast.t=setTimeout(()=>el.classList.remove("show"),2400);}
  function waitForBridge(timeout=1800){if(root.LeadIntelServerBridge?.session!==null&&root.LeadIntelServerBridge?.session!==undefined)return Promise.resolve(root.LeadIntelServerBridge);return new Promise(resolve=>{let done=false;const finish=()=>{if(done)return;done=true;root.removeEventListener?.("leadintel:server-ready",finish);resolve(root.LeadIntelServerBridge||null);};root.addEventListener?.("leadintel:server-ready",finish,{once:true});root.setTimeout?.(finish,timeout);});}

  async function saveWorkspace(){
    if(saveBusy)return false;saveBusy=true;renderPersistenceStatus();captureWorkspaceSnapshot();markExplicitlySaved();dirtySinceSave=false;root.sessionStorage?.setItem(SAVE_INTENT_KEY,"1");
    try{const bridge=await waitForBridge();if(bridge?.session?.authenticated&&bridge?.workspace){const result=await root.LeadIntelServerBridge?.saveNow?.();if(!result?.saved)throw new Error("Workspace could not be saved to LeadIntel");toast("Workspace saved");}else toast("Workspace saved in this browser");return true;}
    catch(error){toast(`Save failed · ${String(error?.message||"Unknown error")}`);return false;}
    finally{root.sessionStorage?.removeItem(SAVE_INTENT_KEY);saveBusy=false;renderPersistenceStatus();}
  }
  function ensureSaveButton(){const actions=root.document?.querySelector?.(".top-actions");if(!actions||root.document.getElementById("save-workspace"))return false;const button=root.document.createElement("button");button.className="ghost-btn";button.type="button";button.id="save-workspace";button.textContent="Save workspace";const reset=root.document.getElementById("reset-workspace");actions.insertBefore(button,reset||null);button.addEventListener("click",saveWorkspace);renderPersistenceStatus();return true;}
  function noteWorkspaceEdit(event){const target=event?.target;if(target?.closest&& !target.closest(".workspace"))return;if(target?.closest?.("#save-workspace,#reset-workspace,#ai-settings-drawer"))return;dirtySinceSave=true;renderPersistenceStatus();}
  function handleResetClick(event){
    const button=event?.target?.closest?.("#reset-workspace");if(!button||button.dataset.resetArmed!=="true")return false;
    root.sessionStorage?.setItem(FORCE_RESET_KEY,"1");recordResetIntent();clearExplicitSave();root.setTimeout?.(()=>root.sessionStorage?.removeItem(FORCE_RESET_KEY),5000);root.setTimeout?.(renderPersistenceStatus,0);return true;
  }
  function installUi(){
    ensureSaveButton();root.document?.addEventListener?.("input",noteWorkspaceEdit,true);root.document?.addEventListener?.("change",noteWorkspaceEdit,true);
    root.document?.addEventListener?.("click",event=>{if(event.target?.closest?.("[data-target-market],[data-remove-target-market],[data-remove-doc],[data-remove-signal],[data-opportunity-active],#add-target-market,#clear-target-markets,#add-custom-signal"))noteWorkspaceEdit(event);},true);
    root.document?.addEventListener?.("click",handleResetClick,true);
    root.addEventListener?.("leadintel:website-activated",()=>{dirtySinceSave=true;renderPersistenceStatus();});root.addEventListener?.("leadintel:server-ready",()=>root.setTimeout?.(renderPersistenceStatus,0));renderPersistenceStatus();
  }

  disableServerAutosave();installFetchBoundary();
  const changed=prepareForLoad();if(changed&&root.location?.reload){root.location.reload();return;}
  if(root.document?.readyState==="loading")root.document.addEventListener("DOMContentLoaded",installUi,{once:true});else installUi();

  root.LeadIntelWorkspacePersistence={EXPLICIT_SAVE_KEY,SNAPSHOT_KEY,SAVE_INTENT_KEY,FORCE_RESET_KEY,RESET_PENDING_KEY,WORKSPACE_DATA_KEYS,isExplicitlySaved,markExplicitlySaved,clearExplicitSave,currentWorkspaceData,captureWorkspaceSnapshot,restoreSavedSnapshot,clearWorkspaceData,prepareForLoad,snapshotFromServerPayload,saveWorkspace,renderPersistenceStatus,handleResetClick};
})(typeof globalThis!=="undefined"?globalThis:this);
