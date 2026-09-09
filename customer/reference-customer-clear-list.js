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

    function hideConfirmation(){
      const panel=document.querySelector('[data-reference-clear-confirm]');
      if(panel)panel.hidden=true;
    }

    async function clearList(){
      let state={};
      try{state=JSON.parse(root.localStorage.getItem(STORAGE_KEY)||'{}');}catch{}
      const rows=Array.isArray(state.referenceCustomers?.rows)?state.referenceCustomers.rows:[];
      if(!rows.length){hideConfirmation();setStatus('Customer list is already empty.');return;}

      state=clearReferenceCustomersFromWorkspace(state);
      root.localStorage.setItem(STORAGE_KEY,JSON.stringify(state));
      await root.LeadIntelServerBridge?.saveNow?.().catch(()=>null);
      root.dispatchEvent(new root.CustomEvent('leadintel:reference-customers-updated'));
      root.LeadIntelReferenceCustomerUI?.render?.();
      hideConfirmation();
      setStatus('Reference customer list cleared. Lookalike Intelligence has been reset.');
    }

    function ensureConfirmation(actions){
      let panel=document.querySelector('[data-reference-clear-confirm]');
      if(panel)return panel;
      panel=document.createElement('div');
      panel.dataset.referenceClearConfirm='true';
      panel.hidden=true;
      panel.setAttribute('role','alertdialog');
      panel.setAttribute('aria-labelledby','reference-clear-confirm-title');
      panel.style.cssText='width:100%;margin-top:10px;padding:14px 16px;border:1px solid #dde2dd;border-radius:12px;background:#fff8f6;display:grid;grid-template-columns:minmax(0,1fr) auto;gap:14px;align-items:center;';
      panel.innerHTML=`<div><strong id="reference-clear-confirm-title" style="display:block;margin-bottom:3px">Clear customer list?</strong><small style="color:#6c7772;line-height:1.45">${CONFIRM_MESSAGE}</small></div><div style="display:flex;gap:8px;justify-content:flex-end"><button type="button" class="secondary-btn" data-reference-clear-confirm-no>Cancel</button><button type="button" class="primary-btn" data-reference-clear-confirm-yes>Clear customer list</button></div>`;
      actions.insertAdjacentElement('afterend',panel);
      panel.querySelector('[data-reference-clear-confirm-no]')?.addEventListener('click',hideConfirmation);
      panel.querySelector('[data-reference-clear-confirm-yes]')?.addEventListener('click',()=>{void clearList();});
      return panel;
    }

    function showConfirmation(){
      const modal=document.getElementById('reference-customer-modal');
      const actions=modal?.querySelector('.reference-import-actions');
      if(!actions)return;
      const panel=ensureConfirmation(actions);
      panel.hidden=false;
      panel.querySelector('[data-reference-clear-confirm-no]')?.focus?.();
    }

    function ensureButton(){
      const modal=document.getElementById('reference-customer-modal');
      const actions=modal?.querySelector('.reference-import-actions');
      if(!actions)return;
      ensureConfirmation(actions);
      if(actions.querySelector('#reference-clear-list'))return;
      const button=document.createElement('button');
      button.type='button';
      button.id='reference-clear-list';
      button.className='secondary-btn';
      button.textContent='Clear customer list';
      button.addEventListener('click',showConfirmation);
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
