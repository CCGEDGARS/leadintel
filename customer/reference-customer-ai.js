(function(root,factory){
  const api=factory();
  if(typeof module!=="undefined"&&module.exports)module.exports=api;
  if(root)root.LeadIntelReferenceCustomerAI=api;
})(typeof globalThis!=="undefined"?globalThis:this,function(){
  "use strict";
  const API_BASE='https://leadintel-api.edgars-7e7.workers.dev';
  const clean=value=>String(value??'').replace(/\s+/g,' ').trim();
  const unique=list=>[...new Set((list||[]).map(clean).filter(Boolean))];
  function buildReferenceCustomerPrompt(rows=[]){
    const items=(rows||[]).map(row=>({
      id:clean(row.id),companyName:clean(row.companyName),website:clean(row.website),
      websiteEvidence:String(row.text||'').replace(/\s+/g,' ').trim().slice(0,2800)
    })).filter(row=>row.id&&row.websiteEvidence);
    return `Analyze these existing reference customers using ONLY the supplied first-party website evidence.

For each company infer, only when supported: industry, sizeBand, businessModel, growthStage, operatingComplexity, customerOutcome, buyerRoles, buyingTriggers, and a one-sentence summary. Use confidence high/medium/low. Leave unsupported fields empty. Do not invent facts.

Then decide whether the list contains genuinely meaningful commercial segments. Segment only when at least two groups have materially different, repeated characteristics. Do not create segments merely to make the output look complete. If there is no meaningful segmentation, set meaningful=false and return one coherent segment containing all analyzed company IDs.

Return JSON ONLY with this exact shape:
{"companies":[{"id":"row-id","industry":"","sizeBand":"","businessModel":"","growthStage":"","operatingComplexity":"","customerOutcome":"","buyerRoles":[],"buyingTriggers":[],"confidence":"low|medium|high","summary":""}],"segmentation":{"meaningful":true,"segments":[{"name":"","rowIds":["row-id"],"confidence":"low|medium|high","summary":"","traits":[]}]}}

Rules:
- Never return a company or row ID that is not supplied below.
- Do not invent employee counts, buyers, triggers, markets, industries or outcomes.
- Prefer one coherent group over weak or artificial segmentation.
- Segment names must be short and commercially useful.

REFERENCE CUSTOMERS:
${JSON.stringify(items)}`;
  }
  function stripFence(text){return String(text||'').trim().replace(/^```(?:json)?\s*/i,'').replace(/\s*```$/,'').trim();}
  function safeConfidence(value){const v=clean(value).toLowerCase();return ['high','medium','low'].includes(v)?v:'low';}
  function normalizeAnalysis(company={}){
    const out={};
    for(const key of ['industry','sizeBand','businessModel','growthStage','operatingComplexity','customerOutcome','summary'])out[key]=clean(company[key]);
    out.buyerRoles=unique(Array.isArray(company.buyerRoles)?company.buyerRoles:[]).slice(0,8);
    out.buyingTriggers=unique(Array.isArray(company.buyingTriggers)?company.buyingTriggers:[]).slice(0,8);
    out.confidence=safeConfidence(company.confidence);
    return out;
  }
  function parseReferenceCustomerAnalysis(text,allowedIds=[]){
    const allowed=new Set((allowedIds||[]).map(clean).filter(Boolean));
    let raw;try{raw=JSON.parse(stripFence(text));}catch{throw new Error('AI returned invalid reference customer analysis');}
    const analyses={};
    for(const company of Array.isArray(raw?.companies)?raw.companies:[]){const id=clean(company?.id);if(!id||!allowed.has(id))continue;analyses[id]=normalizeAnalysis(company);}
    const sourceSegments=Array.isArray(raw?.segmentation?.segments)?raw.segmentation.segments:[];
    const segments=[];
    for(let index=0;index<sourceSegments.length;index++){
      const segment=sourceSegments[index]||{};const rowIds=unique(segment.rowIds).filter(id=>allowed.has(id)&&analyses[id]);if(!rowIds.length)continue;
      segments.push({id:`ai-segment-${index+1}`,name:clean(segment.name)||`Customer segment ${index+1}`,rowIds,count:rowIds.length,confidence:safeConfidence(segment.confidence),summary:clean(segment.summary),traits:unique(Array.isArray(segment.traits)?segment.traits:[]).slice(0,8)});
    }
    const meaningful=Boolean(raw?.segmentation?.meaningful&&segments.length>=2);
    const analyzedIds=Object.keys(analyses);
    if(!meaningful&&analyzedIds.length){
      const existing=segments[0];segments.splice(0,segments.length,{id:'ai-segment-coherent',name:clean(existing?.name)||'Reference customer group',rowIds:analyzedIds,count:analyzedIds.length,confidence:safeConfidence(existing?.confidence||'medium'),summary:clean(existing?.summary)||'No meaningful sub-segments detected.',traits:unique(existing?.traits||[]).slice(0,8)});
    }
    return {analyses,segments,segmentationMeaningful:meaningful};
  }
  async function requestReferenceCustomerAnalysis({workspaceId,rows=[],fetchImpl}={}){
    const id=clean(workspaceId);if(!id)throw new Error('Sign in to a LeadIntel workspace before AI analysis');
    const usable=(rows||[]).filter(row=>clean(row?.id)&&clean(row?.text));if(!usable.length)throw new Error('No website evidence is available for AI analysis');
    const fetcher=fetchImpl||globalThis.fetch;if(typeof fetcher!=='function')throw new Error('AI analysis is unavailable');
    const url=new URL('/api/ai/generate',API_BASE);url.searchParams.set('workspace_id',id);
    const response=await fetcher(url.toString(),{method:'POST',credentials:'include',headers:{Accept:'application/json','Content-Type':'application/json'},body:JSON.stringify({
      system:'You are LeadIntel Reference Customer Intelligence. Classify B2B companies conservatively from supplied first-party website evidence. Return valid JSON only. Never invent unsupported facts or force segmentation.',
      prompt:buildReferenceCustomerPrompt(usable),max_output_tokens:7000
    })});
    const payload=await response.json().catch(()=>({}));if(!response.ok)throw new Error(clean(payload?.error)||`AI analysis failed (${response.status})`);
    const text=payload?.text??payload?.output_text??payload?.content??'';return parseReferenceCustomerAnalysis(text,usable.map(row=>row.id));
  }
  return {buildReferenceCustomerPrompt,parseReferenceCustomerAnalysis,requestReferenceCustomerAnalysis};
});
