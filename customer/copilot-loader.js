const ENTRY_MARKUP='<span class="copilot-entry-copy"><strong class="copilot-entry-title">Ask LeadIntel</strong><small class="copilot-entry-subtitle">Business & Research</small></span><span class="copilot-entry-badge" data-copilot-badge aria-live="polite"></span>';
function ensureEntryCss(){if(document.querySelector('link[data-leadintel-asset="copilot-css"]'))return;const link=document.createElement('link');link.rel='stylesheet';link.href='./copilot.css?v=20261026-classic-v4&history=20261027-v2&memory=20261026-v1&attention=20261026-v1&gold-launcher=20261027-v1&header-controls=20261027-v1';link.dataset.leadintelAsset='copilot-css';document.head.appendChild(link);}
function ensureEntry(){
  ensureEntryCss();let entry=document.getElementById('leadintel-copilot-entry');if(entry)return entry;const anchor=document.querySelector('.progress-panel .steps');if(!anchor)return null;
  entry=document.createElement('button');entry.type='button';entry.id='leadintel-copilot-entry';entry.className='leadintel-copilot-entry primary-btn';entry.setAttribute('aria-haspopup','dialog');entry.setAttribute('aria-controls','leadintel-copilot-drawer');entry.innerHTML=ENTRY_MARKUP;anchor.after(entry);return entry;
}
// Attention badge (B4, 2026-10-25): once the workspace is ready, one cheap first-party call for the count of open important
// checks and reminders due. No context, no model, and a failure leaves the badge empty.
function setAttention(counts){
  const entry=ensureEntry();const badge=entry?.querySelector('[data-copilot-badge]');if(!badge)return;
  const important=Number(counts?.important)||0,reminders=Number(counts?.reminders_due)||0,total=Number(counts?.total)||important+reminders;
  if(total>0){badge.textContent=String(total);badge.title=`${important} important check${important===1?'':'s'} · ${reminders} reminder${reminders===1?'':'s'} due`;badge.hidden=false;}
  else{badge.textContent='';badge.removeAttribute('title');badge.hidden=true;}
}
async function refreshAttention(bridge){
  try{
    const session=bridge?.session||window.LeadIntelServerBridge?.session;const workspace=String(bridge?.workspace?.id||window.LeadIntelServerBridge?.workspace?.id||'');
    if(!session?.authenticated||!workspace||typeof window.fetch!=='function')return;
    const response=await window.fetch(`/api/copilot/attention?workspace_id=${encodeURIComponent(workspace)}`,{credentials:'include',cache:'no-store'});
    if(!response||response.status!==200){setAttention(null);return;}
    setAttention(await response.json());
  }catch{setAttention(null);}
}
if(typeof window!=='undefined')window.addEventListener('leadintel:server-ready',event=>{void refreshAttention(event?.detail);});
function setStatus(message){const entry=ensureEntry();const badge=entry?.querySelector('[data-copilot-badge]');if(badge){badge.textContent=String(message||'').slice(0,80);badge.hidden=!badge.textContent;}}

// Activity trail (B2, 2026-10-25): what the person does in the workspace, as event names with a step number and an
// optional entity id — never page text or form values. The assistant reads it through the screen context.
const STEP_LABELS={1:'Setup',2:'Profile',3:'Profile',4:'Strategy',5:'Companies',6:'Messages',7:'Delivery'};
const ACTIVITY_EVENTS={'leadintel:module-opened':'step','leadintel:workspace-changed':'edit','leadintel:server-synced':'sync','leadintel:company-research-updated':'research','leadintel:crm-changed':'crm','leadintel:website-activated':'website','leadintel:outreach-approved':'outreach','leadintel:outreach-sent':'outreach','leadintel:open-discovery':'discovery','leadintel:settings-opened':'settings'};
const trail=[];
function activeStep(){const active=document.querySelector('.step-view.active[data-step]');const step=Number(active?.dataset?.step);return step>=1&&step<=7?step:0;}
function recordActivity(kind,detail={}){
  const entry={at:new Date().toISOString(),kind};
  const step=Number(detail?.step)||activeStep();if(step>=1&&step<=7){entry.step=step;entry.label=STEP_LABELS[step];}
  const id=String(detail?.companyId||detail?.entityId||detail?.entity_id||'').slice(0,80);if(id){entry.entityType=String(detail?.entityType||detail?.entity_type||(detail?.companyId?'company':'')).slice(0,40)||'entity';entry.entityId=id;}
  const last=trail[trail.length-1];if(last&&last.kind===entry.kind&&last.step===entry.step&&last.entityId===entry.entityId&&Date.parse(entry.at)-Date.parse(last.at)<1500)return;
  trail.push(entry);while(trail.length>20)trail.shift();
}
function snapshotActivity(){return trail.map(item=>({...item}));}
if(typeof window!=='undefined'){
  window.LeadIntelCopilotActivity={record:recordActivity,snapshot:snapshotActivity};
  for(const [name,kind] of Object.entries(ACTIVITY_EVENTS))window.addEventListener(name,event=>{try{recordActivity(kind,event?.detail&&typeof event.detail==='object'?event.detail:{});}catch{}});
}

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
  loadModules:async()=>{const [api,context,ui]=await Promise.all([import('./copilot-api.js?v=20261011-business-research-v1&history=20261027-v2&memory=20261026-v1&streaming=20261026-v1'),import('./copilot-context.js?v=20260924-friendly-workflow-labels-v1&activity=20261026-v1'),import('./copilot-ui.js?v=20261011-business-research-v2&classic-button=20261026-v4&history=20261027-v2&memory=20261026-v1&attention=20261026-v1&gold-launcher=20261027-v1&header-controls=20261027-v1&streaming=20261026-v1')]);return {api,context,ui};},
  open:async({api,context,ui})=>{setStatus('');await ui.openCopilot?.({api,context});},
  onBusy:busy=>{const entry=ensureEntry();if(entry)entry.disabled=busy;},
  onError:cause=>{console.warn('Ask LeadIntel unavailable:',cause);setStatus('Copilot unavailable');}
});
export async function loadCopilot(){return openCopilot();}
function bind(){const entry=ensureEntry();if(!entry)return;if(entry.dataset.copilotBound==='1')return;entry.dataset.copilotBound='1';entry.addEventListener('click',()=>{void loadCopilot();});}

if(typeof window!=='undefined'){window.LeadIntelCopilotLoader={loadCopilot};if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',bind,{once:true});else bind();}
