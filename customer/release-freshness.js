(function(root){
'use strict';
const doc=root.document,loaded=doc?.querySelector('meta[name="leadintel-release"]')?.content;
const valid=value=>/^[a-f0-9]{40}$/.test(String(value||''));
let available='',checking=false,updating=false;
function notice(text='Update available. Save any open settings, then update to load the latest version.'){
  let panel=doc.getElementById('leadintel-release-notice');
  if(!panel){
    panel=doc.createElement('aside');panel.id='leadintel-release-notice';panel.setAttribute('role','status');panel.setAttribute('aria-live','polite');
    panel.style.cssText='position:fixed;bottom:20px;right:20px;z-index:10000;max-width:min(420px,calc(100vw - 40px));padding:16px;border:1px solid #277362;border-radius:12px;background:#fff;color:#182821;box-shadow:0 8px 30px #0002;display:flex;align-items:center;gap:12px;font:14px/1.5 sans-serif';
    const message=doc.createElement('span');message.dataset.releaseMessage='1';panel.appendChild(message);
    const button=doc.createElement('button');button.type='button';button.textContent='Update now';button.style.cssText='padding:10px 14px;border:0;border-radius:8px;background:#0d5d4f;color:white;cursor:pointer;white-space:nowrap';button.addEventListener('click',()=>void update());panel.appendChild(button);doc.body.appendChild(panel);
  }
  panel.querySelector('[data-release-message]').textContent=text;return panel;
}
async function check(){
  if(!valid(loaded)||checking||doc.visibilityState==='hidden')return false;
  checking=true;
  try{
    const url=new URL('/release.json',root.location.href);url.searchParams.set('check',String(Date.now()));
    const response=await root.fetch(url.href,{cache:'no-store',headers:{'Cache-Control':'no-cache'},signal:AbortSignal.timeout(10000)});
    if(!response.ok)return false;
    const release=await response.json();if(release.service!=='leadintel-customer'||!valid(release.commit))return false;
    available=release.commit===loaded?'':release.commit;
    if(available){notice();await updateWhenIdle();}else doc.getElementById('leadintel-release-notice')?.remove();
    return Boolean(available);
  }catch{return false;}finally{checking=false;}
}
async function updateWhenIdle(){
  const persistence=root.LeadIntelWorkspacePersistence,bridge=root.LeadIntelServerBridge;
  if(!available||updating||doc.visibilityState==='hidden'||!persistence?.hasUnsavedChanges||persistence.hasUnsavedChanges())return false;
  if(bridge&&(bridge.ready!==true||bridge.conflict||bridge.resolvingSync))return false;
  const focused=doc.activeElement;
  if(focused?.matches('input,textarea,select,[contenteditable="true"]'))return false;
  if(doc.querySelector('dialog[open],details#mw-settings[open],#mw-readiness[data-state="busy"]'))return false;
  if([...doc.querySelectorAll('[aria-busy="true"],[role="dialog"]')].some(element=>!element.closest('[hidden]')))return false;
  for(const id of ['mw-cancel-edit','mw-subject-cancel']){const control=doc.getElementById(id);if(control&&!control.hidden)return false;}
  return update();
}
async function update(){
  if(!available||updating)return false;
  updating=true;const panel=notice('Preparing update…'),button=panel.querySelector('button');button.disabled=true;
  try{
    const persistence=root.LeadIntelWorkspacePersistence;
    if(!persistence?.hasUnsavedChanges)throw Error('Workspace is still loading. Try Update now again in a moment.');
    if(persistence.hasUnsavedChanges()){
      notice('Saving your changes before updating…');
      if(!await persistence.saveWorkspace({automatic:true})||persistence.hasUnsavedChanges())throw Error('Save your changes before updating. They are still kept in this browser.');
    }
    const url=new URL(root.location.href);url.searchParams.set('release',available);root.location.assign(url.href);return true;
  }catch(error){notice(error.message||'Unable to update. Your changes are preserved.');return false;}finally{updating=false;button.disabled=false;}
}
root.LeadIntelReleaseFreshness={check,update};
if(doc&&valid(loaded)){
  root.addEventListener?.('focus',()=>void check());root.addEventListener?.('pageshow',()=>void check());root.addEventListener?.('leadintel:settings-opened',()=>void check());
  doc.addEventListener('visibilitychange',()=>{if(doc.visibilityState==='visible')void check();});
  root.addEventListener?.('leadintel:server-synced',()=>check());
  root.addEventListener?.('leadintel:server-ready',()=>check());
  root.setInterval?.(()=>void check(),60000);
  if(doc.readyState==='loading')doc.addEventListener('DOMContentLoaded',()=>void check(),{once:true});else void check();
}
})(typeof window!=='undefined'?window:globalThis);
