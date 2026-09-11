const REFERENCE_CUSTOMER_LAUNCH_VERSION='20260911-reference-launch-sync-v2';

(function installReferenceCustomerLauncher(root){
  'use strict';
  if(typeof document==='undefined')return;

  function toast(message){
    const node=document.getElementById('toast');
    if(!node)return;
    node.textContent=message;
    node.classList.add('show');
    clearTimeout(toast.t);
    toast.t=setTimeout(()=>node.classList.remove('show'),2600);
  }

  function open(){
    try{
      if(root.LeadIntelReferenceCustomerUI?.open){
        root.LeadIntelReferenceCustomerUI.open();
        return true;
      }
    }catch(error){
      console.error('Reference Customer Intelligence failed to open',error);
    }
    toast('Reference Customer Intelligence is not ready. Reload the workspace and try again.');
    return false;
  }

  document.addEventListener('click',event=>{
    const button=event.target?.closest?.('[data-reference-customers-manage]');
    if(!button)return;
    event.preventDefault();
    open();
  });

  root.LeadIntelReferenceCustomerLauncher={open};
})(globalThis);
