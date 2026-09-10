const REFERENCE_UPLOAD_STATE_KEY='leadintel_customer_v2_state';

(function installReferenceCustomerUploadMode(root){
  'use strict';
  if(typeof document==='undefined')return;
  const Portfolio=root.LeadIntelReferenceCustomerPortfolio;
  const clean=value=>String(value??'').trim();
  let nextImportMode='new';

  function readState(){
    try{return JSON.parse(localStorage.getItem(REFERENCE_UPLOAD_STATE_KEY)||'{}');}
    catch{return {};}
  }

  function selectedSavedList(state=readState()){
    const portfolio=state.referenceCustomerPortfolio||{};
    const id=clean(portfolio.selectedListId);
    return id?(portfolio.lists||[]).find(list=>list?.id===id)||null:null;
  }

  function setText(node,text){if(node&&node.textContent!==text)node.textContent=text;}

  function syncLabels(){
    const modal=document.getElementById('reference-customer-modal');
    if(!modal)return;
    const upload=modal.querySelector('#reference-upload-button');
    if(upload){
      setText(upload,'Upload New Customer List');
      upload.title='Start a separate customer list from a CSV or Excel file. Saved lists will not be changed.';
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
      setText(add,'Add Customers to This List');
      add.title=`Add more companies to ${selected.name||'the currently open list'}. Save Changes afterwards.`;
      add.hidden=false;
    }else if(add){
      add.hidden=true;
    }
  }

  function openFilePicker(mode='new'){
    const input=document.getElementById('reference-file-input');
    if(!input)throw new Error('Customer list file selector is unavailable');
    nextImportMode=mode==='append'?'append':'new';
    input.value='';
    input.click();
  }

  function startNewListUpload(){
    openFilePicker('new');
  }

  function addToCurrentList(){
    const state=readState();
    if(!selectedSavedList(state))throw new Error('Open a saved list before adding customers to it');
    openFilePicker('append');
  }

  function consumeImportMode(){
    const mode=nextImportMode==='append'?'append':'new';
    nextImportMode='new';
    return mode;
  }

  function prepareFileImport(event){
    const input=event?.target;
    if(input?.id!=='reference-file-input'&&input?.id!=='reference-pdf-input')return;
    const file=input.files?.[0];
    const ext=clean(file?.name).split('.').pop()?.toLowerCase()||'';
    // Excel is intercepted by reference-customer-smart-import.js. That runtime must
    // consume the mode itself before stopImmediatePropagation so list creation and
    // row import happen atomically in the same transaction.
    if(ext==='xlsx'||ext==='xls')return;
    const mode=consumeImportMode();
    if(mode==='append')return;
    const state=readState();
    if(!Portfolio?.newList)throw new Error('Reference Customer portfolio is unavailable');
    const prepared=Portfolio.newList(state);
    localStorage.setItem(REFERENCE_UPLOAD_STATE_KEY,JSON.stringify(prepared));
  }

  function showError(error){
    const status=document.getElementById('reference-import-status');
    if(status)setText(status,clean(error?.message)||'Unable to open customer list upload');
  }

  document.addEventListener('change',event=>{
    if(event.target?.id!=='reference-file-input'&&event.target?.id!=='reference-pdf-input')return;
    try{prepareFileImport(event);}catch(error){showError(error);}
  },true);

  document.addEventListener('click',event=>{
    const add=event.target?.closest?.('[data-add-customers-current]');
    if(add){
      event.preventDefault();event.stopPropagation();event.stopImmediatePropagation();
      try{addToCurrentList();}catch(error){showError(error);}
      return;
    }
    const upload=event.target?.closest?.('#reference-upload-button');
    if(!upload)return;
    event.preventDefault();event.stopPropagation();event.stopImmediatePropagation();
    try{startNewListUpload();}catch(error){showError(error);}
  },true);

  root.addEventListener('leadintel:reference-customers-updated',()=>setTimeout(syncLabels,0));
  root.addEventListener('leadintel:server-ready',()=>setTimeout(syncLabels,0));
  if(document.body&&typeof MutationObserver!=='undefined'){
    new MutationObserver(records=>{
      if(records.some(record=>[...record.addedNodes].some(node=>node?.id==='reference-customer-modal'||node?.querySelector?.('#reference-customer-modal'))))setTimeout(syncLabels,0);
    }).observe(document.body,{childList:true,subtree:true});
  }
  setTimeout(syncLabels,0);

  root.LeadIntelReferenceCustomerUploadMode={startNewListUpload,addToCurrentList,consumeImportMode,prepareFileImport,syncLabels};
})(globalThis);
