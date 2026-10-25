const ENTRY_MARKUP='<span class="copilot-entry-copy"><strong class="copilot-entry-title">Ask LeadIntel</strong><small class="copilot-entry-subtitle">Business & Research</small></span><span class="copilot-entry-badge" data-copilot-badge aria-live="polite"></span>';
function ensureEntryCss(){if(document.querySelector('link[data-leadintel-asset="copilot-css"]'))return;const link=document.createElement('link');link.rel='stylesheet';link.href='./copilot.css?v=20261026-classic-v2';link.dataset.leadintelAsset='copilot-css';document.head.appendChild(link);}
function ensureEntry(){
  ensureEntryCss();let entry=document.getElementById('leadintel-copilot-entry');if(entry)return entry;const anchor=document.querySelector('.progress-panel .steps');if(!anchor)return null;
  entry=document.createElement('button');entry.type='button';entry.id='leadintel-copilot-entry';entry.className='leadintel-copilot-entry primary-btn';entry.setAttribute('aria-haspopup','dialog');entry.setAttribute('aria-controls','leadintel-copilot-drawer');entry.innerHTML=ENTRY_MARKUP;anchor.after(entry);return entry;
}
function setStatus(message){const entry=ensureEntry();const badge=entry?.querySelector('[data-copilot-badge]');if(badge){badge.textContent=String(message||'').slice(0,80);badge.hidden=!badge.textContent;}}

export function createCopilotController({loadModules,open,onBusy=()=>{},onError=()=>{}}={}){
  let modulesPromise=null;
  return async function openCopilot(){
    onBusy(true);
    try{
      if(!modulesPromise)modulesPromise=Promise.resolve().then(loadModules).catch(cause=>{modulesPromise=null;throw cause;});
      const modules=await modulesPromise;
      await open(modules);
      return modules;
    }catch(cause){onError(cause);return null;}finally{onBusy(false);}
  };
}
const openCopilot=createCopilotController({
  loadModules:async()=>{const [api,context,ui]=await Promise.all([import('./copilot-api.js?v=20261011-business-research-v1'),import('./copilot-context.js?v=20260924-friendly-workflow-labels-v1'),import('./copilot-ui.js?v=20261011-business-research-v2&classic-button=20261026-v1')]);return {api,context,ui};},
  open:async({api,context,ui})=>{setStatus('');await ui.openCopilot?.({api,context});},
  onBusy:busy=>{const entry=ensureEntry();if(entry)entry.disabled=busy;},
  onError:cause=>{console.warn('Ask LeadIntel unavailable:',cause);setStatus('Copilot unavailable');}
});
export async function loadCopilot(){return openCopilot();}
function bind(){const entry=ensureEntry();if(!entry)return;if(entry.dataset.copilotBound==='1')return;entry.dataset.copilotBound='1';entry.addEventListener('click',()=>{void loadCopilot();});}

if(typeof window!=='undefined'){window.LeadIntelCopilotLoader={loadCopilot};if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',bind,{once:true});else bind();}
