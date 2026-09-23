import './content-language.js?v=20260922-campaign-only-v1';
import './content-variants.js?v=20260921-contact-gated-v2';
import './business-identity.js?v=20260906-pain-headings-v1';
import './evidence-view.js?v=20260921-two-stage-profile-action-v1';
import './profile-approval-ui.js?v=20260922-step3-recovery-v1';
import './workspace-persistence.js?v=20260917-reset-clean-v1';
import {withOpenAiRetry,cleanOpenAiResearchQuery,describePartialCoverage} from './market-research-provider-resilience.js?v=20260916-latency-fix-v2';

const STORAGE_KEY="leadintel_customer_v2_state";
const FIRECRAWL_PROXY="https://apollo-proxy.edgars-7e7.workers.dev";
const LEADINTEL_API="https://leadintel-api.edgars-7e7.workers.dev";
const PDFJS_VERSION="6.2.108";
const MAX_PDF_BYTES=15*1024*1024;
const MAX_PDFS=5;
const RESET_CONFIRM_WINDOW_MS=30000;
const ANALYSIS_SOURCE_TIMEOUT_MS=25000;
const MARKET_RESEARCH_RESUME_KEY="leadintel_customer_v2_market_research_resume";
const profileFields=[
  ["companyOverview","Company overview",true],["priorityOffers","Priority offers",false],["idealCustomer","Ideal customer profile",false],["customerPainPoints","Customer Pain Points",true],
  ["decisionMakers","Decision makers",false],["currentMarkets","Current market footprint",false],["targetMarkets","Priority growth markets",false],
  ["valueProposition","Value proposition",true],["differentiation","Competitive advantages",true],["proofPoints","Approved proof points",true],
  ["buyingTriggers","Buying situations / triggers",true],["commonObjections","Common buyer objections",true],["exclusions","Negative ICP / exclusions",false]
];
let state=loadState();
let editMode=false;
let pdfModule=null;
let resetConfirmTimer=null;
let openAiCountdownTimer=null;
let researchElapsedTimer=null;
let researchWindowMinimized=false;
let researchWindowWasRunning=false;
let monitoringLoaded=false;
let monitoringBusy=false;
let pendingResearchMode="";
let brandIdentityUI=null;
const $=id=>document.getElementById(id);
function contentLanguage(){return 'en';}

function defaultState(){
  const base=LeadIntelProfile.normalizeSavedState({step:1,website:"",targetMarkets:[],additionalLinks:[],documents:[],answers:{},scrapedSources:[],profile:null,approved:false});
  base.market=LeadIntelMarket.normalizeMarketState({});
  base.brandIdentity=globalThis.LeadIntelBrandIdentity?.normalize?.({})||null;
  return base;
}
function loadState(){
  try{
    const raw=JSON.parse(localStorage.getItem(STORAGE_KEY)||"{}");
    window.LeadIntelWorkspaceIsolation?.reconcileLocalWorkspace?.(localStorage,raw);
    const saved=JSON.parse(localStorage.getItem(STORAGE_KEY)||"{}");
    const source=saved&&typeof saved==="object"&&!Array.isArray(saved)?saved:raw;
    const base=LeadIntelProfile.normalizeSavedState(source);
    base.market=LeadIntelMarket.recoverInterruptedResearch(source.market||{});
    base.brandIdentity=globalThis.LeadIntelBrandIdentity?.normalize?.(source.brandIdentity||{})||null;
    base.step=window.LeadIntelWorkspaceIsolation?.safeStep
      ?window.LeadIntelWorkspaceIsolation.safeStep(localStorage,base,source.step)
      :([1,2,3,4,5,6,7].includes(Number(source.step))?Number(source.step):base.step);
    return base;
  }catch{return defaultState();}
}
function saveState(){localStorage.setItem(STORAGE_KEY,JSON.stringify(state));updateCompleteness();updateNavigationAvailability();window.LeadIntelJourney?.refresh?.();}
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
  if(step===3&&state.profile){$("analysis-state").hidden=true;$("profile-content").hidden=false;renderProfile();ensureMarketStrategySeeded();}
  if(step===4)renderMarketStrategy();
  window.dispatchEvent(new CustomEvent("leadintel:module-opened",{detail:{step}}));
  window.scrollTo({top:0,behavior:"smooth"});
}
function restoreResetLanding(){
  setStep(1);
  window.LeadIntelJourney?.refresh?.();
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
  $("company-website").value=state.website.replace(/^https?:\/\//,"").replace(/\/$/,"");const additionalLinks=$("additional-links");if(additionalLinks)additionalLinks.value=state.additionalLinks.join("\n");
  document.querySelectorAll("[data-question]").forEach(el=>el.value=state.answers[el.dataset.question]||"");renderTargetMarkets();renderDocuments();brandIdentityUI?.sync?.(state.brandIdentity);
}

function brandIdentityPublicEvidence(){
  const source=state&&typeof state==="object"&&!Array.isArray(state)?state:{};
  const text=(value,max=20000)=>typeof value==="string"?value.trim().slice(0,max):"";
  const https=value=>{const candidate=text(value,2048);if(!candidate)return "";try{const url=new URL(candidate);return url.protocol==="https:"&&!url.username&&!url.password?url.href:"";}catch{return "";}};
  const profileSource=source.profile&&typeof source.profile==="object"&&!Array.isArray(source.profile)?source.profile:{};
  const color=value=>{const candidate=text(value,7).toLowerCase();return /^#[0-9a-f]{6}$/.test(candidate)?candidate:"";};
  const profile={};
  for(const key of ["companyName","companyDisplayName","phone"]){const value=text(profileSource[key],500);if(value)profile[key]=value;}
  for(const key of ["linkedinUrl","logoUrl"]){const value=https(profileSource[key]);if(value)profile[key]=value;}
  const profileColor=color(profileSource.primaryColor);if(profileColor)profile.primaryColor=profileColor;
  const scrapedSources=(Array.isArray(source.scrapedSources)?source.scrapedSources:[]).filter(item=>item&&typeof item==="object"&&!Array.isArray(item)).map(item=>{
    const safe={};
    const sourceUrl=https(item.url);if(sourceUrl)safe.url=sourceUrl;
    for(const key of ["status","title","text"]){const value=text(item[key],key==="text"?20000:2048);if(value)safe[key]=value;}
    const logoUrl=https(item.logoUrl);if(logoUrl)safe.logoUrl=logoUrl;
    const primaryColor=color(item.primaryColor);if(primaryColor)safe.primaryColor=primaryColor;
    const metadata=item.metadata&&typeof item.metadata==="object"&&!Array.isArray(item.metadata)?item.metadata:{};
    const safeMetadata={};
    for(const key of ["logoUrl","logo"]){const value=text(metadata[key],2048);if(value)safeMetadata[key]=value;}
    if(Object.keys(safeMetadata).length)safe.metadata=safeMetadata;
    return safe;
  });
  const additionalLinks=(Array.isArray(source.additionalLinks)?source.additionalLinks:[]).map(https).filter(Boolean).slice(0,8);
  const activationSource=source.websiteActivation&&typeof source.websiteActivation==="object"&&!Array.isArray(source.websiteActivation)?source.websiteActivation:{};
  const websiteActivation={};
  const activationLogo=https(activationSource.logoUrl);if(activationLogo)websiteActivation.logoUrl=activationLogo;
  return {profile,scrapedSources,additionalLinks,websiteActivation};
}

function initBrandIdentity(){
  const ui=globalThis.LeadIntelBrandIdentityUI;
  if(!ui?.mount)return;
  brandIdentityUI=ui.mount({
    getIdentity:()=>state.brandIdentity,
    getWebsite:()=>state.website,
    getPublicEvidence:brandIdentityPublicEvidence,
    setIdentity:(identity, detail={})=>{
      state.brandIdentity=globalThis.LeadIntelBrandIdentity.normalize(identity);
      if(detail.persist===false){updateCompleteness();updateNavigationAvailability();return;}
      saveState();
    }
  });
}
function readSources(){
  const previousWebsite=state.website;state.website=LeadIntelProfile.normalizeUrl($("company-website").value);const additionalLinks=$("additional-links");state.additionalLinks=(additionalLinks?.value||"").split(/\n/).map(LeadIntelProfile.normalizeUrl).filter(Boolean).slice(0,8);
  if(previousWebsite&&state.website!==previousWebsite){
    const isolation=window.LeadIntelWorkspaceIsolation;
    if(!isolation||isolation.canonicalDomain(previousWebsite)!==isolation.canonicalDomain(state.website))isolation?.clearDerivedWorkspaceData?.(localStorage);
    invalidateStrategicOutputs(true);
  }
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
  const controller=new AbortController();
  const timeout=setTimeout(()=>controller.abort(),ANALYSIS_SOURCE_TIMEOUT_MS);
  try{
    const response=await fetch(`${FIRECRAWL_PROXY}/firecrawl-scrape`,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({url,formats:["markdown"],onlyMainContent:true,timeout:30000}),signal:controller.signal});
    const payload=await response.json().catch(()=>({}));
    if(!response.ok)throw new Error(payload.error||`Source returned ${response.status}`);
    const data=payload.data||payload;
    const text=String(data.markdown||data.content||"").slice(0,30000);
    if(!text.trim())throw new Error("No readable page content returned");
    const metadata=data.metadata&&typeof data.metadata==="object"&&!Array.isArray(data.metadata)?data.metadata:{};
    const safeLogo=value=>{if(typeof value!=="string"||!value.trim())return "";try{const candidate=new URL(value.trim(),url);return candidate.protocol==="https:"&&!candidate.username&&!candidate.password?candidate.href:"";}catch{return "";}};
    const safeColor=value=>typeof value==="string"&&/^#[0-9a-f]{6}$/i.test(value.trim())?value.trim().toLowerCase():"";
    const logoUrl=[metadata.logoUrl,metadata.logo,metadata.ogImage,metadata.ogImageUrl,metadata.image].map(safeLogo).find(Boolean)||"";
    const primaryColor=[metadata.primaryColor,metadata.themeColor,metadata["theme-color"],data.primaryColor].map(safeColor).find(Boolean)||"";
    return {type,url,title:metadata.title||data.title||new URL(url).hostname,text,status:"ready",...(logoUrl?{logoUrl}:{}),...(primaryColor?{primaryColor}:{})};
  }catch(error){
    if(error?.name==="AbortError")throw new Error(`Source scrape timed out after ${Math.round(ANALYSIS_SOURCE_TIMEOUT_MS/1000)} seconds`);
    throw error;
  }finally{
    clearTimeout(timeout);
  }
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
  const sourceResults=await Promise.all(sources.map(async(source,index)=>{
    try{return {index,source,result:await scrapeSource(source.url,source.type),error:null};}
    catch(error){return {index,source,result:null,error};}
  }));
  for(const {index,source,result,error} of sourceResults){
    if(result){state.scrapedSources.push(result);analysisLog(index===0?"Main website":`Additional source ${index}`);}
    else{analysisLog(index===0?"Main website unavailable":`Source ${index} unavailable`,"warn");state.scrapedSources.push({type:source.type,url:source.url,title:"",text:"",status:`error: ${error?.message||"Source unavailable"}`});}
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
  document.querySelectorAll("textarea[data-profile-field]").forEach(el=>{const key=el.dataset.profileField;const previous=fieldValue(state.profile,key);const next=key==="currentMarkets"?el.value.split(/;|,/).map(x=>x.trim()).filter(Boolean):el.value.trim();state.profile[key]=next;if(key==="customerPainPoints"&&String(next)!==String(previous))state.profile.customerPainPointsStatus="Customer-confirmed";});
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
  saveProfileEdits();state.approved=true;state.profile.approvedAt=new Date().toISOString();seedMarketStrategy();saveState();editMode=false;updateApprovalUI();
  window.dispatchEvent(new CustomEvent("leadintel:workspace-changed",{detail:{source:"profile-approval"}}));
  showToast("Company Intelligence Profile approved");
}
function updateApprovalUI(){
  globalThis.LeadIntelProfileApprovalUI?.updateProfileApprovalUI(document,state.approved);
}
function openMarketStrategy(){if(!state.profile){openModule(4);return;}if(!state.approved){setStep(3);showToast("Approve the profile before continuing to Market Strategy");return;}ensureMarketStrategySeeded();setStep(4);}
function ensureMarketStrategySeeded(){
  if(!state.profile)return;
  const language=contentLanguage();
  if(!state.market)state.market=LeadIntelMarket.normalizeMarketState({});
  if(!state.market.icps.length)state.market.icps=LeadIntelMarket.buildIcpCandidates(state.profile,language);
  const generatedSignals=state.profile.recommendedSignals?.length
    ?state.profile.recommendedSignals
    :(LeadIntelProfile.recommendedSignalsForProfile?.(state.profile)||[]);
  if(!state.profile.recommendedSignals?.length&&generatedSignals.length)state.profile.recommendedSignals=generatedSignals;
  state.market.signals=LeadIntelMarket.normalizeSignals(generatedSignals,state.market.signals);
  if(!state.market.opportunities.length)state.market.opportunities=LeadIntelMarket.buildMarketOpportunities(state.profile,state.market.icps,state.market.signals,state.market.researchResults||[],language);
  state.market=LeadIntelMarket.localizeGeneratedState(state.market,state.profile,language);
  saveState();
}
async function openModule(step){
  const target=Number(step)||1;readSources();
  if(!LeadIntelProfile.canAccessModule(state,target)){showToast("Add your company website and target market first");setStep(1);return false;}
  if(target<=2){setStep(target);return true;}
  if(!state.profile)return analyzeCompany(Math.min(target,3));
  if(target>=4&&!state.approved){setStep(3);showToast("Approve the profile before continuing to Market Strategy");return false;}
  ensureMarketStrategySeeded();
  const safeTarget=window.LeadIntelWorkspaceIsolation?.safeStep?.(localStorage,state,target);
  if(target>=5&&safeTarget!==target){
    setStep(safeTarget||4);
    showToast(target===6?"Save a company to Pipeline in Discovery before opening Campaign Studio.":"Complete the previous stage before continuing.");
    return false;
  }
  setStep(target);return true;
}

function icpActivationRequirement(icp={}){
  if(icp.type==="opportunity-led"){
    const available=(state.market.opportunities||[]).some(item=>item?.active!==false&&item?.profileOnly!==true&&Array.isArray(item?.evidence)&&item.evidence.length>0);
    return {available,reason:"Add and select an evidence-backed market opportunity before activating this ICP."};
  }
  if(icp.type==="lookalike-led"||icp.id==="icp-reference-lookalike"){
    const available=icp.referenceModelAvailable===true;
    return {available,reason:"Activate at least one saved reference-customer model before activating this ICP."};
  }
  return {available:true,reason:""};
}
function enforceIcpActivationRequirements(){
  let changed=false;
  (state.market.icps||[]).forEach(icp=>{
    if(!icpActivationRequirement(icp).available&&icp.active){icp.active=false;changed=true;}
  });
  if(changed)saveState();
}
function readMarketEdits(markDirty=true){
  document.querySelectorAll("[data-icp-field]").forEach(el=>{const item=state.market.icps[Number(el.dataset.index)];if(!item)return;const field=el.dataset.icpField;if(field==="active"){item.active=icpActivationRequirement(item).available&&el.checked;}else item[field]=el.value.trim();});
  document.querySelectorAll("[data-signal-field]").forEach(el=>{const item=state.market.signals[Number(el.dataset.index)];if(!item)return;const field=el.dataset.signalField;if(field==="active")item.active=el.checked;else if(field==="weight")item.weight=Math.max(1,Math.min(10,Number(el.value)||1));else item[field]=el.value.trim();});
  document.querySelectorAll("[data-opportunity-active]").forEach(el=>{const item=state.market.opportunities[Number(el.dataset.opportunityActive)];if(item)item.active=el.checked;});
  syncResearchSourcesToSignals();
  if(markDirty){state.market.strategyApproved=false;state.market.strategyApprovedAt="";}
  saveState();
}
function syncResearchSourcesToSignals(){
  state.market.researchSourceTypes=LeadIntelMarket.filterResearchSourceTypes(state.market.researchSourceTypes||[],state.market.signals||[]);
  if(state.market.monitoring)state.market.monitoring.sourceTypes=LeadIntelMarket.filterResearchSourceTypes(state.market.monitoring.sourceTypes||[],state.market.signals||[]);
}
function renderIcps(){
  enforceIcpActivationRequirements();
  $("icp-list").innerHTML=state.market.icps.map((icp,index)=>{
    const requirement=icpActivationRequirement(icp);
    return `<article class="icp-card ${icp.active?"active":""} ${requirement.available?"":"unavailable"}">
    <div class="icp-card-head"><label class="market-toggle" ${requirement.available?"":`title="${esc(requirement.reason)}"`}><input type="checkbox" data-icp-field="active" data-index="${index}" ${icp.active?"checked":""} ${requirement.available?"":"disabled"}><span></span></label><div><span class="icp-type">${esc(icp.type)}</span><input class="market-inline-title" data-icp-field="name" data-index="${index}" value="${esc(icp.name)}"></div></div>
    <label>Definition<textarea rows="2" data-icp-field="description" data-index="${index}">${esc(icp.description)}</textarea></label>
    <div class="icp-fields"><label>Target markets<input data-icp-field="targetMarkets" data-index="${index}" value="${esc(icp.targetMarkets)}"></label><label>Buyer roles<input data-icp-field="buyerRoles" data-index="${index}" value="${esc(icp.buyerRoles)}"></label></div>
    <div class="icp-fields"><label>Priority offers<input data-icp-field="offers" data-index="${index}" value="${esc(icp.offers)}"></label><label>Commercial value<input data-icp-field="value" data-index="${index}" value="${esc(icp.value)}"></label></div>
    <label>Exclusions<input data-icp-field="exclusions" data-index="${index}" value="${esc(icp.exclusions)}"></label>
    <p>${esc(icp.rationale)}</p>
    ${requirement.available?"":`<div class="icp-requirement" role="status"><strong>Cannot activate yet</strong><span>${esc(requirement.reason)}</span></div>`}
  </article>`;
  }).join("");
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
async function ensureMarketResearchWorkspace(mode){
  const selectedMode=normalizeResearchMode(mode);
  const bridge=await waitForMarketServerBridge();
  if(bridge?.session?.authenticated&&bridge?.workspace?.id){sessionStorage.removeItem(MARKET_RESEARCH_RESUME_KEY);return true;}
  sessionStorage.setItem(MARKET_RESEARCH_RESUME_KEY,selectedMode);
  showToast(`Sign in with Google or Microsoft to start ${researchModeUi(selectedMode).label}`);
  bridge?.signIn?.();
  return false;
}
async function resumePendingMarketResearchAfterAuth(){
  const mode=sessionStorage.getItem(MARKET_RESEARCH_RESUME_KEY);if(!mode)return false;
  const bridge=await waitForMarketServerBridge();
  if(!bridge?.session?.authenticated||!bridge?.workspace?.id)return false;
  sessionStorage.removeItem(MARKET_RESEARCH_RESUME_KEY);
  void runMarketResearch(mode);
  return true;
}
async function searchOpenAiWeb(queryMeta,maxResults=5,signal){
  const bridge=await waitForMarketServerBridge();const workspace=bridge?.workspace;
  if(!bridge?.session?.authenticated||!workspace?.id)return {available:false,reason:"Sign in to use OpenAI signal discovery",results:[]};
  const query=cleanOpenAiResearchQuery(queryMeta.query);
  const response=await fetch(`${LEADINTEL_API}/api/ai/web-search?workspace_id=${encodeURIComponent(workspace.id)}`,{method:"POST",credentials:"include",headers:{"Content-Type":"application/json","Accept":"application/json"},body:JSON.stringify({query,max_results:maxResults}),signal});
  const payload=await response.json().catch(()=>({}));
  if(response.status===409&&payload.error==="OpenAI integration is required for web search")return {available:false,reason:"OpenAI integration is required for web search",results:[]};
  if(!response.ok)throw new Error(payload.error||`OpenAI signal discovery returned ${response.status}`);
  return {available:true,reason:"",results:LeadIntelMarket.normalizeSearchResults({results:payload.results},{...queryMeta,query},"openai")};
}
async function searchMarket(queryMeta,limit=5,signal){
  const response=await fetch(`${FIRECRAWL_PROXY}/firecrawl-search`,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({query:queryMeta.query,limit,scrapeOptions:{formats:["markdown"]}}),signal});
  const payload=await response.json().catch(()=>({}));
  if(!response.ok)throw new Error(payload.error||`Market search returned ${response.status}`);
  return LeadIntelMarket.normalizeSearchResults(payload,queryMeta,"firecrawl");
}
async function searchCustomSource(url,index,signal){
  const response=await fetch(`${FIRECRAWL_PROXY}/firecrawl-scrape`,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({url,formats:["markdown"],onlyMainContent:true,timeout:30000}),signal});
  const payload=await response.json().catch(()=>({}));
  if(!response.ok)throw new Error(payload.error||`Custom source scrape returned ${response.status}`);
  const data=payload?.data||payload;const metadata=data?.metadata||{};const text=String(data?.markdown||data?.content||"").slice(0,5000);
  const extractor=response.headers.get("X-LeadIntel-Extractor")||"firecrawl";
  return LeadIntelMarket.normalizeSearchResults({results:[{url,title:metadata.title||url,description:metadata.description||text.slice(0,500),text}]},{id:`custom-${index+1}`,market:"Custom source",offer:"User-specified source",sourceType:"custom",query:url},extractor);
}
async function extractResearchPages(results,mode,signal,{previouslyExtracted=[]}={}){
  const limits={quick:2,deep:4,intelligence:6};const selected=[];const domains=new Set();
  const extractedUrls=new Set(previouslyExtracted.filter(item=>item?.extractedAt).map(item=>item.url));
  for(const item of results){if(item.extractedAt||extractedUrls.has(item.url))continue;let domain="";try{domain=new URL(item.url).hostname;}catch{}if(!domain||domains.has(domain))continue;domains.add(domain);selected.push(item);if(selected.length>=limits[mode])break;}
  return LeadIntelMarket.mapWithConcurrency(selected,async(item,index)=>{
    try{
      const response=await fetch(`${FIRECRAWL_PROXY}/firecrawl-scrape`,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({url:item.url,formats:["markdown"],onlyMainContent:true,timeout:30000}),signal});
      const payload=await response.json().catch(()=>({}));if(!response.ok)return item;
      const data=payload?.data||payload,metadata=data?.metadata||{};const text=String(data?.markdown||data?.content||"").slice(0,12000);const extractor=response.headers.get("X-LeadIntel-Extractor")||"firecrawl";
      return {...item,title:metadata.title||item.title,description:metadata.description||item.description,text:text||item.text,sourceProviders:[...(item.sourceProviders||[]),extractor],extractedBy:extractor,extractedAt:new Date().toISOString()};
    }catch{return item;}
  },{concurrency:2});
}
async function verifyResearchWithGemini(mode,profile,results,signals,signal){
  const unavailable=reason=>({status:"unavailable",provider:"gemini",role:"verification",web_search:false,reason});
  if(!["deep","intelligence"].includes(mode))return {status:"idle",provider:"gemini",role:"verification",web_search:false,reason:"Verification is reserved for Market Research and Deep Analysis"};
  if(!results.length)return unavailable("No evidence was available to verify");
  const bridge=await waitForMarketServerBridge();const workspace=bridge?.workspace;
  if(!bridge?.session?.authenticated||!workspace?.id)return unavailable("Sign in to use Gemini verification");
  const payload=globalThis.LeadIntelResearchVerification.buildVerificationPayload({mode,profile,signals,results});
  try{
    const response=await fetch(`${LEADINTEL_API}/api/ai/research-verification?workspace_id=${encodeURIComponent(workspace.id)}`,{method:"POST",credentials:"include",headers:{"Content-Type":"application/json","Accept":"application/json"},body:JSON.stringify(payload),signal});
    const data=await response.json().catch(()=>({}));
    if(!response.ok)return unavailable(data.error||`Gemini verification returned ${response.status}`);
    return data;
  }catch{return unavailable("Gemini verification is temporarily unavailable");}
}
function readResearchSettings(){
  const sourceTypes=[...document.querySelectorAll('#research-source-types input:checked')].map(input=>input.value);
  state.market.researchSourceTypes=LeadIntelMarket.filterResearchSourceTypes(sourceTypes.length?sourceTypes:["news"],state.market.signals||[]);
  state.market.researchCustomSources=LeadIntelMarket.splitList($("research-custom-sources").value).slice(0,20);
  state.market.researchInstructions=$("research-instructions").value.trim().slice(0,1200);
  saveState();return state.market;
}
function researchProfile(){
  const activeMarkets=state.market.icps.filter(item=>item.active).map(item=>item.targetMarkets).filter(Boolean).join("; ");
  const targetMarkets=activeMarkets||state.profile.targetMarkets;
  return {...state.profile,targetMarkets,researchMarkets:LeadIntelProfile.expandTargetMarkets(targetMarkets)};
}
function closeResearchPreview(){
  pendingResearchMode="";
  const preview=$("research-run-preview");if(preview)preview.hidden=true;
}
function normalizeResearchMode(mode){return LeadIntelMarket.RESEARCH_MODES[mode]?mode:"quick";}
function researchModeUi(mode){
  const selected=normalizeResearchMode(mode);
  return selected==="intelligence"?{
    label:"Deep Analysis",
    estimate:"usually 5–10 minutes",
    method:"LeadIntel performs the widest investigation across active buying signals and selected source categories. OpenAI discovers relevant public pages; Firecrawl extracts evidence and checks specific URLs; Gemini independently cross-checks only the collected evidence.",
    discoveryNote:"Deep Analysis adds broad strategic context. Company Discovery still runs its own separate search and applies the same qualification checks."
  }:selected==="deep"?{
    label:"Market Research",
    estimate:"usually 2–4 minutes",
    method:"LeadIntel rotates across more active buying signals and the source categories you selected. OpenAI discovers relevant public pages; Firecrawl extracts evidence and checks specific URLs; Gemini independently cross-checks only the collected evidence.",
    discoveryNote:"Market Research is the recommended starting point for Company Discovery. Stage 5 still runs its own company search and checks each match against your active market and buying signals."
  }:{
    label:"Quick Overview",
    estimate:"usually under 1 minute",
    method:"LeadIntel validates the strongest active buying signals across your selected source categories. OpenAI discovers public pages; Firecrawl extracts the available evidence.",
    discoveryNote:"Quick Overview collects a lighter market evidence set. Company Discovery still runs a separate search and the selected company target stays the same, but it has less context for ranking matches. Market Research is recommended for a fuller starting point."
  };
}
function openResearchPreview(mode){
  if(!state.profile){showToast("Add your website and target market so LeadIntel can build a profile first");return;}
  ensureMarketStrategySeeded();readMarketEdits();readResearchSettings();
  pendingResearchMode=normalizeResearchMode(mode);
  state.market.researchMode=pendingResearchMode;$("research-mode").value=pendingResearchMode;saveState();renderResearchControls();
  const limits=LeadIntelMarket.RESEARCH_MODES[pendingResearchMode];
  const modeUi=researchModeUi(pendingResearchMode);
  const profile=researchProfile();const language=contentLanguage();
  const queries=LeadIntelMarket.buildResearchPlan(profile,state.market.signals,{mode:pendingResearchMode,sourceTypes:state.market.researchSourceTypes,instructions:state.market.researchInstructions,language});
  const labels=state.market.researchSourceTypes.map(type=>type[0].toUpperCase()+type.slice(1));
  $("research-preview-title").textContent=modeUi.label;
  $("research-preview-scope").textContent=`${queries.length} planned search${queries.length===1?"":"es"} · ${modeUi.estimate} · up to ${limits.resultsPerQuery} results each · maximum ${limits.maxStoredResults} saved evidence sources${state.market.researchCustomSources.length?` · ${state.market.researchCustomSources.length} direct URL${state.market.researchCustomSources.length===1?"":"s"}`:""}.`;
  $("research-preview-sources").textContent=labels.join(", ")||"No source categories selected";
  $("research-preview-method").textContent=modeUi.method;
  $("research-preview-discovery-note").textContent=modeUi.discoveryNote;
  const suggestions=LeadIntelMarket.buildSuggestedSources(profile,state.market.signals,state.market.researchSourceTypes,language);const added=new Set(state.market.researchCustomSources||[]);
  $("research-suggested-sources").innerHTML=suggestions.length?suggestions.map((item,index)=>`<label><input type="checkbox" data-suggested-source value="${esc(item.url)}" ${added.has(item.url)?"checked disabled":""}><span><strong>${esc(item.name)}</strong><small>${esc(item.reason)}</small><code>${esc(item.url)}</code></span></label>`).join(""):"<p>No specific site recommendations are available for the selected market and source categories. You can still add any public URL manually.</p>";
  $("add-suggested-sources").hidden=!suggestions.length;$("add-suggested-sources").disabled=!suggestions.some(item=>!added.has(item.url));
  $("research-preview-queries").innerHTML=queries.map(item=>`<li><strong>${esc(item.researchCategory)}</strong> · ${esc(item.query)}</li>`).join("")||"<li>No searches could be prepared. Add a target market.</li>";
  $("confirm-market-research").textContent=`Start ${modeUi.label}`;
  $("confirm-market-research").disabled=!queries.length;
  $("research-run-preview").hidden=false;
  $("research-run-preview").scrollIntoView({behavior:"smooth",block:"nearest"});
}
function addSuggestedSources(){
  const urls=[...document.querySelectorAll('[data-suggested-source]:checked:not(:disabled)')].map(input=>input.value);
  if(!urls.length){showToast("Select at least one recommended site");return;}
  state.market.researchCustomSources=[...new Set([...(state.market.researchCustomSources||[]),...urls])].slice(0,20);
  state.market.monitoring=LeadIntelMarket.normalizeMonitoring({...state.market.monitoring,customSources:[...(state.market.monitoring?.customSources||[]),...urls]});
  $("research-custom-sources").value=state.market.researchCustomSources.join("\n");saveState();renderResearchControls();
  const mode=pendingResearchMode;if(mode)openResearchPreview(mode);
  showToast(`${urls.length} recommended site${urls.length===1?"":"s"} added to research and monitoring`);
}
async function runMarketResearch(modeOverride=""){
  if(!state.profile){showToast("Add your website and target market so LeadIntel can build a profile first");return;}
  ensureMarketStrategySeeded();readMarketEdits();readResearchSettings();
  state.market.researchMode=normalizeResearchMode(modeOverride||$("research-mode").value);
  $("research-mode").value=state.market.researchMode;
  if(!await ensureMarketResearchWorkspace(state.market.researchMode))return;
  const profile=researchProfile();
  const selectedSources=state.market.researchSourceTypes;
  const limits=LeadIntelMarket.RESEARCH_MODES[state.market.researchMode];
  const runtime=LeadIntelMarket.researchRuntimePolicy(state.market.researchMode);
  const queries=LeadIntelMarket.buildResearchPlan(profile,state.market.signals,{mode:state.market.researchMode,sourceTypes:selectedSources,instructions:state.market.researchInstructions,language:contentLanguage()});
  if(!queries.length){showToast("Add a target market to improve research precision");return;}
  let totalJobs=queries.length+state.market.researchCustomSources.length;
  const taskCentre=window.LeadIntelTaskCentre;const taskId=`market-research:${Date.now()}`;
  taskCentre?.start({id:taskId,type:'market-research',title:'Market research',stage:'Searching public sources',total:totalJobs,completed:0,canRetry:true});
  taskCentre?.registerActions(taskId,{retry:()=>runMarketResearch(state.market.researchMode)});
  closeResearchPreview();
  const requestsGemini=["deep","intelligence"].includes(state.market.researchMode);
  state.market.researchQuality=null;
  state.market.researchQueries=queries;state.market.researchResults=[];state.market.opportunities=[];state.market.marketConditions=null;state.market.researchErrors=[];state.market.researchStatus="running";state.market.researchStartedAt=Date.now();state.market.researchPhase="finding";state.market.researchSourceStatus={openai:"running",firecrawl:"running",gemini:requestsGemini?"running":"idle"};state.market.researchVerification={status:requestsGemini?"running":"idle",provider:"gemini",role:"verification",webSearch:false,reason:"",summary:"",disagreements:[],missingEvidence:[],verifiedAt:""};state.market.researchProgress={completed:0,total:totalJobs};state.market.strategyApproved=false;saveState();renderMarketStrategy();clearInterval(researchElapsedTimer);researchElapsedTimer=setInterval(renderResearchStatus,1000);
  const researchButtons=[$("run-market-research"),$("run-detailed-research"),$("run-market-intelligence")].filter(Boolean);researchButtons.forEach(button=>{button.disabled=true;button.textContent="Researching…";});
  let openAiAvailable=true,openAiSuccesses=0,openAiFailures=0,firecrawlSuccesses=0,firecrawlFailures=0;
  const recordResearchError=(provider,query,error)=>{if(state.market.researchErrors.length>=12)return;state.market.researchErrors.push({provider,query:String(query||"").slice(0,180),message:String(error?.message||error||"Request failed").replace(/\s+/g," ").trim().slice(0,240)});};
  const updateProgress=completed=>{state.market.researchProgress={completed,total:totalJobs};taskCentre?.update(taskId,{completed,total:totalJobs,stage:'Checking market evidence',resultCount:state.market.researchResults.length});saveState();renderResearchStatus();};
  try{
    const queryResults=await LeadIntelMarket.mapWithConcurrency(queries,async query=>{
      const openAiJob=openAiAvailable?withOpenAiRetry(()=>LeadIntelMarket.withTimeout(signal=>searchOpenAiWeb(query,limits.resultsPerQuery,signal),runtime.requestTimeoutMs,"OpenAI search")).then(found=>({found}),error=>({error})):Promise.resolve({skipped:true});
      const firecrawlJob=LeadIntelMarket.withTimeout(signal=>searchMarket(query,limits.resultsPerQuery,signal),runtime.requestTimeoutMs,"Firecrawl search").then(results=>({results}),error=>({error}));
      const [openAi,firecrawl]=await Promise.all([openAiJob,firecrawlJob]);
      let openAiResults=[],firecrawlResults=[];
      if(openAi.found?.available){openAiResults=openAi.found.results;openAiSuccesses++;}
      else if(openAi.found&&!openAi.found.available){openAiAvailable=false;state.market.researchSourceStatus.openai="unavailable";if(!state.market.researchErrors.some(item=>item.provider==="OpenAI"))recordResearchError("OpenAI",query.query,openAi.found.reason);}
      else if(openAi.error){openAiFailures++;recordResearchError("OpenAI",query.query,openAi.error);}
      if(firecrawl.results){firecrawlResults=firecrawl.results;firecrawlSuccesses++;}else{firecrawlFailures++;recordResearchError("Firecrawl",query.query,firecrawl.error);}
      state.market.researchResults=LeadIntelMarket.mergeResearchResults(state.market.researchResults,openAiResults,firecrawlResults).slice(0,limits.maxStoredResults);
      state.market.researchPhase=state.market.researchResults.length?"extracting":"finding";
      return {openAiResults,firecrawlResults};
    },{concurrency:runtime.concurrency,onProgress:progress=>updateProgress(progress.completed)});
    for(const result of queryResults)state.market.researchResults=LeadIntelMarket.mergeResearchResults(state.market.researchResults,result.openAiResults,result.firecrawlResults).slice(0,limits.maxStoredResults);
    const customResults=await LeadIntelMarket.mapWithConcurrency(state.market.researchCustomSources,async(url,index)=>{
      try{const results=await LeadIntelMarket.withTimeout(signal=>searchCustomSource(url,index,signal),runtime.requestTimeoutMs,"Custom source");firecrawlSuccesses++;return results;}
      catch(error){firecrawlFailures++;recordResearchError("Custom URL",url,error);return [];}
    },{concurrency:runtime.concurrency,onProgress:progress=>updateProgress(queries.length+progress.completed)});
    for(const result of customResults)state.market.researchResults=LeadIntelMarket.mergeResearchResults(state.market.researchResults,[],result).slice(0,limits.maxStoredResults);
    state.market.researchPhase="extracting";renderResearchStatus();
    const extracted=await LeadIntelMarket.withTimeout(signal=>extractResearchPages(state.market.researchResults,state.market.researchMode,signal),runtime.requestTimeoutMs,"Evidence extraction").catch(()=>[]);
    state.market.researchResults=LeadIntelMarket.mergeResearchResults(state.market.researchResults,extracted).slice(0,limits.maxStoredResults);
    const adaptive=globalThis.LeadIntelMarketConditions?.buildAdaptivePlan({mode:state.market.researchMode,market:LeadIntelMarket.effectiveResearchMarkets(profile)[0],offer:String(profile.priorityOffers||"").split(/[;\n]/)[0],results:state.market.researchResults})||{queries:[],gaps:[]};
    if(adaptive.queries.length){
      totalJobs+=adaptive.queries.length;state.market.researchProgress.total=totalJobs;state.market.researchQueries=[...queries,...adaptive.queries];state.market.researchPhase="following";renderResearchStatus();
      const followUps=await LeadIntelMarket.mapWithConcurrency(adaptive.queries,async query=>{
        const [openAi,firecrawl]=await Promise.all([
          openAiAvailable?withOpenAiRetry(()=>LeadIntelMarket.withTimeout(signal=>searchOpenAiWeb(query,limits.resultsPerQuery,signal),runtime.requestTimeoutMs,"OpenAI follow-up")).catch(()=>({available:false,results:[]})):Promise.resolve({available:false,results:[]}),
          LeadIntelMarket.withTimeout(signal=>searchMarket(query,limits.resultsPerQuery,signal),runtime.requestTimeoutMs,"Firecrawl follow-up").catch(()=>[])
        ]);
        return LeadIntelMarket.mergeResearchResults(openAi.results||[],firecrawl);
      },{concurrency:runtime.concurrency,onProgress:progress=>updateProgress(queries.length+state.market.researchCustomSources.length+progress.completed)});
      for(const result of followUps)state.market.researchResults=LeadIntelMarket.mergeResearchResults(state.market.researchResults,result).slice(0,limits.maxStoredResults);
      const followUpExtracted=await LeadIntelMarket.withTimeout(signal=>extractResearchPages(state.market.researchResults,state.market.researchMode,signal,{previouslyExtracted:extracted}),runtime.requestTimeoutMs,"Follow-up evidence extraction").catch(()=>[]);
      state.market.researchResults=LeadIntelMarket.mergeResearchResults(state.market.researchResults,followUpExtracted).slice(0,limits.maxStoredResults);
    }
    if(openAiAvailable)state.market.researchSourceStatus.openai=openAiFailures===0?"complete":openAiSuccesses?"partial":"error";
    state.market.researchSourceStatus.firecrawl=firecrawlFailures===0?"complete":firecrawlSuccesses?"partial":"error";
    if(requestsGemini){
      state.market.researchPhase="verifying";renderResearchStatus();
      const verificationPayload=await LeadIntelMarket.withTimeout(signal=>verifyResearchWithGemini(state.market.researchMode,profile,state.market.researchResults,state.market.signals,signal),runtime.requestTimeoutMs,"Gemini verification").catch(error=>({status:"unavailable",provider:"gemini",role:"verification",web_search:false,reason:error.message}));
      const verified=globalThis.LeadIntelResearchVerification.applyVerification(state.market.researchResults,verificationPayload);
      state.market.researchResults=verified.results;state.market.researchVerification=verified.verification;state.market.researchSourceStatus.gemini=verified.verification.status;
    }
    const operationalFailures=openAiFailures+firecrawlFailures;
    state.market.researchPhase="building";renderResearchStatus();
    const evidenceAssessment=globalThis.LeadIntelMarketConditions?.assessEvidence(state.market.researchResults);
    if(evidenceAssessment)state.market.researchResults=evidenceAssessment.results.slice(0,limits.maxStoredResults);
    state.market.opportunities=LeadIntelMarket.buildMarketOpportunities(profile,state.market.icps,state.market.signals,state.market.researchResults,contentLanguage());
    state.market.marketConditions=state.market.researchMode==="quick"?null:globalThis.LeadIntelMarketConditions?.buildPack(state.market.researchResults)||null;
    state.market.researchQuality=globalThis.LeadIntelMarketConditions?.buildQualityGate(state.market.researchResults,{mode:state.market.researchMode})||null;
    state.market.researchStatus=!state.market.researchResults.length?"error":operationalFailures>0||state.market.researchQuality?.confidence==="Low"?"partial":"complete";
    if(state.market.researchStatus==='error')taskCentre?.fail(taskId,'Market research could not complete',{canRetry:true});else taskCentre?.complete(taskId,{status:state.market.researchStatus,stage:state.market.researchStatus==='partial'?'Completed with source warnings':'Market research complete',resultCount:state.market.researchResults.length});
  }catch(error){
    recordResearchError("LeadIntel","Research run",error);
    state.market.researchStatus=state.market.researchResults.length?"partial":"error";
    state.market.researchSourceStatus={openai:openAiSuccesses?"partial":"error",firecrawl:firecrawlSuccesses?"partial":"error",gemini:requestsGemini?"unavailable":"idle"};
    if(requestsGemini)state.market.researchVerification={status:"unavailable",provider:"gemini",role:"verification",webSearch:false,reason:"Research stopped before verification completed",summary:"",disagreements:[],missingEvidence:[],verifiedAt:""};
    showToast(`Research stopped safely · ${error.message}`);
    taskCentre?.fail(taskId,error,{canRetry:true,resultCount:state.market.researchResults.length});
  }finally{
    clearInterval(researchElapsedTimer);researchElapsedTimer=null;state.market.researchPhase="complete";
    state.market.researchProgress={completed:totalJobs,total:totalJobs};
    state.market.lastResearchAt=new Date().toISOString();state.market.researchHistory=LeadIntelMarket.appendResearchHistory(state.market.researchHistory,{id:`manual-${Date.now()}`,mode:state.market.researchMode,status:state.market.researchStatus,sourceCount:state.market.researchResults.length,queryCount:queries.length,completedAt:state.market.lastResearchAt});saveState();renderMarketStrategy();
    researchButtons.forEach(button=>{button.disabled=false;});
  }
  const sourceNote=` · Discovery: ${state.market.researchSourceStatus.openai==="unavailable"?"OpenAI unavailable":"OpenAI"} · Extraction: Firecrawl${requestsGemini?` · Verification: ${state.market.researchSourceStatus.gemini==="complete"?"Gemini":"Gemini unavailable"}`:""}`;
  showToast(`${state.market.researchStatus==="complete"?"Market research complete":state.market.researchStatus==="partial"?"Market research partially complete":"Market research could not complete"}${sourceNote} · ${state.market.researchResults.length} evidence sources`);
}
function stopOpenAiCountdown(){if(openAiCountdownTimer){clearInterval(openAiCountdownTimer);openAiCountdownTimer=null;}}
function startOpenAiCountdown(){stopOpenAiCountdown();openAiCountdownTimer=setInterval(()=>{if(!state.market.openAiRetryProgress){stopOpenAiCountdown();return;}renderResearchStatus();},1000);}
function openAiRetryStatus(progress={}){const total=Math.max(1,Number(progress.total)||1);const completed=Math.min(Number(progress.completed)||0,total);const current=Math.min(completed+1,total);const remaining=Math.max(0,Math.ceil(((Number(progress.deadlineAt)||Date.now())-Date.now())/1000));const attempt=Math.max(1,Number(progress.attempt)||1);return `OpenAI ${current}/${total} queries · attempt ${attempt}/2 · ${remaining}s remaining`;}
async function retryOpenAiDiscovery(){
  if(state.market.researchStatus==="running")return;
  const queries=[...(state.market.researchQueries||[])];
  if(!queries.length){showToast("No failed OpenAI queries are available to retry");return;}
  if(!await ensureMarketResearchWorkspace(state.market.researchMode))return;
  const preservedResults=[...state.market.researchResults];
  const limits=LeadIntelMarket.RESEARCH_MODES[normalizeResearchMode(state.market.researchMode)];
  const runtime=LeadIntelMarket.researchRuntimePolicy(state.market.researchMode);
  const priorErrors=[...(state.market.researchErrors||[])].filter(item=>String(item.provider).toLowerCase()!=="openai");
  let successes=0,failures=0;const startedAt=Date.now();
  state.market.researchStatus="running";state.market.researchSourceStatus.openai="running";state.market.openAiRetryProgress={completed:0,total:queries.length,attempt:1,startedAt,deadlineAt:Date.now()+runtime.requestTimeoutMs};state.market.researchErrors=priorErrors;saveState();startOpenAiCountdown();renderMarketStrategy();
  try{
    const retried=await LeadIntelMarket.mapWithConcurrency(queries,async(query,index)=>{
      const attemptStarted=Date.now();
      try{
        const found=await withOpenAiRetry(attempt=>{
          state.market.openAiRetryProgress={completed:index,total:queries.length,attempt,startedAt,deadlineAt:Date.now()+runtime.requestTimeoutMs};renderResearchStatus();
          return LeadIntelMarket.withTimeout(signal=>searchOpenAiWeb(query,limits.resultsPerQuery,signal),runtime.requestTimeoutMs,"OpenAI search");
        });
        if(!found.available)throw new Error(found.reason||"OpenAI discovery unavailable");
        successes++;return found.results;
      }catch(error){
        failures++;state.market.researchErrors.push({provider:"OpenAI",query:String(query.query||"").slice(0,180),message:String(error?.message||error).slice(0,240),attempts:2,responseTimeMs:Date.now()-attemptStarted,failureReason:String(error?.cause?.message||error?.message||error).slice(0,240)});return [];
      }
    },{concurrency:runtime.concurrency,onProgress:progress=>{state.market.openAiRetryProgress={...state.market.openAiRetryProgress,...progress,deadlineAt:Date.now()+runtime.requestTimeoutMs};saveState();renderResearchStatus();}});
    for(const results of retried)state.market.researchResults=LeadIntelMarket.mergeResearchResults(state.market.researchResults,results).slice(0,limits.maxStoredResults);
    state.market.researchSourceStatus.openai=failures===0?"complete":successes?"partial":"error";
    state.market.researchStatus=failures===0?"complete":state.market.researchResults.length?"partial":"error";
    state.market.opportunities=LeadIntelMarket.buildMarketOpportunities(researchProfile(),state.market.icps,state.market.signals,state.market.researchResults,contentLanguage());
    state.market.lastOpenAiRetry={attempts:queries.length+failures,responseTimeMs:Date.now()-startedAt,status:state.market.researchSourceStatus.openai,failureReason:failures?"One or more OpenAI queries remained unavailable":""};
  }finally{
    stopOpenAiCountdown();
    state.market.researchResults=LeadIntelMarket.mergeResearchResults(preservedResults,state.market.researchResults).slice(0,limits.maxStoredResults);
    delete state.market.openAiRetryProgress;saveState();renderMarketStrategy();
  }
  showToast(failures?"Firecrawl results preserved — OpenAI still unavailable":"Research complete — OpenAI and Firecrawl succeeded");
}
function scoreCell(label,value){return `<div><span>${label}</span><strong>${value}/20</strong><i style="--score:${value}"></i></div>`;}
function marketConditionSources(items=[]){
  const links=(items||[]).filter(item=>item?.url).slice(0,4);
  return links.length?`<ul>${links.map(item=>`<li><a href="${esc(item.url)}" target="_blank" rel="noopener">${esc(item.title||item.organisation||"View source")}</a></li>`).join("")}</ul>`:`<p class="condition-caveat">No sufficiently specific source was verified for this topic.</p>`;
}
function renderMarketConditions(){
  const section=$("market-conditions"),grid=$("market-condition-grid");if(!section||!grid)return;
  const pack=globalThis.LeadIntelMarketConditions?.normalizePack(state.market.marketConditions);
  section.hidden=!pack;if(!pack){grid.innerHTML="";return;}
  const fundingEvidence=[...(pack.funding.active||[]),...(pack.funding.closed||[])].map(item=>item.source);
  const pricingEvidence=(pack.pricing.examples||[]).map(item=>item.source);
  const cards=[
    ["Market direction",`${pack.direction.label} · ${pack.direction.confidence} confidence`,pack.direction.summary,pack.direction.evidence],
    ["Competition",`${pack.competition.evidence.length} source${pack.competition.evidence.length===1?"":"s"} reviewed`,pack.competition.summary,pack.competition.evidence],
    ["Funding",pack.funding.active.length?`${pack.funding.active.length} active programme${pack.funding.active.length===1?"":"s"}`:"No active programme verified",pack.funding.summary,fundingEvidence],
    ["Pricing",pack.pricing.range?`${pack.pricing.range.minimum}–${pack.pricing.range.maximum} ${pack.pricing.range.currency}/${pack.pricing.range.unit}`:"No reliable range yet",pack.pricing.summary,pricingEvidence],
    ["Demand and buying points",`${pack.demand.evidence.length} commercial source${pack.demand.evidence.length===1?"":"s"}`,pack.demand.summary,pack.demand.evidence],
    ["Practical advice","Focus and resistance",[...(pack.advice.focus||[]),...(pack.advice.resistance||[])].join(" "),[]]
  ];
  grid.innerHTML=cards.map(([title,headline,summary,evidence])=>`<details class="market-condition-card"><summary><span>${esc(title)}</span><strong>${esc(headline)}</strong></summary><p>${esc(summary)}</p>${marketConditionSources(evidence)}</details>`).join("");
}
function renderMarketOpportunities(){
  const target=$("market-opportunities");
  if(!state.market.opportunities.length){target.innerHTML=`<div class="market-empty">${state.market.researchStatus==="running"?"Researching markets…":"Target market strategy is ready. Run market research to add live evidence and improve confidence."}</div>`;return;}
  target.innerHTML=state.market.opportunities.map((opp,index)=>opp.profileOnly?`<article class="opportunity-card unresearched ${opp.active?"active":""}">
    <div class="opportunity-top"><label class="market-toggle"><input type="checkbox" data-opportunity-active="${index}" ${opp.active?"checked":""}><span></span></label><div><span class="opportunity-market">Selected market</span><h4 lang="${contentLanguage()}">${esc(opp.title)}</h4><span class="not-researched-label" data-research-running="${state.market.researchStatus==="running"?"true":"false"}">${state.market.researchStatus==="running"?"Research in progress":"Not researched yet"}</span></div><div class="opportunity-total"><strong>${opp.score.total}</strong><span>/100</span></div></div>
  </article>`:`<article class="opportunity-card ${opp.active?"active":""}">
    <div class="opportunity-top"><label class="market-toggle"><input type="checkbox" data-opportunity-active="${index}" ${opp.active?"checked":""}><span></span></label><div><span class="opportunity-market">${esc(opp.marketLabel||opp.market)}</span><h4 lang="${contentLanguage()}">${esc(opp.title)}</h4></div><div class="opportunity-total"><strong>${opp.score.total}</strong><span>/100</span></div></div>
    <div class="opportunity-meta"><span class="confidence ${opp.confidence.toLowerCase()}">${opp.confidence} confidence</span><span>${opp.evidence.length} evidence source${opp.evidence.length===1?"":"s"}</span></div>
    <details class="opportunity-analysis"><summary>View detailed analysis</summary>
      <p class="opportunity-hypothesis" lang="${contentLanguage()}">${esc(opp.hypothesis)}</p>
      <div class="score-grid">${scoreCell("Fit",opp.score.fit)}${scoreCell("Intent",opp.score.intent)}${scoreCell("Timing",opp.score.timing)}${scoreCell("Value",opp.score.value)}${scoreCell("Evidence",opp.score.evidence)}</div>
      <div class="evidence-links" lang="${contentLanguage()}">${opp.evidence.length?opp.evidence.map(source=>`<a href="${esc(source.url)}" target="_blank" rel="noopener"><strong>${esc(source.displayTitle||source.title)}</strong><small>${esc(source.displayDescription||source.description||source.title).slice(0,180)}</small>${source.verification?`<small class="verification-note">Gemini cross-check · ${esc(source.verification.relevance)} relevance${source.verification.commercialFit!=="unknown"?` · ${esc(source.verification.commercialFit)} commercial fit`:""}</small>`:""}</a>`).join(""):`<div class="evidence-none">No live public evidence was returned. LeadIntel has kept this as a low-evidence hypothesis instead of inventing support.</div>`}</div>
    </details>
  </article>`).join("");
}
function researchRunning(){return state.market.researchStatus==="running";}
function researchProgressView(){
  const retry=state.market.openAiRetryProgress;
  const progress=retry||state.market.researchProgress||{completed:0,total:state.market.researchQueries?.length||1};
  const total=Math.max(1,Number(progress.total)||1),completed=Math.min(total,Number(progress.completed)||0);
  const sources=state.market.researchSourceStatus||{};
  const phase=retry?"retrying":state.market.researchPhase||(completed===0?"finding":completed<total?"extracting":sources.gemini==="running"?"verifying":"building");
  const labels={finding:"Finding evidence",extracting:"Extracting information and checking source pages",following:"Closing evidence gaps",verifying:"Verifying findings",building:"Building opportunities",retrying:"Retrying source discovery",complete:"Complete"};
  const workPercent=Math.round(completed/total*80);
  const percent=retry?Math.min(88,workPercent):phase==="verifying"?92:phase==="building"?96:phase==="complete"?100:Math.min(80,workPercent);
  const elapsedStart=Number(retry?.startedAt||state.market.researchStartedAt||Date.now());
  const elapsed=Math.max(0,Math.floor((Date.now()-elapsedStart)/1000));
  const elapsedLabel=elapsed>=60?`${Math.floor(elapsed/60)}m ${elapsed%60}s`:`${elapsed}s`;
  const market=LeadIntelMarket.splitList(state.profile?.targetMarkets).join(" · ")||LeadIntelMarket.splitList(state.profile?.currentMarkets).join(" · ")||"selected markets";
  const meta=retry?`${openAiRetryStatus(retry)} · ${state.market.researchResults.length} saved source${state.market.researchResults.length===1?"":"s"} · ${elapsedLabel} elapsed`:`${completed} of ${total} searches checked · ${state.market.researchResults.length} source${state.market.researchResults.length===1?"":"s"} found · ${elapsedLabel} elapsed`;
  return {title:`${retry?"Retrying":"Researching"} ${market}`,phase:retry?labels.retrying:labels[phase]||labels.finding,phaseKey:phase,percent,elapsed,meta};
}
let quickResearchInsightTimer=0;
function quickResearchInsight(view){
  const markets=LeadIntelMarket.splitList(state.profile?.targetMarkets).join(" · ")||LeadIntelMarket.splitList(state.profile?.currentMarkets).join(" · ")||"your selected market";
  const offer=LeadIntelMarket.splitList(state.profile?.priorityOffers)[0]||"your priority offer";
  const activeSignals=(state.market.signals||[]).filter(signal=>signal&&signal.active!==false).length;
  const sourceCount=state.market.researchResults.length;
  if(state.market.openAiRetryProgress){
    const retryMessages=["Retrying OpenAI discovery against the planned market searches.",sourceCount?`${sourceCount} saved evidence source${sourceCount===1?" remains":"s remain"} available while this retry runs.`:"This retry checks source discovery from the original research plan."];
    const mode=researchModeUi(state.market.researchMode).label;
    return {label:`${mode} recovery`,text:retryMessages[Math.floor(view.elapsed/8)%retryMessages.length]};
  }
  const messages={
    finding:[
      `Scanning ${markets} for market demand connected to ${offer}.`,
      `Looking for recent evidence that can reveal practical buying triggers and motives.`
    ],
    extracting:[
      `Checking which findings reveal the strongest buying points for ${offer}.`,
      `Separating useful market demand evidence from generic or duplicated web content.`
    ],
    following:[
      `Running focused follow-up searches where the first pass left evidence gaps.`,
      `Checking official sources, pricing and competitive context before drawing conclusions.`
    ],
    verifying:[
      `Comparing ${sourceCount} source${sourceCount===1?"":"s"} before treating a market signal as reliable.`,
      `Checking whether potential pain points and resistance are supported by evidence.`
    ],
    building:[
      `Turning the strongest findings into practical advice on what to focus on next.`,
      `${activeSignals||"Active"} buying signal${activeSignals===1?"":"s"} will help prioritize triggers, motives and potential resistance.`
    ]
  };
  const phase=messages[view.phaseKey]?view.phaseKey:"finding";
  const options=messages[phase];
  const mode=researchModeUi(state.market.researchMode).label;
  const strategic=state.market.researchMode==="intelligence"?[`Checking market direction, competition, pricing and official funding before drawing conclusions.`,`Looking for independent evidence that can support strategic decisions—not just more links.`]:state.market.researchMode==="deep"?[`Comparing demand, competition, funding and pricing evidence for ${markets}.`,`Looking for practical buyer motives, likely resistance and commercially useful market conditions.`]:options;
  return {label:`${mode} insight`,text:(strategic[Math.floor(view.elapsed/8)%strategic.length])};
}
function updateQuickResearchInsight(statusNode,view){
  const card=statusNode.querySelector("[data-quick-research-insight]");
  if(!card)return;
  const insight=quickResearchInsight(view);
  card.hidden=!insight;
  if(!insight)return;
  const label=card.querySelector("strong"),text=card.querySelector("span");
  label.textContent=insight.label;
  if(text.textContent===insight.text)return;
  const apply=()=>{text.textContent=insight.text;card.classList.remove("is-changing");};
  clearTimeout(quickResearchInsightTimer);
  if(!text.textContent||window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches)apply();
  else{card.classList.add("is-changing");quickResearchInsightTimer=setTimeout(apply,160);}
}
function focusWithoutScrolling(node){try{node?.focus({preventScroll:true});}catch{node?.focus();}}
function minimizeResearchProgressWindow(){
  if(!researchRunning())return;
  researchWindowMinimized=true;
  const dialog=$("market-research-window"),dock=document.querySelector("[data-reopen-research-window]");
  if(dialog?.open)dialog.close();
  dock.hidden=false;dock.setAttribute("aria-expanded","false");focusWithoutScrolling(dock);
}
function reopenResearchProgressWindow(){
  if(!researchRunning())return;
  researchWindowMinimized=false;
  const dialog=$("market-research-window"),dock=document.querySelector("[data-reopen-research-window]");
  dock.hidden=true;dock.setAttribute("aria-expanded","true");
  if(dialog&&!dialog.open){if(typeof dialog.showModal==="function")dialog.showModal();else dialog.setAttribute("open","");}
  focusWithoutScrolling(dialog?.querySelector("[data-minimize-research-window]"));
}
function renderResearchProgressWindow(status,view){
  const dialog=$("market-research-window"),dock=document.querySelector("[data-reopen-research-window]");
  if(!dialog||!dock)return;
  const running=status==="running";
  const wasRunning=researchWindowWasRunning;
  if(running&&!wasRunning)researchWindowMinimized=false;
  researchWindowWasRunning=running;
  if(!running){
    if(dialog.open)dialog.close();
    else dialog.removeAttribute("open");
    researchWindowMinimized=false;dock.hidden=true;dock.setAttribute("aria-expanded","false");
    if(wasRunning)focusWithoutScrolling($("market-research-status"));
    return;
  }
  const progress=view||researchProgressView(),insight=quickResearchInsight(progress);
  dialog.querySelector("[data-research-window-title]").textContent=progress.title;
  dialog.querySelector("[data-research-window-phase]").textContent=progress.phase;
  dialog.querySelector("[data-research-window-percent]").textContent=`${progress.percent}%`;
  dialog.querySelector("[data-research-window-meta]").textContent=progress.meta;
  dialog.querySelector("[data-research-window-message]").textContent=insight.text;
  dialog.querySelector("[data-research-window-insight-label]").textContent=insight.label;
  const progressbar=dialog.querySelector("[data-research-window-progress]");
  progressbar.setAttribute("aria-valuenow",String(progress.percent));
  progressbar.setAttribute("aria-valuetext",`${progress.percent}% · ${progress.phase}`);
  dialog.querySelector("[data-research-window-bar]").style.width=`${progress.percent}%`;
  dock.querySelector("[data-research-dock-title]").textContent=progress.title;
  dock.querySelector("[data-research-dock-phase]").textContent=`${progress.phase} · ${progress.percent}%`;
  dock.querySelector("[data-research-dock-bar]").style.width=`${progress.percent}%`;
  dock.hidden=!researchWindowMinimized;dock.setAttribute("aria-expanded",String(!researchWindowMinimized));
  if(researchWindowMinimized){if(dialog.open)dialog.close();return;}
  if(!dialog.open){if(typeof dialog.showModal==="function")dialog.showModal();else dialog.setAttribute("open","");}
}
function renderRunningResearchStatus(statusNode,view){
  let head=statusNode.querySelector("[data-research-progress-runtime]");
  if(!head){
    statusNode.innerHTML=`<div class="market-research-progress-head" data-research-progress-runtime><span class="research-status-icon is-running" aria-hidden="true">⌕</span><span class="research-status-copy"><strong id="market-research-progress-title"></strong><small id="market-research-progress-phase"></small></span><strong class="market-research-progress-percent" id="market-research-progress-percent"></strong></div><div class="market-research-progress-track" id="market-research-progress"><i class="market-research-progress-bar" id="market-research-progress-bar"></i></div><div class="market-research-progress-meta" id="market-research-progress-meta"></div><aside class="quick-research-insight" data-quick-research-insight aria-live="off" hidden><strong>Research insight</strong><span></span></aside>`;
    head=statusNode.querySelector("[data-research-progress-runtime]");
  }
  head.querySelector("#market-research-progress-title").textContent=view.title;
  head.querySelector("#market-research-progress-phase").textContent=`${view.phase} · ${researchModeUi(state.market.researchMode).estimate}. You can keep this page open while LeadIntel works.`;
  head.querySelector("#market-research-progress-percent").textContent=`${view.percent}%`;
  statusNode.querySelector("#market-research-progress-bar").style.width=`${view.percent}%`;
  statusNode.querySelector("#market-research-progress-meta").textContent=view.meta;
  updateQuickResearchInsight(statusNode,view);
}
function renderResearchStatus(){
  const status=state.market.researchStatus;const count=state.market.researchResults.length;const queries=state.market.researchQueries.length;const sources=state.market.researchSourceStatus||{openai:"idle",firecrawl:"idle",gemini:"idle"};
  const modeLabel=researchModeUi(state.market.researchMode).label;
  const partialCoverage=status==="partial"?describePartialCoverage({modeLabel,count,openAiStatus:sources.openai,firecrawlStatus:sources.firecrawl}):null;
  const statusNode=$("market-research-status");
  const completedWithEvidence=(status==="complete"||status==="partial")&&count>0;
  if(statusNode){
    statusNode.dataset.status=completedWithEvidence?(status==="partial"?"complete-with-warning":"complete"):status;
    if(status==="running"&&!state.market.openAiRetryProgress){
      const view=researchProgressView();
      renderRunningResearchStatus(statusNode,view);
    }else if(state.market.openAiRetryProgress){const progress=state.market.openAiRetryProgress;statusNode.dataset.status="complete-with-warning";statusNode.innerHTML=`<span class="research-status-icon" aria-hidden="true">↻</span><span class="research-status-copy"><strong>Retrying OpenAI…</strong><small>${esc(openAiRetryStatus(progress))} · ${count} Firecrawl evidence source${count===1?"":"s"} preserved.</small></span><button type="button" class="secondary-btn research-recovery-action" disabled>Working…</button>`;}
    else if(completedWithEvidence){
      const warning=status==="partial"?(sources.openai==="unavailable"||sources.openai==="error"?"OpenAI discovery timed out. Your Firecrawl results are preserved.":"Some research checks were unavailable. Saved results are preserved."):"";
      const providerSummary=status==="complete"?`OpenAI discovery and Firecrawl extraction completed${["deep","intelligence"].includes(state.market.researchMode)&&sources.gemini==="complete"?" · Gemini verification completed":""}.`:"";
      const retry=status==="partial"&&partialCoverage?`<button type="button" class="secondary-btn research-recovery-action" data-extend-openai>Retry OpenAI</button>`:"";
      statusNode.innerHTML=`<span class="research-status-icon" aria-hidden="true">✓</span><span class="research-status-copy"><strong>${esc(modeLabel)} complete · ${count} source${count===1?"":"s"} saved</strong><small>${providerSummary?`<span>${esc(providerSummary)}</span>`:""}${warning?`<em>${esc(warning)}</em>`:""}</small></span>${retry}`;
      statusNode.querySelector("[data-extend-openai]")?.addEventListener("click",()=>void retryOpenAiDiscovery());
    }else{
      const messages={error:"Research run failed · no public evidence was saved. Review the failure details below, adjust the scope if needed, and retry.",partial:`${modeLabel} partially complete · ${count} evidence sources · some provider checks were unavailable.`,idle:"Target market selected · live market research can increase confidence."};
      statusNode.textContent=status==="partial"&&partialCoverage?partialCoverage.status:(messages[status]||messages.idle);
    }
  }
  renderResearchProgressWindow(status,status==="running"?researchProgressView():null);
  const feedback=$("research-run-feedback");
  if(feedback){
    const errors=state.market.researchErrors||[];const show=status==="error";
    feedback.hidden=!show;feedback.dataset.status=status;
    if(show)feedback.innerHTML=`<div><span class="eyebrow">Research error</span><h4>Research run failed</h4><p>No public evidence was saved. Review the scope and try again.</p></div>${errors.length?`<ul>${errors.slice(0,6).map(item=>`<li><strong>${esc(item.provider||"Source")}</strong><span>${esc(item.message||"Request failed")}</span><small>${esc(item.query)}</small></li>`).join("")}</ul>`:`<p class="research-feedback-empty">The public research providers returned no usable results. Open the research settings to change sources or add specific URLs.</p>`}`;
    else feedback.innerHTML="";
  }
  const actions=[["run-market-research","Quick Overview","Retry Quick Overview"],["run-detailed-research","Market Research","Retry Market Research"],["run-market-intelligence","Deep Analysis","Retry Deep Analysis"]];
  actions.forEach(([id,label,retryLabel])=>{const button=$(id);if(!button)return;button.textContent=status==="running"?"Researching…":status==="error"?retryLabel:`Review ${label}`;button.disabled=status==="running";});
}
function renderMarketJourney(){
  const view=LeadIntelMarket.getMarketJourneyState(state.market);
  const researchPanel=document.querySelector('.research-panel');
  if(researchPanel)researchPanel.dataset.marketStage=view.stage;
  const depthEyebrow=$("market-research-depth-eyebrow"),depthTitle=$("market-research-depth-title"),depthDescription=$("market-research-depth-description");
  if(view.researched){
    if(depthEyebrow)depthEyebrow.textContent=view.stage==="active"?"Market research · Strategy active":"Market research · Review or rerun";
    if(depthTitle)depthTitle.textContent="Choose a research depth or run it again.";
    if(depthDescription)depthDescription.textContent="Quick Overview, Market Research and Deep Analysis stay available. Choose any option to review and start another market research run.";
  }else{
    if(depthEyebrow)depthEyebrow.textContent="Step 1 · Choose research depth";
    if(depthTitle)depthTitle.textContent="How deeply should LeadIntel research this market?";
    if(depthDescription)depthDescription.textContent="Select one option to review the research plan before starting.";
  }
  $("research-results-details").hidden=!view.showScore;
  const resultsIntro=$("research-results-intro");if(resultsIntro)resultsIntro.hidden=!view.researched;
  $("strategy-activation-card").hidden=!view.showActivation;
  $("monitoring-panel").hidden=!view.showMonitoring;
  const activationButton=$("activate-market-strategy");
  const title=$("strategy-activation-title");
  const description=$("strategy-activation-description");
  const step=$("strategy-activation-step");
  activationButton.hidden=false;
  const running=researchRunning();
  activationButton.disabled=running;
  activationButton.textContent=running?"Research in progress — please wait":"Review & Continue to Company Discovery →";
  activationButton.setAttribute("aria-disabled",String(running));
  activationButton.dataset.researchRunning=String(running);
  if(view.stage==="active"){
    step.textContent="Strategy saved";
    title.textContent="Ready to find matching companies";
    description.textContent="Your approved market evidence will guide Company Discovery."
    activationButton.dataset.activationContinue="true";
  }else{
    step.textContent="Next step";
    title.textContent="Ready to find matching companies";
    description.textContent="Your selected opportunities and signals will be saved automatically."
    activationButton.dataset.activationContinue="false";
  }
}
function savedResearchWebsites(){
  return [...new Set((state.market.researchCustomSources||[]).map(LeadIntelProfile.normalizeUrl).filter(Boolean))];
}
function renderSavedResearchWebsites(){
  const list=$("research-saved-websites"),summary=$("research-saved-websites-summary");if(!list||!summary)return;
  const websites=savedResearchWebsites();summary.textContent=websites.length?`${websites.length} website${websites.length===1?"":"s"} saved`:"No websites saved";
  list.hidden=!websites.length;
  list.innerHTML=websites.map(url=>{let label=url;try{label=new URL(url).hostname.replace(/^www\\./i,"");}catch{}return `<li><span><strong>${esc(label)}</strong><small>${esc(url)}</small></span><button type="button" class="text-btn" data-remove-research-website="${esc(url)}" aria-label="Remove ${esc(label)}">Remove</button></li>`;}).join("");
}
function removeSavedResearchWebsite(url){
  const target=LeadIntelProfile.normalizeUrl(url);if(!target)return;
  state.market.researchCustomSources=(state.market.researchCustomSources||[]).filter(item=>LeadIntelProfile.normalizeUrl(item)!==target);
  state.market.monitoring=LeadIntelMarket.normalizeMonitoring({...state.market.monitoring,customSources:(state.market.monitoring?.customSources||[]).filter(item=>LeadIntelProfile.normalizeUrl(item)!==target)});
  $("research-custom-sources").value=state.market.researchCustomSources.join("\\n");saveState();renderResearchControls();renderMonitoringControls();showToast("Website removed from research and monitoring");
}
function renderResearchControls(){
  state.market.researchMode=normalizeResearchMode(state.market.researchMode);$("research-mode").value=state.market.researchMode;syncResearchSourcesToSignals();const selectedSources=new Set(state.market.researchSourceTypes?.length?state.market.researchSourceTypes:(state.market.researchMode==="quick"?["news"]:["news","jobs","investments","company","registries"]));const tenderAllowed=LeadIntelMarket.filterResearchSourceTypes(["tenders"],state.market.signals||[]).includes("tenders");document.querySelectorAll('#research-source-types input').forEach(input=>{input.disabled=input.value==="tenders"&&!tenderAllowed;input.checked=selectedSources.has(input.value)&&!input.disabled;});
  const tenderNote=$("tender-source-note");if(tenderNote)tenderNote.textContent=tenderAllowed?"Tender research is available because the tender signal is active.":"Tenders are excluded. Activate the tender signal above if you want to include them.";
  $("research-custom-sources").value=(state.market.researchCustomSources||[]).join("\n");$("research-instructions").value=state.market.researchInstructions||"";renderSavedResearchWebsites();
  const recommendations=LeadIntelMarket.buildResearchRecommendations(state.profile||{},state.market.signals||[],[...selectedSources],contentLanguage());$("research-recommendations").innerHTML=recommendations.length?recommendations.map(item=>`<div><strong>${esc(item.label)}</strong><span>${esc(item.reason)}</span></div>`).join(""):"<span>Select a source category to see the recommendation.</span>";
  [["run-market-research","quick"],["run-detailed-research","deep"],["run-market-intelligence","intelligence"]].forEach(([id,mode])=>{const button=$(id);const limits=LeadIntelMarket.RESEARCH_MODES[mode];if(button)button.title=`${researchModeUi(mode).label}: maximum ${limits.maxQueries} searches, ${limits.resultsPerQuery} results per search and ${limits.maxStoredResults} stored sources`;});
}
function renderResearchHistory(){const target=$("research-history");const history=state.market.researchHistory||[];target.innerHTML=history.length?history.slice(0,5).map(run=>`<span>${esc(run.mode)} · ${run.sourceCount} sources · ${esc(new Date(run.completedAt).toLocaleDateString())}</span>`).join(""):"";}
async function monitoringApi(path,options={}){const bridge=await waitForMarketServerBridge();if(!bridge?.session?.authenticated||!bridge.workspace?.id)throw new Error("Sign in to use automatic monitoring");const separator=path.includes("?")?"&":"?";const response=await fetch(`${LEADINTEL_API}${path}${separator}workspace_id=${encodeURIComponent(bridge.workspace.id)}`,{credentials:"include",headers:{Accept:"application/json","Content-Type":"application/json",...(options.headers||{})},...options});const payload=await response.json().catch(()=>({}));if(!response.ok)throw new Error(payload.error||`Monitoring returned ${response.status}`);return payload;}
function renderMonitoringControls(){
  const config=LeadIntelMarket.normalizeMonitoring(state.market.monitoring);state.market.monitoring=config;$("monitoring-enabled").checked=config.enabled;$("monitoring-frequency").value=config.frequency;$("monitoring-depth").value=config.researchDepth;$("monitoring-minimum-score").value=config.minimumScore;$("monitoring-custom-sources").value=config.customSources.join("\n");
  const selectedSignals=new Set(config.signalIds.length?config.signalIds:state.market.signals.filter(signal=>signal.active).map(signal=>signal.id));$("monitoring-signals").innerHTML=state.market.signals.filter(signal=>signal.active).map(signal=>`<label><input type="checkbox" data-monitor-signal value="${esc(signal.id)}" ${selectedSignals.has(signal.id)?"checked":""}> ${esc(signal.name)}</label>`).join("")||"<span>No active signals</span>";
  const selectedSources=new Set(config.sourceTypes);$("monitoring-sources").innerHTML=Object.keys(LeadIntelMarket.SOURCE_TYPES).map(source=>`<label><input type="checkbox" data-monitor-source value="${source}" ${selectedSources.has(source)?"checked":""}> ${source[0].toUpperCase()+source.slice(1)}</label>`).join("");
  const locked=!state.market.strategyApproved;$("monitoring-enabled").disabled=locked;$("save-monitoring").disabled=locked||monitoringBusy;$("run-monitoring-now").disabled=locked||monitoringBusy;$("monitoring-status").textContent=locked?"Activate the market strategy before enabling monitoring.":config.enabled?`Monitoring active · ${config.frequency}${config.nextRunAt?` · next run ${new Date(config.nextRunAt).toLocaleString()}`:""}`:"Monitoring is off.";
}
function readMonitoringEdits(){const sourceTypes=LeadIntelMarket.filterResearchSourceTypes([...document.querySelectorAll('[data-monitor-source]:checked')].map(input=>input.value),state.market.signals||[]);state.market.monitoring=LeadIntelMarket.normalizeMonitoring({enabled:$("monitoring-enabled").checked,frequency:$("monitoring-frequency").value,researchDepth:$("monitoring-depth").value,minimumScore:$("monitoring-minimum-score").value,sourceTypes,signalIds:[...document.querySelectorAll('[data-monitor-signal]:checked')].map(input=>input.value),customSources:$("monitoring-custom-sources").value.split(/\n/)});saveState();return state.market.monitoring;}
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
  renderIcps();renderSignalDesigner();renderResearchControls();renderResearchStatus();renderResearchHistory();renderMarketConditions();renderMarketOpportunities();renderMonitoringControls();renderMarketJourney();loadMonitoringServerState();
}
function setActivationFeedback(message,tone){
  const target=$("strategy-activation-feedback");
  if(!target)return;
  target.textContent=message||"";
  target.dataset.state=tone||"";
  target.hidden=!message;
}
function strategyHandoffModel(){
  const icps=(state.market.icps||[]).filter(item=>item.active);
  const signals=(state.market.signals||[]).filter(item=>item.active);
  const opportunities=(state.market.opportunities||[]).filter(item=>item.active);
  const evidence=(state.market.researchResults||[]);
  const monitoring=LeadIntelMarket.normalizeMonitoring(state.market.monitoring);
  const sources=state.market.researchSourceStatus||{};
  const lowSignalCoverage=signals.length>0&&signals.length<3;
  const lowEvidenceCoverage=evidence.length>0&&evidence.length<3;
  const incompleteResearch=state.market.researchStatus==="partial"||Object.values(sources).some(value=>["partial","error","unavailable"].includes(value));
  const blockers=[];
  if(!icps.length)blockers.push("No active ICP");
  if(!signals.length)blockers.push("No active buying signal — required before Company Discovery can rank purchase intent.");
  if(!opportunities.length)blockers.push("No active market opportunity");
  if(!state.market.lastResearchAt||!evidence.length)blockers.push("Market research has not completed");
  const warnings=[];
  if(signals.length===1)warnings.push("Only one active buying signal. Company Discovery can run, but ranking will be narrow. At least 3 active signals are recommended.");
  else if(signals.length===2)warnings.push("Only 2 active buying signals. Company Discovery can run, but at least 3 active signals are recommended.");
  if(lowEvidenceCoverage)warnings.push("Fewer than 3 evidence sources were saved. Discovery confidence may be limited.");
  if(incompleteResearch)warnings.push("Some research checks were unavailable; saved evidence will still be used.");
  if(!monitoring.enabled)warnings.push("Monitoring is off. This one-time Company Discovery will still run normally. Turn on monitoring later to track new buying signals over time.");
  const customSources=state.market.researchCustomSources||[];
  if(customSources.length&&!monitoring.customSources?.length)warnings.push("Preferred research sources are saved but are not included in monitoring.");
  const actions=[];
  if(signals.length<3)actions.push("review-signals","retry-signals");
  return {
    blockers,warnings,actions,
    hasLimitedResults:lowSignalCoverage||lowEvidenceCoverage||incompleteResearch,
    summary:[
      ["Active ICPs",icps.map(item=>item.name||item.description).filter(Boolean).join(" · ")||"None"],
      ["Buying signals",signals.map(item=>item.name).filter(Boolean).join(" · ")||"None"],
      ["Market opportunities",opportunities.map(item=>item.market).filter(Boolean).join(" · ")||"None"],
      ["Evidence",evidence.length+" saved source"+(evidence.length===1?"":"s")],
      ["Monitoring",monitoring.enabled?(monitoring.frequency+" · minimum score "+monitoring.minimumScore):"Off (optional)"],
      ["Next", "Company Discovery will find and rank matching companies using this active strategy."]
    ]
  };
}
function renderStrategyHandoff(){
  const model=strategyHandoffModel();
  $("strategy-handoff-summary").innerHTML=model.summary.map(([label,value])=>`<div><span>${esc(label)}</span><strong>${esc(value)}</strong></div>`).join("");
  const renderNotice=(id,items)=>{const node=$(id);node.hidden=!items.length;node.querySelector("ul").innerHTML=items.map(item=>`<li>${esc(item)}</li>`).join("");};
  renderNotice("strategy-handoff-blockers",model.blockers);
  renderNotice("strategy-handoff-warnings",model.warnings);
  const repairActions=$("strategy-handoff-repair-actions");
  const reviewSignals=$("review-buying-signals");
  const retrySignals=$("retry-signal-recommendations");
  reviewSignals.hidden=!model.actions.includes("review-signals");
  retrySignals.hidden=!model.actions.includes("retry-signals");
  repairActions.hidden=reviewSignals.hidden&&retrySignals.hidden;
  const confirm=$("confirm-strategy-handoff");
  confirm.disabled=Boolean(model.blockers.length);
  confirm.textContent=model.blockers.length?"Complete Required Items":model.hasLimitedResults?"Continue with limited results →":state.market.strategyApproved?"Continue to Company Discovery →":"Activate Strategy & Continue →";
  return model;
}
function reviewBuyingSignalsFromHandoff(){
  closeStrategyHandoff();
  const target=$("signal-designer");
  target?.scrollIntoView({behavior:"smooth",block:"center"});
  target?.querySelector('[data-signal-field="active"]')?.focus();
}
function retrySignalRecommendationsFromHandoff(){
  const regenerated=LeadIntelProfile.recommendedSignalsForProfile?.(state.profile||{})||[];
  const candidates=[...(state.profile?.recommendedSignals||[]),...regenerated,...(LeadIntelProfile.SIGNAL_LIBRARY||[])];
  const unique=[];const seen=new Set();
  for(const signal of candidates){const id=String(signal?.id||"").trim();if(!id||seen.has(id))continue;seen.add(id);unique.push(signal);if(unique.length===5)break;}
  state.profile.recommendedSignals=unique;
  state.market.signals=LeadIntelMarket.normalizeSignals(unique,state.market.signals);
  state.market.strategyApproved=false;state.market.strategyApprovedAt="";
  saveState();renderMarketStrategy();renderStrategyHandoff();
  showToast(`${state.market.signals.length} buying signal recommendations are ready for review`);
}
function openStrategyHandoff(){
  readMarketEdits(false);
  renderMarketStrategy();
  renderStrategyHandoff();
  const dialog=$("strategy-handoff-dialog");
  if(typeof dialog.showModal==="function")dialog.showModal();else dialog.setAttribute("open","");
}
function closeStrategyHandoff(){
  const dialog=$("strategy-handoff-dialog");
  if(typeof dialog.close==="function")dialog.close();else dialog.removeAttribute("open");
}
function waitForDiscoveryOpen(timeoutMs=5000){
  const started=Date.now();
  return new Promise(resolve=>{
    const check=()=>{
      if(document.getElementById("step-5")?.classList.contains("active")){resolve(true);return;}
      if(Date.now()-started>=timeoutMs){resolve(false);return;}
      setTimeout(check,50);
    };
    check();
  });
}
async function openDiscoveryAfterActivation(){
  window.__leadIntelPendingDiscoveryOpen=true;
  if(window.LeadIntelDiscoveryUI?.open)window.LeadIntelDiscoveryUI.open();
  else window.dispatchEvent(new CustomEvent("leadintel:open-discovery"));
  const opened=await waitForDiscoveryOpen();
  window.__leadIntelPendingDiscoveryOpen=!opened;
  return opened;
}
async function activateMarketStrategy(){
  const button=$("activate-market-strategy");
  const confirm=$("confirm-strategy-handoff");
  if(button?.dataset.activationBusy==="true")return;
  const model=strategyHandoffModel();
  if(model.blockers.length){renderStrategyHandoff();return;}
  if(button){button.disabled=true;button.dataset.activationBusy="true";button.textContent="Opening Company Discovery…";}
  if(confirm){confirm.disabled=true;confirm.textContent="Opening Company Discovery…";}
  setActivationFeedback(state.market.strategyApproved?"Strategy is active · opening Company Discovery…":"Saving your market strategy and opening Company Discovery…","running");
  try{
    if(!state.market.strategyApproved){
      state.market.strategyApproved=true;
      state.market.strategyApprovedAt=new Date().toISOString();
      saveState();
      void Promise.resolve().then(()=>window.LeadIntelWorkspacePersistence?.saveWorkspace?.()).catch(error=>console.warn("Market strategy cloud save deferred",error));
    }
    closeStrategyHandoff();
    const opened=await openDiscoveryAfterActivation();
    if(!opened){
      setActivationFeedback("Company Discovery did not open. Please try again.","error");
      showToast("Company Discovery did not open. Please try again.");
      if(button){button.disabled=false;button.textContent="Try Company Discovery Again →";}
      return;
    }
    setActivationFeedback("Company Discovery opened.","success");
    showToast("Market Strategy activated · Company Discovery is ready");
  }catch(error){
    console.error("Market strategy activation failed",error);
    setActivationFeedback("Activation failed · "+(error?.message||"Please try again"),"error");
    showToast("Activation failed · "+(error?.message||"Please try again"));
  }finally{
    if(button)button.dataset.activationBusy="false";
    if(confirm)confirm.disabled=false;
  }
}
function resetCenterStatus(message="",tone=""){
  const node=$("reset-center-status");if(!node)return;
  node.textContent=message;node.dataset.tone=tone;
}
function openResetCenter(){
  const center=$("reset-center");if(!center)return;
  center.hidden=false;document.documentElement.classList.add("reset-center-open");
  resetCenterStatus("");$("factory-reset-confirmation").value="";$("factory-reset-leadintel").disabled=true;
  center.querySelector(".reset-center-close")?.focus();
}
function closeResetCenter(){
  const center=$("reset-center");if(!center)return;
  center.hidden=true;document.documentElement.classList.remove("reset-center-open");$("reset-workspace")?.focus();
}
async function saveResetStateToServer(){
  const bridge=window.LeadIntelServerBridge;
  if(bridge?.session?.authenticated&&bridge.workspace){
    const result=await bridge.saveNow({saveIntent:true,explicitSave:true});
    if(!result.saved)throw new Error("Server reset was not saved");
  }
}
function clearResetLocalKeys(keys=[]){keys.forEach(key=>localStorage.removeItem(key));}
async function resetWorkspace(){
  window.LeadIntelWorkspaceResetHygiene?.prepareWorkspaceReset?.();
  await window.LeadIntelIntelligenceSources?.clearAll?.();
  const persistence=window.LeadIntelWorkspacePersistence;
  persistence?.clearExplicitSave?.();persistence?.clearWorkspaceData?.();
  window.LeadIntelWorkspaceResetHygiene?.clearBrowserWorkspaceResidue?.();
  state=defaultState();editMode=false;saveState();
  clearResetLocalKeys(["leadintel_customer_v2_discovery","leadintel_customer_v2_outreach","leadintel_customer_v2_delivery","leadintel_customer_v2_discovery_meta","leadintel_customer_v2_website_activation_v1","leadintel_customer_v2_research_meta_v1","leadintel_customer_v2_workspace_saved_snapshot_v1"]);
  syncInputsFromState();restoreResetLanding();
  window.dispatchEvent(new CustomEvent("leadintel:workspace-reset",{detail:{scope:"company"}}));
  setTimeout(restoreResetLanding,0);
  await saveResetStateToServer();
  sessionStorage.removeItem("leadintel_customer_v2_server_hydration");
}
async function resetCompanyWorkspace(){
  resetCenterStatus("Removing company workspace data…");
  try{await resetWorkspace();closeResetCenter();showToast("New company workspace ready");}
  catch(error){resetCenterStatus("Reset stopped: "+error.message,"error");}
}
async function resetSelectedSections(){
  const selected=[...document.querySelectorAll(".reset-section-choices input:checked")].map(input=>input.value);
  if(!selected.length){resetCenterStatus("Select at least one section to clear.","error");return;}
  resetCenterStatus("Clearing selected sections…");
  try{
    if(selected.includes("research")){
      state.market=LeadIntelMarket.normalizeMarketState({});
      state.profile=null;state.approved=false;
      clearResetLocalKeys(["leadintel_customer_v2_research_meta_v1"]);
    }
    if(selected.includes("sources"))await window.LeadIntelIntelligenceSources?.clearAll?.();
    if(selected.includes("discovery"))clearResetLocalKeys(["leadintel_customer_v2_discovery","leadintel_customer_v2_discovery_meta"]);
    if(selected.includes("campaigns"))clearResetLocalKeys(["leadintel_customer_v2_outreach","leadintel_customer_v2_delivery"]);
    saveState();syncInputsFromState();await saveResetStateToServer();
    window.dispatchEvent(new CustomEvent("leadintel:workspace-sections-reset",{detail:{sections:selected}}));
    document.querySelectorAll(".reset-section-choices input:checked").forEach(input=>{input.checked=false;});
    closeResetCenter();showToast("Selected sections cleared");
  }catch(error){resetCenterStatus("Could not clear sections: "+error.message,"error");}
}
function clearFactoryPreferences(){
  ["leadintel_customer_v2_content_language","leadintel_customer_v2_ui_preferences","leadintel_customer_v2_attention_preferences","leadintel_customer_v2_dismissed_guidance"].forEach(key=>localStorage.removeItem(key));
}
async function factoryResetLeadIntel(){
  const input=$("factory-reset-confirmation");
  if(input.value.trim()!=="RESET"){resetCenterStatus("Type RESET exactly to confirm the factory reset.","error");return;}
  resetCenterStatus("Running factory reset…");
  try{
    await resetWorkspace();clearFactoryPreferences();
    window.dispatchEvent(new CustomEvent("leadintel:factory-reset"));
    closeResetCenter();showToast("LeadIntel factory reset complete");
  }catch(error){resetCenterStatus("Factory reset stopped: "+error.message,"error");}
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
  $("edit-profile").addEventListener("click",toggleEdit);$("approve-profile").addEventListener("click",()=>approveProfile());$("continue-market-strategy").addEventListener("click",openMarketStrategy);$("recommended-signals").addEventListener("change",()=>{saveProfileEdits();seedMarketStrategy();saveState();updateApprovalUI();showToast("Profile changed · approve it again before continuing");});$("improve-profile").addEventListener("click",()=>openModule(1));
  $("back-to-profile").addEventListener("click",()=>openModule(3));
  $("add-custom-signal").addEventListener("click",addCustomSignal);$("run-market-research").addEventListener("click",()=>openResearchPreview("quick"));$("run-detailed-research").addEventListener("click",()=>openResearchPreview("deep"));$("run-market-intelligence").addEventListener("click",()=>openResearchPreview("intelligence"));$("confirm-market-research").addEventListener("click",()=>{if(pendingResearchMode)void runMarketResearch(pendingResearchMode);});$("cancel-market-research").addEventListener("click",closeResearchPreview);$("add-suggested-sources").addEventListener("click",addSuggestedSources);$("edit-research-settings").addEventListener("click",()=>{const settings=$("research-settings");settings.open=true;closeResearchPreview();settings.scrollIntoView({behavior:"smooth",block:"start"});});
  document.querySelectorAll("[data-minimize-research-window]").forEach(button=>button.addEventListener("click",minimizeResearchProgressWindow));
  const researchWindow=$("market-research-window");researchWindow?.addEventListener("cancel",event=>{event.preventDefault();minimizeResearchProgressWindow();});
  document.querySelector("[data-reopen-research-window]")?.addEventListener("click",reopenResearchProgressWindow);
  $("activate-market-strategy").addEventListener("click",event=>{
    event.preventDefault();
    openStrategyHandoff();
  });$("cancel-strategy-handoff").addEventListener("click",closeStrategyHandoff);$("confirm-strategy-handoff").addEventListener("click",()=>void activateMarketStrategy());$("strategy-handoff-dialog").addEventListener("click",event=>{if(event.target===$("strategy-handoff-dialog"))closeStrategyHandoff();});$("save-monitoring").addEventListener("click",saveMonitoringConfig);$("run-monitoring-now").addEventListener("click",runMonitoringNow);$("research-mode").addEventListener("change",()=>{state.market.researchMode=normalizeResearchMode($("research-mode").value);saveState();renderResearchControls();});$("research-source-types").addEventListener("change",readResearchSettings);$("research-custom-sources").addEventListener("change",()=>{readResearchSettings();renderSavedResearchWebsites();});$("research-saved-websites")?.addEventListener("click",event=>{const button=event.target.closest("[data-remove-research-website]");if(button)removeSavedResearchWebsite(button.dataset.removeResearchWebsite);});$("research-instructions").addEventListener("change",readResearchSettings);
  $("review-buying-signals").addEventListener("click",reviewBuyingSignalsFromHandoff);
  $("retry-signal-recommendations").addEventListener("click",retrySignalRecommendationsFromHandoff);
  $("monitoring-alerts").addEventListener("click",event=>{const button=event.target.closest('[data-monitor-alert-read]');if(button)markMonitoringAlertRead(button.dataset.monitorAlertRead);});
  $("signal-designer").addEventListener("click",e=>{const btn=e.target.closest("[data-remove-signal]");if(btn)removeSignal(Number(btn.dataset.removeSignal));});
  [$("icp-list"),$("market-opportunities")].forEach(container=>{container.addEventListener("change",()=>readMarketEdits());});
  $("signal-designer").addEventListener("change",()=>{readMarketEdits();renderResearchControls();renderMonitoringControls();});
  $("reset-workspace").addEventListener("click",openResetCenter);
  document.querySelectorAll("[data-close-reset-center]").forEach(node=>node.addEventListener("click",closeResetCenter));
  $("reset-new-company").addEventListener("click",resetCompanyWorkspace);
  $("reset-selected-sections").addEventListener("click",resetSelectedSections);
  $("factory-reset-confirmation").addEventListener("input",event=>{$("factory-reset-leadintel").disabled=event.target.value.trim()!=="RESET";resetCenterStatus("");});
  $("factory-reset-leadintel").addEventListener("click",factoryResetLeadIntel);
  window.addEventListener("leadintel:server-ready",()=>{void resumePendingMarketResearchAfterAuth();});
  window.addEventListener("leadintel:review-market-research",()=>openResearchPreview("deep"));
  window.addEventListener("leadintel:website-activated",()=>{
    state=loadState();editMode=false;syncInputsFromState();updateCompleteness();
    $("analysis-state").hidden=true;$("profile-content").hidden=true;
    setStep(1);
  });
  window.addEventListener("leadintel:company-research-updated",()=>{
    state=loadState();editMode=false;syncInputsFromState();updateCompleteness();
  });
}
function init(){
  syncInputsFromState();bind();initBrandIdentity();updateCompleteness();updateNavigationAvailability();observeNavigation();
  setStep(state.step||1);
  void resumePendingMarketResearchAfterAuth();
}
init();
