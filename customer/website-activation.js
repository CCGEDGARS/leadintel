(function(root,factory){
  const api=factory(root);
  if(typeof module!=="undefined"&&module.exports)module.exports=api;
  if(root)root.LeadIntelWebsiteActivation=api;
  if(root?.document&&root?.localStorage)api.install();
})(typeof globalThis!=="undefined"?globalThis:this,function(root){
  "use strict";

  const STORAGE_KEY="leadintel_customer_v2_state";
  const RESEARCH_META_KEY="leadintel_customer_v2_research_meta_v1";
  const FIRECRAWL_PROXY="https://apollo-proxy.edgars-7e7.workers.dev";
  const MAX_SOURCE_CHARS=30000;
  let running=false;

  function clean(value){return String(value??"").replace(/\s+/g," ").trim();}
  function normalizeUrl(value){
    const raw=clean(value);if(!raw)return "";
    try{
      const url=new URL(/^https?:\/\//i.test(raw)?raw:`https://${raw}`);
      if(!["http:","https:"].includes(url.protocol)||!url.hostname.includes("."))return "";
      url.hash="";return url.href;
    }catch{return "";}
  }
  function sameUrl(a,b){return Boolean(normalizeUrl(a)&&normalizeUrl(a)===normalizeUrl(b));}
  function getActivatedSource(state={},website=""){
    const target=normalizeUrl(website||state.website);if(!target)return null;
    const source=(Array.isArray(state.scrapedSources)?state.scrapedSources:[]).find(row=>row?.type==="website"&&sameUrl(row.url,target)&&clean(row.text));
    return source?{...source,url:normalizeUrl(source.url)}:null;
  }
  function isWebsiteActive(state={},website=""){
    const activation=state?.websiteActivation||{};const target=normalizeUrl(website||state.website);
    return Boolean(target&&activation.status==="active"&&sameUrl(activation.url,target)&&getActivatedSource(state,target));
  }
  function buildActivatedState(state={},source={},activatedAt=new Date().toISOString()){
    const base=state&&typeof state==="object"&&!Array.isArray(state)?state:{};
    const url=normalizeUrl(source.url||base.website);const text=String(source.text||"").replace(/\u0000/g,"").trim().slice(0,MAX_SOURCE_CHARS);
    if(!url||!text)return {...base};
    const title=clean(source.title).slice(0,180);const description=clean(source.description).slice(0,500);
    const websiteSource={type:"website",url,title,text,status:"ready"};
    return {
      ...base,
      website:url,
      websiteActivation:{status:"active",url,title,description,activatedAt:clean(activatedAt),contentChars:text.length},
      scrapedSources:[websiteSource],
      profile:null,
      approved:false,
      market:{}
    };
  }
  function readState(){
    try{const parsed=JSON.parse(root.localStorage.getItem(STORAGE_KEY)||"{}");return parsed&&typeof parsed==="object"&&!Array.isArray(parsed)?parsed:{};}catch{return {};}
  }
  function writeState(value){root.localStorage.setItem(STORAGE_KEY,JSON.stringify(value));}
  function visibleWebsite(){return normalizeUrl(root?.document?.getElementById("company-website")?.value||"");}
  function formatChars(value){const n=Math.max(0,Number(value)||0);return n>=1000?`${(n/1000).toFixed(n>=10000?0:1)}k chars`:`${n} chars`;}
  function setStatus(kind,message){
    const status=root?.document?.getElementById("website-activation-status");if(!status)return;
    status.dataset.state=kind;status.textContent=message;
  }
  function render(){
    if(!root?.document||!root?.localStorage)return;
    const button=root.document.getElementById("activate-website");const website=visibleWebsite();const state=readState();
    if(button&&!running){button.disabled=!website;button.textContent=isWebsiteActive(state,website)?"RE-ACTIVATE":"ACTIVATE WEBSITE";}
    if(running)return;
    if(!website){setStatus("idle","Enter your company website, then activate it.");return;}
    if(isWebsiteActive(state,website)){
      const a=state.websiteActivation||{};const label=a.title?` · ${a.title}`:"";setStatus("active",`✓ Website active${label} · ${formatChars(a.contentChars)} loaded`);return;
    }
    const wasActive=state.websiteActivation?.status==="active";
    setStatus("idle",wasActive?"Website changed — activate this URL to replace the current source.":"Not activated yet — connect the website to load company evidence.");
  }
  async function scrapeWebsite(url){
    const response=await root.fetch(`${FIRECRAWL_PROXY}/firecrawl-scrape`,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({url,formats:["markdown"],onlyMainContent:true,timeout:30000})});
    const payload=await response.json().catch(()=>({}));if(!response.ok)throw new Error(payload.error||`Website returned ${response.status}`);
    const data=payload.data||payload;const text=String(data.markdown||data.content||"").replace(/\u0000/g,"").trim().slice(0,MAX_SOURCE_CHARS);
    if(!text)throw new Error("No readable website content was returned");
    return {url,title:data.metadata?.title||data.title||new URL(url).hostname,description:data.metadata?.description||"",text};
  }
  async function activateWebsite(){
    if(running)return false;const url=visibleWebsite();const button=root?.document?.getElementById("activate-website");
    if(!url){setStatus("error","Enter a valid website URL first.");return false;}
    running=true;if(button){button.disabled=true;button.textContent="ACTIVATING…";}setStatus("loading","Connecting to the website and loading public company evidence…");
    try{
      const source=await scrapeWebsite(url);const next=buildActivatedState(readState(),source,new Date().toISOString());writeState(next);root.localStorage.removeItem(RESEARCH_META_KEY);
      try{root.dispatchEvent(new CustomEvent("leadintel:website-activated",{detail:{website:next.website,activation:next.websiteActivation}}));}catch{}
      root.document.getElementById("company-website")?.dispatchEvent(new Event("input",{bubbles:true}));
      try{await root.LeadIntelServerBridge?.saveNow?.();}catch{}
      setStatus("active",`✓ Website active · ${next.websiteActivation.title||new URL(next.website).hostname} · ${formatChars(next.websiteActivation.contentChars)} loaded`);
      return true;
    }catch(error){setStatus("error",`Activation failed · ${clean(error?.message)||"Website could not be read"}`);return false;}
    finally{running=false;render();}
  }
  function install(){
    if(root.__leadintelWebsiteActivationInstalled)return;root.__leadintelWebsiteActivationInstalled=true;
    const bind=()=>{
      const button=root.document.getElementById("activate-website"),input=root.document.getElementById("company-website");
      button?.addEventListener("click",activateWebsite);input?.addEventListener("input",render);input?.addEventListener("change",render);
      render();
    };
    if(root.document.readyState==="loading")root.document.addEventListener("DOMContentLoaded",bind,{once:true});else bind();
    root.addEventListener("pageshow",render);root.addEventListener("leadintel:website-synced",render);
  }

  return {STORAGE_KEY,RESEARCH_META_KEY,normalizeUrl,getActivatedSource,isWebsiteActive,buildActivatedState,scrapeWebsite,activateWebsite,render,install};
});
