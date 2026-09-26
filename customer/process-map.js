/*
 * Deferred dependency-order contract. shell-support-loader.js executes this
 * established order after window.load so none of these optional features can
 * block the journey shell. These import signatures remain documented because
 * release tests audit their versions and ordering.
 * import './workspace-reset-hygiene.js?v=20260917-task-reset-v1';
 * import './workspace-persistence.js?v=20260926-visible-save-v1';
 * import './state-budget.js?v=20260826-state-budget-500kb';
 * import './website-input-sync.js?v=20260901-saved-state-v2';
 * import './custom-market-input-hygiene.js?v=20260903-password-manager-isolation-v5';
 * import './website-activation.js?v=20260916-ercon-context-v1';
 * import './crm-engine.js?v=20260828-master-crm-v1';
 * import './sync-conflict-hygiene.js?v=20260901-stale-blank-conflict-v1';
 * import './server-bridge.js?v=20260925-apollo-buyer-search-v1';
 * import './crm-presentation.js?v=20260924-crm-evidence-activity-v1';
 * import './crm-ui.js?v=20260924-crm-evidence-activity-v1';
 * import './ai-settings.js?v=20260915-model-choice-v1';
 * import './service-settings-extension.js?v=20260925-provider-credit-health-v1';
 * import './step2-readiness-engine.js?v=20260924-friendly-workflow-labels-v1';
 * import './content-language.js?v=20260924-workspace-content-english-v1';
 * import './content-variants.js?v=20260921-contact-gated-v2';
 * import './business-identity.js?v=20260924-workspace-profile-english-v1';
 * import './company-brain.js?v=20260924-workspace-profile-english-v1';
 * import './step2-first-party-intelligence.js?v=20260909-first-party-step2-v1';
 * import './firecrawl-workspace-router.js?v=20260914-spinner-hard-stop-v1&adaptive-evidence=1';
 * import './linkedin-signals.js?v=20260907-public-index-v1';
 * import './company-research-security.js?v=20260918-translation-fidelity-v3';
 * import './company-research-ui.js?v=20260926-research-coverage-status-v1';
 * import './company-profile-handoff.js?v=20260826-intelligence-autofill-v1';
 * import './reference-customers.js?v=20260924-reference-consensus-v1';
 * import './reference-customer-table-detection.js?v=20260911-reference-missing-info-v1';
 * import './reference-customer-smart-import.js?v=20260923-reference-interface-v1';
 * import './reference-customer-ai.js?v=20260911-invalid-json-recovery-v1';
 * import './reference-customer-ui.js?v=20260924-reference-consensus-v1&opportunity-context=1';
 * import './reference-customer-clear-list.js?v=20260923-reference-interface-v1';
 * import './reference-customer-website-enrichment.js?v=20260923-reference-interface-v1';
 * import './reference-customer-ai-runtime.js?v=20260924-reference-consensus-v1';
 * import './reference-customer-launcher.js?v=20260924-reference-consensus-v1';
 * import './lookalike-discovery.js?v=20260924-reference-consensus-v1&opportunity-context=1';
 * import './intelligence-sources-ui.js?v=20260915-preferred-sources-v1';
 * import './profile-action-runtime.js?v=20260924-friendly-workflow-labels-v1';
 * import './outreach-automation-loader.js?v=20260916-brand-outreach-v2';
 * import './copilot-loader.js?v=20260911-copilot-freshness-v1';
 */

(()=>{
const PROCESS_STORAGE_KEY="leadintel_customer_v2_state";
const DISCOVERY_STORAGE_KEY="leadintel_customer_v2_discovery";
const OUTREACH_STORAGE_KEY="leadintel_customer_v2_outreach";
const DELIVERY_STORAGE_KEY="leadintel_customer_v2_delivery";
const processMap=document.getElementById("commercial-process-map");

function readProcessState(){try{return JSON.parse(localStorage.getItem(PROCESS_STORAGE_KEY)||"{}");}catch{return {};}}
function ensureReferenceCustomerTool(){
  const step=document.getElementById("step-2");if(!step||step.querySelector("[data-reference-intelligence-card]"))return;
  const actions=step.querySelector(".step-actions");if(!actions)return;
  const card=document.createElement("section");card.className="panel brand-identity-panel reference-customer-core-card";card.dataset.referenceIntelligenceCard="true";card.style.marginTop="16px";
  card.innerHTML='<div class="brand-identity-summary"><div class="brand-identity-intro"><span class="eyebrow">Customer and prospect intelligence</span><h3>Turn what you know into better B2B opportunities</h3><p class="reference-value-lead">Add customers who bought from you and companies you want to win. LeadIntel uses each list to focus research in your chosen market.</p><div class="reference-value-points"><div><strong>Top Customers</strong><span>Use past buyers to sharpen the picture of a good fit.</span></div><div><strong>Target Companies</strong><span>Research chosen prospects for fit and public demand signals, then prioritize evidence-backed opportunities.</span></div></div><p class="reference-value-note">Use either list or both. Adding a target alone does not qualify it as a lead.</p><span class="brand-identity-status">Evidence-backed priorities</span></div><button class="brand-identity-toggle lookalike-build-btn" type="button" data-reference-customers-manage><span>Add Customers</span><span aria-hidden="true">→</span></button></div>';
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
    main:readProcessState(),discovery:readStageJson(DISCOVERY_STORAGE_KEY),discoveryMeta:readStageJson(`${DISCOVERY_STORAGE_KEY}_meta`),outreach:readStageJson(OUTREACH_STORAGE_KEY),delivery:readStageJson(DELIVERY_STORAGE_KEY)
  };
}
function websiteActivated(main){
  const candidate=String(document.getElementById("company-website")?.value||main.website||"").trim();
  return Boolean(candidate&&window.LeadIntelWebsiteActivation?.isCurrentWebsiteActive(candidate));
}
function journeyModel(availability,current){
  const state=readJourneyState();
  const journeyFocus=state.discoveryMeta.activeJourneyStage===5?'buyers':'companies';
  return window.LeadIntelJourneyProgress?.buildJourneyModel?.({...state,currentStep:current,availability,journeyFocus,websiteActivated:websiteActivated(state.main)})||[];
}
const statusLabels={current:"In progress",complete:"Complete",available:"Available",locked:"Locked",skipped:"Skipped · optional"};
function stageStatusLabel(stage){return window.LeadIntelJourneyProgress?.stageStatusLabel?.(stage)||statusLabels[stage?.status]||"Available";}
function renderStageGuide(stage){
  const guide=document.getElementById("journey-stage-guide");if(!guide||!stage)return;
  const kicker=guide.querySelector("[data-stage-guide-kicker]"),title=guide.querySelector("[data-stage-guide-title]"),progress=guide.querySelector("[data-stage-guide-progress]"),list=guide.querySelector("[data-stage-mini-steps]"),next=guide.querySelector("[data-stage-next-action]");
  if(kicker)kicker.textContent=`Stage ${stage.id} · ${stageStatusLabel(stage)}`;
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
  const currentStage=model.find(stage=>stage.status==='current')||model[0];
  const completed=model.reduce((sum,stage)=>sum+stage.completed,0);
  const total=model.reduce((sum,stage)=>sum+stage.total,0);
  const position=processMap.querySelector('[data-journey-position]');
  const title=processMap.querySelector('[data-journey-title]');
  const overall=processMap.querySelector('[data-journey-overall]');
  const overallBar=processMap.querySelector('[data-journey-overall-bar]');
  if(position&&currentStage)position.textContent=`Stage ${currentStage.id} of 7`;
  if(title&&currentStage)title.textContent=currentStage.name;
  if(overall)overall.textContent=`${completed} of ${total} steps complete`;
  if(overallBar)overallBar.style.setProperty('--journey-progress',`${total?Math.round(completed/total*100):0}%`);
  processMap.querySelectorAll("[data-process-step]").forEach(button=>{
    const step=Number(button.dataset.processStep);const stage=model.find(item=>item.id===step);const available=Boolean(stage?.available);const status=stage?.status||(step===currentStage?.id?"current":available?"available":"locked");
    button.classList.toggle("available",available);button.classList.toggle("active",status==="current");button.classList.toggle("complete",status==="complete");button.classList.toggle("skipped",status==="skipped");
    button.setAttribute("aria-disabled",available||status==='current'?'false':'true');
    if(step===currentStage?.id)button.setAttribute("aria-current","step");else button.removeAttribute("aria-current");
    const stateLabel=button.querySelector("[data-stage-state]"),progress=button.querySelector("[data-stage-progress]");
    if(stateLabel)stateLabel.textContent=stageStatusLabel(stage);
    if(progress&&stage)progress.textContent=`${stage.completed}/${stage.total}`;
  });
  document.querySelectorAll("[data-workflow-stage]").forEach(marker=>{
    const step=Number(marker.dataset.workflowStage),stage=model.find(item=>item.id===step);if(!stage)return;
    marker.hidden=!visibleIds.includes(step);
    marker.classList.toggle("available",stage.available);marker.classList.toggle("active",stage.status==="current");marker.classList.toggle("complete",stage.status==="complete");marker.classList.toggle("skipped",stage.status==="skipped");marker.setAttribute("aria-disabled",stage.available?"false":"true");
    if(stage.status==="current")marker.setAttribute("aria-current","step");else marker.removeAttribute("aria-current");
    const label=marker.querySelector("[data-sidebar-stage-state]");if(label)label.textContent=stageStatusLabel(stage);
  });
  renderStageGuide(currentStage);
}
function openProcessStep(stageId){
  const target=Math.min(7,Math.max(1,Number(stageId)||1));
  const availability=stageAvailability();const current=currentProcessStep();const model=journeyModel(availability,current);const stage=model.find(item=>item.id===target);
  if(!stage?.available&&stage?.status!=='current'){
    const fallback=model.slice(0,target-1).reverse().find(item=>item.available||item.status==='current')?.id||1;
    openProcessStep(fallback);
    const messages={5:'Find a matching company first, then identify its buyers.',6:'Save a company and identify at least one buyer before preparing messages.',7:'Approve a message package before opening Delivery.'};
    processToast(messages[target]||'Complete the previous stage before continuing.');syncProcessMap();return;
  }
  const route=window.LeadIntelJourneyProgress?.routeForJourneyStage?.(target,readProcessState())||{moduleStep:target,focus:''};
  if(target===2)syncContextArchitecture();
  if([4,5].includes(target)){
    const focus=target===5?'buyers':'companies';
    if(window.LeadIntelDiscoveryUI?.open){window.LeadIntelDiscoveryUI.open({focus});setTimeout(syncProcessMap,0);return;}
    window.dispatchEvent(new CustomEvent('leadintel:open-discovery',{detail:{focus}}));setTimeout(syncProcessMap,0);return;
  }
  window.dispatchEvent(new CustomEvent('leadintel:open-module',{detail:{step:route.moduleStep,journeyStage:target}}));
  if(target===2)setTimeout(syncContextArchitecture,0);
  setTimeout(syncProcessMap,0);
}
if(processMap){
  processMap.addEventListener("click",event=>{const button=event.target.closest("[data-process-step]");if(button)openProcessStep(button.dataset.processStep);});
  const steps=document.querySelector(".steps");
  steps?.addEventListener("keydown",event=>{const marker=event.target.closest("[data-workflow-stage]");if(!marker||!["Enter"," "].includes(event.key))return;event.preventDefault();openProcessStep(marker.dataset.workflowStage);});
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
  window.addEventListener("leadintel:journey-focus-changed",syncProcessMap);
  window.addEventListener("storage",event=>{if(event.key===PROCESS_STORAGE_KEY)syncProcessMap();});
  syncContextArchitecture();syncProcessMap();
  window.LeadIntelJourney={refresh:syncProcessMap,open:openProcessStep,openWorkflowStage:openProcessStep,getModel:()=>journeyModel(stageAvailability(),currentProcessStep())};
}
})();
