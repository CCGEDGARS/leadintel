const REFERENCE_LIBRARY_STATE_KEY='leadintel_customer_v2_state';

(function installReferenceCustomerLibraryUI(root){
  'use strict';
  if(typeof document==='undefined')return;
  const Ref=root.LeadIntelReferenceCustomers;
  const Portfolio=root.LeadIntelReferenceCustomerPortfolio;
  if(!Ref?.publishReferenceModel||!Ref?.markReferenceDraftChanged||!Portfolio)return;
  const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const clean=value=>String(value??'').replace(/\s+/g,' ').trim();
  let migrationSaved=false;

  function readState(){try{return JSON.parse(localStorage.getItem(REFERENCE_LIBRARY_STATE_KEY)||'{}');}catch{return {};}}
  async function writeState(state){
    localStorage.setItem(REFERENCE_LIBRARY_STATE_KEY,JSON.stringify(state));
    await root.LeadIntelServerBridge?.saveNow?.().catch(()=>null);
    root.dispatchEvent(new CustomEvent('leadintel:reference-customers-updated'));
    root.LeadIntelReferenceCustomerUI?.render?.();
  }
  function formatDate(value){if(!value)return 'Not yet';try{return new Intl.DateTimeFormat(undefined,{day:'numeric',month:'short',year:'numeric'}).format(new Date(value));}catch{return clean(value);}}
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
  function injectStyles(){
    if(document.getElementById('reference-library-styles'))return;
    const style=document.createElement('style');style.id='reference-library-styles';style.textContent=`
      .reference-library-summary{margin:14px 0 18px;padding:16px 18px;border:1px solid #d9e6e1;border-radius:14px;background:#f8fbfa;display:flex;flex-direction:column;gap:14px}
      .reference-library-top{display:flex;align-items:flex-start;justify-content:space-between;gap:16px}.reference-library-main{display:flex;flex-direction:column;gap:6px;min-width:0}.reference-library-head{display:flex;align-items:center;gap:10px;flex-wrap:wrap}.reference-library-head strong{font-size:15px;color:#10251f}.reference-library-badge{display:inline-flex;align-items:center;border-radius:999px;padding:5px 9px;font-size:10px;font-weight:800;letter-spacing:.08em;text-transform:uppercase;background:#dff4ec;color:#0d684f}.reference-library-badge.inactive{background:#edf0ef;color:#64716d}.reference-library-badge.pending{background:#fff0cf;color:#75510b}.reference-library-stats{font-size:13px;color:#5f6f77}.reference-library-status{font-size:12px;color:#607083;line-height:1.45}.reference-library-status strong{color:#1f3b32}
      .reference-library-actions{display:flex;gap:8px;flex-wrap:wrap;align-items:center}.reference-library-actions button{white-space:nowrap}.reference-library-editor{display:grid;grid-template-columns:minmax(180px,1.2fr) minmax(150px,.8fr) minmax(180px,1fr) auto;gap:10px;align-items:end}.reference-library-editor label{display:flex;flex-direction:column;gap:5px;font-size:11px;font-weight:700;color:#62706c}.reference-library-editor input{min-height:42px;border:1px solid #d3ddda;border-radius:10px;padding:9px 11px;background:white;color:#173029}
      .reference-saved-lists{display:flex;flex-direction:column;gap:8px;border-top:1px solid #e1e9e6;padding-top:12px}.reference-saved-head{display:flex;justify-content:space-between;align-items:center;gap:12px}.reference-saved-head strong{font-size:12px;color:#29453c}.reference-saved-head span{font-size:11px;color:#71807b}.reference-saved-row{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:12px;align-items:center;padding:10px 12px;border:1px solid #dfe7e4;border-radius:11px;background:#fff}.reference-saved-info{min-width:0}.reference-saved-info strong{display:block;font-size:13px;color:#173029}.reference-saved-info small{display:block;margin-top:3px;font-size:11px;color:#73817c;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.reference-saved-row.active{border-color:#9fcdbf;background:#f4fbf8}.reference-saved-row.selected{box-shadow:inset 3px 0 0 #0d684f}.reference-saved-buttons{display:flex;gap:7px;align-items:center}.reference-saved-buttons button{font-size:11px;padding:7px 10px;border-radius:8px}.reference-list-state{display:inline-flex;margin-left:7px;border-radius:999px;padding:3px 7px;font-size:9px;font-weight:800;letter-spacing:.06em;text-transform:uppercase;background:#edf0ef;color:#65736e}.reference-list-state.active{background:#dff4ec;color:#0d684f}
      .reference-library-ready{color:#0d684f!important;font-weight:700}.reference-library-pending{color:#8b6208!important;font-weight:700}
      @media(max-width:900px){.reference-library-editor{grid-template-columns:1fr 1fr}.reference-library-editor .reference-save-list{grid-column:1/-1}.reference-library-top{flex-direction:column}}
      @media(max-width:650px){.reference-library-editor{grid-template-columns:1fr}.reference-library-editor .reference-save-list{grid-column:auto}.reference-saved-row{grid-template-columns:1fr}.reference-saved-buttons{justify-content:flex-start}}
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
  function renderSavedLists(state){
    const portfolio=state.referenceCustomerPortfolio,selectedId=portfolio.selectedListId;
    if(!portfolio.lists.length)return '<div class="reference-saved-lists"><div class="reference-saved-head"><strong>Saved customer lists</strong><span>No saved lists yet</span></div></div>';
    return `<div class="reference-saved-lists"><div class="reference-saved-head"><strong>Saved customer lists</strong><span>${portfolio.lists.length} saved · ${portfolio.lists.filter(x=>x.active).length} active</span></div>${portfolio.lists.map(list=>{
      const ref=list.reference||{},rows=ref.rows?.length||0,analyzed=Object.keys(ref.analyses||{}).length,model=ref.publishedModel;
      return `<div class="reference-saved-row ${list.active?'active':''} ${list.id===selectedId?'selected':''}" data-reference-list-row="${esc(list.id)}"><div class="reference-saved-info"><strong>${esc(list.name)}<span class="reference-list-state ${list.active?'active':''}">${list.active?'Active':'Saved'}</span></strong><small>${rows} customers · ${analyzed} analyzed${model?` · ${esc(model.confidence||'low')} confidence`:''}${list.markets?.length?` · ${esc(list.markets.join(' · '))}`:''}</small></div><div class="reference-saved-buttons"><button class="secondary-btn" type="button" data-open-reference-list="${esc(list.id)}">Open</button>${model?`<button class="${list.active?'secondary-btn':'primary-btn'}" type="button" data-toggle-reference-list="${esc(list.id)}" data-next-active="${list.active?'false':'true'}">${list.active?'Deactivate':'Activate'}</button>`:''}</div></div>`;
    }).join('')}</div>`;
  }
  function syncLibraryUi(){
    injectStyles();
    const modal=document.getElementById('reference-customer-modal');if(!modal)return;
    const panel=ensurePanel(modal);if(!panel)return;
    const state=snapshot(),reference=state.referenceCustomers,portfolio=state.referenceCustomerPortfolio,meta=listMeta(state);
    const saved=reference.rows.length,analyzed=Object.keys(reference.analyses||{}).length,segments=(reference.segments||[]).length;
    const candidateReady=Boolean(reference.draftDirty&&analyzed>0&&segments>0)||Boolean(!reference.publishedModel&&analyzed>0&&segments>0);
    const activeModels=portfolio.lists.filter(list=>list.active&&list.reference?.publishedModel?.active).length;
    const selected=portfolio.lists.find(list=>list.id===portfolio.selectedListId)||null;
    const statusLabel=selected?(selected.active?'Active':'Saved'):(saved?'Unsaved draft':'New list');
    const statusClass=selected?.active?'':selected?'inactive':saved?'pending':'inactive';
    panel.innerHTML=`<div class="reference-library-top"><div class="reference-library-main"><div class="reference-library-head"><strong>Reference Customer Library</strong><span class="reference-library-badge ${statusClass}">${esc(statusLabel)}</span></div><div class="reference-library-stats">${portfolio.lists.length} saved lists · ${activeModels} active models · current draft: ${saved} customers</div><div class="reference-library-status">Save customer lists for future use. Analysis and activation are separate, and multiple saved models can be active at the same time.</div></div><div class="reference-library-actions"><button class="secondary-btn" type="button" data-new-reference-list>+ New list</button></div></div>
      <div class="reference-library-editor"><label>List name<input id="reference-list-name" value="${esc(meta.name||'') }" placeholder="e.g. Latvia Sales Training"></label><label>Markets<input id="reference-list-markets" value="${esc((meta.markets||[]).join('; '))}" placeholder="Latvia; Baltics"></label><label>Purpose<input id="reference-list-purpose" value="${esc(meta.purpose||'')}" placeholder="What should this list help discover?"></label><button class="primary-btn reference-save-list" type="button" data-save-reference-list ${saved?'':'disabled'}>Save list</button></div>
      ${renderSavedLists(state)}`;
    const activate=modal.querySelector('#reference-activate');
    if(activate){
      const hasPublished=Boolean(reference.publishedModel?.active),isCurrentActive=Boolean(selected?.active);
      activate.textContent=isCurrentActive?'Update Active Model':hasPublished?'Save & Activate Model':'Activate Reference Customer Model';
      activate.title=candidateReady?'Publish the selected analyzed segments and make this list active in Discovery.':'Analyze the list and select at least one segment before activation.';
    }
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
    await writeState(state);syncLibraryUi();
    return state.referenceCustomerPortfolio.selectedListId;
  }
  async function openList(id){let state=snapshot();state=Portfolio.selectList(state,id);await writeState(state);syncLibraryUi();}
  async function createNewList(){let state=snapshot();state=Portfolio.newList(state);await writeState(state);syncLibraryUi();}
  async function toggleList(id,active){let state=snapshot();state=Portfolio.setListActive(state,id,active);await writeState(state);syncLibraryUi();}

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
    const fresh=event.target?.closest?.('[data-new-reference-list]');if(fresh){event.preventDefault();void createNewList();return;}
    const open=event.target?.closest?.('[data-open-reference-list]');if(open){event.preventDefault();void openList(open.dataset.openReferenceList);return;}
    const toggle=event.target?.closest?.('[data-toggle-reference-list]');if(toggle){event.preventDefault();void toggleList(toggle.dataset.toggleReferenceList,toggle.dataset.nextActive==='true');return;}
    if(event.target?.closest?.('[data-reference-customers-manage]'))setTimeout(syncLibraryUi,0);
  },true);
  root.addEventListener('leadintel:reference-customers-updated',()=>setTimeout(syncLibraryUi,0));
  root.addEventListener('leadintel:server-ready',()=>setTimeout(syncLibraryUi,0));
  if(document.body&&typeof MutationObserver!=='undefined')new MutationObserver(records=>{if(records.some(record=>[...record.addedNodes].some(node=>node?.id==='reference-customer-modal'||node?.querySelector?.('#reference-customer-modal'))))setTimeout(syncLibraryUi,0);}).observe(document.body,{childList:true,subtree:true});
  root.LeadIntelReferenceCustomerLibraryUI={sync:syncLibraryUi,publishSelected,saveList,openList,createNewList,toggleList};
})(globalThis);
