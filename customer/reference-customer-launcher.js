const REFERENCE_CUSTOMER_LAUNCH_VERSION='20260923-customer-profile-inference-v1';

(function installReferenceCustomerLauncher(root){
  'use strict';
  if(typeof document==='undefined')return;

  let opening=null;

  function toast(message){
    const node=document.getElementById('toast');
    if(!node)return;
    node.textContent=message;
    node.classList.add('show');
    clearTimeout(toast.t);
    toast.t=setTimeout(()=>node.classList.remove('show'),2600);
  }

  async function ensureReferenceCustomerRuntime(){
    await import(`./reference-customers.js?v=${REFERENCE_CUSTOMER_LAUNCH_VERSION}`);
    await import(`./reference-customer-ui.js?v=${REFERENCE_CUSTOMER_LAUNCH_VERSION}`);
    return root.LeadIntelReferenceCustomerUI||null;
  }

  function warmUploadRuntime(){
    void import(`./reference-customer-upload-mode.js?v=${REFERENCE_CUSTOMER_LAUNCH_VERSION}`).catch(error=>{
      console.error('Reference Customer upload runtime failed to warm',error);
    });
  }

  async function open(){
    if(root.LeadIntelReferenceCustomerUI?.open){
      root.LeadIntelReferenceCustomerUI.open();
      warmUploadRuntime();
      return true;
    }
    if(opening)return opening;
    opening=(async()=>{
      try{
        await ensureReferenceCustomerRuntime();
        if(root.LeadIntelReferenceCustomerUI?.open){
          root.LeadIntelReferenceCustomerUI.open();
          warmUploadRuntime();
          return true;
        }
      }catch(error){
        console.error('Reference Customer Intelligence failed to open',error);
      }
      toast('Reference Customer Intelligence could not open. Reload the workspace and try again.');
      return false;
    })();
    try{return await opening;}finally{opening=null;}
  }

  document.addEventListener('click',event=>{
    const button=event.target?.closest?.('[data-reference-customers-manage]');
    if(!button)return;
    event.preventDefault();
    void open();
  });

  root.LeadIntelReferenceCustomerLauncher={open,ensureReferenceCustomerRuntime,warmUploadRuntime};
})(globalThis);
