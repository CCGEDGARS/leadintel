import {generateText} from './ai-provider.js';

const clean=(value,limit=500)=>String(value??'').replace(/\s+/g,' ').trim().slice(0,limit);
const list=(value,limit=12,itemLimit=300)=>Array.isArray(value)?value.map(item=>clean(item,itemLimit)).filter(Boolean).slice(0,limit):[];
const RELEVANCE=new Set(['strong','moderate','weak','reject']);
const COMMERCIAL_FIT=new Set(['strong','moderate','weak','unknown']);

function safeEvidence(items=[]){
  return items.slice(0,60).map((item,index)=>({
    id:clean(item?.id,80)||`evidence-${index+1}`,
    url:clean(item?.url,2048),title:clean(item?.title,240),description:clean(item?.description,400),
    text:clean(item?.text,400),date:clean(item?.date,80),market:clean(item?.market,160),query:clean(item?.query,300)
  })).filter(item=>item.id&&/^https:\/\//i.test(item.url));
}

export function buildVerificationRequest({mode='deep',profile={},signals=[],evidence=[]}={}){
  const bounded=safeEvidence(evidence);
  const context={mode:clean(mode,40),target_markets:clean(profile?.targetMarkets,1200),priority_offers:clean(profile?.priorityOffers,1200),ideal_customer:clean(profile?.idealCustomer,1200),buying_triggers:clean(profile?.buyingTriggers,1200),signals:(signals||[]).filter(item=>item?.active!==false).slice(0,20).map(item=>({name:clean(item?.name,160),keywords:clean(item?.keywords,500)})),evidence:bounded};
  return {
    system:'You are an independent market-research verifier. You have no web access in this task: do not browse, search, or imply that you did. Assess only the supplied evidence. Never invent sources, URLs, facts, or evidence IDs. Return JSON only.',
    prompt:`Cross-check the supplied evidence against the commercial context. Identify contradictions, weak relevance, commercial-fit gaps, and missing evidence. Return one JSON object with summary, verdicts, disagreements, and missing_evidence. Each verdict must contain evidence_id, relevance (strong|moderate|weak|reject), commercial_fit (strong|moderate|weak|unknown), contradiction (boolean), rationale, and missing_evidence (string array). Only use evidence IDs supplied below.\n\n${JSON.stringify(context)}`,
    maxOutputTokens:2400
  };
}

function parseJson(text){
  const source=String(text||'').trim().replace(/^```(?:json)?\s*/i,'').replace(/\s*```$/,'');
  try{return JSON.parse(source);}catch{throw new Error('Gemini verification did not return valid JSON');}
}

export function parseVerificationResponse(text,evidence=[]){
  const parsed=parseJson(text);const allowed=new Set(safeEvidence(evidence).map(item=>item.id));
  const verdicts=(Array.isArray(parsed?.verdicts)?parsed.verdicts:[]).filter(item=>allowed.has(clean(item?.evidence_id,80))).slice(0,allowed.size).map(item=>({
    evidence_id:clean(item.evidence_id,80),relevance:RELEVANCE.has(item.relevance)?item.relevance:'weak',commercial_fit:COMMERCIAL_FIT.has(item.commercial_fit)?item.commercial_fit:'unknown',contradiction:Boolean(item.contradiction),rationale:clean(item.rationale,600),missing_evidence:list(item.missing_evidence,8,240)
  }));
  return {status:'complete',provider:'gemini',role:'verification',web_search:false,summary:clean(parsed?.summary,1000),verdicts,disagreements:list(parsed?.disagreements,12,400),missing_evidence:list(parsed?.missing_evidence,12,400)};
}

export async function verifyMarketResearch({apiKey,model,mode,profile,signals,evidence,generate=generateText,signal}={}){
  const request=buildVerificationRequest({mode,profile,signals,evidence});
  const generated=await generate({provider:'gemini',apiKey,model,system:request.system,prompt:request.prompt,maxOutputTokens:request.maxOutputTokens,signal});
  return {...parseVerificationResponse(generated.text,evidence),model,usage:generated.usage||{input_tokens:0,output_tokens:0}};
}
