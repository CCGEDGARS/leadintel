(function(root,factory){
  const api=factory(root);
  if(typeof module!=="undefined"&&module.exports)module.exports=api;
  if(root)root.LeadIntelWebsiteInputSync=api;
  if(root?.document&&root?.localStorage)api.install();
})(typeof globalThis!=="undefined"?globalThis:this,function(root){
  "use strict";

  const STORAGE_KEY="leadintel_customer_v2_state";
  const INPUT_ID="company-website";
  const CHECK_DELAYS=[0,120,500,1200,2500];

  function normalizeUrl(value){
    const raw=String(value??"").trim();
    if(!raw)return "";
    try{
      const url=new URL(/^https?:\/\//i.test(raw)?raw:`https://${raw}`);
      if(!["http:","https:"].includes(url.protocol)||!url.hostname.includes("."))return "";
      url.hash="";
      return url.href;
    }catch{return "";}
  }

  function toVisibleWebsite(value){
    const normalized=normalizeUrl(value);
    return normalized?normalized.replace(/^https?:\/\//i,"").replace(/\/$/,""):"";
  }

  function resolveWebsite(savedWebsite,visibleWebsite){
    return normalizeUrl(visibleWebsite)||normalizeUrl(savedWebsite);
  }

  function mergeVisibleWebsite(state={},visibleWebsite=""){
    const source=state&&typeof state==="object"&&!Array.isArray(state)?state:{};
    const website=resolveWebsite(source.website,visibleWebsite);
    return website?{...source,website}:{...source};
  }

  function readState(){
    try{
      const parsed=JSON.parse(root.localStorage.getItem(STORAGE_KEY)||"{}");
      return parsed&&typeof parsed==="object"&&!Array.isArray(parsed)?parsed:{};
    }catch{return {};}
  }

  function dispatchSynced(website,source){
    try{root.dispatchEvent(new CustomEvent("leadintel:website-synced",{detail:{website,source}}));}catch{}
  }

  // Passive browser restore/autofill is never a source of truth. On page lifecycle
  // checks, the visible field is rebuilt from the saved LeadIntel workspace only.
  function restoreSavedWebsite(){
    const input=root?.document?.getElementById(INPUT_ID);
    if(!input)return false;
    if(root.document.activeElement===input)return false;
    const saved=normalizeUrl(readState().website);
    const display=toVisibleWebsite(saved);
    const changed=input.value!==display;
    if(changed)input.value=display;
    if(changed)dispatchSynced(saved,"saved-workspace");
    return changed;
  }

  // User edits may contain a complete URL even though the field already has a fixed
  // visual https:// prefix. Normalize the display only; app.js owns persistence.
  function syncVisibleWebsite(){
    const input=root?.document?.getElementById(INPUT_ID);
    if(!input)return false;
    const visible=normalizeUrl(input.value);
    if(!visible)return false;
    const display=toVisibleWebsite(visible);
    const displayChanged=input.value!==display;
    if(displayChanged)input.value=display;
    dispatchSynced(visible,"user-input");
    return displayChanged;
  }

  // Chrome/Safari may emit an input event while restoring/autofilling a form even
  // though the user is not editing the field. Capture that event before app.js can
  // treat it as a real edit and save it into the workspace.
  function guardPassiveRestore(event){
    const input=root?.document?.getElementById(INPUT_ID);
    if(!input||root.document.activeElement===input)return false;
    event?.stopImmediatePropagation?.();
    return restoreSavedWebsite();
  }

  function install(){
    if(!root?.document||!root?.localStorage||root.__leadintelWebsiteInputSyncInstalled)return;
    root.__leadintelWebsiteInputSyncInstalled=true;
    const bindInput=()=>{
      const input=root.document.getElementById(INPUT_ID);
      if(!input)return;
      input.addEventListener("input",guardPassiveRestore,true);
      input.addEventListener("input",syncVisibleWebsite);
      input.addEventListener("change",restoreSavedWebsite);
      input.addEventListener("blur",restoreSavedWebsite);
      input.addEventListener("focus",restoreSavedWebsite);
    };
    bindInput();
    CHECK_DELAYS.forEach(delay=>root.setTimeout(restoreSavedWebsite,delay));
    root.addEventListener("pageshow",()=>root.setTimeout(restoreSavedWebsite,0));
    root.document.getElementById("target-market-selector")?.addEventListener("pointerdown",restoreSavedWebsite,{capture:true});
  }

  return {STORAGE_KEY,normalizeUrl,toVisibleWebsite,resolveWebsite,mergeVisibleWebsite,readState,restoreSavedWebsite,syncVisibleWebsite,guardPassiveRestore,install};
});
