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

  function setText(node,text){if(node&&node.textContent!==text)node.textContent=text;}

  function syncLabels(){
    const modal=document.getElementById('reference-customer-modal');
    if(!modal)return;
    const upload=modal.querySelector('#reference-upload-button');
    if(upload){
      setText(upload,'Import Customer List');
      upload.title='Import a CSV or Excel customer list. Saved lists will not be changed until you save the imported list.';
    }
  }

  function setImportMode(mode='new'){
    nextImportMode=mode==='append'?'append':'new';
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
    // Excel is intercepted by reference-customer-smart-import.js. That runtime
    // consumes the mode before it owns the workbook change event.
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
    if(status)setText(status,clean(error?.message)||'Unable to prepare customer list import');
  }

  // Import-state preparation is intentionally change-driven. The base Reference
  // Customer UI is the only owner of the upload button click and native file picker.
  document.addEventListener('change',event=>{
    if(event.target?.id!=='reference-file-input'&&event.target?.id!=='reference-pdf-input')return;
    try{prepareFileImport(event);}catch(error){showError(error);}
  },true);

  root.addEventListener('leadintel:reference-customers-updated',()=>setTimeout(syncLabels,0));
  root.addEventListener('leadintel:server-ready',()=>setTimeout(syncLabels,0));
  if(document.body&&typeof MutationObserver!=='undefined'){
    new MutationObserver(records=>{
      if(records.some(record=>[...record.addedNodes].some(node=>node?.id==='reference-customer-modal'||node?.querySelector?.('#reference-customer-modal'))))setTimeout(syncLabels,0);
    }).observe(document.body,{childList:true,subtree:true});
  }
  setTimeout(syncLabels,0);

  root.LeadIntelReferenceCustomerUploadMode={setImportMode,consumeImportMode,prepareFileImport,syncLabels};
})(globalThis);
