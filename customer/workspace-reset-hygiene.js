(function(root){
  "use strict";

  const RESET_RESIDUE_KEYS=Object.freeze([
    "leadintel_customer_v2_website_activation_v1",
    "leadintel_customer_v2_research_meta_v1"
  ]);

  function clearBrowserWorkspaceResidue(){
    if(!root?.localStorage)return false;
    for(const key of RESET_RESIDUE_KEYS)root.localStorage.removeItem(key);
    return true;
  }

  function refreshResetUi(){
    try{root.LeadIntelWebsiteInputSync?.restoreSavedWebsite?.();}catch{}
    try{root.LeadIntelWebsiteActivation?.render?.();}catch{}
  }

  // The existing reset button uses a two-click armed state. Capture the second
  // click before app.js performs the reset so derived browser-only company caches
  // are cleared with the workspace. Provider/API credentials live server-side and
  // are intentionally outside this reset boundary.
  function handleResetClick(event){
    const button=event?.target?.closest?.("#reset-workspace");
    if(!button||button.dataset.resetArmed!=="true")return false;
    clearBrowserWorkspaceResidue();
    root.setTimeout?.(refreshResetUi,0);
    return true;
  }

  function install(){
    if(!root?.document||root.__leadintelWorkspaceResetHygieneInstalled)return;
    root.__leadintelWorkspaceResetHygieneInstalled=true;
    root.document.addEventListener("click",handleResetClick,true);
  }

  const api={RESET_RESIDUE_KEYS,clearBrowserWorkspaceResidue,refreshResetUi,handleResetClick,install};
  root.LeadIntelWorkspaceResetHygiene=api;
  install();
})(typeof globalThis!=="undefined"?globalThis:this);
