(function(root){
  "use strict";

  const LEGACY_LOCAL_CLEANUP_KEY="leadintel_customer_v2_legacy_local_cleanup_20260901_v2";
  const RESET_PENDING_KEY="leadintel_customer_v2_reset_pending_v1";
  const WORKSPACE_KEY="leadintel_customer_v2_workspace";
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

  function emergencyResetRequested(){
    try{return new URLSearchParams(root.location?.search||"").get("reset")==="1";}
    catch{return false;}
  }

  function runEmergencyBrowserReset(){
    if(!emergencyResetRequested()||!root?.localStorage)return false;
    for(const key of LEGACY_LOCAL_WORKSPACE_KEYS)root.localStorage.removeItem(key);
    root.localStorage.removeItem(RESET_PENDING_KEY);
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

  function recordResetIntent(){
    if(!root?.localStorage)return false;
    const workspaceId=String(root.localStorage.getItem(WORKSPACE_KEY)||"");
    root.localStorage.setItem(RESET_PENDING_KEY,JSON.stringify({workspace_id:workspaceId,requested_at:Date.now()}));
    return true;
  }

  function readResetIntent(){
    try{
      const value=JSON.parse(root.localStorage?.getItem(RESET_PENDING_KEY)||"null");
      return value&&typeof value==="object"?value:null;
    }catch{return null;}
  }

  function resetIntentMatchesWorkspace(intent,bridge){
    if(!intent||!bridge?.workspace)return false;
    const intended=String(intent.workspace_id||"");
    if(intended)return intended===bridge.workspace.id;
    return Array.isArray(bridge.workspaces)&&bridge.workspaces.length===1;
  }

  async function finalizePendingReset(){
    if(finalizingReset)return false;
    const intent=readResetIntent();
    const bridge=root.LeadIntelServerBridge;
    if(!intent||!bridge?.session?.authenticated||!bridge.workspace||!resetIntentMatchesWorkspace(intent,bridge))return false;
    finalizingReset=true;
    try{
      let result=null;
      if(bridge.conflict&&typeof bridge.resolveConflictKeepLocal==="function")result=await bridge.resolveConflictKeepLocal();
      else if(typeof bridge.saveNow==="function")result=await bridge.saveNow();
      const completed=Boolean(result?.saved||result?.resolved);
      if(completed)root.localStorage.removeItem(RESET_PENDING_KEY);
      return completed;
    }catch{return false;}
    finally{finalizingReset=false;}
  }

  function refreshResetUi(){
    try{root.LeadIntelWebsiteInputSync?.restoreSavedWebsite?.();}catch{}
    try{root.LeadIntelWebsiteActivation?.render?.();}catch{}
  }

  // The existing reset button uses a two-click armed state. Capture the second
  // click before app.js performs the reset. A normal authenticated reset is
  // already saved by app.js. Only signed-out resets (or a reset during an active
  // conflict) need a durable intent that resumes through the safe sync path.
  function handleResetClick(event){
    const button=event?.target?.closest?.("#reset-workspace");
    if(!button||button.dataset.resetArmed!=="true")return false;
    const bridge=root.LeadIntelServerBridge;
    const deferred=!bridge?.session?.authenticated||Boolean(bridge.conflict);
    if(deferred)recordResetIntent();else root.localStorage?.removeItem(RESET_PENDING_KEY);
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
    root.document.addEventListener("click",handleResetClick,true);
    root.addEventListener?.("leadintel:server-ready",()=>finalizePendingReset());
  }

  const api={LEGACY_LOCAL_CLEANUP_KEY,RESET_PENDING_KEY,WORKSPACE_KEY,LEGACY_LOCAL_WORKSPACE_KEYS,RESET_RESIDUE_KEYS,emergencyResetRequested,runEmergencyBrowserReset,clearLegacyLocalAutosaveOnce,clearBrowserWorkspaceResidue,recordResetIntent,readResetIntent,resetIntentMatchesWorkspace,finalizePendingReset,refreshResetUi,handleResetClick,install};
  root.LeadIntelWorkspaceResetHygiene=api;
  install();
})(typeof globalThis!=="undefined"?globalThis:this);
