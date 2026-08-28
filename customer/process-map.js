import './state-budget.js?v=20260826-state-budget-500kb';
import './website-input-sync.js?v=20260826-website-sync-v1';
import './website-activation.js?v=20260826-website-activation-v2';
import './crm-engine.js?v=20260828-master-crm-v1';
import './server-bridge.js?v=20260828-master-crm-v1';
import './crm-ui.js?v=20260828-master-crm-v1';
import './ai-settings.js?v=20260824-ai-providers';
import './company-research-security.js?v=20260826-intelligence-autofill-v1';
import './company-research-ui.js?v=20260826-intelligence-autofill-v2';
import './company-profile-handoff.js?v=20260826-intelligence-autofill-v1';

const PROCESS_STORAGE_KEY="leadintel_customer_v2_state";
const processMap=document.getElementById("commercial-process-map");

function readProcessState(){try{return JSON.parse(localStorage.getItem(PROCESS_STORAGE_KEY)||"{}");}catch{return {};}}
function contextReady(){
  const state=readProcessState();
  const input=document.getElementById("company-website");
  const candidate=String(input?.value||state.website||"").trim();
  const websiteReady=Boolean(candidate&&candidate.replace(/^https?:\/\//,"").replace(/^www\./,"").includes("."));
  const activated=Boolean(websiteReady&&window.LeadIntelWebsiteActivation?.isCurrentWebsiteActive(candidate));
  const markets=Array.isArray(state.targetMarkets)?state.targetMarkets.filter(Boolean):[];
  return activated&&markets.length>0;
}
function currentProcessStep(){return Number(readProcessState().step)||1;}
function syncProcessMap(){
  if(!processMap)return;
  const current=currentProcessStep();const unlocked=contextReady();
  processMap.querySelectorAll("[data-process-step]").forEach(button=>{
    const step=Number(button.dataset.processStep);const available=step===1||unlocked;
    button.classList.toggle("available",available);button.classList.toggle("active",step===current);button.classList.toggle("complete",available&&step<current);
    button.setAttribute("aria-disabled",available?"false":"true");
    if(step===current)button.setAttribute("aria-current","step");else button.removeAttribute("aria-current");
  });
}
function openProcessStep(step,attempt=0){
  const target=Number(step)||1;
  if(target>1&&!contextReady()){document.querySelector('[data-step-marker="1"]')?.dispatchEvent(new MouseEvent("click",{bubbles:true}));syncProcessMap();return;}
  const marker=document.querySelector(`[data-step-marker="${target}"]`);
  if(marker){marker.dispatchEvent(new MouseEvent("click",{bubbles:true}));setTimeout(syncProcessMap,0);return;}
  if(attempt<20)setTimeout(()=>openProcessStep(target,attempt+1),100);
}
if(processMap){
  processMap.addEventListener("click",event=>{const button=event.target.closest("[data-process-step]");if(button)openProcessStep(button.dataset.processStep);});
  const steps=document.querySelector(".steps");if(steps&&typeof MutationObserver!=="undefined")new MutationObserver(syncProcessMap).observe(steps,{childList:true,subtree:true,attributes:true,attributeFilter:["class"]});
  document.getElementById("company-website")?.addEventListener("input",()=>setTimeout(syncProcessMap,0));
  document.getElementById("target-market-selector")?.addEventListener("click",()=>setTimeout(syncProcessMap,0));
  window.addEventListener("leadintel:website-synced",syncProcessMap);
  window.addEventListener("leadintel:website-activated",syncProcessMap);
  window.addEventListener("leadintel:module-opened",syncProcessMap);
  window.addEventListener("storage",event=>{if(event.key===PROCESS_STORAGE_KEY)syncProcessMap();});
  syncProcessMap();
}
