(function(root,factory){
  const api=factory();
  if(typeof module!=="undefined"&&module.exports)module.exports=api;
  if(root)root.LeadIntelCrmPresentation=api;
})(typeof globalThis!=="undefined"?globalThis:this,function(){
  "use strict";
  const clean=(value,max=1000)=>String(value??"").replace(/\s+/g," ").trim().slice(0,max);
  const esc=value=>String(value??"").replace(/[&<>'"]/g,char=>({"&":"&amp;","<":"&lt;",">":"&gt;","'":"&#39;",'"':"&quot;"}[char]));
  const SCORE_FIELDS=Object.freeze([["fit","Fit",30],["signal","Signal",25],["evidence","Evidence",20],["timing","Timing",15],["value","Value",10]]);
  function safePublicUrl(value){
    try{
      const url=new URL(clean(value,2000));
      if(!["http:","https:"].includes(url.protocol)||url.username||url.password)return "";
      return url.href;
    }catch{return "";}
  }
  function safeLinkedInProfileUrl(value){
    const safe=safePublicUrl(value);if(!safe)return "";
    try{
      const url=new URL(safe);
      if(!/(^|\.)linkedin\.com$/i.test(url.hostname)||!/^\/(?:in|pub)\//i.test(url.pathname))return "";
      return url.href;
    }catch{return "";}
  }
  function scoreBreakdownHtml(scoreBreakdown={}){
    const score=scoreBreakdown&&typeof scoreBreakdown==="object"?scoreBreakdown:{};
    const cards=SCORE_FIELDS.flatMap(([key,label,max])=>{
      const raw=score[key];
      if(raw===undefined||raw===null||raw===""||!Number.isFinite(Number(raw)))return [];
      const value=Math.max(0,Math.min(max,Math.round(Number(raw))));
      return [`<div class="crm-score-item"><span>${label}</span><strong>${value} / ${max}</strong></div>`];
    });
    if(!cards.length)return '<div class="crm-detail-empty">No score breakdown saved.</div>';
    const rawTotal=score.total;
    const total=rawTotal!==undefined&&rawTotal!==null&&rawTotal!==""&&Number.isFinite(Number(rawTotal))
      ?`<div class="crm-score-total"><span>Total</span><strong>${Math.max(0,Math.min(100,Math.round(Number(rawTotal))))} / 100</strong></div>`
      :"";
    return `<div class="crm-score-grid">${cards.join("")}${total}</div>`;
  }
  function evidenceKind(record,url){
    const provided=clean(record?.sourceKind||record?.source_kind,80).toLowerCase();
    if(provided==="linkedin-public-index")return "Public LinkedIn-indexed page";
    let host="";
    try{host=new URL(url||"https://"+clean(record?.sourceDomain||record?.source_domain,255)).hostname;}catch{}
    return /(^|\.)linkedin\.com$/i.test(host)?"LinkedIn page":"Public web page";
  }
  function evidenceHtml(evidence=[]){
    const records=Array.isArray(evidence)?evidence:[];
    if(!records.length)return '<div class="crm-detail-empty">No evidence sources saved.</div>';
    const cards=records.slice(0,5).map(record=>{
      const url=safePublicUrl(record?.url||record?.sourceUrl||record?.source_url||"");
      const title=clean(record?.title||record?.name,180)||"Research source";
      const domain=url?new URL(url).hostname.replace(/^www\./i,""):clean(record?.sourceDomain||record?.source_domain,255);
      const kind=evidenceKind(record,url);
      const excerpt=clean(record?.description||record?.snippet||record?.text,420);
      const date=clean(record?.date||record?.publishedDate||record?.published_at,80);
      const sourceLink=url
        ?`<a href="${esc(url)}" target="_blank" rel="noopener noreferrer">${esc(title)} ↗</a>`
        :`<strong>${esc(title)}</strong><small>Source URL unavailable</small>`;
      const meta=[kind,domain,date?(`Published ${date}`):""].filter(Boolean).map(item=>`<span>${esc(item)}</span>`).join("");
      return `<article class="crm-evidence-card"><div class="crm-evidence-meta">${meta}</div>${sourceLink}${excerpt?`<p>${esc(excerpt)}</p>`:""}</article>`;
    }).join("");
    const more=records.length>5?`<small class="crm-evidence-count">Showing 5 of ${records.length} evidence sources.</small>`:"";
    return `<div class="crm-evidence-list">${cards}</div>${more}`;
  }
  function intelligenceHtml(intelligence){
    if(!intelligence)return '<div class="crm-detail-empty">No durable intelligence snapshot yet.</div>';
    const signals=Array.isArray(intelligence.matched_signals)?intelligence.matched_signals:[];
    const evidence=Array.isArray(intelligence.evidence)?intelligence.evidence:[];
    return `<div class="crm-intel-block"><p>${esc(intelligence.opportunity_hypothesis||"No opportunity hypothesis saved.")}</p><div class="crm-chip-list">${signals.length?signals.slice(0,8).map(item=>`<span>${esc(item.name||item.id||"Signal")}</span>`).join(""):"<span>No matched signals</span>"}</div><small>${evidence.length} evidence source${evidence.length===1?"":"s"} · ${esc(intelligence.confidence||"Unrated")} confidence</small><h5 class="crm-subheading">Score breakdown</h5>${scoreBreakdownHtml(intelligence.score_breakdown)}<h5 class="crm-subheading">Evidence</h5>${evidenceHtml(evidence)}</div>`;
  }
  function sourceLabel(value){
    const source=clean(value,80);
    if(!source)return "Not recorded";
    if(source.toLowerCase()==="apollo")return "Apollo";
    if(source.toLowerCase()==="manual")return "Manual";
    return source;
  }
  function contactsHtml(contacts=[]){
    const rows=Array.isArray(contacts)?contacts:[];
    if(!rows.length)return '<div class="crm-detail-empty">No contacts saved.</div>';
    return rows.map(contact=>{
      const email=clean(contact?.work_email||contact?.normalized_email,320);
      const emailStatus=clean(contact?.email_status,80)||"Not recorded";
      const source=sourceLabel(contact?.source);
      const profileUrl=safeLinkedInProfileUrl(contact?.linkedin_url);
      const link=profileUrl
        ?`<a class="crm-contact-linkedin" href="${esc(profileUrl)}" target="_blank" rel="noopener noreferrer">View LinkedIn profile ↗</a><small class="crm-contact-provenance">${source==="Apollo"?"Apollo-provided identity link · ":""}Confirm the current role before outreach.</small>`
        :"";
      return `<div class="crm-contact"><strong>${esc(contact?.name||"Unnamed contact")}</strong><span>${esc(contact?.title||"Role not set")}</span><small>${esc(email||"No work email saved")}</small><small>Email status · ${esc(emailStatus)}</small><small class="crm-contact-source">Contact source · ${esc(source)}</small><small>${contact?.phone_number?`Phone · ${esc(contact.phone_number)}`:"No phone saved"}</small>${link}</div>`;
    }).join("");
  }
  return {safePublicUrl,safeLinkedInProfileUrl,scoreBreakdownHtml,evidenceHtml,intelligenceHtml,contactsHtml};
});
