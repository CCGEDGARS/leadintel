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
  const DISCOVERY_META_KEY="leadintel_customer_v2_discovery_meta";
  const FIRECRAWL_PROXY="https://apollo-proxy.edgars-7e7.workers.dev";
  const RELEASE="20261102-setup-recovery-v1";
  const MAX_SOURCE_CHARS=30000;
  // Public extraction has its own bounded direct / provider / fallback chain.
  // Leave enough time for that chain; the old 25s client timer cut it off early.
  const ACTIVATION_REQUEST_TIMEOUT_MS=60000;
  const PERSISTENCE_TIMEOUT_MS=10000;
  let running=false;
  let activationError="";
  let pendingSave=null,activeOperation=null;

  function clean(value){return String(value??"").replace(/\s+/g," ").trim();}
  function normalizeUrl(value){
    const raw=clean(value);if(!raw)return "";
    if(/^[a-z][a-z\d+.-]*:/i.test(raw)&&!/^https?:\/\//i.test(raw)&&!/^[^/?#:\s]+:\d+(?:[/?#]|$)/.test(raw))return "";
    try{
      const url=new URL(/^https?:\/\//i.test(raw)?raw:`https://${raw}`);
      if(!["http:","https:"].includes(url.protocol)||!url.hostname.includes(".")||url.username||url.password)return "";
      url.hash="";return url.href;
    }catch{return "";}
  }
  function sameUrl(a,b){return Boolean(normalizeUrl(a)&&normalizeUrl(a)===normalizeUrl(b));}
  function sameCompanyWebsite(a,b){
    const left=normalizeUrl(a),right=normalizeUrl(b);if(!left||!right)return false;
    try{return new URL(left).hostname.replace(/^www\./i,"").toLowerCase()===new URL(right).hostname.replace(/^www\./i,"").toLowerCase();}catch{return false;}
  }
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
  function isSameCompanyActivation(state={},url=''){
    return sameCompanyWebsite(state.companyContextWebsite||state.websiteActivation?.url||state.profile?.website||state.website||'',url);
  }
  function buildActivatedState(state={},source={},activatedAt=new Date().toISOString()){
    const base=state&&typeof state==="object"&&!Array.isArray(state)?state:{};const websiteSource=normalizedSource(source);
    if(!websiteSource)return {...base};
    const {url,title,description,text}=websiteSource;
    // The visible website field is persisted while the customer types. It therefore
    // cannot prove which company's context is currently loaded. Compare the new
    // source with the last activated/canonical company first so changing the input
    // cannot carry answers and documents into another company's workspace.
    const sameCompany=isSameCompanyActivation(base,url);
    const isolatedContext=sameCompany?{}:{
      additionalLinks:[],
      documents:[],
      answers:{},
      answerStatus:{},
      referenceCustomers:{},
      referenceCustomerPortfolio:{}
    };
    return {
      ...base,
      setupWebsiteDraft:undefined,
      ...isolatedContext,
      step:1,
      website:url,
      companyContextWebsite:url,
      websiteActivation:{status:"active",url,title,description,activatedAt:clean(activatedAt),contentChars:text.length},
      scrapedSources:sameCompany?refreshWebsiteSources(base.scrapedSources,websiteSource):[{type:"website",url,title,text,status:"ready"}],
      profile:sameCompany?base.profile||null:null,
      approved:sameCompany?Boolean(base.approved):false,
      market:sameCompany?{...(base.market||{}),...(base.profile?{researchContextStale:true,researchContextFingerprint:'stale:website-reactivated'}:{})}:{}
    };
  }
  function refreshWebsiteSources(sources,source){
    const rows=Array.isArray(sources)?sources:[];
    let index=rows.findIndex(row=>row?.type==='website'&&sameUrl(row.url,source.url));
    // WWW/HTTPS spelling can change for the same page. A shared domain alone
    // cannot identify a page: products and project citations must stay intact.
    if(index<0)index=rows.findIndex(row=>{
      if(row?.type!=='website'||!sameCompanyWebsite(row.url,source.url))return false;
      try{const prior=new URL(normalizeUrl(row.url)),next=new URL(source.url);return prior.pathname===next.pathname&&prior.search===next.search&&prior.port===next.port;}catch{return false;}
    });
    // Preserve evidence positions: saved answer citations use S1, S2, etc.
    return index<0?[...rows,source]:rows.map((row,i)=>i===index?{...row,...source}:row);
  }
  function buildActivationRecord(source={},activatedAt=new Date().toISOString()){
    const websiteSource=normalizedSource(source);if(!websiteSource)return {status:"inactive",url:"",source:null};
    const {url,title,description,text}=websiteSource;
    return {status:"active",url,title,description,activatedAt:clean(activatedAt),contentChars:text.length,source:{type:"website",url,title,text,status:"ready"}};
  }
  function isActivationRecordActive(record={},website=""){
    const target=normalizeUrl(website);return Boolean(target&&record?.status==="active"&&sameUrl(record.url,target)&&record.source?.type==="website"&&sameUrl(record.source.url,target)&&clean(record.source.text));
  }
  function activationMarkup(){return '<button class="activate-website-btn" id="activate-website" type="button">Activate website</button><button class="secondary-btn small" id="discard-website-change" type="button" hidden>Keep current company</button><button class="secondary-btn small" id="retry-website-save" type="button" hidden>Retry workspace save</button><div class="website-activation-status" id="website-activation-status" data-state="idle" role="status" aria-live="polite">Enter your company website, then activate it.</div>';}
  function readJson(key,fallback={}){try{const parsed=JSON.parse(root.localStorage.getItem(key)||"null");return parsed&&typeof parsed==="object"&&!Array.isArray(parsed)?parsed:fallback;}catch{return fallback;}}
  function readState(){return readJson(STORAGE_KEY,{});}
  function writeState(value){root.localStorage.setItem(STORAGE_KEY,JSON.stringify(value));}
  function readActivationRecord(){
    const state=readState(),record=readJson(ACTIVATION_KEY,{}),website=normalizeUrl(state.website);
    if(isActivationRecordActive(record,record.url)&&(!website||sameCompanyWebsite(record.url,website)))return record;
    const source=getActivatedSource(state,website);if(!source)return {};
    const saved=state.websiteActivation||{};
    const explicit=saved.status==='active'&&sameUrl(saved.url,website);
    const researched=state.profile&&sameCompanyWebsite(state.profile.website,website);
    if(!explicit&&!researched)return {};
    // Recover the navigation proof only. Never rerun activation or reset research.
    return buildActivationRecord(source,saved.activatedAt||state.profile?.approvedAt||'');
  }
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
  function cancelStaleOperation(){
    if(!activeOperation?.current||activeOperation.current())return false;
    const operation=activeOperation;activeOperation=null;running=false;activationError='';operation.controller?.abort();return true;
  }
  function render(){
    cancelStaleOperation();
    if(!root?.document||!root?.localStorage)return;ensureActivationUi();
    const button=root.document.getElementById("activate-website"),website=visibleWebsite(),record=readActivationRecord();
    if(button&&!running){button.disabled=!website;button.textContent=isActivationRecordActive(record,website)?"Refresh website evidence":"Activate website";}
    const discard=root.document.getElementById('discard-website-change'),retry=root.document.getElementById('retry-website-save');
    if(discard){discard.hidden=typeof readState().setupWebsiteDraft!=='string';discard.disabled=running&&activeOperation?.kind!=='activation';}
    if(retry){retry.hidden=!pendingSave?.current();retry.disabled=running;}
    if(running)return;
    if(activationError){setStatus("error",activationError);return;}
    if(!website){setStatus("idle","Enter your company website, then activate it.");return;}
    if(isActivationRecordActive(record,website)){const label=record.title?` · ${record.title}`:"";setStatus("active",`✓ Website active${label} · ${formatChars(record.contentChars)} loaded`);return;}
    setStatus("idle",record?.status==="active"?"Website changed — activate this URL to replace the current source.":"Not activated yet — connect the website to load company evidence.");
  }
  async function scrapeWebsite(url,signal){
    const controller=new AbortController(),abort=()=>controller.abort();if(signal?.aborted)abort();else signal?.addEventListener('abort',abort,{once:true});
    const timeout=setTimeout(()=>controller.abort(),ACTIVATION_REQUEST_TIMEOUT_MS);
    try{
      const workspace=root.LeadIntelServerBridge?.workspace?.id;
      // Do not depend on a deferred optional module to rewrite a legacy URL.
      const endpoint=workspace?`/api/integrations/services/firecrawl/scrape?workspace_id=${encodeURIComponent(workspace)}`:`${FIRECRAWL_PROXY}/firecrawl-scrape`;
      const response=await root.fetch(endpoint,{method:"POST",credentials:'include',headers:{"Content-Type":"application/json"},body:JSON.stringify({url,formats:["markdown"],publicFirst:true,onlyMainContent:true,timeout:30000}),signal:controller.signal});
      const payload=await response.json().catch(()=>({}));if(!response.ok)throw new Error(payload.error||`Website returned ${response.status}`);
      const data=payload.data||payload;const text=String(data.markdown||data.content||"").replace(/\u0000/g,"").trim().slice(0,MAX_SOURCE_CHARS);
      const resolved=data.metadata?.sourceURL||data.metadata?.url||data.url||url;
      if(!sameCompanyWebsite(resolved,url))throw new Error('Website redirected outside the requested company domain. Review the website URL.');
      const status=Number(data.metadata?.statusCode)||200;
      if(payload.success===false||status<200||status>=400||(/just a moment|access denied|verify you are human|cloudflare ray id/i.test(text)&&text.length<1600))throw new Error('The website returned an error or access check instead of company evidence. Retry or check the URL.');
      if(!text)throw new Error("No readable website content was returned");
      return {url,title:data.metadata?.title||data.title||new URL(url).hostname,description:data.metadata?.description||"",text};
    }catch(error){
      if(error?.name==="AbortError"&&!signal?.aborted)throw new Error("Website activation timed out after 60 seconds. Your saved work is preserved; retry activation.");
      throw error;
    }finally{
      clearTimeout(timeout);signal?.removeEventListener('abort',abort);
    }
  }
  async function savePersistenceWithTimeout(assertCurrent){
    const persistence=root.LeadIntelWorkspacePersistence;
    const save=typeof persistence?.saveWorkspace==="function"?()=>persistence.saveWorkspace():typeof root.LeadIntelServerBridge?.saveNow==="function"?()=>root.LeadIntelServerBridge.saveNow():null;
    if(!save)return;
    let timer;
    try{
      const result=await Promise.race([
        Promise.resolve().then(()=>{assertCurrent();return save();}),
        new Promise((_,reject)=>{timer=setTimeout(()=>reject(new Error("Workspace save timed out")),PERSISTENCE_TIMEOUT_MS);})
      ]);
      if(result!==true&&result?.saved!==true)throw new Error("Workspace could not be saved");
    }catch(error){
      throw new Error(`Website evidence is loaded in this browser, but the workspace save failed: ${clean(error?.message)||"unknown save error"}. Retry Save workspace.`);
    }finally{
      clearTimeout(timer);
    }
  }
  function mergeRecordIntoState(state,record){
    if(!isActivationRecordActive(record,record?.url))return state;
    const base=state&&typeof state==="object"&&!Array.isArray(state)?state:{};const other=(Array.isArray(base.scrapedSources)?base.scrapedSources:[]).filter(row=>row?.type!=="website");
    return {...base,website:record.url,websiteActivation:{status:"active",url:record.url,title:record.title||"",description:record.description||"",activatedAt:record.activatedAt||"",contentChars:Number(record.contentChars)||clean(record.source?.text).length},scrapedSources:refreshWebsiteSources(base.scrapedSources,record.source)};
  }
  function syncActivationIntoWorkspace(){const record=readActivationRecord();const next=mergeRecordIntoState(readState(),record);writeState(next);return next;}
  function clearDerivedWorkspaceData(){
    if(root?.localStorage?.removeItem)root.localStorage.removeItem(DISCOVERY_META_KEY);
    const helper=root?.LeadIntelWorkspaceIsolation;
    if(helper?.clearDerivedWorkspaceData)return helper.clearDerivedWorkspaceData(root.localStorage);
    const keys=[DISCOVERY_META_KEY,"leadintel_customer_v2_discovery","leadintel_customer_v2_outreach","leadintel_customer_v2_delivery",RESEARCH_META_KEY,"leadintel_customer_v2_market_research_resume","leadintel_customer_v2_server_dirty"];
    let removed=0;
    for(const key of keys){if(root.localStorage.getItem(key)!==null){root.localStorage.removeItem(key);removed++;}}
    return removed;
  }
  function returnToWebsiteStep(){
    const current=readState();if(Number(current.step)!==1)writeState({...current,step:1});
    const marker=root?.document?.querySelector?.('[data-step-marker="1"]');
    if(marker&&root?.MouseEvent){marker.dispatchEvent(new root.MouseEvent("click",{bubbles:true}));return true;}
    root?.document?.querySelectorAll?.(".step-view").forEach(el=>el.classList.toggle("active",Number(el.dataset.step)===1));
    root?.document?.querySelectorAll?.("[data-step-marker]").forEach(el=>{const step=Number(el.dataset.stepMarker);el.classList.toggle("active",step===1);el.classList.toggle("complete",false);});
    return false;
  }
  async function activateWebsite(){
    if(running)return false;const url=visibleWebsite(),button=root?.document?.getElementById("activate-website");
    if(!url){activationError="Enter a valid website URL first.";setStatus("error",activationError);return false;}
    if(root.LeadIntelServerBridge?.conflict||root.LeadIntelServerBridge?.resolvingSync){activationError="Resolve the workspace synchronization conflict before activating a website.";setStatus("error",activationError);return false;}
    if(root.LeadIntelServerBridge?.ready===false){activationError="Workspace is still loading. Wait for it to finish, then activate the website again.";setStatus("error",activationError);return false;}
    const bridge=root.LeadIntelServerBridge,cache=root.LeadIntelAccountCache,role=bridge?.workspace?.role;
    const accountContext=root.localStorage.getItem('leadintel_account_context_v1');
    const workspaceId=root.LeadIntelServerBridge?.workspace?.id||'';
    const session=()=>JSON.stringify([root.LeadIntelServerBridge?.session?.authenticated,root.LeadIntelServerBridge?.session?.user?.id]);
    const accountSession=session();
    const operation=root.LeadIntelSetupTrace?.begin('website_activation');
    const scopeCurrent=()=>root.LeadIntelServerBridge===bridge&&root.LeadIntelAccountCache===cache&&root.LeadIntelServerBridge?.workspace?.role===role&&sameUrl(visibleWebsite(),url)&&accountContext===root.localStorage.getItem('leadintel_account_context_v1')&&workspaceId===(root.LeadIntelServerBridge?.workspace?.id||'')&&accountSession===session()&&root.LeadIntelServerBridge?.ready!==false&&!root.LeadIntelServerBridge?.conflict&&!root.LeadIntelServerBridge?.resolvingSync&&(!root.LeadIntelAccountCache||root.LeadIntelAccountCache.current());
    const owner={kind:'activation',controller:new AbortController()};activeOperation=owner;const contextCurrent=()=>activeOperation===owner&&scopeCurrent();owner.current=contextCurrent;
    const assertCurrent=()=>{if(!contextCurrent())throw new Error('Workspace or website changed while loading. Your saved work was preserved; activate the current website again.');};
    activationError="";running=true;if(button){button.disabled=true;button.textContent="Activating…";}setStatus("loading","Connecting to the website and loading public company evidence…");
    try{
      assertCurrent();
      operation?.checkpoint('request','pending');
      const source=await scrapeWebsite(url,owner.controller.signal);
      // A response for the previous URL/account must never clear the current workspace.
      assertCurrent();
      operation?.checkpoint('response','pass');
      const current=readState(),sameCompany=isSameCompanyActivation(current,source.url);
      const at=new Date().toISOString(),record=buildActivationRecord(source,at),next=buildActivatedState(current,source,at);
      if(!sameCompany)clearDerivedWorkspaceData();
      writeActivationRecord(record);writeState(next);
      try{
        const detail={website:record.url,activation:record,evidenceRefreshedAt:at};
        if(sameCompany){
          // website-activated listeners deliberately delete old-company records.
          // Refresh uses the non-destructive state hydration and autosave events.
          root.dispatchEvent(new CustomEvent('leadintel:company-research-updated',{detail:{...detail,evidenceRefreshed:true}}));
          root.dispatchEvent(new CustomEvent('leadintel:website-synced',{detail}));
          root.dispatchEvent(new CustomEvent('leadintel:workspace-dirty',{detail:{source:'website-evidence-refresh'}}));
        }else root.dispatchEvent(new CustomEvent("leadintel:website-activated",{detail}));
      }catch{}
      assertCurrent();
      returnToWebsiteStep();
      const savedCurrent=()=>scopeCurrent()&&readState().website===record.url&&getActivatedSource(readState(),record.url)?.text===record.source.text;
      pendingSave={current:savedCurrent,assertCurrent:()=>{if(!savedCurrent())throw Error('Workspace or website evidence changed. Review the current website before saving.');}};
      operation?.checkpoint('persistence','pending');
      await savePersistenceWithTimeout(assertCurrent);
      assertCurrent();
      operation?.checkpoint('persistence','pass');operation?.finish('pass');
      pendingSave=null;activationError="";setStatus("active",`✓ Website active · ${record.title||new URL(record.url).hostname} · ${formatChars(record.contentChars)} loaded`);return true;
    }catch(error){operation?.finish(contextCurrent()?'fail':'stale');if(!contextCurrent())return false;activationError=`Activation failed · ${clean(error?.message)||"Website could not be read"}`;setStatus("error",activationError);return false;}
    finally{if(activeOperation===owner){activeOperation=null;running=false;render();}}
  }
  function discardWebsiteChange(){
    if(running&&activeOperation?.kind!=='activation'||root.LeadIntelServerBridge?.ready===false||root.LeadIntelServerBridge?.conflict||root.LeadIntelServerBridge?.resolvingSync||root.LeadIntelAccountCache&&!root.LeadIntelAccountCache.current())return false;
    const state=readState();if(typeof state.setupWebsiteDraft!=='string')return false;if(activeOperation){const operation=activeOperation;activeOperation=null;running=false;operation.controller?.abort();}delete state.setupWebsiteDraft;writeState(state);
    const input=root.document.getElementById('company-website');if(input)input.value=normalizeUrl(state.website).replace(/^https?:\/\//i,'').replace(/\/$/,'');
    activationError='';root.dispatchEvent(new CustomEvent('leadintel:website-draft-discarded'));render();return true;
  }
  async function retryWebsiteSave(){
    const saved=pendingSave;if(running||!saved?.current())return false;const owner={kind:'save',current:saved.current};activeOperation=owner;running=true;setStatus('loading','Saving the website evidence already loaded in this browser…');render();
    try{await savePersistenceWithTimeout(saved.assertCurrent);saved.assertCurrent();pendingSave=null;activationError='';return true;}
    catch(error){if(saved.current())activationError=clean(error.message);return false;}
    finally{if(activeOperation===owner){activeOperation=null;running=false;render();}}
  }
  function guardProtectedNavigation(event){
    // Message shortcuts validate the saved recipient and workspace themselves.
    // They are actions nested inside a stage marker, not entry into Setup.
    if(event.target?.closest?.('.steps [data-workflow-stage="6"] [data-message-channel]'))return;
    const target=event.target?.closest?.("#to-questionnaire,[data-step-marker],[data-process-step]");if(!target)return;
    const step=target.id==="to-questionnaire"?2:Number(target.dataset.stepMarker||target.dataset.processStep)||1;if(step<=1)return;
    if(!isCurrentWebsiteActive()){event.preventDefault();event.stopImmediatePropagation();setStatus("error","Activate your website first. LeadIntel must successfully read it before continuing.");return;}
    if(target.id==="to-questionnaire")syncActivationIntoWorkspace();
  }
  function clearErrorAndRender(){activationError="";render();}
  function install(){
    if(root.__leadintelWebsiteActivationInstalled)return;root.__leadintelWebsiteActivationInstalled=true;
    const bind=()=>{ensureActivationUi();const button=root.document.getElementById("activate-website"),input=root.document.getElementById("company-website");button?.addEventListener("click",activateWebsite);root.document.getElementById('retry-website-save')?.addEventListener('click',retryWebsiteSave);root.document.getElementById('discard-website-change')?.addEventListener('click',discardWebsiteChange);input?.addEventListener("input",clearErrorAndRender);input?.addEventListener("change",clearErrorAndRender);root.document.addEventListener("click",guardProtectedNavigation,true);render();};
    if(root.document.readyState==="loading")root.document.addEventListener("DOMContentLoaded",bind,{once:true});else bind();
    root.addEventListener("leadintel:server-conflict",render);root.addEventListener("leadintel:sync-status-changed",render);root.addEventListener("leadintel:server-ready",render);root.addEventListener("leadintel:workspace-changed",render);root.addEventListener("pageshow",render);root.addEventListener("leadintel:website-synced",clearErrorAndRender);root.addEventListener("leadintel:website-activated",render);
  }

  return {STORAGE_KEY,ACTIVATION_KEY,RESEARCH_META_KEY,DISCOVERY_META_KEY,normalizeUrl,getActivatedSource,isWebsiteActive,buildActivatedState,buildActivationRecord,isActivationRecordActive,activationMarkup,readActivationRecord,isCurrentWebsiteActive,ensureActivationUi,syncActivationIntoWorkspace,clearDerivedWorkspaceData,returnToWebsiteStep,scrapeWebsite,activateWebsite,retryWebsiteSave,discardWebsiteChange,render,install};
});
