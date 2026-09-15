import './workspace-reset-hygiene.js?v=20260916-brand-assets-v8';
import './workspace-persistence.js?v=20260916-brand-assets-v8';
import './state-budget.js?v=20260826-state-budget-500kb';
import './website-input-sync.js?v=20260901-saved-state-v2';
import './custom-market-input-hygiene.js?v=20260903-password-manager-isolation-v5';
import './website-activation.js?v=20260914-activation-timeout-v1';
import './crm-engine.js?v=20260828-master-crm-v1';
import './sync-conflict-hygiene.js?v=20260901-stale-blank-conflict-v1';
import './server-bridge.js?v=20260916-brand-assets-v8';
import './crm-ui.js?v=20260905-app-audit-v2';
import './ai-settings.js?v=20260915-model-choice-v1';
import './service-settings-extension.js?v=20260915-mail-choice-v2';
import './step2-readiness-engine.js?v=20260909-step2-readiness-v3';
import './content-language.js?v=20260906-step2-language-v1';
import './content-variants.js?v=20260905-step1-language-v1';
import './business-identity.js?v=20260906-pain-headings-v1';
import './company-brain.js?v=20260909-step2-first-party-v1';
import './step2-first-party-intelligence.js?v=20260909-first-party-step2-v1';
import './firecrawl-workspace-router.js?v=20260914-spinner-hard-stop-v1';
import './linkedin-signals.js?v=20260907-public-index-v1';
import './company-research-security.js?v=20260906-authoritative-depth-v1';
import './company-research-ui.js?v=20260915-step2-research-state-v1';
import './company-profile-handoff.js?v=20260826-intelligence-autofill-v1';
import './reference-customers.js?v=20260911-reference-missing-info-v1';
import './reference-customer-table-detection.js?v=20260911-reference-missing-info-v1';
import './reference-customer-smart-import.js?v=20260910-reference-smart-import-v3';
import './reference-customer-ai.js?v=20260911-invalid-json-recovery-v1';
import './reference-customer-ui.js?v=20260911-reference-missing-info-v1';
import './reference-customer-clear-list.js?v=20260909-reference-actions-v2';
import './reference-customer-website-enrichment.js?v=20260911-reference-missing-info-v1';
import './reference-customer-ai-runtime.js?v=20260911-reference-missing-info-v1';
import './reference-customer-launcher.js?v=20260911-reference-open-v2';
import './lookalike-discovery.js?v=20260910-reference-portfolio-v1';
import './intelligence-sources-ui.js?v=20260915-preferred-sources-v1';
import './profile-action-runtime.js?v=20260912-bottom-profile-actions-v1';
import './outreach-automation-loader.js?v=20260916-brand-outreach-v2';
import './copilot-loader.js?v=20260911-copilot-freshness-v1';

const PROCESS_STORAGE_KEY="leadintel_customer_v2_state";
const processMap=document.getElementById("commercial-process-map");

function readProcessState(){try{return JSON.parse(localStorage.getItem(PROCESS_STORAGE_KEY)||"{}");}catch{return {};}}
function writeProcessState(state){localStorage.setItem(PROCESS_STORAGE_KEY,JSON.stringify(state));}

function syncSalesMotionValue(visible){
  const value=String(visible?.value||"").trim();
  const state=readProcessState();
  state.answers={...(state.answers||{}),sales_motion:value};
  state.answerStatus={...(state.answerStatus||{}),sales_motion:value?"user":"missing"};
  state.profile=null;state.approved=false;
  writeProcessState(state);
  renderSalesMotionFeedback(visible);
}
function renderSalesMotionFeedback(textarea){
  if(!textarea)return;
  const card=textarea.closest(".question-card");if(!card)return;
  let node=card.querySelector("[data-sales-motion-feedback]");
  if(!node){
    node=document.createElement("div");node.className="answer-feedback";node.dataset.salesMotionFeedback="true";textarea.insertAdjacentElement("afterend",node);
  }
  const enough=String(textarea.value||"").trim().length>=5;
  node.innerHTML=`<span class="answer-quality-state ${enough?'enough':'more'}">${enough?'Enough to continue ✓':'Needs your input'}</span><span class="answer-save-state local">Saved in this browser</span><small class="answer-quality-guidance">What’s enough: Describe the main route customers use to buy from you. One short sentence is enough.</small>`;
}
function configureSalesMotionQuestion03(){
  const grid=document.querySelector("#step-2 .question-grid");if(!grid)return null;
  let visible=grid.querySelector('[data-question="sales_motion"]');
  let card=visible?.closest(".question-card")||null;
  const legacy=grid.querySelector('[data-question="lookalike_customers"]');
  if(!card&&legacy){
    card=legacy.closest(".question-card");
    visible=legacy;
    visible.value="";
    legacy.dataset.question="sales_motion";
  }
  if(!card){
    card=document.createElement("article");card.className="question-card";card.dataset.contextQuestion="03";
    card.innerHTML='<span>03</span><label></label><textarea data-question="sales_motion" rows="3"></textarea>';
    visible=card.querySelector("textarea");
    const question04=grid.querySelector('[data-question="buyer_roles"]')?.closest(".question-card");
    if(question04)grid.insertBefore(card,question04);else grid.appendChild(card);
  }
  card.querySelectorAll('[data-answer-feedback="lookalike_customers"],.step2-reference-action').forEach(node=>node.remove());
  card.dataset.contextQuestion="03";card.hidden=false;card.removeAttribute("aria-hidden");card.style.removeProperty("display");card.style.removeProperty("visibility");card.style.removeProperty("opacity");
  const number=card.querySelector(":scope > span");if(number)number.textContent="03";
  let label=card.querySelector("label");if(!label){label=document.createElement("label");card.insertBefore(label,visible);}
  label.innerHTML='How do customers typically buy from you?<small>Describe your normal sales motion: direct sales, inbound leads, outbound prospecting, partners, distributors, referrals, online sales, account management, or another route.</small>';
  visible.dataset.question="sales_motion";
  visible.placeholder="Mostly direct B2B sales through outbound prospecting and referrals, followed by a consultation and tailored proposal.";
  visible.rows=3;
  const state=readProcessState();const saved=String(state.answers?.sales_motion||"");
  if(!visible.value&&saved)visible.value=saved;
  if(!visible.dataset.salesMotionBound){visible.dataset.salesMotionBound="true";visible.addEventListener("input",()=>syncSalesMotionValue(visible));}
  const question04=grid.querySelector('[data-question="buyer_roles"]')?.closest(".question-card");if(question04&&card.nextElementSibling!==question04)grid.insertBefore(card,question04);
  renderSalesMotionFeedback(visible);
  return card;
}
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
function relabelSalesMotionProfile(){
  const textarea=document.getElementById("profile-lookalikeCustomers");if(!textarea)return;
  const field=textarea.closest(".profile-field");const label=field?.querySelector("label");if(label)label.textContent="Sales motion";
}
function syncContextArchitecture(){configureSalesMotionQuestion03();ensureReferenceCustomerTool();patchMarketLookalikeIsolation();}
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
function processToast(message){
  const toast=document.getElementById("toast");
  if(!toast)return;
  toast.textContent=message;toast.classList.add("show");
  clearTimeout(processToast.timer);processToast.timer=setTimeout(()=>toast.classList.remove("show"),2600);
}
function syncProcessMap(){
  if(!processMap)return;
  const availability=stageAvailability();const current=currentProcessStep();
  processMap.querySelectorAll("[data-process-step]").forEach(button=>{
    const step=Number(button.dataset.processStep);const available=Boolean(availability[step]);
    button.classList.toggle("available",available);button.classList.toggle("active",step===current);button.classList.toggle("complete",available&&step<current);
    button.setAttribute("aria-disabled",available?"false":"true");
    if(step===current)button.setAttribute("aria-current","step");else button.removeAttribute("aria-current");
  });
}
function openProcessStep(step,attempt=0){
  const target=Number(step)||1;
  const availability=stageAvailability();
  if(!availability[target]){
    const fallback=[...Array(Math.max(0,target-1)).keys()].map(value=>value+1).reverse().find(value=>availability[value])||1;
    const marker=document.querySelector(`[data-step-marker="${fallback}"]`);
    if(marker)marker.dispatchEvent(new MouseEvent("click",{bubbles:true}));
    const message=target===5?"Activate Market Strategy before opening Discovery.":target===6?"Save a company to Pipeline in Discovery before opening Content & Scripts.":target===7?"Build and approve outreach content before opening Delivery & Learning.":"Complete the previous stage before continuing.";
    processToast(message);syncProcessMap();return;
  }
  if(target===2)syncContextArchitecture();
  const marker=document.querySelector(`[data-step-marker="${target}"]`);
  if(marker){marker.dispatchEvent(new MouseEvent("click",{bubbles:true}));if(target===2)setTimeout(syncContextArchitecture,0);if(target===3)setTimeout(relabelSalesMotionProfile,0);setTimeout(syncProcessMap,0);return;}
  if(attempt<20)setTimeout(()=>openProcessStep(target,attempt+1),100);
}
if(processMap){
  processMap.addEventListener("click",event=>{const button=event.target.closest("[data-process-step]");if(button)openProcessStep(button.dataset.processStep);});
  const steps=document.querySelector(".steps");if(steps&&typeof MutationObserver!=="undefined")new MutationObserver(syncProcessMap).observe(steps,{childList:true,subtree:true,attributes:true,attributeFilter:["class"]});
  document.getElementById("company-website")?.addEventListener("input",()=>setTimeout(syncProcessMap,0));
  document.getElementById("target-market-selector")?.addEventListener("click",()=>setTimeout(syncProcessMap,0));
  window.addEventListener("leadintel:website-synced",syncProcessMap);
  window.addEventListener("leadintel:website-activated",syncProcessMap);
  window.addEventListener("leadintel:server-ready",()=>{syncContextArchitecture();syncProcessMap();});
  window.addEventListener("leadintel:workspace-changed",()=>{syncContextArchitecture();syncProcessMap();});
  window.addEventListener("leadintel:module-opened",event=>{const step=Number(event.detail?.step);if(step===2)syncContextArchitecture();if(step===3)setTimeout(relabelSalesMotionProfile,0);syncProcessMap();});
  window.addEventListener("storage",event=>{if(event.key===PROCESS_STORAGE_KEY)syncProcessMap();});
  syncContextArchitecture();syncProcessMap();
}
