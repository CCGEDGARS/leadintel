import './ai-settings.js?v=20260824-ai-providers';

const PROCESS_STORAGE_KEY="leadintel_customer_v2_state";
const processMap=document.getElementById("commercial-process-map");

function readProcessState(){try{return JSON.parse(localStorage.getItem(PROCESS_STORAGE_KEY)||"{}");}catch{return {};}}
function websiteReady(){
  const state=readProcessState();
  const input=document.getElementById("company-website");
  const candidate=String(state.website||input?.value||"").trim();
  return Boolean(candidate&&candidate.replace(/^https?:\/\//,"").replace(/^www\./,"").includes("."));
}
function currentProcessStep(){return Number(readProcessState().step)||1;}
function syncProcessMap(){
  if(!processMap)return;
  const current=currentProcessStep();const unlocked=websiteReady();
  processMap.querySelectorAll("[data-process-step]").forEach(button=>{
    const step=Number(button.dataset.processStep);const available=step===1||unlocked;
    button.classList.toggle("available",available);button.classList.toggle("active",step===current);button.classList.toggle("complete",available&&step<current);
    button.setAttribute("aria-disabled",available?"false":"true");
    if(step===current)button.setAttribute("aria-current","step");else button.removeAttribute("aria-current");
  });
}
function openProcessStep(step,attempt=0){
  const target=Number(step)||1;
  if(target>1&&!websiteReady()){document.querySelector('[data-step-marker="1"]')?.dispatchEvent(new MouseEvent("click",{bubbles:true}));syncProcessMap();return;}
  const marker=document.querySelector(`[data-step-marker="${target}"]`);
  if(marker){marker.dispatchEvent(new MouseEvent("click",{bubbles:true}));setTimeout(syncProcessMap,0);return;}
  if(attempt<20)setTimeout(()=>openProcessStep(target,attempt+1),100);
}
if(processMap){
  processMap.addEventListener("click",event=>{const button=event.target.closest("[data-process-step]");if(button)openProcessStep(button.dataset.processStep);});
  const steps=document.querySelector(".steps");if(steps&&typeof MutationObserver!=="undefined")new MutationObserver(syncProcessMap).observe(steps,{childList:true,subtree:true,attributes:true,attributeFilter:["class"]});
  document.getElementById("company-website")?.addEventListener("input",()=>setTimeout(syncProcessMap,0));
  window.addEventListener("leadintel:module-opened",syncProcessMap);
  window.addEventListener("storage",event=>{if(event.key===PROCESS_STORAGE_KEY)syncProcessMap();});
  syncProcessMap();
}
