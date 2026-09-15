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
const ASSET_VERSION="20260915-error-sweep-v1";
const LANGUAGE_ASSET_VERSION="20260914-workspace-isolation-v1";
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
const enrichmentResults=new Map();
const enrichmentPending=new Set();
function contentLanguage(){const main=mainState();return LeadIntelContentLanguage.resolveLanguage(window.LeadIntelLanguage?.get?.()||main.uiLanguage||'lv',navigator.languages||[]);}

function esc(value){return String(value??"").replace(/[&<>'"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;","'":"&#39;",'"':"&quot;"}[c]));}
function mainState(){try{return JSON.parse(localStorage.getItem(MAIN_STORAGE_KEY)||"{}");}catch{return {};}}
function bridge(){return window.LeadIntelServerBridge||null;}
function crmAuthenticated(){const b=bridge();return Boolean(b?.session?.authenticated&&b?.workspace);}
function persistMainStep(step){const marker=document.querySelector(`[data-step-marker="${step}"]`);if(marker&&!marker.classList.contains("active")){marker.dispatchEvent(new MouseEvent("click",{bubbles:true}));return;}const main=mainState();main.step=step;localStorage.setItem(MAIN_STORAGE_KEY,JSON.stringify(main));}
function loadDiscovery(){try{const normalized=LeadIntelDiscovery.normalizeDiscoveryState(JSON.parse(localStorage.getItem(DISCOVERY_STORAGE_KEY)||"{}"));const recovered=LeadIntelDiscovery.recoverInterruptedDiscoveryState?LeadIntelDiscovery.recoverInterruptedDiscoveryState(normalized):normalized;recoveredInterruptedRun=normalized.status==="running"&&recovered.status!=="running";return recovered;}catch{return LeadIntelDiscovery.normalizeDiscoveryState({});}}
function saveDiscovery(){localStorage.setItem(DISCOVERY_STORAGE_KEY,JSON.stringify(discovery));}
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
    showToast("Market Strategy changed · discovery candidates were refreshed");
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
  const steps=document.querySelector(".steps");if(steps&&!steps.querySelector('[data-step-marker="5"]'))steps.insertAdjacentHTML("beforeend",'<li data-step-marker="5"><span>05</span><div><strong>Company discovery</strong><small>Companies, people, pipeline</small></div></li>');
  const activation=$("strategy-activation-card");if(activation&&!$("continue-to-discovery"))activation.insertAdjacentHTML("beforeend",'<button class="secondary-btn discovery-continue" id="continue-to-discovery" type="button">Continue to Discovery →</button>');
  const content=document.querySelector("main.content");if(content&&!$("step-5"))content.insertAdjacentHTML("beforeend",`<section class="step-view" id="step-5" data-step="5">
    <div class="profile-header discovery-header"><div><span class="eyebrow">Step 5 · Company Discovery</span><h1>Find companies worth approaching now.</h1><p>LeadIntel searches with the context currently available, removes obvious non-company sources, deduplicates domains and ranks each company using evidence—not a generic lead list. A formally activated strategy improves precision but is not required to explore.</p></div><div class="profile-header-actions"><span class="profile-status" id="discovery-status">Ready</span><button class="secondary-btn small" id="back-to-strategy" type="button">← Strategy</button></div></div>
    <div class="strategy-banner discovery-banner"><div><span>Company</span><strong id="discovery-company">—</strong></div><div><span>Market context</span><strong id="discovery-markets">—</strong></div><div><span>Active pipeline</span><strong id="discovery-pipeline-count">0</strong></div></div>
    <section class="panel strategy-panel discovery-panel"><div class="market-research-head"><div class="section-title"><span class="eyebrow">Discovery Engine</span><h3>Search for real company domains</h3><p>Start with 10 companies, or choose a larger or custom target.</p></div><div class="discovery-controls"><div class="discovery-target-control"><label class="discovery-target-label" for="discovery-target-count">Choose amount</label><div class="discovery-control-row"><select id="discovery-target-count" aria-describedby="discovery-target-help"><option value="10">10 companies</option><option value="25">25 companies</option><option value="50">50 companies</option><option value="custom">Custom number</option></select><button class="primary-btn discovery-run-btn" id="run-company-discovery" type="button">Find companies <span>→</span></button></div><input class="discovery-target-custom" id="discovery-target-custom" type="number" min="1" max="50" step="1" inputmode="numeric" placeholder="Enter number" aria-label="Custom companies to find" hidden><small id="discovery-target-help">Start with 10. Custom targets: 1–50 companies.</small></div></div></div>
      <div class="score-legend company-score-legend"><strong>Opportunity score</strong><span>Fit</span><span>Signal</span><span>Evidence</span><span>Timing</span><span>Value</span></div>
      <div class="research-status" id="company-discovery-status">Website-only provisional discovery is ready. Optional market context improves precision.</div><div class="company-candidates" id="company-candidates"></div></section>
    <section class="panel strategy-panel pipeline-panel"><div class="section-title"><span class="eyebrow">Customer Pipeline</span><h3>Active commercial opportunities</h3><p>When signed in, this is a durable Master CRM view. Removing a company from Pipeline preserves its CRM record, intelligence, contacts and activity history. Strong opportunities continue to the Content & Outreach Studio.</p></div><div class="customer-pipeline" id="customer-pipeline"></div></section>
  </section>`);
}
function showDiscoveryStep(){if(!moduleReady()){showToast("Add your company website first");return;}ensureDiscoveryMounted();persistMainStep(5);syncStrategyFingerprint();document.querySelectorAll(".step-view").forEach(el=>el.classList.toggle("active",Number(el.dataset.step)===5));document.querySelectorAll("[data-step-marker]").forEach(el=>{const n=Number(el.dataset.stepMarker);el.classList.toggle("active",n===5);el.classList.toggle("complete",n<5);});saveMeta({...loadMeta(),visibleStep:5});renderAll();if(crmAuthenticated())refreshCrmState();window.scrollTo({top:0,behavior:"smooth"});}
function showStrategyStep(){persistMainStep(4);document.querySelectorAll(".step-view").forEach(el=>el.classList.toggle("active",Number(el.dataset.step)===4));document.querySelectorAll("[data-step-marker]").forEach(el=>{const n=Number(el.dataset.stepMarker);el.classList.toggle("active",n===4);el.classList.toggle("complete",n<4);});saveMeta({...loadMeta(),visibleStep:4});window.scrollTo({top:0,behavior:"smooth"});}

const DISCOVERY_REQUEST_TIMEOUT_MS=25000;
const DISCOVERY_RUN_TIMEOUT_MS=25000;
function linkedAbortController(parentSignal){const controller=new AbortController();if(parentSignal?.aborted)controller.abort(parentSignal.reason);else parentSignal?.addEventListener?.("abort",()=>controller.abort(parentSignal.reason),{once:true});return controller;}
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
async function runDiscoverySearchBatch(items,phase,runSignal){
  const searches=Array(items.length).fill(null);
  discoveryProgress={phase,completed:0,total:items.length};renderDiscoverySafely();
  let nextIndex=0;
  const workers=Array.from({length:Math.min(DISCOVERY_SEARCH_CONCURRENCY,items.length)},async()=>{
    while(nextIndex<items.length){
      const index=nextIndex++;
      try{if(runSignal?.aborted)throw new Error("Company search timed out");searches[index]={results:await firecrawlCompanySearch(items[index],runSignal),error:null};}
      catch(error){searches[index]={results:[],error};}
      finally{discoveryProgress.completed+=1;renderDiscoverySafely();}
    }
  });
  await Promise.all(workers);
  return searches;
}
async function extractCompaniesFromEvidence(evidence,market,targetCount,runSignal){
  const fallback=LeadIntelDiscovery.extractCompanyMentions(evidence,targetCount);
  const b=bridge();const workspace=b?.workspace;
  if(!b?.session?.authenticated||!workspace?.id||!evidence.length)return fallback;
  discoveryProgress={phase:"extracting",completed:0,total:1};renderDiscoverySafely();
  const sources=evidence.slice(0,16).map((item,index)=>({
    id:`E${index+1}`,url:item.url,market:item.market,title:item.title,
    description:item.description,text:String(item.text||"").slice(0,2200)
  }));
  const system="You extract prospective operating companies from supplied market evidence. Never invent a company or URL. Return strict JSON only.";
  const prompt=`Identify operating companies explicitly described as expanding, investing, building, modernising, hiring or otherwise matching the market signals in these sources. Publishers, government bodies, research institutes, directories and the seller itself are not prospects. Every company must include the exact supplied source URL where its name and event appear. Return {"companies":[{"company":"Exact company name","market":"${String(market||"").replace(/"/g,"'")}","sourceUrl":"Exact supplied URL"}]}. Evidence:\n${JSON.stringify(sources)}`;
  const controller=linkedAbortController(runSignal);const timeout=setTimeout(()=>controller.abort(),DISCOVERY_REQUEST_TIMEOUT_MS);
  try{
    const response=await fetch(`${LEADINTEL_API}/api/ai/generate?workspace_id=${encodeURIComponent(workspace.id)}`,{method:"POST",credentials:"include",headers:{"Content-Type":"application/json","Accept":"application/json"},body:JSON.stringify({system,prompt,max_output_tokens:1800}),signal:controller.signal});
    const payload=await response.json().catch(()=>({}));
    if(!response.ok)return fallback;
    const extracted=LeadIntelDiscovery.parseCompanyExtraction(payload.text,evidence,targetCount);
    const seen=new Set();return [...extracted,...fallback].filter(item=>{const key=item.company.toLowerCase();if(seen.has(key))return false;seen.add(key);return true;}).slice(0,targetCount);
  }catch{return fallback;}
  finally{clearTimeout(timeout);discoveryProgress.completed=1;renderDiscoverySafely();}
}
async function runCompanyDiscovery(){
  const main=mainState();
  if(!(main?.profile?.website||main?.website)){showToast("Add your company website first");return;}
  syncStrategyFingerprint();
  const market=main.market||{};
  if(!LeadIntelDiscovery.hasActiveSignals?.(market)){showToast("Activate at least one buying signal in Market Strategy before running discovery");return;}
  const targetCount=persistDiscoveryTarget();
  const limits=LeadIntelDiscovery.discoveryLimits(targetCount);
  const queries=LeadIntelDiscovery.buildDiscoveryQueries(main.profile||{website:main.website},market,limits.queryCount);
  if(!queries.length){showToast("Add optional market or offer context to make discovery more precise");return;}
  recoveredInterruptedRun=false;discovery.queries=queries;discovery.rawResults=[];discovery.candidates=[];enrichmentResults.clear();enrichmentPending.clear();discovery.status="running";
  try{saveDiscovery();}catch(error){discovery.status="error";renderDiscoverySafely();showToast("Discovery could not save its running state. You can try again.");return;}
  if(!renderDiscoverySafely()){discovery.status="error";try{saveDiscovery();}catch{}renderDiscoverySafely();showToast("Discovery interface could not start. You can try again.");return;}
  let failures=0;
  let fatalError=null;
  const runController=new AbortController();
  try{
    let searches=[];
    let resolutionSearches=[];
    let verificationSearches=[];
    let companyMentions=[];
    const allSearches=(async()=>{
      searches=await runDiscoverySearchBatch(queries,"searching",runController.signal);
      const firstPass=searches.flatMap(item=>item?.results||[]);
      const targetMarket=queries[0]?.market||main.profile?.targetMarkets||"";
      companyMentions=await extractCompaniesFromEvidence(firstPass,targetMarket,limits.targetCount,runController.signal);
      const resolutionQueries=LeadIntelDiscovery.buildCompanyResolutionQueries(companyMentions,main.profile||{website:main.website},limits.targetCount);
      resolutionSearches=await runDiscoverySearchBatch(resolutionQueries,"resolving",runController.signal);
      const resolved=resolutionSearches.flatMap(item=>item?.results||[]);
      const verificationQueries=LeadIntelDiscovery.buildCandidateVerificationQueries(resolved,main.profile||{website:main.website},market,limits.targetCount);
      verificationSearches=await runDiscoverySearchBatch(verificationQueries,"verifying",runController.signal);
    })();
    let runTimeout;
    const timedOut=await Promise.race([
      allSearches.then(()=>false),
      new Promise(resolve=>{runTimeout=setTimeout(()=>{runController.abort(new DOMException("Discovery run deadline reached","TimeoutError"));resolve(true);},DISCOVERY_RUN_TIMEOUT_MS);})
    ]);
    clearTimeout(runTimeout);
    if(timedOut)await allSearches.catch(()=>{});
    const completedSearches=[...searches,...resolutionSearches,...verificationSearches].filter(Boolean);
    const expectedSearches=queries.length+resolutionSearches.length+verificationSearches.length;
    failures=completedSearches.filter(item=>item.error).length+(timedOut?Math.max(0,expectedSearches-completedSearches.length):0);
    const firstPass=searches.flatMap(item=>item?.results||[]);
    const resolved=resolutionSearches.flatMap(item=>item?.results||[]);
    const verified=verificationSearches.flatMap(item=>item?.results||[]);
    const evidenceLinked=LeadIntelDiscovery.attachSourceEvidenceToResolvedCompanies(resolved,companyMentions,firstPass);
    discovery.rawResults=[...firstPass,...resolved,...verified].slice(0,50);
    discovery.candidates=LeadIntelDiscovery.mergeCompanyCandidates([...evidenceLinked,...verified],main.profile||{website:main.website},main.market||{},limits.targetCount);
    discovery.status=timedOut?discovery.candidates.length?"partial":"error":failures===0?"complete":discovery.candidates.length?"partial":"error";
    if(timedOut)fatalError=new Error("Company search timed out safely. Partial results were kept.");
  }catch(error){
    fatalError=error instanceof Error?error:new Error(String(error||"Company discovery failed"));
    discovery.status=discovery.candidates.length?"partial":"error";
  }
  discovery.lastRunAt=new Date().toISOString();
  discoveryProgress={phase:"complete",completed:discoveryProgress.completed,total:discoveryProgress.total};
  try{saveDiscovery();}catch(error){console.error("Company Discovery state could not be saved",error);}
  renderDiscoverySafely();
  if(crmAuthenticated()){
    void refreshCrmState({render:false}).then(()=>renderAll()).catch(error=>{
      showToast("CRM refresh unavailable · "+(error?.message||"results remain available"));
    });
  }
  if(fatalError){
    showToast("Discovery stopped safely · "+fatalError.message);
    return;
  }
  const targetNote=targetCount?" · target up to "+targetCount:"";
  const issueNote=failures?" · "+failures+" search issue"+(failures===1?"":"s"):"";
  showToast(discovery.candidates.length?discovery.candidates.length+" qualified companies found"+targetNote+issueNote:"No companies passed buyer, market, and signal verification");
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
function renderCandidates(){const target=$("company-candidates");if(!target)return;if(!discovery.candidates.length){const message=discovery.status==="running"?(discoveryProgress.phase==="verifying"?"Checking candidate websites for market, buyer-role, and buying-signal evidence…":"Finding candidate company domains…"):discovery.lastRunAt?"No company had enough verified market, buyer-role, and buying-signal evidence. Try a deeper research plan or refine the active signals.":"Run discovery to create a ranked shortlist of direct company domains.";target.innerHTML=`<div class="market-empty">${message}</div>`;return;}target.innerHTML=discovery.candidates.map((c,index)=>{const crm=candidateCrmMeta(c);const crmLabel=crm.suppressed?"Suppressed":crm.company?"In CRM ✓":"Save to CRM";const pipelineLabel=crm.suppressed?"Suppressed":crm.inPipeline?`In Pipeline ✓ · ${crm.company.pipeline_stage}`:"Add to Pipeline";const crmDisabled=!crmAuthenticated()||crm.suppressed;const pipelineDisabled=crm.suppressed;return `<article class="company-card ${crm.inPipeline||c.saved?"saved":""}" data-company-index="${index}">
    <div class="company-card-top"><div><span class="opportunity-market">${esc(c.market||"Target market")}</span><h4>${esc(c.company)}</h4><a href="${esc(c.website)}" target="_blank" rel="noopener">${esc(c.domain)} ↗</a></div><div class="company-total"><strong>${c.score.total}</strong><span>/100</span></div></div>
    <div class="company-score-grid">${scoreCell("Fit",c.score.fit,30)}${scoreCell("Signal",c.score.signal,25)}${scoreCell("Evidence",c.score.evidence,20)}${scoreCell("Timing",c.score.timing,15)}${scoreCell("Value",c.score.value,10)}</div>
    <div class="candidate-meta"><span class="confidence ${String(c.confidence).toLowerCase()}">${esc(c.confidence)} confidence</span><span>${c.evidence.length} source${c.evidence.length===1?"":"s"}</span><span>${c.matchedSignals.length} matched signal${c.matchedSignals.length===1?"":"s"}</span>${crm.company?`<span>${esc(crmLabel)}</span>`:""}</div>
    <div class="matched-signals">${c.matchedSignals.length?c.matchedSignals.map(s=>`<span><strong>${esc(s.name)}</strong> · ${esc(s.matchedTerms.join(", "))}</span>`).join(""):'<span class="muted-signal">No active signal term found in the returned company evidence.</span>'}</div>
    <p class="candidate-narrative" lang="${contentLanguage()}">${esc(LeadIntelDiscovery.buildCandidateNarrative(c,contentLanguage()))}</p>
    <div class="candidate-evidence">${c.evidence.map(e=>`<a href="${esc(e.url)}" target="_blank" rel="noopener"><strong>${esc(e.title||c.domain)}</strong><small>${esc(e.description||e.text).slice(0,190)}</small></a>`).join("")}</div>
    <div class="decision-makers"><div class="decision-head"><strong>Decision makers</strong><button class="secondary-btn small" type="button" data-action="find-decision-makers" data-company-index="${index}" ${c.peopleStatus==="loading"?"disabled":""}>${c.people?.length?"Refresh people":"Find decision-makers"}</button></div>${peopleHtml(c,index)}</div>
    <div class="candidate-actions"><button class="secondary-btn small" type="button" data-action="save-crm" data-company-index="${index}" ${crmDisabled?"disabled":""}>${crmAuthenticated()?crmLabel:"Sign in for CRM"}</button><button class="primary-btn small" type="button" data-action="add-pipeline" data-company-index="${index}" ${pipelineDisabled?"disabled":""}>${pipelineLabel}</button></div>
  </article>`;}).join("");}

async function findDecisionMakers(index){const candidate=discovery.candidates[index];if(!candidate)return;if(!candidateIsActionable(candidate)){showToast("Company qualification is incomplete · run Discovery again");return false;}const main=mainState();const payload=LeadIntelDiscovery.buildApolloPeopleSearchPayload(candidate,main.profile||{});if(!payload.q_organization_domains_list.length){showToast("A verified company domain is required");return false;}candidate.peopleStatus="loading";saveDiscovery();renderCandidates();try{const response=await fetch(`${INTELLIGENCE_PROXY}/`,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(payload)});const data=await response.json().catch(()=>({}));if(!response.ok)throw new Error(data.error||`Apollo returned ${response.status}`);candidate.people=LeadIntelDiscovery.selectDecisionMakers(LeadIntelDiscovery.normalizeApolloPeople(data),main.profile||{},4);candidate.peopleStatus=candidate.people.length?"complete":"empty";if(candidate.saved)discovery.pipeline=LeadIntelDiscovery.upsertPipelineItem(discovery.pipeline,candidate);saveDiscovery();if(crmAuthenticated()&&crmCompanyByDomain(candidate.domain)){const mapped=window.LeadIntelCrm.mapDiscoveryCandidateToCrm(candidate);const saved=await bridge().saveCrmCompany(mapped);if(!saved.ok)showToast(saved.error||"CRM contact update failed");else await refreshCrmState({render:false});}renderAll();showToast(!candidate.people.length?'No relevant decision-makers returned':candidate.people.length<3?`Only ${candidate.people.length} relevant decision-maker${candidate.people.length===1?"":"s"} found`:`${candidate.people.length} relevant decision-makers found`);return true;}catch(error){candidate.peopleStatus="error";saveDiscovery();renderAll();showToast(error.message||"Apollo people search unavailable");return false;}}
function saveLocalPipeline(candidate){discovery.pipeline=LeadIntelDiscovery.upsertPipelineItem(discovery.pipeline,candidate);candidate.saved=true;saveDiscovery();}
async function ensureCrmCompany(candidate){let company=crmCompanyByDomain(candidate.domain||candidate.website);if(company?.lifecycle_status==="suppressed")throw Object.assign(new Error("Suppressed companies must be restored in CRM before enrichment"),{code:"CRM_COMPANY_SUPPRESSED"});if(company)return company;const mapped=window.LeadIntelCrm?.mapDiscoveryCandidateToCrm(candidate);if(!mapped)throw new Error("CRM mapping is unavailable");const saved=await bridge().saveCrmCompany(mapped);if(!saved.ok)throw Object.assign(new Error(saved.error||"CRM save failed"),{code:saved.code});company=saved.company;await refreshCrmState({render:false});return company;}
async function enrichContact(companyIndex,personIndex,{phoneLookup=false}={}){const candidate=discovery.candidates[companyIndex];const person=candidate?.people?.[personIndex];if(!candidate||!person)return false;if(!person.id){showToast("Apollo person identity is missing · refresh decision-makers");return false;}if(!crmAuthenticated()){showToast("Sign in to enrich contacts with Apollo");return false;}const key=personKey(candidate,person);if(enrichmentPending.has(key))return false;enrichmentPending.add(key);renderCandidates();try{const company=await ensureCrmCompany(candidate);const result=await bridge().enrichCrmContact(company.id,person,{phoneLookup,allowPersonalEmail:false});if(!result.ok)throw Object.assign(new Error(result.error||"Apollo contact enrichment failed"),{code:result.code});enrichmentResults.set(key,result);await refreshCrmState({render:false});renderAll();window.dispatchEvent(new CustomEvent("leadintel:crm-changed",{detail:{company_id:company.id,contact_id:result.contact?.id||null}}));if(phoneLookup)showToast(result.contact?.phone_number?`${person.name} · verified phone saved to Master CRM`:`${person.name} · phone lookup requested · use Refresh phone to check`);else showToast(result.contact?.work_email?`${person.name} · verified email saved to Master CRM`:`${person.name} · no verified company email returned`);return true;}catch(error){showToast(error.code==="CRM_APOLLO_CREDIT_LIMIT"?"Apollo credit limit reached":error.message||"Apollo contact enrichment failed");return false;}finally{enrichmentPending.delete(key);renderCandidates();}}
async function refreshEnrichedContact(companyIndex,personIndex){const candidate=discovery.candidates[companyIndex];const person=candidate?.people?.[personIndex];if(!candidate||!person?.id)return false;if(!crmAuthenticated()){showToast("Sign in to refresh Apollo contact status");return false;}const company=crmCompanyByDomain(candidate.domain||candidate.website);if(!company){showToast("Save this company to Master CRM before refreshing the phone");return false;}const key=personKey(candidate,person);if(enrichmentPending.has(key))return false;enrichmentPending.add(key);renderCandidates();try{const detail=await bridge().getCrmCompany(company.id);if(!detail.ok)throw new Error(detail.error||"Unable to refresh CRM contact");const contact=(detail.contacts||[]).find(item=>String(item.external_person_id||"")===String(person.id))||null;const previous=enrichmentResults.get(key)||{};const result={...previous,request:{...(previous.request||{}),status:contact?.phone_number?"verified":"pending_phone"},contact:contact||previous.contact||null};enrichmentResults.set(key,result);renderCandidates();showToast(contact?.phone_number?`${person.name} · verified phone loaded from Master CRM`:`${person.name} · phone lookup is still pending`);return Boolean(contact?.phone_number);}catch(error){showToast(error.message||"Unable to refresh phone status");return false;}finally{enrichmentPending.delete(key);renderCandidates();}}
async function saveCandidate(index,{pipeline=false}={}){const candidate=discovery.candidates[index];if(!candidate)return false;if(!candidateIsActionable(candidate)){showToast("Company qualification is incomplete · run Discovery again");return false;}if(!crmAuthenticated()){if(pipeline){saveLocalPipeline(candidate);renderAll();showToast(`${candidate.company} saved to local Pipeline · sign in for durable CRM`);return true;}showToast("Sign in with Google to save this company to Master CRM");return false;}const existing=crmCompanyByDomain(candidate.domain||candidate.website);if(existing?.lifecycle_status==="suppressed"){showToast("Suppressed companies must be restored in CRM before pipeline activation");return false;}const mapped=window.LeadIntelCrm.mapDiscoveryCandidateToCrm(candidate);const saved=await bridge().saveCrmCompany(mapped);if(!saved.ok){showToast(saved.code==="CRM_COMPANY_SUPPRESSED"?"Suppressed companies must be restored in CRM first":saved.error||"CRM save failed");return false;}const company=saved.company;if(pipeline){const activated=await bridge().addCrmToPipeline(company.id,"Discovered");if(!activated.ok){showToast(activated.code==="CRM_COMPANY_SUPPRESSED"?"Suppressed companies must be restored in CRM first":activated.error||"Pipeline update failed");return false;}saveLocalPipeline(candidate);}await refreshCrmState({render:false});renderAll();window.dispatchEvent(new CustomEvent("leadintel:crm-changed",{detail:{company}}));showToast(pipeline?`${candidate.company} added to durable Pipeline`:`${candidate.company} saved to Master CRM`);return true;}
function pipelineRows(){return crmAvailable?currentWorkspaceCrmPipeline().map(crmToLocalPipeline):discovery.pipeline;}
function renderPipeline(){const target=$("customer-pipeline");if(!target)return;const rows=pipelineRows();$("discovery-pipeline-count").textContent=String(rows.length);if(!rows.length){target.innerHTML='<div class="market-empty">No active opportunities yet. Save a ranked company when it deserves follow-up.</div>';return;}const stages=crmAvailable?(window.LeadIntelCrm?.STAGES||[]):LeadIntelDiscovery.CRM_STAGES;target.innerHTML=`<div class="pipeline-table"><div class="pipeline-row header"><span>Company</span><span>Score</span><span>People</span><span>Stage</span><span>Action</span></div>${rows.map((item,index)=>`<div class="pipeline-row" data-pipeline-row="${index}"><div><strong>${esc(item.company)}</strong><a href="${esc(item.website)}" target="_blank" rel="noopener">${esc(item.domain)}</a></div><span class="pipeline-score">${item.score?.total||0}</span><span>${item.people?.length||0}</span><select data-pipeline-stage="${index}" ${crmAvailable?`data-crm-id="${esc(item.crmId||item.id)}"`:""}>${stages.map(stage=>`<option ${stage===item.stage?"selected":""}>${esc(stage)}</option>`).join("")}</select><span class="pipeline-actions">${crmAvailable?`<button class="secondary-btn small" type="button" data-pipeline-remove="${esc(item.crmId||item.id)}" data-domain="${esc(item.domain)}">Remove</button><button class="secondary-btn small" type="button" data-open-crm-company="${esc(item.crmId||item.id)}">CRM</button>`:'<span>Local</span>'}</span></div>`).join("")}</div>`;}
async function changePipelineStage(select){const rows=pipelineRows();const item=rows[Number(select.dataset.pipelineStage)];if(!item)return;if(crmAvailable&&select.dataset.crmId){const stage=window.LeadIntelCrm?.normalizeCrmStage(select.value)||"Discovered";const result=await bridge().addCrmToPipeline(select.dataset.crmId,stage);if(!result.ok){showToast(result.error||"Pipeline stage update failed");await refreshCrmState();return;}await refreshCrmState({render:false});renderAll();window.dispatchEvent(new CustomEvent("leadintel:crm-changed",{detail:{company:result.company}}));showToast(`${item.company} moved to ${stage}`);return;}item.stage=LeadIntelDiscovery.CRM_STAGES.includes(select.value)?select.value:"Discovered";item.updatedAt=new Date().toISOString();saveDiscovery();renderPipeline();showToast(`${item.company} moved to ${item.stage}`);}
async function removePipelineCompany(id,domain){const result=await bridge()?.removeCrmFromPipeline(id);if(!result?.ok){showToast(result?.error||"Unable to remove company from Pipeline");return;}discovery.pipeline=discovery.pipeline.filter(item=>canonicalDomain(item.domain||item.website)!==canonicalDomain(domain));saveDiscovery();await refreshCrmState({render:false});renderAll();window.dispatchEvent(new CustomEvent("leadintel:crm-changed",{detail:{company:result.company}}));showToast("Removed from Pipeline · CRM history preserved");}
function renderStatus(){const main=mainState();const ready=Boolean(main?.profile?.website||main?.website);const formal=Boolean(main?.market?.strategyApproved);const target=selectedDiscoveryTarget();const targetControl=$("discovery-target-count");const customTarget=$("discovery-target-custom");const meta=loadMeta();const customMode=meta.targetMode==="custom"||targetControl?.value==="custom";if(targetControl)targetControl.value=customMode?"custom":String(target||DEFAULT_DISCOVERY_TARGET);if(customTarget){customTarget.hidden=!customMode;if(customMode&&document.activeElement!==customTarget)customTarget.value=String(target);}const gate=$("continue-to-discovery");if(gate){gate.hidden=!formal;gate.disabled=!ready;gate.textContent=ready?"Find matching companies →":"Add website first";}if(!$("discovery-status"))return;const phaseLabels={extracting:"Extracting",resolving:"Resolving",verifying:"Verifying"};const labels={idle:formal?"Ready":"Provisional",running:phaseLabels[discoveryProgress.phase]||"Searching",complete:"Complete",partial:"Partial",error:"Review"};$("discovery-status").textContent=labels[discovery.status]||"Ready";$("discovery-company").textContent=main.profile?.companyName||"Company";const markets=(main.market?.opportunities||[]).filter(x=>x.active!==false).map(x=>x.market).filter(Boolean);$("discovery-markets").textContent=[...new Set(markets)].join(" · ")||main.profile?.targetMarkets||main.profile?.currentMarkets?.join?.(" · ")||"Provisional";const targetNote=target?` · target up to ${target}`:"";const phaseText={extracting:"Identifying companies named in market evidence…",resolving:`Resolving official company domains · ${discoveryProgress.completed}/${discoveryProgress.total} checked…`,verifying:`Verifying company websites · ${discoveryProgress.completed}/${discoveryProgress.total} checked…`};const runningText=phaseText[discoveryProgress.phase]||`Finding market evidence · ${discoveryProgress.completed}/${discoveryProgress.total} searches checked…`;const text={idle:formal?"Ready to discover companies using the active Market Strategy.":"Website-only discovery is ready. Add optional market, ICP or signal context to improve precision.",running:runningText,complete:`Discovery complete · ${discovery.candidates.length} qualified companies from ${discovery.rawResults.length} evidence results${targetNote}.`,partial:`Discovery partially complete · ${discovery.candidates.length} qualified companies; one or more checks were unavailable${targetNote}.`,error:recoveredInterruptedRun?"The previous company search was interrupted. You can run it again.":"No company passed market, buyer-role, and buying-signal verification. No substitute companies were invented."};$("company-discovery-status").textContent=ready?(text[discovery.status]||text.idle):"Add your company website to enable Discovery.";const run=$("run-company-discovery");run.disabled=!ready||discovery.status==="running";run.innerHTML=discovery.status==="running"?({extracting:"Identifying companies…",resolving:"Resolving domains…",verifying:"Verifying companies…"}[discoveryProgress.phase]||"Finding companies…"):discovery.lastRunAt?"Find more companies <span>↻</span>":"Find companies <span>→</span>";}
function renderAll(){if(!discoveryMounted)return;renderStatus();renderCandidates();renderPipeline();}
function renderDiscoverySafely(){try{renderAll();return true;}catch(error){console.error("Company Discovery render failed",error);const run=$("run-company-discovery");if(run){run.disabled=discovery?.status==="running";run.innerHTML=discovery?.status==="running"?"Finding companies…":discovery?.lastRunAt?"Find more companies <span>↻</span>":"Find companies <span>→</span>";}return false;}}
function bindDiscovery(){
  $("continue-to-discovery")?.addEventListener("click",showDiscoveryStep);$("back-to-strategy")?.addEventListener("click",showStrategyStep);$("run-company-discovery")?.addEventListener("click",runCompanyDiscovery);$("discovery-target-count")?.addEventListener("change",()=>{persistDiscoveryTarget();renderStatus();const custom=$("discovery-target-custom");if(custom&&!custom.hidden)custom.focus();});$("discovery-target-custom")?.addEventListener("input",()=>{persistDiscoveryTarget();renderStatus();});$("activate-market-strategy")?.addEventListener("click",()=>setTimeout(renderStatus,0));
  $("company-candidates")?.addEventListener("click",event=>{const btn=event.target.closest("[data-action]");if(!btn)return;const index=Number(btn.dataset.companyIndex);const personIndex=Number(btn.dataset.personIndex);if(btn.dataset.action==="find-decision-makers")findDecisionMakers(index);if(btn.dataset.action==="enrich-contact")enrichContact(index,personIndex,{phoneLookup:false});if(btn.dataset.action==="find-phone")enrichContact(index,personIndex,{phoneLookup:true});if(btn.dataset.action==="refresh-phone")refreshEnrichedContact(index,personIndex);if(btn.dataset.action==="save-crm")saveCandidate(index,{pipeline:false});if(btn.dataset.action==="add-pipeline")saveCandidate(index,{pipeline:true});});
  $("customer-pipeline")?.addEventListener("change",event=>{const select=event.target.closest("[data-pipeline-stage]");if(select)changePipelineStage(select);});
  $("customer-pipeline")?.addEventListener("click",event=>{const remove=event.target.closest("[data-pipeline-remove]");if(remove){removePipelineCompany(remove.dataset.pipelineRemove,remove.dataset.domain);return;}const open=event.target.closest("[data-open-crm-company]");if(open)document.getElementById("open-crm")?.click();});
  $("reset-workspace")?.addEventListener("click",()=>setTimeout(()=>{if(!localStorage.getItem(MAIN_STORAGE_KEY)){localStorage.removeItem(DISCOVERY_STORAGE_KEY);localStorage.removeItem(`${DISCOVERY_STORAGE_KEY}_meta`);discovery=LeadIntelDiscovery.normalizeDiscoveryState({});crmCompanies=[];crmPipeline=[];crmAvailable=false;enrichmentResults.clear();enrichmentPending.clear();}},0));
  window.addEventListener("leadintel:open-discovery",showDiscoveryStep);window.addEventListener("leadintel:module-opened",event=>{if(Number(event.detail?.step)!==5)return;syncStrategyFingerprint();saveMeta({...loadMeta(),visibleStep:5});renderAll();if(crmAuthenticated())refreshCrmState();});
  window.addEventListener("leadintel:website-activated",()=>{
    resetLocalDownstreamState();
    syncStrategyFingerprint();
    renderAll();
  });
  window.addEventListener("leadintel:server-ready",()=>refreshCrmState());
  window.addEventListener("leadintel:crm-migrated",()=>refreshCrmState());
  window.addEventListener("leadintel:crm-changed",()=>refreshCrmState());
  window.addEventListener("leadintel:language-changed",renderAll);
}
function loadOutreachModules(){if(document.querySelector('script[data-outreach-engine]'))return;const engine=document.createElement("script");engine.src=`outreach-engine.js?v=${LANGUAGE_ASSET_VERSION}`;engine.dataset.outreachEngine="true";engine.addEventListener("load",()=>{if(document.querySelector('script[data-outreach-ui]'))return;const ui=document.createElement("script");ui.type="module";ui.src=`outreach-ui.js?v=${LANGUAGE_ASSET_VERSION}`;ui.dataset.outreachUi="true";document.body.appendChild(ui);});document.body.appendChild(engine);}
function openDiscoveryFromHandoff(){if(!moduleReady())return false;showDiscoveryStep();return Boolean($("step-5")?.classList.contains("active"));}
function ensureDiscoveryMounted(){if(discoveryMounted)return;discovery=loadDiscovery();discoveryMounted=true;syncStrategyFingerprint();renderAll();if(recoveredInterruptedRun){saveDiscovery();setTimeout(()=>showToast("Previous company search was interrupted. You can run it again."),0);}if(crmAuthenticated())refreshCrmState();loadOutreachModules();}
function initDiscovery(){if(window.LeadIntelDiscoveryUI?.open)return;injectDiscoveryUI();bindDiscovery();window.LeadIntelDiscoveryUI={open:openDiscoveryFromHandoff};if(window.__leadIntelPendingDiscoveryOpen&&openDiscoveryFromHandoff())window.__leadIntelPendingDiscoveryOpen=false;else if(mainState().step===5&&moduleReady())showDiscoveryStep();else if(loadMeta().visibleStep===5&&moduleReady())showDiscoveryStep();}
function initDiscoveryWhenReady(attempt=0){if(!window.LeadIntelDiscovery){if(attempt<400)setTimeout(()=>initDiscoveryWhenReady(attempt+1),25);return;}initDiscovery();}
initDiscoveryWhenReady();
