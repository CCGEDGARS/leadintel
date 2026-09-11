const REFERENCE_DELETE_STATE_KEY='leadintel_customer_v2_state';

(function installReferenceCustomerDeleteUI(root){
  'use strict';
  if(typeof document==='undefined')return;
  const Portfolio=root.LeadIntelReferenceCustomerPortfolio;
  if(!Portfolio?.deleteList)return;
  let pendingDeleteId='';

  function readState(){try{return JSON.parse(localStorage.getItem(REFERENCE_DELETE_STATE_KEY)||'{}');}catch{return {};}}
  async function writeState(state){
    localStorage.setItem(REFERENCE_DELETE_STATE_KEY,JSON.stringify(state));
    await root.LeadIntelServerBridge?.saveNow?.().catch(()=>null);
    root.dispatchEvent(new CustomEvent('leadintel:reference-customers-updated'));
    root.LeadIntelReferenceCustomerUI?.render?.();
  }
  function selectedName(id){const p=Portfolio.normalizePortfolio(readState().referenceCustomerPortfolio||{});return p.lists.find(x=>x.id===id)?.name||'this customer list';}
  async function deleteSavedList(id){
    const name=selectedName(id);
    const next=Portfolio.deleteList(readState(),id);
    pendingDeleteId='';
    await writeState(next);
    const status=document.getElementById('reference-import-status');
    if(status)status.textContent=`${name} deleted from Saved Lists.`;
  }
  function renameClearControls(modal){
    for(const button of modal.querySelectorAll('button'))if(button.textContent.trim()==='Clear customer list')button.textContent='Clear current draft';
    for(const strong of modal.querySelectorAll('strong,h3'))if(strong.textContent.trim()==='Clear customer list?')strong.textContent='Clear current draft?';
    for(const node of modal.querySelectorAll('p'))if(node.textContent.includes('Remove all reference customers and reset Lookalike Intelligence'))node.textContent='Clear the current working customer rows. Saved Lists are not deleted.';
  }
  function buildDeleteControls(row,id){
    const buttons=row.querySelector('.reference-saved-buttons');if(!buttons)return;
    for(const node of buttons.querySelectorAll('[data-delete-reference-list],[data-confirm-delete-list],[data-cancel-delete-list],[data-delete-warning]'))node.remove();
    if(pendingDeleteId===id){
      const warning=document.createElement('span');warning.dataset.deleteWarning='true';warning.textContent='Permanently delete?';warning.style.cssText='font-size:11px;font-weight:700;color:#9f2f2f;align-self:center';buttons.appendChild(warning);
      const confirm=document.createElement('button');confirm.type='button';confirm.className='secondary-btn';confirm.dataset.confirmDeleteList=id;confirm.textContent='Confirm delete';confirm.style.cssText='border-color:#d7a3a3;color:#9f2f2f';buttons.appendChild(confirm);
      const cancel=document.createElement('button');cancel.type='button';cancel.className='secondary-btn';cancel.dataset.cancelDeleteList=id;cancel.textContent='Cancel';buttons.appendChild(cancel);
      return;
    }
    const button=document.createElement('button');button.type='button';button.className='secondary-btn';button.dataset.deleteReferenceList=id;button.textContent='Delete';button.setAttribute('aria-label',`Delete ${selectedName(id)}`);buttons.appendChild(button);
  }
  function decorate(){
    const modal=document.getElementById('reference-customer-modal');if(!modal)return;
    renameClearControls(modal);
    for(const row of modal.querySelectorAll('[data-reference-list-row]')){
      const id=row.dataset.referenceListRow;if(!id)continue;
      const isPending=pendingDeleteId===id;
      const alreadyCorrect=isPending?Boolean(row.querySelector('[data-confirm-delete-list]')):Boolean(row.querySelector('[data-delete-reference-list]'));
      if(!alreadyCorrect)buildDeleteControls(row,id);
    }
  }
  document.addEventListener('click',event=>{
    const begin=event.target?.closest?.('[data-delete-reference-list]');
    if(begin){event.preventDefault();event.stopPropagation();event.stopImmediatePropagation();pendingDeleteId=begin.dataset.deleteReferenceList;decorate();return;}
    const cancel=event.target?.closest?.('[data-cancel-delete-list]');
    if(cancel){event.preventDefault();event.stopPropagation();event.stopImmediatePropagation();pendingDeleteId='';decorate();return;}
    const confirm=event.target?.closest?.('[data-confirm-delete-list]');
    if(!confirm)return;
    event.preventDefault();event.stopPropagation();event.stopImmediatePropagation();
    void deleteSavedList(confirm.dataset.confirmDeleteList);
  },true);
  root.addEventListener('leadintel:reference-customers-updated',()=>setTimeout(decorate,0));
  root.addEventListener('leadintel:server-ready',()=>setTimeout(decorate,0));
  new MutationObserver(()=>queueMicrotask(decorate)).observe(document.documentElement,{subtree:true,childList:true});
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',decorate,{once:true});else decorate();
  root.LeadIntelReferenceCustomerDeleteUI={decorate,deleteSavedList};
})(globalThis);