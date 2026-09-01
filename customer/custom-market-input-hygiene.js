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
    // company website into unrelated text fields. A URL/domain is never a valid
    // custom market definition, so remove it whether it arrives from autofill,
    // page restore or ordinary input.
    const sweep=()=>clearUrlLikeValue(input);
    input.addEventListener("input",sweep,true);
    input.addEventListener("focus",sweep,true);
    root.addEventListener?.("pageshow",sweep);
    [0,100,350,1000,2500].forEach(delay=>root.setTimeout?.(sweep,delay));
  }

  const api={looksLikeUrlOrDomain,clearUrlLikeValue,install};
  root.LeadIntelCustomMarketInputHygiene=api;
  install();
})(typeof globalThis!=="undefined"?globalThis:this);
