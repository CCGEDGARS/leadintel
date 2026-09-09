const INTELLIGENCE_PROFILE_ASSET_VERSION='20260909-canonical-profile-v4';
(function installIntelligenceProfileRuntime(root){
  if(typeof document==='undefined')return;
  const UI=root.LeadIntelIntelligenceProfileUI;
  const Evidence=root.LeadIntelEvidenceView;
  if(!UI)return;
  const STORAGE_KEY='leadintel_customer_v2_state';
  let applying=false;
  let editing=false;
  function addCss(href){if(document.querySelector(`link[href^="${href.split('?')[0]}"]`))return;const link=document.createElement('link');link.rel='stylesheet';link.href=href;document.head.appendChild(link);}
  addCss(`intelligence-profile.css?v=${INTELLIGENCE_PROFILE_ASSET_VERSION}`);
  addCss(`reference-customers.css?v=${INTELLIGENCE_PROFILE_ASSET_VERSION}`);
  function readState(){try{return JSON.parse(localStorage.getItem(STORAGE_KEY)||'{}');}catch{return {};}}
  function writeState(state){localStorage.setItem(STORAGE_KEY,JSON.stringify(state));}
  function toast(message){const node=document.getElementById('toast');if(!node)return;node.textContent=message;node.classList.add('show');clearTimeout(toast.t);toast.t=setTimeout(()=>node.classList.remove('show'),2600);}
  function profileIsEditing(){return Boolean(editing);}
  function setEditButton(isEditing){const button=document.getElementById('edit-profile');if(!button)return;button.textContent=isEditing?'Save edits':'Edit profile';button.setAttribute('aria-pressed',isEditing?'true':'false');}
  function replaceProfileGrid(force=false){
    const editor=document.getElementById('profile-editor');if(!editor)return;
    const state=readState(),profile=state.profile;if(!profile?.canonical?.fields)return;
    const edit=profileIsEditing();
    const signature=JSON.stringify([profile.canonical.generatedAt,profile.canonical.diagnostics,profile.canonical.contradictions,state.referenceCustomers?.fingerprint,state.referenceCustomers?.analyzedAt,edit]);
    if(!force&&editor.dataset.canonicalSignature===signature&&editor.querySelector('.intel-profile-shell')){setEditButton(edit);return;}
    editor.className='intel-profile-mount';editor.innerHTML=UI.render(profile,{edit,referenceCustomers:state.referenceCustomers||{},targetMarkets:state.targetMarkets||[]});editor.dataset.canonicalSignature=signature;
    setEditButton(edit);upgradeStatus(state);compactSignals(profile);compactEvidence(profile);retireLegacyLookalike();
  }
  function enterEditMode(){editing=true;const editor=document.getElementById('profile-editor');if(editor)delete editor.dataset.canonicalSignature;replaceProfileGrid(true);setEditButton(true);setTimeout(()=>document.querySelector('#profile-editor [data-profile-field]')?.focus(),0);}
  function saveCanonicalEdits(){
    const state=readState();const profile=state.profile;const editor=document.getElementById('profile-editor');if(!profile?.canonical?.fields||!editor){editing=false;setEditButton(false);return false;}
    editor.querySelectorAll('[data-profile-field]').forEach(field=>{
      const key=field.dataset.profileField;const value=String(field.value||'').trim();const previous=profile.canonical.fields[key]||{};
      profile[key]=value;
      profile.canonical.fields[key]={...previous,value,status:value?'user_confirmed':'unknown',confidence:value?'high':'low'};
      if(Array.isArray(profile.canonical.diagnostics)){
        const row=profile.canonical.diagnostics.find(item=>item.field===key||item.key===key);
        if(row){row.state=value?'known':'missing';row.status=value?'user_confirmed':'unknown';}
      }
    });
    state.profile=profile;state.approved=false;writeState(state);editing=false;
    delete editor.dataset.canonicalSignature;replaceProfileGrid(true);setEditButton(false);upgradeStatus(state);
    root.dispatchEvent(new CustomEvent('leadintel:workspace-changed',{detail:{source:'canonical-profile-edit'}}));
    root.LeadIntelWorkspacePersistence?.saveWorkspace?.().catch?.(()=>null);
    toast('Profile edits saved');
    return true;
  }
  function upgradeStatus(state){const status=document.getElementById('profile-status');if(!status)return;const diagnostics=state.profile?.canonical?.diagnostics||[];const known=diagnostics.filter(x=>x.state==='known').length,review=diagnostics.filter(x=>x.state==='needs_confirmation').length,missing=diagnostics.filter(x=>x.state==='missing').length;status.textContent=state.approved?'Confirmed profile':`${known} known · ${review} review · ${missing} missing`;}
  function compactSignals(profile){const list=document.getElementById('recommended-signals');const panel=list?.closest('.signals-panel');if(!list||!panel)return;const active=(profile.recommendedSignals||[]).filter(x=>x.active!==false);panel.classList.add('intel-signal-summary-panel');const title=panel.querySelector('.section-title');if(title)title.innerHTML=`<div><span class="eyebrow">Signal focus</span><h3>${active.length} active signal themes</h3><p>The detailed signal library belongs in Market Strategy, where weights and keywords can be edited.</p></div>`;list.innerHTML=`<div class="intel-signal-summary"><span>${active.slice(0,5).map(x=>`<b>${escapeHtml(x.name)}</b>`).join('')}</span><button class="secondary-btn small" type="button" data-open-signal-designer>Open Signal Designer →</button></div>`;}
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
  function escapeHtml(value){return String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}
  function apply(){if(applying)return;applying=true;try{replaceProfileGrid();retireLegacyLookalike();}finally{applying=false;}}
  document.addEventListener('click',event=>{
    const editButton=event.target.closest('#edit-profile');
    if(editButton){event.preventDefault();event.stopImmediatePropagation();if(profileIsEditing())saveCanonicalEdits();else enterEditMode();return;}
    if(event.target.closest('[data-open-signal-designer]')){event.preventDefault();document.querySelector('[data-step-marker="4"]')?.click();setTimeout(()=>document.getElementById('signal-designer')?.scrollIntoView({behavior:'smooth',block:'start'}),80);}
  },true);
  window.addEventListener('leadintel:reference-customers-updated',()=>setTimeout(apply,0));
  const observer=new MutationObserver(()=>queueMicrotask(apply));observer.observe(document.documentElement,{subtree:true,childList:true,attributes:true,attributeFilter:['readonly','hidden','class']});
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',apply,{once:true});else apply();
  root.LeadIntelIntelligenceProfileRuntime={apply,enterEditMode,saveCanonicalEdits};
})(globalThis);
