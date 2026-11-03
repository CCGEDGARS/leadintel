const clean=(value,limit=300)=>String(value??'').replace(/\s+/g,' ').trim().slice(0,limit);
export function groundedGenerationConfig(model,maxOutputTokens){return {maxOutputTokens,...(/^gemini-[34](?:[.-])/.test(model)?{thinkingConfig:{thinkingLevel:'low'}}:/^gemini-2\.5(?:[.-])/.test(model)?{thinkingConfig:{thinkingBudget:1024}}:{})};}
function domainOf(value){try{return new URL(value).hostname.toLowerCase().replace(/^www\./,'');}catch{return '';}}
function allowedSource(value,domain,external=false){
  try{const url=new URL(value);if(url.protocol!=='https:'||url.username||url.password)return '';
    if(url.hostname==='localhost'||url.hostname.endsWith('.local')||url.hostname.endsWith('.internal')||/^[\d.]+$/.test(url.hostname)||url.hostname.includes(':'))return '';
    const host=domainOf(url.href);if(host==='vertexaisearch.cloud.google.com')return '';
    if(!external&&host!==domain&&host!==`www.${domain}`&&host!=='linkedin.com'&&!host.endsWith('.linkedin.com'))return '';
    if(host.includes('linkedin.com')&&!/^\/(in|pub)\//i.test(url.pathname))return '';
    url.search='';url.hash='';return url.href.replace(/\/$/,'');
  }catch{return '';}
}
export async function boundedGroundedOperation(operation,parent,ms){
  parent?.throwIfAborted();
  const controller=new AbortController();let timer,stop;
  const canceled=new Promise((_,reject)=>{stop=()=>{const reason=parent?.aborted?parent.reason:Object.assign(Error('Grounded research deadline reached'),{name:'TimeoutError'});controller.abort(reason);reject(reason);};timer=setTimeout(stop,ms);parent?.addEventListener('abort',stop,{once:true});if(parent?.aborted)stop();});
  try{return await Promise.race([Promise.resolve().then(()=>{controller.signal.throwIfAborted();return operation(controller.signal);}),canceled]);}
  finally{clearTimeout(timer);parent?.removeEventListener('abort',stop);controller.abort();}
}
async function citationUrl(value,domain,fetchImpl,signal,external=false,timeoutMs=2000){
  const direct=allowedSource(value,domain,external);if(direct)return direct;
  let redirect;try{redirect=new URL(value);}catch{return '';}
  if(redirect.protocol!=='https:'||redirect.hostname!=='vertexaisearch.cloud.google.com'||!redirect.pathname.startsWith('/grounding-api-redirect/'))return '';
  try{
    const response=await boundedGroundedOperation(child=>fetchImpl(redirect.href,{method:'GET',redirect:'manual',signal:child}),signal,timeoutMs);
    if(response.status<300||response.status>=400)return '';
    return allowedSource(new URL(response.headers.get('location'),redirect).href,domain,external);
  }catch{return '';}
}
export async function groundedContactSearch({apiKey,model,company,domain,person,signal,fetchImpl=fetch,timeoutMs=25000,redirectTimeoutMs=2000}={}){
  return boundedGroundedOperation(signal=>runGroundedContactSearch({apiKey,model,company,domain,person,signal,fetchImpl,redirectTimeoutMs}),signal,Math.max(1,Math.min(25000,timeoutMs)));
}
async function runGroundedContactSearch({apiKey,model,company,domain,person,signal,fetchImpl,redirectTimeoutMs}){
  const name=clean(person?.name,120),role=clean(person?.title,120),organization=clean(company,120);
  const host=domainOf(`https://${clean(domain,180)}/`);
  if(!name||!organization||!host)throw new Error('Company and person are required');
  const prompt=`Find the current public LinkedIn profile and official company page for ${name}, ${role} at ${organization} (${host}). Search the web. Prefer a direct linkedin.com/in/ profile with matching full name and employer. Also find official business contact pages and relevant industry associations, conferences, supplier publications and professional interviews. Third-party evidence must name this exact person and employer. Public business contacts only. Do not invent a URL, email, phone or identity. Give a concise answer with cited sources.`;
  const response=await fetchImpl(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`,{
    method:'POST',signal,headers:{'Content-Type':'application/json',Accept:'application/json','x-goog-api-key':apiKey},
    body:JSON.stringify({contents:[{role:'user',parts:[{text:prompt}]}],tools:[{google_search:{}}],generationConfig:groundedGenerationConfig(model,2000)})
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
  const resolved=new Array(chunks.length);let cursor=0;
  await Promise.all(Array.from({length:Math.min(4,chunks.length)},async()=>{while(cursor<chunks.length){
    signal?.throwIfAborted();const index=cursor++;
    const chunk=chunks[index]?.web;if(!chunk?.uri)continue;
    const normalize=value=>String(value||'').normalize('NFKD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^\p{L}\p{N}]+/gu,' ').trim();
    const excerpt=supported.get(index)||'',text=normalize(excerpt),professional=/industry|conference|speaker|supplier|association|interview|director|procurement|leadership|president|ceo/i.test(excerpt);
    const external=professional&&(' '+text+' ').includes(' '+normalize(name)+' ')&&(' '+text+' ').includes(' '+normalize(organization)+' ');
    const url=await citationUrl(chunk.uri,host,fetchImpl,signal,external,redirectTimeoutMs);
    if(url)resolved[index]={url,title:clean(chunk.title,220),description:supported.get(index)||'',evidenceKind:'model_summary'};
  }}));
  signal?.throwIfAborted();const results=[...new Map(resolved.filter(Boolean).map(row=>[row.url,row])).values()];
  const queries=Array.isArray(metadata.webSearchQueries)?metadata.webSearchQueries.slice(0,5).map(row=>clean(row,200)):[];
  return {status:queries.length||chunks.length?'complete':'unavailable',provider:'gemini',web_search:Boolean(queries.length||chunks.length),results:results.slice(0,8),query_count:queries.length,usage:{input_tokens:Number(payload.usageMetadata?.promptTokenCount)||0,output_tokens:Number(payload.usageMetadata?.candidatesTokenCount)||0}};
}
