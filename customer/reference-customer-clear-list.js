(function(root,factory){
  const api=factory();
  if(typeof module!=="undefined"&&module.exports)module.exports=api;
  if(root)root.LeadIntelReferenceCustomerClearList=api;
  if(root&&root.document)api.install(root);
})(typeof globalThis!=="undefined"?globalThis:this,function(){
  'use strict';
  const STORAGE_KEY='leadintel_customer_v2_state';
  const CONFIRM_MESSAGE='Clear every company in the current working draft? Saved Lists and active models will stay unchanged.';
  const CONFIRMATION_CSS='.reference-clear-confirm{width:100%;margin-top:10px;padding:14px 16px;border:1px solid #dde2dd;border-radius:12px;background:#fff8f6;display:grid;grid-template-columns:minmax(0,1fr) auto;gap:14px;align-items:center}.reference-clear-confirm[hidden]{display:none!important}.reference-clear-confirm small{color:#6c7772;line-height:1.45}.reference-clear-confirm-actions{display:flex;gap:8px;justify-content:flex-end}@media(max-width:650px){.reference-clear-confirm{grid-template-columns:1fr}.reference-clear-confirm-actions{justify-content:flex-start;flex-wrap:wrap}}';

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
    const next={...workspace,referenceCustomers:emptyReferenceCustomers()};
    if(next.referenceCustomerPortfolio&&typeof next.referenceCustomerPortfolio==='object'){
      next.referenceCustomerPortfolio={...next.referenceCustomerPortfolio,selectedListId:''};
    }
    return next;
  }

  function install(root){
    const document=root.document;
    if(!document||document.documentElement?.dataset.referenceClearListInstalled==='true')return;
    if(document.documentElement)document.documentElement.dataset.referenceClearListInstalled='true';

    function ensureStyles(){
      if(document.getElementById('reference-clear-list-styles'))return;
      const style=document.createElement('style');style.id='reference-clear-list-styles';style.textContent=CONFIRMATION_CSS;
      (document.head||document.documentElement).appendChild(style);
    }
    ensureStyles();

    function setStatus(message){
      const node=document.getElementById('reference-import-status');
      if(node)node.textContent=message;
    }

    function hideConfirmation(){
      const panel=document.querySelector('[data-reference-clear-confirm]');
      if(panel){panel.hidden=true;panel.style?.removeProperty?.('display');panel.setAttribute('aria-hidden','true');}
      const trigger=document.getElementById('reference-clear-list');
      trigger?.setAttribute('aria-expanded','false');
      trigger?.focus?.();
    }

    async function clearList(){
      let state={};
      try{state=JSON.parse(root.localStorage.getItem(STORAGE_KEY)||'{}');}catch{}
      const rows=Array.isArray(state.referenceCustomers?.rows)?state.referenceCustomers.rows:[];
      if(!rows.length){hideConfirmation();setStatus('The current draft is already empty. Saved Lists are unchanged.');return;}

      state=clearReferenceCustomersFromWorkspace(state);
      if(root.LeadIntelReferenceCustomers?.persistReferenceWorkspaceState){
        root.LeadIntelReferenceCustomers.persistReferenceWorkspaceState(root,state,{render:true});
      }else{
        root.localStorage.setItem(STORAGE_KEY,JSON.stringify(state));
        root.dispatchEvent(new root.CustomEvent('leadintel:reference-customers-updated'));
        root.LeadIntelReferenceCustomerUI?.render?.();
        try{const pending=root.LeadIntelServerBridge?.saveNow?.();if(pending&&typeof pending.then==='function')void Promise.resolve(pending).catch(()=>null);}catch{}
      }
      hideConfirmation();
      setStatus('Current draft cleared. Saved Lists and active models are unchanged.');
    }

    function ensureConfirmation(actions){
      let panel=document.querySelector('[data-reference-clear-confirm]');
      if(panel){panel.classList.add('reference-clear-confirm');panel.style?.removeProperty?.('display');panel.setAttribute('aria-hidden',String(Boolean(panel.hidden)));return panel;}
      panel=document.createElement('div');
      panel.className='reference-clear-confirm';
      panel.dataset.referenceClearConfirm='true';
      panel.hidden=true;
      panel.setAttribute('role','alertdialog');
      panel.setAttribute('aria-labelledby','reference-clear-confirm-title');
      panel.setAttribute('aria-hidden','true');
      panel.innerHTML=`<div><strong id="reference-clear-confirm-title" style="display:block;margin-bottom:3px">Clear current draft?</strong><small>${CONFIRM_MESSAGE}</small></div><div class="reference-clear-confirm-actions"><button type="button" class="secondary-btn" data-reference-clear-confirm-no>Cancel</button><button type="button" class="primary-btn" data-reference-clear-confirm-yes>Clear draft</button></div>`;
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
      panel.setAttribute('aria-hidden','false');
      document.getElementById('reference-clear-list')?.setAttribute('aria-expanded','true');
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
      button.textContent='Clear current draft';
      button.setAttribute('aria-expanded','false');
      button.addEventListener('click',showConfirmation);
      const pdf=actions.querySelector('.reference-pdf-fallback');
      if(pdf)actions.insertBefore(button,pdf);else actions.appendChild(button);
    }

    function scheduleButton(){[0,50,200].forEach(delay=>root.setTimeout(ensureButton,delay));}
    document.addEventListener('click',event=>{if(event.target.closest('[data-reference-customers-manage]'))scheduleButton();});
    document.addEventListener('keydown',event=>{
      if(event.key!=='Escape')return;
      const panel=document.querySelector('[data-reference-clear-confirm]');
      if(panel&&!panel.hidden){event.preventDefault();hideConfirmation();setStatus('Clear cancelled. Your current draft is unchanged.');}
    });
    root.addEventListener('leadintel:reference-customers-updated',scheduleButton);
    if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',scheduleButton,{once:true});else scheduleButton();
  }

  return {CONFIRM_MESSAGE,CONFIRMATION_CSS,emptyReferenceCustomers,clearReferenceCustomersFromWorkspace,install};
});
