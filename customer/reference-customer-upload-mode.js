const REFERENCE_UPLOAD_STATE_KEY='leadintel_customer_v2_state';

(function installReferenceCustomerUploadMode(root){
  'use strict';
  if(typeof document==='undefined')return;
  const clean=value=>String(value??'').trim();

  function readState(){
    try{return JSON.parse(localStorage.getItem(REFERENCE_UPLOAD_STATE_KEY)||'{}');}
    catch{return {};}
  }

  function selectedSavedList(state=readState()){
    const portfolio=state.referenceCustomerPortfolio||{};
    const id=clean(portfolio.selectedListId);
    return id?(portfolio.lists||[]).find(list=>list?.id===id)||null:null;
  }

  function currentRows(state=readState()){
    return Array.isArray(state.referenceCustomers?.rows)?state.referenceCustomers.rows:[];
  }

  function syncLabels(){
    const modal=document.getElementById('reference-customer-modal');
    if(!modal)return;
    const upload=modal.querySelector('#reference-upload-button');
    if(upload){
      upload.textContent='Upload New Customer List';
      upload.title='Start a separate customer list from a CSV or Excel file.';
    }
    const selected=selectedSavedList();
    const actions=modal.querySelector('.reference-simple-actions');
    let add=modal.querySelector('[data-add-customers-current]');
    if(selected&&actions){
      if(!add){
        add=document.createElement('button');
        add.type='button';
        add.className='secondary-btn';
        add.dataset.addCustomersCurrent='true';
        actions.insertBefore(add,actions.firstChild);
      }
      add.textContent='Add Customers to This List';
      add.title=`Add more companies to ${selected.name||'the currently open list'}. Save Changes afterwards.`;
      add.hidden=false;
    }else if(add){
      add.hidden=true;
    }
  }

  async function startNewListUpload(){
    const state=readState();
    const selected=selectedSavedList(state);
    if(selected&&currentRows(state).length){
      const library=root.LeadIntelReferenceCustomerLibraryUI;
      if(!library?.createNewList)throw new Error('New list action is unavailable');
      await library.createNewList();
    }
    const input=document.getElementById('reference-file-input');
    if(!input)throw new Error('Customer list file selector is unavailable');
    input.value='';
    input.click();
  }

  function addToCurrentList(){
    const state=readState();
    if(!selectedSavedList(state))throw new Error('Open a saved list before adding customers to it');
    const input=document.getElementById('reference-file-input');
    if(!input)throw new Error('Customer list file selector is unavailable');
    input.value='';
    input.click();
  }

  function showError(error){
    const status=document.getElementById('reference-import-status');
    if(status)status.textContent=clean(error?.message)||'Unable to open customer list upload';
  }

  document.addEventListener('click',event=>{
    const add=event.target?.closest?.('[data-add-customers-current]');
    if(add){
      event.preventDefault();event.stopPropagation();event.stopImmediatePropagation();
      try{addToCurrentList();}catch(error){showError(error);}
      return;
    }
    const upload=event.target?.closest?.('#reference-upload-button');
    if(!upload)return;
    const state=readState();
    if(!selectedSavedList(state)||!currentRows(state).length)return;
    event.preventDefault();event.stopPropagation();event.stopImmediatePropagation();
    void startNewListUpload().catch(showError);
  },true);

  root.addEventListener('leadintel:reference-customers-updated',()=>setTimeout(syncLabels,0));
  root.addEventListener('leadintel:server-ready',()=>setTimeout(syncLabels,0));
  if(document.body&&typeof MutationObserver!=='undefined'){
    new MutationObserver(()=>syncLabels()).observe(document.body,{childList:true,subtree:true});
  }
  setTimeout(syncLabels,0);

  root.LeadIntelReferenceCustomerUploadMode={startNewListUpload,addToCurrentList,syncLabels};
})(globalThis);
