let loading=null;

function ensureEntry(){
  let entry=document.getElementById('leadintel-copilot-entry');if(entry)return entry;const metric=document.querySelector('.progress-metric');if(!metric)return null;
  entry=document.createElement('button');entry.type='button';entry.id='leadintel-copilot-entry';entry.className='leadintel-copilot-entry';entry.setAttribute('aria-haspopup','dialog');entry.innerHTML='<span>Ask LeadIntel ✦</span><small data-copilot-badge aria-live="polite"></small>';metric.after(entry);return entry;
}
function setStatus(message){const entry=ensureEntry();const badge=entry?.querySelector('[data-copilot-badge]');if(badge)badge.textContent=String(message||'').slice(0,80);}

export async function loadCopilot(){
  if(loading)return loading;const entry=ensureEntry();if(entry)entry.disabled=true;
  loading=(async()=>{try{
    const [api,context,ui]=await Promise.all([import('./copilot-api.js?v=20260908-copilot-v1'),import('./copilot-context.js?v=20260908-copilot-v1'),import('./copilot-ui.js?v=20260908-copilot-v1')]);setStatus('');await ui.openCopilot?.({api,context});return {api,context,ui};
  }catch(cause){console.warn('Ask LeadIntel unavailable:',cause);setStatus('Copilot unavailable');loading=null;return null;}finally{if(entry)entry.disabled=false;}})();return loading;
}
function bind(){const entry=ensureEntry();if(!entry||entry.dataset.copilotBound==='1')return;entry.dataset.copilotBound='1';entry.addEventListener('click',()=>{void loadCopilot();});}

if(typeof window!=='undefined'){window.LeadIntelCopilotLoader={loadCopilot};if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',bind,{once:true});else bind();}
