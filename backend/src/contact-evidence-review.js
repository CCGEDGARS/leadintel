import {generateText} from './ai-provider.js';

const clean=(value,limit=300)=>String(value??'').replace(/\s+/g,' ').trim().slice(0,limit);

export function contactReviewInput(body={}){
  const company=clean(body.company,160);
  const people=(Array.isArray(body.people)?body.people:[]).slice(0,4).map(row=>({id:clean(row.id,100),name:clean(row.name,160),role:clean(row.role,160)})).filter(row=>row.id&&row.name);
  const evidence=(Array.isArray(body.evidence)?body.evidence:[]).slice(0,16).map(row=>({url:clean(row.url,1000),title:clean(row.title,240),excerpt:clean(row.excerpt,600)})).filter(row=>/^https:\/\//i.test(row.url));
  return {company,people,evidence};
}

export function parseContactReview(text,input){
  const source=String(text||'').trim().replace(/^```(?:json)?\s*/i,'').replace(/\s*```$/,'');
  let parsed;try{parsed=JSON.parse(source);}catch{throw new Error('Gemini contact review returned invalid JSON');}
  const allowed=new Set(input.people.map(row=>row.id));
  return {status:'complete',provider:'gemini',web_search:false,summary:clean(parsed.summary,500),conflicts:(Array.isArray(parsed.conflicts)?parsed.conflicts:[]).filter(row=>allowed.has(clean(row.person_id,100))).slice(0,4).map(row=>({person_id:clean(row.person_id,100),reason:clean(row.reason,300)}))};
}

export async function reviewContactEvidence({body,apiKey,model,signal,generate=generateText}={}){
  const input=contactReviewInput(body);
  if(!input.company||!input.people.length||!input.evidence.length)throw new Error('Contact evidence is required');
  const result=await generate({provider:'gemini',apiKey,model,system:'Review only the supplied public evidence for identity contradictions. You have no web access. Do not infer, invent or verify email deliverability or phone ownership. Return JSON only: {"summary":"", "conflicts":[{"person_id":"", "reason":""}]}. Report only material contradictions.',prompt:JSON.stringify(input),maxOutputTokens:900,signal});
  return {...parseContactReview(result.text,input),usage:result.usage||{input_tokens:0,output_tokens:0}};
}
