const PROFILE_ACTION_STATE_KEY='leadintel_customer_v2_state';
const PROFILE_ACTION_VERSION='20260910-profile-next-step-v1';

(function installProfileActionRuntime(root){
  'use strict';
  if(typeof document==='undefined')return;

  function readState(){try{return JSON.parse(localStorage.getItem(PROFILE_ACTION_STATE_KEY)||'{}');}catch{return {};}}
  function toast(message){const node=document.getElementById('toast');if(!node)return;node.textContent=message;node.classList.add('show');clearTimeout(toast.t);toast.t=setTimeout(()=>node.classList.remove('show'),2600);}

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
      if(button.textContent!==label)button.textContent=label;
      if(button.disabled!==approved)button.disabled=approved;
      const ariaDisabled=approved?'true':'false';
      if(button.getAttribute('aria-disabled')!==ariaDisabled)button.setAttribute('aria-disabled',ariaDisabled);
      if(button.classList.contains('approved')!==approved)button.classList.toggle('approved',approved);
    }

    const card=document.getElementById('approval-card');
    if(card){
      card.hidden=false;
      const eyebrow=card.querySelector('.eyebrow');
      const heading=card.querySelector('h3');
      const copy=card.querySelector('p');
      const nextButton=document.getElementById('approve-profile-bottom');
      if(eyebrow)eyebrow.textContent='Next step';
      if(heading)heading.textContent='Continue to Market Strategy.';
      if(copy)copy.textContent='Approval is optional. You can approve the profile above now or continue and return later.';
      if(nextButton){
        nextButton.textContent='Next: Market Strategy →';
        nextButton.disabled=false;
        nextButton.removeAttribute('aria-disabled');
      }
    }
  }

  async function openReferenceCustomers(){
    if(root.LeadIntelReferenceCustomerUI?.open){root.LeadIntelReferenceCustomerUI.open();return true;}
    try{
      await import(`./reference-customers.js?v=${PROFILE_ACTION_VERSION}-fallback`);
      await import(`./reference-customer-ui.js?v=${PROFILE_ACTION_VERSION}-fallback`);
      if(root.LeadIntelReferenceCustomerUI?.open){root.LeadIntelReferenceCustomerUI.open();return true;}
    }catch(error){console.error('Reference Customer Intelligence failed to open',error);}
    toast('Reference Customer Intelligence could not open. Reload the workspace and try again.');
    return false;
  }

  document.addEventListener('click',event=>{
    const next=event.target?.closest?.('#approve-profile-bottom');
    if(next){
      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation();
      openMarketStrategy();
      return;
    }

    const button=event.target?.closest?.('[data-reference-customers-manage]');
    if(!button)return;
    event.preventDefault();
    event.stopPropagation();
    void openReferenceCustomers();
  },true);

  root.addEventListener('leadintel:module-opened',()=>setTimeout(syncApprovalControls,0));
  root.addEventListener('storage',event=>{if(event.key===PROFILE_ACTION_STATE_KEY)setTimeout(syncApprovalControls,0);});
  const observer=new MutationObserver(()=>queueMicrotask(syncApprovalControls));
  observer.observe(document.documentElement,{subtree:true,childList:true,attributes:true,attributeFilter:['hidden','disabled','class']});
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',syncApprovalControls,{once:true});else syncApprovalControls();

  root.LeadIntelProfileActionRuntime={syncApprovalControls,openReferenceCustomers,openMarketStrategy};
})(globalThis);
