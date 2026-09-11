const REFERENCE_LIBRARY_STATE_KEY='leadintel_customer_v2_state';

(function installReferenceCustomerLibraryUI(root){
  'use strict';
  if(typeof document==='undefined')return;
  const Ref=root.LeadIntelReferenceCustomers;
  const Portfolio=root.LeadIntelReferenceCustomerPortfolio;
  if(!Ref?.publishReferenceModel||!Ref?.markReferenceDraftChanged||!Portfolio)return;
  const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const clean=value=>String(value??'').replace(/\s+/g,' ').trim();
  const LEGACY_LABELS=['Save & Activate Model','Update Active Model'];
  let migrationSaved=false;
  let editorOpen=false;
  let analyzingListId='';

  function readState(){try{return JSON.parse(localStorage.getItem(REFERENCE_LIBRARY_STATE_KEY)||'{}');}catch{return {};}}
  async function writeState(state){
    localStorage.setItem(REFERENCE_LIBRARY_STATE_KEY,JSON.stringify(state));
    await root.LeadIntelServerBridge?.saveNow?.().catch(()=>null);
    root.dispatchEvent(new CustomEvent('leadintel:reference-customers-updated'));
    root.LeadIntelReferenceCustomerUI?.render?.();
  }
  function ensurePanel(modal){
    if(!modal)return null;
    let panel=modal.querySelector('[data-reference-library-summary]');
    if(panel)return panel;
    panel=document.createElement('section');
    panel.className='reference-library-summary';
    panel.dataset.referenceLibrarySummary='true';
    const market=modal.querySelector('#reference-market-summary');
    (market?.parentNode||modal).insertBefore(panel,market?.nextSibling||modal.firstChild);
    return panel;
  }
  function simplifyBaseUi(modal){
    const steps=modal?.querySelectorAll?.('.reference-workflow span');
    if(steps?.length>=4){steps[0].textContent='1 · List';steps[1].textContent='2 · Analyze';steps[2].textContent='3 · Review';steps[3].textContent='4 · Activate';}
    const upload=modal?.querySelector?.('#reference-upload-button');if(upload)upload.textContent='Upload customer list';
    const analyze=modal?.querySelector?.('#reference-analyze');if(analyze){analyze.textContent='Analyze List';analyze.setAttribute('aria-hidden','true');}
    const activate=modal?.querySelector?.('#reference-activate');if(activate){activate.textContent='Activate Model';activate.setAttribute('aria-hidden','true');}
  }
  function injectStyles(){
    if(document.getElementById('reference-library-styles'))return;
    const style=document.createElement('style');style.id='reference-library-styles';style.textContent=`
      .reference-library-summary{margin:14px 0 18px;padding:18px;border:1px solid #d9e6e1;border-radius:16px;background:#f8fbfa;display:flex;flex-direction:column;gap:16px}
      .reference-library-top{display:flex;align-items:flex-start;justify-content:space-between;gap:16px}.reference-library-main{display:flex;flex-direction:column;gap:5px;min-width:0}.reference-library-head{display:flex;align-items:center;gap:10px;flex-wrap:wrap}.reference-library-head strong{font-size:18px;color:#10251f}.reference-library-badge{display:inline-flex;align-items:center;border-radius:999px;padding:5px 9px;font-size:10px;font-weight:800;letter-spacing:.08em;text-transform:uppercase;background:#dff4ec;color:#0d684f}.reference-library-badge.inactive{background:#edf0ef;color:#64716d}.reference-library-badge.pending{background:#fff0cf;color:#75510b}.reference-library-status{font-size:13px;color:#607083;line-height:1.45}.reference-library-status strong{color:#1f3b32}
      .reference-current-card{padding:16px;border:1px solid #dfe8e4;border-radius:14px;background:#fff;display:flex;flex-direction:column;gap:12px}.reference-current-message{display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap}.reference-current-message strong{font-size:15px;color:#173029}.reference-current-message span{font-size:12px;color:#677872}.reference-current-name{display:grid;grid-template-columns:minmax(240px,1fr) auto;gap:10px;align-items:end}.reference-current-name label{display:flex;flex-direction:column;gap:5px;font-size:11px;font-weight:800;color:#62706c;text-transform:uppercase;letter-spacing:.04em}.reference-current-name input,.reference-advanced-grid input{min-height:44px;border:1px solid #d3ddda;border-radius:10px;padding:9px 11px;background:white;color:#173029;font-size:14px}.reference-simple-actions{display:flex;gap:9px;flex-wrap:wrap}.reference-simple-actions button{min-height:42px}.reference-simple-actions .primary-action{background:#10251f;color:#fff}.reference-simple-actions button[disabled]{opacity:.42;cursor:not-allowed}
      .reference-advanced{border-top:1px solid #e4ebe8;padding-top:10px}.reference-advanced summary{cursor:pointer;font-size:12px;font-weight:750;color:#53655f;list-style:none}.reference-advanced summary::-webkit-details-marker{display:none}.reference-advanced summary:before{content:'▸ ';color:#71827c}.reference-advanced[open] summary:before{content:'▾ '}.reference-advanced-grid{display:grid;grid-template-columns:1fr 1.4fr auto;gap:10px;align-items:end;margin-top:10px}.reference-advanced-grid label{display:flex;flex-direction:column;gap:5px;font-size:11px;font-weight:700;color:#62706c}
      .reference-saved-lists{display:flex;flex-direction:column;gap:8px;border-top:1px solid #e1e9e6;padding-top:14px}.reference-saved-head{display:flex;justify-content:space-between;align-items:center;gap:12px}.reference-saved-head strong{font-size:13px;color:#29453c}.reference-saved-head span{font-size:11px;color:#71807b}.reference-saved-row{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:12px;align-items:center;padding:11px 12px;border:1px solid #dfe7e4;border-radius:11px;background:#fff}.reference-saved-info{min-width:0}.reference-saved-info strong{display:block;font-size:13px;color:#173029}.reference-saved-info small{display:block;margin-top:3px;font-size:11px;color:#73817c;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.reference-saved-row.active{border-color:#9fcdbf;background:#f4fbf8}.reference-saved-row.selected{box-shadow:inset 3px 0 0 #0d684f}.reference-saved-buttons{display:flex;gap:7px;align-items:center}.reference-saved-buttons button{font-size:11px;padding:7px 10px;border-radius:8px}.reference-saved-row.selected [data-analyze-reference-list]{background:#0d1b2e;border-color:#0d1b2e;color:#fff}.reference-saved-row.selected [data-analyze-reference-list]:hover{background:#162a43;border-color:#162a43}.reference-saved-row.selected [data-view-reference-results]{background:#0d1b2e;border-color:#0d1b2e;color:#fff}.reference-saved-row.selected [data-view-reference-results]:hover{background:#162a43;border-color:#162a43}.reference-list-state{display:inline-flex;margin-left:7px;border-radius:999px;padding:3px 7px;font-size:9px;font-weight:800;letter-spacing:.06em;text-transform:uppercase;background:#edf0ef;color:#65736e}.reference-list-state.active{background:#dff4ec;color:#0d684f}
      #reference-customer-modal .reference-format-guide{display:none!important}#reference-customer-modal .reference-analysis-actions{display:none!important}#reference-customer-modal footer #reference-activate{display:none!important}
      @media(max-width:900px){.reference-advanced-grid{grid-template-columns:1fr 1fr}.reference-library-top{flex-direction:column}.reference-current-name{grid-template-columns:1fr}}
      @media(max-width:650px){.reference-advanced-grid{grid-template-columns:1fr}.reference-saved-row{grid-template-columns:1fr}.reference-saved-buttons,.reference-simple-actions{justify-content:flex-start}.reference-simple-actions button{flex:1 1 140px}}
    `;document.head.appendChild(style);
  }
  function snapshot(){
    const raw=readState();
    const state=Portfolio.migrateLegacy(raw);
    state.referenceCustomers=Ref.normalizeReferenceState(state.referenceCustomers||{});
    state.referenceCustomerPortfolio=Portfolio.normalizePortfolio(state.referenceCustomerPortfolio||{});
    return state;
  }
  async function persistLegacyMigration(state){
    if(migrationSaved)return;
    const raw=readState();
    const before=JSON.stringify(raw.referenceCustomerPortfolio||{}),after=JSON.stringify(state.referenceCustomerPortfolio||{});
    if(before===after)return;
    migrationSaved=true;await writeState(state);
  }
  function listMeta(state){
    const portfolio=state.referenceCustomerPortfolio;
    const selected=portfolio.lists.find(list=>list.id===portfolio.selectedListId)||null;
    return selected||{name:'',markets:state.targetMarkets||[],purpose:''};
  }
  function renderSavedLists(state,editorHtml=''){ 
    const portfolio=state.referenceCustomerPortfolio,selectedId=portfolio.selectedListId;
    if(!portfolio.lists.length)return `<div class="reference-saved-lists"><div class="reference-saved-head"><strong>Saved Lists</strong><span>No saved lists yet</span></div>${editorHtml}</div>`;
    const unselectedEditor=!selectedId?editorHtml:'';
    return `<div class="reference-saved-lists"><div class="reference-saved-head"><strong>Saved Lists</strong><span>${portfolio.lists.length} saved · ${portfolio.lists.filter(x=>x.active).length} active</span></div>${unselectedEditor}${portfolio.lists.map(list=>{
      const ref=list.reference||{},rows=ref.rows?.length||0,analyzed=Object.keys(ref.analyses||{}).length,model=ref.publishedModel;
      const segments=(ref.segments||[]).length;
      const canReview=Boolean(analyzed&&segments);
      const stateLabel=list.active?'Active':canReview||model?'Ready':'Saved';
      const canActivate=Boolean(list.active||model||canReview);
      const isSelected=list.id===selectedId;
      const isAnalyzing=list.id===analyzingListId;
      return `<div class="reference-saved-row ${list.active?'active':''} ${list.id===selectedId?'selected':''}" data-reference-list-row="${esc(list.id)}"><div class="reference-saved-info"><strong>${esc(list.name)}<span class="reference-list-state ${list.active?'active':''}">${stateLabel}</span></strong><small>${rows} customers · ${analyzed} analyzed${canReview?` · ${segments} segment${segments===1?'':'s'} · Ready for review`:''}${model?` · ${esc(model.confidence||'low')} confidence`:''}${list.markets?.length?` · ${esc(list.markets.join(' · '))}`:''}</small></div><div class="reference-saved-buttons">${canReview?`<button class="${isSelected?'primary-btn':'secondary-btn'}" type="button" data-view-reference-results="${esc(list.id)}">View Results</button>`:`<button class="${isSelected?'primary-btn':'secondary-btn'}" type="button" data-analyze-reference-list="${esc(list.id)}" ${isAnalyzing?'disabled':''}>${isAnalyzing?'Analyzing…':'Analyze'}</button>`}<button class="${list.active?'secondary-btn':'primary-btn'}" type="button" data-activate-reference-list="${esc(list.id)}" ${canActivate?'':'disabled'}>${list.active?'Deactivate':'Activate'}</button><button class="secondary-btn" type="button" data-edit-reference-list="${esc(list.id)}">Edit</button><button class="secondary-btn" type="button" data-delete-reference-list="${esc(list.id)}">Delete</button></div></div>${list.id===selectedId?editorHtml:''}`;
    }).join('')}</div>`;
  }
  function currentMessage({saved,analyzed,segments,selected}){
    if(!saved)return '<strong>Start a customer list</strong><span>Upload a CSV/Excel file or add companies manually below.</span>';
    if(!selected)return `<strong>${saved} customers imported</strong><span>This list is not saved yet. Give it a name and click Save List.</span>`;
    if(!analyzed)return `<strong>${esc(selected.name)} · ${saved} customers</strong><span>Saved. Next step: Analyze List.</span>`;
    if(!selected.active)return `<strong>${esc(selected.name)} · ${analyzed} analyzed</strong><span>${segments?`${segments} segment${segments===1?'':'s'} ready. Review below, then Activate Model.`:'Analysis complete. Review the results below.'}</span>`;
    return `<strong>${esc(selected.name)} · Active</strong><span>This model is currently influencing Lookalike-led Discovery.</span>`;
  }
  function syncLibraryUi(){
    injectStyles();
    const modal=document.getElementById('reference-customer-modal');if(!modal)return;
    simplifyBaseUi(modal);
    const panel=ensurePanel(modal);if(!panel)return;
    const state=snapshot(),reference=state.referenceCustomers,portfolio=state.referenceCustomerPortfolio,meta=listMeta(state);
    const saved=reference.rows.length,analyzed=Object.keys(reference.analyses||{}).length,segments=(reference.segments||[]).length;
    const selected=portfolio.lists.find(list=>list.id===portfolio.selectedListId)||null;
    const activeModels=portfolio.lists.filter(list=>list.active&&list.reference?.publishedModel?.active).length;
    const canAnalyze=Boolean(saved&&selected),hasPublished=Boolean(reference.publishedModel?.active),candidateReady=Boolean(analyzed&&segments);
    const canActivate=Boolean(selected&&(hasPublished||candidateReady));
    const statusLabel=selected?(selected.active?'Active Model':'Saved List'):(saved?'Unsaved':'New List');
    const statusClass=selected?.active?'':selected?'inactive':saved?'pending':'inactive';
    const saveLabel=selected?'Save Changes':'Save List';
    const showEditor=Boolean(editorOpen||!portfolio.lists.length||(saved&&!selected));
    const activateLabel=selected?.active?(reference.draftDirty?'Update Model':'Model Active'):'Activate Model';
    const editorHtml=showEditor?`<div class="reference-current-card"><div class="reference-current-message">${currentMessage({saved,analyzed,segments,selected})}</div><div class="reference-current-name"><label>List name<input id="reference-list-name" value="${esc(meta.name||'')}" placeholder="e.g. Latvia Sales Training"></label><button class="primary-btn" type="button" data-save-reference-list ${saved?'':'disabled'}>${saveLabel}</button></div>
      <details class="reference-advanced"><summary>Advanced list settings</summary><div class="reference-advanced-grid"><label>Markets<input id="reference-list-markets" value="${esc((meta.markets||[]).join('; '))}" placeholder="Latvia; Baltics"></label><label>Purpose<input id="reference-list-purpose" value="${esc(meta.purpose||'')}" placeholder="What should this list help discover?"></label><button class="secondary-btn" type="button" data-download-reference-template>Download example CSV</button></div></details></div>`:'';
    panel.innerHTML=`<div class="reference-library-top"><div class="reference-library-main"><div class="reference-library-head"><strong>Customer List</strong><span class="reference-library-badge ${statusClass}">${esc(statusLabel)}</span></div><div class="reference-library-status">${portfolio.lists.length} saved list${portfolio.lists.length===1?'':'s'} · ${activeModels} active model${activeModels===1?'':'s'}. Upload → Save → Analyze → Review → Activate.</div></div><button class="secondary-btn" type="button" data-new-reference-list>+ New List</button></div>
      ${renderSavedLists(state,editorHtml)}`;
    void persistLegacyMigration(state);
  }
  function metadataFromUi(state){
    const name=clean(document.getElementById('reference-list-name')?.value);
    const markets=clean(document.getElementById('reference-list-markets')?.value).split(/\n|;|,/).map(clean).filter(Boolean);
    const purpose=clean(document.getElementById('reference-list-purpose')?.value);
    return {name:name||`Customer List ${state.referenceCustomerPortfolio.lists.length+1}`,markets,purpose};
  }
  async function saveList(){
    let state=snapshot();
    if(!state.referenceCustomers?.rows?.length)throw new Error('Add at least one customer before saving the list');
    state=Portfolio.saveCurrentList(state,metadataFromUi(state));
    editorOpen=false;
    await writeState(state);
    const status=document.getElementById('reference-import-status');if(status)status.textContent='List saved. You can analyze it now or return to it later.';
    syncLibraryUi();
    return state.referenceCustomerPortfolio.selectedListId;
  }
  async function openList(id){let state=snapshot();state=Portfolio.selectList(state,id);await writeState(state);syncLibraryUi();}
  async function viewResults(id){
    editorOpen=false;
    await openList(id);
    const review=document.getElementById('reference-segment-review');
    review?.scrollIntoView?.({behavior:'smooth',block:'start'});
  }
  async function analyzeList(id){
    editorOpen=false;
    analyzingListId=id;
    let state=snapshot();state=Portfolio.selectList(state,id);await writeState(state);syncLibraryUi();
    const button=document.getElementById('reference-analyze');if(!button)throw new Error('Analysis control is unavailable');
    button.click();
  }
  function finishAnalysis(){analyzingListId='';syncLibraryUi();}
  async function activateList(id){
    editorOpen=false;
    let state=snapshot();state=Portfolio.selectList(state,id);
    const list=state.referenceCustomerPortfolio.lists.find(item=>item.id===id);if(!list)throw new Error('Customer list is unavailable');
    if(list.active){state=Portfolio.setListActive(state,id,false);await writeState(state);syncLibraryUi();return;}
    let reference=Ref.normalizeReferenceState(state.referenceCustomers||{});
    if(!reference.publishedModel?.active){
      const segmentIds=(reference.segments||[]).map(segment=>segment.id).filter(Boolean);
      if(!Object.keys(reference.analyses||{}).length||!segmentIds.length)throw new Error('Analyze this customer list before activating it');
      reference=Ref.activateReferenceSegments(reference,segmentIds);
      reference.dna=Ref.buildReferenceDna(reference,reference.analyses||{});
      if(!reference.dna?.active)throw new Error('Analysis did not produce an activatable customer model');
      reference=Ref.publishReferenceModel(reference);state.referenceCustomers=reference;
      state=Portfolio.saveCurrentList(state,{name:list.name,markets:list.markets,purpose:list.purpose});
    }
    state=Portfolio.setListActive(state,id,true);await writeState(state);syncLibraryUi();
  }
  async function editList(id){
    editorOpen=true;
    await openList(id);
    document.getElementById('reference-list-name')?.focus();
    document.querySelector('.reference-current-card')?.scrollIntoView?.({behavior:'smooth',block:'nearest'});
  }
  async function createNewList(){editorOpen=true;let state=snapshot();state=Portfolio.newList(state);await writeState(state);syncLibraryUi();}
  async function toggleList(id,active){let state=snapshot();state=Portfolio.setListActive(state,id,active);await writeState(state);syncLibraryUi();}
  async function activateCurrent(){
    let state=snapshot();const selected=state.referenceCustomerPortfolio.lists.find(list=>list.id===state.referenceCustomerPortfolio.selectedListId)||null;
    if(!selected)throw new Error('Save the customer list before activating it');
    const reference=state.referenceCustomers||{};
    if(reference.publishedModel?.active&&!reference.draftDirty&&!selected.active){await toggleList(selected.id,true);return;}
    const button=document.getElementById('reference-activate');if(!button)throw new Error('Activation control is unavailable');
    button.click();
  }

  async function publishSelected(button){
    const selectedSegments=[...document.querySelectorAll('[data-reference-segment]:checked')].map(node=>node.dataset.referenceSegment).filter(Boolean);
    if(!selectedSegments.length)throw new Error('Analyze the list and select at least one customer segment first');
    let state=snapshot();
    let reference=Ref.normalizeReferenceState(state.referenceCustomers||{});
    reference=Ref.activateReferenceSegments(reference,selectedSegments);
    reference.dna=Ref.buildReferenceDna(reference,reference.analyses||{});
    if(!reference.dna?.active)throw new Error('Analyze the customer list before activating the model');
    reference=Ref.publishReferenceModel(reference);reference.analyzedAt=reference.analyzedAt||new Date().toISOString();state.referenceCustomers=reference;
    state=Portfolio.saveCurrentList(state,metadataFromUi(state));
    const id=state.referenceCustomerPortfolio.selectedListId;state=Portfolio.setListActive(state,id,true);
    button.disabled=true;await writeState(state);
    const status=document.getElementById('reference-action-status')||document.getElementById('reference-import-status');
    if(status)status.textContent=`Model activated · ${reference.publishedModel?.activeCount||reference.dna?.activeCount||0} reference customers. This saved list now influences Discovery.`;
    syncLibraryUi();
  }

  document.addEventListener('click',event=>{
    const activate=event.target?.closest?.('#reference-activate');
    if(activate){event.preventDefault();event.stopPropagation();event.stopImmediatePropagation();void publishSelected(activate).catch(error=>{activate.disabled=false;const status=document.getElementById('reference-action-status')||document.getElementById('reference-import-status');if(status)status.textContent=clean(error?.message)||'Unable to activate model';});return;}
    const save=event.target?.closest?.('[data-save-reference-list]');if(save){event.preventDefault();void saveList().catch(error=>{const status=document.getElementById('reference-import-status');if(status)status.textContent=clean(error?.message)||'Unable to save list';});return;}
    const analyze=event.target?.closest?.('[data-analyze-current]');if(analyze){event.preventDefault();document.getElementById('reference-analyze')?.click();return;}
    const activateCurrentButton=event.target?.closest?.('[data-activate-current]');if(activateCurrentButton){event.preventDefault();void activateCurrent().catch(error=>{const status=document.getElementById('reference-import-status');if(status)status.textContent=clean(error?.message)||'Unable to activate model';});return;}
    const download=event.target?.closest?.('[data-download-reference-template]');if(download){event.preventDefault();document.getElementById('reference-template-download')?.click();return;}
    const fresh=event.target?.closest?.('[data-new-reference-list]');if(fresh){event.preventDefault();void createNewList();return;}
    const analyzeListButton=event.target?.closest?.('[data-analyze-reference-list]');if(analyzeListButton){event.preventDefault();void analyzeList(analyzeListButton.dataset.analyzeReferenceList).catch(error=>{const status=document.getElementById('reference-import-status');if(status)status.textContent=clean(error?.message)||'Unable to analyze list';});return;}
    const viewResultsButton=event.target?.closest?.('[data-view-reference-results]');if(viewResultsButton){event.preventDefault();void viewResults(viewResultsButton.dataset.viewReferenceResults);return;}
    const activateListButton=event.target?.closest?.('[data-activate-reference-list]');if(activateListButton){event.preventDefault();void activateList(activateListButton.dataset.activateReferenceList).catch(error=>{const status=document.getElementById('reference-import-status');if(status)status.textContent=clean(error?.message)||'Unable to activate list';});return;}
    const editListButton=event.target?.closest?.('[data-edit-reference-list]');if(editListButton){event.preventDefault();void editList(editListButton.dataset.editReferenceList);return;}
    if(event.target?.closest?.('[data-reference-customers-manage]'))setTimeout(syncLibraryUi,0);
  },true);
  root.addEventListener('leadintel:reference-customers-updated',()=>setTimeout(syncLibraryUi,0));
  root.addEventListener('leadintel:server-ready',()=>setTimeout(syncLibraryUi,0));
  if(document.body&&typeof MutationObserver!=='undefined')new MutationObserver(records=>{if(records.some(record=>[...record.addedNodes].some(node=>node?.id==='reference-customer-modal'||node?.querySelector?.('#reference-customer-modal'))))setTimeout(syncLibraryUi,0);}).observe(document.body,{childList:true,subtree:true});
  root.LeadIntelReferenceCustomerLibraryUI={sync:syncLibraryUi,publishSelected,saveList,openList,viewResults,analyzeList,finishAnalysis,activateList,editList,createNewList,toggleList,activateCurrent,legacyLabels:LEGACY_LABELS};
})(globalThis);
