(function(root){
  "use strict";

  function looksLikeUrlOrDomain(value){
    const text=String(value??"").trim();
    if(!text||/\s/.test(text))return false;
    return /^https?:\/\//i.test(text)||/^www\./i.test(text)||/^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]*[a-z0-9])?)+\/?$/i.test(text);
  }

  function clearUrlLikeValue(input){
    if(!input||!looksLikeUrlOrDomain(input.value))return false;
    input.value="";
    return true;
  }

  function install(){
    if(!root?.document||root.__leadintelCustomMarketInputHygieneInstalled)return;
    const input=root.document.getElementById("custom-target-market");
    if(!input)return;
    root.__leadintelCustomMarketInputHygieneInstalled=true;

    // Chrome and other browsers may ignore autocomplete="off" and inject a saved
    // company website into unrelated text fields well after page startup. A URL or
    // domain is never a valid custom market definition, so keep guarding this one
    // field for the lifetime of the page instead of relying only on startup timers.
    const sweep=()=>clearUrlLikeValue(root.document.getElementById("custom-target-market"));
    input.addEventListener("input",sweep,true);
    input.addEventListener("focus",sweep,true);
    root.addEventListener?.("pageshow",sweep);
    root.document.addEventListener("visibilitychange",sweep,true);
    [0,100,350,1000,2500].forEach(delay=>root.setTimeout?.(sweep,delay));
    root.setInterval?.(sweep,750);
  }

  const api={looksLikeUrlOrDomain,clearUrlLikeValue,install};
  root.LeadIntelCustomMarketInputHygiene=api;
  install();
})(typeof globalThis!=="undefined"?globalThis:this);
