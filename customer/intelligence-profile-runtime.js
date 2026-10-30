const INTELLIGENCE_PROFILE_ASSET_VERSION='20260921-two-stage-profile-action-v1&review=20261001-v2';
const REFERENCE_CUSTOMERS_CSS_VERSION='20260923-reference-interface-v1&target-segments=1&profile-ux=1&target-list-edit=1&opportunity-map=1&profile-source=1&inline-activate=1&saving-mode=1&target-controls=1&target-save=1&target-status=1&company-workflow=20261001-v2&profile-market=20261001-v1';
(function installIntelligenceProfileRuntime(root){
  if(typeof document==='undefined')return;
  const UI=root.LeadIntelIntelligenceProfileUI;
  const Evidence=root.LeadIntelEvidenceView;
  if(!UI)return;
  const STORAGE_KEY='leadintel_customer_v2_state';
  let applying=false;
  let editing=false;
  let editContext=null;
  function addCss(href){if(document.querySelector(`link[href^="${href.split('?')[0]}"]`))return;const link=document.createElement('link');link.rel='stylesheet';link.href=href;document.head.appendChild(link);}
  addCss(`intelligence-profile.css?v=${INTELLIGENCE_PROFILE_ASSET_VERSION}`);
  addCss(`reference-customers.css?v=${REFERENCE_CUSTOMERS_CSS_VERSION}&reference-discovery=5`);
  function readState(){try{return JSON.parse(localStorage.getItem(STORAGE_KEY)||'{}');}catch{return {};}}
  function writeState(state){localStorage.setItem(STORAGE_KEY,JSON.stringify(state));}
  function toast(message){const node=document.getElementById('toast');if(!node)return;node.textContent=message;node.classList.add('show');clearTimeout(toast.t);toast.t=setTimeout(()=>node.classList.remove('show'),2600);}
  function profileIsEditing(){return Boolean(editing);}
  function setEditButton(isEditing){const button=document.getElementById('edit-profile');if(!button)return;button.textContent=isEditing?'Save edits':'Edit profile';button.setAttribute('aria-pressed',isEditing?'true':'false');}
  function installCanonicalCompat(editor){
    if(!editor)return;
    const fields=['businessSummary','uniqueSellingProposition','elevatorPitch'];
    for(const key of fields){
      if(editor.querySelector(`[data-canonical-compat][data-profile-field="${key}"]`))continue;
      const marker=document.createElement('span');marker.hidden=true;marker.dataset.canonicalCompat='true';marker.dataset.profileField=key;editor.appendChild(marker);
    }
  }
  function replaceProfileGrid(force=false){
    const editor=document.getElementById('profile-editor');if(!editor)return;
    const state=readState(),profile=state.profile;if(!profile?.canonical?.fields)return;
    const edit=profileIsEditing();
    const signature=JSON.stringify([profile.canonical.generatedAt,profile.canonical.diagnostics,profile.canonical.contradictions,state.referenceCustomers?.fingerprint,state.referenceCustomers?.analyzedAt,edit]);
    if(!force&&editor.dataset.canonicalSignature===signature&&editor.querySelector('.intel-profile-shell')){installCanonicalCompat(editor);setEditButton(edit);return;}
    editor.className='intel-profile-mount';editor.innerHTML=UI.render(profile,{edit,referenceCustomers:state.referenceCustomers||{},targetMarkets:state.targetMarkets||[],market:state.market||{}});installCanonicalCompat(editor);editor.dataset.canonicalSignature=signature;
    setEditButton(edit);upgradeStatus(state);compactSignals(profile);compactEvidence(profile);retireLegacyLookalike();
  }
  function contextIdentity(state){return JSON.stringify([localStorage.getItem('leadintel_account_context_v1'),root.LeadIntelServerBridge?.workspace?.id||'',root.LeadIntelServerBridge?.session?.user?.id||'',state.website||'']);}
  function enterEditMode(){const state=readState();editContext={identity:contextIdentity(state),fields:JSON.parse(JSON.stringify(state.profile?.canonical?.fields||{}))};editing=true;const editor=document.getElementById('profile-editor');if(editor)delete editor.dataset.canonicalSignature;replaceProfileGrid(true);setEditButton(true);setTimeout(()=>document.querySelector('#profile-editor [data-profile-field]:not([data-canonical-compat])')?.focus(),0);}
  function saveCanonicalEdits(){
    const state=readState();const profile=state.profile;const editor=document.getElementById('profile-editor');if(!profile?.canonical?.fields||!editor){editing=false;setEditButton(false);return false;}
    if(!editing||!editContext||editContext.identity!==contextIdentity(state)||typeof root.LeadIntelAccountCache?.current==='function'&&!root.LeadIntelAccountCache.current()){toast('Workspace changed. Reopen the profile before saving edits.');return false;}
    const changed=[...editor.querySelectorAll('[data-profile-field]:not([data-canonical-compat])')].filter(field=>String(field.value||'').trim()!==String(editContext.fields[field.dataset.profileField]?.value||'').trim());
    if(changed.some(field=>JSON.stringify(profile.canonical.fields[field.dataset.profileField])!==JSON.stringify(editContext.fields[field.dataset.profileField]))){toast('Profile changed while editing. Reopen it to review the latest values.');return false;}
    if(!changed.length){editing=false;editContext=null;replaceProfileGrid(true);setEditButton(false);return true;}
    changed.forEach(field=>{
      const key=field.dataset.profileField;const value=String(field.value||'').trim();const previous=profile.canonical.fields[key]||{};
      profile[key]=value;
      profile.canonical.fields[key]={...previous,value,status:value?'user_confirmed':'unknown',provenance:'user',sourceIds:[`U:${key}`],confidence:value?'high':'low',updatedAt:new Date().toISOString()};
      const answerKey=root.LeadIntelCanonicalIntelligence?.FIELD_MAP?.[key];
      if(key==='commercialObjective')state.workspaceGoals={...(state.workspaceGoals||{}),successOutcome:value};
      else if(answerKey){state.answers={...(state.answers||{}),[answerKey]:value};state.answerStatus={...(state.answerStatus||{}),[answerKey]:value?'user':'missing'};}
      if(key==='targetMarkets')state.targetMarkets=root.LeadIntelProfile?.normalizeTargetMarkets?.(value)||value.split(';').map(item=>item.trim()).filter(Boolean);
      if(Array.isArray(profile.canonical.diagnostics)){
        const row=profile.canonical.diagnostics.find(item=>item.field===key||item.key===key);
        if(row){row.state=value?'known':'missing';row.status=value?'user_confirmed':'unknown';}
      }
    });
    const changedAnswers=changed.map(field=>root.LeadIntelCanonicalIntelligence?.FIELD_MAP?.[field.dataset.profileField]).filter(Boolean);
    if(root.LeadIntelStep2Brief?.applyAnswers)Object.assign(state,root.LeadIntelStep2Brief.applyAnswers(state,changedAnswers));
    root.LeadIntelCanonicalIntelligence?.finalizeProfileQuality?.(state.profile,state);
    state.approved=false;state.market={...(state.market||{}),strategyApproved:false,strategyApprovedAt:''};writeState(state);editing=false;editContext=null;
    delete editor.dataset.canonicalSignature;replaceProfileGrid(true);setEditButton(false);upgradeStatus(state);
    root.dispatchEvent(new CustomEvent('leadintel:workspace-changed',{detail:{source:'canonical-profile-edit'}}));
    root.LeadIntelWorkspacePersistence?.saveWorkspace?.().catch?.(()=>null);
    toast('Profile edits saved');
    return true;
  }
  function upgradeStatus(state){
    const profile=state.profile;
    if(profile?.canonical?.fields)root.LeadIntelCanonicalIntelligence?.finalizeProfileQuality?.(profile,state);
    const score=document.getElementById('profile-completeness');if(score&&profile)score.textContent=`${profile.completeness}%`;
    const label=score?.parentElement?.querySelector?.('small');if(label)label.textContent='Profile review completeness';
    const status=document.getElementById('profile-status');if(!status)return;const diagnostics=state.profile?.canonical?.diagnostics||[];const known=diagnostics.filter(x=>x.state==='known').length,review=diagnostics.filter(x=>x.state==='needs_confirmation').length,missing=diagnostics.filter(x=>x.state==='missing').length;status.textContent=state.approved?'Confirmed profile':`${known} known · ${review} review · ${missing} missing`;}
  function compactSignals(profile){const list=document.getElementById('recommended-signals');const panel=list?.closest('.signals-panel');if(!list||!panel)return;const market=readState().market||{};const configured=Boolean(market.signals?.length);const active=(configured?market.signals:profile.recommendedSignals||[]).filter(x=>x.active!==false);panel.classList.add('intel-signal-summary-panel','intel-attention-panel');const title=panel.querySelector('.section-title');if(title)title.innerHTML=`<div><span class="eyebrow">Signal focus</span><h3>${active.length} ${configured?'enabled buying signals':'suggested buying signals'}</h3><p>Approve the profile below, then edit signal weights and keywords in Strategy.</p></div>`;list.innerHTML=`<div class="intel-signal-summary" role="list" aria-label="Buying signals">${active.slice(0,5).map((x,index)=>`<article class="intel-signal-theme" role="listitem"><span>${String(index+1).padStart(2,'0')}</span><strong>${escapeHtml(x.name)}</strong></article>`).join('')}</div>`;}
  function compactEvidence(profile){
    const lower=document.querySelector('.profile-lower-grid');if(!lower)return;
    const panels=[...lower.children];if(!panels.length)return;
    const first=panels[0],second=panels[1];
    const firstParty=Array.isArray(profile.evidenceSources)?profile.evidenceSources:[];
    const docs=Number(profile.sourceSummary?.documents||0);
    const external=(profile.externalValidationSources||[]).length;
    const contradictions=(profile.canonical?.contradictions||[]).length;
    lower.classList.add('intel-lower-compact');
    if(first){
      first.classList.add('intel-evidence-panel');
      const summary=first.querySelector('#source-summary');
      if(summary)summary.innerHTML=`<span class="source-chip">First-party evidence ${firstParty.length}</span><span class="source-chip">Uploaded documents ${docs}</span><span class="source-chip">External validation ${external}</span><span class="source-chip">Contradictions ${contradictions}</span>`;
      const digest=first.querySelector('#evidence-digest');
      if(digest&&Evidence?.renderEvidence)digest.innerHTML=Evidence.renderEvidence(profile);
    }
    if(second)second.remove();
  }
  function retireLegacyLookalike(){const node=document.querySelector('[data-question="lookalike_customers"]');const card=node?.closest('.question-card');if(card)card.remove();}
  function escapeHtml(value){return String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot',"'":'&#39;'}[c]));}
  function apply(){if(editing)return;if(applying)return;applying=true;try{replaceProfileGrid();retireLegacyLookalike();}finally{applying=false;}}
  function installApprovedProfileRestore(){
    const editor=document.getElementById('profile-editor');
    if(!editor||typeof MutationObserver==='undefined')return;
    const observer=new MutationObserver(()=>{
      if(editing)return;
      if(applying)return;
      if(editor.querySelector('.profile-field')&&!editor.querySelector('.intel-profile-shell'))queueMicrotask(apply);
    });
    observer.observe(editor,{childList:true});
  }
  document.addEventListener('click',event=>{
    const editButton=event.target.closest('#edit-profile');
    if(editButton){event.preventDefault();event.stopImmediatePropagation();if(profileIsEditing())saveCanonicalEdits();else enterEditMode();return;}
  },true);
  root.addEventListener('leadintel:reference-customers-updated',()=>setTimeout(apply,0));
  root.addEventListener('leadintel:workspace-changed',()=>setTimeout(apply,0));
  root.addEventListener('leadintel:module-opened',event=>{if(Number(event.detail?.step)===3)setTimeout(apply,0);});
  root.addEventListener('leadintel:server-ready',()=>setTimeout(apply,0));
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>{installApprovedProfileRestore();apply();},{once:true});else{installApprovedProfileRestore();apply();}
  root.LeadIntelIntelligenceProfileRuntime={apply,enterEditMode,saveCanonicalEdits,profileIsEditing};
})(globalThis);
