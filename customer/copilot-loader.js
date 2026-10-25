const ENTRY_MARKUP='<svg class="copilot-mascot" viewBox="0 0 64 64" aria-hidden="true" focusable="false"><defs><radialGradient id="copilot-mascot-skin" cx="38%" cy="28%" r="80%"><stop offset="0" stop-color="#2f4a40"/><stop offset=".65" stop-color="#17302a"/><stop offset="1" stop-color="#0d1a16"/></radialGradient></defs><g class="copilot-mascot-body"><path class="copilot-mascot-hood" d="M32 7C16 7 9 22 9 36c0 13 10 21 23 21s23-8 23-21C55 22 48 7 32 7Z" fill="url(#copilot-mascot-skin)"/><path class="copilot-mascot-tip" d="M33 7c3-4 8-5 13-3-4 1-7 3-9 6" fill="none" stroke="#bc8f2a" stroke-width="2.2" stroke-linecap="round"/><ellipse class="copilot-mascot-face" cx="32" cy="39" rx="17" ry="13" fill="#0a1512"/><g class="copilot-eye copilot-eye-left"><ellipse cx="24.5" cy="39" rx="5.4" ry="6.8" fill="#f4f5f1"/><circle class="copilot-pupil" cx="24.5" cy="39.6" r="2.7" fill="#0a1512"/></g><g class="copilot-eye copilot-eye-right"><ellipse cx="39.5" cy="39" rx="5.4" ry="6.8" fill="#f4f5f1"/><circle class="copilot-pupil" cx="39.5" cy="39.6" r="2.7" fill="#0a1512"/></g><path class="copilot-mascot-spark" d="M50 12l1.3 3.2 3.2 1.3-3.2 1.3L50 21l-1.3-3.2-3.2-1.3 3.2-1.3Z" fill="#bc8f2a"/></g></svg><span class="copilot-entry-copy"><strong class="copilot-entry-title">Ask LeadIntel ✦</strong><small class="copilot-entry-subtitle">Business & Research</small></span><span class="copilot-entry-badge" data-copilot-badge aria-live="polite"></span><span class="copilot-entry-hint" id="leadintel-copilot-hint" role="tooltip" aria-hidden="true">Ask about your workspace, companies, markets, sales strategy or tools. LeadIntel can research public sources, explain findings and help you decide your next step.</span>';
function ensureEntryCss(){if(document.querySelector('link[data-leadintel-asset="copilot-css"]'))return;const link=document.createElement('link');link.rel='stylesheet';link.href='./copilot.css?v=20261025-mascot-v1';link.dataset.leadintelAsset='copilot-css';document.head.appendChild(link);}
function ensureEntry(){
  ensureEntryCss();let entry=document.getElementById('leadintel-copilot-entry');if(entry)return entry;const anchor=document.querySelector('.progress-panel .steps');if(!anchor)return null;
  entry=document.createElement('button');entry.type='button';entry.id='leadintel-copilot-entry';entry.className='leadintel-copilot-entry';entry.setAttribute('aria-haspopup','dialog');entry.setAttribute('aria-controls','leadintel-copilot-drawer');entry.setAttribute('aria-describedby','leadintel-copilot-hint');entry.innerHTML=ENTRY_MARKUP;anchor.after(entry);return entry;
}
function setStatus(message){const entry=ensureEntry();const badge=entry?.querySelector('[data-copilot-badge]');if(badge){badge.textContent=String(message||'').slice(0,80);badge.hidden=!badge.textContent;}}

// The mascot's pupils follow the pointer anywhere on the page. Offsets are capped so the pupil stays inside
// the eye (the eye is 5.4×6.8 units in a 64-unit box drawn at 48 px); pointer updates are coalesced per frame.
export function pupilOffset(pointer,eye,maxX=2.4,maxY=3.2){
  const dx=Number(pointer?.x)-Number(eye?.x),dy=Number(pointer?.y)-Number(eye?.y);
  if(!Number.isFinite(dx)||!Number.isFinite(dy)||(dx===0&&dy===0))return {x:0,y:0};
  const distance=Math.hypot(dx,dy),reach=Math.min(1,distance/160);
  return {x:Math.round(dx/distance*maxX*reach*100)/100,y:Math.round(dy/distance*maxY*reach*100)/100};
}
function bindMascot(entry){
  if(entry.dataset.copilotMascotBound==='1'||typeof entry.getBoundingClientRect!=='function')return;entry.dataset.copilotMascotBound='1';
  let pending=null;const schedule=typeof window.requestAnimationFrame==='function'?window.requestAnimationFrame.bind(window):fn=>window.setTimeout(fn,16);
  const apply=()=>{const pointer=pending;pending=null;if(!pointer)return;const box=entry.getBoundingClientRect();if(!box.width)return;const offset=pupilOffset(pointer,{x:box.left+box.width/2,y:box.top+box.height*0.58});entry.style.setProperty('--pupil-x',offset.x+'px');entry.style.setProperty('--pupil-y',offset.y+'px');};
  document.addEventListener('pointermove',event=>{const first=!pending;pending={x:event.clientX,y:event.clientY};if(first)schedule(apply);},{passive:true});
  document.addEventListener('pointerleave',()=>{pending=null;entry.style.setProperty('--pupil-x','0px');entry.style.setProperty('--pupil-y','0px');});
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
  loadModules:async()=>{const [api,context,ui]=await Promise.all([import('./copilot-api.js?v=20261011-business-research-v1'),import('./copilot-context.js?v=20260924-friendly-workflow-labels-v1'),import('./copilot-ui.js?v=20261011-business-research-v2')]);return {api,context,ui};},
  open:async({api,context,ui})=>{setStatus('');await ui.openCopilot?.({api,context});},
  onBusy:busy=>{const entry=ensureEntry();if(entry)entry.disabled=busy;},
  onError:cause=>{console.warn('Ask LeadIntel unavailable:',cause);setStatus('Copilot unavailable');}
});
export async function loadCopilot(){return openCopilot();}
function bind(){const entry=ensureEntry();if(!entry)return;bindMascot(entry);if(entry.dataset.copilotBound==='1')return;entry.dataset.copilotBound='1';entry.addEventListener('click',()=>{void loadCopilot();});}

if(typeof window!=='undefined'){window.LeadIntelCopilotLoader={loadCopilot};if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',bind,{once:true});else bind();}
