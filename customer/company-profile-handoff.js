const MAIN_STORAGE_KEY='leadintel_customer_v2_state';
let building=false;

function readState(){try{return JSON.parse(localStorage.getItem(MAIN_STORAGE_KEY)||'{}');}catch{return {};}}
function writeState(state){localStorage.setItem(MAIN_STORAGE_KEY,JSON.stringify(state));}
function hasResearchEvidence(state){return Array.isArray(state?.scrapedSources)&&state.scrapedSources.some(source=>String(source?.text||'').trim());}
function syncVisibleAnswers(state){
  const answers={...(state.answers||{})};document.querySelectorAll('[data-question]').forEach(textarea=>{answers[textarea.dataset.question]=String(textarea.value||'').trim();});state.answers=answers;return state;
}
function toast(message){const node=document.getElementById('toast');if(!node)return;node.textContent=message;node.classList.add('show');clearTimeout(toast.timer);toast.timer=setTimeout(()=>node.classList.remove('show'),2500);}

async function buildProfileFromResearch(targetStep=3){
  if(building)return false;const state=syncVisibleAnswers(readState());if(state.profile||!hasResearchEvidence(state)||!window.LeadIntelProfile?.buildCompanyIntelligenceProfile)return false;
  building=true;const button=document.getElementById('analyze-company');if(button){button.disabled=true;button.textContent='Building intelligence profile…';}
  try{
    const usable=state.scrapedSources.filter(source=>String(source?.text||'').trim());
    state.profile=window.LeadIntelProfile.buildCompanyIntelligenceProfile({...state,scrapedSources:usable});state.approved=false;state.market={};state.step=3;writeState(state);
    const account=localStorage.getItem('leadintel_account_context_v1'),workspaceId=window.LeadIntelServerBridge?.workspace?.id||'',snapshot=JSON.stringify(state);
    const current=()=>account===localStorage.getItem('leadintel_account_context_v1')&&workspaceId===(window.LeadIntelServerBridge?.workspace?.id||'')&&snapshot===JSON.stringify(readState())&&(!window.LeadIntelAccountCache||window.LeadIntelAccountCache.current());
    let timer;let saved;
    try{saved=await Promise.race([Promise.resolve(window.LeadIntelServerBridge?.saveNow?.()),new Promise((_,reject)=>{timer=setTimeout(()=>reject(new Error('Profile is safe in this browser, but workspace save timed out. Retry saving before continuing.')),10000);})]);}finally{clearTimeout(timer);}
    if(!current())return false;
    if(saved?.saved===false)throw new Error('Profile is safe in this browser, but workspace save did not complete. Resolve the save issue before continuing.');
    toast('Profile built from researched evidence');
    // Hand over in place: the app re-reads the saved state and opens the saved step (never force a page reload as an async research handoff).
    if(button){button.disabled=false;button.textContent='Build / refresh intelligence profile ✦';}
    window.dispatchEvent(new CustomEvent('leadintel:company-research-updated',{detail:{website:state.website,profileBuilt:true,step:state.step}}));return true;
  }catch(error){toast(error.message||'Unable to build the intelligence profile');if(button){button.disabled=false;button.textContent='Build / refresh intelligence profile ✦';}return false;}
  finally{building=false;if(button){button.disabled=false;button.textContent='Build / refresh intelligence profile ✦';}}
}

function interceptAnalyze(event){
  const state=readState();if(state.profile||!hasResearchEvidence(state))return;event.preventDefault();event.stopImmediatePropagation();buildProfileFromResearch(3);
}
function interceptStepMarker(event){
  const marker=event.target.closest('[data-step-marker]');if(!marker)return;const target=Number(marker.dataset.stepMarker);if(![3,4].includes(target))return;
  const state=readState();if(state.profile||!hasResearchEvidence(state))return;event.preventDefault();event.stopImmediatePropagation();buildProfileFromResearch(target);
}
function bind(){
  document.getElementById('analyze-company')?.addEventListener('click',interceptAnalyze,{capture:true});
  document.addEventListener('click',interceptStepMarker,{capture:true});
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',bind,{once:true});else bind();
