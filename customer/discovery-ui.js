const MAIN_STORAGE_KEY="leadintel_customer_v2_state";
const DISCOVERY_STORAGE_KEY="leadintel_customer_v2_discovery";
const INTELLIGENCE_PROXY="https://apollo-proxy.edgars-7e7.workers.dev";
const MAX_DISCOVERY_QUERIES=4;
const MAX_DISCOVERY_RESULTS_PER_QUERY=5;
const $=id=>document.getElementById(id);
let discovery=loadDiscovery();

function esc(value){return String(value??"").replace(/[&<>'"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;","'":"&#39;",'"':"&quot;"}[c]));}
function mainState(){try{return JSON.parse(localStorage.getItem(MAIN_STORAGE_KEY)||"{}");}catch{return {};}}
function loadDiscovery(){try{return LeadIntelDiscovery.normalizeDiscoveryState(JSON.parse(localStorage.getItem(DISCOVERY_STORAGE_KEY)||"{}"));}catch{return LeadIntelDiscovery.normalizeDiscoveryState({});}}
function saveDiscovery(){localStorage.setItem(DISCOVERY_STORAGE_KEY,JSON.stringify(discovery));}
function strategyReady(){return Boolean(mainState()?.market?.strategyApproved);}
function showToast(message){
  const toast=$("toast");if(!toast)return;
  toast.textContent=message;toast.classList.add("show");clearTimeout(showToast.t);showToast.t=setTimeout(()=>toast.classList.remove("show"),2600);
}
function fingerprint(){
  const main=mainState();const market=main.market||{};
  const payload={company:main.profile?.companyName||"",website:main.profile?.website||main.website||"",approved:market.strategyApprovedAt||"",icps:(market.icps||[]).filter(x=>x.active!==false).map(x=>[x.id,x.description,x.targetMarkets]),signals:(market.signals||[]).filter(x=>x.active!==false).map(x=>[x.id,x.weight,x.keywords]),opps:(market.opportunities||[]).filter(x=>x.active!==false).map(x=>[x.id,x.market,x.score?.total])};
  return JSON.stringify(payload);
}
function loadMeta(){try{return JSON.parse(localStorage.getItem(`${DISCOVERY_STORAGE_KEY}_meta`)||"{}");}catch{return {};}}
function saveMeta(meta){localStorage.setItem(`${DISCOVERY_STORAGE_KEY}_meta`,JSON.stringify(meta));}
function syncStrategyFingerprint(){
  const meta=loadMeta();const current=fingerprint();
  if(meta.fingerprint&&meta.fingerprint!==current){
    discovery=LeadIntelDiscovery.normalizeDiscoveryState({pipeline:discovery.pipeline});
    saveDiscovery();showToast("Market Strategy changed · discovery candidates were refreshed");
  }
  saveMeta({...meta,fingerprint:current});
}

function injectDiscoveryUI(){
  if(!document.querySelector('link[href="discovery.css"]')){const link=document.createElement("link");link.rel="stylesheet";link.href="discovery.css";document.head.appendChild(link);}
  const steps=document.querySelector(".steps");
  if(steps&&!steps.querySelector('[data-step-marker="5"]'))steps.insertAdjacentHTML("beforeend",'<li data-step-marker="5"><span>05</span><div><strong>Company discovery</strong><small>Companies, people, pipeline</small></div></li>');
  const future=document.querySelector(".future-stack");
  if(future)future.innerHTML='<span>Next module</span><p>Outreach & Messaging</p><p>Email / CRM Sync</p><p>Continuous Intelligence</p>';
  const activation=$("strategy-activation-card");
  if(activation&&!$("continue-to-discovery"))activation.insertAdjacentHTML("beforeend",'<button class="secondary-btn discovery-continue" id="continue-to-discovery" type="button" disabled>Continue to Discovery →</button>');
  const content=document.querySelector("main.content");
  if(content&&!$("step-5"))content.insertAdjacentHTML("beforeend",`<section class="step-view" id="step-5" data-step="5">
    <div class="profile-header discovery-header"><div><span class="eyebrow">Step 5 · Company Discovery</span><h1>Find companies worth approaching now.</h1><p>LeadIntel searches the activated markets, removes obvious non-company sources, deduplicates domains and ranks each company using evidence—not a generic lead list.</p></div><div class="profile-header-actions"><span class="profile-status" id="discovery-status">Ready</span><button class="secondary-btn small" id="back-to-strategy" type="button">← Strategy</button></div></div>
    <div class="strategy-banner discovery-banner"><div><span>Company</span><strong id="discovery-company">—</strong></div><div><span>Active markets</span><strong id="discovery-markets">—</strong></div><div><span>Saved pipeline</span><strong id="discovery-pipeline-count">0</strong></div></div>
    <section class="panel strategy-panel discovery-panel"><div class="market-research-head"><div class="section-title"><span class="eyebrow">Discovery Engine</span><h3>Search for real company domains</h3><p>One run uses at most four Firecrawl searches × five results. Social/news hosts are filtered and no missing companies are invented.</p></div><button class="primary-btn" id="run-company-discovery" type="button">Run company discovery <span>↻</span></button></div>
      <div class="score-legend company-score-legend"><strong>Company Opportunity Score</strong><span>Fit</span><span>Signal</span><span>Evidence</span><span>Timing</span><span>Value</span></div>
      <div class="research-status" id="company-discovery-status">Activate Market Strategy to start Discovery.</div><div class="company-candidates" id="company-candidates"></div></section>
    <section class="panel strategy-panel pipeline-panel"><div class="section-title"><span class="eyebrow">Customer Pipeline</span><h3>Saved commercial opportunities</h3><p>Saving the same company twice updates it instead of creating a duplicate. Advance stages manually until CRM sync is connected.</p></div><div class="customer-pipeline" id="customer-pipeline"></div></section>
  </section>`);
}
function showDiscoveryStep(){
  if(!strategyReady()){showToast("Activate Market Strategy before Discovery");return;}
  syncStrategyFingerprint();
  document.querySelectorAll(".step-view").forEach(el=>el.classList.toggle("active",Number(el.dataset.step)===5));
  document.querySelectorAll("[data-step-marker]").forEach(el=>{const n=Number(el.dataset.stepMarker);el.classList.toggle("active",n===5);el.classList.toggle("complete",n<5);});
  saveMeta({...loadMeta(),visibleStep:5});renderAll();window.scrollTo({top:0,behavior:"smooth"});
}
function showStrategyStep(){
  document.querySelectorAll(".step-view").forEach(el=>el.classList.toggle("active",Number(el.dataset.step)===4));
  document.querySelectorAll("[data-step-marker]").forEach(el=>{const n=Number(el.dataset.stepMarker);el.classList.toggle("active",n===4);el.classList.toggle("complete",n<4);});
  saveMeta({...loadMeta(),visibleStep:4});window.scrollTo({top:0,behavior:"smooth"});
}

async function firecrawlCompanySearch(queryMeta){
  const response=await fetch(`${INTELLIGENCE_PROXY}/firecrawl-search`,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({query:queryMeta.query,limit:MAX_DISCOVERY_RESULTS_PER_QUERY,scrapeOptions:{formats:["markdown"]}})});
  const payload=await response.json().catch(()=>({}));
  if(!response.ok)throw new Error(payload.error||`Company search returned ${response.status}`);
  return LeadIntelDiscovery.normalizeCompanySearchResults(payload,queryMeta);
}
async function runCompanyDiscovery(){
  const main=mainState();if(!main?.market?.strategyApproved){showToast("Activate Market Strategy before Discovery");return;}
  syncStrategyFingerprint();
  const queries=LeadIntelDiscovery.buildDiscoveryQueries(main.profile||{},main.market||{},MAX_DISCOVERY_QUERIES);
  if(!queries.length){showToast("No active market strategy is available");return;}
  discovery.queries=queries;discovery.rawResults=[];discovery.candidates=[];discovery.status="running";saveDiscovery();renderAll();
  let failures=0;
  for(const query of queries){try{discovery.rawResults.push(...await firecrawlCompanySearch(query));}catch{failures++;}}
  discovery.rawResults=discovery.rawResults.slice(0,MAX_DISCOVERY_QUERIES*MAX_DISCOVERY_RESULTS_PER_QUERY);
  discovery.candidates=LeadIntelDiscovery.mergeCompanyCandidates(discovery.rawResults,main.profile||{},main.market||{});
  discovery.status=failures===0?"complete":discovery.candidates.length?"partial":"error";discovery.lastRunAt=new Date().toISOString();saveDiscovery();renderAll();
  showToast(discovery.candidates.length?`${discovery.candidates.length} company candidates ranked${failures?` · ${failures} search issue${failures===1?"":"s"}`:""}`:"No direct company candidates passed the evidence filter");
}
function scoreCell(label,value,max){return `<div><span>${label}</span><strong>${Number(value)||0}/${max}</strong><i style="--score:${Math.round((Number(value)||0)/max*20)}"></i></div>`;}
function peopleHtml(candidate){
  if(candidate.peopleStatus==="loading")return '<div class="people-note">Searching Apollo for matching roles…</div>';
  if(candidate.peopleStatus==="error")return '<div class="people-note warning">Apollo search was unavailable. Company evidence remains intact.</div>';
  if(candidate.peopleStatus==="empty")return '<div class="people-note">No matching decision-makers returned for the approved roles.</div>';
  if(!candidate.people?.length)return '<div class="people-note">People search is optional. Apollo People Search does not reveal email addresses in this step.</div>';
  return `<div class="people-list">${candidate.people.map(person=>`<div><strong>${esc(person.name)}</strong><span>${esc(person.title)}</span>${person.organization?`<small>${esc(person.organization)}</small>`:""}</div>`).join("")}</div>`;
}
function renderCandidates(){
  const target=$("company-candidates");if(!target)return;
  if(!discovery.candidates.length){target.innerHTML=`<div class="market-empty">${discovery.status==="running"?"Searching activated markets…":"Run company discovery to create a ranked shortlist of direct company domains."}</div>`;return;}
  target.innerHTML=discovery.candidates.map((c,index)=>`<article class="company-card ${c.saved?"saved":""}" data-company-index="${index}">
    <div class="company-card-top"><div><span class="opportunity-market">${esc(c.market||"Target market")}</span><h4>${esc(c.company)}</h4><a href="${esc(c.website)}" target="_blank" rel="noopener">${esc(c.domain)} ↗</a></div><div class="company-total"><strong>${c.score.total}</strong><span>/100</span></div></div>
    <div class="company-score-grid">${scoreCell("Fit",c.score.fit,30)}${scoreCell("Signal",c.score.signal,25)}${scoreCell("Evidence",c.score.evidence,20)}${scoreCell("Timing",c.score.timing,15)}${scoreCell("Value",c.score.value,10)}</div>
    <div class="candidate-meta"><span class="confidence ${String(c.confidence).toLowerCase()}">${esc(c.confidence)} confidence</span><span>${c.evidence.length} source${c.evidence.length===1?"":"s"}</span><span>${c.matchedSignals.length} matched signal${c.matchedSignals.length===1?"":"s"}</span></div>
    <div class="matched-signals">${c.matchedSignals.length?c.matchedSignals.map(s=>`<span><strong>${esc(s.name)}</strong> · ${esc(s.matchedTerms.join(", "))}</span>`).join(""):'<span class="muted-signal">No active signal term found in the returned company evidence.</span>'}</div>
    <div class="candidate-evidence">${c.evidence.map(e=>`<a href="${esc(e.url)}" target="_blank" rel="noopener"><strong>${esc(e.title||c.domain)}</strong><small>${esc(e.description||e.text).slice(0,190)}</small></a>`).join("")}</div>
    <div class="decision-makers"><div class="decision-head"><strong>Decision makers</strong><button class="secondary-btn small" type="button" data-action="find-decision-makers" data-company-index="${index}" ${c.peopleStatus==="loading"?"disabled":""}>${c.people?.length?"Refresh people":"Find decision-makers"}</button></div>${peopleHtml(c)}</div>
    <div class="candidate-actions"><button class="primary-btn small" type="button" data-action="save-pipeline" data-company-index="${index}">${c.saved?"Update Pipeline ✓":"Save to Pipeline"}</button></div>
  </article>`).join("");
}

async function findDecisionMakers(index){
  const candidate=discovery.candidates[index];if(!candidate)return;
  const main=mainState();const payload=LeadIntelDiscovery.buildApolloPeopleSearchPayload(candidate,main.profile||{});
  if(!payload.q_organization_domains_list.length){showToast("A verified company domain is required");return false;}
  candidate.peopleStatus="loading";saveDiscovery();renderCandidates();
  try{
    const response=await fetch(`${INTELLIGENCE_PROXY}/`,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(payload)});
    const data=await response.json().catch(()=>({}));
    if(!response.ok)throw new Error(data.error||`Apollo returned ${response.status}`);
    candidate.people=LeadIntelDiscovery.normalizeApolloPeople(data);candidate.peopleStatus=candidate.people.length?"complete":"empty";
    if(candidate.saved)discovery.pipeline=LeadIntelDiscovery.upsertPipelineItem(discovery.pipeline,candidate);
    saveDiscovery();renderAll();showToast(candidate.people.length?`${candidate.people.length} decision-maker${candidate.people.length===1?"":"s"} found`:'No matching decision-makers returned');return true;
  }catch(error){candidate.peopleStatus="error";saveDiscovery();renderAll();showToast(error.message||"Apollo people search unavailable");return false;}
}
function saveCandidate(index){
  const candidate=discovery.candidates[index];if(!candidate)return;
  discovery.pipeline=LeadIntelDiscovery.upsertPipelineItem(discovery.pipeline,candidate);candidate.saved=true;saveDiscovery();renderAll();showToast(`${candidate.company} saved to Pipeline`);
}
function renderPipeline(){
  const target=$("customer-pipeline");if(!target)return;
  $("discovery-pipeline-count").textContent=String(discovery.pipeline.length);
  if(!discovery.pipeline.length){target.innerHTML='<div class="market-empty">No companies saved yet. Save a ranked candidate when it deserves active follow-up.</div>';return;}
  const stages=LeadIntelDiscovery.CRM_STAGES;
  target.innerHTML=`<div class="pipeline-table"><div class="pipeline-row header"><span>Company</span><span>Score</span><span>People</span><span>Stage</span></div>${discovery.pipeline.map((item,index)=>`<div class="pipeline-row"><div><strong>${esc(item.company)}</strong><a href="${esc(item.website)}" target="_blank" rel="noopener">${esc(item.domain)}</a></div><span class="pipeline-score">${item.score?.total||0}</span><span>${item.people?.length||0}</span><select data-pipeline-stage="${index}">${stages.map(stage=>`<option ${stage===item.stage?"selected":""}>${esc(stage)}</option>`).join("")}</select></div>`).join("")}</div>`;
}
function renderStatus(){
  const main=mainState();const ready=Boolean(main?.market?.strategyApproved);
  const gate=$("continue-to-discovery");if(gate){gate.disabled=!ready;gate.textContent=ready?"Continue to Discovery →":"Activate strategy first";}
  if(!$("discovery-status"))return;
  const labels={idle:"Ready",running:"Searching",complete:"Complete",partial:"Partial",error:"Review"};
  $("discovery-status").textContent=labels[discovery.status]||"Ready";
  $("discovery-company").textContent=main.profile?.companyName||"Company";
  const markets=(main.market?.opportunities||[]).filter(x=>x.active!==false).map(x=>x.market).filter(Boolean);
  $("discovery-markets").textContent=[...new Set(markets)].join(" · ")||main.profile?.targetMarkets||"—";
  const text={idle:"Run discovery when the Market Strategy is active.",running:`Running ${discovery.queries.length} company searches…`,complete:`Discovery complete · ${discovery.candidates.length} ranked companies from ${discovery.rawResults.length} direct search results.`,partial:`Discovery partially complete · ${discovery.candidates.length} candidates; one or more searches were unavailable.`,error:"Company search returned no usable direct company candidates. No substitute companies were invented."};
  $("company-discovery-status").textContent=ready?(text[discovery.status]||text.idle):"Activate Market Strategy to start Discovery.";
  const run=$("run-company-discovery");run.disabled=!ready||discovery.status==="running";run.textContent=discovery.lastRunAt?"Rerun company discovery ↻":"Run company discovery ↻";
}
function renderAll(){renderStatus();renderCandidates();renderPipeline();}
function bindDiscovery(){
  $("continue-to-discovery")?.addEventListener("click",showDiscoveryStep);$("back-to-strategy")?.addEventListener("click",showStrategyStep);$("run-company-discovery")?.addEventListener("click",runCompanyDiscovery);
  $("activate-market-strategy")?.addEventListener("click",()=>setTimeout(renderStatus,0));
  $("company-candidates")?.addEventListener("click",e=>{const btn=e.target.closest("[data-action]");if(!btn)return;const index=Number(btn.dataset.companyIndex);if(btn.dataset.action==="find-decision-makers")findDecisionMakers(index);if(btn.dataset.action==="save-pipeline")saveCandidate(index);});
  $("customer-pipeline")?.addEventListener("change",e=>{const select=e.target.closest("[data-pipeline-stage]");if(!select)return;const item=discovery.pipeline[Number(select.dataset.pipelineStage)];if(!item)return;item.stage=LeadIntelDiscovery.CRM_STAGES.includes(select.value)?select.value:"Discovered";item.updatedAt=new Date().toISOString();saveDiscovery();renderPipeline();showToast(`${item.company} moved to ${item.stage}`);});
  $("reset-workspace")?.addEventListener("click",()=>setTimeout(()=>{if(!localStorage.getItem(MAIN_STORAGE_KEY)){localStorage.removeItem(DISCOVERY_STORAGE_KEY);localStorage.removeItem(`${DISCOVERY_STORAGE_KEY}_meta`);discovery=LeadIntelDiscovery.normalizeDiscoveryState({});}},0));
}
function loadOutreachModules(){
  if(document.querySelector('script[data-outreach-engine]'))return;
  const engine=document.createElement("script");engine.src="outreach-engine.js";engine.dataset.outreachEngine="true";
  engine.addEventListener("load",()=>{if(document.querySelector('script[data-outreach-ui]'))return;const ui=document.createElement("script");ui.type="module";ui.src="outreach-ui.js";ui.dataset.outreachUi="true";document.body.appendChild(ui);});
  document.body.appendChild(engine);
}
function initDiscovery(){
  injectDiscoveryUI();bindDiscovery();syncStrategyFingerprint();renderAll();
  if(loadMeta().visibleStep===5&&strategyReady())showDiscoveryStep();
  loadOutreachModules();
}
initDiscovery();