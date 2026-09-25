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
const ASSET_VERSION="20260925-company-search-resilience-v1";
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
const DISCOVERY_RUN_TIMEOUT_MIN_MS=120000;
const DISCOVERY_RUN_TIMEOUT_MARGIN_MS=20000;
function linkedAbortController(parentSignal){const controller=new AbortController();if(parentSignal?.aborted)controller.abort(parentSignal.reason);else parentSignal?.addEventListener?.("abort",()=>controller.abort(parentSignal.reason),{once:true});return controller;}
// Budget every bounded provider wave plus named-company extraction, then leave a small scheduler/network margin.
function discoveryRunTimeoutMs(targetCount,queryCount){const entityQueries=Math.max(1,Math.min(MAX_DISCOVERY_COMPANY_CHECKS,(Number(targetCount)||10)*2));const marketWaves=Math.ceil((Math.max(1,Number(queryCount)||4)+MAX_DISCOVERY_FOLLOW_UP_QUERIES)/DISCOVERY_SEARCH_CONCURRENCY);const entityWaves=Math.ceil(entityQueries/DISCOVERY_SEARCH_CONCURRENCY);const requestWaves=marketWaves+(entityWaves*2)+2;return Math.max(DISCOVERY_RUN_TIMEOUT_MIN_MS,requestWaves*DISCOVERY_REQUEST_TIMEOUT_MS+DISCOVERY_RUN_TIMEOUT_MARGIN_MS);}
function throwIfDiscoveryRunAborted(signal){if(!signal?.aborted)return;const reason=signal.reason;if(reason instanceof Error)throw reason;const error=new Error("Company discovery was canceled");error.name="AbortError";throw error;}
async function firecrawlCompanySearch(queryMeta,runSignal){
  const controller=linkedAbortController(runSignal);
  const timeout=setTimeout(()=>controller.abort(),DISCOVERY_REQUEST_TIMEOUT_MS);
  try{
    const response=await fetch(`${INTELLIGENCE_PROXY}/firecrawl-search`,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({query:queryMeta.query,limit:MAX_DISCOVERY_RESULTS_PER_QUERY,scrapeOptions:{formats:["markdown"],onlyMainContent:true}}),signal:controller.signal});
    const payload=await response.json().catch(()=>({}));
    if(!response.ok)throw new Error(payload.error||`Company search returned ${response.status}`);
    return LeadIntelDiscovery.normalizeCompanySearchResults(payload,queryMeta);
  }catch(error){
    if(error?.name==="AbortError")throw new Error("Company search timed out");
    throw error;
  }finally{
    clearTimeout(timeout);
  }
}
async function runDiscoverySearchBatch(items,phase,runSignal,searches=Array(items.length).fill(null)){
  discoveryProgress={phase,completed:0…33861 tokens truncated…n><option value="monthly">Monthly</option></select></label>
              <label><span>Research depth</span><select id="monitoring-depth"><option value="quick">Quick</option><option value="deep" selected>Deep</option></select></label>
              <label><span>Minimum alert score</span><input id="monitoring-minimum-score" type="number" min="1" max="100" value="70"></label>
            </div>
            <div class="monitoring-actions"><button class="primary-btn" id="save-monitoring" type="button">Save monitoring settings</button><button class="secondary-btn" id="run-monitoring-now" type="button">Run monitoring now</button><span id="monitoring-status" class="research-status">Activate the market strategy before enabling monitoring.</span></div>
            <details class="progressive-disclosure monitoring-advanced" id="monitoring-advanced">
              <summary>Advanced monitoring settings</summary>
              <label class="monitoring-custom"><span>Custom public sources · one URL per line</span><textarea id="monitoring-custom-sources" rows="2" placeholder="https://example.com/news"></textarea></label>
              <div class="monitoring-selection"><div><strong>Signals to monitor</strong><div id="monitoring-signals" class="monitoring-chips"></div></div><div><strong>Source categories</strong><div id="monitoring-sources" class="monitoring-chips"></div></div></div>
              <div class="monitoring-results"><div><h4>New opportunity alerts</h4><div id="monitoring-alerts" class="monitoring-list"><div class="market-empty">No monitoring alerts yet.</div></div></div><div><h4>Monitoring history</h4><div id="monitoring-history" class="monitoring-list"><div class="market-empty">No automatic runs yet.</div></div></div></div>
            </details>
          </section>

          <div class="approval-card strategy-activation" id="strategy-activation-card">
            <div><span class="eyebrow" id="strategy-activation-step">Final step</span><h3 id="strategy-activation-title">Ready to find matching companies</h3><p id="strategy-activation-description">Review the active strategy before finding companies.</p><p class="strategy-activation-feedback" id="strategy-activation-feedback" role="status" aria-live="polite" hidden></p></div>
            <button class="primary-btn stage-next-action" id="activate-market-strategy" type="button" aria-haspopup="dialog" aria-controls="strategy-handoff-dialog">Review & Continue to Companies →</button>
          </div>

          <dialog class="strategy-handoff-dialog" id="strategy-handoff-dialog" aria-labelledby="strategy-handoff-title">
            <form method="dialog" class="strategy-handoff-card">
              <div class="strategy-handoff-head"><span class="eyebrow">Companies review</span><h3 id="strategy-handoff-title">Review before finding companies</h3><p>Confirm exactly what LeadIntel will use to find and rank companies.</p></div>
              <div class="strategy-handoff-summary" id="strategy-handoff-summary"></div>
              <section class="strategy-handoff-notice strategy-handoff-blockers" id="strategy-handoff-blockers" hidden><strong>Complete before continuing</strong><ul></ul></section>
              <section class="strategy-handoff-notice strategy-handoff-warnings" id="strategy-handoff-warnings" hidden><strong>Optional notes</strong><ul></ul></section>
              <div class="strategy-handoff-repair-actions" id="strategy-handoff-repair-actions" hidden><button class="secondary-btn" id="review-buying-signals" type="button">Review buying signals</button><button class="secondary-btn" id="retry-signal-recommendations" type="button">Retry signal recommendations</button></div>
              <div class="strategy-handoff-actions"><button class="secondary-btn" id="cancel-strategy-handoff" type="button">Back to Strategy</button><button class="primary-btn" id="confirm-strategy-handoff" type="button">Activate Strategy & Continue →</button></div>
            </form>
          </dialog>
        </section>
      </main>
      <aside class="utility-panel" aria-label="Workspace tools">
        <section class="utility-card utility-ai">
          <span class="eyebrow">AI support</span>
          <button class="leadintel-copilot-entry" id="leadintel-copilot-entry" type="button" aria-haspopup="dialog"><span class="copilot-entry-copy"><strong class="copilot-entry-title">Ask LeadIntel ✦</strong><small class="copilot-entry-subtitle">AI Commercial Copilot</small></span><span class="copilot-entry-badge" data-copilot-badge aria-live="polite"></span></button>
          <p>Get help interpreting evidence or deciding the next commercial action.</p>
        </section>
        <section class="utility-card utility-attention">
          <button class="attention-trigger" id="workspace-attention" type="button" aria-haspopup="dialog" aria-expanded="false" aria-controls="workspace-attention-drawer"><span><small class="eyebrow">Workspace health</small><strong>Attention</strong><em data-attention-summary>Checking workspace…</em></span><b data-attention-count hidden>0</b></button>
        </section>
        <section class="utility-card utility-settings">
          <span class="eyebrow">Workspace controls</span>
          <h3>Settings</h3>
          <p>Manage AI providers, integrations and delivery connections.</p>
          <button class="secondary-btn" id="open-settings" type="button" aria-haspopup="dialog" aria-controls="ai-settings-drawer">Open settings</button>
        </section>
        <div class="utility-task-slot" data-utility-tasks></div>
      </aside>
    </div>
  </div>
  <dialog class="market-research-window" id="market-research-window" aria-labelledby="market-research-window-title" aria-describedby="market-research-window-message">
    <section class="market-research-window-card">
      <header class="market-research-window-head">
        <div><span class="eyebrow">Market research in progress</span><h2 id="market-research-window-title" data-research-window-title>Researching your selected market</h2></div>
        <strong class="market-research-window-percent" data-research-window-percent>0%</strong>
        <button class="secondary-btn" type="button" data-minimize-research-window>Minimize</button>
      </header>
      <p class="market-research-window-phase" data-research-window-phase aria-live="polite">Finding evidence</p>
      <div class="market-research-window-track" role="progressbar" aria-label="Market research progress" aria-valuemin="0" aria-valuemax="100" aria-valuenow="0" data-research-window-progress><i data-research-window-bar></i></div>
      <p class="market-research-window-meta" data-research-window-meta></p>
      <section class="market-research-window-insight" aria-label="Research update">
        <span class="eyebrow" data-research-window-insight-label>Market Research insight</span>
        <p id="market-research-window-message" data-research-window-message aria-live="polite">LeadIntel is preparing the search.</p>
      </section>
      <footer class="market-research-window-footer"><span>Minimizing keeps the search running.</span><button class="secondary-btn" type="button" data-minimize-research-window>Minimize window</button></footer>
    </section>
  </dialog>
  <button class="market-research-progress-dock" type="button" data-reopen-research-window aria-haspopup="dialog" aria-controls="market-research-window" aria-expanded="false" hidden>
    <span class="eyebrow">Research continues</span><strong data-research-dock-title>Market research</strong><small data-research-dock-phase>Finding evidence</small><i class="market-research-dock-track"><b data-research-dock-bar></b></i><span class="market-research-dock-action">Show progress</span>
  </button>
  <div class="toast" id="toast" role="status" aria-live="polite"></div>
  <script defer src="background-task-centre.js?v=20260917-shell-stability-v1"></script>
  <!-- Optional company-research-ui.js is deferred by shell-support-loader.js. -->
  <script defer src="content-variants.js?v=20260921-contact-gated-v2"></script>
  <script defer src="step2-brief-schema.js?v=20260916-commercial-brief-v1"></script>
  <script defer src="profile-engine.js?v=20260922-step3-signal-backfill-v1&profile-overview-hygiene=1"></script>
  <script defer src="market-engine.js?v=20260924-friendly-workflow-labels-v1&adaptive-evidence=1"></script>
  <script defer src="market-conditions-engine.js?v=20260922-market-conditions-v1&adaptive-evidence=1"></script>
  <script defer src="market-research-verification.js?v=20260916-gemini-verification-v1"></script>
<script defer src="profile-enrichment-checkpoint.js?v=20260921-profile-enrichment-v2"></script>
<script defer src="profile-enrichment-checkpoint-ui.js?v=20260924-friendly-workflow-labels-v1"></script>
  <script defer src="workflow-next-action.js?v=20260925-buyers-stage-view-v1"></script>
<script defer src="discovery-engine.js?v=20260925-company-search-resilience-v1"></script>
  <script defer src="workspace-isolation.js?v=20260914-workspace-isolation-v1"></script>
  <script defer src="workspace-reset-hygiene.js?v=20260917-task-reset-v1&reset-center=1"></script>
  <script defer src="website-activation.js?v=20260916-ercon-context-v1"></script>

  <script defer src="server-bridge.js?v=20260925-apollo-buyer-search-v1" data-server-bridge="true"></script>
  <script defer src="brand-identity.js?v=20260916-brand-timestamp-v1"></script>
  <script defer src="brand-identity-ui.js?v=20260916-browser-logo-copy-v2"></script>
  <script defer src="journey-progress.js?v=20260924-friendly-workflow-labels-v1"></script>
  <script defer src="process-map.js?v=20260924-friendly-workflow-labels-v1"></script>
  <script defer src="attention-centre-model.js?v=20260924-openai-credit-health-v1"></script>
  <script defer src="attention-centre.js?v=20260924-openai-credit-health-v1"></script>
  <script type="module" src="app.js?v=20260924-friendly-workflow-labels-v1&icp-data-gates=1&reset-center=1&quick-insights=1&adaptive-evidence=1&strategy-handoff-copy=1&profile-overview-hygiene=1&workspace-content-english=1"></script>
  <script type="module" src="ai-settings.js?v=20260917-shell-stability-v1"></script>
  <script type="module" src="copilot-loader.js?v=20260924-friendly-workflow-labels-v1"></script>
  <script type="module" src="shell-support-loader.js?v=20260924-friendly-workflow-labels-v1&reset-center=1"></script>
  <script defer src="discovery-ui.js?v=20260925-company-search-resilience-v1"></script>
</body>
</html>
