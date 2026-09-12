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
      const label=approved?'Continue to Market Strategy →':'Approve Profile';
      setText(button,label);
      if(button.disabled)button.disabled=false;
      const ariaDisabled='false';
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
      setText(eyebrow,approved?'Profile approved':'Profile approval');
      setText(heading,approved?'Your approved profile is ready for Market Strategy.':'Approve this profile before building Market Strategy.');
      setText(copy,approved?'LeadIntel will use this reviewed version to generate ICPs, buying signals and market opportunities.':'Review the interpretation above. Approval saves it as the current source of truth.');
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
