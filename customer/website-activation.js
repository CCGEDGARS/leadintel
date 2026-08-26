(function(root,factory){
  const api=factory(root);
  if(typeof module!=="undefined"&&module.exports)module.exports=api;
  if(root)root.LeadIntelWebsiteActivation=api;
  if(root?.document&&root?.localStorage)api.install();
})(typeof globalThis!=="undefined"?globalThis:this,function(root){
  "use strict";

  const STORAGE_KEY="leadintel_customer_v2_state";
  const ACTIVATION_KEY="leadintel_customer_v2_website_activation_v1";
  const RESEARCH_META_KEY="leadintel_customer_v2_research_meta_v1";
  const FIRECRAWL_PROXY="https://apollo-proxy.edgars-7e7.workers.dev";
  const RELEASE="20260826-website-activation-v1";
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
  function normalizedSource(source={}){
    const url=normalizeUrl(source.url);const text=String(source.text||"").replace(/\u0000/g,"").trim().slice(0,MAX_SOURCE_CHARS);
    if(!url||!text)return null;
    return {type:"website",url,title:clean(source.title).slice(0,180),description:clean(source.description).slice(0,500),text,status:"ready"};
  }
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
    const base=state&&typeof state==="object"&&!Array.isArray(state)?state:{};const websiteSource=normalizedSource(source);
    if(!websiteSource)return {...base};
    const {url,title,description,text}=websiteSource;
    return {
      ...base,
      website:url,
      websiteActivation:{status:"active",url,title,description,activatedAt:clean(activatedAt),contentChars:text.length},
      scrapedSources:[{type:"website",url,title,text,status:"ready"}],
      profile:null,
      approved:false,
      market:{}
    };
  }
  function buildActivationRecord(source={},activatedAt=new Date().toISOString()){
    const websiteSource=normalizedSource(source);if(!websiteSource)return {status:"inactive",url:"",source:null};
    const {url,title,description,text}=websiteSource;
    return {status:"active",url,title,description,activatedAt:clean(activatedAt),contentChars:text.length,source:{type:"website",url,title,text,status:"ready"}};
  }
  function isActivationRecordActive(record={},website=""){
    const target=normalizeUrl(website);return Boolean(target&&record?.status==="active"&&sameUrl(record.url,target)&&record.source?.type==="website"&&sameUrl(record.source.url,target)&&clean(record.source.text));
  }
  function activationMarkup(){return '<button class="activate-website-btn" id="activate-website" type="button">ACTIVATE WEBSITE</button><div class="website-activation-status" id="website-activation-status" data-state="idle" role="status" aria-live="polite">Not activated yet — connect the website to load company evidence.</div>';}
  function readJson(key,fallback={}){try{const parsed=JSON.parse(root.localStorage.getItem(key)||"null");return parsed&&typeof parsed==="object"&&!Array.isArray(parsed)?parsed:fallback;}catch{return fallback;}}
  function readState(){return readJson(STORAGE_KEY,{});}
  function writeState(value){root.localStorage.setItem(STORAGE_KEY,JSON.stringify(value));}
  function readActivationRecord(){return readJson(ACTIVATION_KEY,{});}
  function writeActivationRecord(value){root.localStorage.setItem(ACTIVATION_KEY,JSON.stringify(value));}
  function visibleWebsite(){return normalizeUrl(root?.document?.getElementById("company-website")?.value||"");}
  function isCurrentWebsiteActive(website=visibleWebsite()){return isActivationRecordActive(readActivationRecord(),website);}
  function formatChars(value){const n=Math.max(0,Number(value)||0);return n>=1000?`${(n/1000).toFixed(n>=10000?0:1)}k chars`:`${n} chars`;}
  function setStatus(kind,message){const status=root?.document?.getElementById("website-activation-status");if(status){status.dataset.state=kind;status.textContent=message;}}
  function ensureActivationUi(){
    if(!root?.document)return false;
    if(!root.document.querySelector('link[data-leadintel-asset="website-activation-css"]')){const link=root.document.createElement("link");link.rel="stylesheet";link.href=`website-activation.css?v=${RELEASE}`;link.dataset.leadintelAsset="website-activation-css";root.document.head.appendChild(link);}
    if(root.document.getElementById("activate-website"))return true;
    const urlRow=root.document.querySelector(".source-panel .url-row");if(!urlRow||!urlRow.parentNode)return false;
    const wrapper=root.document.createElement("div");wrapper.className="website-activation-row";urlRow.parentNode.insertBefore(wrapper,urlRow);wrapper.appendChild(urlRow);wrapper.insertAdjacentHTML("beforeend",activationMarkup());return true;
  }
  function render(){
    if(!root?.document||!root?.localStorage)return;ensureActivationUi();
    const button=root.document.getElementById("activate-website"),website=visibleWebsite(),record=readActivationRecord();
    if(button&&!running){button.disabled=!website;button.textContent=isActivationRecordActive(record,website)?"RE-ACTIVATE":"ACTIVATE WEBSITE";}
    if(running)return;
    if(!website){setStatus("idle","Enter your company website, then activate it.");return;}
    if(isActivationRecordActive(record,website)){const label=record.title?` · ${record.title}`:"";setStatus("active",`✓ Website active${label} · ${formatChars(record.contentChars)} loaded`);return;}
    setStatus("idle",record?.status==="active"?"Website changed — activate this URL to replace the current source.":"Not activated yet — connect the website to load company evidence.");
  }
  async function scrapeWebsite(url){
    const response=await root.fetch(`${FIRECRAWL_PROXY}/firecrawl-scrape`,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({url,formats:["markdown"],onlyMainContent:true,timeout:30000})});
    const payload=await response.json().catch(()=>({}));if(!response.ok)throw new Error(payload.error||`Website returned ${response.status}`);
    const data=payload.data||payload;const text=String(data.markdown||data.content||"").replace(/\u0000/g,"").trim().slice(0,MAX_SOURCE_CHARS);
    if(!text)throw new Error("No readable website content was returned");
    return {url,title:data.metadata?.title||data.title||new URL(url).hostname,description:data.metadata?.description||"",text};
  }
  function mergeRecordIntoState(state,record){
    if(!isActivationRecordActive(record,record?.url))return state;
    const base=state&&typeof state==="object"&&!Array.isArray(state)?state:{};const other=(Array.isArray(base.scrapedSources)?base.scrapedSources:[]).filter(row=>row?.type!=="website");
    return {...base,website:record.url,websiteActivation:{status:"active",url:record.url,title:record.title||"",description:record.description||"",activatedAt:record.activatedAt||"",contentChars:Number(record.contentChars)||clean(record.source?.text).length},scrapedSources:[record.source,...other].slice(0,12)};
  }
  function syncActivationIntoWorkspace(){const record=readActivationRecord();const next=mergeRecordIntoState(readState(),record);writeState(next);return next;}
  async function activateWebsite(){
    if(running)return false;const url=visibleWebsite(),button=root?.document?.getElementById("activate-website");
    if(!url){setStatus("error","Enter a valid website URL first.");return false;}
    running=true;if(button){button.disabled=true;button.textContent="ACTIVATING…";}setStatus("loading","Connecting to the website and loading public company evidence…");
    try{
      const source=await scrapeWebsite(url),at=new Date().toISOString(),record=buildActivationRecord(source,at),next=buildActivatedState(readState(),source,at);
      writeActivationRecord(record);writeState(next);root.localStorage.removeItem(RESEARCH_META_KEY);
      try{root.dispatchEvent(new CustomEvent("leadintel:website-activated",{detail:{website:record.url,activation:record}}));}catch{}
      try{await root.LeadIntelServerBridge?.saveNow?.();}catch{}
      setStatus("active",`✓ Website active · ${record.title||new URL(record.url).hostname} · ${formatChars(record.contentChars)} loaded`);return true;
    }catch(error){setStatus("error",`Activation failed · ${clean(error?.message)||"Website could not be read"}`);return false;}
    finally{running=false;render();}
  }
  function guardProtectedNavigation(event){
    const target=event.target?.closest?.("#to-questionnaire,[data-step-marker],[data-process-step]");if(!target)return;
    const step=target.id==="to-questionnaire"?2:Number(target.dataset.stepMarker||target.dataset.processStep)||1;if(step<=1)return;
    if(!isCurrentWebsiteActive()){event.preventDefault();event.stopImmediatePropagation();setStatus("error","Activate your website first. LeadIntel must successfully read it before continuing.");return;}
    if(target.id==="to-questionnaire")syncActivationIntoWorkspace();
  }
  function install(){
    if(root.__leadintelWebsiteActivationInstalled)return;root.__leadintelWebsiteActivationInstalled=true;
    const bind=()=>{ensureActivationUi();const button=root.document.getElementById("activate-website"),input=root.document.getElementById("company-website");button?.addEventListener("click",activateWebsite);input?.addEventListener("input",render);input?.addEventListener("change",render);root.document.addEventListener("click",guardProtectedNavigation,true);render();};
    if(root.document.readyState==="loading")root.document.addEventListener("DOMContentLoaded",bind,{once:true});else bind();
    root.addEventListener("pageshow",render);root.addEventListener("leadintel:website-synced",render);root.addEventListener("leadintel:website-activated",render);
  }

  return {STORAGE_KEY,ACTIVATION_KEY,RESEARCH_META_KEY,normalizeUrl,getActivatedSource,isWebsiteActive,buildActivatedState,buildActivationRecord,isActivationRecordActive,activationMarkup,readActivationRecord,isCurrentWebsiteActive,ensureActivationUi,syncActivationIntoWorkspace,scrapeWebsite,activateWebsite,render,install};
});
