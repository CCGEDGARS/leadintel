if(typeof window!=="undefined")void import('./opportunity-led-icp.js?v=20260907-opportunity-led-v1');
if(typeof window!=="undefined")void import('./company-brain.js?v=20260907-company-brain-v1');
if(typeof window!=="undefined")void import('./market-research-ux.js?v=20260907-source-discovery-ux-v1');
if(typeof window!=="undefined")void import('./market-research-guard.js?v=20260908-render-loop-v1');
if(typeof window!=="undefined")void import('./market-research-review-ux.js?v=20260907-review-ux-v1');
if(typeof window!=="undefined")void import('./market-research-provider-resilience.js?v=20260907-provider-resilience-v1');
if(typeof window!=="undefined")void import('./market-query-safety.js?v=20260908-firecrawl-query-v1');
if(typeof window!=="undefined")void import('./commercial-context-layout.js?v=20260907-card-system-v2');
if(typeof window!=="undefined")void import('./profile-evidence-layout.js?v=20260907-evidence-dashboard-v1');

(function(root,factory){
  const api=factory();
  if(typeof module!=="undefined"&&module.exports)module.exports=api;
  if(root)root.LeadIntelEvidenceView=api;
})(typeof globalThis!=="undefined"?globalThis:this,function(){
  "use strict";

  function esc(value){return String(value??"").replace(/[&<>"']/g,char=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[char]));}
  function safeUrl(value){try{const url=new URL(String(value||""));return ["https:","http:"].includes(url.protocol)?url.href:"";}catch{return "";}}
  function renderSource(source={}){
    const url=safeUrl(source.url);const title=esc(source.title||source.id||"Evidence source");
    const heading=url?`<a href="${esc(url)}" target="_blank" rel="noopener noreferrer">${title}<span aria-hidden="true">↗</span></a>`:`<strong>${title}</strong>`;
    const supports=(source.supports||[]).map(value=>`<span>${esc(value)}</span>`).join("");
    return `<article class="evidence-source-card evidence-scope-${esc(source.scope||"supporting")}"><div class="evidence-source-head"><div>${heading}<small>${esc(source.type||"Source")}</small></div><span class="evidence-scope">${esc(source.scopeLabel||"Supporting evidence")}</span></div><p>${esc(source.excerpt||"No readable excerpt was retained.")}</p><div class="evidence-source-meta"><span>${esc(source.confidence||"Review required")}</span></div>${supports?`<div class="evidence-supports"><small>Supports</small>${supports}</div>`:""}</article>`;
  }
  function renderEvidence(profile={}){
    const records=Array.isArray(profile.evidenceSources)?profile.evidenceSources:[];
    const coverage=profile.evidenceCoverage||{level:"none",label:"No evidence collected",message:"No readable public or document evidence was collected."};
    const level=["none","limited","partial","supported"].includes(coverage.level)?coverage.level:"partial";
    return `<div class="evidence-coverage evidence-coverage-${level}"><strong>${esc(coverage.label||"Evidence coverage")}</strong><p>${esc(coverage.message||"")}</p></div>${records.length?`<div class="evidence-source-list">${records.map(renderSource).join("")}</div>`:`<div class="evidence-empty">Add company pages, case studies or documents to strengthen this profile.</div>`}`;
  }

  return {safeUrl,renderEvidence};
});
