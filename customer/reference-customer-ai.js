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

Then decide whether the list contains genuinely meaningful commercial segments. Segment only when at least two groups have materially different, repeated characteristics and each meaningful group contains at least two analyzed companies. Do not create segments merely to make the output look complete. If there is no meaningful segmentation, set meaningful=false and return one coherent segment containing all analyzed company IDs.

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
  function stripFence(text){
    let value=String(text||'').trim();
    if(value.startsWith('```'))value=value.replace(/^```(?:json)?\s*/i,'');
    if(value.endsWith('```'))value=value.slice(0,-3);
    return value.trim();
  }
  function extractJsonObject(text){
    const source=String(text||'');let start=-1,depth=0,inString=false,escaped=false;
    for(let index=0;index<source.length;index++){
      const char=source[index];
      if(inString){if(escaped)escaped=false;else if(char.charCodeAt(0)===92)escaped=true;else if(char==='"')inString=false;continue;}
      if(char==='"'){inString=true;continue;}
      if(char==='{'){if(start<0)start=index;depth++;}
      else if(char==='}'&&start>=0){depth--;if(depth===0)return source.slice(start,index+1);}
    }
    return '';
  }
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
    const candidate=stripFence(text);let raw;try{raw=JSON.parse(candidate);}catch{try{raw=JSON.parse(extractJsonObject(candidate));}catch{throw new Error('AI returned invalid reference customer analysis');}}
    const analyses={};
    for(const company of Array.isArray(raw?.companies)?raw.companies:[]){const id=clean(company?.id);if(!id||!allowed.has(id))continue;analyses[id]=normalizeAnalysis(company);}
    const sourceSegments=Array.isArray(raw?.segmentation?.segments)?raw.segmentation.segments:[];
    const segments=[];
    for(let index=0;index<sourceSegments.length;index++){
      const segment=sourceSegments[index]||{};const rowIds=unique(segment.rowIds).filter(id=>allowed.has(id)&&analyses[id]);if(!rowIds.length)continue;
      segments.push({id:`ai-segment-${index+1}`,name:clean(segment.name)||`Customer segment ${index+1}`,rowIds,count:rowIds.length,confidence:safeConfidence(segment.confidence),summary:clean(segment.summary),traits:unique(Array.isArray(segment.traits)?segment.traits:[]).slice(0,8)});
    }
    const analyzedIds=Object.keys(analyses);
    const covered=new Set(segments.flatMap(segment=>segment.rowIds));
    const repeatedGroups=segments.length>=2&&segments.every(segment=>segment.rowIds.length>=2);
    const sufficientCoverage=analyzedIds.length?covered.size>=Math.max(4,Math.ceil(analyzedIds.length*.6)):false;
    const meaningful=Boolean(raw?.segmentation?.meaningful&&repeatedGroups&&sufficientCoverage);
    if(!meaningful&&analyzedIds.length){
      const existing=segments[0];segments.splice(0,segments.length,{id:'ai-segment-coherent',name:'Reference customer group',rowIds:analyzedIds,count:analyzedIds.length,confidence:safeConfidence(existing?.confidence||'medium'),summary:'No meaningful sub-segments detected.',traits:[]});
    }
    return {analyses,segments,segmentationMeaningful:meaningful};
  }
  async function requestReferenceCustomerAnalysis({workspaceId,rows=[],fetchImpl}={}){
    const id=clean(workspaceId);if(!id)throw new Error('Sign in to a LeadIntel workspace before AI analysis');
    const usable=(rows||[]).filter(row=>clean(row?.id)&&clean(row?.text));if(!usable.length)throw new Error('No website evidence is available for AI analysis');
    const fetcher=fetchImpl||globalThis.fetch;if(typeof fetcher!=='function')throw new Error('AI analysis is unavailable');
    const url=new URL('/api/ai/generate',API_BASE);url.searchParams.set('workspace_id',id);
    const generate=async(prompt,maxOutputTokens)=>{
      const response=await fetcher(url.toString(),{method:'POST',credentials:'include',headers:{Accept:'application/json','Content-Type':'application/json'},body:JSON.stringify({
        system:'You are LeadIntel Reference Customer Intelligence. Classify B2B companies conservatively from supplied first-party website evidence. Return valid JSON only. Never invent unsupported facts or force segmentation.',
        prompt,max_output_tokens:maxOutputTokens
      })});
      const payload=await response.json().catch(()=>({}));if(!response.ok)throw new Error(clean(payload?.error)||`AI analysis failed (${response.status})`);
      return payload?.text??payload?.output_text??payload?.content??'';
    };
    const prompt=buildReferenceCustomerPrompt(usable);
    const first=await generate(prompt,7000);
    try{return parseReferenceCustomerAnalysis(first,usable.map(row=>row.id));}
    catch(error){
      if(clean(error?.message)!=='AI returned invalid reference customer analysis')throw error;
      const recovery=`${prompt}\n\nRECOVERY ATTEMPT: The previous response was malformed or incomplete. Return one complete JSON object only. Keep every string concise, include no markdown or commentary, and finish the JSON within the token limit.`;
      const second=await generate(recovery,8192);
      return parseReferenceCustomerAnalysis(second,usable.map(row=>row.id));
    }
  }
  return {buildReferenceCustomerPrompt,parseReferenceCustomerAnalysis,requestReferenceCustomerAnalysis};
});
