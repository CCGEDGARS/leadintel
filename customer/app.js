import './monitoring-manager.js?v=20261111-categories-v1&monitoring-ux=20261117-v1&opportunity-inbox=20261119-v1';
import './monitoring-inbox.js?v=20261110-universal-v1&monitoring-categories=20261111-v1&inbox-buttons=20261111-v1&monitoring-filter=20261114-v2&monitoring-ux=20261117-v1&opportunity-inbox=20261119-v1';
import './research-reading-language.js';
import './language-pack-catalogue.js?v=20261027-v1';
import './language-pack-ui.js?v=20261027-v1&research-reading=20261126-v1';
import './company-brain.js?v=20261001-adaptive-business-context-v1&strategy=20261001-v2&profile-review=20261001-v2&profile-repair=20261002-v1&profile-audit=20261030-v1&profile-adviser=20261101-v1&confirmed-profile=20261104-v1';
import './content-language.js?v=20260924-workspace-content-english-v1&kazakhstan-support=20261024-v1&country-language=20261027-v1&brief-retry=20261108-v1&research-reading=20261126-v1';
import './content-variants.js?v=20260929-public-first-email-v1&app-dialogs=20261017-v1';
import './business-identity.js?v=20260924-workspace-profile-english-v1&startup-token-scan=20261016-v1&confirmed-profile=20261104-v1';
import './reference-customers.js?v=20261030-reference-reliability-v1';
import './reference-customer-library.js?v=20260924-reference-consensus-v1&reference-similarity=20260930-v1&reference-refresh=6&reference-save-stability=2&reference-auto=20261101-v1';
import './reference-customer-portfolio.js?v=20260923-reference-interface-v1&reference-discovery=5&reference-similarity=20260930-v1&reference-refresh=6&reference-save-stability=2&list-lifecycle=20261002-v1&qualification-context=20261020-v1&reference-auto=20261101-v1';
import './evidence-view.js?v=20260924-friendly-workflow-labels-v1&profile-overview-hygiene=1&reference-interface=20260923&target-segments=1&profile-ux=1&target-list-edit=1&opportunity-map=1&profile-source=1&map-activation-guide=1&reference-discovery=5&reference-similarity=20260930-v1&reference-activation=6&company-workflow=20261001-v2&profile-market=20261001-v1&guidance-copy=20261001-v1&actual-themes=20261001-v1&adaptive-context=20261001-v1&profile-review=20261001-v2&profile-repair=20261002-v1&rescue=20261013-v1&icp-intent=20261015-v1&observer-stability=20261016-v1&profile-clocks=20261020-v1&profile-audit=20261030-v1&accepted-context=20261101-v1&activation-gates=20261101-v1&reference-auto=20261101-v1&research-row=20261101-v1&research-title-alignment=20261101-v1&confirmed-profile=20261104-v1&opportunity-auto=20261109-v1&confirmed-authority=20261113-v1&company-lifecycle=20261114-v1&research-preview=20261114-v4&strategy-refresh=20261115-v1&company-lists=20261118-v1&profile-research-preservation=20261119-v1';
import './profile-approval-ui.js?v=20260924-friendly-workflow-labels-v1';
import './strategy-integrity.js?strategy-audit=20261030-v1&company-search-recovery=20261119-v1&strategy-review-recovery=20261119-v1';
import './state-budget.js?v=20261009-workspace-section-sync-v1&lossless-recovery=20261009-v1&my-flows=20261010-v1&capacity-diagnostics=20261011-v1&bundle-sync=20261011-v1&text-compression=20261011-v3&codec-loader=20261011-v1&snapshot-quota=20261011-v1&local-storage=20261016-v1&startup-cleanup=20261016-v1&research-recovery=20261020-v1&research-storage=20261101-v1&workspace-transfer=20261110-v1&decoded-local-references=20261114-v6&byte-decode=20261117-v1';
import './workspace-persistence.js?v=20260928-sync-timeout-v1&refresh-protection=1&auto-save=1&research-sync=20261002-v1&sync-recovery=20261004-v2&nested-research-sync=20261005-v3&sync-baseline=20261005-v3&section-capability=20261009-v1&sync-contention=20261011-v1&capacity-diagnostics=20261011-v1&bundle-sync=20261011-v1&text-compression=20261011-v3&snapshot-quota=20261011-v1&indexed-snapshot=20261011-v1&snapshot-body=20261016-v1&sync-budget=20261019-v1&company-save=20261019-v1&research-recovery=20261020-v1&workspace-save=20261020-v1&finish-core=20261024-v1&sender-identity-save=20261025-v1&research-storage=20261101-v1&workspace-transfer=20261110-v1&strategy-recovery=20261114-v2&browser-recovery=20261114-v3&snapshot-owner=20261114-v7&save-ack=20261114-v8&save-latency=20261116-v1&change-save=20261116-v1&baseline-cache=20261117-v1&navigation-save=20261118-v1&unanswered-save=20261121-v1';
import {withOpenAiRetry,cleanOpenAiResearchQuery,describePartialCoverage} from './market-research-provider-resilience.js?v=20260916-latency-fix-v2&diagnostics=20261001-v1&timing=20261001-v1&market-provider-routing=20261119-v1';

const STORAGE_KEY="leadintel_customer_v2_state";
const FIRECRAWL_PROXY="https://apollo-proxy.edgars-7e7.workers.dev";
const LEADINTEL_API="https://leadintel-api.edgars-7e7.workers.dev";
const PDFJS_VERSION="6.2.108";
const MAX_PDF_BYTES=15*1024*1024;
const MAX_PDFS=5;
const RESET_CONFIRM_WINDOW_MS=30000;
const ANALYSIS_SOURCE_TIMEOUT_MS=25000;
// Cover the existing lock (15s), codec (30s), request (30s) and durable
// snapshot (30s) stages. Await their acknowledgement before opening Companies.
const STRATEGY_SAVE_TIMEOUT_MS=120000;
const STRATEGY_RECOVERY_KEY='leadintel_customer_v2_strategy_recovery_v1';
const MARKET_RESEARCH_RESUME_KEY="leadintel_customer_v2_market_research_resume";
const profileFields=[
  ["companyOverview","Company overview",true],["priorityOffers","Priority offers",false],["idealCustomer","Ideal customer profile",false],["customerPainPoints","Customer Pain Points",true],
  ["decisionMakers","Decision makers",false],["currentMarkets","Current market footprint",false],["targetMarkets","Priority growth markets",false],
  ["valueProposition","Value proposition",true],["differentiation","Competitive advantages",true],["proofPoints","Approved proof points",true],
  ["buyingTriggers","Buying situations / triggers",true],["commonObjections","Common buyer objections",true],["exclusions","Negative ICP / exclusions",false]
];
let state=null;
let editMode=false;
let pdfModule=null;
let resetConfirmTimer=null;
let openAiCountdownTimer=null;
let researchElapsedTimer=null;
let researchWindowMinimized=false;
let researchWindowWasRunning=false;
let monitoringLoaded=false;
let monitoringBusy=false;
let monitoringRefreshing=false;
let monitoringDraftBaseline=null;
let monitoringDraftMarket=null;
let pendingResearchMode="",pendingResearchDraft=null;
let brandIdentityUI=null;
let legacyProfileAnalysis=null;
let activeMarketResearchRun=null;
let strategySavedBaseline=null,strategySavedState=null,strategySavedContext="";
let targetingSaveOwner=null,targetingSaveError="";
let monitoringRequestSerial=0;
let monitoringApprovalContext=null;
const $=id=>document.getElementById(id);
function contentLanguage(){return LeadIntelContentLanguage.workspaceContentLanguage();}

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
    if(!Object.hasOwn(source,'researchMeta')){
      try{const legacy=JSON.parse(localStorage.getItem('leadintel_customer_v2_research_meta_v1')||'{}');
      if(legacy.website&&LeadIntelProfile.normalizeUrl(legacy.website)===LeadIntelProfile.normalizeUrl(source.website))source.researchMeta=legacy;}catch{}
    }
    const base=LeadIntelProfile.normalizeSavedState(source);
    base.market=LeadIntelMarket.recoverInterruptedResearch(source.market||{});
    base.brandIdentity=globalThis.LeadIntelBrandIdentity?.normalize?.(source.brandIdentity||{})||null;
    base.senderIdentityVersion=source.senderIdentityVersion===1?1:0;
    strategySavedBaseline=globalThis.LeadIntelStrategyIntegrity?.signature(source)||null;strategySavedState=JSON.parse(JSON.stringify(source));strategySavedContext=profileApprovalContext();window.__leadIntelLocalStrategyConflict=false;window.__leadIntelLocalStrategyConflictPaths=[];
    base.step=window.LeadIntelWorkspaceIsolation?.safeStep
      ?window.LeadIntelWorkspaceIsolation.safeStep(localStorage,base,source.step)
      :([1,2,3,4,5,6,7].includes(Number(source.step))?Number(source.step):base.step);
    return base;
  }catch{return defaultState();}
}
function saveState(){
  if(!state||(window.LeadIntelAccountCache&&window.LeadIntelServerBridge?.ready!==true))return;
  // The customer modal, Messages and the main journey share this storage key.
  // Preserve independently owned fields when an older in-memory app state saves.
  try{
    const current=JSON.parse(localStorage.getItem(STORAGE_KEY)||'{}');
    if(!current||typeof current!=="object"||Array.isArray(current))return false;
    if(current.websiteScans&&typeof current.websiteScans==="object")state.websiteScans=current.websiteScans;
    if(current.eventCampaigns&&typeof current.eventCampaigns==="object")state.eventCampaigns=current.eventCampaigns;
    if(current.campaignStudio&&typeof current.campaignStudio==="object"&&!Array.isArray(current.campaignStudio))state.campaignStudio=current.campaignStudio;
    if(Array.isArray(current.targetCompanies))state.targetCompanies=current.targetCompanies;
    if(current.referenceCustomers&&typeof current.referenceCustomers==='object')state.referenceCustomers=current.referenceCustomers;
    if(current.referenceCustomerPortfolio&&typeof current.referenceCustomerPortfolio==='object')state.referenceCustomerPortfolio=current.referenceCustomerPortfolio;
    if(Object.hasOwn(current,'researchMeta'))state.researchMeta=current.researchMeta;
    // Materials owns its evidence and coverage metadata. Preserve its latest
    // records (including removals) instead of flushing a normalized stale copy.
    if(Array.isArray(current.documents))state.documents=[...(state.documents||[]).filter(doc=>!String(doc?.id||'').startsWith('material:')),...current.documents.filter(doc=>String(doc?.id||'').startsWith('material:'))];
    if(typeof checkStrategyLocalPersistence==='function'&&!checkStrategyLocalPersistence(current))return false;
  }catch{showToast("Saved workspace could not be compared safely. Your local edits are retained; retry after reviewing the saved version.");return false;}
  if(typeof syncStrategyApproval==='function')syncStrategyApproval();
  if(state.targetingConfirmation&&!LeadIntelTargeting.isConfirmed(state))state.targetingConfirmation=null;
  if(typeof renderTargetingConfirmation==="function")renderTargetingConfirmation();
  const serialized=JSON.stringify(state),changed=localStorage.getItem(STORAGE_KEY)!==serialized;
  localStorage.setItem(STORAGE_KEY,serialized);if(changed)window.dispatchEvent(new CustomEvent("leadintel:workspace-dirty"));const persisted=JSON.parse(localStorage.getItem(STORAGE_KEY)||"{}");strategySavedBaseline=globalThis.LeadIntelStrategyIntegrity?.signature(persisted)||null;strategySavedState=persisted;strategySavedContext=profileApprovalContext();updateCompleteness();updateNavigationAvailability();window.LeadIntelJourney?.refresh?.();window.LeadIntelPageQuality?.refresh?.();return true;
}
function esc(value){return String(value??"").replace(/[&<>'"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;","'":"&#39;",'"':"&quot;"}[c]));}
function showToast(message){const el=$("toast");if(!el)return;el.textContent=message;el.classList.add("show");clearTimeout(showToast.t);showToast.t=setTimeout(()=>el.classList.remove("show"),2400);}
function invalidateStrategicOutputs(clearSources=false){
  state.approved=false;state.market=LeadIntelMarket.normalizeMarketState({...state.market,strategyApproved:false,strategyApprovedAt:'',researchContextStale:Boolean(state.market?.researchResults?.length)});
  if(clearSources)state.scrapedSources=[];
  if(state.profile)state.profile=LeadIntelProfile.normalizeSavedState(state).profile;
}
function updateNavigationAvailability(){
  document.querySelectorAll("[data-step-marker]").forEach(el=>{
    const step=Number(el.dataset.moduleStep||el.dataset.stepMarker);const available=LeadIntelProfile.canAccessModule(state,step);
    el.classList.toggle("available",available);el.setAttribute("aria-disabled",available?"false":"true");
  });
}
function observeNavigation(){
  const steps=document.querySelector(".steps");if(!steps||typeof MutationObserver==="undefined")return;
  const observer=new MutationObserver(()=>updateNavigationAvailability());
  observer.observe(steps,{childList:true});
}
function campaignModuleAllowed(step){return Number(step)===6?Boolean(window.LeadIntelEmailCampaignUI?.canWrite?.()||window.LeadIntelEmailCampaignUI?.hasRecipients?.()):Number(step)===7;}
function persistNavigationStep(step){
  if(window.LeadIntelAccountCache&&(window.LeadIntelServerBridge?.ready!==true||window.LeadIntelAccountCache.current?.()===false))return;
  // A route change owns only the last viewed page. Never flush an older form,
  // rebuild strategy, invalidate approvals or announce a business edit here.
  try{const raw=localStorage.getItem(STORAGE_KEY);if(!raw)return;const saved=JSON.parse(raw);if(saved.step===step)return;saved.step=step;localStorage.setItem(STORAGE_KEY,JSON.stringify(saved));}catch{}
}
function setStep(step,{review=false}={}){
  if(!state)return false;
  const reviewingCompanies=review&&Number(step)===5&&Boolean(state.profile&&(state.website||state.profile.website));
  if(Number(step)>=4&&!reviewingCompanies&&!campaignModuleAllowed(step)&&!LeadIntelTargeting.isConfirmed(state)){LeadIntelTargeting.focusRequired(window,state);return false;}
  if(Number(step)>=4&&!reviewingCompanies&&!campaignModuleAllowed(step)&&!state.approved){
    LeadIntelTargeting.focusControl(window,{step:state.profile?3:2,id:state.profile?'approve-profile':'analyze-company',message:'Approve your reviewed profile before continuing to Strategy.'});return false;
  }
  if(Number(step)!==5)window.__leadIntelPendingDiscoveryOpen=false;
  state.step=step;persistNavigationStep(step);
  document.querySelectorAll(".step-view").forEach(el=>el.classList.toggle("active",Number(el.dataset.step)===step));
  document.querySelectorAll("[data-step-marker]").forEach(el=>{const n=Number(el.dataset.stepMarker);el.classList.toggle("active",n===step);el.classList.toggle("complete",n<step);});
  if(step===3&&state.profile){$("analysis-state").hidden=true;$("profile-content").hidden=false;renderProfile();}
  if(step===4)renderMarketStrategy();
  window.dispatchEvent(new CustomEvent("leadintel:module-opened",{detail:{step}}));
  window.scrollTo({top:0,behavior:"smooth"});
  return true;
}
window.LeadIntelCustomerNavigation={setStep,openModule,reviewProfile:analyzeCompany,currentStep:()=>Number(state?.step)||0};
window.LeadIntelProfileAnswers={isReady:()=>Boolean(state)};
window.addEventListener("leadintel:open-module",event=>{const step=Number(event.detail?.step);if(step>=1&&step<=7)void openModule(step);});
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
  const selected=LeadIntelProfile.normalizeTargetCountries(state.targetMarkets);state.targetMarkets=selected;
  const countrySelect=$("target-country");if(countrySelect&&countrySelect.options.length<2){for(const country of LeadIntelProfile.TARGET_COUNTRIES){const option=document.createElement('option');option.value=country;option.textContent=country;countrySelect.appendChild(option);}}
  const keys=new Set(selected.map(item=>item.toLowerCase()));
  document.querySelectorAll("[data-target-market]").forEach(button=>{const active=keys.has(String(button.dataset.targetMarket||"").toLowerCase());button.classList.toggle("selected",active);button.setAttribute("aria-pressed",active?"true":"false");});
  const reading=window.LeadIntelResearchReading;
  const select=$("research-results-language");
  if(reading&&select){
    state.researchResultsLanguage=reading.configure(selected,state.researchResultsLanguage);
    select.onchange=()=>{
      state.researchResultsLanguage=reading.configure(selected,select.value);
      saveState();
    };
  }
  const target=$("selected-target-markets");
  if(target)target.innerHTML=selected.length?selected.map(item=>`<button class="selected-market-chip" type="button" data-remove-target-market="${esc(item)}" aria-label="Remove ${esc(item)}"><span>${esc(item)}</span><b aria-hidden="true">×</b></button>`).join(""):`<span class="market-empty-selection">Choose at least one country to continue.</span>`;
  if($("selected-market-count"))$("selected-market-count").textContent=`${selected.length} selected`;
  if($("clear-target-markets"))$("clear-target-markets").disabled=!selected.length;
}
function setTargetMarkets(markets){
  const next=LeadIntelProfile.normalizeTargetCountries(markets);
  if(JSON.stringify(next)===JSON.stringify(state.targetMarkets)){renderTargetMarkets();return;}
  state.targetMarkets=next;invalidateStrategicOutputs(false);renderTargetMarkets();saveState();
  window.dispatchEvent(new CustomEvent("leadintel:target-markets-changed",{detail:{markets:[...next]}}));
}
function toggleTargetMarket(value){
  const market=LeadIntelProfile.normalizeTargetCountries([value])[0];if(!market)return;
  const exists=state.targetMarkets.some(item=>item.toLowerCase()===market.toLowerCase());
  setTargetMarkets(exists?state.targetMarkets.filter(item=>item.toLowerCase()!==market.toLowerCase()):[...state.targetMarkets,market]);
}
function addCustomTargetMarket(){
  const input=$("target-country");const additions=LeadIntelProfile.normalizeTargetCountries(input?.value||"");
  if(!additions.length){showToast("Choose a country");return;}
  setTargetMarkets([...state.targetMarkets,...additions]);input.value="";showToast(`${additions.length===1?additions[0]:`${additions.length} countries`} added`);
}
function syncInputsFromState(){
  $("company-website").value=(state.setupWebsiteDraft??state.website).replace(/^https?:\/\//,"").replace(/\/$/,"");const additionalLinks=$("additional-links");if(additionalLinks)additionalLinks.value=state.additionalLinks.join("\n");
  document.querySelectorAll("[data-question]").forEach(el=>el.value=state.answers[el.dataset.question]||"");renderTargetMarkets();renderDocuments();renderTargetingConfirmation();brandIdentityUI?.sync?.(state.brandIdentity);
  // Activation may render before authenticated hydration restores the URL field.
  // Refresh its display after restoring inputs without scraping or saving again.
  window.LeadIntelWebsiteActivation?.render?.();
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
      const previousSender=state.brandIdentity?.senderName||'';
      const messageFieldsChanged=['senderName','senderTitle','companyDisplayName','website','linkedinUrl','meetingPlatform'].some(key=>String(state.brandIdentity?.[key]||'')!==String(identity[key]||''));
      state.brandIdentity=globalThis.LeadIntelBrandIdentity.normalize(identity);
      if(detail.persist===false){updateCompleteness();updateNavigationAvailability();return;}
      saveState();
      window.dispatchEvent(new CustomEvent('leadintel:sender-identity-changed',{detail:{previousSender,senderChanged:previousSender!==state.brandIdentity.senderName,messageFieldsChanged}}));
    }
  });
  globalThis.LeadIntelSenderIdentity={
    get:()=>({...state.brandIdentity}),
    setMeetingPlatform(platform){
      if(!['zoom','teams','google_meet'].includes(platform))throw Error('Choose Zoom, Microsoft Teams or Google Meet.');
      const previous=state.brandIdentity;
      state.brandIdentity=globalThis.LeadIntelBrandIdentity.normalize({...previous,meetingPlatform:platform});
      try{saveState();}catch(error){state.brandIdentity=previous;throw error;}
      brandIdentityUI?.sync?.(state.brandIdentity);
      window.dispatchEvent(new CustomEvent('leadintel:sender-identity-changed'));
      return {...state.brandIdentity};
    },
    setLinkedIn(url){
      const previous=state.brandIdentity;
      state.brandIdentity=globalThis.LeadIntelBrandIdentity.normalize({...previous,linkedinUrl:url});
      try{saveState();}catch(error){state.brandIdentity=previous;throw error;}
      brandIdentityUI?.sync?.(state.brandIdentity);
      window.dispatchEvent(new CustomEvent('leadintel:sender-identity-changed'));
      return {...state.brandIdentity};
    },
    initialize(essentials){
    if(!state||(window.LeadIntelAccountCache&&window.LeadIntelServerBridge?.ready!==true))return false;
    // Messages mounts lazily. Its migration owns sender details only; saving the
    // normalized app state here can invalidate an in-flight buyer selection.
    let saved;
    try{
      saved=JSON.parse(localStorage.getItem(STORAGE_KEY)||'{}');
      if(!saved||typeof saved!=='object'||Array.isArray(saved)||!globalThis.LeadIntelSenderIdentityLocation?.migrate(saved,essentials))return false;
      saved.brandIdentity=globalThis.LeadIntelBrandIdentity.normalize(saved.brandIdentity);
      localStorage.setItem(STORAGE_KEY,JSON.stringify(saved));
    }catch{showToast('Sender details could not be restored. Retry after the workspace finishes loading.');return false;}
    state.brandIdentity=saved.brandIdentity;state.senderIdentityVersion=1;
    brandIdentityUI?.sync?.(state.brandIdentity);window.dispatchEvent(new CustomEvent('leadintel:workspace-dirty'));
    updateCompleteness();updateNavigationAvailability();return true;
  }};
}
function readSources(){
  const previousWebsite=state.website;const enteredWebsite=LeadIntelProfile.normalizeUrl($("company-website").value);
  const isolation=window.LeadIntelWorkspaceIsolation;
  const sameCompany=Boolean(previousWebsite&&enteredWebsite&&isolation?.canonicalDomain(previousWebsite)===isolation?.canonicalDomain(enteredWebsite));
  const existingContext=Boolean(state.profile||state.websiteActivation?.status==='active'||state.scrapedSources?.some(source=>source.type==='website'&&source.text));
  if(previousWebsite&&existingContext&&enteredWebsite!==previousWebsite)state.setupWebsiteDraft=enteredWebsite;
  else {delete state.setupWebsiteDraft;state.website=sameCompany?previousWebsite:enteredWebsite;}
  const additionalLinks=$("additional-links");if(additionalLinks)state.additionalLinks=(additionalLinks?.value||"").split(/\n/).map(LeadIntelProfile.normalizeUrl).filter(Boolean).slice(0,8);
  saveState();window.LeadIntelWebsiteActivation?.render?.();
}
function renderTargetingConfirmation(){
  if(targetingSaveOwner&&targetingSaveOwner.context!==profileApprovalContext()){targetingSaveOwner=null;targetingSaveError="";}
  const confirmed=LeadIntelTargeting.isConfirmed(state),button=$("confirm-targeting"),status=$("targeting-confirmation-status"),saving=Boolean(targetingSaveOwner);
  if(button){button.disabled=saving;button.setAttribute?.("aria-busy",String(saving));button.textContent=saving?(targetingSaveOwner.reviewing?"Reviewing changes…":"Saving targeting…"):window.__leadIntelLocalStrategyConflict?"Review conflicting changes →":targetingSaveError?"Retry targeting save →":confirmed?"Targeting confirmed ✓":"Confirm targeting →";}
  if(status)status.textContent=saving?(targetingSaveOwner.reviewing?"Review both versions before applying conflicting changes.":"Saving your confirmed targeting to the workspace…"):targetingSaveError||(confirmed?"Saved. Company search will use these answers.":"Complete the four required answers, then confirm targeting before searching for companies.");
}
async function reviewTargetingConflict(context){
  const record=strategyRecoveryRecord(),sync=window.LeadIntelWorkspaceSync;
  if(!record?.base||!sync?.merge||!window.LeadIntelDialogs?.confirm)throw Error("Conflict review is not available yet. Both versions are retained; retry after the workspace finishes loading.");
  const local=JSON.parse(JSON.stringify(state)),saved=JSON.parse(localStorage.getItem(STORAGE_KEY)||"{}");
  const scope=value=>JSON.stringify([String(value.website||value.profile?.website||'').trim().toLowerCase().replace(/\/$/,''),(Array.isArray(value.targetMarkets)?value.targetMarkets:value.targetMarkets?[value.targetMarkets]:[]).map(String).sort()]);
  if(record.context!==context||scope(record.base)!==scope(saved)||scope(local)!==scope(saved))throw Error("The company or target market changed in another view. Both versions are retained. Open the current company Profile before confirming targeting.");
  if(!sync.equal(saved,record.saved))throw Error("The saved version changed again. Retry to compare the newest changes; both versions are retained.");
  const paths=record.paths||[],read=(value,path)=>path.replace(/^main\.?/,'').replace(/\[([^\]]+)\]/g,'.$1').split('.').filter(Boolean).reduce((node,key)=>Array.isArray(node)?node.find(row=>String(row?.id||row?.domain)===key):node?.[key],value);
  const text=value=>{const body=typeof value==='string'?value:JSON.stringify(value,null,2);return body||'(empty)';};
  const label=path=>window.LeadIntelStep2Readiness?.QUESTION_COPY?.[path.split('.')[2]]?.question||(typeof profileFields!=='undefined'?profileFields.find(([key])=>path.includes('.'+key))?.[1]:null)||path.replace(/^main\./,'').replaceAll('_',' ');
  const comparisons=paths.map(path=>`${label(path)}\nThis view: ${text(read(local,path))}\nSaved view: ${text(read(saved,path))}`).join('\n\n');
  const operation={context,reviewing:true};targetingSaveOwner=operation;renderTargetingConfirmation();
  try{
    const choice=await window.LeadIntelDialogs.confirm('The same fields were edited differently. Choose which version to keep for these conflicts. Independent changes and both original versions are preserved.\n\n'+comparisons,{title:'Review conflicting changes',action:'Keep my reviewed changes',alternativeAction:'Use saved changes'});
    if(!choice)return false;
    if(!profileApprovalCurrent(context)||targetingSaveOwner!==operation||!sync.equal(state,local)||!sync.equal(JSON.parse(localStorage.getItem(STORAGE_KEY)||'{}'),saved))throw Error("Answers or workspace changed while the comparison was open. Retry to review the newest versions.");
    const preference=choice==='alternative'?'server':'local',merged=sync.merge({main:record.base},{main:local},{main:saved},{conflictPreference:preference});
    if(!merged.safe)throw Error("The changes could not be combined safely. Both versions are retained.");
    localStorage.setItem(STRATEGY_RECOVERY_KEY,JSON.stringify({...record,resolution:preference,resolvedAt:new Date().toISOString()}));
    state=merged.payload.main;strategySavedState=saved;strategySavedBaseline=strategyIntegrity().signature(saved);strategySavedContext=context;
    window.__leadIntelLocalStrategyConflict=false;window.__leadIntelLocalStrategyConflictPaths=[];
    syncInputsFromState();
    if(saveState()===false)throw Error("The reviewed changes could not be saved. Both versions are retained; retry saving.");
    return true;
  }finally{if(targetingSaveOwner===operation)targetingSaveOwner=null;renderTargetingConfirmation();}
}
async function confirmTargeting(){
  if(targetingSaveOwner)return false;
  targetingSaveError="";
  const context=profileApprovalContext();let operation,timer;
  try{
    if(readAnswers({fields:Object.keys(LeadIntelTargeting.fields)})===false||window.__leadIntelLocalStrategyConflict){
      if(window.__leadIntelLocalStrategyConflict&&await reviewTargetingConflict(context))return await confirmTargeting();
      throw Error(window.__leadIntelLocalStrategyConflict?"Conflicting changes were not applied. Both versions are retained. Press Review conflicting changes to compare them.":"Targeting could not be saved locally. Your answers are retained; retry saving.");
    }
    const missing=LeadIntelTargeting.missing(state);
    for(const id of Object.keys(LeadIntelTargeting.fields)){const input=document.querySelector(`[data-question="${id}"]`);input?.setAttribute("aria-invalid",missing.includes(id)?"true":"false");}
    if(missing.length){targetingSaveError=`Complete ${missing.length} required ${missing.length===1?"answer":"answers"} before confirming targeting.`;document.querySelector(`[data-question="${missing[0]}"]`)?.focus();return false;}
    const bridge=window.LeadIntelServerBridge;
    if(!bridge?.session?.authenticated||!bridge.workspace?.id||typeof bridge.saveNow!=="function"||!profileApprovalCurrent(context))throw Error("Sign in and wait for the workspace to finish loading, then retry targeting confirmation. Your answers are retained.");
    operation={context,signature:LeadIntelTargeting.signature(state)};targetingSaveOwner=operation;
    const current=()=>targetingSaveOwner===operation&&profileApprovalCurrent(context)&&operation.signature===LeadIntelTargeting.signature(state);
    state.targetingConfirmation=LeadIntelTargeting.confirm(state);
    try{
      const key="leadintel_customer_v2_research_meta_v1",latest=JSON.parse(localStorage.getItem(STORAGE_KEY)||"{}"),meta=Object.hasOwn(latest,'researchMeta')?latest.researchMeta:JSON.parse(localStorage.getItem(key)||"{}");
      if(meta?.website&&LeadIntelProfile.normalizeUrl(meta.website)===LeadIntelProfile.normalizeUrl(state.website)){
        for(const id of Object.keys(LeadIntelTargeting.fields))if(meta.fields?.[id]){meta.fields[id].reviewed=true;meta.fields[id].origin="user";}
        latest.researchMeta=meta;state.researchMeta=meta;localStorage.setItem(STORAGE_KEY,JSON.stringify(latest));localStorage.setItem(key,JSON.stringify(meta));
      }
    }catch{}
    for(const id of Object.keys(LeadIntelTargeting.fields))if(state.answerStatus[id]!=="user")state.answerStatus[id]="accepted";
    if(state.profile){Object.assign(state.profile,LeadIntelTargeting.profileFields(state));for(const key of Object.values(LeadIntelTargeting.fields)){const record=state.profile.canonical?.fields?.[key];if(record)Object.assign(record,{value:state.profile[key],status:"user_confirmed",provenance:"user",confidence:"high"});}}
    if(saveState()===false)throw Error("Targeting could not be saved locally. Your edits are retained; retry after resolving the workspace save status.");
    renderTargetingConfirmation();
    const saved=await Promise.race([Promise.resolve().then(()=>{if(!current())throw Error("Answers or workspace changed while saving. Confirm the updated targeting again.");return bridge.saveNow({saveIntent:true,explicitSave:true});}),new Promise((_,reject)=>{timer=setTimeout(()=>reject(Error("Targeting save timed out. Your answers are retained in this browser; retry saving.")),STRATEGY_SAVE_TIMEOUT_MS);})]);
    if(!current())throw Error("Answers or workspace changed while saving. Confirm the updated targeting again.");
    if(saved?.saved!==true||saved.dirty===true)throw Error("Workspace save was not confirmed. Your answers are retained in this browser; retry targeting save.");
    const stored=JSON.parse(localStorage.getItem(STORAGE_KEY)||"{}");
    if(!LeadIntelTargeting.isConfirmed(stored)||LeadIntelTargeting.signature(stored)!==operation.signature)throw Error("Targeting changed in another view while saving. Review the updated answers and confirm again.");
    showToast("Targeting confirmed and saved");return true;
  }catch(error){if(profileApprovalCurrent(context)){targetingSaveError="Could not confirm targeting. "+(error.message||"Your answers are retained; retry saving.");showToast(targetingSaveError);}return false;}
  finally{clearTimeout(timer);if(targetingSaveOwner===operation)targetingSaveOwner=null;renderTargetingConfirmation();}
}
function readAnswers(options={}){
  const editedId=options?.target?.dataset?.question,selected=editedId?new Set([editedId]):Array.isArray(options.fields)?new Set(options.fields):null;
  // A key press only records the text. Review status, downstream invalidation, the save and the
  // context event run once typing pauses, the field is left, or another caller reads the answers.
  if(editedId&&options.type==='input'){const value=options.target.value.trim();if(state.answers[editedId]!==value){state.answers[editedId]=value;pendingAnswerEdits.add(editedId);}if(answerCommitTimer!==null)clearTimeout(answerCommitTimer);answerCommitTimer=setTimeout(commitPendingAnswers,ANSWER_COMMIT_DELAY_MS);return true;}
  const typed=answerCommitTimer!==null||pendingAnswerEdits.size>0;if(answerCommitTimer!==null){clearTimeout(answerCommitTimer);answerCommitTimer=null;}
  const changed=[...pendingAnswerEdits];pendingAnswerEdits.clear();document.querySelectorAll('[data-question]').forEach(el=>{const id=el.dataset.question;if(selected&&!selected.has(id))return;const value=el.value.trim();if(state.answers[id]!==value&&!changed.includes(id))changed.push(id);state.answers[id]=value;});
  if(changed.length){
    targetingSaveError="";
    state=globalThis.LeadIntelStep2Brief?.applyAnswers?.(state,changed)||state;
    for(const id of changed)state.answerStatus[id]='accepted';
    if(state.profile&&globalThis.LeadIntelCompanyBrain?.classifyCompany)state.profile.companyClassification=LeadIntelCompanyBrain.classifyCompany(state);
    try{const key='leadintel_customer_v2_outreach',data=JSON.parse(localStorage.getItem(key)||'{}');const invalidate=item=>item&&typeof item==='object'?{...item,approved:false,reapprovalRequired:true,contextNeedsRefresh:true}:item;data.items=(data.items||[]).map(invalidate);if(data.buyerDrafts&&typeof data.buyerDrafts==='object'&&!Array.isArray(data.buyerDrafts))data.buyerDrafts=Object.fromEntries(Object.entries(data.buyerDrafts).map(([key,item])=>[key,invalidate(item)]));localStorage.setItem(key,JSON.stringify(data));}catch{}
    if(changed.includes('buying_triggers')&&state.profile){state.profile.recommendedSignals=LeadIntelCompanyBrain.recommendSignals({profile:state.profile,answers:state.answers});state.market.signals=LeadIntelMarket.normalizeSignals(state.profile.recommendedSignals,state.market.signals||[],state.market.deletedSignalIds);/* keep customer-defined (custom-*) signals when triggers change */}
    try{const key='leadintel_customer_v2_discovery',data=JSON.parse(localStorage.getItem(key)||'{}');data.needsRefresh=true;localStorage.setItem(key,JSON.stringify(data));}catch{}
  }
  const saved=saveState();if(changed.length&&typeof CustomEvent!=='undefined')globalThis.window?.dispatchEvent?.(new CustomEvent('leadintel:commercial-context-changed',{detail:{fields:changed}}));
  // The Profile readiness panel was last drawn at key time, before this save.
  if(typed)globalThis.window?.LeadIntelStep2Readiness?.renderReadiness?.(globalThis.window);
  return saved;
}
var ANSWER_COMMIT_DELAY_MS=600,pendingAnswerEdits=new Set(),answerCommitTimer=null;
function commitPendingAnswers(){if(answerCommitTimer===null&&!pendingAnswerEdits.size)return true;return readAnswers({fields:[]});}
// A reload of the saved state must not drop text typed since the last commit.
function loadStateKeepingTypedAnswers(){const typed=[...pendingAnswerEdits].map(id=>[id,state?.answers?.[id]]);const next=loadState();for(const [id,value] of typed)if(typeof value==='string'&&next?.answers)next.answers[id]=value;return next;}
function validateStep1(){
  readSources();
  if(!state.website){$("step1-error").textContent="Enter a valid company website.";return false;}
  if(!state.targetMarkets.length){$("step1-error").textContent="Choose at least one target market.";return false;}
  $("step1-error").textContent="";return true;
}
function validateStep2(){if(readAnswers({fields:[]})===false){$("step2-error").textContent="Review conflicting changes with Confirm targeting before continuing. Your answers are retained.";return false;}if(!LeadIntelProfile.canBuildProfile(state)){$("step2-error").textContent="Add a valid company website and target market in Setup first.";return false;}$("step2-error").textContent="";return true;}

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
  if(window.LeadIntelCompanyMaterials?.upload)return window.LeadIntelCompanyMaterials.upload(files);
  showToast("Material uploads are loading. Try again shortly.");
}
function renderDocuments(){const list=$("document-list");if(!state.documents.length){list.innerHTML="";return;}list.innerHTML=state.documents.map((doc,index)=>String(doc.id||'').startsWith('material:')?'':`<div class="doc-item"><div><span>PDF</span><div><strong>${esc(doc.name)}</strong><small>${formatBytes(doc.size)} · ${doc.text?`${Math.round(doc.text.length/100)/10}k chars extracted`:statusLabel(doc.status)}</small></div></div><div><span class="doc-status">${doc.status==="ready"?"READY":doc.status==="extracting"?"READING…":"REVIEW"}</span><button class="doc-remove" type="button" data-remove-doc="${index}" aria-label="Remove ${esc(doc.name)}">×</button></div></div>`).join("");}
function formatBytes(bytes){return bytes<1024*1024?`${Math.max(1,Math.round(bytes/1024))} KB`:`${(bytes/1024/1024).toFixed(1)} MB`;}
function statusLabel(status){return {"too-large":"over 15 MB","no-text":"no extractable text","error":"text extraction failed","extracting":"extracting text"}[status]||"pending";}

async function scrapeSource(url,type){
  const controller=new AbortController();
  let timeout;const deadline=new Promise((_,reject)=>{timeout=setTimeout(()=>{controller.abort();reject(new Error(`Source scrape timed out after ${Math.round(ANALYSIS_SOURCE_TIMEOUT_MS/1000)} seconds`));},ANALYSIS_SOURCE_TIMEOUT_MS);});
  try{
    return await Promise.race([(async()=>{
    const response=await fetch(`${FIRECRAWL_PROXY}/firecrawl-scrape`,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({url,formats:["markdown"],onlyMainContent:true,timeout:30000}),signal:controller.signal});
    const payload=await response.json().catch(()=>({}));
    if(!response.ok)throw new Error(payload.error||`Source returned ${response.status}`);
    const data=payload.data||payload;
    const text=String(data.markdown||data.content||"").slice(0,30000);
    if(!text.trim())throw new Error("No readable page content returned");
    const metadata=data.metadata&&typeof data.metadata==="object"&&!Array.isArray(data.metadata)?data.metadata:{};
    const resolved=new URL(metadata.url||metadata.sourceURL||data.url||url);
    if(!['http:','https:'].includes(resolved.protocol)||resolved.username||resolved.password||resolved.hostname.replace(/^www\./,'')!==new URL(url).hostname.replace(/^www\./,''))throw Error('Source redirected outside the requested company domain. Review the website identity.');
    const safeLogo=value=>{if(typeof value!=="string"||!value.trim())return "";try{const candidate=new URL(value.trim(),url);return candidate.protocol==="https:"&&!candidate.username&&!candidate.password?candidate.href:"";}catch{return "";}};
    const safeColor=value=>typeof value==="string"&&/^#[0-9a-f]{6}$/i.test(value.trim())?value.trim().toLowerCase():"";
    const logoUrl=[metadata.logoUrl,metadata.logo,metadata.ogImage,metadata.ogImageUrl,metadata.image].map(safeLogo).find(Boolean)||"";
    const primaryColor=[metadata.primaryColor,metadata.themeColor,metadata["theme-color"],data.primaryColor].map(safeColor).find(Boolean)||"";
    return {type,url:resolved.href,...(resolved.href!==url?{requestedUrl:url}:{}),title:metadata.title||data.title||new URL(url).hostname,text,status:"ready",extracted:true,sourceRead:true,evidenceKind:"page_read",extractedAt:new Date().toISOString(),...(logoUrl?{logoUrl}:{}),...(primaryColor?{primaryColor}:{})};
    })(),deadline]);
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
  if(!validateStep2())return false;
  if(state.profile){setStep(3);return true;}
  const original=state,context=profileApprovalContext(),signature=profileApprovalSignature(state);
  if(legacyProfileAnalysis?.state===state&&legacyProfileAnalysis.context===context&&legacyProfileAnalysis.signature===signature)return false;
  const operation={state,context,signature};legacyProfileAnalysis=operation;
  try{
  const current=()=>state===original&&profileApprovalCurrent(context)&&profileApprovalSignature(state)===signature&&profileApprovalSignature(JSON.parse(localStorage.getItem(STORAGE_KEY)||'{}'))===signature;
  setStep(3);$("profile-content").hidden=true;$("analysis-state").hidden=false;$("analysis-log").innerHTML="";
  const sources=[{url:state.website,type:"website"},...state.additionalLinks.map(url=>({url,type:"link"}))].filter(source=>!(state.scrapedSources||[]).some(saved=>LeadIntelProfile.normalizeUrl(saved.url)===LeadIntelProfile.normalizeUrl(source.url)&&saved.extracted!==false&&String(saved.text||'').trim()));
  analysisStatus(sources.length?"Reading missing company sources…":"Using saved company evidence…","Saved readable sources are reused. Missing evidence remains visible in the profile.");
  analysisLog(`Target markets: ${state.targetMarkets.join(" · ")}`);
  const sourceResults=await Promise.all(sources.map(async(source,index)=>{
    try{return {index,source,result:await scrapeSource(source.url,source.type),error:null};}
    catch(error){return {index,source,result:null,error};}
  }));
  if(!current())return false;
  const collected=[...(state.scrapedSources||[])];
  for(const {index,source,result,error} of sourceResults){
    if(result){const previous=collected.findIndex(row=>row.type===result.type&&row.url===result.url);if(previous<0)collected.push(result);else collected[previous]=result;analysisLog(index===0?"Main website":`Additional source ${index}`);}
    else analysisLog(index===0?"Main website unavailable":`Source ${index} unavailable`,"warn");
  }
  const usable=collected.filter(x=>x.text);
  if(!usable.length&&!state.documents.some(doc=>doc.text)){analysisStatus('Company sources unavailable','Your saved work is retained. Retry company research when sources are available.');return false;}
  analysisStatus("Synthesizing strategic context…","Optional answers enrich the website evidence; missing answers remain explicit intelligence gaps.");
  analysisLog(`${usable.length} saved web sources readable`);analysisLog(`${state.documents.filter(d=>d.text).length} PDFs with extracted text`);
  const profile=LeadIntelProfile.buildCompanyIntelligenceProfile({...state,scrapedSources:usable});
  if(!current())return false;
  state.scrapedSources=collected;state.profile=profile;state.approved=false;seedMarketStrategy();
  saveState();analysisLog("Profile built");
  $("analysis-state").hidden=true;$("profile-content").hidden=false;renderProfile();
  return true;
  }finally{if(legacyProfileAnalysis===operation)legacyProfileAnalysis=null;}
}
function fieldValue(profile,key){const value=profile?.[key];return Array.isArray(value)?value.join("; "):String(value||"");}
function renderProfile(){
  const p=state.profile;if(!p)return;
  $("profile-company-name").textContent=p.companyName||"Company";$("profile-mission").textContent=p.mission;$("profile-completeness").textContent=`${p.completeness}%`;
  // The canonical renderer owns its editor, review gaps and compact evidence layout.
  // Its layout retires the legacy gaps panel, and may contain an unfinished edit.
  if(p.canonical?.fields&&globalThis.LeadIntelIntelligenceProfileRuntime){
    globalThis.LeadIntelIntelligenceProfileRuntime.apply();updateApprovalUI();return;
  }
  $("profile-editor").innerHTML=profileFields.map(([key,label,wide])=>`<div class="profile-field ${wide?"wide":""}"><label for="profile-${key}">${esc(label)}</label><textarea id="profile-${key}" data-profile-field="${key}" rows="${wide?3:2}" ${editMode?"":"readonly"}>${esc(fieldValue(p,key))}</textarea></div>`).join("");
  $("recommended-signals").innerHTML=(p.recommendedSignals||[]).map((signal,index)=>`<label class="signal-item"><input type="checkbox" data-signal-index="${index}" ${signal.active===false?"":"checked"}><div><strong>${esc(signal.name)}</strong><small>${esc(signal.reason)}</small></div><span class="priority">${esc(signal.priority)}</span></label>`).join("");
  const sourceSummary=p.sourceSummary||{website:0,additionalLinks:0,documents:0,total:0};
  $("source-summary").innerHTML=`<span class="source-chip">Website ${sourceSummary.website}</span><span class="source-chip">Additional links ${sourceSummary.additionalLinks}</span><span class="source-chip">PDFs ${sourceSummary.documents}</span><span class="source-chip">Total evidence sources ${sourceSummary.total}</span>`;
  $("evidence-digest").innerHTML=globalThis.LeadIntelEvidenceView?.renderEvidence(p)||`<div class="evidence-empty">${esc(p.evidenceDigest||"No readable public/document evidence was collected.")}</div>`;
  const gaps=p.informationGaps||[];$("information-gaps").innerHTML=gaps.length?gaps.map(x=>`<div class="gap-item">${esc(x)}</div>`).join(""):`<div class="gap-item good">No critical context gaps detected for this onboarding stage.</div>`;
  updateApprovalUI();
}
function saveProfileEdits(){
  const canonicalRuntime=globalThis.LeadIntelIntelligenceProfileRuntime;
  if(state.profile?.canonical?.fields&&canonicalRuntime?.profileIsEditing?.())return canonicalRuntime.saveCanonicalEdits();
  let changed=false;
  document.querySelectorAll("textarea[data-profile-field]").forEach(el=>{const key=el.dataset.profileField;const previous=fieldValue(state.profile,key);if(el.value.trim()===previous.trim())return;const next=key==="currentMarkets"?el.value.split(/;|,/).map(x=>x.trim()).filter(Boolean):el.value.trim();state.profile[key]=next;changed=true;if(key==="customerPainPoints")state.profile.customerPainPointsStatus="Customer-confirmed";});
  document.querySelectorAll("[data-signal-index]").forEach(el=>{const signal=state.profile.recommendedSignals[Number(el.dataset.signalIndex)];if(signal&&(signal.active!==false)!==el.checked){signal.active=el.checked;changed=true;}});
  if(!changed)return true;
  state.profile.researchMarkets=LeadIntelProfile.expandTargetMarkets(state.profile.targetMarkets);
  state.approved=false;saveState();
  return true;
}
function acceptCanonicalProfileEdits(event){
  if(event.detail?.source!=="canonical-profile-edit"||!state?.profile?.canonical?.fields)return;
  let saved;try{saved=JSON.parse(localStorage.getItem(STORAGE_KEY)||"{}");}catch{return;}
  if(saved.website!==state.website||!saved.profile?.canonical?.fields)return;
  const fields=globalThis.LeadIntelIntelligenceProfileUI?.CORE_FIELDS;
  if(!fields?.length||fields.some(key=>!saved.profile.canonical.fields[key]))return;
  const changedAnswers=[];
  // The Profile editor writes these fields directly. Adopt only its edit surface;
  // an active research run and unrelated in-memory workspace data retain ownership.
  for(const key of fields){
    const record=saved.profile.canonical.fields[key];
    state.profile[key]=saved.profile[key];state.profile.canonical.fields[key]={...record};
    const answerKey=globalThis.LeadIntelCanonicalIntelligence?.FIELD_MAP?.[key];
    if(key==="commercialObjective")state.workspaceGoals={...(state.workspaceGoals||{}),successOutcome:saved.workspaceGoals?.successOutcome||""};
    else if(answerKey){
      if(String(state.answers[answerKey]||'')!==String(saved.answers?.[answerKey]||''))changedAnswers.push(answerKey);
      state.answers[answerKey]=saved.answers?.[answerKey]||"";state.answerStatus[answerKey]=saved.answerStatus?.[answerKey]||"missing";
      const input=document.querySelector(`[data-question="${answerKey}"]`);if(input)input.value=state.answers[answerKey];
    }
    if(key==="targetMarkets")state.targetMarkets=LeadIntelProfile.normalizeTargetMarkets(saved.targetMarkets);
  }
  if(globalThis.LeadIntelStep2Brief?.applyAnswers)state=globalThis.LeadIntelStep2Brief.applyAnswers(state,changedAnswers);
  globalThis.LeadIntelCanonicalIntelligence?.finalizeProfileQuality?.(state.profile,state);
  state.profile.researchMarkets=LeadIntelProfile.expandTargetMarkets(state.profile.targetMarkets);
  state.approved=false;state.market.strategyApproved=false;state.market.strategyApprovedAt="";
  renderTargetMarkets();saveState();updateApprovalUI();
}
function toggleEdit(){
  if(editMode){if(saveProfileEdits()===false)return false;editMode=false;$("edit-profile").textContent="Edit profile";showToast("Profile edits saved");}else{editMode=true;$("edit-profile").textContent="Save edits";}
  renderProfile();
}
function seedMarketStrategy(){
  const previous=state.market||{};
  if(!state.profile)return;
  const language=contentLanguage();
  const icps=LeadIntelMarket.buildIcpCandidates(state.profile,language).map(item=>{const saved=(previous.icps||[]).find(old=>old.id===item.id);return saved?{...item,active:saved.active,requestedActive:typeof saved.requestedActive==="boolean"?saved.requestedActive:saved.active!==false}:item;});
  for(const saved of previous.icps||[])if(!icps.some(item=>item.id===saved.id))icps.push(saved);
  const previousSignals=previous.signals||[];
  const recommendations=(state.profile.recommendedSignals||[]).map(item=>previousSignals.length&&!previousSignals.some(old=>old.id===item.id)?{...item,active:false}:item);
  const signals=LeadIntelMarket.normalizeSignals(recommendations,previousSignals,previous.deletedSignalIds);
  const opportunities=LeadIntelMarket.buildMarketOpportunities(state.profile,icps,signals,[],language);
  state.market=LeadIntelMarket.normalizeMarketState({...previous,icps,signals,opportunities:previous.researchResults?.length?LeadIntelMarket.buildMarketOpportunities(state.profile,icps,signals,previous.researchResults,language):opportunities,researchStatus:previous.researchStatus||"idle",strategyApproved:false,contentLanguage:language});
}
function requireConfirmedTargeting(){
  if(LeadIntelTargeting.isConfirmed(state))return true;
  closeStrategyHandoff();LeadIntelTargeting.focusRequired(window,state);return false;
}
function profileApprovalSignature(value={}){
  const normalized=LeadIntelProfile.normalizeSavedState(value),profile=normalized.profile||{};
  const fields=(profileFields||[]).map(([key])=>[key,profile[key]??'']);
  const canonical=Object.keys(profile.canonical?.fields||{}).sort().map(key=>{const record=profile.canonical.fields[key];return [key,record.value,record.status,record.provenance,[...(record.sourceIds||[])].sort()];});
  const answers=Object.keys(normalized.answers||{}).sort().map(key=>[key,normalized.answers[key],normalized.answerStatus?.[key]||'']);
  return JSON.stringify([normalized.website,normalized.targetMarkets,fields,canonical,answers,normalized.scrapedSources,normalized.documents,normalized.workspaceGoals?.successOutcome||value.workspaceGoals?.successOutcome||'']);
}
function profileApprovalContext(){return JSON.stringify([window.LeadIntelServerBridge?.workspace?.id||'',window.LeadIntelServerBridge?.session?.user?.id||'',window.LeadIntelServerBridge?.session?.authenticated,localStorage.getItem('leadintel_account_context_v1')]);}
function profileApprovalCurrent(context){return context===profileApprovalContext()&&window.LeadIntelServerBridge?.ready!==false&&(!window.LeadIntelAccountCache||typeof window.LeadIntelAccountCache.current==='function'&&window.LeadIntelAccountCache.current());}
function profileReviewCurrent(){
  try{return profileApprovalSignature(state)===profileApprovalSignature(JSON.parse(localStorage.getItem(STORAGE_KEY)||'{}'));}catch{return false;}
}
function strategyIntegrity(){return globalThis.LeadIntelStrategyIntegrity||window.LeadIntelStrategyIntegrity;}
function captureStrategyContext(research=false){return {account:profileApprovalContext(),profileApproved:state.approved,signature:research?researchContextFingerprint():strategyIntegrity()?.signature(state),research};}
function strategyContextCurrent(context){return Boolean(context&&!window.__leadIntelLocalStrategyConflict&&profileApprovalCurrent(context.account)&&state.approved===context.profileApproved&&context.signature===(context.research?researchContextFingerprint():strategyIntegrity()?.signature(state)));}
function assertStrategyContext(context){if(!strategyContextCurrent(context)){const error=Error('Account, workspace or Strategy changed. The old result was discarded; your saved work is retained.');error.code='STRATEGY_STALE';throw error;}}
function strategyReviewCurrent(){try{return strategyIntegrity()?.signature(state)===strategyIntegrity()?.signature(JSON.parse(localStorage.getItem(STORAGE_KEY)||'{}'));}catch{return false;}}
function strategyRecoveryRecord(){try{const record=JSON.parse(localStorage.getItem(STRATEGY_RECOVERY_KEY)||'null');return record?.context===profileApprovalContext()?record:null;}catch{return null;}}
function renderStrategyRecovery(){
  const record=strategyRecoveryRecord(),details=$('strategy-recovery-details'),button=$('download-strategy-recovery');
  if(button)button.hidden=!record;
  if(details){details.hidden=!record;if(record&&window.__leadIntelLocalStrategyConflict)details.open=true;}
}
function checkStrategyLocalPersistence(saved){
  const integrity=strategyIntegrity();if(!integrity)return true;
  const signature=integrity.signature(saved),diverged=strategySavedBaseline&&signature!==strategySavedBaseline&&signature!==integrity.signature(state);
  const baseline=typeof strategySavedState!=="undefined"?strategySavedState:null,context=profileApprovalContext();
  const ownsBaseline=Boolean(baseline&&typeof strategySavedContext!=="undefined"&&strategySavedContext===context);
  let paths=[];
  if(diverged){
    // Reuse the field-level workspace merge. A hash difference alone does not
    // establish a competing edit: readiness metadata and independent fields can change.
    const scope=value=>JSON.stringify([String(value.website||value.profile?.website||'').trim().toLowerCase().replace(/\/$/,''),(Array.isArray(value.targetMarkets)?value.targetMarkets:value.targetMarkets?[value.targetMarkets]:[]).map(String).sort()]);
    if(ownsBaseline&&scope(baseline)===scope(saved)&&scope(baseline)===scope(state)&&window.LeadIntelWorkspaceSync?.merge){
      try{
        const reviewed=value=>{const copy=JSON.parse(JSON.stringify(value));for(const [id,status] of Object.entries(copy.answerStatus||{}))if(status==='user')copy.answerStatus[id]='accepted';return {main:copy};};
        const result=window.LeadIntelWorkspaceSync.merge(reviewed(baseline),reviewed(state),reviewed(saved));
        if(result.safe){
          state=result.payload.main;
          if(typeof document!=="undefined")document.querySelectorAll?.('[data-question]').forEach(input=>{const value=state.answers?.[input.dataset.question]||'';if(input.value.trim()!==value)input.value=value;});
          window.__leadIntelLocalStrategyConflict=false;window.__leadIntelLocalStrategyConflictPaths=[];return true;
        }
        paths=result.conflicts||[];
      }catch{paths=['main'];}
    }else paths=['main.website','main.targetMarkets'];
    window.__leadIntelLocalStrategyConflict=true;window.__leadIntelLocalStrategyConflictPaths=paths;let retained=false;
    try{localStorage.setItem(STRATEGY_RECOVERY_KEY,JSON.stringify({version:2,context,at:new Date().toISOString(),base:ownsBaseline?baseline:null,local:state,saved,paths}));retained=true;}catch{}
    const message=retained?'Conflicting edits were found in another view. Both versions are preserved; review the conflicting fields before saving.':'Conflicting edits were found and recovery storage is unavailable. Keep this tab open and copy your edits before reloading.';
    setActivationFeedback(message,'error');showToast(message);return false;
  }
  // A prior conflict is not permanent. Retry is safe once the saved version is
  // unchanged from our acknowledged baseline, or already agrees with this view.
  if(window.__leadIntelLocalStrategyConflict&&!ownsBaseline&&signature!==integrity.signature(state))return false;
  window.__leadIntelLocalStrategyConflict=false;window.__leadIntelLocalStrategyConflictPaths=[];return true;
}
function downloadStrategyRecovery(){const record=strategyRecoveryRecord();if(!record)return false;const url=URL.createObjectURL(new Blob([JSON.stringify(record,null,2)],{type:'application/json'})),link=document.createElement('a');link.href=url;link.download='leadintel-strategy-recovery.json';link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);return true;}
function syncStrategyApproval(){
  const integrity=strategyIntegrity(),market=state?.market;if(!integrity||!market)return false;
  const run=typeof activeMarketResearchRun==='undefined'?null:activeMarketResearchRun;
  if(run&&!marketResearchScopeCurrent(run)){
    run.stopReason='Account, workspace or Strategy changed';run.controller.abort();
    if(profileApprovalCurrent(run.context.account)&&market.researchStatus==='running'){
      market.researchStatus=market.researchResults?.length?'partial':'error';market.researchPhase='interrupted';
      market.researchExecution={...run.execution,status:'cancelled',receipts:(run.execution.receipts||[]).map(receipt=>({...receipt,status:receipt.status==='running'?'cancelled':receipt.status==='planned'?'not_run':receipt.status}))};
    }
  }
  const report=integrity.status(state);
  const mismatch=!report.current&&market.strategyApproval&&market.strategyApproval.signature!==(report.signature||integrity.signature(state));
  if((market.strategyApproved&&!report.current)||mismatch){market.strategyApproved=false;market.strategyApprovedAt='';if(market.strategyApprovalInvalidated?.code!==report.code||market.strategyApprovalInvalidated?.reason!==report.reason){market.strategyApprovalInvalidated={code:report.code,reason:report.reason,at:new Date().toISOString()};window.LeadIntelReliabilityTrace?.begin('strategy_edit')?.finish('stale');}return true;}return false;
}
async function saveStrategyApproval(context){
  assertStrategyContext(context);const bridge=window.LeadIntelServerBridge;
  if(bridge?.conflict)throw Error('Resolve the workspace synchronization conflict before activating Strategy.');
  if(!bridge?.session?.authenticated||!bridge.workspace?.id||typeof bridge.saveNow!=='function')throw Error('Sign in and save this workspace before activating Strategy.');
  let timer;try{const result=await Promise.race([Promise.resolve().then(()=>{assertStrategyContext(context);if(bridge.conflict)throw Error('Resolve the workspace synchronization conflict before activating Strategy.');return bridge.saveNow({saveIntent:true,explicitSave:true});}),new Promise((_,reject)=>{timer=setTimeout(()=>reject(Error('Strategy save timed out. Your reviewed work is retained; retry save.')),STRATEGY_SAVE_TIMEOUT_MS);})]);assertStrategyContext(context);if(!strategyReviewCurrent()){const error=Error('Strategy changed in another view during saving. Reopen and review its latest version; your local work is retained.');error.code='STRATEGY_STALE';throw error;}if(result?.saved!==true)throw Error(result?.conflict?'Resolve the workspace synchronization conflict before activating Strategy.':'Strategy is retained locally but workspace save was not confirmed. Retry activation after saving.');return true;}finally{clearTimeout(timer);}
}
function approveProfile(){
  const context=profileApprovalContext(),operation=window.LeadIntelReliabilityTrace?.begin('profile_approval');let previous,outcome='blocked';
  try{
    if(!state?.profile||!profileApprovalCurrent(context)||window.LeadIntelServerBridge?.conflict){showToast('Resolve workspace loading or synchronization before approving the profile.');return false;}
    if(!profileReviewCurrent()){showToast('Profile changed in another view. Reopen and review the latest profile before approval.');return false;}
    if(saveProfileEdits()===false)return false;
    if(globalThis.LeadIntelPageQuality&&!globalThis.LeadIntelPageQuality.require('profile','approve')){showToast(globalThis.LeadIntelPageQuality.getReport('profile').message);return false;}
    if(!requireConfirmedTargeting())return false;
    previous=JSON.parse(JSON.stringify(state));
    if(!state.approved){
      globalThis.LeadIntelCanonicalIntelligence?.confirmProfileContext?.(state);
      state.approved=true;state.profile.approvedAt=new Date().toISOString();seedMarketStrategy();
    }
    operation?.checkpoint('persistence','pending');saveState();
    const saved=JSON.parse(localStorage.getItem(STORAGE_KEY)||'{}');
    if(!profileApprovalCurrent(context)||!saved.approved||profileApprovalSignature(saved)!==profileApprovalSignature(state))throw Error('Profile approval could not be saved. Your reviewed work is retained.');
    outcome='pass';operation?.checkpoint('persistence','pass');editMode=false;updateApprovalUI();window.dispatchEvent(new CustomEvent('leadintel:workspace-changed',{detail:{source:'profile-approval'}}));showToast('Profile approved');return true;
  }catch(error){outcome='fail';if(profileApprovalCurrent(context)){if(previous)state=previous;state.approved=false;updateApprovalUI();showToast(error.message||'Profile approval could not be saved. Retry when workspace storage is available.');}return false;}
  finally{operation?.finish(profileApprovalCurrent(context)?outcome:'stale');}
}
function updateApprovalUI(){
  globalThis.LeadIntelProfileApprovalUI?.updateProfileApprovalUI(document,state.approved);
}
function openMarketStrategy(){if(!requireConfirmedTargeting())return false;if(!state.profile){openModule(4);return;}if(!state.approved){LeadIntelTargeting.focusControl(window,{step:3,id:"approve-profile",message:"Approve your reviewed profile before continuing to Strategy."});return false;}setStep(4);}
function ensureMarketStrategySeeded(){
  if(!state.profile)return;
  const language=contentLanguage();
  if(!state.market)state.market=LeadIntelMarket.normalizeMarketState({});
  if(!state.market.icps.length)state.market.icps=LeadIntelMarket.buildIcpCandidates(state.profile,language);
  const generatedSignals=state.profile.recommendedSignals?.length
    ?state.profile.recommendedSignals
    :(globalThis.LeadIntelCompanyBrain?.recommendSignals?.({profile:state.profile,answers:state.answers||{}})||LeadIntelProfile.recommendedSignalsForProfile?.(state.profile)||[]);
  if(!state.profile.recommendedSignals?.length&&generatedSignals.length)state.profile.recommendedSignals=generatedSignals;
  // Existing signals are the reviewed selection, including a deliberate subset.
  // Updated recommendations become settings through the signal editor.
  if(!state.market.signals.length&&!state.market.deletedSignalIds?.length)state.market.signals=LeadIntelMarket.normalizeSignals(generatedSignals,state.market.signals,state.market.deletedSignalIds);
  if(!state.market.opportunities.length)state.market.opportunities=LeadIntelMarket.buildMarketOpportunities(state.profile,state.market.icps,state.market.signals,state.market.researchResults||[],language);
  state.market=LeadIntelMarket.localizeGeneratedState(state.market,state.profile,language);
  syncResearchContextStale();saveState();
}
async function openModule(step){
  if(!state)return false;
  const target=Number(step)||1;
  if(campaignModuleAllowed(target)){try{if(typeof window.LeadIntelCampaignModuleLoader!=='function')throw Error('Messages are still loading. Your campaign is saved; retry in a moment.');await window.LeadIntelCampaignModuleLoader(target);if(!campaignModuleAllowed(target))return false;setStep(target);return true;}catch(error){showToast(error.message||'Campaign workspace could not load. Retry.');return false;}}
  if(target>=4&&!requireConfirmedTargeting())return false;
  if(!LeadIntelProfile.canAccessModule(state,target)){LeadIntelTargeting.focusControl(window,{step:1,id:state.website?"target-country":"company-website",message:state.website?"Choose a target country before continuing.":"Add your company website before continuing."});return false;}
  if(target<=2){setStep(target);return true;}
  if(!state.profile)return analyzeCompany(Math.min(target,3));
  if(target>=4&&!state.approved){setStep(3);showToast("Approve the profile before continuing");return false;}
  const safeTarget=window.LeadIntelWorkspaceIsolation?.safeStep?.(localStorage,state,target);
  if(target>=5&&safeTarget!==target){
    setStep(safeTarget||4);
    showToast(target===6?"Save a company in Companies before opening Messages.":"Complete the previous stage before continuing.");
    return false;
  }
  return setStep(target)!==false;
}

function icpActivationRequirement(icp={}){
  const prerequisite=LeadIntelMarket.strategyActivationRequirement(state,globalThis.LeadIntelTargeting?.isConfirmed?.(state));
  if(prerequisite)return prerequisite;
  if(icp.type==="opportunity-led"){
    const available=!state.market.researchContextStale&&(state.market.opportunities||[]).some(item=>item?.active!==false&&item?.profileOnly!==true&&Array.isArray(item?.evidence)&&item.evidence.length>0);
    return {available,reason:"Run Market Research in Profile, then select an opportunity with a public evidence source.",action:"Research & activate",target:"run-market-research"};
  }
  if(icp.type==="lookalike"||icp.type==="lookalike-led"||icp.id==="icp-reference-lookalike"){
    // Reference Customers saves independently of this module's in-memory state.
    // Read the persisted model so an already activated customer is never shown as locked.
    let available=false,model=null;
    try{
      const saved=JSON.parse(localStorage.getItem(STORAGE_KEY)||"{}");
      const portfolio=globalThis.LeadIntelReferenceCustomerPortfolio;
      const hasPortfolio=Array.isArray(saved.referenceCustomerPortfolio?.lists);
      model=portfolio?.getCombinedActiveModel?.(portfolio.migrateLegacy(saved))
        ||(!hasPortfolio?globalThis.LeadIntelReferenceCustomers?.getActiveReferenceModel?.(saved.referenceCustomers||{}):null);
      available=Boolean(model);
    }catch{available=false;}
    return {available,model,reason:"Add a reference company and complete its website analysis in Profile; Lookalike turns on automatically when usable company evidence is available.",action:"Go to Reference Companies",target:"reference-customers"};
  }
  return {available:true,reason:""};
}
function enforceIcpActivationRequirements(){
  let changed=false;
  (state.market.icps||[]).forEach(icp=>{
    // Prerequisites are strict: blocked profiles retain no pending activation.
    // A usable reference model enables its Lookalike lens automatically.
    if(typeof icp.requestedActive!=="boolean"){icp.requestedActive=icp.active!==false;changed=true;}
    const superseded=icp.type==="lookalike"&&(state.market.icps||[]).some(item=>item.id==="icp-reference-lookalike");
    const available=icpActivationRequirement(icp).available;
    const automatic=['lookalike','lookalike-led'].includes(icp.type)||icp.id==='icp-reference-lookalike';
    const requested=available&&!superseded&&(automatic||icp.requestedActive);
    const active=requested;
    if(icp.requestedActive!==requested){icp.requestedActive=requested;changed=true;}
    if(icp.active!==active){icp.active=active;changed=true;}
  });
  if(changed)saveState();
}
function readMarketEdits(markDirty=true){
  // Opening review reads saved controls. Only an edit can adopt suggested cards.
  const candidates=markDirty?LeadIntelMarket.buildIcpCandidates(state.profile,state.market.contentLanguage||"en"):[];
  for(const candidate of candidates){if(!state.market.icps.some(item=>item.type===candidate.type||(candidate.type==="lookalike"&&item.type==="lookalike-led")))state.market.icps.push({...candidate,active:candidate.type==="core"?candidate.active:false});}
  const previous=strategyIntegrity()?.signature(state);
  document.querySelectorAll("[data-icp-field]").forEach(el=>{const item=state.market.icps[Number(el.dataset.index)];if(!item)return;const field=el.dataset.icpField;if(field==="active"){item.requestedActive=el.checked&&icpActivationRequirement(item).available;item.active=item.requestedActive;}else item[field]=el.value.trim();});
  document.querySelectorAll("[data-signal-field]").forEach(el=>{const item=state.market.signals[Number(el.dataset.index)];if(!item)return;const field=el.dataset.signalField;if(field==="active")item.active=el.checked;else if(field==="weight")item.weight=Math.max(1,Math.min(10,Number(el.value)||1));else item[field]=el.value.trim();});
  document.querySelectorAll("[data-opportunity-active]").forEach(el=>{const item=state.market.opportunities[Number(el.dataset.opportunityActive)];if(item)item.active=el.checked;});
  syncResearchSourcesToSignals();
  if(markDirty&&previous!==strategyIntegrity()?.signature(state)){state.market.strategyApproved=false;state.market.strategyApprovedAt="";}
  state.market.opportunities=LeadIntelMarket.revalidateMarketOpportunities(state.profile,state.market.signals,state.market.opportunities);
  enforceIcpActivationRequirements();
  saveState();
}
function syncResearchSourcesToSignals(){
  state.market.researchSourceTypes=LeadIntelMarket.filterResearchSourceTypes(state.market.researchSourceTypes||[],state.market.signals||[]);
  if(state.market.monitoring)state.market.monitoring.sourceTypes=LeadIntelMarket.filterResearchSourceTypes(state.market.monitoring.sourceTypes||[],state.market.signals||[]);
}
function renderIcps(){
  const candidates=LeadIntelMarket.buildIcpCandidates(state.profile,state.market.contentLanguage||"en");
  const rows=state.market.icps.slice();
  for(const candidate of candidates){if(!rows.some(item=>item.type===candidate.type||(candidate.type==="lookalike"&&item.type==="lookalike-led")))rows.push({...candidate,active:candidate.type==="core"?candidate.active:false});}
  const legacyLookalike=candidates.find(item=>item.type==="lookalike");
  const hasReferenceLens=rows.some(item=>item.id==="icp-reference-lookalike");
  const cards=rows.map((savedIcp,index)=>{
    // The activated reference lens supersedes the old generic lookalike card.
    // Keep its saved data intact for compatibility rather than destroying edits.
    if(hasReferenceLens&&savedIcp.type==="lookalike")return "";
    const requirement=icpActivationRequirement(savedIcp);
    let icp={...savedIcp,active:requirement.available&&savedIcp.active===true};
    if(savedIcp.type==="lookalike"){
      const generated=LeadIntelMarket.buildIcpCandidates(state.profile,state.market.contentLanguage||"en",requirement.model).find(item=>item.type==="lookalike");
      icp={...icp};
      for(const field of ["description","rationale"]){
        const oldEmptyRationale=field==="rationale"&&!String(state.profile?.lookalikeCustomers||"").trim()&&[
          `Use  as commercial anchors, then look for similar organizations in ${legacyLookalike?.targetMarkets}.`,
          `Izmantot  kā komerciālos atskaites punktus un meklēt līdzīgas organizācijas tirgos: ${legacyLookalike?.targetMarkets}.`
        ].includes(savedIcp[field]);
        if(!savedIcp[field]||savedIcp[field]===legacyLookalike?.[field]||oldEmptyRationale)icp[field]=generated[field];
      }
    }
    const requested=icp.active===true;
    const status=!requirement.available?"blocked":icp.active?"active":"off";
    const statusTitle=!requirement.available?"Setup required":icp.active?"Active":"Off";
    const statusMessage=!requirement.available?requirement.reason:icp.active?LeadIntelMarket.profilePurposeHeadline(icp,state.profile,state.market):"This profile won’t be used to find or qualify companies. Turn it on to use it.";

    return `<article class="icp-card ${icp.active?"active":""} ${requirement.available?"":"unavailable"}">
    <div class="icp-card-head"><label class="market-toggle" ${requirement.available?"":`title="${esc(requirement.reason)}"`}><input type="checkbox" data-icp-field="active" data-index="${index}" aria-label="Use ${esc(icp.name)}" ${requested?"checked":""} ${requirement.available&&["lookalike","lookalike-led"].includes(icp.type)?'disabled title="Automatically on while an analyzed reference model is available"':""} ><span></span></label><div><span class="icp-type">${esc(icp.type)}</span><input class="market-inline-title" data-icp-field="name" data-index="${index}" value="${esc(icp.name)}" ${icp.active?"":"disabled"}></div></div>
    <div class="strategy-setting-status icp-state-notice ${status==="blocked"?"icp-unlock-hint":""}" data-state="${status}" role="status"><strong>${statusTitle}</strong><span class="icp-purpose">${icp.active&&requirement.available?`<strong>${esc(statusMessage)}</strong>`:esc(statusMessage)}</span>${requirement.available?"":`<button type="button" data-icp-id="${esc(icp.id)}" data-icp-unlock="${esc(requirement.target)}">${esc(requirement.action)} →</button>`}</div>
    <fieldset class="icp-edit-fields" ${icp.active?"":"disabled"}><legend class="sr-only">${esc(icp.name)} settings</legend><label>Definition<textarea rows="2" data-icp-field="description" data-index="${index}">${esc(icp.description)}</textarea></label>
    <div class="icp-fields"><label>Target markets<input data-icp-field="targetMarkets" data-index="${index}" value="${esc(icp.targetMarkets)}"></label><label>Buyer roles<input data-icp-field="buyerRoles" data-index="${index}" value="${esc(icp.buyerRoles)}"></label></div>
    <div class="icp-fields"><label>Priority offers<input data-icp-field="offers" data-index="${index}" value="${esc(icp.offers)}"></label><label>Commercial value<input data-icp-field="value" data-index="${index}" value="${esc(icp.value)}"></label></div>
    <label>Exclusions<input data-icp-field="exclusions" data-index="${index}" value="${esc(icp.exclusions)}"></label>
    </fieldset><p>${esc(icp.rationale)}</p>
  </article>`;
  });
  $("icp-list").innerHTML=cards.join("");
}
function pointToStrategyRequirement(requirement){
  if(requirement.target==='prerequisite'){
    if(requirement.id==='confirm-targeting'){LeadIntelTargeting.focusRequired(window,state);return;}
    LeadIntelTargeting.focusControl(window,{step:requirement.step,id:requirement.id,message:requirement.reason});return;
  }
  if(requirement.target==='run-market-research'){
    void Promise.resolve(window.LeadIntelProfileMarket?.open?.()).then(()=>LeadIntelTargeting.focusControl(window,{step:2,id:'run-market-research',message:requirement.reason}));return;
  }
  if(requirement.target==='reference-customers'){
    window.dispatchEvent(new CustomEvent('leadintel:open-module',{detail:{step:2,journeyStage:2}}));
    setTimeout(()=>{document.querySelector('[data-reference-customers-manage]')?.click();LeadIntelTargeting.focusControl(window,{step:2,selector:'[data-reference-customers-manage]',message:requirement.reason});},80);
  }
}
function requestIcpActivation(id){
  const icp=state.market.icps.find(item=>item.id===id);if(!icp)return;
  const requirement=icpActivationRequirement(icp);
  // Reset the clicked control before reading edits: a blocked attempt must never persist On intent.
  if(!requirement.available){
    icp.requestedActive=false;icp.active=false;
    const index=state.market.icps.indexOf(icp),toggle=document.querySelector(`[data-icp-field="active"][data-index="${index}"]`);if(toggle)toggle.checked=false;
    readMarketEdits(false);saveState();renderIcps();pointToStrategyRequirement(requirement);return;
  }
  readMarketEdits(false);icp.requestedActive=true;icp.active=true;
  state.market.strategyApproved=false;state.market.strategyApprovedAt='';saveState();renderIcps();
}

function renderSignalDesigner(){
  const undo=$("signal-removal-undo");if(undo){undo.hidden=!state.market.lastRemovedSignal;$("signal-removal-label").textContent=state.market.lastRemovedSignal?`${state.market.lastRemovedSignal.signal.name} removed.`:"";}
  $("signal-designer").innerHTML=state.market.signals.map((signal,index)=>`<div class="signal-config-row ${signal.active?"active":""}">
    <label class="market-toggle"><input type="checkbox" data-signal-field="active" data-index="${index}" aria-label="Use ${esc(signal.name)}" ${signal.active?"checked":""}><span></span></label>
    <div class="signal-config-main"><small class="strategy-setting-status" role="status">${signal.active?"Active — used in research and matching":"Off — excluded from research and matching"}</small><input class="signal-name-input" data-signal-field="name" ${signal.active?"":"disabled"} data-index="${index}" value="${esc(signal.name)}"><input class="signal-keywords-input" data-signal-field="keywords" ${signal.active?"":"disabled"} data-index="${index}" value="${esc(signal.keywords)}" placeholder="keywords; phrases"></div>
    <select data-signal-field="priority" ${signal.active?"":"disabled"} data-index="${index}">${["High","Medium","Low"].map(p=>`<option ${p===signal.priority?"selected":""}>${p}</option>`).join("")}</select>
    <label class="weight-field"><span>Weight</span><input type="number" min="1" max="10" data-signal-field="weight" ${signal.active?"":"disabled"} data-index="${index}" value="${signal.weight}"></label>
    <button class="signal-delete" type="button" data-remove-signal="${index}" aria-label="Remove ${esc(signal.name)}">×</button>
  </div>`).join("");
}
function addCustomSignal(){
  const requirement=LeadIntelMarket.strategyActivationRequirement(state,LeadIntelTargeting.isConfirmed(state));if(requirement){pointToStrategyRequirement(requirement);return;}
  readMarketEdits();
  const result=LeadIntelMarket.addCustomSignal(state.market.signals,{name:$("custom-signal-name").value,keywords:$("custom-signal-keywords").value,priority:$("custom-signal-priority").value,weight:$("custom-signal-weight").value});
  if(!result.added){showToast(result.error||"Could not add signal");return;}
  state.market.signals=result.signals;state.market.strategyApproved=false;saveState();$("custom-signal-name").value="";$("custom-signal-keywords").value="";renderMarketStrategy();showToast("Custom signal added");
}
function removeSignal(index){
  readMarketEdits();const id=state.market.signals[index]?.id;if(!id)return;
  state.market=LeadIntelMarket.removeSignal(state.market,id);syncResearchSourcesToSignals();
  saveState();renderMarketStrategy();showToast("Signal removed. Undo is available below the signal list.");
}
function undoRemoveSignal(){
  if(state.market.lastRemovedSignal?.signal?.active!==false){const requirement=LeadIntelMarket.strategyActivationRequirement(state,LeadIntelTargeting.isConfirmed(state));if(requirement){pointToStrategyRequirement(requirement);return;}}
  readMarketEdits();if(state.market.signals.length>=20){showToast("Remove a signal before restoring another.");return;}
  state.market=LeadIntelMarket.restoreRemovedSignal(state.market);saveState();renderMarketStrategy();showToast("Signal restored");
}

async function waitForMarketServerBridge(timeout=1800){
  if(window.LeadIntelServerBridge&&window.LeadIntelServerBridge.session!==null)return window.LeadIntelServerBridge;
  return new Promise(resolve=>{let settled=false;const finish=()=>{if(settled)return;settled=true;window.removeEventListener("leadintel:server-ready",finish);resolve(window.LeadIntelServerBridge||null);};window.addEventListener("leadintel:server-ready",finish,{once:true});setTimeout(finish,timeout);});
}
async function ensureMarketResearchWorkspace(mode,context,signal){
  const selectedMode=normalizeResearchMode(mode);
  const bridge=await waitForMarketServerBridge();
  if(context)assertStrategyContext(context);assertMarketResearchRun(signal?.leadIntelResearchRun,signal);
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
function marketResearchAbortError(message="Market research cancelled"){
  const error=new Error(message);error.name="AbortError";error.code="MARKET_RESEARCH_CANCELLED";return error;
}
function marketResearchScopeCurrent(run){return Boolean(run&&activeMarketResearchRun===run&&strategyContextCurrent(run.context));}
function assertMarketResearchRun(run,signal){
  if(run&&Date.now()>=run.deadlineAt&&!run.controller.signal.aborted){run.stopReason="Market research reached its overall time limit";run.controller.abort();}
  if(signal?.aborted||run?.controller.signal.aborted)throw marketResearchAbortError(run?.stopReason||"Market research cancelled");
  if(run&&!marketResearchScopeCurrent(run)){run.stopReason="Account, workspace or Strategy changed";run.controller.abort();throw marketResearchAbortError(run.stopReason);}
}
function beginMarketResearchRun(mode,runtime){
  if(activeMarketResearchRun){if(marketResearchScopeCurrent(activeMarketResearchRun)&&!activeMarketResearchRun.controller.signal.aborted)return null;activeMarketResearchRun.stopReason="Research superseded";activeMarketResearchRun.controller.abort();}
  const startedAt=Date.now(),overallTimeoutMs=Math.max(1,Number(runtime.overallTimeoutMs)||({quick:120000,deep:360000,intelligence:600000}[mode]||120000));
  const run={id:`market-${startedAt}-${Math.random().toString(36).slice(2,8)}`,mode,market:state.market,context:captureStrategyContext(true),controller:new AbortController(),startedAt,deadlineAt:startedAt+overallTimeoutMs,stopReason:"",execution:{version:1,mode,startedAt,deadlineAt:startedAt+overallTimeoutMs,status:"running",receipts:[]}};
  run.execution.runId=run.id;activeMarketResearchRun=run;
  run.deadlineTimer=setTimeout(()=>{run.stopReason="Market research reached its overall time limit";run.controller.abort();},overallTimeoutMs);
  run.scopeTimer=setInterval(()=>{if(!marketResearchScopeCurrent(run)){run.stopReason="Account, workspace or Strategy changed";run.controller.abort();}},100);
  return run;
}
function finishMarketResearchRun(run){
  const current=marketResearchScopeCurrent(run)&&!run.controller.signal.aborted;
  clearTimeout(run.deadlineTimer);clearInterval(run.scopeTimer);if(activeMarketResearchRun===run)activeMarketResearchRun=null;
  // Activation is a result of this completed run. Release its scope guard first,
  // then persist the new selection with the same researched inputs.
  if(current&&state.market.researchExecution?.runId===run.id&&LeadIntelMarket.autoActivateOpportunityAfterResearch?.(state.market)){
    state.market.researchContextFingerprint=researchContextFingerprint();
    saveState();renderMarketStrategy();
  }
}
function recordMarketResearchReceipt(run,provider,stage,query,status="planned"){
  const receipt={provider,stage,query:String(query||"").slice(0,180),status,attempt:0,startedAt:0,completedAt:0,resultCount:0};run.execution.receipts.push(receipt);return receipt;
}
async function marketResearchRequest(run,operation,timeoutMs,label,receipt){
  assertMarketResearchRun(run);
  const controller=new AbortController();controller.signal.leadIntelResearchRun=run;
  if(receipt){receipt.status="running";receipt.attempt++;receipt.startedAt=Date.now();}
  let timer,parentAbort;
  try{
    const value=await new Promise((resolve,reject)=>{
      let settled=false;const finish=(fn,value)=>{if(settled)return;settled=true;fn(value);};
      parentAbort=()=>{controller.abort();finish(reject,marketResearchAbortError(run.stopReason||"Market research cancelled"));};
      run.controller.signal.addEventListener("abort",parentAbort,{once:true});
      timer=setTimeout(()=>{controller.abort();finish(reject,new Error(`${label} timed out`));},Math.max(1,Math.min(timeoutMs,run.deadlineAt-Date.now())));
      Promise.resolve().then(()=>{assertMarketResearchRun(run,controller.signal);return operation(controller.signal);}).then(value=>finish(resolve,value),error=>finish(reject,error));
    });
    assertMarketResearchRun(run,controller.signal);
    if(receipt){const rows=Array.isArray(value)?value:value?.results;receipt.resultCount=rows?.length||0;receipt.status=value?.available===false||value?.status==="unavailable"?"unavailable":value?.status==="partial"?"partial":Array.isArray(rows)&&!rows.length?"zero_results":"complete";receipt.reason=String(value?.reason||"").trim().slice(0,300);receipt.completedAt=Date.now();}
    return value;
  }catch(error){if(receipt){receipt.status=run.controller.signal.aborted?"cancelled":"failed";receipt.reason=String(error?.message||error).slice(0,300);receipt.completedAt=Date.now();}throw error;}
  finally{clearTimeout(timer);run.controller.signal.removeEventListener("abort",parentAbort);}
}
function mergeRetainedResearchEvidence(previous,results){
  // Existing citations remain addressable even when the new run is partial or its selection cap is smaller.
  return LeadIntelMarket.mergeResearchResults(previous||[],results||[]);
}
async function searchOpenAiWeb(queryMeta,maxResults=5,signal){
  const run=signal?.leadIntelResearchRun,context=run?.context||captureStrategyContext(true);
  assertMarketResearchRun(run,signal);const bridge=await waitForMarketServerBridge();assertStrategyContext(context);assertMarketResearchRun(run,signal);const workspace=bridge?.workspace;
  if(!bridge?.session?.authenticated||!workspace?.id)return {available:false,reason:"Sign in to use AI page discovery",results:[]};
  const query=cleanOpenAiResearchQuery(queryMeta.query);
  const response=await fetch(`${LEADINTEL_API}/api/ai/web-search?workspace_id=${encodeURIComponent(workspace.id)}`,{method:"POST",credentials:"include",headers:{"Content-Type":"application/json","Accept":"application/json"},body:JSON.stringify({query,max_results:maxResults}),signal});
  const payload=await response.json().catch(()=>{throw new Error(`AI page discovery returned an unreadable response (${response.status})`);});assertStrategyContext(context);assertMarketResearchRun(run,signal);
  // The server owns routing. Save only providers that actually executed, including failed fallbacks.
  if(run)for(const attempt of payload.attempts||[]){
    if(!['openai','anthropic','gemini','perplexity'].includes(attempt.provider))continue;
    const receipt=recordMarketResearchReceipt(run,attempt.provider,'discovery',query);
    Object.assign(receipt,{status:attempt.status,attempt:1,startedAt:attempt.startedAt,completedAt:attempt.completedAt,resultCount:attempt.resultCount||0,reason:attempt.reason||''});
  }
  if(response.status===409&&payload.code==='AI_SEARCH_PROVIDER_NOT_CONNECTED')return {available:false,reason:payload.error,results:[]};
  if(!response.ok)throw new Error(payload.error||`AI page discovery returned ${response.status}`);
  const provider=['openai','anthropic','gemini','perplexity'].includes(payload.provider)?payload.provider:'unknown';
  return {available:true,provider,status:payload.status,reason:payload.warning||'',warning:payload.warning?String(payload.warning).slice(0,240):'',results:LeadIntelMarket.normalizeSearchResults({results:payload.results},{...queryMeta,query},provider)};
}
async function searchMarket(queryMeta,limit=5,signal){
  const run=signal?.leadIntelResearchRun;assertMarketResearchRun(run,signal);
  const response=await fetch(`${FIRECRAWL_PROXY}/firecrawl-search`,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({query:queryMeta.query,limit,scrapeOptions:{formats:["markdown"]}}),signal});
  const payload=await response.json().catch(()=>({}));assertMarketResearchRun(run,signal);
  if(!response.ok)throw new Error(payload.error||`Market search returned ${response.status}`);
  return LeadIntelMarket.normalizeSearchResults(payload,queryMeta,"firecrawl");
}
async function searchCustomSource(url,index,signal){
  const run=signal?.leadIntelResearchRun;assertMarketResearchRun(run,signal);
  const response=await fetch(`${FIRECRAWL_PROXY}/firecrawl-scrape`,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({url,formats:["markdown"],onlyMainContent:true,timeout:30000}),signal});
  const payload=await response.json().catch(()=>({}));assertMarketResearchRun(run,signal);
  if(!response.ok)throw new Error(payload.error||`Custom source scrape returned ${response.status}`);
  const data=payload?.data||payload,metadata=data?.metadata||{},text=String(data?.markdown||data?.content||"").slice(0,5000);
  const extractor=response.headers.get("X-LeadIntel-Extractor")||"firecrawl";if(!text.trim())throw new Error("Page extraction returned no readable content");
  return LeadIntelMarket.normalizeSearchResults({results:[{url,title:metadata.title||url,description:metadata.description||text.slice(0,500),text,extractedBy:extractor,extractedAt:new Date().toISOString()}]},{id:`custom-${index+1}`,market:"Custom source",offer:"User-specified source",sourceType:"custom",query:url},extractor);
}
function researchExtractionTimeoutMs(mode){return ({quick:2,deep:3,intelligence:5}[mode]||2)*35000+5000;}
async function extractResearchPages(results,mode,signal,{previouslyExtracted=[],profile=researchProfile()}={}){
  const run=signal?.leadIntelResearchRun;assertMarketResearchRun(run,signal);
  const limits={quick:4,deep:6,intelligence:10},selected=[],domains=new Set(),extractedUrls=new Set(previouslyExtracted.filter(item=>item?.extractedAt).map(item=>item.url));
  for(const item of (globalThis.LeadIntelMarketConditions?.selectDiverseEvidence(results,results.length,{profile})||results)){if(item.extractedAt||extractedUrls.has(item.url))continue;let domain="";try{domain=new URL(item.url).hostname;}catch{}if(!domain||domains.has(domain))continue;domains.add(domain);selected.push(item);if(selected.length>=limits[mode])break;}
  return LeadIntelMarket.mapWithConcurrency(selected,async item=>{
    assertMarketResearchRun(run,signal);const receipt=run?recordMarketResearchReceipt(run,"firecrawl","extraction",item.url):null;
    try{
      const scrape=async childSignal=>{
        assertMarketResearchRun(run,signal);const response=await fetch(`${FIRECRAWL_PROXY}/firecrawl-scrape`,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({url:item.url,formats:["markdown"],onlyMainContent:true,timeout:30000}),signal:childSignal});
        const payload=await response.json().catch(()=>({}));assertMarketResearchRun(run,signal);assertMarketResearchRun(run,childSignal);if(!response.ok)throw new Error(`Page extraction returned ${response.status}`);
        const data=payload?.data||payload,metadata=data?.metadata||{},text=String(data?.markdown||data?.content||"").slice(0,12000),extractor=response.headers.get("X-LeadIntel-Extractor")||"firecrawl";if(!text.trim())throw new Error("Page extraction returned no readable content");
        return {...item,title:metadata.title||item.title,description:metadata.description||item.description,text,sourceProviders:[...new Set([...(item.sourceProviders||[]),extractor])],extractedBy:extractor,extractedAt:new Date().toISOString()};
      };
      // The batch signal also cancels individual requests if its extraction deadline is reached.
      const cancelChild=()=>{if(run&&!run.controller.signal.aborted){run.stopReason="Evidence extraction cancelled";run.controller.abort();}};signal?.addEventListener("abort",cancelChild,{once:true});
      try{const page=run?await marketResearchRequest(run,scrape,35000,"Page extraction",receipt):await scrape(signal);run?.acceptResults?.([page]);return page;}finally{signal?.removeEventListener("abort",cancelChild);}
    }catch(error){assertMarketResearchRun(run,signal);run?.recordError?.("Firecrawl extraction",item.url,error);return item;}
  },{concurrency:2});
}
async function verifyResearchWithGemini(mode,profile,results,signals,signal){
  const unavailable=reason=>({status:"unavailable",provider:"gemini",role:"verification",web_search:false,reason});
  const run=signal?.leadIntelResearchRun,context=run?.context||captureStrategyContext(true);assertMarketResearchRun(run,signal);
  if(!["deep","intelligence"].includes(mode))return {status:"idle",provider:"gemini",role:"verification",web_search:false,reason:"Verification is reserved for Market Research and Deep Analysis"};
  if(!results.length)return unavailable("No evidence was available to verify");
  const bridge=await waitForMarketServerBridge();assertStrategyContext(context);assertMarketResearchRun(run,signal);const workspace=bridge?.workspace;
  if(!bridge?.session?.authenticated||!workspace?.id)return unavailable("Sign in to use Gemini verification");
  const payload=globalThis.LeadIntelResearchVerification.buildVerificationPayload({mode,profile,signals,results});
  const response=await fetch(`${LEADINTEL_API}/api/ai/research-verification?workspace_id=${encodeURIComponent(workspace.id)}`,{method:"POST",credentials:"include",headers:{"Content-Type":"application/json","Accept":"application/json"},body:JSON.stringify(payload),signal});
  const data=await response.json().catch(()=>({}));assertStrategyContext(context);assertMarketResearchRun(run,signal);
  if(!response.ok)return unavailable(data.error||`Gemini verification returned ${response.status}`);return data;
}
function readResearchSettings(sourceTypesChanged=false){
  const sourceTypes=[...document.querySelectorAll('#research-source-types input:checked')].map(input=>input.value);
  state.market.researchSourceTypes=LeadIntelMarket.filterResearchSourceTypes(sourceTypes,state.market.signals||[]);
  if(sourceTypesChanged)state.market.researchSourceTypesCustomized=true;
  state.market.researchCustomSources=LeadIntelMarket.splitList($("research-custom-sources").value).slice(0,20);
  state.market.researchInstructions=$("research-instructions").value.trim().slice(0,1200);
  saveState();return state.market;
}
function researchContextFingerprint(){
  return strategyIntegrity().researchFingerprint(state);
}
function syncResearchContextStale(){
  const market=state.market;if(!market)return false;
  const {stale,fingerprint}=strategyIntegrity().researchContext(state,globalThis.LeadIntelCompanyBrain);
  if(!stale&&fingerprint)market.researchContextFingerprint=fingerprint;
  if(stale&&!(market.strategyApproval?.researchBasis==='profile'&&strategyIntegrity().status(state).current)){market.strategyApproved=false;market.strategyApprovedAt='';}
  if(market.researchResults?.length||market.researchContextStale)market.researchContextStale=stale;
  return stale;
}
function returnToProfileResearch(){closeStrategyHandoff();void window.LeadIntelProfileMarket?.open?.();}
function researchProfile(){
  const profile=state.market.icps.some(item=>item.active!==false)?LeadIntelMarket.effectiveTargetingProfile(state.profile,state.market):state.profile;
  return {...profile,researchMarkets:LeadIntelProfile.expandTargetMarkets(profile.targetMarkets)};
}
function closeResearchPreview(){
  pendingResearchMode="";pendingResearchDraft=null;
  const preview=$("research-run-preview");if(preview){preview.hidden=true;delete preview.dataset.researchMode;}
  window.LeadIntelMarketResearchGuard?.setIdle?.(window);
}
function normalizeResearchMode(mode){return LeadIntelMarket.RESEARCH_MODES[mode]?mode:"quick";}
function researchModeUi(mode){
  const selected=normalizeResearchMode(mode);
  return selected==="intelligence"?{
    label:"Deep Analysis",
    estimate:"usually 5–10 minutes",
    method:"LeadIntel performs the widest investigation across active buying signals and selected source categories. Your selected researcher discovers relevant public pages; Firecrawl extracts evidence and checks specific URLs; Gemini independently cross-checks only the collected evidence.",
    discoveryNote:"Deep Analysis adds broad strategic context. The Companies stage still runs its own search and applies the same qualification checks."
  }:selected==="deep"?{
    label:"Market Research",
    estimate:"usually 2–4 minutes",
    method:"LeadIntel rotates across more active buying signals and the source categories you selected. Your selected researcher discovers relevant public pages; Firecrawl extracts evidence and checks specific URLs; Gemini independently cross-checks only the collected evidence.",
    discoveryNote:"Market Research is the recommended starting point for Companies. The Companies stage runs its own search and checks each match against your active market and buying signals."
  }:{
    label:"Quick Overview",
    estimate:"usually under 1 minute",
    method:"LeadIntel validates the strongest active buying signals across your selected source categories. Your selected researcher discovers public pages; Firecrawl extracts the available evidence.",
    discoveryNote:"Quick Overview collects a lighter market evidence set. The Companies stage still runs a separate search and the selected company target stays the same, but it has less context for ranking matches. Market Research is recommended for a fuller starting point."
  };
}
function openResearchPreview(mode){
  if(!state.profile){showToast("Add your website and target market so LeadIntel can build a profile first");return;}
  pendingResearchMode=normalizeResearchMode(mode);
  const originalSourceTypes=[...(state.market.researchSourceTypes||[])],sourceTypes=[...originalSourceTypes];
  if(pendingResearchMode!=="quick"&&!state.market.researchSourceTypesCustomized&&sourceTypes.length===1&&sourceTypes[0]==="news")sourceTypes.splice(0,1,"news","jobs","investments","company","registries");
  // A plan preview is a draft. Only Start may apply these proposed settings to
  // the authority used by completed research and Strategy approval.
  pendingResearchDraft={mode:pendingResearchMode,sourceTypes,originalSourceTypes,sourceTypesCustomized:state.market.researchSourceTypesCustomized===true};
  const limits=LeadIntelMarket.RESEARCH_MODES[pendingResearchMode];
  const modeUi=researchModeUi(pendingResearchMode);
  const profile=researchProfile();const language=contentLanguage();
  const queries=LeadIntelMarket.buildResearchPlan(profile,state.market.signals,{mode:pendingResearchMode,sourceTypes,sourceTypesCustomized:pendingResearchDraft.sourceTypesCustomized,instructions:state.market.researchInstructions,language});
  const labels=sourceTypes.map(type=>type[0].toUpperCase()+type.slice(1));
  $("research-preview-title").textContent=modeUi.label;
  const planApi=globalThis.LeadIntelFirecrawlPlan;const planStatus=planApi?planApi.planFromStatus(globalThis.LeadIntelAttention?.providerStatus?.()||null):{plan:null,remainingCredits:null};
  const runCost=planApi?planApi.describe({searches:queries.length,resultsPerSearch:limits.resultsPerQuery,pages:0},planStatus.plan,{remainingCredits:planStatus.remainingCredits}):null;
  $("research-preview-scope").textContent=`${queries.length} planned search${queries.length===1?"":"es"} · ${modeUi.estimate}${runCost?` · ${runCost.text}`:""} · up to ${limits.resultsPerQuery} results each · maximum ${limits.maxStoredResults} saved evidence sources${state.market.researchCustomSources.length?` · ${state.market.researchCustomSources.length} direct URL${state.market.researchCustomSources.length===1?"":"s"}`:""}.`;
  $("research-preview-sources").textContent=labels.join(", ")||"No source categories selected";
  $("research-preview-method").textContent=modeUi.method;
  $("research-preview-discovery-note").textContent=modeUi.discoveryNote;
  const providerNotice=globalThis.LeadIntelAttentionModel?.researchProviderNotice?.(globalThis.LeadIntelAttention?.providerStatus?.()||{})||"";
  const providerNode=$("research-preview-providers");if(providerNode){providerNode.textContent=providerNotice;providerNode.hidden=!providerNotice;}
  const suggestions=LeadIntelMarket.buildSuggestedSources(profile,state.market.signals,sourceTypes,language);const added=new Set(state.market.researchCustomSources||[]);
  $("research-suggested-sources").innerHTML=suggestions.length?suggestions.map((item,index)=>`<label><input type="checkbox" data-suggested-source value="${esc(item.url)}" ${added.has(item.url)?"checked disabled":""}><span><strong>${esc(item.name)}</strong><small>${esc(item.reason)}</small><code>${esc(item.url)}</code></span></label>`).join(""):"<p>No specific site recommendations are available for the selected market and source categories. You can still add any public URL manually.</p>";
  $("add-suggested-sources").hidden=!suggestions.length;$("add-suggested-sources").disabled=!suggestions.some(item=>!added.has(item.url));
  $("research-preview-queries").dataset.plannedThemes=JSON.stringify(queries.map(item=>item.signalName||item.researchCategory));
  $("research-preview-queries").innerHTML=queries.map(item=>`<li><strong>${esc(item.researchCategory)}</strong> · ${esc(item.query)}</li>`).join("")||"<li>No searches could be prepared. Add a target market.</li>";
  $("confirm-market-research").textContent=`Start ${modeUi.label}`;
  $("confirm-market-research").disabled=!queries.length&&!state.market.researchCustomSources.length;
  $("research-run-preview").dataset.researchMode=pendingResearchMode;
  $("research-run-preview").hidden=false;
  $("research-run-preview").scrollIntoView({behavior:"smooth",block:"nearest"});
}
function confirmResearchPreview(){
  const draft=pendingResearchDraft;if(!draft)return false;
  closeResearchPreview();void runMarketResearch(draft.mode,{previewDraft:draft});return true;
}
function handleResearchPreviewKeydown(event){
  if(event.key!=="Escape"||!pendingResearchDraft||$("research-run-preview")?.hidden)return false;
  closeResearchPreview();event.preventDefault();return true;
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
async function runMarketResearch(modeOverride="",{retryOnly=false,previewDraft=null}={}){
  if(activeMarketResearchRun&&marketResearchScopeCurrent(activeMarketResearchRun)&&!activeMarketResearchRun.controller.signal.aborted)return;
  if(!state.profile){showToast("Add your website and target market so LeadIntel can build a profile first");return;}
  ensureMarketStrategySeeded();readMarketEdits();readResearchSettings();
  const mode=normalizeResearchMode(modeOverride||$("research-mode").value);
  if(previewDraft&&previewDraft.mode===mode&&!state.market.researchSourceTypesCustomized&&JSON.stringify(state.market.researchSourceTypes)===JSON.stringify(previewDraft.originalSourceTypes))state.market.researchSourceTypes=[...previewDraft.sourceTypes];
  state.market.researchMode=mode;$("research-mode").value=mode;
  if(previewDraft)renderResearchControls();
  const runtime=LeadIntelMarket.researchRuntimePolicy(mode),limits=LeadIntelMarket.RESEARCH_MODES[mode],run=beginMarketResearchRun(mode,runtime);if(!run)return;
  let started=false,totalJobs=0,completedJobs=0,taskId,elapsedTimer;
  const taskCentre=window.LeadIntelTaskCentre,requestsGemini=["deep","intelligence"].includes(mode),researchButtons=[$("run-market-research"),$("run-detailed-research"),$("run-market-intelligence")].filter(Boolean);
  const previous={results:[...state.market.researchResults],opportunities:[...state.market.opportunities],conditions:state.market.marketConditions,quality:state.market.researchQuality,lastResearchAt:state.market.lastResearchAt,fingerprint:state.market.researchContextFingerprint,verification:state.market.researchVerification};
  let profile,signals,outcomeBuilt=false;
  let results=[],openAiAvailable=true,openAiSuccesses=0,openAiFailures=0,firecrawlSuccesses=0,firecrawlFailures=0;
  const selectOutcomeEvidence=()=>{
    const assessment=globalThis.LeadIntelMarketConditions?.assessEvidence(results,{profile});if(assessment)results=assessment.results;
    results=globalThis.LeadIntelMarketConditions?.selectDiverseEvidence(results,limits.maxStoredResults,{profile})||results.slice(0,limits.maxStoredResults);
  };
  const buildOutcome=()=>{
    outcomeBuilt=true;selectOutcomeEvidence();
    state.market.researchResults=mergeRetainedResearchEvidence(previous.results,results);
    const usable=results.filter(item=>(!["model_summary","search_excerpt"].includes(item.evidenceKind)||item.extractedAt)&&item.verification?.relevance!=="reject"&&!item.verification?.contradiction);
    if(results.length){state.market.opportunities=LeadIntelMarket.buildMarketOpportunities(profile,state.market.icps,signals,results,contentLanguage());state.market.marketConditions=mode==="quick"?null:globalThis.LeadIntelMarketConditions?.buildPack(usable)||null;}
    state.market.researchQuality=globalThis.LeadIntelMarketConditions?.buildQualityGate(usable,{mode})||null;
  };
  const publish=()=>{assertMarketResearchRun(run);state.market.researchExecution=JSON.parse(JSON.stringify(run.execution));if(saveState()===false)throw Error("Research evidence could not be saved; resolve workspace synchronization before retrying");assertMarketResearchRun(run);renderResearchStatus();};
  const recordResearchError=(provider,query,error)=>{assertMarketResearchRun(run);if(state.market.researchErrors.length>=12)return;state.market.researchErrors.push({provider,query:String(query||"").slice(0,180),message:String(error?.message||error||"Request failed").replace(/\s+/g," ").trim().slice(0,240)});};run.recordError=recordResearchError;
  const addResults=rows=>{assertMarketResearchRun(run);results=LeadIntelMarket.mergeResearchResults(results,rows||[]).slice(0,limits.maxStoredResults*10);state.market.researchResults=mergeRetainedResearchEvidence(previous.results,results);};
  // Each completed provider/page owns a checkpoint. A pending sibling must
  // never make already acquired evidence disappear at cancellation or timeout.
  run.acceptResults=rows=>{addResults(rows);publish();};
  const updateProgress=()=>{assertMarketResearchRun(run);if(retryOnly)state.market.openAiRetryProgress={...state.market.openAiRetryProgress,completed:completedJobs,total:totalJobs};state.market.researchProgress={completed:completedJobs,total:totalJobs};taskCentre?.update(taskId,{completed:completedJobs,total:totalJobs,stage:'Checking market evidence',resultCount:results.length});publish();};
  try{
    const ready=await marketResearchRequest(run,signal=>ensureMarketResearchWorkspace(mode,run.context,signal),2000,"Workspace check");if(!ready)return;assertMarketResearchRun(run);
    profile=JSON.parse(JSON.stringify(researchProfile()));signals=JSON.parse(JSON.stringify(state.market.signals));const sourceTypes=[...state.market.researchSourceTypes],customSources=retryOnly?[]:[...new Set((state.market.researchCustomSources||[]).map(value=>{try{const url=new URL(value);return ["http:","https:"].includes(url.protocol)?url.href:"";}catch{return "";}}).filter(Boolean))].slice(0,20);
    const failedQueries=new Set((state.market.researchErrors||[]).filter(item=>["AI discovery","OpenAI"].includes(item.provider)).map(item=>item.query));
    const planned=retryOnly?(state.market.researchQueries||[]).filter(item=>!failedQueries.size||failedQueries.has(String(item.query||"").slice(0,180))):LeadIntelMarket.buildResearchPlan(profile,signals,{mode,sourceTypes,sourceTypesCustomized:state.market.researchSourceTypesCustomized,instructions:state.market.researchInstructions,language:contentLanguage(),reserveFollowUps:true});
    const queries=[...new Map(planned.map(item=>[String(item.query).trim().toLowerCase(),item])).values()].slice(0,limits.maxQueries);
    if(!queries.length&&!customSources.length){showToast(retryOnly?"No failed discovery queries are available to retry":"Choose research sources or add a valid public URL");return;}
    totalJobs=queries.length+customSources.length;started=true;taskId=`market-research:${run.id}`;
    taskCentre?.start({id:taskId,type:'market-research',title:'Market research',stage:'Searching public sources',total:totalJobs,completed:0,canRetry:true,canCancel:true});
    taskCentre?.registerActions(taskId,{retry:()=>runMarketResearch(mode),cancel:()=>{if(marketResearchScopeCurrent(run)){run.stopReason="Market research cancelled by user";run.controller.abort();}}});closeResearchPreview();
    if(state.market.researchExecution)state.market.researchExecutionHistory=[...(state.market.researchExecutionHistory||[]),state.market.researchExecution].slice(-10);
    state.market.researchQuality=null;state.market.researchContextStale=false;state.market.researchContextFingerprint=run.context.signature;
    state.market.researchQueries=queries;state.market.researchResults=previous.results;state.market.researchErrors=retryOnly?state.market.researchErrors.filter(item=>!["ai discovery","openai"].includes(String(item.provider).toLowerCase())):[];
    state.market.researchStatus="running";state.market.researchStartedAt=run.startedAt;state.market.researchPhase="finding";state.market.strategyApproved=false;
    state.market.researchSourceStatus={...state.market.researchSourceStatus,discovery:queries.length?"running":"idle",openai:"idle",anthropic:"idle",...(state.market.researchSourceStatus.perplexity?{perplexity:"idle"}:{}),...(!retryOnly?{firecrawl:"running",gemini:requestsGemini?"running":"idle"}:{})};
    if(!retryOnly)state.market.researchVerification={status:requestsGemini?"running":"idle",provider:"gemini",role:"verification",webSearch:false,reason:"",summary:"",disagreements:[],missingEvidence:[],verifiedAt:""};
    state.market.researchProgress={completed:0,total:totalJobs};if(retryOnly)state.market.openAiRetryProgress={completed:0,total:queries.length,attempt:1,startedAt:run.startedAt,deadlineAt:run.deadlineAt};publish();renderMarketStrategy();
    elapsedTimer=setInterval(()=>{if(marketResearchScopeCurrent(run)&&!run.controller.signal.aborted)renderResearchStatus();},1000);researchElapsedTimer=elapsedTimer;
    researchButtons.forEach(button=>{button.disabled=true;button.textContent="Researching…";});
    const queryReceipts=query=>({query,openai:recordMarketResearchReceipt(run,"ai","discovery",query.query),firecrawl:retryOnly?null:recordMarketResearchReceipt(run,"firecrawl","discovery",query.query)});
    const executeQuery=async job=>{
      assertMarketResearchRun(run);const query=job.query;
      const openAiJob=async()=>{
        if(!openAiAvailable){job.openai.status="not_run";return [];}
        try{
          const found=await withOpenAiRetry(attempt=>{assertMarketResearchRun(run);if(retryOnly)state.market.openAiRetryProgress={...state.market.openAiRetryProgress,attempt,deadlineAt:Math.min(run.deadlineAt,Date.now()+runtime.openAiTimeoutMs)};return marketResearchRequest(run,signal=>searchOpenAiWeb(attempt===1?query:{...query,query:cleanOpenAiResearchQuery(query.query).slice(0,120)},limits.resultsPerQuery,signal),runtime.openAiTimeoutMs,"AI discovery",job.openai);},{retryTimeouts:true,sleep:delay=>marketResearchRequest(run,signal=>new Promise((resolve,reject)=>{const timer=setTimeout(resolve,delay);signal.addEventListener("abort",()=>{clearTimeout(timer);reject(marketResearchAbortError());},{once:true});}),Math.max(1,delay+100),"Retry delay")});
          assertMarketResearchRun(run);if(!found.available){openAiAvailable=false;recordResearchError("AI discovery",query.query,found.reason);return [];}
          openAiSuccesses++;if(found.status==="partial")openAiFailures++;if(found.warning)recordResearchError("AI discovery",query.query,found.warning);run.acceptResults(found.results);return found.results;
        }catch(error){assertMarketResearchRun(run);openAiFailures++;recordResearchError("AI discovery",query.query,error);return [];}
      };
      const firecrawlJob=async()=>{if(!job.firecrawl)return [];try{const rows=await marketResearchRequest(run,signal=>searchMarket(query,limits.resultsPerQuery,signal),runtime.requestTimeoutMs,"Firecrawl search",job.firecrawl);assertMarketResearchRun(run);firecrawlSuccesses++;run.acceptResults(rows);return rows;}catch(error){assertMarketResearchRun(run);firecrawlFailures++;recordResearchError("Firecrawl",query.query,error);return [];}};
      const found=await Promise.all([openAiJob(),firecrawlJob()]);assertMarketResearchRun(run);completedJobs++;updateProgress();return found;
    };
    const verificationReceipt=requestsGemini&&!retryOnly?recordMarketResearchReceipt(run,"gemini","verification","Collected evidence"):null;
    const customJobs=customSources.map((url,index)=>({url,index,receipt:recordMarketResearchReceipt(run,"firecrawl","custom_source",url)}));
    await LeadIntelMarket.mapWithConcurrency(queries.map(queryReceipts),executeQuery,{concurrency:runtime.concurrency});assertMarketResearchRun(run);
    await LeadIntelMarket.mapWithConcurrency(customJobs,async job=>{assertMarketResearchRun(run);try{const rows=await marketResearchRequest(run,signal=>searchCustomSource(job.url,job.index,signal),runtime.requestTimeoutMs,"Custom source",job.receipt);assertMarketResearchRun(run);firecrawlSuccesses++;addResults(rows);}catch(error){assertMarketResearchRun(run);firecrawlFailures++;recordResearchError("Custom URL",job.url,error);}completedJobs++;updateProgress();},{concurrency:runtime.concurrency});assertMarketResearchRun(run);
    let extracted=[];
    const extractEvidence=async()=>{state.market.researchPhase="extracting";publish();const receipt=recordMarketResearchReceipt(run,"firecrawl","extraction_batch","Evidence extraction");try{const rows=await marketResearchRequest(run,signal=>extractResearchPages(results,mode,signal,{previouslyExtracted:extracted,profile}),researchExtractionTimeoutMs(mode),"Evidence extraction",receipt);assertMarketResearchRun(run);extracted=LeadIntelMarket.mergeResearchResults(extracted,rows);addResults(rows);}catch(error){assertMarketResearchRun(run);firecrawlFailures++;recordResearchError("Firecrawl extraction","Evidence extraction",error);}};
    if(!retryOnly||results.some(item=>item.evidenceKind==="search_excerpt"&&!item.extractedAt))await extractEvidence();assertMarketResearchRun(run);
    // Each pass uses newly collected evidence; intelligence may spend its reserved budget over two passes.
    for(let pass=0;!retryOnly&&mode!=="quick"&&pass<(mode==="intelligence"?2:1);pass++){
      assertMarketResearchRun(run);const remainingQueries=limits.maxQueries-state.market.researchQueries.length;if(remainingQueries<=0)break;
      const adaptive=globalThis.LeadIntelMarketConditions?.buildAdaptivePlan({mode,market:LeadIntelMarket.effectiveResearchMarkets(profile)[0],offer:String(profile.priorityOffers||"").split(/[;\n]/)[0],profile,signals,sourceTypes,remainingQueries:Math.min(remainingQueries,2),previousQueries:state.market.researchQueries,results})||{queries:[],gaps:[]};
      const seen=new Set(state.market.researchQueries.map(item=>String(item.query).trim().toLowerCase())),followups=(adaptive.queries||[]).filter(item=>{const key=String(item.query).trim().toLowerCase();if(!key||seen.has(key))return false;seen.add(key);return true;}).slice(0,Math.min(remainingQueries,2));
      if(!followups.length)break;state.market.researchQueries=[...state.market.researchQueries,...followups];totalJobs+=followups.length;state.market.researchPhase="following";updateProgress();
      const before=new Set(results.map(item=>item.url));await LeadIntelMarket.mapWithConcurrency(followups.map(queryReceipts),executeQuery,{concurrency:runtime.concurrency});assertMarketResearchRun(run);await extractEvidence();assertMarketResearchRun(run);
      if(!results.some(item=>!before.has(item.url)))break;
    }
    // Verification IDs and coverage refer to the same deduplicated sources saved in the report.
    selectOutcomeEvidence();
    if(requestsGemini&&!retryOnly){
      state.market.researchPhase="verifying";publish();const receipt=verificationReceipt;
      try{const payload=await marketResearchRequest(run,signal=>verifyResearchWithGemini(mode,profile,results,signals,signal),runtime.requestTimeoutMs,"Gemini verification",receipt);assertMarketResearchRun(run);const verified=globalThis.LeadIntelResearchVerification.applyVerification(results,payload);results=verified.results;state.market.researchVerification=verified.verification;state.market.researchSourceStatus.gemini=verified.verification.status;if(receipt){receipt.status=verified.verification.status;receipt.reason=verified.verification.reason;receipt.resultCount=verified.verification.coverage?.reviewed||0;}}
      catch(error){assertMarketResearchRun(run);recordResearchError("Gemini","Verification",error);state.market.researchSourceStatus.gemini="unavailable";state.market.researchVerification={status:"unavailable",provider:"gemini",role:"verification",webSearch:false,reason:String(error?.message||"Verification did not complete").slice(0,300),summary:"",disagreements:[],missingEvidence:[],verifiedAt:""};}
    }
    assertMarketResearchRun(run);state.market.researchSourceStatus.discovery=!queries.length?"idle":!openAiAvailable?"unavailable":openAiFailures?openAiSuccesses?"partial":"error":"complete";
    if(!retryOnly)state.market.researchSourceStatus.firecrawl=firecrawlFailures?firecrawlSuccesses?"partial":"error":"complete";
    state.market.researchPhase="building";publish();buildOutcome();
    const incomplete=openAiFailures+firecrawlFailures+state.market.researchErrors.length>0||!openAiAvailable||state.market.researchQuality?.passed===false||(requestsGemini&&state.market.researchSourceStatus.gemini!=="complete");
    state.market.researchStatus=!results.length?(previous.results.length?"partial":"error"):incomplete?"partial":"complete";run.execution.status=state.market.researchStatus;
    if(retryOnly)state.market.lastOpenAiRetry={attempts:run.execution.receipts.filter(item=>item.provider==="ai").reduce((n,item)=>n+item.attempt,0),responseTimeMs:Date.now()-run.startedAt,status:state.market.researchSourceStatus.discovery,failureReason:openAiFailures?"One or more discovery queries remained unavailable":""};
  }catch(error){
    if(marketResearchScopeCurrent(run)&&started){state.market.researchStatus=state.market.researchResults.length?"partial":"error";run.execution.status=run.controller.signal.aborted?"cancelled":"failed";if(!run.controller.signal.aborted){run.stopReason=String(error?.message||error).slice(0,300);recordResearchError("LeadIntel","Research run",error);}}
  }finally{
    clearInterval(elapsedTimer);
    try{if(marketResearchScopeCurrent(run)&&started){
      if(researchElapsedTimer===elapsedTimer)researchElapsedTimer=null;
      const cancelled=run.controller.signal.aborted;for(const receipt of run.execution.receipts)if(["planned","running"].includes(receipt.status)){receipt.status=receipt.status==="planned"?"not_run":"cancelled";receipt.completedAt=Date.now();}
      if(cancelled){run.execution.status="cancelled";state.market.researchErrors=[{provider:"LeadIntel",query:"Research run",message:run.stopReason||"Market research cancelled"},...state.market.researchErrors].slice(0,12);}run.execution.stopReason=run.stopReason;run.execution.completedAt=Date.now();
      for(const provider of ["openai","anthropic","firecrawl","gemini","perplexity"]){
        if(provider==="gemini"&&requestsGemini)continue;
        if(!run.execution.receipts.some(row=>row.provider===provider))continue;
        const receipts=run.execution.receipts.filter(row=>row.provider===provider),completed=receipts.some(row=>["complete","zero_results"].includes(row.status));
        state.market.researchSourceStatus[provider]=completed?(receipts.every(row=>["complete","zero_results"].includes(row.status))?"complete":"partial"):"unavailable";
      }
      if(state.market.researchSourceStatus.discovery==="running")state.market.researchSourceStatus.discovery="unavailable";
      if(state.market.researchVerification?.status==="running"){state.market.researchSourceStatus.gemini="unavailable";const attempted=run.execution.receipts.some(row=>row.provider==="gemini"&&row.attempt>0);state.market.researchVerification={...state.market.researchVerification,status:"unavailable",reason:(attempted?"Verification interrupted: ":"Verification not started: ")+(run.stopReason||"Research ended before verification completed")};}
      // Cancellation stops provider work, not the local handoff of already acquired
      // evidence. Reuse the normal quality/scoring path without new requests.
      if(results.length&&!outcomeBuilt&&profile&&signals){
        try{buildOutcome();}catch(error){run.execution.status="failed";state.market.researchErrors.push({provider:"LeadIntel",query:"Evidence handoff",message:String(error?.message||error).slice(0,240)});}
      }
      if(!results.length&&previous.results.length){state.market.researchQuality=previous.quality;state.market.researchContextFingerprint=previous.fingerprint||"stale:rerun-failed";state.market.researchContextStale=true;}
      state.market.researchResults=mergeRetainedResearchEvidence(previous.results,state.market.researchResults);
      if(retryOnly)delete state.market.openAiRetryProgress;
      state.market.researchExecution=JSON.parse(JSON.stringify(run.execution));state.market.researchPhase="complete";state.market.researchProgress={completed:completedJobs,total:totalJobs};
      state.market.lastResearchAt=results.length?new Date().toISOString():previous.lastResearchAt;
      state.market.researchHistory=LeadIntelMarket.appendResearchHistory(state.market.researchHistory,{id:run.id,mode,status:state.market.researchStatus,sourceCount:results.length,queryCount:state.market.researchQueries.length,completedAt:new Date().toISOString()});
      researchButtons.forEach(button=>{button.disabled=false;});
      try{if(saveState()===false)throw Error("Workspace save was not confirmed");}catch(error){if(!marketResearchScopeCurrent(run))return;state.market.researchStatus=state.market.researchResults.length?"partial":"error";state.market.researchExecution.status="failed";taskCentre?.fail(taskId,"Research results remain in memory; the workspace save did not complete",{canRetry:true,resultCount:results.length});renderMarketStrategy();showToast("Research results remain in memory. Workspace save did not complete; check storage and synchronization before leaving.");return;}
      if(!marketResearchScopeCurrent(run))return;renderMarketStrategy();if(!marketResearchScopeCurrent(run))return;await researchReportUi?.capture();if(!marketResearchScopeCurrent(run))return;
      if(cancelled||state.market.researchStatus==="error")taskCentre?.fail(taskId,cancelled?"Market research stopped; collected evidence was retained":"Market research could not complete",{canRetry:true,resultCount:results.length});else taskCentre?.complete(taskId,{status:state.market.researchStatus,stage:state.market.researchStatus==="partial"?'Completed with source warnings':'Market research complete',resultCount:results.length});
      showToast(`${cancelled?"Market research stopped":state.market.researchStatus==="complete"?"Market research complete":"Market research partially complete"} · ${results.length} new evidence sources · saved evidence retained`);
    }}finally{finishMarketResearchRun(run);}
  }
}
function stopOpenAiCountdown(){if(openAiCountdownTimer){clearInterval(openAiCountdownTimer);openAiCountdownTimer=null;}}
function startOpenAiCountdown(){stopOpenAiCountdown();openAiCountdownTimer=setInterval(()=>{if(!state.market.openAiRetryProgress){stopOpenAiCountdown();return;}renderResearchStatus();},1000);}
function openAiRetryStatus(progress={}){const total=Math.max(1,Number(progress.total)||1);const completed=Math.min(Number(progress.completed)||0,total);const current=Math.min(completed+1,total);const remaining=Math.max(0,Math.ceil(((Number(progress.deadlineAt)||Date.now())-Date.now())/1000));const attempt=Math.max(1,Number(progress.attempt)||1);return `AI discovery ${current}/${total} queries · attempt ${attempt}/2 · ${remaining}s remaining`;}
async function retryOpenAiDiscovery(){
  if(activeMarketResearchRun&&marketResearchScopeCurrent(activeMarketResearchRun)&&!activeMarketResearchRun.controller.signal.aborted)return;
  if(state.market.researchContextStale||state.market.researchQuality?.passed===false)return runMarketResearch(state.market.researchMode);
  return runMarketResearch(state.market.researchMode,{retryOnly:true});
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
  const market=state.market;
  const hasFindings=market.opportunities.some(opp=>!opp.profileOnly)||Boolean(globalThis.LeadIntelMarketConditions?.normalizePack(market.marketConditions))||Boolean(market.researchResults?.length)||Boolean(market.researchReports?.length);
  const summary=$("strategy-research-summary"),action=$("strategy-research-action"),findings=$("strategy-research-findings");
  const labels={running:"Research in progress…",error:"Research could not finish — try again",partial:"Partial research available",complete:"Research available"};
  if(summary)summary.textContent=labels[market.researchStatus]||(hasFindings?"Saved research available":"No research yet");
  if(action)action.textContent=market.researchStatus==="running"?"View progress →":hasFindings?"Update research →":"Research market →";
  if(findings)findings.hidden=!hasFindings;
  target.hidden=!market.opportunities.some(opp=>!opp.profileOnly);
  target.innerHTML=market.opportunities.map((opp,index)=>opp.profileOnly?"":`<article class="opportunity-card ${opp.active?"active":""}">
    <div class="opportunity-top"><label class="market-toggle"><input type="checkbox" data-opportunity-active="${index}" aria-label="Use ${esc(opp.title)}" ${opp.active?"checked":""}><span></span></label><div><span class="opportunity-market">${esc(opp.marketLabel||opp.market)}</span><h4 lang="${contentLanguage()}">${esc(opp.title)}</h4></div><div class="opportunity-total"><strong>${opp.score.total}</strong><span>/100 priority score</span></div></div>
    <div class="strategy-setting-status" role="status">${opp.active?"Active — used to prioritize company discovery":"Off — excluded from company discovery"}</div>
    <p class="opportunity-score-note">Relative search priority, not a probability of demand. Buying intent requires company-level evidence.</p>
    <div class="opportunity-meta"><span class="confidence ${(state.market.researchQuality?.passed===false&&opp.confidence==="High"?"Medium":opp.confidence).toLowerCase()}">${state.market.researchQuality?.passed===false&&opp.confidence==="High"?"Medium":opp.confidence} confidence</span><span>${opp.evidence.length} evidence source${opp.evidence.length===1?"":"s"}</span></div>
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
  const offer=LeadIntelMarket.splitList(state.profile?.priorityOffers).slice(0,3).join(" · ")||"your priority offers";
  const activeSignals=(state.market.signals||[]).filter(signal=>signal&&signal.active!==false).length;
  const sourceCount=state.market.researchResults.length;
  if(state.market.openAiRetryProgress){
    const retryMessages=["Retrying AI discovery against the planned market searches.",sourceCount?`${sourceCount} saved evidence source${sourceCount===1?" remains":"s remain"} available while this retry runs.`:"This retry checks source discovery from the original research plan."];
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
  const resultStatus=$('profile-market-result-status');if(resultStatus&&window.LeadIntelProfileMarket?.resultsMessage)resultStatus.textContent=window.LeadIntelProfileMarket.resultsMessage(state);
  const status=state.market.researchStatus;const count=state.market.researchResults.length;const queries=state.market.researchQueries.length;const sources=state.market.researchSourceStatus||{openai:"idle",firecrawl:"idle",gemini:"idle"};
  const modeLabel=researchModeUi(state.market.researchMode).label;
  const discoveryStatus=sources.discovery||sources.openai;
  const partialCoverage=status==="partial"?describePartialCoverage({modeLabel,count,openAiStatus:discoveryStatus,firecrawlStatus:sources.firecrawl}):null;
  const statusNode=$("market-research-status");
  const completedWithEvidence=(status==="complete"||status==="partial")&&count>0;
  if(statusNode){
    statusNode.dataset.status=completedWithEvidence?(status==="partial"?"complete-with-warning":"complete"):status;
    if(status==="running"&&!state.market.openAiRetryProgress){
      const view=researchProgressView();
      renderRunningResearchStatus(statusNode,view);
    }else if(state.market.openAiRetryProgress){const progress=state.market.openAiRetryProgress;statusNode.dataset.status="complete-with-warning";statusNode.innerHTML=`<span class="research-status-icon" aria-hidden="true">↻</span><span class="research-status-copy"><strong>Retrying discovery…</strong><small>${esc(openAiRetryStatus(progress))} · ${count} Firecrawl evidence source${count===1?"":"s"} preserved.</small></span><button type="button" class="secondary-btn research-recovery-action" disabled>Working…</button>`;}
    else if(completedWithEvidence){
      const warning=status==="partial"?(["unavailable","error"].includes(discoveryStatus)?"AI page discovery was unavailable. Saved evidence is preserved; review the incomplete checks below.":"Some research checks were unavailable. Saved results are preserved."):"";
      const providerSummary=status==="complete"?`Public-source research checks completed${["deep","intelligence"].includes(state.market.researchMode)&&sources.gemini==="complete"?" · Gemini verification completed":""}.`:"";
      const retry=status==="partial"&&(["partial","error","unavailable"].includes(discoveryStatus)||state.market.researchQuality?.passed===false)?`<button type="button" class="secondary-btn research-recovery-action" data-extend-openai>Retry incomplete checks</button>`:"";
      statusNode.innerHTML=`<span class="research-status-icon" aria-hidden="true">${status==="partial"?"!":"✓"}</span><span class="research-status-copy"><strong>${esc(modeLabel)} ${status==="partial"?"partially complete":"complete"} · ${count} source${count===1?"":"s"} saved</strong><small>${providerSummary?`<span>${esc(providerSummary)}</span>`:""}${warning?`<em>${esc(warning)}</em>`:""}</small></span>${retry}<button type="button" class="secondary-btn research-report-action" data-research-view-report>View report</button>`;
      statusNode.querySelector("[data-research-view-report]")?.addEventListener("click",()=>researchReportUi?.openLatest());
      statusNode.querySelector("[data-extend-openai]")?.addEventListener("click",()=>void retryOpenAiDiscovery());
    }else{
      const messages={error:"Research run failed · no public evidence was saved. Review the failure details below, adjust the scope if needed, and retry.",partial:`${modeLabel} partially complete · ${count} evidence sources · some provider checks were unavailable.`,idle:"Target market selected · live market research can increase confidence."};
      statusNode.textContent=status==="partial"&&partialCoverage?partialCoverage.status:(messages[status]||messages.idle);
    }
  }
  renderResearchProgressWindow(status,status==="running"?researchProgressView():null);
  const feedback=$("research-run-feedback");
  if(feedback){
    const errors=[...(state.market.researchErrors||[]),...(state.market.researchQuality?.gaps||[]).map(gap=>({provider:"Evidence coverage",message:gap})),...(["unavailable","partial"].includes(sources.gemini)?[{provider:"Gemini",message:state.market.researchVerification?.reason||"Verification incomplete"}]:[])];const show=status==="error"||status==="partial";
    feedback.hidden=!show;feedback.dataset.status=status;
    if(show)feedback.innerHTML=`<div><span class="eyebrow">Research quality</span><h4>${status==="partial"?"Research coverage gaps":"Research run failed"}</h4><p>${status==="partial"?"Saved evidence is available. Incomplete checks remain clearly marked.":"No public evidence was saved. Review the scope and try again."}</p></div>${errors.length?`<details class="research-check-details" ${status==="error"?"open":""}><summary>View incomplete checks (${errors.length})</summary><ul>${errors.slice(0,6).map(item=>`<li><strong>${esc(item.provider||"Source")}</strong><span>${esc(item.message||"Request failed")}</span><small>${esc(item.query)}</small></li>`).join("")}</ul></details>`:`<p class="research-feedback-empty">The public research providers returned no usable results. Open the research settings to change sources or add specific URLs.</p>`}`;
    else feedback.innerHTML="";
  }
  const actions=[["run-market-research","Quick Overview","Retry Quick Overview"],["run-detailed-research","Market Research","Retry Market Research"],["run-market-intelligence","Deep Analysis","Retry Deep Analysis"]];
  actions.forEach(([id,label,retryLabel])=>{const button=$(id);if(!button)return;button.textContent=status==="running"?"Researching…":status==="error"?retryLabel:`Review ${label}`;button.disabled=status==="running"||!state.profile;});
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
    if(depthEyebrow)depthEyebrow.textContent="Profile · Market research";
    if(depthTitle)depthTitle.textContent="How deeply should LeadIntel research this market?";
    if(depthDescription)depthDescription.textContent="Select one option to review the research plan before starting.";
  }
  $("research-results-details").hidden=!view.showScore;
  const resultsIntro=$("research-results-intro");if(resultsIntro)resultsIntro.hidden=!view.researched;
  $("strategy-activation-card").hidden=!view.showActivation;
  $("monitoring-panel").hidden=false;
  const activationButton=$("activate-market-strategy");
  const title=$("strategy-activation-title");
  const description=$("strategy-activation-description");
  const step=$("strategy-activation-step");
  activationButton.hidden=false;
  const running=researchRunning();
  activationButton.disabled=running;
  activationButton.textContent=running?"Research in progress — please wait":"Review & Continue to Companies →";
  activationButton.setAttribute("aria-disabled",String(running));
  activationButton.dataset.researchRunning=String(running);
  if(view.stage==="active"){
    step.textContent="Strategy saved";
    title.textContent="Ready to find matching companies";
    description.textContent="Your approved market evidence will guide the Companies stage."
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
  $("research-custom-sources").value=state.market.researchCustomSources.join("\n");saveState();renderResearchControls();showToast("Website removed from research. Manage scheduled websites in monitoring settings.");
}
function renderResearchControls(){
  const mode=normalizeResearchMode(state.market.researchMode);
  $("research-mode").value=mode;
  const sourceTypes=LeadIntelMarket.filterResearchSourceTypes(state.market.researchSourceTypes||[],state.market.signals||[]);
  const selectedSources=new Set(sourceTypes.length||state.market.researchSourceTypesCustomized===true?sourceTypes:(mode==="quick"?["news"]:["news","jobs","investments","company","registries"]));const tenderAllowed=LeadIntelMarket.filterResearchSourceTypes(["tenders"],state.market.signals||[]).includes("tenders");document.querySelectorAll('#research-source-types input').forEach(input=>{input.disabled=input.value==="tenders"&&!tenderAllowed;input.checked=selectedSources.has(input.value)&&!input.disabled;});
  const tenderNote=$("tender-source-note");if(tenderNote)tenderNote.textContent=tenderAllowed?"Tender research is available because the tender signal is active.":"Tenders are excluded. Activate the tender signal above if you want to include them.";
  $("research-custom-sources").value=(state.market.researchCustomSources||[]).join("\n");$("research-instructions").value=state.market.researchInstructions||"";renderSavedResearchWebsites();
  const recommendations=LeadIntelMarket.buildResearchRecommendations(state.profile||{},state.market.signals||[],[...selectedSources],contentLanguage());$("research-recommendations").innerHTML=recommendations.length?recommendations.map(item=>`<div><strong>${esc(item.label)}</strong><span>${esc(item.reason)}</span></div>`).join(""):"<span>Select a source category to see the recommendation.</span>";
  [["run-market-research","quick"],["run-detailed-research","deep"],["run-market-intelligence","intelligence"]].forEach(([id,mode])=>{const button=$(id);const limits=LeadIntelMarket.RESEARCH_MODES[mode];if(button)button.title=`${researchModeUi(mode).label}: maximum ${limits.maxQueries} searches, ${limits.resultsPerQuery} results per search and ${limits.maxStoredResults} stored sources`;});
}
function renderResearchHistory(){const target=$("research-history");const history=state.market.researchHistory||[];target.innerHTML=history.length?history.slice(0,5).map(run=>`<span>${esc(run.mode)} · ${run.sourceCount} sources · ${esc(new Date(run.completedAt).toLocaleDateString())}</span>`).join(""):"";}
async function monitoringApi(path,options={},context=captureMonitoringContext()){
  // Bound bridge readiness, HTTP headers and body parsing; a stalled response
  // must release the controls without automatically repeating a paid action.
  const controller=new AbortController(),mutation=Boolean(options.method&&options.method!=='GET');
  const timeoutMs=/\/run(?:\?|$)/.test(path)?330000:45000;
  let timer;const deadline=new Promise((_,reject)=>{timer=setTimeout(()=>{const error=new Error(mutation?'Monitoring response was not confirmed. Refresh status before retrying; the server may have saved or completed the request.':'Monitoring could not be refreshed in time. Try Refresh status again.');reject(error);controller.abort();},timeoutMs);});
  try{return await Promise.race([deadline,(async()=>{
    const bridge=await waitForMarketServerBridge();
    if(controller.signal.aborted)throw new Error('Monitoring request timed out.');
    if(!monitoringContextCurrent(context))throw new Error("Workspace changed. Monitoring response discarded.");
    if(!bridge?.session?.authenticated||!bridge.workspace?.id)throw new Error("Sign in to use automatic monitoring");
    const separator=path.includes("?")?"&":"?";
    const response=await fetch(`${LEADINTEL_API}${path}${separator}workspace_id=${encodeURIComponent(bridge.workspace.id)}`,{...options,credentials:"include",headers:{Accept:"application/json","Content-Type":"application/json",...(options.headers||{})},signal:controller.signal});
    const payload=await response.json().catch(()=>({}));
    if(!monitoringContextCurrent(context))throw new Error("Workspace changed. Monitoring response discarded.");
    if(!response.ok)throw new Error(window.LeadIntelMonitoringModel?.runIssue?.(payload.error)||payload.error||`Monitoring returned ${response.status}`);return payload;
  })()]);}finally{clearTimeout(timer);}
}

function monitoringFormSnapshot(){
  return JSON.stringify([...$("monitoring-settings").querySelectorAll("input,select,textarea")].map(input=>[input.id||input.dataset.monitorSignal||input.dataset.monitorSource,input.value,input.checked]));
}
function captureMonitoringContext(strategy=false){const bridge=window.LeadIntelServerBridge;return {workspace:bridge?.workspace?.id||'',user:bridge?.session?.user?.id||'',authenticated:bridge?.session?.authenticated,account:window.localStorage?.getItem('leadintel_account_context_v1')||'',...(strategy?{strategy:strategyIntegrity()?.signature(state)}:{})};}
function monitoringContextCurrent(context){
  if(!context)return false;const current=captureMonitoringContext();
  return context.workspace===current.workspace&&context.user===current.user&&context.authenticated===current.authenticated&&context.account===current.account&&window.LeadIntelServerBridge?.ready!==false&&(!window.LeadIntelAccountCache||window.LeadIntelAccountCache.current())&&(!context.strategy||context.strategy===strategyIntegrity()?.signature(state));
}

function monitoringHasEdits(){return monitoringDraftMarket===state.market&&monitoringDraftBaseline!==null&&monitoringFormSnapshot()!==monitoringDraftBaseline;}
function monitoringApprovalCurrent(owner=monitoringApprovalContext){
  const current=Boolean(owner&&owner===monitoringApprovalContext&&monitoringContextCurrent(owner)&&owner.website===state.website&&owner.markets===JSON.stringify([...(state.targetMarkets||[])].sort()));
  if(!current&&owner===monitoringApprovalContext)monitoringApprovalContext=null;
  return current;
}
function renderMonitoringApprovalGuide(){
  const guide=$("monitoring-approval-guide");if(!guide)return;
  const visible=monitoringApprovalCurrent()&&[2,3].includes(Number(state.step));guide.hidden=!visible;
  const host=visible?$("step-"+state.step):null;if(host&&guide.parentElement!==host)host.prepend(guide);
}
function clearMonitoringApproval(){monitoringApprovalContext=null;renderMonitoringApprovalGuide();}
function beginMonitoringApproval(){
  if(monitoringBusy||monitoringHasEdits())return false;
  monitoringApprovalContext={...captureMonitoringContext(),website:state.website,markets:JSON.stringify([...(state.targetMarkets||[])].sort())};
  renderMonitoringApprovalGuide();
  if(setStep(4)===false)return false;
  openStrategyHandoff();return true;
}
function continueMonitoringApproval(){
  if(!monitoringApprovalCurrent()||!state.approved)return false;
  try{if(setStep(4)===false)return false;openStrategyHandoff();return true;}
  catch{clearMonitoringApproval();showToast("Profile saved. Reopen monitoring to continue the Strategy review.");return false;}
}
function returnToMonitoring(owner=monitoringApprovalContext){
  if(!monitoringApprovalCurrent(owner)){renderMonitoringApprovalGuide();return false;}
  clearMonitoringApproval();closeStrategyHandoff();
  if(setStep(2)===false)return false;
  if(!window.LeadIntelWebsiteScanUI?.openMonitoring?.()){showToast("Strategy saved. Open Website Scanning → Monitor websites to continue.");return false;}
  return true;
}
function cancelStrategyHandoff(){
  if(monitoringApprovalCurrent())return returnToMonitoring();
  clearMonitoringApproval();return state.market.researchContextStale?returnToProfileResearch():closeStrategyHandoff();
}
function updateMonitoringDisclosure(){
  const open=!$("monitoring-settings").hidden,config=state.market.monitoring;
  const configured=Boolean(config.customSources?.length||config.signalIds?.length||config.enabled||config.lastRunAt);
  const toggle=$("toggle-monitoring-settings");toggle.querySelector("[data-monitoring-action-label]").textContent=open?"Close settings":configured?"Edit settings":"Set up monitoring";toggle.querySelector("[aria-hidden]").textContent=open?"↑":"→";toggle.setAttribute("aria-expanded",String(open));
  const summary=$("monitoring-saved-summary");summary.hidden=!configured;
  const count=config.customSources?.length||0;
  summary.textContent=`Saved: ${count?`${count} website${count===1?"":"s"}`:"Selected source categories"} · ${config.frequency[0].toUpperCase()+config.frequency.slice(1)} · ${config.researchDepth==="deep"?"Deep":"Quick"} research`;
  const locked=!strategyIntegrity()?.status(state).current,dirty=monitoringHasEdits();
  $("toggle-monitoring-settings").disabled=monitoringBusy;$("close-monitoring-settings").disabled=monitoringBusy;$("save-monitoring-close").disabled=monitoringBusy;
  for(const id of ["discard-monitoring-close","keep-editing-monitoring"])$(id).disabled=monitoringBusy;
  $("monitoring-settings").querySelectorAll("input,select,textarea").forEach(input=>{input.disabled=monitoringBusy||(input.id==="monitoring-enabled"&&locked&&!config.enabled);});
  if($("refresh-monitoring"))$("refresh-monitoring").disabled=monitoringBusy||monitoringRefreshing;
  $("save-monitoring").disabled=monitoringBusy;$("run-monitoring-now").disabled=locked||monitoringBusy||dirty||!config.revision;
  const review=$("monitoring-review-strategy");if(review){review.hidden=!locked;review.disabled=monitoringBusy||dirty;}
  if(typeof updateMonitoringWorkflowHelp==='function'&&$('monitoring-purpose'))updateMonitoringWorkflowHelp();
  if(dirty&&!monitoringBusy)$("monitoring-status").textContent="Unsaved changes — save settings before running. The saved schedule above is unchanged.";
  if(!monitoringBusy&&!locked&&config.workflow.purpose==='signals'&&config.signalIds.length&&!$("monitoring-signals").querySelector("input:checked")){$("run-monitoring-now").disabled=true;if($("monitoring-advanced"))$("monitoring-advanced").open=true;$("monitoring-status").textContent="Your saved buying signals have changed. Select active signals below, save settings, then enable monitoring.";}
}
function openMonitoringSettings(){
  renderMonitoringControls();$("monitoring-settings").hidden=false;monitoringDraftMarket=state.market;monitoringDraftBaseline=monitoringFormSnapshot();updateMonitoringDisclosure();$("monitoring-custom-sources").focus();void loadMonitoringServerState(true);
}
function closeMonitoringSettings(){
  $("monitoring-settings").hidden=true;monitoringDraftBaseline=null;monitoringDraftMarket=null;keepEditingMonitoring();updateMonitoringDisclosure();$("toggle-monitoring-settings").focus();
}
function requestCloseMonitoringSettings(){if(monitoringBusy)return;if(monitoringHasEdits())$("monitoring-close-dialog").showModal();else closeMonitoringSettings();}
function keepEditingMonitoring(){if($("monitoring-close-dialog").open)$("monitoring-close-dialog").close();}
function discardMonitoringEdits(){monitoringDraftBaseline=null;closeMonitoringSettings();renderMonitoringControls();}
function monitoringMessageStudio(){
 if(!monitoringContextCurrent(captureMonitoringContext()))return {};
 let outreach;try{outreach=JSON.parse(localStorage.getItem('leadintel_customer_v2_outreach')||'{}');}catch{return {};}
 return window.LeadIntelMonitoringModel.messageStudio({main:state,outreach});
}
function renderMonitoringWorkflow(workflow){
 window.LeadIntelMonitoringManager?.decorate($('monitoring-purpose'),workflow);
 const values={'purpose':workflow.categoryId||workflow.purpose,'read-mode':workflow.readMode,'query-terms':workflow.queryTerms.join('\n'),'exclude-terms':workflow.excludeTerms.join('\n'),'next-action':workflow.nextAction,'message-mode':workflow.messageMode,'daily-limit':workflow.dailyLimit};
 for(const [id,value] of Object.entries(values))if($('monitoring-'+id))$('monitoring-'+id).value=value;
 const templates=window.LeadIntelPersonalTemplates?.normalize(monitoringMessageStudio().myTemplates)||monitoringMessageStudio().myTemplates||{};
 $('monitoring-template-id').innerHTML='<option value="">Choose in the inbox</option>'+Object.values(templates).filter(t=>t&&!t.deleted&&/^template-(?:[1-9]|1\d|20)$/.test(t.id)).map(t=>'<option value="'+esc(t.id)+'">'+esc(t.name)+'</option>').join('');$('monitoring-template-id').value=workflow.templateId;
}
function updateMonitoringWorkflowHelp(){const selected=$('monitoring-purpose').value,purpose=window.LeadIntelMonitoringManager?.selection(selected)?.purpose||selected,legacy=purpose==='signals'&&!selected.startsWith('MC-');for(const id of ['monitoring-read-mode','monitoring-query-terms','monitoring-exclude-terms'])$(id).disabled=monitoringBusy||legacy;for(const id of ['monitoring-query-terms','monitoring-exclude-terms'])$(id).readOnly=selected.startsWith('MC-');$('monitoring-purpose-help').textContent=legacy?'Checks use your active Strategy signals and the source categories below. Review new evidence in the Monitoring inbox.':(purpose==='court'?'Tracks public case references, dates and identified parties. Sensitive or anonymized cases require review.':purpose==='procurement'?'Tracks notices, deadlines and amendments. Review bid eligibility in the inbox.':purpose==='hiring'?'Tracks advertised roles and skills. Review employers in the inbox; a job advert alone does not confirm buying intent.':'Tracks public events using your matching and exclusion words. Unknown page layouts need source review.');}
$('monitoring-purpose')?.addEventListener('change',async()=>{if(await window.LeadIntelMonitoringManager?.legacyCategory($('monitoring-purpose')))return;const selected=window.LeadIntelMonitoringManager?.selection($('monitoring-purpose').value)||{purpose:$('monitoring-purpose').value},defaults=window.LeadIntelMonitoringModel.normalizeWorkflow(selected);if(selected.categoryId){$('monitoring-query-terms').value=defaults.queryTerms.join('\n');$('monitoring-exclude-terms').value=defaults.excludeTerms.join('\n');}$('monitoring-purpose').dataset.previousPurpose=$('monitoring-purpose').value;$('monitoring-read-mode').value=defaults.readMode;$('monitoring-next-action').value=defaults.nextAction;updateMonitoringWorkflowHelp();});
function readMonitoringWorkflow(){return (window.LeadIntelMonitoringModel?.normalizeWorkflow||((v)=>({...LeadIntelMarket.normalizeMonitoring({}).workflow,...v})))({...window.LeadIntelMonitoringManager?.selection($('monitoring-purpose')?.value),purpose:window.LeadIntelMonitoringManager?.selection($('monitoring-purpose')?.value)?.purpose||$('monitoring-purpose')?.value,readMode:$('monitoring-read-mode')?.value,queryTerms:$('monitoring-query-terms')?.value,excludeTerms:$('monitoring-exclude-terms')?.value,nextAction:$('monitoring-next-action')?.value,messageMode:$('monitoring-message-mode')?.value,templateId:$('monitoring-template-id')?.value,dailyLimit:$('monitoring-daily-limit')?.value});}
window.LeadIntelMonitoringManager?.configure({api:monitoringApi,capture:captureMonitoringContext,current:monitoringContextCurrent,reviewStrategy:beginMonitoringApproval,legacy:()=>{setStep(2);window.LeadIntelWebsiteScanUI?.openMonitoring?.();openMonitoringSettings();},templates:()=>Object.values(window.LeadIntelPersonalTemplates?.normalize(monitoringMessageStudio().myTemplates)||{}).filter(t=>t&&!t.deleted)});
window.LeadIntelMonitoringInbox?.configure({api:monitoringApi,capture:captureMonitoringContext,current:monitoringContextCurrent,settings:()=>{setStep(2);window.LeadIntelWebsiteScanUI?.openMonitoring?.();openMonitoringSettings();},company:async(subject,finding,owner)=>{
 if(!monitoringContextCurrent(owner))throw Error('Workspace changed.');
 const bridge=window.LeadIntelServerBridge,website=window.LeadIntelMonitoringModel.publicUrl(subject.website);if(subject.kind!=='organization'||!website)throw Error('Review a company website first.');
 const result=await bridge.saveCrmCompany({company_name:subject.name,website,domain:new URL(website).hostname.replace(/^www\./,''),source:'monitoring'});
 if(!monitoringContextCurrent(owner))throw Error('Workspace changed.');if(result.ok===false||!result.company?.id)throw Error(result.error||'Company save was not confirmed.');
 if(['suppressed','archived'].includes(result.company.lifecycle_status))throw Error('This company is suppressed or archived.');
 await bridge.recordCrmActivity(result.company.id,{type:'company.monitoring_observed',channel:'web',summary:'Reviewed monitoring finding; qualification remains open.',metadata:{findingId:finding.id,sourceUrl:finding.source_url,quote:subject.source_quote}});
 if(!monitoringContextCurrent(owner))throw Error('Workspace changed.');await window.LeadIntelCampaignModuleLoader?.(6);if(!monitoringContextCurrent(owner))throw Error('Workspace changed.');
 await window.LeadIntelEmailCampaignUI.openCompanyList([{id:subject.id,name:subject.name,website,crmId:result.company.id,identityStatus:'verified',sourceUrl:finding.source_url,quote:subject.source_quote}],{name:'Monitored companies for review',sourceUrl:finding.source_url});
}});
function renderMonitoringControls(){
  const preserveDraft=monitoringHasEdits();
  const config=LeadIntelMarket.normalizeMonitoring(state.market.monitoring);state.market.monitoring=config;if(!preserveDraft){renderMonitoringWorkflow(config.workflow);$("monitoring-enabled").checked=config.enabled;$("monitoring-frequency").value=config.frequency;$("monitoring-depth").value=config.researchDepth;$("monitoring-minimum-score").value=config.minimumScore;$("monitoring-custom-sources").value=config.customSources.join("\n");
  const selectedSignals=new Set(config.signalIds.length?config.signalIds:state.market.signals.filter(signal=>signal.active).map(signal=>signal.id));$("monitoring-signals").innerHTML=state.market.signals.filter(signal=>signal.active).map(signal=>`<label><input type="checkbox" data-monitor-signal value="${esc(signal.id)}" ${selectedSignals.has(signal.id)?"checked":""}> ${esc(signal.name)}</label>`).join("")||"<span>No active signals</span>";
  const selectedSources=new Set(config.sourceTypes);$("monitoring-sources").innerHTML=Object.keys(LeadIntelMarket.SOURCE_TYPES).map(source=>`<label><input type="checkbox" data-monitor-source value="${source}" ${selectedSources.has(source)?"checked":""}> ${source[0].toUpperCase()+source.slice(1)}</label>`).join("");
  }
  const locked=!strategyIntegrity()?.status(state).current;$("monitoring-summary-status").textContent=monitoringBusy?"Working…":locked?"Strategy review needed":config.enabled?"Active":"Off";$("monitoring-status").textContent=monitoringBusy?"Checking or saving monitoring… Runs can take up to 5 minutes.":locked?"Save your settings now. Review and activate Strategy in Step 3 before enabling scheduled checks.":config.enabled?`Monitoring active · ${config.frequency}${config.nextRunAt?` · next due ${new Date(config.nextRunAt).toLocaleString()}`:""}. Due schedules are checked hourly; alerts appear here.`:config.revision?"Monitoring is off. Run once now, or enable monitoring for scheduled checks.":"Save your settings, then run once or enable scheduled monitoring.";
  if(!preserveDraft&&!$("monitoring-settings").hidden){monitoringDraftMarket=state.market;monitoringDraftBaseline=monitoringFormSnapshot();}updateMonitoringDisclosure();
}
function readMonitoringEdits(persist=true){const sourceTypes=LeadIntelMarket.filterResearchSourceTypes([...document.querySelectorAll('[data-monitor-source]:checked')].map(input=>input.value),state.market.signals||[]);const config=LeadIntelMarket.normalizeMonitoring({workflow:readMonitoringWorkflow(),enabled:$("monitoring-enabled").checked,frequency:$("monitoring-frequency").value,researchDepth:$("monitoring-depth").value,minimumScore:$("monitoring-minimum-score").value,sourceTypes,signalIds:[...document.querySelectorAll('[data-monitor-signal]:checked')].map(input=>input.value),customSources:$("monitoring-custom-sources").value.split(/\n/)});if(persist){state.market.monitoring=config;saveState();}return config;}
function renderMonitoringAlerts(alerts=[]){if(state.market.monitoring.workflow?.purpose&&state.market.monitoring.workflow.purpose!=='signals'){$("monitoring-alerts").innerHTML='<div class="market-empty">New and changed findings are saved in the Monitoring inbox. Review their sources and choose the next action there.<p><button class="secondary-btn" type="button" data-open-monitoring-inbox>Open Monitoring inbox →</button></p></div>';return;}$("monitoring-alerts").innerHTML=alerts.length?alerts.map(alert=>`<article class="monitor-alert"><div class="monitor-alert-head"><a href="${esc(alert.source_url)}" target="_blank" rel="noopener">${esc(alert.title)}</a><strong>${Number(alert.score)||0}/100</strong></div><p>${esc(alert.summary)}</p><span>${esc(new Date(alert.created_at).toLocaleString())}</span> ${alert.finding_id?`<button class="secondary-btn" type="button" data-open-monitoring-inbox>Review in Monitoring inbox →</button>`:alert.status==="new"?`<button type="button" data-monitor-alert-read="${esc(alert.id)}">Mark read</button>`:""}</article>`).join(""):'<div class="market-empty">No monitoring alerts yet.</div>';}
function renderMonitoringHistory(runs=[]){
  $("monitoring-history").innerHTML=runs.length?runs.map(run=>{
    const status=({completed:'Completed',partial:'Partly checked',failed:'Needs attention',running:'Checking'})[run.status]||'Check pending';
    const issue=window.LeadIntelMonitoringModel?.runIssue?.(run.error_message)||run.error_message||'';
    const date=run.completed_at||run.started_at,stamp=date?new Date(/(?:Z|[+-]\d{2}:?\d{2})$/.test(date)?date:date.replace(' ','T')+'Z').toLocaleString():'';
    const count=Number(run.alert_count)||0;
    return `<article class="monitor-run" data-run-status="${esc(run.status)}"><div class="monitor-run-heading"><strong>${esc(status)}</strong><span>${esc(stamp)}</span></div><p>${run.trigger_type==='scheduled'?'Scheduled':'Manual'} · ${run.research_depth==='deep'?'Deep':'Quick'} · ${Number(run.source_count)||0} sources · ${count} new alerts</p>${issue?`<p class="monitor-run-issue">${esc(issue)}</p>`:run.status==='completed'&&!count?'<p>No new findings met your alert criteria.</p>':''}</article>`;
  }).join(''):'<div class="market-empty">No checks yet. Save your settings and run your first check.</div>';
}

async function loadMonitoringServerState(force=false){
  if(monitoringBusy||(!force&&monitoringContextCurrent(monitoringLoaded)))return;
  const context=captureMonitoringContext(),serial=++monitoringRequestSerial,bridge=await waitForMarketServerBridge();
  if(!monitoringContextCurrent(context)||serial!==monitoringRequestSerial)return;
  if(!bridge?.session?.authenticated||!bridge.workspace?.id){$("monitoring-status").textContent="Sign in to configure automatic monitoring.";return;}
  monitoringLoaded=context;monitoringRefreshing=true;if($("refresh-monitoring"))$("refresh-monitoring").disabled=true;
  try{
    const [config,alerts,runs]=await Promise.all([monitoringApi('/api/market-monitoring/config',{},context),monitoringApi('/api/market-monitoring/alerts',{},context),monitoringApi('/api/market-monitoring/runs',{},context)]);
    if(!monitoringContextCurrent(context)||serial!==monitoringRequestSerial)return;
    const updated=LeadIntelMarket.normalizeMonitoring(config.config),draftConflict=monitoringHasEdits()&&Number(updated.revision)!==Number(state.market.monitoring.revision);if(!draftConflict&&JSON.stringify(updated)!==JSON.stringify(state.market.monitoring)){state.market.monitoring=updated;saveState();}renderMonitoringControls();renderMonitoringAlerts(alerts.alerts);renderMonitoringHistory(runs.runs);if(draftConflict)$("monitoring-status").textContent="Saved settings changed elsewhere. Your draft is retained. Close and discard the draft, then reopen settings to review the newer version.";if($("monitoring-refreshed-at"))$("monitoring-refreshed-at").textContent="Updated "+new Date().toLocaleTimeString([], {hour:"2-digit",minute:"2-digit"});
  }catch(error){if(serial===monitoringRequestSerial){if(monitoringLoaded===context)monitoringLoaded=false;if(monitoringContextCurrent(context))$("monitoring-status").textContent=error.message;}}
  finally{if(serial===monitoringRequestSerial){monitoringRefreshing=false;if($("refresh-monitoring"))$("refresh-monitoring").disabled=monitoringBusy;}}
}
async function saveMonitoringConfig({closeAfterSave=true}={}){
  if(monitoringBusy)return false;
  const previous=LeadIntelMarket.normalizeMonitoring(state.market.monitoring),config=LeadIntelMarket.normalizeMonitoring(readMonitoringEdits(false)),context=captureMonitoringContext(config.enabled),serial=++monitoringRequestSerial;let failure='',succeeded=false;
  const operation=window.LeadIntelReliabilityTrace?.begin('strategy_monitoring');
  try{
    monitoringBusy=true;renderMonitoringControls();
    if(config.enabled){const report=strategyIntegrity()?.status(state);if(!report?.current)throw Error(report?.reason||'Review and activate the current Strategy first.');if(window.LeadIntelServerBridge?.conflict)throw Error('Resolve workspace synchronization before enabling monitoring.');}
    if(config.enabled&&config.workflow.purpose==='signals'&&!config.signalIds.length)throw Error('Select at least one signal to monitor');
    if(config.enabled&&!config.sourceTypes.length&&!config.customSources.length)throw Error('Select at least one source category or custom source');
    operation?.checkpoint('persistence','pending');
    const result=await monitoringApi('/api/market-monitoring/config',{method:'PUT',body:JSON.stringify({revision:previous.revision,strategy_signature:config.enabled?strategyIntegrity().digest(context.strategy):undefined,enabled:config.enabled,frequency:config.frequency,research_depth:config.researchDepth,minimum_score:config.minimumScore,source_types:config.sourceTypes,signal_ids:config.signalIds,custom_sources:config.customSources,workflow:config.workflow})},context);
    if(!monitoringContextCurrent(context)||serial!==monitoringRequestSerial)return false;
    if(result.saved!==true||!result.config)throw Error('Monitoring save was not confirmed. Reload settings before retrying.');
    state.market.monitoring=LeadIntelMarket.normalizeMonitoring(result.config);saveState();succeeded=true;monitoringDraftBaseline=null;monitoringLoaded=context;
    showToast(state.market.monitoring.enabled?'Monitoring settings saved — schedule enabled':'Monitoring settings saved — schedule off');return true;
  }catch(error){if(monitoringContextCurrent(context)&&serial===monitoringRequestSerial){state.market.monitoring=previous;$("monitoring-enabled").checked=previous.enabled;saveState();failure=error.message;showToast(failure);}return false;}
  finally{operation?.finish(!monitoringContextCurrent(context)?'stale':succeeded?'pass':'fail');if(serial===monitoringRequestSerial){monitoringBusy=false;monitoringRefreshing=false;}renderMonitoringControls();if(monitoringContextCurrent(context)){if(succeeded&&closeAfterSave)closeMonitoringSettings();if(failure&&$("monitoring-status"))$("monitoring-status").textContent=`Save not confirmed — ${failure}. Refresh status to confirm the server setting.`;}}
}

async function runMonitoringNow(){
  if(monitoringBusy)return;if(monitoringHasEdits()){showToast("Save your monitoring changes before running.");return;}
  const report=strategyIntegrity()?.status(state);if(!report?.current){showToast(report?.reason||'Review and activate Strategy first.');return false;}
  const context=captureMonitoringContext(true),serial=++monitoringRequestSerial;let failure="";monitoringBusy=true;renderMonitoringControls();
  try{const result=await monitoringApi('/api/market-monitoring/run',{method:'POST',body:'{}'},context);if(!monitoringContextCurrent(context))return;
    failure=window.LeadIntelMonitoringModel?.runIssue?.(result.run.reason)||result.run.reason||'';showToast(failure||`Monitoring ${result.run.status||'completed'} · ${result.run.sourceCount} sources · ${result.run.alertCount} new alerts`);
  }catch(error){failure=error.message;if(monitoringContextCurrent(context))showToast(failure);}finally{if(serial===monitoringRequestSerial){monitoringBusy=false;monitoringRefreshing=false;renderMonitoringControls();if(monitoringContextCurrent(context)){await loadMonitoringServerState(true);if(failure&&monitoringContextCurrent(context))$("monitoring-status").textContent=failure;}}}
}
async function markMonitoringAlertRead(id){const context=captureMonitoringContext();try{await monitoringApi(`/api/market-monitoring/alerts/${encodeURIComponent(id)}`,{method:'PATCH',body:JSON.stringify({status:'read'})},context);if(monitoringContextCurrent(context))await loadMonitoringServerState(true);}catch(error){if(monitoringContextCurrent(context))showToast(error.message);}}
function renderMarketStrategy(){
  renderResearchReports();
  if(!state.profile)return;
  // Display saved Strategy as-is. Preparation and prerequisite enforcement run
  // on explicit edits, approval and research commands, never on page viewing.
  const conflicts=globalThis.LeadIntelCompanyBrain?.strategyConflicts?.(state.profile,state.market.signals)||[];
  const roleIssues=globalThis.LeadIntelCompanyBrain?.unrelatedBuyerRoles?.(state.profile,state.market.icps)||[];
  if(roleIssues.length)conflicts.push({message:"Buyer roles need review: some selected functions do not match the active offer. Review the suggested buyer functions before approval."});
  const note=$("strategy-conflict-note");if(note){note.hidden=!conflicts.length;note.textContent=conflicts.map(item=>item.message).join(" ");}
  $("strategy-company-name").textContent=state.profile.companyName||"Company";
  const marketSummary=LeadIntelMarket.splitList(state.profile.targetMarkets).join(" · ")||LeadIntelMarket.splitList(state.profile.currentMarkets).join(" · ")||"Provisional market";
  $("strategy-market-summary").textContent=marketSummary;
  $("strategy-signal-count").textContent=String(state.market.signals.filter(item=>item.active).length);
  const researchSummary=$("strategy-research-handoff"),sources=state.market.researchResults||[];
  if(researchSummary){researchSummary.hidden=!sources.length;researchSummary.textContent=`${sources.length} research sources · ${sources.filter(item=>item.extractedAt).length} pages read. Opportunity-led switches on when completed research finds usable opportunity evidence. Review your profiles and signals, then continue to Companies.`;}

  $("strategy-status").textContent=state.market.strategyApproved?"Active":state.approved?"Draft":"Provisional";$("strategy-status").classList.toggle("approved",state.market.strategyApproved);
  $("strategy-activation-card").classList.toggle("approved",state.market.strategyApproved);
  if(state.market.strategyApprovalInvalidated&&$("activate-market-strategy")?.dataset.activationBusy!=='true')setActivationFeedback(state.market.strategyApprovalInvalidated.reason,'warning');
  renderStrategyRecovery();
  renderIcps();renderSignalDesigner();renderResearchControls();renderResearchStatus();renderResearchHistory();renderMarketConditions();renderMarketOpportunities();renderMonitoringControls();renderMarketJourney();loadMonitoringServerState();
}
let researchReportUi;
function renderResearchReports(){
  if(!globalThis.LeadIntelResearchReport)return;
  // Viewing research must not create an extra stored report copy.
  researchReportUi ||= globalThis.LeadIntelResearchReport.install({getState:()=>state,save:saveState,onStrategy:()=>window.dispatchEvent(new CustomEvent('leadintel:open-market-strategy'))});
  researchReportUi.render();
}
function setActivationFeedback(message,tone){
  const target=$("strategy-activation-feedback");
  if(!target)return;
  target.textContent=message||"";
  target.dataset.state=tone||"";
  target.hidden=!message;
}
window.LeadIntelPageProcedures={strategyBlockers:()=>state?strategyHandoffModel().blockers:["Workspace verification is still loading."]};
function strategyHandoffModel(){
  syncResearchContextStale();
  const earlierResearch=state.market.researchContextStale===true;
  const icps=(state.market.icps||[]).filter(item=>item.active&&(!earlierResearch||item.type!=='opportunity-led'&&item.id!=='icp-opportunity-led'));
  const signals=(state.market.signals||[]).filter(item=>item.active);
  const opportunities=earlierResearch?[]:(state.market.opportunities||[]).filter(item=>item.active);
  const savedEvidence=state.market.researchResults||[],evidence=earlierResearch?[]:savedEvidence;
  const monitoring=LeadIntelMarket.normalizeMonitoring(state.market.monitoring);
  const sources=state.market.researchSourceStatus||{};
  const lowSignalCoverage=signals.length>0&&signals.length<3;
  const lowEvidenceCoverage=evidence.length>0&&evidence.length<3;
  const incompleteResearch=state.market.researchStatus==="partial"||Object.values(sources).some(value=>["partial","error","unavailable"].includes(value));
  const blockers=[];
  const unrelated=globalThis.LeadIntelCompanyBrain?.unrelatedSignals?.(state.profile||{},signals)||[];
  if(unrelated.length)blockers.push(`These buying signals do not match the Step 1 company's approved offer: ${unrelated.map(item=>item.name).join(", ")}. Review signals and rerun market research before finding companies.`);
  const unrelatedRoles=globalThis.LeadIntelCompanyBrain?.unrelatedBuyerRoles?.(state.profile||{},icps)||[];
  if(unrelatedRoles.length)blockers.push("Buyer roles include sales or HR roles for an industrial project offer. Use industrial buyer roles below to replace them with project, operations, production, engineering, procurement and owner roles. Your saved research will remain available.");
  if(!icps.length)blockers.push(earlierResearch?"Activate a customer profile that uses your current Profile, or update market research for the Opportunity-led profile.":"No active ICP");
  if(!signals.length)blockers.push("No active buying signal — required before companies can be ranked for purchase intent.");
  const conflicts=globalThis.LeadIntelCompanyBrain?.strategyConflicts?.(state.profile,signals)||[];
  blockers.push(...conflicts.filter(item=>item.blocking).map(item=>item.message));
  const warnings=conflicts.filter(item=>!item.blocking).map(item=>item.message);
  if(earlierResearch)warnings.push(`${savedEvidence.length} earlier research source${savedEvidence.length===1?' is':'s are'} saved in Profile. This approval uses your current Profile and signals. Earlier research and Opportunity-led matching are excluded until market research is updated.`);
  else if(!evidence.length)warnings.push("Market research is optional. Company searches use your customer definition, offers, markets and signals.");
  if(signals.length===1)warnings.push("Only one active buying signal. Companies can be found, but ranking will be narrow. At least 3 active signals are recommended.");
  else if(signals.length===2)warnings.push("Only 2 active buying signals. Companies can be found, but at least 3 active signals are recommended.");
  if(lowEvidenceCoverage)warnings.push("Fewer than 3 evidence sources were saved. Discovery confidence may be limited.");
  if(incompleteResearch&&!earlierResearch)warnings.push(`Some research checks were unavailable; your ${evidence.length} saved sources will still be used.`);
  if(!monitoring.enabled&&!earlierResearch)warnings.push("Monitoring is off (optional). To enable scheduled checks once Strategy is active, go to Step 2 → Profile → Website Scanning → Monitor websites. Choose websites, buying signals and frequency, tick Enable monitoring, then click Save and close. Scheduled checks use your connected provider credits.");
  const providerStatus=globalThis.LeadIntelAttention?.providerStatus?.()||null;const providerConnected=provider=>Boolean(globalThis.LeadIntelAttentionModel?.providerConnected?.(providerStatus,provider));
  if(providerStatus){
    if(!providerConnected("apollo"))warnings.push("Apollo is not connected. Buyer identities will come from public sources only; connect Apollo in Settings for decision-maker search.");
    if(!providerConnected("openai")&&!providerConnected("anthropic")&&!providerConnected("gemini"))warnings.push("No AI research provider is connected. Company discovery will rely on Firecrawl search only.");
  }
  const customSources=state.market.researchCustomSources||[];
  if(customSources.length&&!monitoring.customSources?.length)warnings.push("Preferred research sources are saved but are not included in monitoring.");
  const actions=[];
  if(signals.length<3||unrelated.length)actions.push("review-signals","retry-signals");
  if(unrelatedRoles.length)actions.push("repair-buyer-roles");
  const searchPlan=globalThis.LeadIntelDiscoveryUI?.companySearchPlan?.();
  return {
    blockers,warnings,actions,earlierResearch,
    hasLimitedResults:lowSignalCoverage||lowEvidenceCoverage||incompleteResearch,
    summary:[
      ["Your company (Step 1)",[state.profile?.companyName,state.website].filter(Boolean).join(" · ")||"Not set"],
      ["Approved offer",state.profile?.priorityOffers||"Not set"],
      ["Active ICPs",icps.map(item=>item.name||item.description).filter(Boolean).join(" · ")||"None"],
      ["Buying signals",signals.map(item=>item.name).filter(Boolean).join(" · ")||"None"],
      ["Market opportunities",opportunities.map(item=>item.market).filter(Boolean).join(" · ")||"None"],
      ["Evidence",evidence.length+" saved source"+(evidence.length===1?"":"s")],
      ["Monitoring",monitoring.enabled?(monitoring.frequency+" · minimum score "+monitoring.minimumScore):"Off (optional) · Set up: Step 2 → Profile → Website Scanning → Monitor websites"],
      ["Company search","Approval opens Companies without starting research."],
      ["Next",searchPlan?`Choose when to search in Companies. Your saved target is ${searchPlan.targetCount} companies with a limit of ${searchPlan.callLimit} Firecrawl calls. You can adjust both before searching.`:"Choose your search settings in Companies and start when ready."]
    ]
  };
}
function renderStrategyHandoff(){
  const model=strategyHandoffModel();
  const monitoring=monitoringApprovalCurrent(),dialog=$("strategy-handoff-dialog");
  dialog.dataset.destination=monitoring?"monitoring":"companies";
  dialog.dataset.researchBasis=model.earlierResearch?'profile':'research';
  $("strategy-handoff-title").textContent=monitoring?"Review Strategy for website monitoring":"Review before finding companies";
  $("strategy-handoff-purpose").textContent=monitoring?"Review the strategy that will guide monitoring. This approval returns to your saved setup; enabling a schedule is a separate action.":"Confirm exactly what LeadIntel will use to find and rank companies.";
  $("strategy-handoff-eyebrow").textContent=monitoring?"Monitoring review":"Companies review";
  if(monitoring){model.summary=model.summary.filter(([label])=>label!=="Company search").map(([label,value])=>[label,label==="Next"?"Approve Strategy and return to monitoring. No research starts with this approval. Choose Run monitoring now or explicitly enable the saved schedule afterward.":value]);model.warnings=model.warnings.filter(text=>!text.startsWith("Monitoring is off (optional)."));}
  $("strategy-handoff-summary").innerHTML=model.summary.map(([label,value])=>`<div><span>${esc(label)}</span><strong>${esc(value)}</strong></div>`).join("");
  const renderNotice=(id,items)=>{const node=$(id);node.hidden=!items.length;node.querySelector("ul").innerHTML=items.map(item=>`<li>${esc(item)}</li>`).join("");};
  renderNotice("strategy-handoff-blockers",model.blockers);
  renderNotice("strategy-handoff-warnings",model.warnings);
  const repairActions=$("strategy-handoff-repair-actions");
  const reviewSignals=$("review-buying-signals");
  const retrySignals=$("retry-signal-recommendations");
  const repairRoles=$("repair-buyer-roles");
  reviewSignals.hidden=!model.actions.includes("review-signals");
  retrySignals.hidden=!model.actions.includes("retry-signals");
  repairRoles.hidden=!model.actions.includes("repair-buyer-roles");
  repairActions.hidden=reviewSignals.hidden&&retrySignals.hidden&&repairRoles.hidden;
  const confirm=$("confirm-strategy-handoff");
  const back=$("cancel-strategy-handoff");
  if(back)back.textContent=monitoring?"Back to monitoring":"Back to Strategy";
  const update=$("update-strategy-research");
  if(update)update.hidden=monitoring||!model.earlierResearch;
  confirm.disabled=Boolean(model.blockers.length);
  confirm.textContent=model.blockers.length?"Complete Required Items":monitoring?"Approve Strategy & return to monitoring":"Approve Strategy and open Companies";
  return model;
}
function reviewBuyingSignalsFromHandoff(){
  closeStrategyHandoff();
  const target=$("signal-designer");
  target?.scrollIntoView({behavior:"smooth",block:"center"});
  target?.querySelector('[data-signal-field="active"]')?.focus();
}
async function repairBuyerRolesFromHandoff(){
  const repair=globalThis.LeadIntelCompanyBrain?.repairIndustrialBuyerRoles;
  if(!repair){showToast("Refresh this page to load the buyer-role repair, then try again.");return;}
  state=repair(state);
  saveState();renderProfile();renderMarketStrategy();renderStrategyHandoff();
  const saved=await window.LeadIntelWorkspacePersistence?.saveWorkspace?.();
  if(!saved)showToast("Buyer roles changed. LeadIntel is saving automatically; check the workspace status before leaving.");
}
function retrySignalRecommendationsFromHandoff(){
  const regenerated=globalThis.LeadIntelCompanyBrain?.recommendSignals?.({profile:state.profile||{},answers:state.answers||{}})||[];
  const candidates=[...regenerated,...(state.profile?.recommendedSignals||[]).filter(item=>item.id?.startsWith('custom-'))];
  const unique=[];const seen=new Set();
  for(const signal of candidates){const id=String(signal?.id||"").trim();if(!id||seen.has(id))continue;seen.add(id);unique.push(signal);if(unique.length===5)break;}
  state.profile.recommendedSignals=unique;
  state.market.signals=LeadIntelMarket.normalizeSignals(unique,state.market.signals,state.market.deletedSignalIds);
  state.market.strategyApproved=false;state.market.strategyApprovedAt="";
  saveState();renderMarketStrategy();renderStrategyHandoff();
  showToast(`${state.market.signals.length} buying signal recommendations are ready for review`);
}
function openStrategyHandoff(){
  if(!requireConfirmedTargeting())return false;
  // Reconcile independently saved fields before review. Persistence preserves
  // conflicting edits, so the dialog never approves an unreviewed merge.
  if(!strategyReviewCurrent()&&(saveState()===false||!strategyReviewCurrent())){
    showToast('The saved Strategy could not be synchronized. Review Workspace status and reopen Strategy.');
    return false;
  }
  renderMarketStrategy();
  const model=renderStrategyHandoff();
  const activeIcps=(state.market.icps||[]).some(x=>x.active!==false),activeSignals=(state.market.signals||[]).some(x=>x.active!==false);
  if(!activeIcps||!activeSignals){LeadIntelTargeting.focusControl(window,{step:4,selector:activeIcps?'[data-signal-field="active"]':'[data-icp-field="active"]',message:activeIcps?'Enable at least one buying signal before continuing.':'Enable at least one customer profile before continuing.'});return false;}
  const dialog=$("strategy-handoff-dialog");
  dialog.dataset.reviewedScope=strategyIntegrity().signature(state);
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
  const request={};window.__leadIntelPendingDiscoveryOpen=request;
  if(window.LeadIntelDiscoveryUI?.open)window.LeadIntelDiscoveryUI.open();
  else window.dispatchEvent(new CustomEvent("leadintel:open-discovery"));
  const opened=await waitForDiscoveryOpen();
  if(!opened&&window.__leadIntelPendingDiscoveryOpen!==request)return false;
  window.__leadIntelPendingDiscoveryOpen=!opened;
  return opened;
}
async function activateMarketStrategy(){
  if(!requireConfirmedTargeting())return false;
  const button=$("activate-market-strategy"),confirm=$("confirm-strategy-handoff");
  if(button?.dataset.activationBusy==="true")return false;
  const context=captureStrategyContext(),operation=window.LeadIntelReliabilityTrace?.begin('strategy_activation');let outcome='blocked',attemptedApproval=false,approvalSaved=false;
  const review=$("strategy-handoff-dialog"),reviewedBasis=review?.dataset.researchBasis;
  const monitoring=review?.dataset.destination==='monitoring',monitoringOwner=monitoring?monitoringApprovalContext:null;
  try{
    assertStrategyContext(context);
    if(monitoring&&!monitoringApprovalCurrent(monitoringOwner))throw Error('Monitoring review changed. Reopen monitoring before approving Strategy.');
    if(!strategyIntegrity())throw Error('Strategy verification is still loading. Retry in a moment.');
    if(window.LeadIntelServerBridge?.conflict)throw Error('Resolve the workspace synchronization conflict before activating Strategy.');
    if(!strategyReviewCurrent()||review?.dataset.reviewedScope&&review.dataset.reviewedScope!==context.signature){
      throw Error('Strategy changed in another view. Reopen and review the saved Strategy before activating.');
    }
    const model=strategyHandoffModel();
    if(model.blockers.length){renderStrategyHandoff();return false;}
    if(monitoring&&model.earlierResearch){returnToProfileResearch();return false;}
    const basis=model.earlierResearch?'profile':'research';
    if(reviewedBasis&&reviewedBasis!==basis){
      renderStrategyHandoff();
      showToast('Research status changed. Review the updated details and confirm again.');
      return false;
    }
    const approval=strategyIntegrity().approval(state,undefined,basis);
    if(!approval)throw Error(strategyIntegrity().requirements(state,basis)?.reason||'Complete and review Strategy before activation.');
    const pendingLabel=monitoring?"Saving Strategy…":"Opening Companies…";
    if(button){button.disabled=true;button.dataset.activationBusy="true";button.textContent=pendingLabel;}if(confirm){confirm.disabled=true;confirm.textContent=pendingLabel;}
    setActivationFeedback('Saving your reviewed Strategy…','running');
    attemptedApproval=true;delete state.market.strategyApprovalInvalidated;state.market.strategyApproval=approval;state.market.strategyApproved=true;state.market.strategyApprovedAt=approval.approvedAt;saveState();
    if(!strategyReviewCurrent()||!strategyIntegrity().status(JSON.parse(localStorage.getItem(STORAGE_KEY)||'{}')).current)throw Error('Strategy approval could not be saved locally. Your reviewed work is retained.');
    operation?.checkpoint('persistence','pending');await saveStrategyApproval(context);operation?.checkpoint('persistence','pass');assertStrategyContext(context);approvalSaved=true;
    if(monitoring){if(!monitoringApprovalCurrent(monitoringOwner))throw Error('Strategy saved. Monitoring navigation was canceled or changed.');const returned=returnToMonitoring(monitoringOwner);outcome=returned?'pass':'needs-navigation';if(returned)showToast('Strategy approved. Monitoring settings are ready; choose when to run.');return returned;}
    closeStrategyHandoff();const opened=await openDiscoveryAfterActivation();assertStrategyContext(context);
    if(!opened){setActivationFeedback('Companies did not open. Please try again.','error');showToast('Companies did not open. Please try again.');if(button){button.disabled=false;button.textContent='Try Companies Again →';}return false;}
    // Automatic flows run on the server. Opening Companies must never dispatch a second search.
    outcome='pass';
    setActivationFeedback('Strategy saved. Review your list or start a search in Companies.','success');
    showToast('Strategy approved. Companies opened.');
    return true;
  }catch(error){
    outcome=error.code==='STRATEGY_STALE'?'stale':'fail';
    if(strategyContextCurrent(context)){if(attemptedApproval&&!approvalSaved){state.market.strategyApproved=false;state.market.strategyApprovedAt='';try{if(strategyReviewCurrent())saveState();}catch{}}setActivationFeedback('Activation not confirmed · '+error.message,'error');showToast(error.message);}
    return false;
  }finally{operation?.finish(outcome);if(button){button.dataset.activationBusy='false';if(outcome!=='pass')button.disabled=false;}if(confirm){confirm.disabled=false;if(attemptedApproval&&!approvalSaved&&outcome!=='pass'&&strategyContextCurrent(context))confirm.textContent=monitoring?'Retry Strategy approval & return to monitoring':'Retry Strategy approval';}}
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
function protectedOriginalsForReset(){try{return JSON.parse(localStorage.getItem('leadintel_customer_v2_outreach')||'{}').messageStudio?.originalScripts||{};}catch{return {};}}
function retainResetOriginals(originalScripts){if(Object.keys(originalScripts).length)localStorage.setItem('leadintel_customer_v2_outreach',JSON.stringify({messageStudio:{originalScripts}}));}
function clearResetLocalKeys(keys=[]){const originals=protectedOriginalsForReset();keys.forEach(key=>localStorage.removeItem(key));if(keys.includes('leadintel_customer_v2_outreach'))retainResetOriginals(originals);}
async function resetWorkspace(){
  const protectedOriginals=protectedOriginalsForReset();
  window.LeadIntelWorkspaceResetHygiene?.prepareWorkspaceReset?.();
  await window.LeadIntelIntelligenceSources?.clearAll?.();
  const persistence=window.LeadIntelWorkspacePersistence;
  persistence?.clearExplicitSave?.();persistence?.clearWorkspaceData?.();
  window.LeadIntelWorkspaceResetHygiene?.clearBrowserWorkspaceResidue?.();
  state=defaultState();editMode=false;saveState();
  clearResetLocalKeys(["leadintel_customer_v2_discovery","leadintel_customer_v2_outreach","leadintel_customer_v2_delivery","leadintel_customer_v2_discovery_meta","leadintel_customer_v2_website_activation_v1","leadintel_customer_v2_research_meta_v1","leadintel_customer_v2_workspace_saved_snapshot_v1"]);
  retainResetOriginals(protectedOriginals);
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
      state.researchMeta={};const current=JSON.parse(localStorage.getItem(STORAGE_KEY)||'{}');current.researchMeta={};localStorage.setItem(STORAGE_KEY,JSON.stringify(current));
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
  $("download-strategy-recovery")?.addEventListener("click",downloadStrategyRecovery);
  window.addEventListener("leadintel:workspace-changed",acceptCanonicalProfileEdits);
  window.addEventListener("leadintel:workspace-changed",event=>{renderMonitoringApprovalGuide();if(event.detail?.source==="profile-approval")continueMonitoringApproval();});
  window.addEventListener("leadintel:module-opened",event=>{if(![2,3,4].includes(Number(event.detail?.step)))clearMonitoringApproval();else renderMonitoringApprovalGuide();});
  $("cancel-monitoring-approval").addEventListener("click",()=>returnToMonitoring());
  $("strategy-handoff-dialog").addEventListener("cancel",event=>{event.preventDefault();cancelStrategyHandoff();});
  $("company-website").addEventListener("input",()=>{
    // Website edits are proposals until verified activation commits the new company.
    // Keep the current profile, evidence and downstream work while the URL is edited.
    readSources();
  });
  $("company-website").addEventListener("change",readSources);
  // The optional Setup simplifier can remove this retired control before the
  // verified app starts. Keep binding activation and the remaining journey.
  $("additional-links")?.addEventListener("input",readSources);
  $("target-market-selector").addEventListener("click",e=>{
    const chip=e.target.closest("[data-target-market]");if(chip){toggleTargetMarket(chip.dataset.targetMarket);return;}
    const remove=e.target.closest("[data-remove-target-market]");if(remove){toggleTargetMarket(remove.dataset.removeTargetMarket);}
  });
  $("add-target-market").addEventListener("click",addCustomTargetMarket);
  $("target-country").addEventListener("keydown",e=>{if(e.key==="Enter"){e.preventDefault();addCustomTargetMarket();}});
  $("clear-target-markets").addEventListener("click",()=>setTargetMarkets([]));
  document.querySelectorAll("[data-question]").forEach(el=>{el.addEventListener("input",readAnswers);el.addEventListener("change",commitPendingAnswers);el.addEventListener("blur",commitPendingAnswers);});window.addEventListener("pagehide",commitPendingAnswers);
  $("confirm-targeting")?.addEventListener("click",confirmTargeting);
  document.querySelector(".steps")?.addEventListener("click",e=>{const marker=e.target.closest("[data-step-marker]");if(!marker)return;const journeyStage=Number(marker.dataset.workflowStage);if(journeyStage){window.LeadIntelJourney?.openWorkflowStage?.(journeyStage);return;}openModule(Number(marker.dataset.stepMarker));});
  $("to-questionnaire").addEventListener("click",()=>openModule(2));$("back-to-sources").addEventListener("click",()=>openModule(1));$("analyze-company").addEventListener("click",()=>analyzeCompany(3));
  $("pdf-input").addEventListener("change",e=>handlePdfFiles(e.target.files));
  $("document-list").addEventListener("click",e=>{const btn=e.target.closest("[data-remove-doc]");if(!btn)return;state.documents.splice(Number(btn.dataset.removeDoc),1);saveState();renderDocuments();});
  const zone=$("upload-zone");["dragenter","dragover"].forEach(ev=>zone.addEventListener(ev,e=>{e.preventDefault();zone.classList.add("dragging");}));["dragleave","drop"].forEach(ev=>zone.addEventListener(ev,e=>{e.preventDefault();zone.classList.remove("dragging");}));zone.addEventListener("drop",e=>handlePdfFiles(e.dataTransfer.files));
  $("edit-profile").addEventListener("click",toggleEdit);$("approve-profile").addEventListener("click",()=>approveProfile());$("continue-market-strategy").addEventListener("click",openMarketStrategy);$("recommended-signals").addEventListener("change",()=>{saveProfileEdits();seedMarketStrategy();saveState();updateApprovalUI();showToast("Profile changed · approve it again before continuing");});$("improve-profile")?.addEventListener("click",()=>openModule(2));
  $("back-to-profile").addEventListener("click",()=>openModule(3));
  $("add-custom-signal").addEventListener("click",addCustomSignal);$("run-market-research").addEventListener("click",()=>openResearchPreview("quick"));$("run-detailed-research").addEventListener("click",()=>openResearchPreview("deep"));$("run-market-intelligence").addEventListener("click",()=>openResearchPreview("intelligence"));$("confirm-market-research").addEventListener("click",confirmResearchPreview);document.addEventListener("keydown",handleResearchPreviewKeydown);$("cancel-market-research").addEventListener("click",closeResearchPreview);$("add-suggested-sources").addEventListener("click",addSuggestedSources);$("edit-research-settings").addEventListener("click",()=>{const settings=$("research-settings");settings.open=true;closeResearchPreview();settings.scrollIntoView({behavior:"smooth",block:"start"});});
  document.querySelectorAll("[data-minimize-research-window]").forEach(button=>button.addEventListener("click",minimizeResearchProgressWindow));
  const researchWindow=$("market-research-window");researchWindow?.addEventListener("cancel",event=>{event.preventDefault();minimizeResearchProgressWindow();});
  document.querySelector("[data-reopen-research-window]")?.addEventListener("click",reopenResearchProgressWindow);
  $("activate-market-strategy").addEventListener("click",event=>{
    event.preventDefault();
    clearMonitoringApproval();openStrategyHandoff();
  });$("update-strategy-research")?.addEventListener("click",returnToProfileResearch);$("cancel-strategy-handoff").addEventListener("click",cancelStrategyHandoff);$("confirm-strategy-handoff").addEventListener("click",()=>void activateMarketStrategy());$("strategy-handoff-dialog").addEventListener("click",event=>{if(event.target===$("strategy-handoff-dialog"))cancelStrategyHandoff();});$("toggle-monitoring-settings").addEventListener("click",()=>$("monitoring-settings").hidden?openMonitoringSettings():requestCloseMonitoringSettings());$("close-monitoring-settings").addEventListener("click",requestCloseMonitoringSettings);$("save-monitoring-close").addEventListener("click",saveMonitoringConfig);$("discard-monitoring-close").addEventListener("click",discardMonitoringEdits);$("keep-editing-monitoring").addEventListener("click",keepEditingMonitoring);$("monitoring-close-dialog").addEventListener("cancel",event=>{if(monitoringBusy)event.preventDefault();});window.addEventListener("leadintel:monitoring-opened",()=>{renderMonitoringControls();void loadMonitoringServerState(true);});$("monitoring-settings").addEventListener("input",updateMonitoringDisclosure);$("monitoring-settings").addEventListener("change",updateMonitoringDisclosure);$("monitoring-review-strategy").addEventListener("click",beginMonitoringApproval);$("monitoring-enabled").addEventListener("change",()=>void saveMonitoringConfig({closeAfterSave:false}));$("save-monitoring").addEventListener("click",saveMonitoringConfig);$("run-monitoring-now").addEventListener("click",runMonitoringNow);$("refresh-monitoring")?.addEventListener("click",()=>void loadMonitoringServerState(true));
  // Read saved progress only while this panel is visible. Never start research
  // or replace an unsaved form through a timer.
  setInterval(()=>{if(document.visibilityState==='hidden'||monitoringBusy||monitoringRefreshing||monitoringHasEdits()||!$("monitoring-settings")?.getClientRects().length)return;void loadMonitoringServerState(true);},60000);
  $("research-mode").addEventListener("change",()=>{state.market.researchMode=normalizeResearchMode($("research-mode").value);saveState();renderResearchControls();});$("research-source-types").addEventListener("change",()=>readResearchSettings(true));$("research-custom-sources").addEventListener("change",()=>{readResearchSettings();renderSavedResearchWebsites();});$("research-saved-websites")?.addEventListener("click",event=>{const button=event.target.closest("[data-remove-research-website]");if(button)removeSavedResearchWebsite(button.dataset.removeResearchWebsite);});$("research-instructions").addEventListener("change",readResearchSettings);
  $("review-buying-signals").addEventListener("click",reviewBuyingSignalsFromHandoff);
  $("repair-buyer-roles").addEventListener("click",()=>void repairBuyerRolesFromHandoff());
  $("retry-signal-recommendations").addEventListener("click",retrySignalRecommendationsFromHandoff);
  $("monitoring-alerts").addEventListener("click",event=>{const button=event.target.closest('[data-monitor-alert-read]');if(button)markMonitoringAlertRead(button.dataset.monitorAlertRead);});
  $("undo-remove-signal")?.addEventListener("click",undoRemoveSignal);
  $("signal-designer").addEventListener("click",e=>{const btn=e.target.closest("[data-remove-signal]");if(btn)removeSignal(Number(btn.dataset.removeSignal));});
  [$("icp-list"),$("market-opportunities")].forEach(container=>{container.addEventListener("change",event=>{
    const toggle=event.target.closest('[data-icp-field="active"]');
    const icp=toggle&&state.market.icps[Number(toggle.dataset.index)];
    if(icp&&toggle.checked&&!icpActivationRequirement(icp).available){requestIcpActivation(icp.id);return;}
    readMarketEdits();renderIcps();renderMarketOpportunities();renderMonitoringControls();
  });});
  $("icp-list").addEventListener("click",event=>{
    const button=event.target.closest("[data-icp-unlock]");if(!button)return;
    requestIcpActivation(button.dataset.icpId);
  });
  $("signal-designer").addEventListener("change",event=>{const toggle=event.target.closest('[data-signal-field="active"]');if(toggle?.checked){const requirement=LeadIntelMarket.strategyActivationRequirement(state,LeadIntelTargeting.isConfirmed(state));if(requirement){toggle.checked=false;pointToStrategyRequirement(requirement);return;}}readMarketEdits();renderIcps();renderSignalDesigner();renderResearchControls();renderMonitoringControls();});
  $("reset-workspace").addEventListener("click",openResetCenter);
  document.querySelectorAll("[data-close-reset-center]").forEach(node=>node.addEventListener("click",closeResetCenter));
  $("reset-new-company").addEventListener("click",resetCompanyWorkspace);
  $("reset-selected-sections").addEventListener("click",resetSelectedSections);
  $("factory-reset-confirmation").addEventListener("input",event=>{$("factory-reset-leadintel").disabled=event.target.value.trim()!=="RESET";resetCenterStatus("");});
  $("factory-reset-leadintel").addEventListener("click",factoryResetLeadIntel);
  window.addEventListener("leadintel:server-ready",()=>{void resumePendingMarketResearchAfterAuth();});
  window.addEventListener("leadintel:review-market-research",()=>{void window.LeadIntelProfileMarket?.open?.().then(()=>{if(state.profile)openResearchPreview("deep");});});
  window.addEventListener("leadintel:profile-market-opened",()=>{renderResearchReports();renderResearchControls();renderResearchStatus();renderMarketJourney();});
  document.addEventListener("click",event=>{if(event.target?.closest?.("[data-profile-review-edit]"))$("edit-profile")?.click();});
  let reviewingResearchProfile=false;
  window.addEventListener("leadintel:review-research-profile",async()=>{
    if(reviewingResearchProfile)return;reviewingResearchProfile=true;
    const context=profileApprovalContext();
    try{
      window.LeadIntelReferenceCustomerUI?.close?.();
      const opened=await analyzeCompany(3);if(!profileApprovalCurrent(context))return;
      if(!opened){if(!state.profile&&state.step!==3)setStep(2);return;}
      const sourceCount=state.market.researchResults?.length||0;
      if(sourceCount){state.market.researchProfileLink={linkedAt:new Date().toISOString(),evidenceDate:state.market.lastResearchAt||"",sourceCount};saveState();}
      renderProfile();document.getElementById('profile-company-name')?.scrollIntoView?.({block:'start'});
    }catch(error){if(profileApprovalCurrent(context))showToast(error.message||'Profile review could not open. Your saved work is retained.');}
    finally{reviewingResearchProfile=false;}
  });
  window.addEventListener("leadintel:open-market-strategy",()=>{if(!state.profile){showToast("Review your company profile first");return;}window.LeadIntelReferenceCustomerUI?.close?.();openMarketStrategy();});
  window.addEventListener("leadintel:website-draft-discarded",()=>{state=loadStateKeepingTypedAnswers();syncInputsFromState();});
  window.addEventListener("leadintel:website-activated",()=>{
    state=loadStateKeepingTypedAnswers();editMode=false;syncInputsFromState();updateCompleteness();
    $("analysis-state").hidden=true;$("profile-content").hidden=true;
    setStep(1);
  });
  window.addEventListener("leadintel:company-research-updated",()=>{
    state=loadStateKeepingTypedAnswers();editMode=false;syncInputsFromState();updateCompleteness();
    setStep(state.step||2);
  });
  window.addEventListener("leadintel:reference-customers-updated",()=>{
    state=loadStateKeepingTypedAnswers();
    if(Number(state.step)===4&&state.profile){ensureMarketStrategySeeded();renderMarketStrategy();}
  });
}
function init(){
  state=loadState();
  const startupWebsiteInput=window.LeadIntelWebsiteInputSync?.pendingWebsiteInput?.(true);
  window.LeadIntelStartupTrace?.('app state:complete');
  syncInputsFromState();bind();
  if(startupWebsiteInput!==undefined){$("company-website").value=startupWebsiteInput;readSources();}
  initBrandIdentity();updateCompleteness();updateNavigationAvailability();observeNavigation();
  window.LeadIntelStartupTrace?.('app bindings:complete');
  setStep(state.step||1);
  window.LeadIntelStartupTrace?.('app mount:complete');
  void resumePendingMarketResearchAfterAuth();
}
if(window.LeadIntelAccountCache)window.LeadIntelAccountCache.afterVerification(init);else init();
