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

  function refreshResetUi(){
    try{root.LeadIntelWebsiteInputSync?.restoreSavedWebsite?.();}catch{}
    try{root.LeadIntelWebsiteActivation?.render?.();}catch{}
  }

  // The existing reset button uses a two-click armed state. Capture the second
  // click before app.js performs the reset. The durable reset intent lets the
  // authenticated bridge clear the saved workspace after a later sign-in. CRM
  // records and provider/API credentials live outside this workspace-state reset.
  function handleResetClick(event){
    const button=event?.target?.closest?.("#reset-workspace");
    if(!button||button.dataset.resetArmed!=="true")return false;
    recordResetIntent();
    clearBrowserWorkspaceResidue();
    root.setTimeout?.(refreshResetUi,0);
    return true;
  }

  function install(){
    if(!root?.document||root.__leadintelWorkspaceResetHygieneInstalled)return;
    root.__leadintelWorkspaceResetHygieneInstalled=true;
    if(clearLegacyLocalAutosaveOnce())return;
    root.document.addEventListener("click",handleResetClick,true);
  }

  const api={LEGACY_LOCAL_CLEANUP_KEY,RESET_PENDING_KEY,WORKSPACE_KEY,LEGACY_LOCAL_WORKSPACE_KEYS,RESET_RESIDUE_KEYS,clearLegacyLocalAutosaveOnce,clearBrowserWorkspaceResidue,recordResetIntent,refreshResetUi,handleResetClick,install};
  root.LeadIntelWorkspaceResetHygiene=api;
  install();
})(typeof globalThis!=="undefined"?globalThis:this);
