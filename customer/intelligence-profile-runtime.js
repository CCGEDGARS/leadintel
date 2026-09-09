const INTELLIGENCE_PROFILE_ASSET_VERSION='20260909-canonical-profile-v1';
(function installIntelligenceProfileRuntime(root){
  if(typeof document==='undefined')return;
  const UI=root.LeadIntelIntelligenceProfileUI;
  if(!UI)return;
  const STORAGE_KEY='leadintel_customer_v2_state';
  let applying=false;
  function addCss(href){if(document.querySelector(`link[href^="${href.split('?')[0]}"]`))return;const link=document.createElement('link');link.rel='stylesheet';link.href=href;document.head.appendChild(link);}
  addCss(`intelligence-profile.css?v=${INTELLIGENCE_PROFILE_ASSET_VERSION}`);
  addCss(`reference-customers.css?v=${INTELLIGENCE_PROFILE_ASSET_VERSION}`);
  function readState(){try{return JSON.parse(localStorage.getItem(STORAGE_KEY)||'{}');}catch{return {};}}
  function profileIsEditing(editor){return Boolean(editor?.querySelector('textarea:not([readonly])'));}
  function replaceProfileGrid(){
    const editor=document.getElementById('profile-editor');if(!editor)return;
    const state=readState(),profile=state.profile;if(!profile?.canonical?.fields)return;
    const signature=JSON.stringify([profile.canonical.generatedAt,profile.canonical.diagnostics,profile.canonical.contradictions,state.referenceCustomers?.fingerprint,state.referenceCustomers?.analyzedAt,profileIsEditing(editor)]);
    if(editor.dataset.canonicalSignature===signature)return;
    const edit=profileIsEditing(editor);editor.className='intel-profile-mount';editor.innerHTML=UI.render(profile,{edit,referenceCustomers:state.referenceCustomers||{},targetMarkets:state.targetMarkets||[]});editor.dataset.canonicalSignature=signature;
    upgradeStatus(state);compactSignals(profile);compactEvidence(profile,state);retireLegacyLookalike();
  }
  function upgradeStatus(state){const status=document.getElementById('profile-status');if(!status)return;const diagnostics=state.profile?.canonical?.diagnostics||[];const known=diagnostics.filter(x=>x.state==='known').length,review=diagnostics.filter(x=>x.state==='needs_confirmation').length,missing=diagnostics.filter(x=>x.state==='missing').length;status.textContent=state.approved?'Confirmed profile':`${known} known · ${review} review · ${missing} missing`;}
  function compactSignals(profile){const list=document.getElementById('recommended-signals');const panel=list?.closest('.signals-panel');if(!list||!panel)return;const active=(profile.recommendedSignals||[]).filter(x=>x.active!==false);panel.classList.add('intel-signal-summary-panel');const title=panel.querySelector('.section-title');if(title)title.innerHTML=`<div><span class="eyebrow">Signal focus</span><h3>${active.length} active signal themes</h3><p>The detailed signal library belongs in Market Strategy, where weights and keywords can be edited.</p></div>`;list.innerHTML=`<div class="intel-signal-summary"><span>${active.slice(0,5).map(x=>`<b>${escapeHtml(x.name)}</b>`).join('')}</span><button class="secondary-btn small" type="button" data-open-signal-designer>Open Signal Designer →</button></div>`;}
  function compactEvidence(profile,state){const lower=document.querySelector('.profile-lower-grid');if(!lower)return;const panels=[...lower.children];if(!panels.length)return;const first=panels[0],second=panels[1];const firstParty=Array.isArray(profile.evidenceSources)?profile.evidenceSources:[];const docs=Number(profile.sourceSummary?.documents||0);const external=(profile.externalValidationSources||[]).length;const contradictions=(profile.canonical?.contradictions||[]).length;if(first){const summary=first.querySelector('#source-summary');if(summary)summary.innerHTML=`<span class="source-chip">First-party evidence ${firstParty.length}</span><span class="source-chip">Uploaded documents ${docs}</span><span class="source-chip">External validation ${external}</span><span class="source-chip">Contradictions ${contradictions}</span>`;first.classList.add('intel-evidence-panel');}if(second){second.classList.add('intel-quality-legacy-panel');const gaps=second.querySelector('#information-gaps');if(gaps){const diagnostics=profile.canonical?.diagnostics||[];gaps.innerHTML=UI.renderProfileQuality(diagnostics);}const title=second.querySelector('.section-title');if(title)title.innerHTML='<span class="eyebrow">Profile quality</span><h3>What is known, inferred or genuinely missing</h3>';}}
  function retireLegacyLookalike(){const node=document.querySelector('[data-question="lookalike_customers"]');const card=node?.closest('.question-card');if(card)card.remove();}
  function escapeHtml(value){return String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}
  function apply(){if(applying)return;applying=true;try{replaceProfileGrid();retireLegacyLookalike();}finally{applying=false;}}
  document.addEventListener('click',event=>{if(event.target.closest('[data-open-signal-designer]')){event.preventDefault();document.querySelector('[data-step-marker="4"]')?.click();setTimeout(()=>document.getElementById('signal-designer')?.scrollIntoView({behavior:'smooth',block:'start'}),80);}});
  window.addEventListener('leadintel:reference-customers-updated',()=>setTimeout(apply,0));
  const observer=new MutationObserver(()=>queueMicrotask(apply));observer.observe(document.documentElement,{subtree:true,childList:true,attributes:true,attributeFilter:['readonly','hidden','class']});
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',apply,{once:true});else apply();
  root.LeadIntelIntelligenceProfileRuntime={apply};
})(globalThis);
