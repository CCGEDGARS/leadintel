import './content-language.js?v=20260905-step1-language-v1';
import './content-variants.js?v=20260905-step1-language-v1';
import './business-identity.js?v=20260906-competitive-wide-v1';
import './evidence-view.js?v=20260906-evidence-v1';
import './workspace-persistence.js?v=20260903-step1-startup-order-v1';

const STORAGE_KEY="leadintel_customer_v2_state";
const FIRECRAWL_PROXY="https://apollo-proxy.edgars-7e7.workers.dev";
const LEADINTEL_API="https://leadintel-api.edgars-7e7.workers.dev";
const PDFJS_VERSION="6.2.108";
const MAX_PDF_BYTES=15*1024*1024;
const MAX_PDFS=5;
const RESET_CONFIRM_WINDOW_MS=5000;
const profileFields=[
  ["companyOverview","Company overview",true],["priorityOffers","Priority offers",false],["idealCustomer","Ideal customer profile",false],
  ["lookalikeCustomers","Lookalike customers",false],["decisionMakers","Decision makers",false],["currentMarkets","Current market footprint",false],
  ["targetMarkets","Priority growth markets",false],["marketFocus","Priority market focus",false],["differentiation","Competitive advantages",false],["buyingTriggers","Buying situations / triggers",true],
  ["exclusions","Negative ICP / exclusions",false],["opportunityValue","Commercial value",false],["commercialObjective","6–12 month commercial objective",true]
];
let state=loadState();
let editMode=false;
let pdfModule=null;
let resetConfirmTimer=null;
let monitoringLoaded=false;
let monitoringBusy=false;
const $=id=>document.getElementById(id);
function contentLanguage(){return LeadIntelContentLanguage.resolveLanguage(window.LeadIntelLanguage?.get?.()||state.uiLanguage||'lv',navigator.languages||[]);}

function defaultState(){
  const base=LeadIntelProfile.normalizeSavedState({step:1,website:"",targetMarkets:[],additionalLinks:[],documents:[],answers:{},scrapedSources:[],profile:null,approved:false});
  base.market=LeadIntelMarket.normalizeMarketState({});
  return base;
}
function loadState(){
  try{
    const raw=JSON.parse(localStorage.getItem(STORAGE_KEY)||"{}");
    const base=LeadIntelProfile.normalizeSavedState(raw);
    base.step=[1,2,3,4,5,6,7].includes(Number(raw.step))?Number(raw.step):base.step;
    base.market=LeadIntelMarket.normalizeMarketState(raw.market||{});
    return base;
  }catch{return defaultState();}
}
function saveState(){localStorage.setItem(STORAGE_KEY,JSON.stringify(state));updateCompleteness();updateNavigationAvailability();}
function esc(value){return String(value??"").replace(/[&<>'"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;","'":"&#39;",'"':"&quot;"}[c]));}
function showToast(message){const el=$("toast");if(!el)return;el.textContent=message;el.classList.add("show");clearTimeout(showToast.t);showToast.t=setTimeout(()=>el.classList.remove("show"),2400);}
function invalidateStrategicOutputs(clearSources=false){
  state.profile=null;state.approved=false;state.market=LeadIntelMarket.normalizeMarketState({});
  if(clearSources)state.scrapedSources=[];
}
function updateNavigationAvailability(){
  document.querySelectorAll("[data-step-marker]").forEach(el=>{
    const step=Number(el.dataset.stepMarker);const available=LeadIntelProfile.canAccessModule(state,step);
    el.classList.toggle("available",available);el.setAttribute("aria-disabled",available?"false":"true");
  });
}
function observeNavigation(){
  const steps=document.querySelector(".steps");if(!steps||typeof MutationObserver==="undefined")return;
  const observer=new MutationObserver(()=>updateNavigationAvailability());
  observer.observe(steps,{childList:true});
}
function setStep(step){
  state.step=step;saveState();
  document.querySelectorAll(".step-view").forEach(el=>el.classList.toggle("active",Number(el.dataset.step)===step));
  document.querySelectorAll("[data-step-marker]").forEach(el=>{const n=Number(el.dataset.stepMarker);el.classList.toggle("active",n===step);el.classList.toggle("complete",n<step);});
  if(step===4)renderMarketStrategy();
  window.dispatchEvent(new CustomEvent("leadintel:module-opened",{detail:{step}}));
  window.scrollTo({top:0,behavior:"smooth"});
}
function updateCompleteness(){
  const score=LeadIntelProfile.calculateCompleteness(state);const scoreEl=$("completeness-score"),ring=$("progress-ring"),caption=$("completeness-caption");if(!scoreEl||!ring||!caption)return;
  scoreEl.textContent=`${score}%`;ring.style.setProperty("--p",score);
  caption.textContent=!state.website?"Add your website to begin.":!state.targetMarkets.length?"Choose at least one target market.":score<70?"Core context ready. Optional enrichment improves precision.":score<95?"Strong context. Add more only where useful.":"Ready for intelligence analysis.";
}
function renderTargetMarkets(){
  const selected=LeadIntelProfile.normalizeTargetMarkets(state.targetMarkets);state.targetMarkets=selected;
  const keys=new Set(selected.map(item=>item.toLowerCase()));
  document.querySelectorAll("[data-target-market]").forEach(button=>{const active=keys.has(String(button.dataset.targetMarket||"").toLowerCase());button.classList.toggle("selected",active);button.setAttribute("aria-pressed",active?"true":"false");});
  const target=$("selected-target-markets");
  if(target)target.innerHTML=selected.length?selected.map(item=>`<button class="selected-market-chip" type="button" data-remove-target-market="${esc(item)}" aria-label="Remove ${esc(item)}"><span>${esc(item)}</span><b aria-hidden="true">×</b></button>`).join(""):`<span class="market-empty-selection">Choose at least one market to continue.</span>`;
  if($("selected-market-count"))$("selected-market-count").textContent=`${selected.length} selected`;
  if($("clear-target-markets"))$("clear-target-markets").disabled=!selected.length;
}
function setTargetMarkets(markets){
  const next=LeadIntelProfile.normalizeTargetMarkets(markets);
  if(JSON.stringify(next)===JSON.stringify(state.targetMarkets)){renderTargetMarkets();return;}
  state.targetMarkets=next;invalidateStrategicOutputs(false);saveState();renderTargetMarkets();
}
function toggleTargetMarket(value){
  const market=LeadIntelProfile.normalizeTargetMarkets([value])[0];if(!market)return;
  const exists=state.targetMarkets.some(item=>item.toLowerCase()===market.toLowerCase());
  setTargetMarkets(exists?state.targetMarkets.filter(item=>item.toLowerCase()!==market.toLowerCase()):[...state.targetMarkets,market]);
}
function addCustomTargetMarket(){
  const input=$("custom-target-market");const additions=LeadIntelProfile.normalizeTargetMarkets(input?.value||"");
  if(!additions.length){showToast("Type a country, region, industry or market");return;}
  setTargetMarkets([...state.targetMarkets,...additions]);input.value="";showToast(`${additions.length===1?additions[0]:`${additions.length} markets`} added`);
}
function syncInputsFromState(){
  $("company-website").value=state.website.replace(/^https?:\/\//,"").replace(/\/$/,"");$("additional-links").value=state.additionalLinks.join("\n");
  document.querySelectorAll("[data-question]").forEach(el=>el.value=state.answers[el.dataset.question]||"");renderTargetMarkets();renderDocuments();
}
function readSources(){
  const previousWebsite=state.website;state.website=LeadIntelProfile.normalizeUrl($("company-website").value);state.additionalLinks=$("additional-links").value.split(/\n/).map(LeadIntelProfile.normalizeUrl).filter(Boolean).slice(0,8);
  if(previousWebsite&&state.website!==previousWebsite)invalidateStrategicOutputs(true);
  saveState();
}
function readAnswers(){document.querySelectorAll("[data-question]").forEach(el=>{state.answers[el.dataset.question]=el.value.trim();});saveState();}
function validateStep1(){
  readSources();
  if(!state.website){$("step1-error").textContent="Enter a valid company website.";return false;}
  if(!state.targetMarkets.length){$("step1-error").textContent="Choose at least one target market.";return false;}
  $("step1-error").textContent="";return true;
}
function validateStep2(){readAnswers();if(!LeadIntelProfile.canBuildProfile(state)){$("step2-error").textContent="Add a valid company website and target market in Step 1 first.";return false;}$("step2-error").textContent="";return true;}

async function getPdfModule(){
  if(pdfModule)return pdfModule;
  pdfModule=await import(`https://cdn.jsdelivr.net/npm/pdfjs-dist@${PDFJS_VERSION}/build/pdf.min.mjs`);
  pdfModule.GlobalWorkerOptions.workerSrc=`https://cdn.jsdelivr.net/npm/pdfjs-dist@${PDFJS_VERSION}/build/pdf.worker.min.mjs`;
  return pdfModule;
}
async function extractPdf(file){
  const pdfjs=await getPdfModule();
  const pdf=await pdfjs.getDocument({data:await file.arrayBuffer()}).promise;
  let text="";
  for(let pageNo=1;pageNo<=pdf.numPages&&text.length<25000;pageNo++){
    const page=await pdf.getPage(pageNo);const content=await page.getTextContent();text+=content.items.map(item=>item.str).join(" ")+"\n";
  }
  return text.replace(/\s+/g," ").trim().slice(0,25000);
}
async function handlePdfFiles(files){
  const room=Math.max(0,MAX_PDFS-state.documents.length);const selected=[...files].filter(file=>file.type==="application/pdf"||/\.pdf$/i.test(file.name)).slice(0,room);
  if(!selected.length){showToast(room?"Choose PDF files":"Maximum 5 PDFs reached");return;}
  for(const file of selected){
    if(file.size>MAX_PDF_BYTES){state.documents.push({name:file.name,size:file.size,text:"",status:"too-large"});renderDocuments();continue;}
    const doc={name:file.name,size:file.size,text:"",status:"extracting"};state.documents.push(doc);renderDocuments();
    try{doc.text=await extractPdf(file);doc.status=doc.text?"ready":"no-text";}catch{doc.status="error";doc.text="";}
    state.documents=state.documents.slice(0,MAX_PDFS);saveState();renderDocuments();
  }
}
function renderDocuments(){const list=$("document-list");if(!state.documents.length){list.innerHTML="";return;}list.innerHTML=state.documents.map((doc,index)=>`<div class="doc-item"><div><span>PDF</span><div><strong>${esc(doc.name)}</strong><small>${formatBytes(doc.size)} · ${doc.text?`${Math.round(doc.text.length/100)/10}k chars extracted`:statusLabel(doc.status)}</small></div></div><div><span class="doc-status">${doc.status==="ready"?"READY":doc.status==="extracting"?"READING…":"REVIEW"}</span><button class="doc-remove" type="button" data-remove-doc="${index}" aria-label="Remove ${esc(doc.name)}">×</button></div></div>`).join("");}
function formatBytes(bytes){return bytes<1024*1024?`${Math.max(1,Math.round(bytes/1024))} KB`:`${(bytes/1024/1024).toFixed(1)} MB`;}
function statusLabel(status){return {"too-large":"over 15 MB","no-text":"no extractable text","error":"text extraction failed","extracting":"extracting text"}[status]||"pending";}

async function scrapeSource(url,type){
  const response=await fetch(`${FIRECRAWL_PROXY}/firecrawl-scrape`,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({url,formats:["markdown"],onlyMainContent:true,timeout:30000})});
  const payload=await response.json().catch(()=>({}));
  if(!response.ok)throw new Error(payload.error||`Source returned ${response.status}`);
  const data=payload.data||payload;
  const text=String(data.markdown||data.content||"").slice(0,30000);
  if(!text.trim())throw new Error("No readable page content returned");
  return {type,url,title:data.metadata?.title||data.title||new URL(url).hostname,text,status:"ready"};
}
function analysisStatus(title,caption){$("analysis-title").textContent=title;$("analysis-caption").textContent=caption;}
function analysisLog(label,status="done"){$("analysis-log").insertAdjacentHTML("beforeend",`<span>${status==="done"?"✓":"!"} ${esc(label)}</span>`);}
async function analyzeCompany(targetStep=3){
  const requestedStep=Number(targetStep)||3;if(!validateStep2())return false;
  setStep(3);$("profile-content").hidden=true;$("analysis-state").hidden=false;$("analysis-log").innerHTML="";state.scrapedSources=[];state.approved=false;
  state.market=LeadIntelMarket.normalizeMarketState({});
  const sources=[{url:state.website,type:"website"},...state.additionalLinks.map(url=>({url,type:"link"}))];
  analysisStatus("Reading company sources…","Public source failures will not block the profile; they will be shown as intelligence gaps.");
  analysisLog(`Target markets: ${state.targetMarkets.join(" · ")}`);
  for(const [index,source] of sources.entries()){
    try{const result=await scrapeSource(source.url,source.type);state.scrapedSources.push(result);analysisLog(index===0?"Main website":`Additional source ${index}`);}catch(error){analysisLog(index===0?"Main website unavailable":`Source ${index} unavailable`,"warn");state.scrapedSources.push({type:source.type,url:source.url,title:"",text:"",status:`error: ${error.message}`});}
  }
  const usable=state.scrapedSources.filter(x=>x.text);
  analysisStatus("Synthesizing strategic context…","Optional answers enrich the website evidence; missing answers remain explicit intelligence gaps.");
  analysisLog(`${usable.length}/${sources.length} web sources readable`);analysisLog(`${state.documents.filter(d=>d.text).length} PDFs with extracted text`);
  await new Promise(resolve=>setTimeout(resolve,350));
  state.profile=LeadIntelProfile.buildCompanyIntelligenceProfile({...state,scrapedSources:usable});seedMarketStrategy();
  saveState();analysisLog("Company Intelligence Profile built");
  await new Promise(resolve=>setTimeout(resolve,250));
  $("analysis-state").hidden=true;$("profile-content").hidden=false;renderProfile();
  if(requestedStep>3)setStep(requestedStep);return true;
}
function fieldValue(profile,key){const value=profile?.[key];return Array.isArray(value)?value.join("; "):String(value||"");}
function renderProfile(){
  const p=state.profile;if(!p)return;
  $("profile-company-name").textContent=p.companyName||"Company";$("profile-mission").textContent=p.mission;$("profile-completeness").textContent=`${p.completeness}%`;
  $("profile-editor").innerHTML=profileFields.map(([key,label,wide])=>`<div class="profile-field ${wide?"wide":""}"><label for="profile-${key}">${esc(label)}</label><textarea id="profile-${key}" data-profile-field="${key}" rows="${wide?3:2}" ${editMode?"":"readonly"}>${esc(fieldValue(p,key))}</textarea></div>`).join("");
  $("recommended-signals").innerHTML=(p.recommendedSignals||[]).map((signal,index)=>`<label class="signal-item"><input type="checkbox" data-signal-index="${index}" ${signal.active===false?"":"checked"}><div><strong>${esc(signal.name)}</strong><small>${esc(signal.reason)}</small></div><span class="priority">${esc(signal.priority)}</span></label>`).join("");
  const sourceSummary=p.sourceSummary||{website:0,additionalLinks:0,documents:0,total:0};
  $("source-summary").innerHTML=`<span class="source-chip">Website ${sourceSummary.website}</span><span class="source-chip">Additional links ${sourceSummary.additionalLinks}</span><span class="source-chip">PDFs ${sourceSummary.documents}</span><span class="source-chip">Total evidence sources ${sourceSummary.total}</span>`;
  $("evidence-digest").innerHTML=globalThis.LeadIntelEvidenceView?.renderEvidence(p)||`<div class="evidence-empty">${esc(p.evidenceDigest||"No readable public/document evidence was collected.")}</div>`;
  const gaps=p.informationGaps||[];$("information-gaps").innerHTML=gaps.length?gaps.map(x=>`<div class="gap-item">${esc(x)}</div>`).join(""):`<div class="gap-item good">No critical context gaps detected for this onboarding stage.</div>`;
  updateApprovalUI();
}
function saveProfileEdits(){
  document.querySelectorAll("[data-profile-field]").forEach(el=>{const key=el.dataset.profileField;state.profile[key]=key==="currentMarkets"?el.value.split(/;|,/).map(x=>x.trim()).filter(Boolean):el.value.trim();});
  state.profile.researchMarkets=LeadIntelProfile.expandTargetMarkets(state.profile.targetMarkets);
  document.querySelectorAll("[data-signal-index]").forEach(el=>{if(state.profile.recommendedSignals[Number(el.dataset.signalIndex)])state.profile.recommendedSignals[Number(el.dataset.signalIndex)].active=el.checked;});
  state.approved=false;saveState();
}
function toggleEdit(){
  if(editMode){saveProfileEdits();editMode=false;$("edit-profile").textContent="Edit profile";showToast("Profile edits saved");}else{editMode=true;$("edit-profile").textContent="Save edits";}
  renderProfile();
}
function seedMarketStrategy(){
  if(!state.profile)return;
  const language=contentLanguage();
  const icps=LeadIntelMarket.buildIcpCandidates(state.profile,language);
  const signals=LeadIntelMarket.normalizeSignals(state.profile.recommendedSignals,state.market?.signals||[]);
  const opportunities=LeadIntelMarket.buildMarketOpportunities(state.profile,icps,signals,[],language);
  state.market=LeadIntelMarket.normalizeMarketState({icps,signals,opportunities,researchStatus:"idle",strategyApproved:false,contentLanguage:language});
}
function approveProfile(){
  saveProfileEdits();state.approved=true;state.profile.approvedAt=new Date().toISOString();seedMarketStrategy();saveState();editMode=false;renderProfile();showToast("Company Intelligence Profile approved");
}
function updateApprovalUI(){
  const approved=state.approved;$("profile-status").textContent=approved?"Approved":"Provisional";$("profile-status").classList.toggle("approved",approved);
  $("approve-profile").textContent=approved?"Approved ✓":"Approve profile";$("approve-profile").disabled=approved;
  $("approve-profile-bottom").textContent=approved?"Continue to Market Strategy →":"Approve profile (optional)";$("approve-profile-bottom").disabled=false;
  $("approval-card").classList.toggle("approved",approved);
}
function openMarketStrategy(){if(!state.profile){openModule(4);return;}ensureMarketStrategySeeded();setStep(4);}
function ensureMarketStrategySeeded(){
  if(!state.profile)return;
  const language=contentLanguage();
  if(!state.market)state.market=LeadIntelMarket.normalizeMarketState({});
  if(!state.market.icps.length)state.market.icps=LeadIntelMarket.buildIcpCandidates(state.profile,language);
  state.market.signals=LeadIntelMarket.normalizeSignals(state.profile.recommendedSignals,state.market.signals);
  if(!state.market.opportunities.length)state.market.opportunities=LeadIntelMarket.buildMarketOpportunities(state.profile,state.market.icps,state.market.signals,state.market.researchResults||[],language);
  state.market=LeadIntelMarket.localizeGeneratedState(state.market,state.profile,language);
  saveState();
}
async function openModule(step){
  const target=Number(step)||1;readSources();
  if(!LeadIntelProfile.canAccessModule(state,target)){showToast("Add your company website and target market first");setStep(1);return false;}
  if(target<=2){setStep(target);return true;}
  if(!state.profile)return analyzeCompany(target);
  ensureMarketStrategySeeded();setStep(target);return true;
}

function readMarketEdits(markDirty=true){
  document.querySelectorAll("[data-icp-field]").forEach(el=>{const item=state.market.icps[Number(el.dataset.index)];if(!item)return;const field=el.dataset.icpField;item[field]=field==="active"?el.checked:el.value.trim();});
  document.querySelectorAll("[data-signal-field]").forEach(el=>{const item=state.market.signals[Number(el.dataset.index)];if(!item)return;const field=el.dataset.signalField;if(field==="active")item.active=el.checked;else if(field==="weight")item.weight=Math.max(1,Math.min(10,Number(el.value)||1));else item[field]=el.value.trim();});
  document.querySelectorAll("[data-opportunity-active]").forEach(el=>{const item=state.market.opportunities[Number(el.dataset.opportunityActive)];if(item)item.active=el.checked;});
  if(markDirty){state.market.strategyApproved=false;state.market.strategyApprovedAt="";}
  saveState();
}
function renderIcps(){
  $("icp-list").innerHTML=state.market.icps.map((icp,index)=>`<article class="icp-card ${icp.active?"active":""}">
    <div class="icp-card-head"><label class="market-toggle"><input type="checkbox" data-icp-field="active" data-index="${index}" ${icp.active?"checked":""}><span></span></label><div><span class="icp-type">${esc(icp.type)}</span><input class="market-inline-title" data-icp-field="name" data-index="${index}" value="${esc(icp.name)}"></div></div>
    <label>Definition<textarea rows="2" data-icp-field="description" data-index="${index}">${esc(icp.description)}</textarea></label>
    <div class="icp-fields"><label>Target markets<input data-icp-field="targetMarkets" data-index="${index}" value="${esc(icp.targetMarkets)}"></label><label>Buyer roles<input data-icp-field="buyerRoles" data-index="${index}" value="${esc(icp.buyerRoles)}"></label></div>
    <div class="icp-fields"><label>Priority offers<input data-icp-field="offers" data-index="${index}" value="${esc(icp.offers)}"></label><label>Commercial value<input data-icp-field="value" data-index="${index}" value="${esc(icp.value)}"></label></div>
    <label>Exclusions<input data-icp-field="exclusions" data-index="${index}" value="${esc(icp.exclusions)}"></label>
    <p>${esc(icp.rationale)}</p>
  </article>`).join("");
}
function renderSignalDesigner(){
  $("signal-designer").innerHTML=state.market.signals.map((signal,index)=>`<div class="signal-config-row ${signal.active?"active":""}">
    <label class="market-toggle"><input type="checkbox" data-signal-field="active" data-index="${index}" ${signal.active?"checked":""}><span></span></label>
    <div class="signal-config-main"><input class="signal-name-input" data-signal-field="name" data-index="${index}" value="${esc(signal.name)}"><input class="signal-keywords-input" data-signal-field="keywords" data-index="${index}" value="${esc(signal.keywords)}" placeholder="keywords; phrases"></div>
    <select data-signal-field="priority" data-index="${index}">${["High","Medium","Low"].map(p=>`<option ${p===signal.priority?"selected":""}>${p}</option>`).join("")}</select>
    <label class="weight-field"><span>Weight</span><input type="number" min="1" max="10" data-signal-field="weight" data-index="${index}" value="${signal.weight}"></label>
    <button class="signal-delete" type="button" data-remove-signal="${index}" aria-label="Remove ${esc(signal.name)}">×</button>
  </div>`).join("");
}
function addCustomSignal(){
  readMarketEdits();
  const result=LeadIntelMarket.addCustomSignal(state.market.signals,{name:$("custom-signal-name").value,keywords:$("custom-signal-keywords").value,priority:$("custom-signal-priority").value,weight:$("custom-signal-weight").value});
  if(!result.added){showToast(result.error||"Could not add signal");return;}
  state.market.signals=result.signals;state.market.strategyApproved=false;saveState();$("custom-signal-name").value="";$("custom-signal-keywords").value="";renderMarketStrategy();showToast("Custom signal added");
}
function removeSignal(index){readMarketEdits();state.market.signals.splice(index,1);state.market.strategyApproved=false;saveState();renderMarketStrategy();showToast("Signal removed");}

async function waitForMarketServerBridge(timeout=1800){
  if(window.LeadIntelServerBridge&&window.LeadIntelServerBridge.session!==null)return window.LeadIntelServerBridge;
  return new Promise(resolve=>{let settled=false;const finish=()=>{if(settled)return;settled=true;window.removeEventListener("leadintel:server-ready",finish);resolve(window.LeadIntelServerBridge||null);};window.addEventListener("leadintel:server-ready",finish,{once:true});setTimeout(finish,timeout);});
}
async function searchOpenAiWeb(queryMeta,maxResults=5){
  const bridge=await waitForMarketServerBridge();const workspace=bridge?.workspace;
  if(!bridge?.session?.authenticated||!workspace?.id)return {available:false,reason:"Sign in to use OpenAI signal discovery",results:[]};
  const response=await fetch(`${LEADINTEL_API}/api/ai/web-search?workspace_id=${encodeURIComponent(workspace.id)}`,{method:"POST",credentials:"include",headers:{"Content-Type":"application/json","Accept":"application/json"},body:JSON.stringify({query:queryMeta.query,max_results:maxResults})});
  const payload=await response.json().catch(()=>({}));
  if(response.status===409&&payload.error==="OpenAI integration is required for web search")return {available:false,reason:"OpenAI integration is required for web search",results:[]};
  if(!response.ok)throw new Error(payload.error||`OpenAI signal discovery returned ${response.status}`);
  return {available:true,reason:"",results:LeadIntelMarket.normalizeSearchResults({results:payload.results},queryMeta,"openai")};
}
async function searchMarket(queryMeta,limit=5){
  const response=await fetch(`${FIRECRAWL_PROXY}/firecrawl-search`,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({query:queryMeta.query,limit,scrapeOptions:{formats:["markdown"]}})});
  const payload=await response.json().catch(()=>({}));
  if(!response.ok)throw new Error(payload.error||`Market search returned ${response.status}`);
  return LeadIntelMarket.normalizeSearchResults(payload,queryMeta,"firecrawl");
}
function researchProfile(){
  const activeMarkets=state.market.icps.filter(item=>item.active).map(item=>item.targetMarkets).filter(Boolean).join("; ");
  const targetMarkets=activeMarkets||state.profile.targetMarkets;
  return {...state.profile,targetMarkets,researchMarkets:LeadIntelProfile.expandTargetMarkets(targetMarkets)};
}
async function runMarketResearch(){
  if(!state.profile){showToast("Add your website and target market so LeadIntel can build a profile first");return;}
  ensureMarketStrategySeeded();readMarketEdits();
  const profile=researchProfile();
  const selectedSources=[...document.querySelectorAll('#research-source-types input:checked')].map(input=>input.value);state.market.researchMode=$("research-mode").value==="deep"?"deep":"quick";const limits=LeadIntelMarket.RESEARCH_MODES[state.market.researchMode];
  const queries=LeadIntelMarket.buildResearchQueries(profile,state.market.signals,{mode:state.market.researchMode,sourceTypes:selectedSources});
  if(!queries.length){showToast("Add a target market to improve research precision");return;}
  state.market.researchQueries=queries;state.market.researchResults=[];state.market.opportunities=[];state.market.researchStatus="running";state.market.researchSourceStatus={openai:"running",firecrawl:"running"};state.market.strategyApproved=false;saveState();renderMarketStrategy();
  const button=$("run-market-research");button.disabled=true;button.textContent="Researching…";
  let openAiAvailable=true,openAiSuccesses=0,openAiFailures=0,firecrawlSuccesses=0,firecrawlFailures=0;
  for(const query of queries){
    let openAiResults=[],firecrawlResults=[];
    if(openAiAvailable){
      try{
        const found=await searchOpenAiWeb(query,limits.resultsPerQuery);
        if(!found.available){openAiAvailable=false;state.market.researchSourceStatus.openai="unavailable";}
        else{openAiResults=found.results;openAiSuccesses++;}
      }catch{openAiFailures++;}
    }
    try{firecrawlResults=await searchMarket(query,limits.resultsPerQuery);firecrawlSuccesses++;}catch{firecrawlFailures++;}
    state.market.researchResults=LeadIntelMarket.mergeResearchResults(state.market.researchResults,openAiResults,firecrawlResults).slice(0,limits.maxStoredResults);
  }
  if(openAiAvailable)state.market.researchSourceStatus.openai=openAiFailures===0?"complete":openAiSuccesses?"partial":"error";
  state.market.researchSourceStatus.firecrawl=firecrawlFailures===0?"complete":firecrawlSuccesses?"partial":"error";
  const operationalFailures=openAiFailures+firecrawlFailures;
  state.market.opportunities=LeadIntelMarket.buildMarketOpportunities(profile,state.market.icps,state.market.signals,state.market.researchResults,contentLanguage());
  state.market.researchStatus=operationalFailures===0?"complete":state.market.researchResults.length?"partial":"error";
  state.market.lastResearchAt=new Date().toISOString();state.market.researchHistory=LeadIntelMarket.appendResearchHistory(state.market.researchHistory,{id:`manual-${Date.now()}`,mode:state.market.researchMode,status:state.market.researchStatus,sourceCount:state.market.researchResults.length,queryCount:queries.length,completedAt:state.market.lastResearchAt});saveState();renderMarketStrategy();
  button.disabled=false;
  const sourceNote=state.market.researchSourceStatus.openai==="unavailable"?" · OpenAI unavailable; Firecrawl verification used":" · OpenAI discovery + Firecrawl verification";
  showToast(`${state.market.researchStatus==="complete"?"Market research complete":"Market research partially complete"}${sourceNote} · ${state.market.researchResults.length} evidence sources`);
}
function scoreCell(label,value){return `<div><span>${label}</span><strong>${value}/20</strong><i style="--score:${value}"></i></div>`;}
function renderMarketOpportunities(){
  const target=$("market-opportunities");
  if(!state.market.opportunities.length){target.innerHTML=`<div class="market-empty">${state.market.researchStatus==="running"?"Researching markets…":"Target market strategy is ready. Run market research to add live evidence and improve confidence."}</div>`;return;}
  target.innerHTML=state.market.opportunities.map((opp,index)=>opp.profileOnly?`<article class="opportunity-card unresearched ${opp.active?"active":""}">
    <div class="opportunity-top"><label class="market-toggle"><input type="checkbox" data-opportunity-active="${index}" ${opp.active?"checked":""}><span></span></label><div><h4>${esc(opp.title)}</h4></div><div class="opportunity-total"><strong>${opp.score.total}</strong><span>/100</span></div></div>
  </article>`:`<article class="opportunity-card ${opp.active?"active":""}">
    <div class="opportunity-top"><label class="market-toggle"><input type="checkbox" data-opportunity-active="${index}" ${opp.active?"checked":""}><span></span></label><div><span class="opportunity-market">${esc(opp.market)}</span><h4>${esc(opp.title)}</h4></div><div class="opportunity-total"><strong>${opp.score.total}</strong><span>/100</span></div></div>
    <p class="opportunity-hypothesis">${esc(opp.hypothesis)}</p>
    <div class="score-grid">${scoreCell("Fit",opp.score.fit)}${scoreCell("Intent",opp.score.intent)}${scoreCell("Timing",opp.score.timing)}${scoreCell("Value",opp.score.value)}${scoreCell("Evidence",opp.score.evidence)}</div>
    <div class="opportunity-meta"><span class="confidence ${opp.confidence.toLowerCase()}">${opp.confidence} confidence</span><span>${opp.evidence.length} evidence source${opp.evidence.length===1?"":"s"}</span>${opp.profileOnly?"<span>Profile-only hypothesis</span>":""}</div>
    <div class="evidence-links">${opp.evidence.length?opp.evidence.map(source=>`<a href="${esc(source.url)}" target="_blank" rel="noopener"><strong>${esc(source.title)}</strong><small>${esc(source.description||source.text).slice(0,180)}</small></a>`).join(""):`<div class="evidence-none">No live public evidence was returned. LeadIntel has kept this as a low-evidence hypothesis instead of inventing support.</div>`}</div>
  </article>`).join("");
}
function renderResearchStatus(){
  const status=state.market.researchStatus;const count=state.market.researchResults.length;const queries=state.market.researchQueries.length;const sources=state.market.researchSourceStatus||{openai:"idle",firecrawl:"idle"};
  let message="Target market selected · live market research can increase confidence.";
  if(status==="running")message=`Running ${queries} searches · OpenAI signal discovery + Firecrawl verification…`;
  else if(status==="complete"&&sources.openai==="unavailable")message=`Research complete · Firecrawl verification · ${count} public evidence sources. OpenAI integration is required for web search; connect OpenAI in Settings for broader signal discovery.`;
  else if(status==="complete")message=`Research complete · OpenAI signal discovery + Firecrawl verification · ${queries} queries · ${count} public evidence sources.`;
  else if(status==="partial")message=`Research partially complete · ${count} evidence sources · OpenAI signal discovery / Firecrawl verification had one or more unavailable requests.`;
  else if(status==="error")message="Public market research was unavailable. Profile-only hypotheses are shown with reduced Evidence scores.";
  $("market-research-status").textContent=message;
  $("run-market-research").textContent=state.market.lastResearchAt?"Rerun market research ↻":"Run market research ↻";
  $("run-market-research").disabled=status==="running";
}
function renderResearchControls(){
  $("research-mode").value=state.market.researchMode||"quick";const deep=state.market.researchMode==="deep";document.querySelectorAll('#research-source-types input').forEach(input=>{input.disabled=!deep;if(!deep)input.checked=["news","tenders"].includes(input.value);});
  const rules=LeadIntelMarket.RESEARCH_MODES[state.market.researchMode];$("run-market-research").title=`Maximum ${rules.maxQueries} queries, ${rules.resultsPerQuery} results per query and ${rules.maxStoredResults} stored sources`;
}
function renderResearchHistory(){const target=$("research-history");const history=state.market.researchHistory||[];target.innerHTML=history.length?history.slice(0,5).map(run=>`<span>${esc(run.mode)} · ${run.sourceCount} sources · ${esc(new Date(run.completedAt).toLocaleDateString())}</span>`).join(""):"";}
async function monitoringApi(path,options={}){const bridge=await waitForMarketServerBridge();if(!bridge?.session?.authenticated||!bridge.workspace?.id)throw new Error("Sign in to use automatic monitoring");const separator=path.includes("?")?"&":"?";const response=await fetch(`${LEADINTEL_API}${path}${separator}workspace_id=${encodeURIComponent(bridge.workspace.id)}`,{credentials:"include",headers:{Accept:"application/json","Content-Type":"application/json",...(options.headers||{})},...options});const payload=await response.json().catch(()=>({}));if(!response.ok)throw new Error(payload.error||`Monitoring returned ${response.status}`);return payload;}
function renderMonitoringControls(){
  const config=LeadIntelMarket.normalizeMonitoring(state.market.monitoring);state.market.monitoring=config;$("monitoring-enabled").checked=config.enabled;$("monitoring-frequency").value=config.frequency;$("monitoring-depth").value=config.researchDepth;$("monitoring-minimum-score").value=config.minimumScore;$("monitoring-custom-sources").value=config.customSources.join("\n");
  const selectedSignals=new Set(config.signalIds.length?config.signalIds:state.market.signals.filter(signal=>signal.active).map(signal=>signal.id));$("monitoring-signals").innerHTML=state.market.signals.filter(signal=>signal.active).map(signal=>`<label><input type="checkbox" data-monitor-signal value="${esc(signal.id)}" ${selectedSignals.has(signal.id)?"checked":""}> ${esc(signal.name)}</label>`).join("")||"<span>No active signals</span>";
  const selectedSources=new Set(config.sourceTypes);$("monitoring-sources").innerHTML=Object.keys(LeadIntelMarket.SOURCE_TYPES).map(source=>`<label><input type="checkbox" data-monitor-source value="${source}" ${selectedSources.has(source)?"checked":""}> ${source[0].toUpperCase()+source.slice(1)}</label>`).join("");
  const locked=!state.market.strategyApproved;$("monitoring-enabled").disabled=locked;$("save-monitoring").disabled=locked||monitoringBusy;$("run-monitoring-now").disabled=locked||monitoringBusy;$("monitoring-status").textContent=locked?"Activate the market strategy before enabling monitoring.":config.enabled?`Monitoring active · ${config.frequency}${config.nextRunAt?` · next run ${new Date(config.nextRunAt).toLocaleString()}`:""}`:"Monitoring is off.";
}
function readMonitoringEdits(){state.market.monitoring=LeadIntelMarket.normalizeMonitoring({enabled:$("monitoring-enabled").checked,frequency:$("monitoring-frequency").value,researchDepth:$("monitoring-depth").value,minimumScore:$("monitoring-minimum-score").value,sourceTypes:[...document.querySelectorAll('[data-monitor-source]:checked')].map(input=>input.value),signalIds:[...document.querySelectorAll('[data-monitor-signal]:checked')].map(input=>input.value),customSources:$("monitoring-custom-sources").value.split(/\n/)});saveState();return state.market.monitoring;}
function renderMonitoringAlerts(alerts=[]){$("monitoring-alerts").innerHTML=alerts.length?alerts.map(alert=>`<article class="monitor-alert"><div class="monitor-alert-head"><a href="${esc(alert.source_url)}" target="_blank" rel="noopener">${esc(alert.title)}</a><strong>${Number(alert.score)||0}/100</strong></div><p>${esc(alert.summary)}</p><span>${esc(new Date(alert.created_at).toLocaleString())}</span> ${alert.status==="new"?`<button type="button" data-monitor-alert-read="${esc(alert.id)}">Mark read</button>`:""}</article>`).join(""):'<div class="market-empty">No monitoring alerts yet.</div>';}
function renderMonitoringHistory(runs=[]){$("monitoring-history").innerHTML=runs.length?runs.map(run=>`<div class="monitor-run"><span>${esc(run.trigger_type)} · ${esc(run.research_depth)} · ${esc(run.status)}</span><strong>${Number(run.source_count)||0} sources · ${Number(run.alert_count)||0} alerts</strong></div>`).join(""):'<div class="market-empty">No automatic runs yet.</div>';}
async function loadMonitoringServerState(force=false){if((monitoringLoaded&&!force)||monitoringBusy)return;const bridge=await waitForMarketServerBridge();if(!bridge?.session?.authenticated||!bridge.workspace?.id){$("monitoring-status").textContent="Sign in to configure automatic monitoring.";return;}monitoringLoaded=true;try{const [config,alerts,runs]=await Promise.all([monitoringApi('/api/market-monitoring/config'),monitoringApi('/api/market-monitoring/alerts'),monitoringApi('/api/market-monitoring/runs')]);state.market.monitoring=LeadIntelMarket.normalizeMonitoring(config.config);state.market.monitoring.nextRunAt=config.config.nextRunAt||"";state.market.monitoring.lastRunAt=config.config.lastRunAt||"";saveState();renderMonitoringControls();renderMonitoringAlerts(alerts.alerts);renderMonitoringHistory(runs.runs);}catch(error){$("monitoring-status").textContent=error.message;}}
async function saveMonitoringConfig(){if(!state.market.strategyApproved){showToast("Activate the market strategy first");return;}monitoringBusy=true;renderMonitoringControls();try{const config=readMonitoringEdits();if(config.enabled&&!config.signalIds.length)throw new Error("Select at least one signal to monitor");if(config.enabled&&!config.sourceTypes.length&&!config.customSources.length)throw new Error("Select at least one source category or custom source");const saved=await window.LeadIntelWorkspacePersistence?.saveWorkspace?.();if(!saved)throw new Error("Save the workspace before enabling monitoring");const result=await monitoringApi('/api/market-monitoring/config',{method:'PUT',body:JSON.stringify({enabled:config.enabled,frequency:config.frequency,research_depth:config.researchDepth,minimum_score:config.minimumScore,source_types:config.sourceTypes,signal_ids:config.signalIds,custom_sources:config.customSources})});state.market.monitoring={...config,nextRunAt:result.config.nextRunAt||"",lastRunAt:result.config.lastRunAt||""};saveState();showToast(config.enabled?"Automatic monitoring enabled":"Automatic monitoring disabled");}catch(error){showToast(error.message);}finally{monitoringBusy=false;renderMonitoringControls();}}
async function runMonitoringNow(){monitoringBusy=true;renderMonitoringControls();try{readMonitoringEdits();const result=await monitoringApi('/api/market-monitoring/run',{method:'POST',body:'{}'});showToast(`Monitoring complete · ${result.run.sourceCount} sources · ${result.run.alertCount} new alerts`);await loadMonitoringServerState(true);}catch(error){showToast(error.message);}finally{monitoringBusy=false;renderMonitoringControls();}}
async function markMonitoringAlertRead(id){try{await monitoringApi(`/api/market-monitoring/alerts/${encodeURIComponent(id)}`,{method:'PATCH',body:JSON.stringify({status:'read'})});await loadMonitoringServerState(true);}catch(error){showToast(error.message);}}
function renderMarketStrategy(){
  if(!state.profile)return;
  ensureMarketStrategySeeded();
  $("strategy-company-name").textContent=state.profile.companyName||"Company";
  const marketSummary=LeadIntelMarket.splitList(state.profile.targetMarkets).join(" · ")||LeadIntelMarket.splitList(state.profile.currentMarkets).join(" · ")||"Provisional market";
  $("strategy-market-summary").textContent=marketSummary;
  $("strategy-signal-count").textContent=String(state.market.signals.filter(item=>item.active).length);
  $("strategy-status").textContent=state.market.strategyApproved?"Active":state.approved?"Draft":"Provisional";$("strategy-status").classList.toggle("approved",state.market.strategyApproved);
  $("strategy-activation-card").classList.toggle("approved",state.market.strategyApproved);
  $("activate-market-strategy").textContent=state.market.strategyApproved?"Strategy Active ✓":"Activate Market Strategy";
  $("activate-market-strategy").disabled=state.market.strategyApproved;
  renderIcps();renderSignalDesigner();renderResearchControls();renderResearchStatus();renderResearchHistory();renderMarketOpportunities();renderMonitoringControls();loadMonitoringServerState();
}
function activateMarketStrategy(){
  readMarketEdits();
  if(!state.market.icps.some(item=>item.active)){showToast("Activate at least one ICP");return;}
  if(!state.market.signals.some(item=>item.active)){showToast("Activate at least one buying signal");return;}
  if(!state.market.lastResearchAt){showToast("Run market research before formally activating the strategy");return;}
  if(!state.market.opportunities.some(item=>item.active)){showToast("Keep at least one market opportunity active");return;}
  state.market.strategyApproved=true;state.market.strategyApprovedAt=new Date().toISOString();saveState();renderMarketStrategy();showToast("Market Strategy activated for Discovery · configure monitoring below");
}
function disarmWorkspaceReset(){
  const button=$("reset-workspace");
  if(resetConfirmTimer){clearTimeout(resetConfirmTimer);resetConfirmTimer=null;}
  if(!button)return;
  button.dataset.resetArmed="false";
  button.classList.remove("reset-armed");
  button.textContent="Reset all workspace data";
  button.setAttribute("aria-label","Reset all workspace data");
  button.style.removeProperty("color");
  button.style.removeProperty("background");
  button.style.removeProperty("border-radius");
}
function armWorkspaceReset(){
  const button=$("reset-workspace");if(!button)return false;
  button.dataset.resetArmed="true";
  button.classList.add("reset-armed");
  button.textContent="Confirm reset";
  button.setAttribute("aria-label","Confirm reset of workspace data");
  button.style.setProperty("color","var(--danger)");
  button.style.setProperty("background","rgba(165,71,62,.10)");
  button.style.setProperty("border-radius","9px");
  if(resetConfirmTimer)clearTimeout(resetConfirmTimer);
  resetConfirmTimer=setTimeout(disarmWorkspaceReset,RESET_CONFIRM_WINDOW_MS);
  showToast("Click Confirm reset within 5 seconds");
  return true;
}
async function resetWorkspace(){
  const button=$("reset-workspace");
  if(button?.dataset.resetArmed!=="true"){armWorkspaceReset();return;}
  disarmWorkspaceReset();
  state=defaultState();editMode=false;saveState();for(const key of ["leadintel_customer_v2_discovery","leadintel_customer_v2_outreach","leadintel_customer_v2_delivery","leadintel_customer_v2_discovery_meta"])localStorage.removeItem(key);syncInputsFromState();setStep(1);const bridge=window.LeadIntelServerBridge;if(bridge?.session?.authenticated&&bridge.workspace){try{const result=await bridge.saveNow();if(!result.saved)throw new Error("Server reset was not saved");}catch(error){showToast("Reset failed to sync: "+error.message);return;}}sessionStorage.removeItem("leadintel_customer_v2_server_hydration");showToast("All workspace data reset");
}

function bind(){
  $("company-website").addEventListener("input",readSources);$("additional-links").addEventListener("input",readSources);
  $("target-market-selector").addEventListener("click",e=>{
    const chip=e.target.closest("[data-target-market]");if(chip){toggleTargetMarket(chip.dataset.targetMarket);return;}
    const remove=e.target.closest("[data-remove-target-market]");if(remove){toggleTargetMarket(remove.dataset.removeTargetMarket);}
  });
  $("add-target-market").addEventListener("click",addCustomTargetMarket);
  $("custom-target-market").addEventListener("keydown",e=>{if(e.key==="Enter"){e.preventDefault();addCustomTargetMarket();}});
  $("clear-target-markets").addEventListener("click",()=>setTargetMarkets([]));
  document.querySelectorAll("[data-question]").forEach(el=>el.addEventListener("input",readAnswers));
  document.querySelector(".steps")?.addEventListener("click",e=>{const marker=e.target.closest("[data-step-marker]");if(marker)openModule(Number(marker.dataset.stepMarker));});
  $("to-questionnaire").addEventListener("click",()=>openModule(2));$("back-to-sources").addEventListener("click",()=>openModule(1));$("analyze-company").addEventListener("click",()=>analyzeCompany(3));
  $("pdf-input").addEventListener("change",e=>handlePdfFiles(e.target.files));
  $("document-list").addEventListener("click",e=>{const btn=e.target.closest("[data-remove-doc]");if(!btn)return;state.documents.splice(Number(btn.dataset.removeDoc),1);saveState();renderDocuments();});
  const zone=$("upload-zone");["dragenter","dragover"].forEach(ev=>zone.addEventListener(ev,e=>{e.preventDefault();zone.classList.add("dragging");}));["dragleave","drop"].forEach(ev=>zone.addEventListener(ev,e=>{e.preventDefault();zone.classList.remove("dragging");}));zone.addEventListener("drop",e=>handlePdfFiles(e.dataTransfer.files));
  $("edit-profile").addEventListener("click",toggleEdit);$("approve-profile").addEventListener("click",approveProfile);$("approve-profile-bottom").addEventListener("click",()=>state.approved?openMarketStrategy():approveProfile());$("improve-profile").addEventListener("click",()=>openModule(1));
  $("back-to-profile").addEventListener("click",()=>openModule(3));
  $("add-custom-signal").addEventListener("click",addCustomSignal);$("run-market-research").addEventListener("click",runMarketResearch);$("activate-market-strategy").addEventListener("click",activateMarketStrategy);$("save-monitoring").addEventListener("click",saveMonitoringConfig);$("run-monitoring-now").addEventListener("click",runMonitoringNow);$("research-mode").addEventListener("change",()=>{state.market.researchMode=$("research-mode").value;saveState();renderResearchControls();});
  $("monitoring-alerts").addEventListener("click",event=>{const button=event.target.closest('[data-monitor-alert-read]');if(button)markMonitoringAlertRead(button.dataset.monitorAlertRead);});
  $("signal-designer").addEventListener("click",e=>{const btn=e.target.closest("[data-remove-signal]");if(btn)removeSignal(Number(btn.dataset.removeSignal));});
  [$("icp-list"),$("signal-designer"),$("market-opportunities")].forEach(container=>{container.addEventListener("change",()=>readMarketEdits());});
  $("reset-workspace").addEventListener("click",resetWorkspace);
  window.addEventListener("leadintel:language-changed",()=>{if(!state.profile)return;state.market=LeadIntelMarket.localizeGeneratedState(state.market,state.profile,contentLanguage());saveState();if(state.step===4)renderMarketStrategy();});
}
function init(){
  syncInputsFromState();bind();updateCompleteness();updateNavigationAvailability();observeNavigation();
  if(state.profile){$("analysis-state").hidden=true;$("profile-content").hidden=false;renderProfile();ensureMarketStrategySeeded();}
  setStep(state.step||1);
}
init();
