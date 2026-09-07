const clean=(value,max=1000)=>String(value??'').replace(/\s+/g,' ').trim().slice(0,max);

export function scraplingConfigured(env={}){
  const raw=clean(env.SCRAPLING_SERVICE_URL||'',500);if(!raw)return false;
  try{const url=new URL(raw);return url.protocol==='https:'&&Boolean(url.hostname);}catch{return false;}
}

export async function fetchWithScrapling(env={},targetUrl){
  if(!scraplingConfigured(env))throw new Error('Scrapling service is not configured');
  const serviceUrl=new URL(clean(env.SCRAPLING_SERVICE_URL,500));
  const target=new URL(String(targetUrl||''));
  if(!['http:','https:'].includes(target.protocol))throw new Error('A public http/https URL is required');
  const headers={'Content-Type':'application/json',Accept:'application/json'};
  const token=String(env.SCRAPLING_SERVICE_TOKEN||'').trim();if(token)headers.Authorization=`Bearer ${token}`;
  let response;
  try{
    response=await fetch(serviceUrl.href,{method:'POST',headers,body:JSON.stringify({url:target.href}),signal:AbortSignal.timeout(35000)});
  }catch(cause){throw new Error(`Scrapling request failed: ${String(cause?.message||cause).slice(0,160)}`);}
  const payload=await response.json().catch(()=>null);
  if(!response.ok)throw new Error(clean(payload?.detail||payload?.error||`Scrapling returned ${response.status}`,180));
  const markdown=String(payload?.data?.markdown||'').trim();const metadata=payload?.data?.metadata||{};
  if(payload?.success!==true||!markdown||metadata.source!=='scrapling-fallback')throw new Error('Invalid Scrapling response');
  let sourceUrl='';try{sourceUrl=new URL(String(metadata.sourceURL||metadata.url||target.href)).href;}catch{throw new Error('Invalid Scrapling response');}
  return {success:true,data:{markdown:markdown.slice(0,60000),metadata:{...metadata,title:clean(metadata.title||new URL(sourceUrl).hostname,180),sourceURL:sourceUrl,url:sourceUrl,statusCode:Number(metadata.statusCode)||200,source:'scrapling-fallback',fetchedAt:clean(metadata.fetchedAt||new Date().toISOString(),80)}}};
}
