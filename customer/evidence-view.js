if(typeof window!=="undefined"){
  void import('./company-brain.js?v=20260907-company-brain-v1')
    .then(()=>import('./canonical-intelligence.js?v=20260909-canonical-profile-v5'))
    .then(()=>import('./reference-customers.js?v=20260924-reference-consensus-v1&target-segments=1'))
    .then(()=>import('./canonical-profile-runtime.js?v=20260909-canonical-profile-v5'))
    .then(()=>import('./intelligence-profile-ui.js?v=20260924-friendly-workflow-labels-v1&profile-overview-hygiene=1'))
    .then(()=>import('./lookalike-discovery.js?v=20260924-reference-consensus-v1'))
    .then(()=>import('./reference-customer-ui.js?v=20260924-reference-consensus-v1&opportunity-context=1&target-segments=1&profile-ux=1&target-list-edit=1&opportunity-map=1&profile-source=1&inline-activate=1&target-research=1'))
    .then(()=>import('./intelligence-profile-runtime.js?v=20260924-friendly-workflow-labels-v1&target-segments=1&profile-ux=1&target-list-edit=1&opportunity-map=1&profile-source=1&inline-activate=1&target-research=1'))
    .catch(error=>console.error('LeadIntel intelligence runtime failed to load',error));
  void import('./opportunity-led-icp.js?v=20260907-opportunity-led-v1');
  void import('./market-research-ux.js?v=20260915-research-source-text-v1');
  void import('./market-research-guard.js?v=20260908-render-loop-v1');
  void import('./market-research-review-ux.js?v=20260907-review-ux-v1');
  void import('./market-research-provider-resilience.js?v=20260916-latency-fix-v2');
  void import('./market-query-safety.js?v=20260908-firecrawl-query-v1');
}

(function(root,factory){
  const api=factory();
  if(typeof module!=="undefined"&&module.exports)module.exports=api;
  if(root)root.LeadIntelEvidenceView=api;
})(typeof globalThis!=="undefined"?globalThis:this,function(){
  "use strict";

  function esc(value){return String(value??"").replace(/[&<>"']/g,char=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[char]));}
  function safeUrl(value){try{const url=new URL(String(value||""));return ["https:","http:"].includes(url.protocol)?url.href:"";}catch{return "";}}
  function renderSource(source={},kind="first-party"){
    const url=safeUrl(source.url);const title=esc(source.title||source.id||"Evidence source");
    const heading=url?`<a href="${esc(url)}" target="_blank" rel="noopener noreferrer">${title}<span aria-hidden="true">↗</span></a>`:`<strong>${title}</strong>`;
    const supports=(source.supports||[]).map(value=>`<span>${esc(value)}</span>`).join("");
    const scopeLabel=kind==="external"?"External validation":source.scopeLabel||"First-party evidence";
    return `<article class="evidence-source-card evidence-kind-${esc(kind)} evidence-scope-${esc(source.scope||"supporting")}"><div class="evidence-source-head"><div>${heading}<small>${esc(source.type||"Source")}</small></div><span class="evidence-scope">${esc(scopeLabel)}</span></div><p>${esc(source.excerpt||source.description||"No readable excerpt was retained.")}</p><div class="evidence-source-meta"><span>${esc(source.confidence||"Review required")}</span></div>${supports?`<div class="evidence-supports"><small>Supports</small>${supports}</div>`:""}</article>`;
  }
  function renderEvidence(profile={}){
    const records=Array.isArray(profile.evidenceSources)?profile.evidenceSources:[];
    const external=Array.isArray(profile.externalValidationSources)?profile.externalValidationSources:[];
    const contradictions=Array.isArray(profile.canonical?.contradictions)?profile.canonical.contradictions:[];
    const coverage=profile.evidenceCoverage||{level:"none",label:"No evidence collected",message:"No readable first-party or document evidence was collected."};
    const level=["none","limited","partial","supported"].includes(coverage.level)?coverage.level:"partial";
    const summary=`<div class="evidence-validation-summary"><span>First-party ${records.length}</span><span>External validation ${external.length}</span><span>Contradictions ${contradictions.length}</span></div>`;
    const firstParty=records.length?`<details class="evidence-group"><summary>View first-party evidence</summary><div class="evidence-source-list">${records.map(source=>renderSource(source,"first-party")).join("")}</div></details>`:`<div class="evidence-empty">Add company-owned pages or documents to strengthen this profile.</div>`;
    const externalBlock=external.length?`<details class="evidence-group"><summary>View external validation</summary><p class="evidence-external-note">External sources may validate or challenge the profile, but they never overwrite first-party truth.</p><div class="evidence-source-list">${external.map(source=>renderSource(source,"external")).join("")}</div></details>`:"";
    return `<div class="evidence-coverage evidence-coverage-${level}"><strong>${esc(coverage.label||"Evidence coverage")}</strong><p>${esc(coverage.message||"")}</p></div>${summary}${firstParty}${externalBlock}`;
  }

  return {safeUrl,renderEvidence};
});
