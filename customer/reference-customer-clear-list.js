(function(root,factory){
  const api=factory();
  if(typeof module!=="undefined"&&module.exports)module.exports=api;
  if(root)root.LeadIntelReferenceCustomerClearList=api;
  if(root&&root.document)api.install(root);
})(typeof globalThis!=="undefined"?globalThis:this,function(){
  'use strict';
  const STORAGE_KEY='leadintel_customer_v2_state';
  const CONFIRM_MESSAGE='Remove all reference customers and reset Lookalike Intelligence?';

  function emptyReferenceCustomers(){
    return {
      version:2,
      source:{type:'',name:''},
      rows:[],
      analyses:{},
      segments:[],
      segmentationMeaningful:false,
      activeSegmentIds:[],
      activeIds:[],
      activated:false,
      fingerprint:'',
      dna:null,
      activatedAt:'',
      analyzedAt:''
    };
  }

  function clearReferenceCustomersFromWorkspace(workspace={}){
    return {...workspace,referenceCustomers:emptyReferenceCustomers()};
  }

  function install(root){
    const document=root.document;
    if(!document||document.documentElement?.dataset.referenceClearListInstalled==='true')return;
    if(document.documentElement)document.documentElement.dataset.referenceClearListInstalled='true';

    function setStatus(message){
      const node=document.getElementById('reference-import-status');
      if(node)node.textContent=message;
    }

    async function clearList(){
      let state={};
      try{state=JSON.parse(root.localStorage.getItem(STORAGE_KEY)||'{}');}catch{}
      const rows=Array.isArray(state.referenceCustomers?.rows)?state.referenceCustomers.rows:[];
      if(!rows.length){setStatus('Customer list is already empty.');return;}
      if(typeof root.confirm==='function'&&!root.confirm(CONFIRM_MESSAGE))return;

      state=clearReferenceCustomersFromWorkspace(state);
      root.localStorage.setItem(STORAGE_KEY,JSON.stringify(state));
      await root.LeadIntelServerBridge?.saveNow?.().catch(()=>null);
      root.dispatchEvent(new root.CustomEvent('leadintel:reference-customers-updated'));
      root.LeadIntelReferenceCustomerUI?.render?.();
      setStatus('Reference customer list cleared. Lookalike Intelligence has been reset.');
    }

    function ensureButton(){
      const modal=document.getElementById('reference-customer-modal');
      const actions=modal?.querySelector('.reference-import-actions');
      if(!actions||actions.querySelector('#reference-clear-list'))return;
      const button=document.createElement('button');
      button.type='button';
      button.id='reference-clear-list';
      button.className='secondary-btn';
      button.textContent='Clear customer list';
      button.addEventListener('click',clearList);
      const pdf=actions.querySelector('.reference-pdf-fallback');
      if(pdf)actions.insertBefore(button,pdf);else actions.appendChild(button);
    }

    function scheduleButton(){[0,50,200].forEach(delay=>root.setTimeout(ensureButton,delay));}
    document.addEventListener('click',event=>{if(event.target.closest('[data-reference-customers-manage]'))scheduleButton();});
    root.addEventListener('leadintel:reference-customers-updated',scheduleButton);
    if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',scheduleButton,{once:true});else scheduleButton();
  }

  return {CONFIRM_MESSAGE,emptyReferenceCustomers,clearReferenceCustomersFromWorkspace,install};
});
