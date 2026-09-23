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
    state.profile=window.LeadIntelProfile.buildCompanyIntelligenceProfile({...state,scrapedSources:usable});state.approved=false;state.market={};state.step=[3,4].includes(Number(targetStep))?Number(targetStep):3;writeState(state);
    await window.LeadIntelServerBridge?.saveNow?.().catch(()=>null);toast('Profile built from researched evidence');setTimeout(()=>location.reload(),120);return true;
  }catch(error){toast(error.message||'Unable to build the intelligence profile');if(button){button.disabled=false;button.textContent='Build / refresh intelligence profile ✦';}return false;}
  finally{building=false;}
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
