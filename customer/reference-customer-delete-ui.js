const REFERENCE_DELETE_STATE_KEY='leadintel_customer_v2_state';

(function installReferenceCustomerDeleteUI(root){
  'use strict';
  if(typeof document==='undefined')return;
  const Portfolio=root.LeadIntelReferenceCustomerPortfolio;
  if(!Portfolio?.deleteList)return;

  function readState(){try{return JSON.parse(localStorage.getItem(REFERENCE_DELETE_STATE_KEY)||'{}');}catch{return {};}}
  async function writeState(state){
    localStorage.setItem(REFERENCE_DELETE_STATE_KEY,JSON.stringify(state));
    await root.LeadIntelServerBridge?.saveNow?.().catch(()=>null);
    root.dispatchEvent(new CustomEvent('leadintel:reference-customers-updated'));
    root.LeadIntelReferenceCustomerUI?.render?.();
    root.LeadIntelReferenceCustomerLibraryUI?.sync?.();
  }
  function selectedName(id){const p=Portfolio.normalizePortfolio(readState().referenceCustomerPortfolio||{});return p.lists.find(x=>x.id===id)?.name||'this customer list';}
  async function deleteSavedList(id){
    const name=selectedName(id);
    if(!root.confirm(`Delete “${name}”?\n\nThis permanently removes the saved list and its analyzed/active Lookalike model. This cannot be undone.`))return;
    const next=Portfolio.deleteList(readState(),id);
    await writeState(next);
    const status=document.getElementById('reference-import-status');
    if(status)status.textContent=`${name} deleted from Saved Lists.`;
  }
  function renameClearControls(modal){
    for(const button of modal.querySelectorAll('button'))if(button.textContent.trim()==='Clear customer list')button.textContent='Clear current draft';
    for(const strong of modal.querySelectorAll('strong,h3'))if(strong.textContent.trim()==='Clear customer list?')strong.textContent='Clear current draft?';
    for(const node of modal.querySelectorAll('p'))if(node.textContent.includes('Remove all reference customers and reset Lookalike Intelligence'))node.textContent='Clear the current working customer rows. Saved Lists are not deleted.';
  }
  function decorate(){
    const modal=document.getElementById('reference-customer-modal');if(!modal)return;
    renameClearControls(modal);
    for(const row of modal.querySelectorAll('[data-reference-list-row]')){
      const id=row.dataset.referenceListRow;if(!id||row.querySelector('[data-delete-reference-list]'))continue;
      const buttons=row.querySelector('.reference-saved-buttons');if(!buttons)continue;
      const button=document.createElement('button');button.type='button';button.className='secondary-btn';button.dataset.deleteReferenceList=id;button.textContent='Delete';button.setAttribute('aria-label',`Delete ${selectedName(id)}`);buttons.appendChild(button);
    }
  }
  document.addEventListener('click',event=>{
    const button=event.target?.closest?.('[data-delete-reference-list]');if(!button)return;
    event.preventDefault();event.stopPropagation();event.stopImmediatePropagation();
    void deleteSavedList(button.dataset.deleteReferenceList);
  },true);
  root.addEventListener('leadintel:reference-customers-updated',()=>setTimeout(decorate,0));
  root.addEventListener('leadintel:server-ready',()=>setTimeout(decorate,0));
  new MutationObserver(()=>queueMicrotask(decorate)).observe(document.documentElement,{subtree:true,childList:true});
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',decorate,{once:true});else decorate();
  root.LeadIntelReferenceCustomerDeleteUI={decorate,deleteSavedList};
})(globalThis);
