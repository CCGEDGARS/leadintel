/*
 * Deferred dependency-order contract. shell-support-loader.js executes this
 * established order after window.load so none of these optional features can
 * block the journey shell. These import signatures remain documented because
 * release tests audit their versions and ordering.
 * import './workspace-reset-hygiene.js?v=20260917-task-reset-v1';
 * import './workspace-persistence.js?v=20260917-reset-clean-v1';
 * import './state-budget.js?v=20260826-state-budget-500kb';
 * import './website-input-sync.js?v=20260901-saved-state-v2';
 * import './custom-market-input-hygiene.js?v=20260903-password-manager-isolation-v5';
 * import './website-activation.js?v=20260916-ercon-context-v1';
 * import './crm-engine.js?v=20260828-master-crm-v1';
 * import './sync-conflict-hygiene.js?v=20260901-stale-blank-conflict-v1';
 * import './server-bridge.js?v=20260916-error-sweep-v2';
 * import './crm-ui.js?v=20260905-app-audit-v2';
 * import './ai-settings.js?v=20260915-model-choice-v1';
 * import './service-settings-extension.js?v=20260915-mail-choice-v2';
 * import './step2-readiness-engine.js?v=20260916-commercial-brief-v1';
 * import './content-language.js?v=20260916-latency-fix-v2';
 * import './content-variants.js?v=20260905-step1-language-v1';
 * import './business-identity.js?v=20260906-pain-headings-v1';
 * import './company-brain.js?v=20260909-step2-first-party-v1';
 * import './step2-first-party-intelligence.js?v=20260909-first-party-step2-v1';
 * import './firecrawl-workspace-router.js?v=20260914-spinner-hard-stop-v1';
 * import './linkedin-signals.js?v=20260907-public-index-v1';
 * import './company-research-security.js?v=20260916-latency-fix-v2';
 * import './company-research-ui.js?v=20260916-latency-fix-v2';
 * import './company-profile-handoff.js?v=20260826-intelligence-autofill-v1';
 * import './reference-customers.js?v=20260911-reference-missing-info-v1';
 * import './reference-customer-table-detection.js?v=20260911-reference-missing-info-v1';
 * import './reference-customer-smart-import.js?v=20260910-reference-smart-import-v3';
 * import './reference-customer-ai.js?v=20260911-invalid-json-recovery-v1';
 * import './reference-customer-ui.js?v=20260911-reference-missing-info-v1';
 * import './reference-customer-clear-list.js?v=20260909-reference-actions-v2';
 * import './reference-customer-website-enrichment.js?v=20260911-reference-missing-info-v1';
 * import './reference-customer-ai-runtime.js?v=20260911-reference-missing-info-v1';
 * import './reference-customer-launcher.js?v=20260911-reference-open-v2';
 * import './lookalike-discovery.js?v=20260910-reference-portfolio-v1';
 * import './intelligence-sources-ui.js?v=20260915-preferred-sources-v1';
 * import './profile-action-runtime.js?v=20260912-bottom-profile-actions-v1';
 * import './outreach-automation-loader.js?v=20260916-brand-outreach-v2';
 * import './copilot-loader.js?v=20260911-copilot-freshness-v1';
 */

const PROCESS_STORAGE_KEY="leadintel_customer_v2_state";
const DISCOVERY_STORAGE_KEY="leadintel_customer_v2_discovery";
const OUTREACH_STORAGE_KEY="leadintel_customer_v2_outreach";
const DELIVERY_STORAGE_KEY="leadintel_customer_v2_delivery";
const processMap=document.getElementById("commercial-process-map");

function readProcessState(){try{return JSON.parse(localStorage.getItem(PROCESS_STORAGE_KEY)||"{}");}catch{return {};}}
function ensureReferenceCustomerTool(){
  const step=document.getElementById("step-2");if(!step||step.querySelector("[data-reference-intelligence-card]"))return;
  const actions=step.querySelector(".step-actions");if(!actions)return;
  const card=document.createElement("section");card.className="panel";card.dataset.referenceIntelligenceCard="true";card.style.marginTop="16px";
  card.innerHTML='<div class="section-title"><span class="eyebrow">Optional advanced tool</span><h3>Reference Customer Intelligence</h3><p>Upload and analyze your best existing customers separately. LeadIntel can build Lookalike DNA for Discovery without mixing this with the Context questionnaire.</p></div><div style="margin-top:14px"><button class="secondary-btn" type="button" data-reference-customers-manage>Open Reference Customer Intelligence →</button></div>';
  actions.parentNode.insertBefore(card,actions);
}
function patchMarketLookalikeIsolation(){
  const market=window.LeadIntelMarket;if(!market||market.__salesMotionIsolationPatched||typeof market.buildIcpCandidates!=="function")return;
  const original=market.buildIcpCandidates.bind(market);
  market.buildIcpCandidates=function(profile={},...args){return original({...profile,lookalikeCustomers:""},...args);};
  market.__salesMotionIsolationPatched=true;
}
function syncContextArchitecture(){ensureReferenceCustomerTool();patchMarketLookalikeIsolation();}
function contextReady(){
  const state=readProcessState();
  const input=document.getElementById("company-website");
  const candidate=String(input?.value||state.website||"").trim();
  const websiteReady=Boolean(candidate&&candidate.replace(/^https?:\/\//,"").replace(/^www\./,"").includes("."));
  const activated=Boolean(websiteReady&&window.LeadIntelWebsiteActivation?.isCurrentWebsiteActive(candidate));
  const markets=Array.isArray(state.targetMarkets)?state.targetMarkets.filter(Boolean):[];
  return activated&&markets.length>0;
}
function readStageJson(key){
  try{
    const value=JSON.parse(localStorage.getItem(key)||"{}");
    return value&&typeof value==="object"&&!Array.isArray(value)?value:{};
  }catch{return {};}
}
function hasPipelineOpportunity(){
  const discovery=readStageJson("leadintel_customer_v2_discovery");
  return Array.isArray(discovery.pipeline)&&discovery.pipeline.length>0;
}
function hasOutreachContent(){
  const outreach=readStageJson("leadintel_customer_v2_outreach");
  return Array.isArray(outreach.items)&&outreach.items.some(item=>item&&(
    item.approved||item.dossier||item.email||item.linkedin||item.callOpener||item.followUp
  ));
}
function stageAvailability(){
  const state=readProcessState();
  window.LeadIntelWorkspaceIsolation?.reconcileLocalWorkspace?.(localStorage,state);
  const current=readProcessState();
  const ready=contextReady();
  const profile=Boolean(current.profile);
  const approved=Boolean(current.approved);
  const strategy=Boolean(current.market?.strategyApproved);
  const pipeline=hasPipelineOpportunity();
  const content=hasOutreachContent();
  return {
    1:true,
    2:ready,
    3:ready,
    4:ready&&profile&&approved,
    5:ready&&profile&&approved&&strategy,
    6:ready&&profile&&approved&&strategy&&pipeline,
    7:ready&&profile&&approved&&strategy&&pipeline&&content
  };
}
function currentProcessStep(){
  const state=readProcessState();
  return window.LeadIntelWorkspaceIsolation?.safeStep?.(localStorage,state,state.step)||Number(state.step)||1;
}
function readJourneyState(){
  return {
    main:readProcessState(),discovery:readStageJson(DISCOVERY_STORAGE_KEY),outreach:readStageJson(OUTREACH_STORAGE_KEY),delivery:readStageJson(DELIVERY_STORAGE_KEY)
  };
}
function websiteActivated(main){
  const candidate=String(document.getElementById("company-website")?.value||main.website||"").trim();
  return Boolean(candidate&&window.LeadIntelWebsiteActivation?.isCurrentWebsiteActive(candidate));
}
function journeyModel(availability,current){
  const state=readJourneyState();
  return window.LeadIntelJourneyProgress?.buildJourneyModel?.({...state,currentStep:current,availability,websiteActivated:websiteActivated(state.main)})||[];
}
const statusLabels={current:"In progress",complete:"Complete",available:"Available",locked:"Locked",skipped:"Skipped · optional"};
function renderStageGuide(stage){
  const guide=document.getElementById("journey-stage-guide");if(!guide||!stage)return;
  const kicker=guide.querySelector("[data-stage-guide-kicker]"),title=guide.querySelector("[data-stage-guide-title]"),progress=guide.querySelector("[data-stage-guide-progress]"),list=guide.querySelector("[data-stage-mini-steps]"),next=guide.querySelector("[data-stage-next-action]");
  if(kicker)kicker.textContent=`Stage ${stage.id} · ${statusLabels[stage.status]||"Available"}`;
  if(title)title.textContent=stage.name;
  if(progress)progress.textContent=`${stage.completed} of ${stage.total} steps`;
  if(next)next.textContent=stage.nextAction;
  if(!list)return;
  const nodes=stage.steps.map(item=>{const row=document.createElement("li");row.className=item.complete?"complete":"pending";const marker=document.createElement("span");marker.setAttribute("aria-hidden","true");marker.textContent=item.complete?"✓":"";const label=document.createElement("strong");label.textContent=item.label;row.append(marker,label);if(item.optional){const badge=document.createElement("em");badge.textContent="Optional";row.append(badge);}return row;});
  list.replaceChildren(...nodes);
}
function processToast(message){
  const toast=document.getElementById("toast");
  if(!toast)return;
  toast.textContent=message;toast.classList.add("show");
  clearTimeout(processToast.timer);processToast.timer=setTimeout(()=>toast.classList.remove("show"),2600);
}
function syncProcessMap(){
  if(!processMap)return;
  const availability=stageAvailability();const current=currentProcessStep();
  const model=journeyModel(availability,current);
  const visibleIds=window.LeadIntelJourneyProgress?.visibleStageIds?.(model)||[current];
  const currentStage=model.find(stage=>stage.id===current)||model[0];
  const completed=model.reduce((sum,stage)=>sum+stage.completed,0);
  const total=model.reduce((sum,stage)=>sum+stage.total,0);
  const position=processMap.querySelector('[data-journey-position]');
  const title=processMap.querySelector('[data-journey-title]');
  const overall=processMap.querySelector('[data-journey-overall]');
  const overallBar=processMap.querySelector('[data-journey-overall-bar]');
  if(position)position.textContent=`Stage ${current} of 7`;
  if(title&&currentStage)title.textContent=currentStage.name;
  if(overall)overall.textContent=`${completed} of ${total} steps complete`;
  if(overallBar)overallBar.style.setProperty('--journey-progress',`${total?Math.round(completed/total*100):0}%`);
  processMap.querySelectorAll("[data-process-step]").forEach(button=>{
    const step=Number(button.dataset.processStep);const available=Boolean(availability[step]);
    const stage=model.find(item=>item.id===step);const status=stage?.status||(step===current?"current":available?"available":"locked");
    button.classList.toggle("available",available);button.classList.toggle("active",status==="current");button.classList.toggle("complete",status==="complete");button.classList.toggle("skipped",status==="skipped");
    button.setAttribute("aria-disabled",available?"false":"true");
    if(step===current)button.setAttribute("aria-current","step");else button.removeAttribute("aria-current");
    const stateLabel=button.querySelector("[data-stage-state]"),progress=button.querySelector("[data-stage-progress]");
    if(stateLabel)stateLabel.textContent=statusLabels[status]||"Locked";
    if(progress&&stage)progress.textContent=`${stage.completed}/${stage.total}`;
  });
  document.querySelectorAll("[data-step-marker]").forEach(marker=>{
    const step=Number(marker.dataset.stepMarker),stage=model.find(item=>item.id===step);if(!stage)return;
    marker.hidden=!visibleIds.includes(step);
    marker.classList.toggle("available",stage.available);marker.classList.toggle("active",stage.status==="current");marker.classList.toggle("complete",stage.status==="complete");marker.classList.toggle("skipped",stage.status==="skipped");marker.setAttribute("aria-disabled",stage.available?"false":"true");
    if(stage.status==="current")marker.setAttribute("aria-current","step");else marker.removeAttribute("aria-current");
    const label=marker.querySelector("[data-sidebar-stage-state]");if(label)label.textContent=statusLabels[stage.status]||"Locked";
  });
  renderStageGuide(model.find(stage=>stage.id===current)||model[0]);
}
function openProcessStep(step,attempt=0){
  const target=Number(step)||1;
  const availability=stageAvailability();
  if(!availability[target]){
    const fallback=[...Array(Math.max(0,target-1)).keys()].map(value=>value+1).reverse().find(value=>availability[value])||1;
    const marker=document.querySelector(`[data-step-marker="${fallback}"]`);
    if(marker)marker.dispatchEvent(new MouseEvent("click",{bubbles:true}));
    const message=target===5?"Activate Market Strategy before opening Discovery.":target===6?"Save a company to Pipeline in Discovery before opening Campaign Studio.":target===7?"Build and approve campaign scripts before opening Delivery & Learning.":"Complete the previous stage before continuing.";
    processToast(message);syncProcessMap();return;
  }
  if(target===2)syncContextArchitecture();
  const marker=document.querySelector(`[data-step-marker="${target}"]`);
  if(marker){marker.dispatchEvent(new MouseEvent("click",{bubbles:true}));if(target===2)setTimeout(syncContextArchitecture,0);setTimeout(syncProcessMap,0);return;}
  if(attempt<20)setTimeout(()=>openProcessStep(target,attempt+1),100);
}
if(processMap){
  processMap.addEventListener("click",event=>{const button=event.target.closest("[data-process-step]");if(button)openProcessStep(button.dataset.processStep);});
  const steps=document.querySelector(".steps");
  steps?.addEventListener("keydown",event=>{const marker=event.target.closest("[data-step-marker]");if(!marker||!["Enter"," "].includes(event.key))return;event.preventDefault();openProcessStep(marker.dataset.stepMarker);});
  document.getElementById("company-website")?.addEventListener("input",()=>setTimeout(syncProcessMap,0));
  document.getElementById("target-market-selector")?.addEventListener("click",()=>setTimeout(syncProcessMap,0));
  window.addEventListener("leadintel:website-synced",syncProcessMap);
  window.addEventListener("leadintel:website-activated",syncProcessMap);
  window.addEventListener("leadintel:server-ready",()=>{syncContextArchitecture();syncProcessMap();});
  window.addEventListener("leadintel:workspace-changed",()=>{syncContextArchitecture();syncProcessMap();});
  window.addEventListener("leadintel:journey-changed",syncProcessMap);
  window.addEventListener("leadintel:crm-changed",syncProcessMap);
  window.addEventListener("leadintel:outreach-approved",syncProcessMap);
  window.addEventListener("leadintel:company-research-updated",syncProcessMap);
  window.addEventListener("leadintel:module-opened",event=>{const step=Number(event.detail?.step);if(step===2)syncContextArchitecture();syncProcessMap();});
  window.addEventListener("storage",event=>{if(event.key===PROCESS_STORAGE_KEY)syncProcessMap();});
  syncContextArchitecture();syncProcessMap();
  window.LeadIntelJourney={refresh:syncProcessMap,open:openProcessStep,getModel:()=>journeyModel(stageAvailability(),currentProcessStep())};
}
