const REFERENCE_LIBRARY_STATE_KEY='leadintel_customer_v2_state';

(function installReferenceCustomerLibraryUI(root){
  'use strict';
  if(typeof document==='undefined')return;
  const Ref=root.LeadIntelReferenceCustomers;
  if(!Ref?.publishReferenceModel||!Ref?.markReferenceDraftChanged)return;
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
      .reference-library-summary{margin:14px 0 18px;padding:16px 18px;border:1px solid #d9e6e1;border-radius:14px;background:#f8fbfa;display:grid;grid-template-columns:minmax(0,1.4fr) minmax(230px,.8fr);gap:18px;align-items:center}
      .reference-library-main{display:flex;flex-direction:column;gap:7px;min-width:0}.reference-library-head{display:flex;align-items:center;gap:10px;flex-wrap:wrap}.reference-library-head strong{font-size:15px;color:#10251f}.reference-library-badge{display:inline-flex;align-items:center;border-radius:999px;padding:5px 9px;font-size:10px;font-weight:800;letter-spacing:.08em;text-transform:uppercase;background:#dff4ec;color:#0d684f}.reference-library-badge.inactive{background:#edf0ef;color:#64716d}.reference-library-badge.pending{background:#fff0cf;color:#75510b}.reference-library-stats{font-size:13px;color:#5f6f77}.reference-library-status{font-size:12px;color:#607083;line-height:1.45}.reference-library-status strong{color:#1f3b32}.reference-library-model{border-left:1px solid #dfe8e5;padding-left:18px;display:flex;flex-direction:column;gap:5px}.reference-library-model span{font-size:11px;color:#728078;text-transform:uppercase;letter-spacing:.06em;font-weight:700}.reference-library-model strong{font-size:13px;color:#19352c}.reference-library-model small{font-size:11px;color:#74807c}.reference-library-ready{color:#0d684f!important;font-weight:700}.reference-library-pending{color:#8b6208!important;font-weight:700}
      @media(max-width:760px){.reference-library-summary{grid-template-columns:1fr}.reference-library-model{border-left:0;border-top:1px solid #dfe8e5;padding:12px 0 0}}
    `;document.head.appendChild(style);
  }
  function librarySnapshot(){
    const state=readState();
    const raw=state.referenceCustomers||{};
    const reference=Ref.normalizeReferenceState(raw);
    return {state,raw,reference};
  }
  async function persistLegacyMigration(snapshot){
    if(migrationSaved||snapshot.raw?.publishedModel||!snapshot.reference.publishedModel)return;
    migrationSaved=true;
    snapshot.state.referenceCustomers=snapshot.reference;
    await writeState(snapshot.state);
  }
  function syncLibraryUi(){
    injectStyles();
    const modal=document.getElementById('reference-customer-modal');if(!modal)return;
    const panel=ensurePanel(modal);if(!panel)return;
    const snapshot=librarySnapshot(),reference=snapshot.reference,published=reference.publishedModel;
    const saved=reference.rows.length,analyzed=Object.keys(reference.analyses||{}).length,segments=(reference.segments||[]).length;
    const candidateReady=Boolean(reference.draftDirty&&analyzed>0&&segments>0);
    const statusLabel=!published?'No active model':reference.draftDirty?(candidateReady?'New version ready':'Pending model update'):'Model active';
    const statusClass=!published?'inactive':reference.draftDirty?'pending':'';
    const modelCount=Number(published?.activeCount||published?.dna?.activeCount||0);
    panel.innerHTML=`<div class="reference-library-main"><div class="reference-library-head"><strong>Reference Customer Library</strong><span class="reference-library-badge ${statusClass}">${esc(statusLabel)}</span></div><div class="reference-library-stats">${saved} saved · ${analyzed} analyzed · ${segments} ${segments===1?'segment':'segments'}</div><div class="reference-library-status">${published?reference.draftDirty?(candidateReady?'<strong class="reference-library-ready">New version ready.</strong> Discovery continues using the current active model until you update it.':'<strong class="reference-library-pending">Pending model update.</strong> Your saved library changed, but Discovery continues using the current active model.'):'The saved model is active in Discovery and remains active across sessions.':'Analyze the saved library, review the segments, then activate the model for Discovery.'}</div></div><div class="reference-library-model"><span>Current active model</span><strong>${published?`${modelCount} reference customers · ${esc(published.confidence||'low')} confidence`:'Not activated yet'}</strong><small>${published?`Last updated ${esc(formatDate(published.updatedAt||published.activatedAt))}`:'Your uploaded customer library is saved separately from activation.'}</small></div>`;
    const activate=modal.querySelector('#reference-activate');
    if(activate){activate.textContent=published?'Update active model':'Activate selected segments';activate.title=published&&reference.draftDirty?'Publish the reviewed customer model without interrupting the current Discovery model':'';}
    void persistLegacyMigration(snapshot);
  }

  async function publishSelected(button){
    const selected=[...document.querySelectorAll('[data-reference-segment]:checked')].map(node=>node.dataset.referenceSegment).filter(Boolean);
    if(!selected.length)return;
    const state=readState();
    let reference=Ref.normalizeReferenceState(state.referenceCustomers||{});
    reference=Ref.activateReferenceSegments(reference,selected);
    reference.dna=Ref.buildReferenceDna(reference,reference.analyses||{});
    if(!reference.dna?.active)throw new Error('Analyze the customer list before activating the model');
    reference=Ref.publishReferenceModel(reference);
    reference.analyzedAt=reference.analyzedAt||new Date().toISOString();
    state.referenceCustomers=reference;
    button.disabled=true;
    await writeState(state);
    const status=document.getElementById('reference-action-status')||document.getElementById('reference-import-status');
    if(status)status.textContent=`Active model updated · ${reference.publishedModel?.activeCount||reference.dna?.activeCount||0} reference customers. Discovery now uses this version.`;
    syncLibraryUi();
  }

  document.addEventListener('click',event=>{
    const activate=event.target?.closest?.('#reference-activate');
    if(activate){
      event.preventDefault();event.stopPropagation();event.stopImmediatePropagation();
      void publishSelected(activate).catch(error=>{activate.disabled=false;const status=document.getElementById('reference-action-status')||document.getElementById('reference-import-status');if(status)status.textContent=clean(error?.message)||'Unable to update active model';});
      return;
    }
    if(event.target?.closest?.('[data-reference-customers-manage]'))setTimeout(syncLibraryUi,0);
  },true);
  root.addEventListener('leadintel:reference-customers-updated',()=>setTimeout(syncLibraryUi,0));
  root.addEventListener('leadintel:server-ready',()=>setTimeout(syncLibraryUi,0));
  if(document.body&&typeof MutationObserver!=='undefined')new MutationObserver(records=>{if(records.some(record=>[...record.addedNodes].some(node=>node?.id==='reference-customer-modal'||node?.querySelector?.('#reference-customer-modal'))))setTimeout(syncLibraryUi,0);}).observe(document.body,{childList:true,subtree:true});
  root.LeadIntelReferenceCustomerLibraryUI={sync:syncLibraryUi,publishSelected};
})(globalThis);
