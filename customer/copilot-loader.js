let loading=null;

function ensureEntryCss(){if(document.querySelector('link[data-leadintel-asset="copilot-css"]'))return;const link=document.createElement('link');link.rel='stylesheet';link.href='./copilot.css?v=20260909-file-intelligence-v1';link.dataset.leadintelAsset='copilot-css';document.head.appendChild(link);}
function ensureEntry(){
  ensureEntryCss();let entry=document.getElementById('leadintel-copilot-entry');if(entry)return entry;const metric=document.querySelector('.progress-metric');if(!metric)return null;
  entry=document.createElement('button');entry.type='button';entry.id='leadintel-copilot-entry';entry.className='leadintel-copilot-entry';entry.setAttribute('aria-haspopup','dialog');entry.innerHTML='<span class="copilot-entry-copy"><strong class="copilot-entry-title">Ask LeadIntel ✦</strong><small class="copilot-entry-subtitle">AI Commercial Copilot</small></span><span class="copilot-entry-badge" data-copilot-badge aria-live="polite"></span>';metric.after(entry);return entry;
}
function setStatus(message){const entry=ensureEntry();const badge=entry?.querySelector('[data-copilot-badge]');if(badge){badge.textContent=String(message||'').slice(0,80);badge.hidden=!badge.textContent;}}

export async function loadCopilot(){
  if(loading)return loading;const entry=ensureEntry();if(entry)entry.disabled=true;
  loading=(async()=>{try{
    const [api,context,ui,fileIntelligence]=await Promise.all([import('./copilot-api.js?v=20260908-copilot-polish-v1'),import('./copilot-context.js?v=20260908-copilot-polish-v1'),import('./copilot-ui.js?v=20260911-copilot-freshness-v1'),import('./copilot-file-intelligence.js?v=20260909-customer-file-intelligence-v1')]);setStatus('');await ui.openCopilot?.({api,context});fileIntelligence.installCopilotFileIntelligence?.();return {api,context,ui,fileIntelligence};
  }catch(cause){console.warn('Ask LeadIntel unavailable:',cause);setStatus('Copilot unavailable');loading=null;return null;}finally{if(entry)entry.disabled=false;}})();return loading;
}
function bind(){const entry=ensureEntry();if(!entry||entry.dataset.copilotBound==='1')return;entry.dataset.copilotBound='1';entry.addEventListener('click',()=>{void loadCopilot();});}

if(typeof window!=='undefined'){window.LeadIntelCopilotLoader={loadCopilot};if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',bind,{once:true});else bind();}
