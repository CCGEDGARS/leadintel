const PROFILE_ACTION_STATE_KEY='leadintel_customer_v2_state';

(function installProfileActionRuntime(root){
  'use strict';
  if(typeof document==='undefined')return;

  function readState(){try{return JSON.parse(localStorage.getItem(PROFILE_ACTION_STATE_KEY)||'{}');}catch{return {};}}
  function setText(node,text){if(node&&node.textContent!==text)node.textContent=text;}
  function toggleClass(node,name,enabled){if(node&&node.classList.contains(name)!==enabled)node.classList.toggle(name,enabled);}

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
      setText(eyebrow,approved?'Next step':'Optional review');
      setText(heading,approved?'Continue to Market Strategy.':'Approve this profile when you want to lock the current interpretation.');
      setText(copy,approved?'This profile is approved and is now the operating context for Market Strategy and Discovery.':'Approval is optional. You can approve the profile now or continue reviewing it first.');
      if(nextButton){
        setText(nextButton,approved?'Continue to Market Strategy →':'Approve profile (optional)');
        if(nextButton.disabled)nextButton.disabled=false;
        if(nextButton.hasAttribute('aria-disabled'))nextButton.removeAttribute('aria-disabled');
      }
      toggleClass(card,'approved',approved);
    }
  }

  root.addEventListener('leadintel:module-opened',()=>setTimeout(syncApprovalControls,0));
  root.addEventListener('leadintel:server-ready',()=>setTimeout(syncApprovalControls,0));
  root.addEventListener('leadintel:workspace-changed',()=>setTimeout(syncApprovalControls,0));
  root.addEventListener('storage',event=>{if(event.key===PROFILE_ACTION_STATE_KEY)setTimeout(syncApprovalControls,0);});
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',syncApprovalControls,{once:true});else setTimeout(syncApprovalControls,0);

  root.LeadIntelProfileActionRuntime={syncApprovalControls};
})(globalThis);
