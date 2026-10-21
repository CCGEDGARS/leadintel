const clean=(value,max=1000)=>String(value??'').replace(/\s+/g,' ').trim().slice(0,max);
const failure=(message,failureKind,code,httpStatus)=>Object.assign(new Error(message),{failureKind,code,...(httpStatus?{httpStatus}:{})});

export function scraplingConfigured(env={}){
  const raw=clean(env.SCRAPLING_SERVICE_URL||'',500);if(!raw)return false;
  try{const url=new URL(raw);return url.protocol==='https:'&&Boolean(url.hostname)&&!url.username&&!url.password;}catch{return false;}
}

export async function fetchWithScrapling(env={},targetUrl,{signal,timeoutMs=35000}={}){
  signal?.throwIfAborted();
  if(!scraplingConfigured(env))throw failure('Scrapling service is not configured','configuration','SCRAPLING_NOT_CONFIGURED');
  const serviceUrl=new URL(clean(env.SCRAPLING_SERVICE_URL,500));
  const target=new URL(String(targetUrl||''));
  if(!['http:','https:'].includes(target.protocol))throw failure('A public http/https URL is required','invalid_target','SCRAPLING_INVALID_TARGET');
  const headers={'Content-Type':'application/json',Accept:'application/json'};
  const token=String(env.SCRAPLING_SERVICE_TOKEN||'').trim();if(token)headers.Authorization=`Bearer ${token}`;
  const budget=Math.max(1,Math.min(35000,Math.floor(Number(timeoutMs)||35000)));
  const requestSignal=signal?AbortSignal.any([signal,AbortSignal.timeout(budget)]):AbortSignal.timeout(budget);
  let response,payload;
  try{
    response=await fetch(serviceUrl.href,{method:'POST',headers,redirect:'error',body:JSON.stringify({url:target.href,timeout_ms:budget}),signal:requestSignal});
    payload=await response.json().catch(()=>null);
    requestSignal.throwIfAborted();
  }catch{
    if(signal?.aborted)throw failure(signal.reason?.name==='TimeoutError'?'Scrapling parent deadline exceeded':'Scrapling request canceled',signal.reason?.name==='TimeoutError'?'timeout':'cancelled',signal.reason?.name==='TimeoutError'?'SCRAPLING_TIMEOUT':'SCRAPLING_CANCELLED');
    if(requestSignal.aborted)throw failure('Scrapling request timed out','timeout','SCRAPLING_TIMEOUT');
    throw failure('Scrapling service request failed','network','SCRAPLING_NETWORK_ERROR');
  }
  // Provider bodies can include credentials or full request URLs. Retain only known codes.
  if(!response.ok){
    const code=typeof payload?.detail==='object'?payload.detail?.code:payload?.code;
    if(response.status===401||response.status===403)throw failure('Scrapling service authentication failed','authentication','SCRAPLING_AUTH_FAILED',response.status);
    if(code==='SCRAPLING_TIMEOUT'||response.status===504)throw failure('Scrapling target extraction timed out','timeout','SCRAPLING_TIMEOUT',response.status);
    if(code==='SCRAPLING_BLOCKED_CONTENT'||(response.status===422&&/No readable|successful content/i.test(String(payload?.detail))))throw failure('Scrapling target returned blocked or unreadable content','blocked_content','SCRAPLING_BLOCKED_CONTENT',response.status);
    if(code==='SCRAPLING_EXTRACTION_ERROR')throw failure('Scrapling target extraction failed','extraction','SCRAPLING_EXTRACTION_ERROR',response.status);
    throw failure(`Scrapling service returned HTTP ${response.status}`,'http','SCRAPLING_HTTP_ERROR',response.status);
  }
  const markdown=String(payload?.data?.markdown||'').trim();const metadata=payload?.data?.metadata||{};
  if(payload?.success!==true||!markdown||metadata.source!=='scrapling-fallback')throw failure('Invalid Scrapling response','invalid_response','SCRAPLING_INVALID_RESPONSE');
  let sourceUrl='';try{sourceUrl=new URL(String(metadata.sourceURL||metadata.url||target.href)).href;}catch{throw failure('Invalid Scrapling response','invalid_response','SCRAPLING_INVALID_RESPONSE');}
  return {success:true,data:{markdown:markdown.slice(0,60000),links:Array.isArray(payload?.data?.links)?payload.data.links.filter(link=>typeof link==='string').slice(0,200):[],metadata:{...metadata,title:clean(metadata.title||new URL(sourceUrl).hostname,180),sourceURL:sourceUrl,url:sourceUrl,statusCode:Number(metadata.statusCode)||200,source:'scrapling-fallback',fetchedAt:clean(metadata.fetchedAt||new Date().toISOString(),80)}}};
}
