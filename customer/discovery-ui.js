const MAIN_STORAGE_KEY="leadintel_customer_v2_state";
const DISCOVERY_STORAGE_KEY="leadintel_customer_v2_discovery";
const OUTREACH_STORAGE_KEY="leadintel_customer_v2_outreach";
const DELIVERY_STORAGE_KEY="leadintel_customer_v2_delivery";
const DISCOVERY_META_KEY="leadintel_customer_v2_discovery_meta";
const INTELLIGENCE_PROXY="https://apollo-proxy.edgars-7e7.workers.dev";
const LEADINTEL_API="https://leadintel-api.edgars-7e7.workers.dev";
const MAX_DISCOVERY_QUERIES=10;
const MAX_DISCOVERY_RESULTS_PER_QUERY=5;
const DISCOVERY_SEARCH_CONCURRENCY=4;
const MAX_DISCOVERY_FOLLOW_UP_QUERIES=4;
const MAX_DISCOVERY_COMPANY_CHECKS=20;
const ASSET_VERSION="20260925-firecrawl-health-warning-v1";
const LANGUAGE_ASSET_VERSION="20260924-workspace-content-english-v1";
const OUTREACH_ASSET_VERSION="20260925-buyers-stage-view-v1";
const asset=path=>`${path}?v=${ASSET_VERSION}`;
const $=id=>document.getElementById(id);
let recoveredInterruptedRun=false;
let discovery=null;
let discoveryMounted=false;
let crmCompanies=[];
let crmPipeline=[];
let crmAvailable=false;
let crmRefreshing=false;
let discoveryProgress={phase:"idle",completed:0,total:0};
let activeDiscoveryTaskId="";
let discoveryEvidenceUrls=new Set();
let discoveryCheckedCompanyDomains=new Set();
const enrichmentResults=new Map();
const enrichmentPending=new Set();
function contentLanguage(){return window.LeadIntelContentLanguage?.workspaceContentLanguage?.()||'en';}

function esc(value){return String(value??"").replace(/[&<>'"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;","'":"&#39;",'"':"&quot;"}[c]));}
function mainState(){try{return JSON.parse(localStorage.getItem(MAIN_STORAGE_KEY)||"{}");}catch{return {};}}
function bridge(){return window.LeadIntelServerBridge||null;}
function crmAuthenticated(){const b=bridge();return Boolean(b?.session?.authenticated&&b?.workspace);}
function persistMainStep(step){if(window.LeadIntelCustomerNavigation?.setStep){window.LeadIntelCustomerNavigation.setStep(step);return;}const main=mainState();main.step=step;localStorage.setItem(MAIN_STORAGE_KEY,JSON.stringify(main));}
function loadDiscovery(){try{const normalized=LeadIntelDiscovery.normalizeDiscoveryState(JSON.parse(localStorage.getItem(DISCOVERY_STORAGE_KEY)||"{}"));const recovered=LeadIntelDiscovery.recoverInterruptedDiscoveryState?LeadIntelDiscovery.recoverInterruptedDiscoveryState(normalized):normalized;recoveredInterruptedRun=normalized.status==="running"&&recovered.status!=="running";return recovered;}catch{return LeadIntelDiscovery.normalizeDiscoveryState({});}}
function saveDiscovery(){localStorage.setItem(DISCOVERY_STORAGE_KEY,JSON.stringify(discovery));window.LeadIntelJourney?.refresh?.();}
function moduleReady(){const main=mainState();return Boolean(main?.profile?.website||main?.website);}
function showToast(message){const toast=$("toast");if(!toast)return;toast.textContent=message;toast.classList.add("show");clearTimeout(showToast.t);showToast.t=setTimeout(()=>toast.classList.remove("show"),3000);}
function fingerprint(){const main=mainState();const market=main.market||{};return JSON.stringify({company:main.profile?.companyName||"",website:main.profile?.website||main.website||"",approved:market.strategyApprovedAt||"",icps:(market.icps||[]).filter(x=>x.active!==false).map(x=>[x.id,x.description,x.targetMarkets]),signals:(market.signals||[]).filter(x=>x.active!==false).map(x=>[x.id,x.weight,x.keywords]),opps:(market.opportunities||[]).filter(x=>x.active!==false).map(x=>[x.id,x.market,x.score?.total])});}
function loadMeta(){try{return JSON.parse(localStorage.getItem(`${DISCOVERY_STORAGE_KEY}_meta`)||"{}" );}catch{return {};}}
function saveMeta(meta){localStorage.setItem(`${DISCOVERY_STORAGE_KEY}_meta`,JSON.stringify(meta));}
const DEFAULT_DISCOVERY_TARGET=10;
const MAX_DISCOVERY_TARGET=50;
function normalizedDiscoveryTarget(value,fallback=DEFAULT_DISCOVERY_TARGET){const raw=String(value??"").trim();if(!raw)return fallback;const target=Math.round(Number(raw));return Number.isFinite(target)?Math.max(1,Math.min(MAX_DISCOVERY_TARGET,target)):fallback;}
function selectedDiscoveryTarget(){const control=$("discovery-target-count");const custom=$("discovery-target-custom");const meta=loadMeta();if(control?.value==="custom")return normalizedDiscoveryTarget(custom?.value,normalizedDiscoveryTarget(meta.targetCount,DEFAULT_DISCOVERY_TARGET));return normalizedDiscoveryTarget(control?.value||meta.targetCount,DEFAULT_DISCOVERY_TARGET);}
function persistDiscoveryTarget(){const control=$("discovery-target-count");const target=selectedDiscoveryTarget();saveMeta({...loadMeta(),targetCount:target,targetMode:control?.value==="custom"?"custom":"preset"});return target;}
function resetLocalDownstreamState(){
  discovery=LeadIntelDiscovery.normalizeDiscoveryState({});
  enrichmentResults.clear();enrichmentPending.clear();
  localStorage.removeItem(DISCOVERY_STORAGE_KEY);
  localStorage.removeItem(OUTREACH_STORAGE_KEY);
  localStorage.removeItem(DELIVERY_STORAGE_KEY);
  localStorage.removeItem(DISCOVERY_META_KEY);
}
function syncStrategyFingerprint(){
  const main=mainState();
  const reconciliation=window.LeadIntelWorkspaceIsolation?.reconcileLocalWorkspace?.(localStorage,main);
  if(reconciliation?.cleared)resetLocalDownstreamState();
  const meta=loadMeta();
  const current=fingerprint();
  const currentWebsite=window.LeadIntelWorkspaceIsolation?.websiteFromMain?.(main)||canonicalDomain(main.website||main.profile?.website||"");
  const metaWebsite=window.LeadIntelWorkspaceIsolation?.websiteFromMeta?.(meta)||canonicalDomain(meta.website||"");
  const hasPipeline=Array.isArray(discovery.pipeline)&&discovery.pipeline.length>0;
  const websiteChanged=Boolean(currentWebsite&&metaWebsite&&currentWebsite!==metaWebsite);
  const legacyPipeline=Boolean(hasPipeline&&!metaWebsite);
  const pipelineScopeNeedsReset=window.LeadIntelWorkspaceIsolation?.pipelineScopeNeedsReset?.(currentWebsite,meta,hasPipeline)
    ?? Boolean(hasPipeline&&currentWebsite&&(!canonicalDomain(meta.pipelineWebsite)||canonicalDomain(meta.pipelineWebsite)!==currentWebsite));
  if(websiteChanged||legacyPipeline||pipelineScopeNeedsReset){
    resetLocalDownstreamState();
    saveDiscovery();
    showToast("New customer workspace · previous discovery results were cleared");
  }else if(meta.fingerprint&&meta.fingerprint!==current){
    discovery=LeadIntelDiscovery.normalizeDiscoveryState({pipeline:discovery.pipeline});
    enrichmentResults.clear();enrichmentPending.clear();saveDiscovery();
    showToast("Strategy changed · company matches were refreshed");
  }
  saveMeta({...loadMeta(),fingerprint:current,website:currentWebsite,pipelineWebsite:currentWebsite});
}
function canonicalDomain(value){return window.LeadIntelCrm?.canonicalDomain(value)||LeadIntelDiscovery.canonicalDomain(value);}
function crmCompanyByDomain(value){const domain=canonicalDomain(value);return crmCompanies.find(company=>canonicalDomain(company.normalized_domain||company.website)===domain)||null;}
function personKey(candidate,person){return `${canonicalDomain(candidate?.domain||candidate?.website)}|${String(person?.id||"")}`;}
function crmToLocalPipeline(company){const domain=canonicalDomain(company.normalized_domain||company.website);const existing=discovery.pipeline.find(item=>canonicalDomain(item.domain||item.website)===domain);return {...(existing||{}),id:existing?.id||company.id,crmId:company.id,company:company.company_name||existing?.company||domain,domain,website:company.website||existing?.website||(domain?`https://${domain}/`:""),score:existing?.score||{total:Number(company.opportunity_score)||0},confidence:company.confidence||existing?.confidence||"",matchedSignals:existing?.matchedSignals||[],evidence:existing?.evidence||[],people:existing?.people||[],stage:window.LeadIntelCrm?.normalizeCrmStage(company.pipeline_stage)||"Discovered",savedAt:existing?.savedAt||company.created_at||new Date().toISOString(),updatedAt:company.updated_at||new Date().toISOString()};}
function currentWorkspaceCrmPipeline(){
  const helper=window.LeadIntelWorkspaceIsolation;
  if(helper?.filterPipelineForWorkspace)return helper.filterPipelineForWorkspace(crmPipeline,discovery.pipeline);
  const domains=new Set((Array.isArray(discovery.pipeline)?discovery.pipeline:[]).map(item=>canonicalDomain(item.domain||item.website)).filter(Boolean));
  return crmPipeline.filter(company=>domains.has(canonicalDomain(company.normalized_domain||company.website)));
}
function hydrateLocalPipelineFromCrm(){if(!crmAvailable)return;const scoped=currentWorkspaceCrmPipeline();discovery.pipeline=LeadIntelDiscovery.normalizeDiscoveryState({pipeline:scoped.map(crmToLocalPipeline)}).pipeline;for(const candidate of discovery.candidates)candidate.saved=Boolean(scoped.some(company=>canonicalDomain(company.normalized_domain||company.website)===canonicalDomain(candidate.domain||candidate.website)));saveDiscovery();}
async function refreshCrmState({render=true}={}){if(!discoveryMounted||crmRefreshing)return false;if(!crmAuthenticated()){crmAvailable=false;crmCompanies=[];crmPipeline=[];if(render)renderAll();return false;}const b=bridge();crmRefreshing=true;try{const [allResult,pipelineResult]=await Promise.all([b.listCrmCompanies({limit:100}),b.listCrmCompanies({pipeline_stage:"active",limit:100})]);if(!allResult.ok||!pipelineResult.ok){crmAvailable=false;if(render)renderAll();return false;}crmAvailable=true;crmCompanies=Array.isArray(allResult.companies)?allResult.companies:[];crmPipeline=Array.isArray(pipelineResult.companies)?pipelineResult.companies:[];hydrateLocalPipelineFromCrm();if(render)renderAll();return true;}finally{crmRefreshing=false;}}

function injectDiscoveryUI(){
  if(!document.querySelector('link[data-leadintel-asset="discovery-css"]')){const link=document.createElement("link");link.rel="stylesheet";link.href=asset("discovery.css");link.dataset.leadintelAsset="discovery-css";document.head.appendChild(link);}
  $("continue-to-discovery")?.remove();
  const content=document.querySelector("main.content");if(content&&!$("step-5"))content.insertAdjacentHTML("beforeend",`<section class="step-view" id="step-5" data-step="5">
    <div class="profile-header discovery-header"><div><span class="eyebrow" id="discovery-stage-kicker">Step 4 · Companies</span><h1 id="discovery-stage-title">Find companies that fit your strategy.</h1><p id="discovery-stage-description">LeadIntel searches the selected markets, checks public evidence, verifies company websites and ranks each match against your approved strategy.</p></div><div class="profile-header-actions"><span class="profile-status" id="discovery-status">Ready</span><button class="secondary-btn small" id="back-to-strategy" type="button">← Strategy</button></div></div>
    <div class="strategy-banner discovery-banner"><div><span>Company</span><strong id="discovery-company">—</strong></div><div><span>Market context</span><strong id="discovery-markets">—</strong></div><div><span>Active pipeline</span><strong id="discovery-pipeline-count">0</strong></div></div>
    <section class="panel strategy-panel discovery-panel"><div class="market-research-head"><div class="section-title"><span class="eyebrow">Discovery Engine</span><h3>Search for real company domains</h3><p>Start with 10 companies, or choose a larger or custom target.</p></div><div class="discovery-controls"><div class="discovery-target-control"><label class="discovery-target-label" for="discovery-target-count">Choose amount</label><div class="discovery-control-row"><select id="discovery-target-count" aria-describedby="discovery-target-help"><option value="10">10 companies</option><option value="25">25 companies</option><option value="50">50 companies</option><option value="custom">Custom number</option></select><button class="primary-btn discovery-run-btn" id="run-company-discovery" type="button">Find companies <span>→</span></button></div><input class="discovery-target-custom" id="discovery-target-custom" type="number" min="1" max="50" step="1" inputmode="numeric" placeholder="Enter number" aria-label="Custom companies to find" hidden><small id="discovery-target-help">Start with 10. Custom targets: 1–50 companies.</small></div></div></div>
      <div class="score-legend company-score-legend"><strong>Opportunity score</strong><span>Fit</span><span>Signal</span><span>Evidence</span><span>Timing</span><span>Value</span></div>
      <div class="discovery-funnel" id="discovery-funnel" aria-live="polite" hidden></div>
      <div class="research-status" id="company-discovery-status">Your company and market context are ready. Find and review matching companies to begin.</div><div class="company-candidates" id="company-candidates"></div><section class="potential-matches" id="discovery-potential-matches" aria-labelledby="potential-matches-title" hidden></section></section>
    <section class="buyers-focus-guide" id="discovery-buyers-guide" hidden aria-labelledby="discovery-buyers-title"><span class="eyebrow">Step 5 · Buyers</span><h3 id="discovery-buyers-title">Find the people who own the decision.</h3><p id="discovery-buyers-description">Choose a saved company below and select <strong>Find buyers</strong>. Review the suggested decision-makers before moving to Messages.</p></section>
    <section class="panel strategy-panel pipeline-panel" hidden><div class="section-title"><span class="eyebrow" id="pipeline-stage-kicker">Saved companies</span><h3 id="pipeline-stage-title">Companies selected for follow-up</h3><p id="pipeline-stage-description">Save a good match here, identify its buyers, then prepare a relevant message.</p></div><div class="customer-pipeline" id="customer-pipeline"></div></section>
  </section>`);
}
function renderDiscoveryFocus(focus){const buyers=focus==='buyers';const kicker=$("discovery-stage-kicker"),title=$("discovery-stage-title"),description=$("discovery-stage-description"),guide=$("discovery-buyers-guide"),discoveryPanel=document.querySelector("#step-5 .discovery-panel"),pipelineKicker=$("pipeline-stage-kicker"),pipelineTitle=$("pipeline-stage-title"),pipelineDescription=$("pipeline-stage-description"),back=$("back-to-strategy");if(kicker)kicker.textContent=buyers?"Step 5 · Buyers":"Step 4 · Companies";if(title)title.textContent=buyers?"Find the buyers behind each company.":"Find companies that fit your strategy.";if(description)description.textContent=buyers?"Review your saved companies, identify relevant buyer roles and verify business contact details before writing to them.":"LeadIntel searches the selected markets, verifies company websites and ranks matches against your approved strategy.";if(discoveryPanel)discoveryPanel.hidden=buyers;if(guide)guide.hidden=!buyers;if(pipelineKicker)pipelineKicker.textContent=buyers?"Step 5 · Buyers":"Saved companies";if(pipelineTitle)pipelineTitle.textContent=buyers?"Find decision-makers at saved companies":"Companies selected for follow-up";if(pipelineDescription)pipelineDescription.textContent=buyers?"Select Find buyers to search for relevant roles, then review the results before continuing to Messages.":"Save a good match here, identify its buyers, then prepare a relevant message.";if(back)back.textContent=buyers?"← Companies":"← Strategy";}
function setJourneyFocus(focus,{scroll=true}={}){const normalized=focus==='buyers'?'buyers':'companies';saveMeta({...loadMeta(),activeJourneyStage:normalized==='buyers'?5:4,visibleStep:5});renderDiscoveryFocus(normalized);window.LeadIntelJourney?.refresh?.();if(scroll){const target=normalized==='buyers'?(pipelineRows().length?document.querySelector(".pipeline-panel")||$("discovery-buyers-guide") :$("discovery-buyers-guide")) :$("run-company-discovery");target?.scrollIntoView?.({behavior:"smooth",block:"center"});}return normalized;}
function showDiscoveryStep(focus="companies"){if(!moduleReady()){showToast("Add your company website first");return;}ensureDiscoveryMounted();const normalized=focus==='buyers'?'buyers':'companies';setJourneyFocus(normalized,{scroll:false});syncStrategyFingerprint();persistMainStep(5);renderAll();renderDiscoveryFocus(normalized);if(crmAuthenticated())refreshCrmState();if(normalized==='buyers')setTimeout(()=>setJourneyFocus('buyers'),0);else window.scrollTo({top:0,behavior:"smooth"});}
function showStrategyStep(){persistMainStep(4);document.querySelectorAll(".step-view").forEach(el=>el.classList.toggle("active",Number(el.dataset.step)===4));document.querySelectorAll("[data-step-marker]").forEach(el=>{const n=Number(el.dataset.stepMarker);el.classList.toggle("active",n===4);el.classList.toggle("complete",n<4);});saveMeta({...loadMeta(),visibleStep:4});window.scrollTo({top:0,behavior:"smooth"});}
function reviewMarketResearch(){showStrategyStep();window.dispatchEvent(new CustomEvent("leadintel:review-market-research"));}
function companyExtractionMiss(){return Boolean(discovery?.rawResults?.length&&Number(discovery?.funnel?.companiesIdentified)===0);}
function reviewDiscoveryGuidance(){if(companyExtractionMiss()){if(discovery?.extraction?.status==="fallback")document.getElementById("open-settings")?.click();else reviewMarketResearch();return;}if(mainState()?.market?.researchMode==="quick"){reviewMarketResearch();return;}showStrategyStep();}

const DISCOVERY_REQUEST_TIMEOUT_MS=25000;
const COMPANY_EXTRACTION_TIMEOUT_MS=47000;
const DISCOVERY_RUN_TIMEOUT_MIN_MS=120000;
const DISCOVERY_RUN_TIMEOUT_MARGIN_MS=20000;
const DISCOVERY_PROVIDER_RETRIES=1;
const DISCOVERY_RETRY_DELAY_MS=150;
function linkedAbortController(parentSignal){const controller=new AbortController();if(parentSignal?.aborted)controller.abort(parentSignal.reason);else parentSignal?.addEventListener?.("abort",()=>controller.abort(parentSignal.reason),{once:true});return controller;}
// Budget search waves and up to two bounded extraction calls (OpenAI plus Gemini fallback).
function discoveryRunTimeoutMs(targetCount,queryCount){const entityQueries=Math.max(1,Math.min(MAX_DISCOVERY_COMPANY_CHECKS,(Number(targetCount)||10)*2));const marketWaves=Math.ceil((Math.max(1,Number(queryCount)||4)+MAX_DISCOVERY_FOLLOW_UP_QUERIES)/DISCOVERY_SEARCH_CONCURRENCY);const entityWaves=Math.ceil(entityQueries/DISCOVERY_SEARCH_CONCURRENCY);const requestWaves=marketWaves+(entityWaves*2);const extractionCalls=2;return Math.max(DISCOVERY_RUN_TIMEOUT_MIN_MS,requestWaves*DISCOVERY_REQUEST_TIMEOUT_MS+extractionCalls*COMPANY_EXTRACTION_TIMEOUT_MS+DISCOVERY_RUN_TIMEOUT_MARGIN_MS);}
function throwIfDiscoveryRunAborted(signal){if(!signal?.aborted)return;const reason=signal.reason;if(reason instanceof Error)throw reason;const error=new Error("Company discovery was canceled");error.name="AbortError";throw error;}
function discoveryFailureReason(error={}){const status=Number(error?.status)||0;if(error?.code==="DISCOVERY_SEARCH_TIMEOUT"||error?.name==="AbortError"||status===408)return "timeout";if(status===429)return "rate_limit";if(status===402)return "quota_exhausted";if(status>=500)return "provider_unavailable";if(status===401||status===403)return "auth_error";if(status>=400)return "request_rejected";if(error?.name==="TypeError")return "network_error";return "unknown_error";}
function discoveryFailureLabel(failure={}){const status=Number(failure.status)||0;if(status===402)return "Firecrawl credits or billing limit reached (HTTP 402)";switch(failure.reason){case "timeout":return "Search provider timed out";case "rate_limit":return "Search provider rate limit reached";case "provider_unavailable":return `Search provider unavailable${status?` (HTTP ${status})`:""}`;case "network_error":return "Could not connect to the search provider";case "auth_error":return `Search provider authorization failed${status?` (HTTP ${status})`:""}`;case "request_rejected":return `Search provider rejected the request${status?` (HTTP ${status})`:""}`;default:return "Search provider returned an unexpected error";}}
function discoverySearchFailure(error,queryMeta={},phase="searching"){const reason=discoveryFailureReason(error);return {id:`${phase}:${queryMeta.id||queryMeta.domain||"search"}`,phase,queryMeta,company:queryMeta.company||"",domain:queryMeta.domain||"",reason,status:Number(error?.status)||(reason==="timeout"?408:0)};}
function waitForDiscoveryRetry(signal){return new Promise(resolve=>{const finish=()=>{clearTimeout(timer);signal?.removeEventListener?.("abort",finish);resolve();};const timer=setTimeout(finish,DISCOVERY_RETRY_DELAY_MS);signal?.addEventListener?.("abort",finish,{once:true});});}
function retryableDiscoveryFailure(error){const reason=discoveryFailureReason(error);return ["timeout","rate_limit","provider_unavailable","network_error"].includes(reason);}
async function openAiCompanySearch(queryMeta,runSignal){
  const b=bridge(),workspace=b?.workspace;
  if(!b?.session?.authenticated||!workspace?.id)return [];
  const controller=linkedAbortController(runSignal);
  const timeout=setTimeout(()=>controller.abort(),DISCOVERY_REQUEST_TIMEOUT_MS);
  try{
    const response=await fetch(`${LEADINTEL_API}/api/ai/web-search?workspace_id=${encodeURIComponent(workspace.id)}`,{method:"POST",credentials:"include",headers:{"Content-Type":"application/json",Accept:"application/json"},body:JSON.stringify({query:queryMeta.query,max_results:MAX_DISCOVERY_RESULTS_PER_QUERY}),signal:controller.signal});
    if(!response.ok)return [];
    const payload=await response.json().catch(()=>({}));
    return LeadIntelDiscovery.normalizeCompanySearchResults({results:payload.results},queryMeta);
  }catch{return [];}
  finally{clearTimeout(timeout);}
}
async function firecrawlCompanySearch(queryMeta,runSignal){
  let lastError=null;
  for(let attempt=0;attempt<=DISCOVERY_PROVIDER_RETRIES;attempt++){
    if(runSignal?.aborted)throwIfDiscoveryRunAborted(runSignal);
    const controller=linkedAbortController(runSignal);
    const timeout=setTimeout(()=>controller.abort(),DISCOVERY_REQUEST_TIMEOUT_MS);
    try{
      const response=await fetch(`${INTELLIGENCE_PROXY}/firecrawl-search`,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({query:queryMeta.query,limit:MAX_DISCOVERY_RESULTS_PER_QUERY,scrapeOptions:{formats:["markdown"],onlyMainContent:true}}),signal:controller.signal});
      const payload=await response.json().catch(()=>({}));
      if(!response.ok){const error=new Error("Company search provider request failed");error.status=response.status;throw error;}
      return LeadIntelDiscovery.normalizeCompanySearchResults(payload,queryMeta);
    }catch(error){
      if(runSignal?.aborted)throw error;
      lastError=error;
      if(error?.name==="AbortError"){lastError=new Error("Company search timed out");lastError.name="TimeoutError";lastError.code="DISCOVERY_SEARCH_TIMEOUT";lastError.status=408;}
      if(lastError.status===402){
        const fallback=await openAiCompanySearch(queryMeta,runSignal);
        if(runSignal?.aborted)throwIfDiscoveryRunAborted(runSignal);
        if(fallback.length){discovery.funnel.openAiFallbackSearches=(Number(discovery.funnel.openAiFallbackSearches)||0)+1;return fallback;}
      }
      if(attempt>=DISCOVERY_PROVIDER_RETRIES||!retryableDiscoveryFailure(lastError))throw lastError;
    }finally{
      clearTimeout(timeout);
    }
    await waitForDiscoveryRetry(runSignal);
  }
  throw lastError||new Error("Company search failed");
}
async function runDiscoverySearchBatch(items,phase,runSignal,searches=Array(items.length).fill(null),{retryOnly=false}={}){
  discoveryProgress={phase,completed:0,total:items.length};window.LeadIntelTaskCentre?.update(activeDiscoveryTaskId,{stage:phase==="resolving"?"Resolving official company domains":phase==="verifying"?"Verifying company websites":"Searching market evidence",completed:0,total:Math.max(items.length,1),resultCount:discovery.latestRunCandidateCount});renderDiscoverySafely();
  let nextIndex=0;
  const workers=Array.from({length:Math.min(DISCOVERY_SEARCH_CONCURRENCY,items.length)},async()=>{
    while(nextIndex<items.length){
      if(runSignal?.aborted)break;
      const index=nextIndex++;
      try{if(runSignal?.aborted)throw new Error("Company search timed out");searches[index]={results:await firecrawlCompanySearch(items[index],runSignal),error:null,phase,queryMeta:items[index]};}
      catch(error){searches[index]={results:[],error,phase,queryMeta:items[index]};}
      finally{if(!runSignal?.aborted){
        const completed=searches[index];
        for(const result of completed?.results||[]){if(result.url)discoveryEvidenceUrls.add(result.url);}
        discovery.funnel.evidencePages=discoveryEvidenceUrls.size;
        if(!retryOnly&&(phase==="searching"||phase==="following")){discovery.funnel.marketSearchesCompleted+=1;}
        else if(phase==="verifying"&&!completed?.error){if(items[index].domain)discoveryCheckedCompanyDomains.add(items[index].domain);discovery.checkedCompanyDomains=[...discoveryCheckedCompanyDomains];discovery.funnel.companySitesChecked=discoveryCheckedCompanyDomains.size;}
        discoveryProgress.completed+=1;window.LeadIntelTaskCentre?.update(activeDiscoveryTaskId,{completed:discoveryProgress.completed,total:Math.max(discoveryProgress.total,1),resultCount:discovery.latestRunCandidateCount});renderDiscoverySafely();
      }}
    }
  });
  await Promise.all(workers);
  throwIfDiscoveryRunAborted(runSignal);
  return searches;
}
function setCompanyExtraction(status,method,message){
  discovery.extraction={status,method,message};
  renderDiscoverySafely();
}
function failedDiscoverySearches(groups=[]){return groups.flatMap(group=>(group.rows||[]).flatMap((row,index)=>row?.error?[discoverySearchFailure(row.error,row.queryMeta||group.queries?.[index]||{},group.phase)]:[]));}
async function extractCompaniesFromEvidence(evidence,market,targetCount,runSignal){
  const fallback=LeadIntelDiscovery.extractCompanyMentions(evidence,targetCount);
  const b=bridge();const workspace=b?.workspace;
  if(!evidence.length)return [];
  discoveryProgress={phase:"extracting",completed:0,total:1};window.LeadIntelTaskCentre?.update(activeDiscoveryTaskId,{stage:"Extracting named companies",completed:0,total:1});
  if(!b?.session?.authenticated||!workspace?.id){
    setCompanyExtraction("fallback","Text fallback",`Workspace AI is unavailable while signed out; text matching identified ${fallback.length} company name${fallback.length===1?"":"s"}.`);
    return fallback;
  }
  renderDiscoverySafely();
  const sources=evidence.slice(0,16).map((item,index)=>({
    id:`E${index+1}`,url:item.url,market:item.market,title:item.title,
    description:item.description,text:String(item.text||"").slice(0,2200)
  }));
  const system="You extract prospective operating companies from supplied market evidence. Never invent a company or URL. Return strict JSON only.";
  const prompt=`Identify operating companies explicitly described as expanding, investing, building, modernising, hiring or otherwise matching the market signals in these sources. Publishers, government bodies, research institutes, directories and the seller itself are not prospects. Every company must include the exact supplied source URL where its name and event appear. Return {"companies":[{"company":"Exact company name","market":"${String(market||"").replace(/"/g,"'")}","sourceUrl":"Exact supplied URL"}]}. Evidence:\n${JSON.stringify(sources)}`;
  const controller=linkedAbortController(runSignal);const timeout=setTimeout(()=>controller.abort(),COMPANY_EXTRACTION_TIMEOUT_MS);
  try{
    const response=await fetch(`${LEADINTEL_API}/api/ai/generate?workspace_id=${encodeURIComponent(workspace.id)}`,{method:"POST",credentials:"include",headers:{"Content-Type":"application/json","Accept":"application/json"},body:JSON.stringify({task:"company-extraction",fallback_provider:"gemini",system,prompt,max_output_tokens:1800}),signal:controller.signal});
    const payload=await response.json().catch(()=>({}));
    if(!response.ok){
      const outcome=LeadIntelDiscovery.describeCompanyExtractionOutcome({provider:payload.provider||"openai",fallback:payload.fallback||{},textNames:fallback.length,responseOk:false,errorStatus:response.status,errorMessage:payload.error||""});
      setCompanyExtraction(outcome.status,outcome.method,outcome.message);return fallback;
    }
    const extracted=LeadIntelDiscovery.parseCompanyExtraction(payload.text,evidence,targetCount);
    const seen=new Set();const combined=[...extracted,...fallback].filter(item=>{const key=item.company.toLowerCase();if(seen.has(key))return false;seen.add(key);return true;}).slice(0,targetCount);
    const outcome=LeadIntelDiscovery.describeCompanyExtractionOutcome({provider:payload.provider,fallback:payload.fallback||{},aiNames:extracted.length,textNames:Math.max(0,combined.length-extracted.length)});
    setCompanyExtraction(outcome.status,outcome.method,outcome.message);
    return combined;
  }catch(error){
    if(runSignal?.aborted)throw error;
    const outcome=LeadIntelDiscovery.describeCompanyExtractionOutcome({provider:"openai",fallback:{status:"not_used"},textNames:fallback.length,responseOk:false,errorMessage:error?.message||""});
    setCompanyExtraction(outcome.status,outcome.method,outcome.message);
    return fallback;
  }finally{clearTimeout(timeout);if(!runSignal?.aborted){discoveryProgress.completed=1;renderDiscoverySafely();}}
}
async function runCompanyDiscovery(){
  const main=mainState();
  if(!(main?.profile?.website||main?.website)){showToast("Add your company website first");return;}
  syncStrategyFingerprint();
  const market=main.market||{};
  if(!LeadIntelDiscovery.hasActiveSignals?.(market)){showToast("Activate at least one buying signal in Strategy before finding companies");return;}
  const targetCount=persistDiscoveryTarget();
  const limits=LeadIntelDiscovery.discoveryLimits(targetCount);
  const queries=LeadIntelDiscovery.buildDiscoveryQueries(main.profile||{website:main.website},market,limits.queryCount);
  if(!queries.length){showToast("Add optional market or offer context to make discovery more precise");return;}
  const previousCandidates=discovery.candidates.slice();
  const previousRunAt=discovery.lastSuccessfulRunAt||(previousCandidates.length?discovery.lastRunAt:"");
  recoveredInterruptedRun=false;discovery.needsRefresh=false;discovery.queries=queries;discovery.rawResults=[];discovery.candidates=previousCandidates;discovery.companyMentions=[];discovery.searchFailures=[];discovery.checkedCompanyDomains=[];discovery.latestRunCandidateCount=0;discovery.lastSuccessfulRunAt=previousRunAt;discovery.retainedLastSuccessfulResults=previousCandidates.length>0;discovery.extraction={status:"pending",method:"",message:"Company-name extraction will report its method after the evidence search."};discovery.potentialMatches=[];
  discoveryEvidenceUrls=new Set();discoveryCheckedCompanyDomains=new Set();
  discovery.funnel={marketSearchesCompleted:0,marketSearchesTotal:queries.length,evidencePages:0,companiesIdentified:0,officialDomainsResolved:0,companySitesChecked:0,verifiedCompanies:0,qualifiedCompanies:0,adaptiveFollowUpSearches:0,openAiFallbackSearches:0};
  enrichmentResults.clear();enrichmentPending.clear();discovery.status="running";
  const taskCentre=window.LeadIntelTaskCentre;const taskId=`company-discovery:${Date.now()}`;
  activeDiscoveryTaskId=taskId;
  try{saveDiscovery();}catch(error){discovery.status="error";renderDiscoverySafely();showToast("Discovery could not save its running state. You can try again.");return;}
  if(!renderDiscoverySafely()){discovery.status="error";try{saveDiscovery();}catch{}renderDiscoverySafely();showToast("Discovery interface could not start. You can try again.");return;}
  let failures=0;
  let fatalError=null;
  let searches=Array(queries.length).fill(null);
  let resolutionSearches=[];
  let verificationSearches=[];
  let followUpSearches=[];
  let followUpResolutionSearches=[];
  let followUpVerificationSearches=[];
  let companyMentions=[];
  let expectedSearches=queries.length;
  let followUpQueries=[];
  let runCandidates=[];
  const runController=new AbortController();
  taskCentre?.start({id:taskId,type:'company-discovery',title:'Company discovery',stage:'Searching market evidence',total:Math.max(queries.length,1),completed:0,canCancel:true,canRetry:true});
  taskCentre?.registerActions(taskId,{cancel:()=>runController.abort(),retry:()=>runCompanyDiscovery()});
  try{
    const allSearches=(async()=>{
      const profile=main.profile||{website:main.website};
      const targetMarket=queries[0]?.market||profile.targetMarkets||"";
      const allMarketEvidence=[];
      const allResolved=[];
      const allVerified=[];
      const rememberMentions=items=>{
        const seen=new Set(companyMentions.map(item=>item.company.toLowerCase()));
        for(const item of items||[]){const key=item.company.toLowerCase();if(!seen.has(key)){seen.add(key);companyMentions.push(item);}}
        discovery.companyMentions=companyMentions.slice(0,MAX_DISCOVERY_COMPANY_CHECKS);
        discovery.funnel.companiesIdentified=companyMentions.length;
      };
      const collectResolutionAndVerification=async(mentions,remainingLimit)=>{
        const resolutionQueries=LeadIntelDiscovery.buildCompanyResolutionQueries(mentions,profile,remainingLimit);
        const resolutionRows=Array(resolutionQueries.length).fill(null);expectedSearches+=resolutionQueries.length;
        resolutionSearches=resolutionRows;
        await runDiscoverySearchBatch(resolutionQueries,"resolving",runController.signal,resolutionRows);
        throwIfDiscoveryRunAborted(runController.signal);
        const resolved=resolutionRows.flatMap(item=>item?.results||[]);allResolved.push(...resolved);
        discovery.rawResults=[...allMarketEvidence,...allResolved,...allVerified].slice(0,50);
        discovery.funnel.officialDomainsResolved=new Set(allResolved.map(item=>item.domain).filter(Boolean)).size;
        const verificationQueries=LeadIntelDiscovery.buildCandidateVerificationQueries(resolved,profile,market,remainingLimit);
        const verificationRows=Array(verificationQueries.length).fill(null);expectedSearches+=verificationQueries.length;
        verificationSearches=verificationRows;
        await runDiscoverySearchBatch(verificationQueries,"verifying",runController.signal,verificationRows);
        const verified=verificationRows.flatMap(item=>item?.results||[]);allVerified.push(...verified);
        discovery.rawResults=[...allMarketEvidence,...allResolved,...allVerified].slice(0,50);
        discovery.funnel.verifiedCompanies=new Set(allVerified.map(item=>item.domain).filter(Boolean)).size;
        return LeadIntelDiscovery.attachSourceEvidenceToResolvedCompanies(resolved,mentions,allMarketEvidence);
      };

      await runDiscoverySearchBatch(queries,"searching",runController.signal,searches);
      throwIfDiscoveryRunAborted(runController.signal);
      const firstPass=searches.flatMap(item=>item?.results||[]);allMarketEvidence.push(...firstPass);
      discovery.rawResults=[...allMarketEvidence];
      const firstMentions=await extractCompaniesFromEvidence(firstPass,targetMarket,Math.min(targetCount,MAX_DISCOVERY_COMPANY_CHECKS),runController.signal);
      rememberMentions(firstMentions);
      let linkedEvidence=await collectResolutionAndVerification(companyMentions,MAX_DISCOVERY_COMPANY_CHECKS);
      runCandidates=LeadIntelDiscovery.mergeCompanyCandidates([...linkedEvidence,...allVerified],profile,market,targetCount);
      discovery.candidates=runCandidates.length?runCandidates:previousCandidates;
      discovery.latestRunCandidateCount=runCandidates.length;
      discovery.retainedLastSuccessfulResults=runCandidates.length===0&&previousCandidates.length>0;
      discovery.funnel.qualifiedCompanies=runCandidates.length;
      renderDiscoverySafely();

      const firstPassSucceeded=searches.every(item=>item&&!item.error)
        &&resolutionSearches.every(item=>item&&!item.error)
        &&verificationSearches.every(item=>item&&!item.error);
      if(firstPassSucceeded&&runCandidates.length<targetCount&&companyMentions.length<MAX_DISCOVERY_COMPANY_CHECKS){
        const remainingLimit=MAX_DISCOVERY_COMPANY_CHECKS-companyMentions.length;
        followUpQueries=LeadIntelDiscovery.buildDiscoveryFollowUpQueries(profile,market,queries,MAX_DISCOVERY_FOLLOW_UP_QUERIES);
        if(followUpQueries.length){
          discovery.queries=[...queries,...followUpQueries];
          discovery.funnel.marketSearchesTotal=queries.length+followUpQueries.length;
          discovery.funnel.adaptiveFollowUpSearches=followUpQueries.length;
          followUpSearches=Array(followUpQueries.length).fill(null);expectedSearches+=followUpQueries.length;
          discoveryProgress={phase:"following",completed:0,total:followUpQueries.length};renderDiscoverySafely();
          await runDiscoverySearchBatch(followUpQueries,"following",runController.signal,followUpSearches);
          throwIfDiscoveryRunAborted(runController.signal);
          const followUpEvidence=followUpSearches.flatMap(item=>item?.results||[]);allMarketEvidence.push(...followUpEvidence);
          discovery.rawResults=[...allMarketEvidence,...allResolved,...allVerified].slice(0,50);
          const followUpMentions=await extractCompaniesFromEvidence(followUpEvidence,targetMarket,remainingLimit,runController.signal);
          rememberMentions(followUpMentions);
          const newMentions=companyMentions.slice(firstMentions.length,MAX_DISCOVERY_COMPANY_CHECKS);
          const followUpResolutionQueries=LeadIntelDiscovery.buildCompanyResolutionQueries(newMentions,profile,remainingLimit);
          followUpResolutionSearches=Array(followUpResolutionQueries.length).fill(null);expectedSearches+=followUpResolutionQueries.length;
          await runDiscoverySearchBatch(followUpResolutionQueries,"resolving",runController.signal,followUpResolutionSearches);
          throwIfDiscoveryRunAborted(runController.signal);
          const followUpResolved=followUpResolutionSearches.flatMap(item=>item?.results||[]);allResolved.push(...followUpResolved);
          discovery.rawResults=[...allMarketEvidence,...allResolved,...allVerified].slice(0,50);
          discovery.funnel.officialDomainsResolved=new Set(allResolved.map(item=>item.domain).filter(Boolean)).size;
          const followUpVerificationQueries=LeadIntelDiscovery.buildCandidateVerificationQueries(followUpResolved,profile,market,remainingLimit);
          followUpVerificationSearches=Array(followUpVerificationQueries.length).fill(null);expectedSearches+=followUpVerificationQueries.length;
          await runDiscoverySearchBatch(followUpVerificationQueries,"verifying",runController.signal,followUpVerificationSearches);
          const followUpVerified=followUpVerificationSearches.flatMap(item=>item?.results||[]);allVerified.push(...followUpVerified);
          discovery.rawResults=[...allMarketEvidence,...allResolved,...allVerified].slice(0,50);
          discovery.funnel.verifiedCompanies=new Set(allVerified.map(item=>item.domain).filter(Boolean)).size;
          linkedEvidence=LeadIntelDiscovery.attachSourceEvidenceToResolvedCompanies(allResolved,companyMentions,allMarketEvidence);
          runCandidates=LeadIntelDiscovery.mergeCompanyCandidates([...linkedEvidence,...allVerified],profile,market,targetCount);
          discovery.candidates=runCandidates.length?runCandidates:previousCandidates;
          discovery.latestRunCandidateCount=runCandidates.length;
          discovery.retainedLastSuccessfulResults=runCandidates.length===0&&previousCandidates.length>0;
          discovery.funnel.qualifiedCompanies=runCandidates.length;
        }
      }
      discovery.potentialMatches=LeadIntelDiscovery.buildPotentialCompanyCandidates([...linkedEvidence,...allVerified],profile,market,discovery.candidates);
      discovery.rawResults=[...allMarketEvidence,...allResolved,...allVerified].slice(0,50);
    })();
    let runTimeout;
    const runTimeoutMs=discoveryRunTimeoutMs(targetCount,queries.length);
    let timedOut=false;
    try{timedOut=await Promise.race([
      allSearches.then(()=>false),
      new Promise(resolve=>{runTimeout=setTimeout(()=>{runController.abort(new DOMException("Discovery run deadline reached","TimeoutError"));resolve(true);},runTimeoutMs);})
    ]);}finally{clearTimeout(runTimeout);}
    const completedSearches=[...searches,...resolutionSearches,...verificationSearches,...followUpSearches,...followUpResolutionSearches,...followUpVerificationSearches].filter(Boolean);
    failures=completedSearches.filter(item=>item.error).length+(timedOut?Math.max(1,expectedSearches-completedSearches.length):0);
    taskCentre?.update(taskId,{stage:'Verifying qualified companies',completed:Math.max(1,completedSearches.length),total:Math.max(1,expectedSearches),resultCount:runCandidates.length});
    discovery.status=LeadIntelDiscovery.discoveryOutcomeStatus({timedOut,failures,candidateCount:runCandidates.length});
    if(timedOut)fatalError=new Error("Company search timed out safely. Partial results were kept.");
    else if(discovery.status==="error"&&failures)fatalError=new Error(`Company search did not complete: ${failures} provider check${failures===1?"":"s"} failed or timed out. No no-match conclusion was made.`);
  }catch(error){
    fatalError=error instanceof Error?error:new Error(String(error||"Company discovery failed"));
    discovery.status=runCandidates.length?"partial":"error";
  }
  discovery.searchFailures=failedDiscoverySearches([
    {phase:"searching",rows:searches,queries},
    {phase:"resolving",rows:resolutionSearches},
    {phase:"verifying",rows:verificationSearches},
    {phase:"following",rows:followUpSearches,queries:followUpQueries},
    {phase:"resolving",rows:followUpResolutionSearches},
    {phase:"verifying",rows:followUpVerificationSearches}
  ]);
  discovery.funnel.qualifiedCompanies=runCandidates.length;
  discovery.funnel.officialDomainsResolved=new Set([...resolutionSearches,...followUpResolutionSearches].flatMap(item=>item?.results||[]).map(item=>item.domain).filter(Boolean)).size;
  discovery.funnel.verifiedCompanies=new Set([...verificationSearches,...followUpVerificationSearches].flatMap(item=>item?.results||[]).map(item=>item.domain).filter(Boolean)).size;
  discovery.lastRunAt=new Date().toISOString();
  Object.assign(discovery,LeadIntelDiscovery.retainLastSuccessfulDiscoveryCandidates({...discovery,candidates:previousCandidates,lastSuccessfulRunAt:previousRunAt},runCandidates,discovery.lastRunAt));
  discoveryProgress={phase:"complete",completed:discoveryProgress.completed,total:discoveryProgress.total};
  try{saveDiscovery();}catch(error){console.error("Companies state could not be saved",error);}
  renderDiscoverySafely();
  if(crmAuthenticated()){
    void refreshCrmState({render:false}).then(()=>renderAll()).catch(error=>{
      showToast("CRM refresh unavailable · "+(error?.message||"results remain available"));
    });
  }
  if(fatalError){
    if(taskCentre?.get(taskId)?.status!=='canceled')taskCentre?.fail(taskId,fatalError,{canRetry:true,resultCount:discovery.latestRunCandidateCount});
    activeDiscoveryTaskId="";
    showToast("Discovery stopped safely · "+fatalError.message);
    return;
  }
  taskCentre?.complete(taskId,{status:discovery.status,stage:discovery.status==='partial'?'Discovery completed with warnings':discovery.status==='no_results'?'Discovery finished · no newly qualified companies':'Company discovery complete',resultCount:discovery.latestRunCandidateCount});
  activeDiscoveryTaskId="";
  const targetNote=targetCount?" · target up to "+targetCount:"";
  const issueNote=failures?" · "+failures+" search issue"+(failures===1?"":"s"):"";
  showToast(discovery.latestRunCandidateCount?discovery.latestRunCandidateCount+" qualified companies found"+targetNote+issueNote:discovery.retainedLastSuccessfulResults?`No new matches · ${discovery.candidates.length} previous result${discovery.candidates.length===1?"":"s"} retained`:"No company names could be identified from this search");
}
async function retryFailedDiscoveryChecks(){
  if(discovery.status==="running")return false;
  const failures=Array.isArray(discovery.searchFailures)?discovery.searchFailures:[];
  const resolutionOnly=failures.length>0&&failures.every(item=>item.phase==="resolving"&&item.queryMeta?.query&&item.queryMeta?.company);
  if(!resolutionOnly&&(!failures.length||failures.some(item=>item.phase!=="verifying"||!item.queryMeta?.query||!item.queryMeta?.domain)))return runCompanyDiscovery();
  const main=mainState();const market=main.market||{};const profile=main.profile||{website:main.website};
  const previousCandidates=discovery.candidates.slice();const previousRunAt=discovery.lastSuccessfulRunAt||(previousCandidates.length?discovery.lastRunAt:"");
  const targetCount=persistDiscoveryTarget();const queries=failures.map(item=>item.queryMeta);
  discovery.status="running";discovery.searchFailures=[];discoveryProgress={phase:resolutionOnly?"resolving":"verifying",completed:0,total:queries.length};
  discoveryEvidenceUrls=new Set((discovery.rawResults||[]).map(item=>item.url).filter(Boolean));
  discoveryCheckedCompanyDomains=new Set(discovery.checkedCompanyDomains||[]);
  activeDiscoveryTaskId=`company-verification-retry:${Date.now()}`;
  const taskCentre=window.LeadIntelTaskCentre;const taskId=activeDiscoveryTaskId;const runController=new AbortController();
  taskCentre?.start({id:taskId,type:"company-discovery",title:resolutionOnly?"Retry official domain lookups":"Retry company website checks",stage:resolutionOnly?"Resolving company websites":"Verifying company websites",total:queries.length,completed:0,canCancel:true,canRetry:true});
  taskCentre?.registerActions(taskId,{cancel:()=>runController.abort(),retry:()=>retryFailedDiscoveryChecks()});
  let timedOut=false;
  try{
    const rows=Array(queries.length).fill(null);
    let verificationQueries=[];let verificationRows=[];
    const searches=(async()=>{
      await runDiscoverySearchBatch(queries,resolutionOnly?"resolving":"verifying",runController.signal,rows,{retryOnly:true});
      if(resolutionOnly){
        const previousResolved=(discovery.rawResults||[]).filter(item=>String(item.queryId||"").startsWith("resolve-"));
        verificationQueries=LeadIntelDiscovery.buildCandidateVerificationQueries([...previousResolved,...rows.flatMap(item=>item?.results||[])],profile,market,targetCount);
        verificationRows=Array(verificationQueries.length).fill(null);
        await runDiscoverySearchBatch(verificationQueries,"verifying",runController.signal,verificationRows,{retryOnly:true});
      }
      return rows;
    })();
    let runTimeout;
    try{timedOut=await Promise.race([searches.then(()=>false),new Promise(resolve=>{runTimeout=setTimeout(()=>{runController.abort(new DOMException("Verification retry deadline reached","TimeoutError"));resolve(true);},Math.max(DISCOVERY_REQUEST_TIMEOUT_MS*2,DISCOVERY_RUN_TIMEOUT_MIN_MS));})]);}
    finally{clearTimeout(runTimeout);}
    const rowsResult=await searches.catch(()=>rows);
    discovery.searchFailures=failedDiscoverySearches([{phase:resolutionOnly?"resolving":"verifying",rows:rowsResult,queries},...(resolutionOnly?[{phase:"verifying",rows:verificationRows,queries:verificationQueries}]:[])]);
    const raw=Array.isArray(discovery.rawResults)?discovery.rawResults:[];
    const marketEvidence=raw.filter(item=>String(item.queryId||"").startsWith("discover-"));
    const resolved=[...raw.filter(item=>String(item.queryId||"").startsWith("resolve-")),...(resolutionOnly?rowsResult.flatMap(item=>item?.results||[]):[])];
    const verified=[...raw.filter(item=>String(item.queryId||"").startsWith("verify-")),...(resolutionOnly?verificationRows:rowsResult).flatMap(item=>item?.results||[])];
    const candidateEvidence=(discovery.potentialMatches||[]).flatMap(candidate=>(candidate.evidence||[]).map(item=>({
      queryId:`review-${candidate.id}`,market:candidate.market,domain:candidate.domain,company:candidate.company,url:item.url,sourceDomain:item.sourceDomain,
      title:item.title,description:item.description,text:item.text,date:item.date
    })));
    const linked=LeadIntelDiscovery.attachSourceEvidenceToResolvedCompanies(resolved,discovery.companyMentions||[],marketEvidence);
    const runCandidates=LeadIntelDiscovery.mergeCompanyCandidates([...candidateEvidence,...linked,...verified],profile,market,targetCount);
    discovery.candidates=runCandidates.length?runCandidates:previousCandidates;
    discovery.latestRunCandidateCount=runCandidates.length;
    discovery.retainedLastSuccessfulResults=runCandidates.length===0&&previousCandidates.length>0;
    discovery.potentialMatches=LeadIntelDiscovery.buildPotentialCompanyCandidates([...candidateEvidence,...linked,...verified],profile,market,discovery.candidates);
    discovery.rawResults=[...marketEvidence,...resolved,...verified].filter((item,index,array)=>array.findIndex(other=>other.url===item.url)===index).slice(0,50);
    discovery.funnel.evidencePages=discoveryEvidenceUrls.size;
    discovery.funnel.officialDomainsResolved=new Set(resolved.map(item=>item.domain).filter(Boolean)).size;
    discovery.funnel.verifiedCompanies=new Set(verified.map(item=>item.domain).filter(Boolean)).size;
    discovery.funnel.companySitesChecked=discoveryCheckedCompanyDomains.size;
    discovery.funnel.qualifiedCompanies=runCandidates.length;
    discovery.status=LeadIntelDiscovery.discoveryOutcomeStatus({timedOut,failures:discovery.searchFailures.length,candidateCount:runCandidates.length});
    discovery.lastRunAt=new Date().toISOString();
    Object.assign(discovery,LeadIntelDiscovery.retainLastSuccessfulDiscoveryCandidates({...discovery,candidates:previousCandidates,lastSuccessfulRunAt:previousRunAt},runCandidates,discovery.lastRunAt));
  }catch(error){
    discovery.searchFailures=failedDiscoverySearches([{phase:"verifying",rows:[],queries}]);
    discovery.status=previousCandidates.length?"partial":"error";
    taskCentre?.fail(taskId,error,{canRetry:true,resultCount:discovery.latestRunCandidateCount});
    showToast(error?.message||"Company website checks could not be retried");
  }
  discoveryProgress={phase:"complete",completed:discoveryProgress.completed,total:discoveryProgress.total};
  try{saveDiscovery();}catch(error){console.error("Company verification retry could not be saved",error);}
  renderDiscoverySafely();
  if(discovery.searchFailures.length){taskCentre?.fail(taskId,new Error(`${discovery.searchFailures.length} company website check${discovery.searchFailures.length===1?"":"s"} still failed after retry.`),{canRetry:true,resultCount:discovery.latestRunCandidateCount});showToast("Company checks retried · some still need attention");}
  else{taskCentre?.complete(taskId,{status:discovery.status,stage:"Company website checks retried",resultCount:discovery.latestRunCandidateCount});showToast(discovery.latestRunCandidateCount?`${discovery.latestRunCandidateCount} qualified compan${discovery.latestRunCandidateCount===1?"y":"ies"} now ready for buyer search`:"Checks completed · no company passed every qualification check");}
  activeDiscoveryTaskId="";
  return discovery.searchFailures.length===0;
}
function scoreCell(label,value,max){return `<div><span>${label}</span><strong>${Number(value)||0}/${max}</strong><i style="--score:${Math.round((Number(value)||0)/max*20)}"></i></div>`;}
function linkedInSearchUrl(person={},candidate={}){
  const terms=[person?.name,person?.title,candidate?.company,candidate?.domain].map(value=>String(value||"").trim()).filter(Boolean).join(" ");
  return `https://www.linkedin.com/search/results/people/?keywords=${encodeURIComponent(terms||"decision maker")}`;
}
function linkedInPersonHtml(person={},candidate={}){
  const direct=String(person?.linkedin_url||"").trim();
  if(direct)return `<a class="person-linkedin" href="${esc(direct)}" target="_blank" rel="noopener noreferrer">View public LinkedIn profile ↗</a><small class="people-note">Apollo identity link · confirm the current role before outreach.</small>`;
  return `<a class="person-linkedin" href="${esc(linkedInSearchUrl(person,candidate))}" target="_blank" rel="noopener noreferrer">Search LinkedIn manually ↗</a><small class="people-note">No direct public profile URL returned; confirm identity before outreach.</small>`;
}
function enrichmentResultHtml(result){
  if(!result)return "";
  const rows=[];
  if(result.contact?.work_email)rows.push(`<small class="verified-contact"><strong>Verified work email</strong> · ${esc(result.contact.work_email)} · Apollo</small>`);
  if(result.contact?.phone_number)rows.push(`<small class="verified-contact"><strong>Verified phone</strong> · ${esc(result.contact.phone_number)} · Apollo</small>`);
  else if(result.request?.status==="pending_phone")rows.push('<small class="verified-contact">Phone lookup pending · refresh to check Apollo verification</small>');
  if(!result.contact?.work_email&&result.reason==="verified_company_email_not_returned")rows.push('<small class="people-note">Apollo did not return a verified company email for this person.</small>');
  return rows.join("");
}
function peopleHtml(candidate,candidateIndex){
  if(candidate.peopleStatus==="loading")return '<div class="people-note">Searching Apollo for matching roles…</div>';
  if(candidate.peopleStatus==="error")return '<div class="people-note warning">Apollo search was unavailable. Company evidence remains intact.</div>';
  if(candidate.peopleStatus==="empty")return '<div class="people-note">No relevant decision-makers returned for the available role context.</div>';
  if(!candidate.people?.length)return '<div class="people-note">People search is optional. Apollo People Search does not reveal email addresses; it identifies likely roles. Contact details stay hidden until you verify a work email.</div>';
  const shortage=candidate.people.length<3?`<div class="people-note warning">Only ${candidate.people.length} relevant decision-maker${candidate.people.length===1?"":"s"} found. LeadIntel did not fill the shortlist with unrelated roles.</div>`:"";
  return `${shortage}<div class="people-list">${candidate.people.map((person,personIndex)=>{
    const key=personKey(candidate,person);
    const result=enrichmentResults.get(key);
    const pending=enrichmentPending.has(key);
    const hasEmail=Boolean(result?.contact?.work_email);
    const hasPhone=Boolean(result?.contact?.phone_number);
    const phonePending=result?.request?.status==="pending_phone"&&!hasPhone;
    const emailLabel=pending?"Working…":hasEmail?"Email verified ✓":crmAuthenticated()?"Verify email with Apollo · 1 credit":"Sign in to verify email";
    const phoneAction=phonePending?"refresh-phone":"find-phone";
    const phoneLabel=hasPhone?"Phone verified ✓":phonePending?"Refresh phone":"Find phone · paid";
    return `<div class="person-row"><div><strong>${esc(person.name)}</strong><span>${esc(person.title)}</span>${person.organization?`<small>${esc(person.organization)}</small>`:""}${linkedInPersonHtml(person,candidate)}${enrichmentResultHtml(result)}</div><div class="person-actions"><button class="secondary-btn small" type="button" data-action="enrich-contact" aria-label="Enrich contact: verify the selected work email" title="Enrich contact: verify the selected work email" data-company-index="${candidateIndex}" data-person-index="${personIndex}" ${pending||!crmAuthenticated()||hasEmail?"disabled":""}>${emailLabel}</button><button class="secondary-btn small" type="button" data-action="${phoneAction}" data-company-index="${candidateIndex}" data-person-index="${personIndex}" ${pending||!crmAuthenticated()||hasPhone?"disabled":""}>${phoneLabel}</button></div></div>`;
  }).join("")}</div>`;
}
function candidateCrmMeta(candidate){const company=crmCompanyByDomain(candidate.domain||candidate.website);const inPipeline=currentWorkspaceCrmPipeline().some(item=>canonicalDomain(item.normalized_domain||item.website)===canonicalDomain(candidate.domain||candidate.website));return {company,suppressed:company?.lifecycle_status==="suppressed",inPipeline};}
function candidateIsActionable(candidate){return Boolean(LeadIntelDiscovery.isActionableCandidate?.(candidate));}
function renderDiscoveryFunnel(){
  const target=$("discovery-funnel");if(!target)return;
  const funnel=discovery.funnel||{};
  const visible=discovery.status!=="idle"||Boolean(discovery.lastRunAt);
  target.hidden=!visible;if(!visible){target.innerHTML="";return;}
  const completed=Number(funnel.marketSearchesCompleted)||0;const total=Number(funnel.marketSearchesTotal)||0;
  const percent=total?Math.min(100,Math.round(completed/total*100)):0;
  const phase=discovery.status==="running"?(discoveryProgress.phase==="following"?"Broadening the search":discoveryProgress.phase==="resolving"?"Confirming company websites":discoveryProgress.phase==="verifying"?"Checking company evidence":"Searching market evidence"):discovery.status==="error"||discovery.status==="partial"?"Search stopped with issues":"Search complete";
  const metrics=[
    [`${completed} of ${total}`,"Market searches checked"],
    [Number(funnel.evidencePages)||0,"Unique evidence pages"],
    [Number(funnel.companiesIdentified)||0,"Companies identified"],
    [Number(funnel.officialDomainsResolved)||0,"Official domains resolved"],
    [Number(funnel.companySitesChecked)||0,"Company sites checked"],
    [Number(funnel.qualifiedCompanies)||0,"Qualified companies"]
  ];
  target.innerHTML=`<div class="discovery-funnel-head"><strong>Search funnel</strong><span>${esc(phase)}</span></div><div class="discovery-funnel-track" role="progressbar" aria-label="Market searches checked" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${percent}"><i style="width:${percent}%"></i></div><div class="discovery-funnel-grid">${metrics.map(([value,label])=>`<div><strong>${esc(value)}</strong><span>${esc(label)}</span></div>`).join("")}</div>${discovery.extraction?.message?`<p class="discovery-funnel-extraction"><strong>Company extraction:</strong> ${esc(discovery.extraction.message)}</p>`:""}${Number(funnel.openAiFallbackSearches)?`<p class="discovery-funnel-followup">Firecrawl returned a credit or billing error for ${Number(funnel.openAiFallbackSearches)} search${Number(funnel.openAiFallbackSearches)===1?"":"es"}; grounded OpenAI web search supplied source-linked results instead.</p>`:""}${Number(funnel.adaptiveFollowUpSearches)?`<p class="discovery-funnel-followup">LeadIntel added ${Number(funnel.adaptiveFollowUpSearches)} follow-up searches because the first pass found too few qualified companies.</p>`:""}${discoverySearchFailuresHtml()}`;
}
function discoverySearchFailuresHtml(){
  const failures=Array.isArray(discovery.searchFailures)?discovery.searchFailures:[];if(!failures.length)return "";
  const labels={searching:"Market evidence",following:"Follow-up market evidence",resolving:"Official domain lookup",verifying:"Company website check"};
  const unique=[...new Map(failures.map(item=>[`${item.phase}|${item.domain||item.company}|${item.reason}|${item.status}`,item])).values()];
  const verifyingOnly=failures.every(item=>item.phase==="verifying"&&item.queryMeta?.domain&&item.queryMeta?.query);
  const shown=unique.slice(0,4).map(item=>`<li><strong>${esc(labels[item.phase]||"Research check")}</strong>${item.company?` · ${esc(item.company)}`:item.domain?` · ${esc(item.domain)}`:""} — ${esc(discoveryFailureLabel(item))}</li>`).join("");
  const more=unique.length>4?`<li>+ ${unique.length-4} more failed checks</li>`:"";
  const action=verifyingOnly?"Retry company-site checks":"Retry failed checks";
  const creditBlocked=failures.every(item=>Number(item.status)===402);
  if(creditBlocked)return `<div class="discovery-search-failures" role="alert"><strong>${failures.length} provider check${failures.length===1?"":"s"} stopped: Firecrawl returned HTTP 402.</strong><ul>${shown}${more}</ul><p>Check Firecrawl credits or billing in AI &amp; Tools. Grounded OpenAI web search can recover these checks when it returns matching source links.</p><button class="secondary-btn small" type="button" data-action="retry-failed-checks">Retry failed checks with fallback (${failures.length})</button> <button class="secondary-btn small" type="button" data-action="open-provider-settings">Open AI &amp; Tools</button></div>`;
  return `<div class="discovery-search-failures" role="alert"><strong>${failures.length} provider check${failures.length===1?"":"s"} failed.</strong><ul>${shown}${more}</ul><button class="secondary-btn small" type="button" data-action="retry-failed-checks">${action} (${failures.length})</button></div>`;
}
function potentialBuyerResultsHtml(candidate){
  if(candidate.peopleStatus==="loading")return '<div class="potential-match-buyers-status">Searching Apollo for the selected company…</div>';
  if(candidate.peopleStatus==="error")return '<div class="potential-match-buyers-status warning">Buyer search failed. You can retry this company.</div>';
  if(candidate.peopleStatus==="empty")return '<div class="potential-match-buyers-status">Apollo returned no matching decision-makers for the configured buyer roles.</div>';
  if(!candidate.people?.length)return "";
  return `<div class="potential-match-people"><strong>Decision-makers · user-selected search</strong>${candidate.people.map(person=>`<div><span>${esc(person.name)} · ${esc(person.title)}</span>${person.linkedin_url?`<a href="${esc(person.linkedin_url)}" target="_blank" rel="noopener noreferrer">LinkedIn ↗</a>`:""}</div>`).join("")}</div><small class="potential-match-user-selection">No public buying signal was confirmed. This remains an unqualified potential match and was not saved to CRM or Pipeline.</small>`;
}
function renderPotentialMatches(){
  const target=$("discovery-potential-matches");if(!target)return;
  const matches=Array.isArray(discovery.potentialMatches)?discovery.potentialMatches:[];
  target.hidden=!matches.length;if(!matches.length){target.innerHTML="";return;}
  target.innerHTML=`<div class="potential-matches-head"><span class="eyebrow">Needs human review</span><h3 id="potential-matches-title">Potential matches · not qualified</h3><p>These named companies have public evidence, but at least one qualification check is missing. They are not automatically saved as leads.</p></div><div class="potential-match-list">${matches.map(candidate=>{const canSearch=LeadIntelDiscovery.isPotentialBuyerSearchAllowed?.(candidate);const buyerLabel=candidate.people?.length?"Refresh buyers":candidate.peopleStatus==="loading"?"Searching…":"Find buyers anyway";return `<article class="potential-match-card"><div><span class="opportunity-market">${esc(candidate.market||"Market not confirmed")}</span><h4>${esc(candidate.company)}</h4><a href="${esc(candidate.website)}" target="_blank" rel="noopener noreferrer">${esc(candidate.domain)} ↗</a>${canSearch?`<div class="potential-match-buyer-action"><p>Target market and customer fit are evidenced, but no public buying signal was confirmed. You can still request buyers as a user-selected prospect; it will remain unqualified and will not be saved to CRM or Pipeline.</p><button class="secondary-btn small" type="button" data-action="find-potential-buyers" data-domain="${esc(candidate.domain)}" ${candidate.peopleStatus==="loading"?"disabled":""}>${buyerLabel}</button></div>`:""}${potentialBuyerResultsHtml(candidate)}</div><div class="potential-match-gaps"><strong>Still needs confirmation</strong><ul>${candidate.qualificationGaps.map(gap=>`<li>${esc(gap)}</li>`).join("")}</ul></div>${candidate.evidence.length?`<div class="potential-match-evidence">${candidate.evidence.slice(0,3).map(evidence=>`<a href="${esc(evidence.url)}" target="_blank" rel="noopener noreferrer"><strong>${esc(evidence.title||candidate.domain)}</strong><small>${esc(evidence.description||evidence.text).slice(0,220)}${LeadIntelDiscovery.isLowQualityDiscoveryEvidence?.(evidence)?'<em>Generic listing · excluded from fit, signal and evidence scoring</em>':''}</small></a>`).join("")}</div>`:""}</article>`;}).join("")}</div>`;
}
function discoveryRecoveryHtml(){
  const main=mainState();const activeSignalCount=(main.market?.signals||[]).filter(item=>item&&item.active!==false).length;
  const guidance=LeadIntelDiscovery.zeroResultGuidance({evidenceCount:discovery.rawResults.length,evidencePages:discovery.funnel?.evidencePages||0,companiesIdentified:discovery.funnel?.companiesIdentified||0,extractionStatus:discovery.extraction?.status||"idle",activeSignalCount,targetCount:selectedDiscoveryTarget(),researchMode:main.market?.researchMode||"deep",adaptiveFollowUpSearches:discovery.funnel?.adaptiveFollowUpSearches||0});
  const action=guidance.primaryAction==="open_ai_settings"?"open-ai-settings":guidance.primaryAction==="review_research"?"review-research":"review-strategy";
  const noNames=companyExtractionMiss();const noEvidence=!discovery.rawResults.length;
  return `<div class="market-empty discovery-recovery"><span class="eyebrow">Next action</span><h4>${noNames?"No company names identified":noEvidence?"No usable company evidence found":"No company met every qualification check"}</h4><p>${esc(guidance.summary)}</p><p class="discovery-recovery-valid">${noNames?"The search did not confirm a market no-match; it did not identify company names from this evidence set.":noEvidence?"The search did not collect evidence, so it cannot conclude that no companies match.":"A zero-result run can be valid when qualifying public evidence is unavailable."}</p><ol>${guidance.steps.map(step=>`<li>${esc(step)}</li>`).join("")}</ol>${noNames?"":`<p class="discovery-recovery-note"><strong>Keep the selected amount for now.</strong> Increasing it repeats the same qualification checks; it does not create missing evidence.</p>`}<button class="primary-btn" type="button" data-action="${action}">${esc(guidance.primaryLabel)} <span>→</span></button></div>`;
}
function renderCandidates(){const target=$("company-candidates");if(!target)return;
  const showRecovery=discovery.status==="no_results"&&discovery.latestRunCandidateCount===0;
  const recovery=showRecovery?discoveryRecoveryHtml():"";
  const retainedRunStatus=discovery.status==="running"?"A new search is running;":discovery.status==="error"?"The search stopped without new results;":discovery.status==="partial"?"The search ended with issues and no new qualified companies;":`This search found ${Number(discovery.funnel?.qualifiedCompanies)||0} new companies;`;
  const previousNotice=discovery.retainedLastSuccessfulResults&&discovery.candidates.length?`<div class="discovery-retained-results"><strong>Previous qualified results retained.</strong> ${retainedRunStatus} the ${discovery.candidates.length} result${discovery.candidates.length===1?"":"s"} below are from the last successful search${discovery.lastSuccessfulRunAt?` · ${esc(new Date(discovery.lastSuccessfulRunAt).toLocaleDateString())}`:""}.</div>`:"";
  if(!discovery.candidates.length){
  if(discovery.status==="no_results"){
    target.innerHTML=recovery;
    return;
  }
  const message=discovery.needsRefresh?"Discovery scoring has been improved. Run the search again to refresh saved results before acting on them.":discovery.status==="running"?(discoveryProgress.phase==="verifying"?"Checking candidate websites for market, buyer-role, and buying-signal evidence…":discoveryProgress.phase==="following"?"Broadening the search to find additional company evidence…":"Finding candidate company domains…"):discovery.status==="error"?"Search stopped before verification finished. This is not a confirmed no-match; review the search status before retrying.":discovery.lastRunAt?"Company discovery did not complete. Review the status above before retrying.":"Run discovery to create a ranked shortlist of direct company domains.";
  target.innerHTML=`<div class="market-empty">${message}</div>`;
  return;
}target.innerHTML=`${recovery}${previousNotice}${discovery.candidates.map((c,index)=>{const crm=candidateCrmMeta(c);const crmLabel=crm.suppressed?"Suppressed":crm.company?"Saved in CRM ✓":"Save in CRM";const pipelineLabel=crm.suppressed?"Suppressed":crm.inPipeline?`In Pipeline ✓ · ${crm.company.pipeline_stage}`:"Add to Pipeline";const crmDisabled=!crmAuthenticated()||crm.suppressed;const pipelineDisabled=crm.suppressed;return `<article class="company-card ${crm.inPipeline||c.saved?"saved":""}" data-company-index="${index}">
    <div class="company-card-top"><div><span class="opportunity-market">${esc(c.market||"Target market")}</span><h4>${esc(c.company)}</h4><a href="${esc(c.website)}" target="_blank" rel="noopener">${esc(c.domain)} ↗</a></div><div class="company-total"><strong>${c.score.total}</strong><span>/100</span></div></div>
    <div class="company-score-grid">${scoreCell("Fit",c.score.fit,30)}${scoreCell("Signal",c.score.signal,25)}${scoreCell("Evidence",c.score.evidence,20)}${scoreCell("Timing",c.score.timing,15)}${scoreCell("Value",c.score.value,10)}</div>
    <div class="candidate-meta"><span class="confidence ${String(c.confidence).toLowerCase()}">${esc(c.confidence)} confidence</span><span>${c.evidence.length} source${c.evidence.length===1?"":"s"}</span><span>${c.matchedSignals.length} matched signal${c.matchedSignals.length===1?"":"s"}</span>${crm.company?`<span>${esc(crmLabel)}</span>`:""}</div>
    <div class="matched-signals">${c.matchedSignals.length?c.matchedSignals.map(s=>`<span><strong>${esc(s.name)}</strong> · ${esc(s.matchedTerms.join(", "))}</span>`).join(""):'<span class="muted-signal">No active signal term found in the returned company evidence.</span>'}</div>
    <p class="candidate-narrative" lang="${contentLanguage()}">${esc(LeadIntelDiscovery.buildCandidateNarrative(c,contentLanguage()))}</p>
    <div class="candidate-evidence">${c.evidence.map(e=>`<a href="${esc(e.url)}" target="_blank" rel="noopener"><strong>${esc(e.title||c.domain)}</strong><small>${esc(e.description||e.text).slice(0,190)}${LeadIntelDiscovery.isLowQualityDiscoveryEvidence?.(e)?'<em>Generic listing · excluded from fit, signal and evidence scoring</em>':''}</small></a>`).join("")}</div>
    <div class="decision-makers"><div class="decision-head"><strong>Potential buyers</strong><button class="secondary-btn small" type="button" data-action="find-decision-makers" data-company-index="${index}" ${c.peopleStatus==="loading"?"disabled":""}>${c.people?.length?"Refresh buyers":"Find buyers"}</button></div>${peopleHtml(c,index)}</div>
    <div class="candidate-actions"><button class="secondary-btn small" type="button" data-action="save-crm" data-company-index="${index}" ${crmDisabled?"disabled":""}>${crmAuthenticated()?crmLabel:"Sign in for CRM"}</button><button class="primary-btn small" type="button" data-action="add-pipeline" data-company-index="${index}" ${pipelineDisabled?"disabled":""}>${pipelineLabel}</button></div>
  </article>`;}).join("")}`;}

async function findDecisionMakers(index){
  const candidate=discovery.candidates[index];if(!candidate)return false;
  if(!candidateIsActionable(candidate)){showToast("Company qualification is incomplete · run Discovery again");return false;}
  return searchDecisionMakers(candidate,{pipeline:Boolean(candidate.saved),retry:()=>findDecisionMakers(index)});
}
async function findPotentialDecisionMakers(domain){
  const candidate=discovery.potentialMatches.find(item=>canonicalDomain(item.domain||item.website)===canonicalDomain(domain));
  if(!candidate||!LeadIntelDiscovery.isPotentialBuyerSearchAllowed?.(candidate)){showToast("Buyer search needs verified target-market and customer fit");return false;}
  if(candidate.peopleStatus==="loading")return false;
  const roles=String(mainState().profile?.decisionMakers||"").trim();
  if(!roles){showToast("Add buyer roles to your company profile before searching");return false;}
  candidate.buyerSearchMode="user_selected_without_signal";
  return searchDecisionMakers(candidate,{allowCrmSync:false,retry:()=>findPotentialDecisionMakers(domain)});
}
function findPipelineDecisionMakers(index){
  const selected=pipelineRows()[Number(index)];if(!selected)return false;
  const domain=canonicalDomain(selected.domain||selected.website);if(!domain){showToast("A verified company domain is required");return false;}
  const existingCandidate=discovery.candidates.find(item=>canonicalDomain(item.domain||item.website)===domain);
  const existingPipeline=discovery.pipeline.find(item=>canonicalDomain(item.domain||item.website)===domain);
  const candidate={...(existingCandidate||{}),...(existingPipeline||{}),...selected,domain,saved:true};
  discovery.pipeline=LeadIntelDiscovery.upsertPipelineItem(discovery.pipeline,candidate);saveDiscovery();renderPipeline();
  return searchDecisionMakers(candidate,{pipeline:true,retry:()=>retryPipelineDecisionMakers(domain)});
}
function retryPipelineDecisionMakers(domain){const index=pipelineRows().findIndex(item=>canonicalDomain(item.domain||item.website)===domain);return index<0?false:findPipelineDecisionMakers(index);}
async function searchDecisionMakers(candidate,{pipeline=false,retry,allowCrmSync=true}={}){
  const main=mainState();
  const payload=LeadIntelDiscovery.buildApolloPeopleSearchPayload(candidate,main.profile||{});
  if(!payload.q_organization_domains_list.length){showToast("A verified company domain is required");return false;}
  const persist=()=>{if(pipeline||candidate.saved)discovery.pipeline=LeadIntelDiscovery.upsertPipelineItem(discovery.pipeline,candidate);saveDiscovery();renderAll();};
  candidate.peopleStatus="loading";persist();
  const controller=new AbortController();
  const taskCentre=window.LeadIntelTaskCentre;const taskId=`decision-maker-search:${candidate.domain||candidate.id||"company"}:${Date.now()}`;
  taskCentre?.start({id:taskId,type:'decision-maker-search',title:`Buyer search · ${candidate.company}`,stage:'Searching Apollo people',total:1,completed:0,canCancel:true,canRetry:true});
  taskCentre?.registerActions(taskId,{cancel:()=>controller.abort(),retry:retry||(()=>false)});
  const timeout=setTimeout(()=>controller.abort(),DISCOVERY_REQUEST_TIMEOUT_MS);
  try{
    const data=await bridge()?.searchApolloPeople?.(payload,{signal:controller.signal,timeoutMs:DISCOVERY_REQUEST_TIMEOUT_MS});
    if(!data?.ok)throw Object.assign(new Error(data?.error||"Apollo people search is unavailable"),{code:data?.code,status:data?.status});
    candidate.people=LeadIntelDiscovery.selectDecisionMakers(LeadIntelDiscovery.normalizeApolloPeople(data),main.profile||{},4);
    candidate.peopleStatus=candidate.people.length?"complete":"empty";
    persist();
    if(allowCrmSync&&crmAuthenticated()&&crmCompanyByDomain(candidate.domain)){
      const mapped=window.LeadIntelCrm.mapDiscoveryCandidateToCrm(candidate);
      const saved=await bridge().saveCrmCompany(mapped);
      if(!saved.ok)showToast(saved.error||"CRM contact update failed");
      else await refreshCrmState({render:false});
    }
    renderAll();
    showToast(!candidate.people.length?'No relevant decision-makers returned':candidate.people.length<3?`Only ${candidate.people.length} relevant decision-maker${candidate.people.length===1?"":"s"} found`:`${candidate.people.length} relevant decision-makers found`);
    taskCentre?.complete(taskId,{stage:'Decision-maker search complete',resultCount:candidate.people.length});
    return true;
  }catch(error){
    candidate.peopleStatus="error";persist();
    showToast(error?.name==="AbortError"?"Apollo people search timed out":error.message||"Apollo people search unavailable");
    if(taskCentre?.get(taskId)?.status!=='canceled')taskCentre?.fail(taskId,error,{canRetry:true});
    return false;
  }finally{
    clearTimeout(timeout);
  }
}
function saveLocalPipeline(candidate){discovery.pipeline=LeadIntelDiscovery.upsertPipelineItem(discovery.pipeline,candidate);candidate.saved=true;saveDiscovery();}
async function ensureCrmCompany(candidate){let company=crmCompanyByDomain(candidate.domain||candidate.website);if(company?.lifecycle_status==="suppressed")throw Object.assign(new Error("Suppressed companies must be restored in CRM before enrichment"),{code:"CRM_COMPANY_SUPPRESSED"});if(company)return company;const mapped=window.LeadIntelCrm?.mapDiscoveryCandidateToCrm(candidate);if(!mapped)throw new Error("CRM mapping is unavailable");const saved=await bridge().saveCrmCompany(mapped);if(!saved.ok)throw Object.assign(new Error(saved.error||"CRM save failed"),{code:saved.code});company=saved.company;await refreshCrmState({render:false});return company;}
async function enrichContact(companyIndex,personIndex,{phoneLookup=false}={}){const candidate=discovery.candidates[companyIndex];const person=candidate?.people?.[personIndex];if(!candidate||!person)return false;if(!person.id){showToast("Apollo person identity is missing · refresh decision-makers");return false;}if(!crmAuthenticated()){showToast("Sign in to enrich contacts with Apollo");return false;}const key=personKey(candidate,person);if(enrichmentPending.has(key))return false;const taskCentre=window.LeadIntelTaskCentre;const taskId=`apollo-enrichment:${person.id}:${phoneLookup?'phone':'email'}:${Date.now()}`;taskCentre?.start({id:taskId,type:'apollo-enrichment',title:`Apollo ${phoneLookup?'phone':'email'} · ${person.name}`,stage:'Preparing CRM contact',total:2,completed:0,canRetry:true});taskCentre?.registerActions(taskId,{retry:()=>enrichContact(companyIndex,personIndex,{phoneLookup})});enrichmentPending.add(key);renderCandidates();try{const company=await ensureCrmCompany(candidate);taskCentre?.update(taskId,{stage:'Verifying contact with Apollo',completed:1});const result=await bridge().enrichCrmContact(company.id,person,{phoneLookup,allowPersonalEmail:false});if(!result.ok)throw Object.assign(new Error(result.error||"Apollo contact enrichment failed"),{code:result.code});enrichmentResults.set(key,result);await refreshCrmState({render:false});renderAll();window.dispatchEvent(new CustomEvent("leadintel:crm-changed",{detail:{company_id:company.id,contact_id:result.contact?.id||null}}));taskCentre?.complete(taskId,{stage:'Apollo enrichment complete',resultCount:Number(Boolean(result.contact?.work_email))+Number(Boolean(result.contact?.phone_number))});if(phoneLookup)showToast(result.contact?.phone_number?`${person.name} · verified phone saved to Master CRM`:`${person.name} · phone lookup requested · use Refresh phone to check`);else showToast(result.contact?.work_email?`${person.name} · verified email saved to Master CRM`:`${person.name} · no verified company email returned`);return true;}catch(error){taskCentre?.fail(taskId,error,{canRetry:true});showToast(error.code==="CRM_APOLLO_CREDIT_LIMIT"?"Apollo credit limit reached":error.message||"Apollo contact enrichment failed");return false;}finally{enrichmentPending.delete(key);renderCandidates();}}
async function refreshEnrichedContact(companyIndex,personIndex){const candidate=discovery.candidates[companyIndex];const person=candidate?.people?.[personIndex];if(!candidate||!person?.id)return false;if(!crmAuthenticated()){showToast("Sign in to refresh Apollo contact status");return false;}const company=crmCompanyByDomain(candidate.domain||candidate.website);if(!company){showToast("Save this company to Master CRM before refreshing the phone");return false;}const key=personKey(candidate,person);if(enrichmentPending.has(key))return false;enrichmentPending.add(key);renderCandidates();try{const detail=await bridge().getCrmCompany(company.id);if(!detail.ok)throw new Error(detail.error||"Unable to refresh CRM contact");const contact=(detail.contacts||[]).find(item=>String(item.external_person_id||"")===String(person.id))||null;const previous=enrichmentResults.get(key)||{};const result={...previous,request:{...(previous.request||{}),status:contact?.phone_number?"verified":"pending_phone"},contact:contact||previous.contact||null};enrichmentResults.set(key,result);renderCandidates();showToast(contact?.phone_number?`${person.name} · verified phone loaded from Master CRM`:`${person.name} · phone lookup is still pending`);return Boolean(contact?.phone_number);}catch(error){showToast(error.message||"Unable to refresh phone status");return false;}finally{enrichmentPending.delete(key);renderCandidates();}}
async function saveCandidate(index,{pipeline=false}={}){const candidate=discovery.candidates[index];if(!candidate)return false;if(!candidateIsActionable(candidate)){showToast("Company qualification is incomplete · run Discovery again");return false;}if(!crmAuthenticated()){if(pipeline){saveLocalPipeline(candidate);renderAll();showToast(`${candidate.company} saved to local Pipeline · sign in for durable CRM`);return true;}showToast("Sign in with Google to save this company to Master CRM");return false;}const existing=crmCompanyByDomain(candidate.domain||candidate.website);if(existing?.lifecycle_status==="suppressed"){showToast("Suppressed companies must be restored in CRM before pipeline activation");return false;}const mapped=window.LeadIntelCrm.mapDiscoveryCandidateToCrm(candidate);const saved=await bridge().saveCrmCompany(mapped);if(!saved.ok){showToast(saved.code==="CRM_COMPANY_SUPPRESSED"?"Suppressed companies must be restored in CRM first":saved.error||"CRM save failed");return false;}const company=saved.company;if(pipeline){const activated=await bridge().addCrmToPipeline(company.id,"Discovered");if(!activated.ok){showToast(activated.code==="CRM_COMPANY_SUPPRESSED"?"Suppressed companies must be restored in CRM first":activated.error||"Pipeline update failed");return false;}saveLocalPipeline(candidate);}await refreshCrmState({render:false});renderAll();window.dispatchEvent(new CustomEvent("leadintel:crm-changed",{detail:{company}}));showToast(pipeline?`${candidate.company} added to durable Pipeline`:`${candidate.company} saved to Master CRM`);return true;}
function pipelineRows(){return crmAvailable?currentWorkspaceCrmPipeline().map(crmToLocalPipeline):discovery.pipeline;}
function renderPipeline(){
  const target=$("customer-pipeline");if(!target)return;
  const rows=pipelineRows();
  const countNode=$("discovery-pipeline-count");if(countNode)countNode.textContent=String(rows.length);
  const buyerCount=rows.filter(item=>Array.isArray(item.people)&&item.people.length>0).length;
  const focus=loadMeta().activeJourneyStage===5?"buyers":"companies";
  const guideDescription=$("discovery-buyers-description");
  if(guideDescription)guideDescription.textContent=rows.length
    ?"Choose a saved company below and select Find buyers. Review the suggested decision-makers before moving to Messages."
    :"No saved companies yet. Return to Companies, save a qualified match to your Pipeline, then come back here to find its buyers.";
  window.LeadIntelNextAction?.applyStageVisibility?.(document,5,{pipelineCount:rows.length,buyerCount,focus});
  if(!rows.length){target.innerHTML="";return;}
  const stages=crmAvailable?(window.LeadIntelCrm?.STAGES||[]):LeadIntelDiscovery.CRM_STAGES;
  target.innerHTML=`<div class="pipeline-table"><div class="pipeline-row header"><span>Company</span><span>Score</span><span>People</span><span>Stage</span><span>Action</span></div>${rows.map((item,index)=>{
    const people=Array.isArray(item.people)?item.people:[];
    const summary=people.length?`<div class="pipeline-buyer-summary"><strong>Suggested buyers</strong>${people.slice(0,4).map(person=>`<span>${esc(person.name)} · ${esc(person.title)}</span>`).join("")}</div>`:item.peopleStatus==="empty"?'<small class="pipeline-buyer-status">No matching buyer roles found. You can search again.</small>':item.peopleStatus==="error"?'<small class="pipeline-buyer-status">Buyer search failed. Try again.</small>':item.peopleStatus==="loading"?'<small class="pipeline-buyer-status">Searching for buyers…</small>':"";
    const buyerAction=focus==="buyers"?`<button class="primary-btn small" type="button" data-find-pipeline-buyers="${index}" aria-label="Find buyers for ${esc(item.company)}" ${item.peopleStatus==="loading"?"disabled":""}>${item.people?.length?"Refresh buyers":item.peopleStatus==="loading"?"Searching…":"Find buyers"}</button>`:"";
    const crmActions=crmAvailable?`<button class="secondary-btn small" type="button" data-pipeline-remove="${esc(item.crmId||item.id)}" data-domain="${esc(item.domain)}">Remove</button><button class="secondary-btn small" type="button" data-open-crm-company="${esc(item.crmId||item.id)}">Open CRM</button>`:'';
    const crmStatus=crmAvailable?'<small class="pipeline-crm-status">Saved in CRM ✓</small>':item.crmId?'<small class="pipeline-local-status">Previously saved in CRM · reconnect to verify</small>':crmAuthenticated()?'<small class="pipeline-local-status">CRM not confirmed · local workflow safe</small>':'<small class="pipeline-local-status">CRM status unknown · browser copy retained</small>';
    return `<div class="pipeline-row" data-pipeline-row="${index}"><div class="pipeline-company-cell"><strong>${esc(item.company)}</strong><a href="${esc(item.website)}" target="_blank" rel="noopener">${esc(item.domain)}</a>${crmStatus}${summary}</div><span class="pipeline-score">${item.score?.total||0}</span><span>${people.length}</span><select data-pipeline-stage="${index}" ${crmAvailable?`data-crm-id="${esc(item.crmId||item.id)}"`:""}>${stages.map(stage=>`<option ${stage===item.stage?"selected":""}>${esc(stage)}</option>`).join("")}</select><span class="pipeline-actions">${buyerAction}${crmActions}</span></div>`;
  }).join("")}</div>`;
}
async function changePipelineStage(select){const rows=pipelineRows();const item=rows[Number(select.dataset.pipelineStage)];if(!item)return;if(crmAvailable&&select.dataset.crmId){const stage=window.LeadIntelCrm?.normalizeCrmStage(select.value)||"Discovered";const result=await bridge().addCrmToPipeline(select.dataset.crmId,stage);if(!result.ok){showToast(result.error||"Pipeline stage update failed");await refreshCrmState();return;}await refreshCrmState({render:false});renderAll();window.dispatchEvent(new CustomEvent("leadintel:crm-changed",{detail:{company:result.company}}));showToast(`${item.company} moved to ${stage}`);return;}item.stage=LeadIntelDiscovery.CRM_STAGES.includes(select.value)?select.value:"Discovered";item.updatedAt=new Date().toISOString();saveDiscovery();renderPipeline();showToast(`${item.company} moved to ${item.stage}`);}
async function removePipelineCompany(id,domain){const result=await bridge()?.removeCrmFromPipeline(id);if(!result?.ok){showToast(result?.error||"Unable to remove company from Pipeline");return;}discovery.pipeline=discovery.pipeline.filter(item=>canonicalDomain(item.domain||item.website)!==canonicalDomain(domain));saveDiscovery();await refreshCrmState({render:false});renderAll();window.dispatchEvent(new CustomEvent("leadintel:crm-changed",{detail:{company:result.company}}));showToast("Removed from Pipeline · CRM history preserved");}
function renderStatus(){const main=mainState();const ready=Boolean(main?.profile?.website||main?.website);const formal=Boolean(main?.market?.strategyApproved);const target=selectedDiscoveryTarget();const targetControl=$("discovery-target-count");const customTarget=$("discovery-target-custom");const meta=loadMeta();const customMode=meta.targetMode==="custom"||targetControl?.value==="custom";if(targetControl)targetControl.value=customMode?"custom":String(target||DEFAULT_DISCOVERY_TARGET);if(customTarget){customTarget.hidden=!customMode;if(customMode&&document.activeElement!==customTarget)customTarget.value=String(target);}const gate=$("continue-to-discovery");if(gate){gate.hidden=!formal;gate.disabled=!ready;gate.textContent=ready?"Find matching companies →":"Add website first";}if(!$("discovery-status"))return;const phaseLabels={extracting:"Extracting",resolving:"Resolving",verifying:"Verifying",following:"Broadening search"};const labels={idle:discovery.needsRefresh?"Recheck":formal?"Ready":"Provisional",running:phaseLabels[discoveryProgress.phase]||"Searching",complete:"Complete",no_results:"No matches",partial:"Partial",error:"Search issue"};$("discovery-status").textContent=labels[discovery.status]||"Ready";$("discovery-company").textContent=main.profile?.companyName||"Company";const markets=(main.market?.opportunities||[]).filter(x=>x.active!==false).map(x=>x.market).filter(Boolean);$("discovery-markets").textContent=[...new Set(markets)].join(" · ")||main.profile?.targetMarkets||main.profile?.currentMarkets?.join?.(" · ")||"Provisional";const targetNote=target?` · target up to ${target}`:"";const phaseText={extracting:"Identifying companies named in market evidence…",resolving:`Resolving official company domains · ${discoveryProgress.completed}/${discoveryProgress.total} checked…`,verifying:`Verifying company websites · ${discoveryProgress.completed}/${discoveryProgress.total} checked…`,following:`Broadening the search · ${discoveryProgress.completed}/${discoveryProgress.total} follow-up searches checked…`};const runningText=phaseText[discoveryProgress.phase]||`Finding market evidence · ${discoveryProgress.completed}/${discoveryProgress.total} searches checked…`;const text={idle:discovery.needsRefresh?"Discovery scoring has been improved. Run the search again to refresh saved results before acting on them.":formal?"Ready to find companies using the active strategy.":"Company search is ready. Add optional market, ICP or signal context to improve precision.",running:runningText,complete:`Company search complete · ${discovery.candidates.length} qualified companies from ${discovery.rawResults.length} evidence results${targetNote}.`,no_results:companyExtractionMiss()?`Search finished · ${discovery.rawResults.length} evidence results checked across ${Number(discovery.funnel?.evidencePages)||0} unique pages; no company names were extracted${targetNote}.`:`Search finished · ${discovery.rawResults.length} evidence results checked; no company passed every active market and buying-signal check${targetNote}.`,partial:`Company search partially complete · ${discovery.latestRunCandidateCount} qualified companies; one or more checks were unavailable${targetNote}.`,error:recoveredInterruptedRun?"The previous company search was interrupted before it finished. Retry to continue.":"The search did not complete because one or more provider checks failed or timed out. This is not a confirmed no-match."};$("company-discovery-status").textContent=ready?(text[discovery.status]||text.idle):"Add your company website to enable the search.";const run=$("run-company-discovery");run.disabled=!ready||discovery.status==="running";run.innerHTML=discovery.needsRefresh?"Refresh company results <span>↻</span>":discovery.status==="running"?({extracting:"Identifying companies…",resolving:"Resolving domains…",verifying:"Verifying companies…",following:"Finding more companies…"}[discoveryProgress.phase]||"Finding companies…"):discovery.status==="no_results"?(companyExtractionMiss()?(discovery.extraction?.status==="fallback"?"Review AI settings <span>→</span>":"Review Market Research <span>→</span>"):main.market?.researchMode==="quick"?"Review Market Research <span>→</span>":"Review Strategy <span>→</span>"):discovery.status==="error"?"Retry company search <span>↻</span>":discovery.lastRunAt?"Find more companies <span>↻</span>":"Find companies <span>→</span>";}
function renderAll(){if(!discoveryMounted)return;renderStatus();renderDiscoveryFunnel();renderCandidates();renderPotentialMatches();renderPipeline();}
function renderDiscoverySafely(){try{renderAll();return true;}catch(error){console.error("Companies page render failed",error);const run=$("run-company-discovery");if(run){run.disabled=discovery?.status==="running";run.innerHTML=discovery?.status==="running"?"Finding companies…":discovery?.status==="error"?"Retry company search <span>↻</span>":discovery?.lastRunAt?"Find more companies <span>↻</span>":"Find companies <span>→</span>";}return false;}}
function bindDiscovery(){
  $("continue-to-discovery")?.addEventListener("click",showDiscoveryStep);$("back-to-strategy")?.addEventListener("click",showStrategyStep);$("run-company-discovery")?.addEventListener("click",()=>{if(discovery.status==="no_results"){reviewDiscoveryGuidance();return;}runCompanyDiscovery();});$("discovery-target-count")?.addEventListener("change",()=>{persistDiscoveryTarget();renderStatus();const custom=$("discovery-target-custom");if(custom&&!custom.hidden)custom.focus();});$("discovery-target-custom")?.addEventListener("input",()=>{persistDiscoveryTarget();renderStatus();});$("activate-market-strategy")?.addEventListener("click",()=>setTimeout(renderStatus,0));
  $("company-candidates")?.addEventListener("click",event=>{const btn=event.target.closest("[data-action]");if(!btn)return;if(btn.dataset.action==="review-strategy"){showStrategyStep();return;}if(btn.dataset.action==="review-research"){reviewMarketResearch();return;}if(btn.dataset.action==="open-ai-settings"){document.getElementById("open-settings")?.click();return;}const index=Number(btn.dataset.companyIndex);const personIndex=Number(btn.dataset.personIndex);if(btn.dataset.action==="find-decision-makers"){setJourneyFocus("buyers",{scroll:false});findDecisionMakers(index);}if(btn.dataset.action==="enrich-contact")enrichContact(index,personIndex,{phoneLookup:false});if(btn.dataset.action==="find-phone")enrichContact(index,personIndex,{phoneLookup:true});if(btn.dataset.action==="refresh-phone")refreshEnrichedContact(index,personIndex);if(btn.dataset.action==="save-crm")saveCandidate(index,{pipeline:false});if(btn.dataset.action==="add-pipeline")saveCandidate(index,{pipeline:true});});
  $("discovery-funnel")?.addEventListener("click",event=>{if(event.target.closest('[data-action="open-provider-settings"]')){document.getElementById("open-settings")?.click();return;}const btn=event.target.closest('[data-action="retry-failed-checks"]');if(btn)retryFailedDiscoveryChecks();});
  $("discovery-potential-matches")?.addEventListener("click",event=>{const btn=event.target.closest('[data-action="find-potential-buyers"]');if(btn)findPotentialDecisionMakers(btn.dataset.domain);});
  $("customer-pipeline")?.addEventListener("change",event=>{const select=event.target.closest("[data-pipeline-stage]");if(select)changePipelineStage(select);});
  $("customer-pipeline")?.addEventListener("click",event=>{const buyer=event.target.closest("[data-find-pipeline-buyers]");if(buyer){findPipelineDecisionMakers(buyer.dataset.findPipelineBuyers);return;}const remove=event.target.closest("[data-pipeline-remove]");if(remove){removePipelineCompany(remove.dataset.pipelineRemove,remove.dataset.domain);return;}const open=event.target.closest("[data-open-crm-company]");if(open)document.getElementById("open-crm")?.click();});
  $("reset-workspace")?.addEventListener("click",()=>setTimeout(()=>{if(!localStorage.getItem(MAIN_STORAGE_KEY)){localStorage.removeItem(DISCOVERY_STORAGE_KEY);localStorage.removeItem(`${DISCOVERY_STORAGE_KEY}_meta`);discovery=LeadIntelDiscovery.normalizeDiscoveryState({});crmCompanies=[];crmPipeline=[];crmAvailable=false;enrichmentResults.clear();enrichmentPending.clear();}},0));
  window.addEventListener("leadintel:open-discovery",event=>showDiscoveryStep(event.detail?.focus||"companies"));window.addEventListener("leadintel:module-opened",event=>{if(Number(event.detail?.step)!==5)return;syncStrategyFingerprint();saveMeta({...loadMeta(),visibleStep:5});renderAll();renderDiscoveryFocus(loadMeta().activeJourneyStage===5?"buyers":"companies");if(crmAuthenticated())refreshCrmState();});
  window.addEventListener("leadintel:website-activated",()=>{
    resetLocalDownstreamState();
    syncStrategyFingerprint();
    renderAll();
  });
  window.addEventListener("leadintel:server-ready",()=>refreshCrmState());
  window.addEventListener("leadintel:crm-migrated",()=>refreshCrmState());
  window.addEventListener("leadintel:crm-changed",()=>refreshCrmState());
}
function loadOutreachModules(){if(document.querySelector('script[data-outreach-engine]'))return;const engine=document.createElement("script");engine.src=`outreach-engine.js?v=${OUTREACH_ASSET_VERSION}`;engine.dataset.outreachEngine="true";engine.addEventListener("load",()=>{const localization=document.createElement("script");localization.src=`outreach-localization.js?v=${OUTREACH_ASSET_VERSION}`;localization.dataset.outreachLocalization="true";localization.addEventListener("load",()=>{if(document.querySelector('script[data-outreach-ui]'))return;const ui=document.createElement("script");ui.type="module";ui.src=`outreach-ui.js?v=${OUTREACH_ASSET_VERSION}`;ui.dataset.outreachUi="true";document.body.appendChild(ui);});document.body.appendChild(localization);});document.body.appendChild(engine);}
function openDiscoveryFromHandoff(options={}){if(!moduleReady())return false;showDiscoveryStep(options.focus||"companies");return Boolean($("step-5")?.classList.contains("active"));}
function ensureDiscoveryMounted(){if(discoveryMounted)return;discovery=loadDiscovery();discoveryMounted=true;syncStrategyFingerprint();renderAll();if(recoveredInterruptedRun){saveDiscovery();setTimeout(()=>showToast("Previous company search was interrupted. You can run it again."),0);}if(crmAuthenticated())refreshCrmState();loadOutreachModules();}
function initDiscovery(){if(window.LeadIntelDiscoveryUI?.open)return;injectDiscoveryUI();bindDiscovery();window.LeadIntelDiscoveryUI={open:openDiscoveryFromHandoff};window.LeadIntelDiscoveryUI.getPipeline=pipelineRows;window.LeadIntelDiscoveryUI.firecrawlHealth=()=>{const state=discovery||loadDiscovery();return {lastRunAt:state.lastRunAt||"",blocked:(state.searchFailures||[]).some(item=>Number(item.status)===402),usedFallback:Number(state.funnel?.openAiFallbackSearches)||0};};if(window.__leadIntelPendingDiscoveryOpen&&openDiscoveryFromHandoff())window.__leadIntelPendingDiscoveryOpen=false;else if(mainState().step===5&&moduleReady())showDiscoveryStep();else if(loadMeta().visibleStep===5&&moduleReady())showDiscoveryStep();}
function initDiscoveryWhenReady(attempt=0){if(!window.LeadIntelDiscovery){if(attempt<400)setTimeout(()=>initDiscoveryWhenReady(attempt+1),25);return;}initDiscovery();}
initDiscoveryWhenReady();
