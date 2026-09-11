const PROFILE_ACTION_STATE_KEY='leadintel_customer_v2_state';

(function installProfileActionRuntime(root){
  'use strict';
  if(typeof document==='undefined')return;

  function readState(){try{return JSON.parse(localStorage.getItem(PROFILE_ACTION_STATE_KEY)||'{}');}catch{return {};}}
  function writeState(state){localStorage.setItem(PROFILE_ACTION_STATE_KEY,JSON.stringify(state));}
  function toast(message){const node=document.getElementById('toast');if(!node)return;node.textContent=message;node.classList.add('show');clearTimeout(toast.t);toast.t=setTimeout(()=>node.classList.remove('show'),2600);}
  function setText(node,text){if(node&&node.textContent!==text)node.textContent=text;}
  function toggleClass(node,name,enabled){if(node&&node.classList.contains(name)!==enabled)node.classList.toggle(name,enabled);}

  function openMarketStrategy(){
    const processButton=document.querySelector('[data-process-step="4"]');
    if(processButton){processButton.dispatchEvent(new MouseEvent('click',{bubbles:true,cancelable:true}));return true;}
    const legacyMarker=document.querySelector('[data-step-marker="4"]');
    if(legacyMarker){legacyMarker.dispatchEvent(new MouseEvent('click',{bubbles:true,cancelable:true}));return true;}
    toast('Market Strategy could not open. Reload the workspace and try again.');
    return false;
  }

  function syncApprovalControls(){
    const approved=Boolean(readState().approved);
    const button=document.getElementById('approve-profile');
    if(button){
      const label=approved?'✓ Profile Approved':'Approve Profile';
      setText(button,label);
      if(button.disabled!==approved)button.disabled=approved;
      const ariaDisabled=approved?'true':'false';
      if(button.getAttribute('aria-disabled')!==ariaDisabled)button.setAttribute('aria-disabled',ariaDisabled);
      toggleClass(button,'approved',approved);
    }

    const status=document.getElementById('profile-status');
    if(status){setText(status,approved?'Approved':'Provisional');toggleClass(status,'approved',approved);}

    const card=document.getElementById('approval-card');
    if(card){
      if(card.hidden)card.hidden=false;
      const eyebrow=card.querySelector('.eyebrow');
      const heading=card.querySelector('h3');
      const copy=card.querySelector('p');
      const nextButton=document.getElementById('approve-profile-bottom');
      setText(eyebrow,'Next step');
      setText(heading,'Continue to Market Strategy.');
      if(approved)setText(copy,'This profile is approved and is now the operating context for Market Strategy and Discovery.');
      else setText(copy,'Approval is optional. You can approve the profile above now or continue and return later.');
      if(nextButton){
        setText(nextButton,'Next: Market Strategy →');
        if(nextButton.disabled)nextButton.disabled=false;
        if(nextButton.hasAttribute('aria-disabled'))nextButton.removeAttribute('aria-disabled');
      }
      toggleClass(card,'approved',approved);
    }
  }

  function persistApprovedState(){
    const state=readState();
    if(!state.profile)return false;
    const wasApproved=Boolean(state.approved);
    state.approved=true;
    state.profile={...state.profile,approvedAt:state.profile.approvedAt||new Date().toISOString()};
    writeState(state);
    if(root.LeadIntelWorkspacePersistence?.isExplicitlySaved?.())root.LeadIntelWorkspacePersistence.captureWorkspaceSnapshot?.();
    syncApprovalControls();
    root.dispatchEvent(new CustomEvent('leadintel:profile-approved',{detail:{approved:true,approvedAt:state.profile.approvedAt}}));
    return !wasApproved;
  }

  document.addEventListener('click',event=>{
    const approve=event.target?.closest?.('#approve-profile');
    if(approve){
      queueMicrotask(()=>{
        const primarySucceeded=Boolean(readState().approved);
        const repaired=persistApprovedState();
        if(repaired&&!primarySucceeded)toast('Profile approved');
      });
      return;
    }

    const next=event.target?.closest?.('#approve-profile-bottom');
    if(next){
      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation();
      openMarketStrategy();
    }
  },true);

  root.addEventListener('leadintel:module-opened',()=>setTimeout(syncApprovalControls,0));
  root.addEventListener('leadintel:profile-approved',()=>setTimeout(syncApprovalControls,0));
  root.addEventListener('storage',event=>{if(event.key===PROFILE_ACTION_STATE_KEY)setTimeout(syncApprovalControls,0);});
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',syncApprovalControls,{once:true});else setTimeout(syncApprovalControls,0);

  root.LeadIntelProfileActionRuntime={syncApprovalControls,persistApprovedState,openMarketStrategy};
})(globalThis);
