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

  function syncVisibleWebsite(){
    const input=root?.document?.getElementById(INPUT_ID);
    if(!input)return false;
    const visible=normalizeUrl(input.value);
    if(!visible)return false;

    // The field already has a fixed visual "https://" prefix. Browser autofill/page
    // restore, paste, or typing can reinsert the complete URL, so normalize the
    // visible value every time—even when the canonical saved URL is unchanged.
    const display=toVisibleWebsite(visible);
    const displayChanged=input.value!==display;
    if(displayChanged)input.value=display;

    const state=readState();
    const saved=normalizeUrl(state.website);
    if(saved===visible)return displayChanged;
    const next=mergeVisibleWebsite(state,visible);
    root.localStorage.setItem(STORAGE_KEY,JSON.stringify(next));
    input.dispatchEvent(new Event("input",{bubbles:true}));
    try{root.dispatchEvent(new CustomEvent("leadintel:website-synced",{detail:{website:visible}}));}catch{}
    return true;
  }

  function install(){
    if(!root?.document||!root?.localStorage||root.__leadintelWebsiteInputSyncInstalled)return;
    root.__leadintelWebsiteInputSyncInstalled=true;
    const bindInput=()=>{
      const input=root.document.getElementById(INPUT_ID);
      if(!input)return;
      input.addEventListener("input",syncVisibleWebsite);
      input.addEventListener("change",syncVisibleWebsite);
      input.addEventListener("blur",syncVisibleWebsite);
      input.addEventListener("focus",syncVisibleWebsite);
    };
    bindInput();
    CHECK_DELAYS.forEach(delay=>root.setTimeout(syncVisibleWebsite,delay));
    root.addEventListener("pageshow",()=>root.setTimeout(syncVisibleWebsite,0));
    root.document.getElementById("target-market-selector")?.addEventListener("pointerdown",syncVisibleWebsite,{capture:true});
  }

  return {STORAGE_KEY,normalizeUrl,toVisibleWebsite,resolveWebsite,mergeVisibleWebsite,syncVisibleWebsite,install};
});
