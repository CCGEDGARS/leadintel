(function(root){
  "use strict";

  const LEGACY_LOCAL_CLEANUP_KEY="leadintel_customer_v2_legacy_local_cleanup_20260901_v2";
  const LEGACY_RESET_PENDING_KEY="leadintel_customer_v2_reset_pending_v1";
  const ASSET_RESET_CLEANUP_KEY="leadintel_customer_v2_brand_asset_reset_cleanup_v1";
  const RESET_PENDING_KEY=ASSET_RESET_CLEANUP_KEY;
  const WORKSPACE_KEY="leadintel_customer_v2_workspace";
  const MAIN_STATE_KEY="leadintel_customer_v2_state";
  const BRAND_ASSET_ID=/^[A-Za-z0-9_-]{43}$/;
  const BRAND_ASSET_KINDS=Object.freeze(["logo","headshot","banner"]);
  const LEGACY_LOCAL_WORKSPACE_KEYS=Object.freeze([
    "leadintel_customer_v2_state",
    "leadintel_customer_v2_discovery",
    "leadintel_customer_v2_outreach",
    "leadintel_customer_v2_delivery",
    "leadintel_customer_v2_discovery_meta",
    "leadintel_customer_v2_website_activation_v1",
    "leadintel_customer_v2_research_meta_v1",
    "leadintel_customer_v2_server_dirty"
  ]);
  const RESET_RESIDUE_KEYS=Object.freeze([
    "leadintel_customer_v2_website_activation_v1",
    "leadintel_customer_v2_research_meta_v1"
  ]);
  let finalizingReset=false;
  let assetCleanupPromise=null;

  function emergencyResetRequested(){
    try{return new URLSearchParams(root.location?.search||"").get("reset")==="1";}
    catch{return false;}
  }

  function runEmergencyBrowserReset(){
    if(!emergencyResetRequested()||!root?.localStorage)return false;
    for(const key of LEGACY_LOCAL_WORKSPACE_KEYS)root.localStorage.removeItem(key);
    root.localStorage.removeItem(ASSET_RESET_CLEANUP_KEY);
    try{root.sessionStorage?.removeItem("leadintel_customer_v2_server_hydration");}catch{}
    try{root.sessionStorage?.removeItem("leadintel_customer_v2_server_conflict");}catch{}
    root.location.replace("./");
    return true;
  }

  function clearLegacyLocalAutosaveOnce(){
    if(!root?.localStorage)return false;
    if(root.localStorage.getItem(LEGACY_LOCAL_CLEANUP_KEY)==="done")return false;
    for(const key of LEGACY_LOCAL_WORKSPACE_KEYS)root.localStorage.removeItem(key);
    try{root.sessionStorage?.removeItem("leadintel_customer_v2_server_hydration");}catch{}
    try{root.sessionStorage?.removeItem("leadintel_customer_v2_server_conflict");}catch{}
    root.localStorage.setItem(LEGACY_LOCAL_CLEANUP_KEY,"done");
    root.location.reload();
    return true;
  }

  function clearBrowserWorkspaceResidue(){
    if(!root?.localStorage)return false;
    for(const key of RESET_RESIDUE_KEYS)root.localStorage.removeItem(key);
    return true;
  }

  function referencedBrandAssets(){
    try{
      const state=JSON.parse(root.localStorage?.getItem(MAIN_STATE_KEY)||"{}");
      const assets=state?.brandIdentity?.assets;
      if(!assets||typeof assets!=="object"||Array.isArray(assets))return [];
      return BRAND_ASSET_KINDS.flatMap(kind=>{
        const id=String(assets[kind]?.id||"");
        return BRAND_ASSET_ID.test(id)?[{kind,id}]:[];
      });
    }catch{return [];}
  }

  function clearLocalBrandIdentity(){
    if(!root?.localStorage)return false;
    try{
      const state=JSON.parse(root.localStorage.getItem(MAIN_STATE_KEY)||"{}");
      if(!state||typeof state!=="object"||Array.isArray(state))return false;
      if(Object.prototype.hasOwnProperty.call(state,"brandIdentity")){
        delete state.brandIdentity;
        root.localStorage.setItem(MAIN_STATE_KEY,JSON.stringify(state));
      }
      return true;
    }catch{return false;}
  }

  function recordResetIntent(assets=referencedBrandAssets()){
    if(!root?.localStorage)return false;
    const workspaceId=String(root.localStorage.getItem(WORKSPACE_KEY)||"");
    root.localStorage.setItem(ASSET_RESET_CLEANUP_KEY,JSON.stringify({workspace_id:workspaceId,requested_at:Date.now(),assets:Array.isArray(assets)?assets:[]}));
    return true;
  }

  function readResetIntent(){
    try{
      const current=root.localStorage?.getItem(ASSET_RESET_CLEANUP_KEY);
      const legacy=current?null:root.localStorage?.getItem(LEGACY_RESET_PENDING_KEY);
      const legacyValue=legacy?JSON.parse(legacy):null;const value=current?JSON.parse(current):(Array.isArray(legacyValue?.assets)?legacyValue:null);
      if(!current&&Array.isArray(legacyValue?.assets))root.localStorage?.setItem(ASSET_RESET_CLEANUP_KEY,JSON.stringify(legacyValue));
      return value&&typeof value==="object"?value:null;
    }catch{return null;}
  }

  function resetIntentMatchesWorkspace(intent,bridge){
    if(!intent||!bridge?.workspace)return false;
    const intended=String(intent.workspace_id||"");
    if(intended)return intended===bridge.workspace.id;
    return Array.isArray(bridge.workspaces)&&bridge.workspaces.length===1;
  }

  function emitAssetCleanup(detail){
    try{root.dispatchEvent?.(new root.CustomEvent("leadintel:brand-assets-reset-cleanup",{detail}));}catch{}
  }

  async function cleanupResetAssets(intent,bridge){
    const assets=Array.isArray(intent?.assets)?intent.assets.filter(item=>BRAND_ASSET_KINDS.includes(item?.kind)&&BRAND_ASSET_ID.test(String(item?.id||""))):[];
    const failed=[];
    let deleted=0,queued=0;
    for(const asset of assets){
      try{
        const result=await bridge.deleteBrandAsset(asset.kind,{id:asset.id},{cleanupOnly:true});
        if(result?.ok||Number(result?.status)===404)deleted++;
        else if(result?.queued)queued++;
        else failed.push(asset);
      }catch(error){
        if(Number(error?.status)===404)deleted++;
        else failed.push(asset);
      }
    }
    const detail={attempted:assets.length,deleted,queued,failed:failed.length};
    if(failed.length){
      root.localStorage.setItem(ASSET_RESET_CLEANUP_KEY,JSON.stringify({...intent,assets:failed,last_cleanup_at:Date.now(),cleanup_failures:failed.length}));
      console.warn("LeadIntel brand asset reset cleanup incomplete",detail);
    }else root.localStorage.removeItem(ASSET_RESET_CLEANUP_KEY);
    emitAssetCleanup(detail);
    return detail;
  }

  function afterWorkspaceSaved(workspaceId){
    if(assetCleanupPromise)return assetCleanupPromise;
    const intent=readResetIntent();
    const bridge=root.LeadIntelServerBridge;
    if(!intent||!bridge?.session?.authenticated||!bridge.workspace||String(workspaceId||"")!==bridge.workspace.id||!resetIntentMatchesWorkspace(intent,bridge))return Promise.resolve({attempted:0,deleted:0,queued:0,failed:0});
    if(typeof bridge.deleteBrandAsset!=="function"){
      const attempted=Array.isArray(intent.assets)?intent.assets.length:0;
      const detail={attempted,deleted:0,queued:0,failed:attempted,unavailable:true};
      emitAssetCleanup(detail);
      return Promise.resolve(detail);
    }
    assetCleanupPromise=cleanupResetAssets(intent,bridge).finally(()=>{assetCleanupPromise=null;});
    return assetCleanupPromise;
  }

  async function finalizePendingReset(){
    if(finalizingReset)return false;
    const intent=readResetIntent();
    const bridge=root.LeadIntelServerBridge;
    if(!intent||!bridge?.session?.authenticated||!bridge.workspace||!resetIntentMatchesWorkspace(intent,bridge))return false;
    finalizingReset=true;
    try{
      const serverResetPending=Boolean(root.localStorage?.getItem(LEGACY_RESET_PENDING_KEY));
      if(!serverResetPending){await afterWorkspaceSaved(bridge.workspace.id);return true;}
      let result=null;
      if(bridge.conflict&&typeof bridge.resolveConflictKeepLocal==="function")result=await bridge.resolveConflictKeepLocal();
      else if(typeof bridge.saveNow==="function")result=await bridge.saveNow({saveIntent:true});
      const completed=Boolean(result?.saved||result?.resolved);
      if(completed)await afterWorkspaceSaved(bridge.workspace.id);
      return completed;
    }catch{return false;}
    finally{finalizingReset=false;}
  }

  function refreshResetUi(){
    try{root.LeadIntelWebsiteInputSync?.restoreSavedWebsite?.();}catch{}
    try{root.LeadIntelWebsiteActivation?.render?.();}catch{}
  }

  // The existing reset button uses a two-click armed state. Capture the second
  // click before app.js performs the reset so managed asset references can be
  // retained for audited cleanup after the cleared workspace state is saved.
  function handleResetClick(event){
    const button=event?.target?.closest?.("#reset-workspace");
    if(!button||button.dataset.resetArmed!=="true")return false;
    const bridge=root.LeadIntelServerBridge;
    recordResetIntent(referencedBrandAssets());
    clearLocalBrandIdentity();
    clearBrowserWorkspaceResidue();
    root.setTimeout?.(refreshResetUi,0);
    if(bridge?.session?.authenticated&&bridge.conflict)root.setTimeout?.(()=>finalizePendingReset(),0);
    return true;
  }

  function install(){
    if(!root?.document||root.__leadintelWorkspaceResetHygieneInstalled)return;
    root.__leadintelWorkspaceResetHygieneInstalled=true;
    if(runEmergencyBrowserReset())return;
    if(clearLegacyLocalAutosaveOnce())return;
    readResetIntent();
    root.document.addEventListener("click",handleResetClick,true);
    root.addEventListener?.("leadintel:server-ready",()=>finalizePendingReset());
  }

  const api={LEGACY_LOCAL_CLEANUP_KEY,LEGACY_RESET_PENDING_KEY,ASSET_RESET_CLEANUP_KEY,RESET_PENDING_KEY,WORKSPACE_KEY,MAIN_STATE_KEY,LEGACY_LOCAL_WORKSPACE_KEYS,RESET_RESIDUE_KEYS,emergencyResetRequested,runEmergencyBrowserReset,clearLegacyLocalAutosaveOnce,clearBrowserWorkspaceResidue,referencedBrandAssets,clearLocalBrandIdentity,recordResetIntent,readResetIntent,resetIntentMatchesWorkspace,cleanupResetAssets,afterWorkspaceSaved,finalizePendingReset,refreshResetUi,handleResetClick,install};
  root.LeadIntelWorkspaceResetHygiene=api;
  install();
})(typeof globalThis!=="undefined"?globalThis:this);
