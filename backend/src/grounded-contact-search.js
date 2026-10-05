const clean=(value,limit=300)=>String(value??'').replace(/\s+/g,' ').trim().slice(0,limit);
function domainOf(value){try{return new URL(value).hostname.toLowerCase().replace(/^www\./,'');}catch{return '';}}
function allowedSource(value,domain){
  try{const url=new URL(value);if(url.protocol!=='https:')return '';
    const host=domainOf(url.href);
    if(host!==domain&&host!==`www.${domain}`&&host!=='linkedin.com'&&!host.endsWith('.linkedin.com'))return '';
    if(host.includes('linkedin.com')&&!/^\/(in|pub)\//i.test(url.pathname))return '';
    url.search='';url.hash='';return url.href.replace(/\/$/,'');
  }catch{return '';}
}
async function citationUrl(value,domain,fetchImpl,signal){
  const direct=allowedSource(value,domain);if(direct)return direct;
  let redirect;try{redirect=new URL(value);}catch{return '';}
  if(redirect.protocol!=='https:'||redirect.hostname!=='vertexaisearch.cloud.google.com'||!redirect.pathname.startsWith('/grounding-api-redirect/'))return '';
  try{
    const response=await fetchImpl(redirect.href,{method:'GET',redirect:'manual',signal});
    if(response.status<300||response.status>=400)return '';
    return allowedSource(new URL(response.headers.get('location'),redirect).href,domain);
  }catch{return '';}
}
export async function groundedContactSearch({apiKey,model,company,domain,person,signal,fetchImpl=fetch}={}){
  const name=clean(person?.name,120),role=clean(person?.title,120),organization=clean(company,120);
  const host=domainOf(`https://${clean(domain,180)}/`);
  if(!name||!organization||!host)throw new Error('Company and person are required');
  const prompt=`Find the current public LinkedIn profile and official company page for ${name}, ${role} at ${organization} (${host}). Search the web. Prefer a direct linkedin.com/in/ profile with matching full name and employer. Also find an official page listing a work email or phone, if one exists. Do not invent a URL, email, phone or identity. Give a concise answer with cited sources.`;
  const response=await fetchImpl(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`,{
    method:'POST',signal,headers:{'Content-Type':'application/json',Accept:'application/json','x-goog-api-key':apiKey},
    body:JSON.stringify({contents:[{role:'user',parts:[{text:prompt}]}],tools:[{google_search:{}}]})
  });
  if(!response.ok)throw new Error(`Grounded Gemini search unavailable (${response.status})`);
  const payload=await response.json(),candidate=payload.candidates?.[0],metadata=candidate?.groundingMetadata||{};
  const chunks=Array.isArray(metadata.groundingChunks)?metadata.groundingChunks.slice(0,12):[];
  const supported=new Map();
  for(const support of metadata.groundingSupports||[]){
    const excerpt=clean(support.segment?.text,400);
    for(const index of support.groundingChunkIndices||[])if(Number.isInteger(index)&&index>=0&&index<chunks.length){
      supported.set(index,clean(`${supported.get(index)||''} ${excerpt}`,600));
    }
  }
  const results=[];
  for(let index=0;index<chunks.length;index++){
    const chunk=chunks[index]?.web;if(!chunk?.uri)continue;
    const url=await citationUrl(chunk.uri,host,fetchImpl,signal);
    if(url&&!results.some(row=>row.url===url))results.push({url,title:clean(chunk.title,220),description:supported.get(index)||'',evidenceKind:'model_summary'});
  }
  const queries=Array.isArray(metadata.webSearchQueries)?metadata.webSearchQueries.slice(0,5).map(row=>clean(row,200)):[];
  return {status:queries.length||chunks.length?'complete':'unavailable',provider:'gemini',web_search:Boolean(queries.length||chunks.length),results:results.slice(0,8),query_count:queries.length,usage:{input_tokens:Number(payload.usageMetadata?.promptTokenCount)||0,output_tokens:Number(payload.usageMetadata?.candidatesTokenCount)||0}};
}
