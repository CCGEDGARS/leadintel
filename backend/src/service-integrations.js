import {loadConfirmationLevel} from './contact-confirmation-policy.js';
import {fetchWithScrapling,scraplingConfigured} from './scrapling.js';
import {sha256,cookieValue} from './security.js';
import {importAesKey,encryptSecret,decryptSecret} from './oauth.js';
import {APOLLO_PEOPLE_SEARCH_URL,normalizeDomain as normalizeApolloDomain} from './enrichment.js';
import {creditFailure,recordProviderCredit,providerCreditIssue,verifiedCreditBalance} from './provider-credit-health.js';

const PROVIDERS=Object.freeze(['apollo','firecrawl','hunter']);
const PROVIDER_NAMES=Object.freeze({apollo:'Apollo.io',firecrawl:'Firecrawl',hunter:'Hunter'});
const FIRECRAWL_PROXY_URL='https://apollo-proxy.edgars-7e7.workers.dev';
const MAX_DIRECT_PAGE_BYTES=2_000_000;
const MAX_DIRECT_PAGE_CHARS=60_000;
const MAX_DIRECT_REDIRECTS=4;
const APOLLO_PEOPLE_SENIORITIES=Object.freeze(['owner','founder','c_suite','partner','vp','head','director','manager']);
const DNS_DOMAIN=/^(?=.{1,253}$)(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/i;
const json=(value,status=200,headers={})=>new Response(JSON.stringify(value),{status,headers:{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store',...headers}});
const error=(message,status,headers,code)=>json({error:message,...(code?{code}:{})},status,headers);
const uuid=()=>crypto.randomUUID();
const clean=(value,max=1000)=>String(value??'').replace(/\s+/g,' ').trim().slice(0,max);
const keyHint=apiKey=>`••••${String(apiKey||'').slice(-4)}`;

async function sessionUser(request,env){
  const token=cookieValue(request,'leadintel_session');if(!token)return null;
  const tokenHash=await sha256(token);
  return env.DB.prepare(`SELECT users.id,users.email,users.display_name,users.role,sessions.expires_at FROM sessions JOIN users ON users.id=sessions.user_id WHERE sessions.token_hash=? AND sessions.expires_at>datetime('now')`).bind(tokenHash).first();
}
async function membership(env,workspaceId,userId){return env.DB.prepare('SELECT role FROM workspace_members WHERE workspace_id=? AND user_id=?').bind(workspaceId,userId).first();}
async function requireMember(request,env,workspaceId,roles=[]){
  const user=await sessionUser(request,env);if(!user)return {error:'Authentication required',status:401};
  const member=await membership(env,workspaceId,user.id);if(!member)return {error:'Workspace access denied',status:403};
  if(roles.length&&!roles.includes(member.role))return {error:'Workspace role is not permitted',status:403};
  return {user,member};
}
async function audit(env,{workspaceId,userId,type,provider,metadata={}}){
  try{await env.DB.prepare(`INSERT INTO audit_events(id,workspace_id,user_id,event_type,entity_type,entity_id,metadata_json) VALUES(?,?,?,?,?,?,?)`).bind(uuid(),workspaceId,userId,type,'workspace_service_integration',provider,JSON.stringify(metadata)).run();}catch{}
}
function normalizeProvider(value){const provider=clean(value,40).toLowerCase();return PROVIDERS.includes(provider)?provider:'';}
function validateApiKey(value){const apiKey=String(value||'').trim();if(apiKey.length<8||apiKey.length>8192||/[\r\n]/.test(apiKey))throw new Error('A valid provider API key is required');return apiKey;}
function encryptionConfigured(env){return Boolean(String(env.OAUTH_TOKEN_ENCRYPTION_KEY||'').trim());}
async function integrationRow(env,workspaceId,provider){return env.DB.prepare(`SELECT provider,encrypted_api_key,key_hint,metadata_json,verified_at,last_used_at FROM workspace_service_integrations WHERE workspace_id=? AND provider=?`).bind(workspaceId,provider).first();}
async function decryptRow(env,row){if(!row||!encryptionConfigured(env))return '';const key=await importAesKey(env.OAUTH_TOKEN_ENCRYPTION_KEY);return decryptSecret(row.encrypted_api_key,key);}

async function verifyApollo(apiKey){
  const response=await fetch('https://api.apollo.io/api/v1/auth/health',{method:'GET',headers:{'Content-Type':'application/json','Cache-Control':'no-cache','x-api-key':apiKey}});
  const payload=await response.json().catch(()=>({}));
  if(!response.ok||payload.healthy===false||payload.is_logged_in===false)throw new Error(payload.error||`Apollo verification failed (${response.status})`);
  return {healthy:true,is_logged_in:payload.is_logged_in!==false};
}
async function verifyFirecrawl(apiKey){
  const response=await fetch('https://api.firecrawl.dev/v2/team/credit-usage',{method:'GET',headers:{Accept:'application/json',Authorization:`Bearer ${apiKey}`}});
  const payload=await response.json().catch(()=>({}));if(!response.ok||payload.success===false)throw new Error(payload.error||`Firecrawl verification failed (${response.status})`);
  const data=payload.data||{};return {remaining_credits:data.remainingCredits!=null&&Number.isFinite(Number(data.remainingCredits))?Number(data.remainingCredits):null,plan_credits:Number(data.planCredits)||0,billing_period_end:data.billingPeriodEnd||null};
}
async function verifyHunter(apiKey){
  const response=await fetch('https://api.hunter.io/v2/account',{method:'GET',headers:{Accept:'application/json','X-API-KEY':apiKey}});
  if(!response.ok)throw new Error(response.status===401||response.status===403?'Hunter rejected this API key':`Hunter connection check failed (${response.status})`);
  const payload=await response.json().catch(()=>({}));
  if(!payload?.data||typeof payload.data!=='object')throw new Error('Hunter account information was unavailable');
  return {plan:clean(payload.data.plan_name,80),remaining_verifications:Number.isFinite(Number(payload.data.requests?.verifications?.remaining))?Number(payload.data.requests.verifications.remaining):null};
}
async function verifyCredential(provider,apiKey){if(provider==='apollo')return verifyApollo(apiKey);if(provider==='firecrawl')return verifyFirecrawl(apiKey);return verifyHunter(apiKey);}
async function verifyManagedFirecrawl(env){
  const base=clean(env.FIRECRAWL_PROXY_URL||FIRECRAWL_PROXY_URL,500);
  try{const response=await fetch(base,{method:'OPTIONS'});return {ok:response.ok,status:response.status};}catch{return {ok:false,status:0};}
}

function privateIpv4(hostname){
  const parts=hostname.split('.');if(parts.length!==4||parts.some(part=>!/^\d+$/.test(part)||Number(part)>255))return false;
  const [a,b]=parts.map(Number);
  return a===0||a===10||a===127||(a===100&&b>=64&&b<=127)||(a===169&&b===254)||(a===172&&b>=16&&b<=31)||(a===192&&b===168)||(a===198&&(b===18||b===19))||a>=224;
}
function privateIpv6(hostname){
  const host=hostname.replace(/^\[|\]$/g,'').toLowerCase();
  if(!host.includes(':'))return false;
  if(host==='::'||host==='::1')return true;
  if(/^f[cd]/.test(host)||/^fe[89ab]/.test(host))return true;
  const mapped=host.match(/::ffff:(\d+\.\d+\.\d+\.\d+)$/);return Boolean(mapped&&privateIpv4(mapped[1]));
}
function publicResearchUrl(value,base){
  let url;try{url=base?new URL(String(value||''),base):new URL(String(value||''));}catch{return null;}
  if(!['http:','https:'].includes(url.protocol)||url.username||url.password)return null;
  if(url.port&&!['80','443'].includes(url.port))return null;
  const hostname=url.hostname.replace(/^\[|\]$/g,'').replace(/\.$/,'').toLowerCase();
  if(!hostname||hostname==='localhost'||hostname.endsWith('.localhost')||hostname.endsWith('.local')||hostname.endsWith('.internal')||hostname.endsWith('.lan')||privateIpv4(hostname)||privateIpv6(hostname))return null;
  return url;
}
function decodeHtmlEntities(value){
  return String(value||'').replace(/&nbsp;/gi,' ').replace(/&amp;/gi,'&').replace(/&quot;/gi,'"').replace(/&#39;|&apos;/gi,"'").replace(/&lt;/gi,'<').replace(/&gt;/gi,'>').replace(/&#(\d+);/g,(_,n)=>String.fromCodePoint(Math.min(1114111,Number(n)||32))).replace(/&#x([0-9a-f]+);/gi,(_,n)=>String.fromCodePoint(Math.min(1114111,parseInt(n,16)||32)));
}
function htmlText(html){
  const withoutNoise=String(html||'').replace(/<!--[\s\S]*?-->/g,' ').replace(/<(script|style|noscript|svg|template)\b[^>]*>[\s\S]*?<\/\1>/gi,' ');
  return decodeHtmlEntities(withoutNoise.replace(/<(br|hr)\b[^>]*>/gi,'\n').replace(/<\/(p|div|section|article|main|header|footer|nav|li|h[1-6]|tr)>/gi,'\n').replace(/<[^>]+>/g,' ')).replace(/[ \t]+/g,' ').replace(/\s*\n\s*/g,'\n').replace(/\n{3,}/g,'\n\n').trim().slice(0,MAX_DIRECT_PAGE_CHARS);
}
function htmlMeta(html,name){
  const source=String(html||'');
  if(name==='title'){const match=source.match(/<title\b[^>]*>([\s\S]*?)<\/title>/i);return clean(decodeHtmlEntities(match?.[1]||''),180);}
  const tags=source.match(/<meta\b[^>]*>/gi)||[];
  for(const tag of tags){
    if(!new RegExp(`(?:name|property)\\s*=\\s*["'](?:${name}|og:${name})["']`,'i').test(tag))continue;
    const content=tag.match(/content\s*=\s*["']([^"']*)["']/i);if(content)return clean(decodeHtmlEntities(content[1]),500);
  }
  return '';
}
export async function fetchDirectPublicPage(value,{signal=AbortSignal.timeout(10000)}={}){
  let current=publicResearchUrl(value);if(!current)throw new Error('A valid public research URL is required');
  for(let redirects=0;redirects<=MAX_DIRECT_REDIRECTS;redirects++){
    const response=await fetch(current.href,{method:'GET',headers:{Accept:'text/html,application/xhtml+xml,text/plain;q=0.8,*/*;q=0.1','User-Agent':'LeadIntel/1.0 (+https://leadintel.ccgroup.lv)'},redirect:'manual',signal});
    if(response.status>=300&&response.status<400){
      const location=response.headers.get('location');if(!location)throw new Error(`Website redirect failed (${response.status})`);
      const next=publicResearchUrl(location,current.href);if(!next)throw new Error('Website redirected to a non-public URL');
      current=next;continue;
    }
    if(!response.ok)throw new Error(`Website returned ${response.status}`);
    const contentType=(response.headers.get('content-type')||'').toLowerCase();
    if(contentType&&!contentType.includes('text/html')&&!contentType.includes('application/xhtml+xml')&&!contentType.includes('text/plain'))throw new Error('Website did not return readable text');
    const declared=Number(response.headers.get('content-length')||0);if(declared>MAX_DIRECT_PAGE_BYTES)throw new Error('Website page is too large to read safely');
    const raw=await response.text();if(new TextEncoder().encode(raw).byteLength>MAX_DIRECT_PAGE_BYTES)throw new Error('Website page is too large to read safely');
    const text=contentType.includes('text/plain')?clean(raw,MAX_DIRECT_PAGE_CHARS):htmlText(raw);if(!text)throw new Error('No readable website content was returned');
    const title=contentType.includes('text/plain')?'':htmlMeta(raw,'title');const description=contentType.includes('text/plain')?'':htmlMeta(raw,'description');
    return {success:true,data:{markdown:text,metadata:{title:title||current.hostname,description,sourceURL:current.href,url:current.href,statusCode:response.status,source:'direct-fallback'}}};
  }
  throw new Error('Website redirected too many times');
}
function retryableFirecrawlStatus(status,{managed=false}={}){return status===402||status===408||status===429||status>=500||(managed&&status===404);}

export function hunterVerificationEnabled(row){
  try{return JSON.parse(row?.metadata_json||'{}')?.additional_verification_enabled===true;}catch{return false;}
}
export async function hunterVerificationPolicy(env,workspaceId){
  const row=await integrationRow(env,workspaceId,'hunter');
  return {enabled:hunterVerificationEnabled(row),configured:Boolean(row)};
}

export async function resolveWorkspaceServiceCredential(env,workspaceId,provider){
  const normalized=normalizeProvider(provider);if(!normalized||!workspaceId)return {provider:normalized,apiKey:'',source:'none',configured:false,row:null};
  try{
    const row=await integrationRow(env,workspaceId,normalized);
    if(row){const apiKey=await decryptRow(env,row);if(apiKey)return {provider:normalized,apiKey,source:'customer',configured:true,row};}
  }catch{}
  if(normalized==='apollo'&&String(env.APOLLO_API_KEY||'').trim())return {provider:normalized,apiKey:String(env.APOLLO_API_KEY).trim(),source:'managed',configured:true,row:null};
  return {provider:normalized,apiKey:'',source:normalized==='firecrawl'?'managed':'none',configured:normalized==='firecrawl',row:null};
}

export async function apolloCapabilities(env,workspaceId){
  let row=null;try{row=await integrationRow(env,workspaceId,'apollo');}catch{}let metadata={};try{metadata=JSON.parse(row?.metadata_json||'{}');}catch{}
  return {discovery:metadata.discovery_enabled!==false,email:metadata.email_enrichment_enabled===true,phone:metadata.phone_enrichment_enabled===true};
}

export async function withWorkspaceServiceCredentials(request,env){
  try{
    const url=new URL(request.url);const workspaceId=clean(url.searchParams.get('workspace_id')||'',120);if(!workspaceId)return env;
    const access=await requireMember(request,env,workspaceId);if(access.error)return env;
    const apolloCredential=await resolveWorkspaceServiceCredential(env,workspaceId,'apollo');
    if(apolloCredential.source!=='customer'||!apolloCredential.apiKey)return env;
    const runtime=Object.create(env);
    runtime.APOLLO_WEBHOOK_SECRET=env.APOLLO_WEBHOOK_SECRET||env.APOLLO_API_KEY||'';
    runtime.APOLLO_API_KEY=apolloCredential.apiKey;
    return runtime;
  }catch{return env;}
}

async function providerStatus(env,workspaceId,provider,{verify=false}={}){
  let row=null;try{row=await integrationRow(env,workspaceId,provider);}catch{}
  if(row){
    let metadata={};try{metadata=JSON.parse(row.metadata_json||'{}')||{};}catch{}
    let state='good',label='Connected';
    if(verify){
      try{const apiKey=await decryptRow(env,row);metadata={...metadata,...await verifyCredential(provider,apiKey)};const balance=verifiedCreditBalance(provider,metadata);if(balance)await recordProviderCredit(env,{workspaceId,provider,kind:balance,source:'customer'});await env.DB.prepare(`UPDATE workspace_service_integrations SET metadata_json=CASE WHEN provider='hunter' THEN json_set(?, '$.additional_verification_enabled', json(CASE WHEN json_extract(metadata_json,'$.additional_verification_enabled')=1 THEN 'true' ELSE 'false' END)) ELSE json_patch(?,CASE WHEN provider='apollo' THEN json_object('discovery_enabled',json(CASE WHEN json_extract(metadata_json,'$.discovery_enabled')=0 THEN 'false' ELSE 'true' END),'email_enrichment_enabled',json(CASE WHEN json_extract(metadata_json,'$.email_enrichment_enabled')=1 THEN 'true' ELSE 'false' END),'phone_enrichment_enabled',json(CASE WHEN json_extract(metadata_json,'$.phone_enrichment_enabled')=1 THEN 'true' ELSE 'false' END)) ELSE json('{}') END) END,verified_at=CURRENT_TIMESTAMP,updated_at=CURRENT_TIMESTAMP WHERE workspace_id=? AND provider=?`).bind(JSON.stringify(metadata),JSON.stringify(metadata),workspaceId,provider).run();}
      catch(cause){if(creditFailure(0,cause?.message)||/\(402\)/.test(String(cause?.message)))await recordProviderCredit(env,{workspaceId,provider,kind:'failed',source:'customer'});state='bad';label='Connection error';metadata={...metadata,error:clean(cause?.message||cause,180)};}
    }
    return {provider,name:PROVIDER_NAMES[provider],configured:true,source:'customer',state,label,key_hint:row.key_hint||'',verified_at:row.verified_at||null,last_used_at:row.last_used_at||null,metadata};
  }
  if(provider==='apollo'){
    if(!env.APOLLO_API_KEY)return {provider,name:PROVIDER_NAMES[provider],configured:false,source:'none',state:'bad',label:'Not connected',key_hint:'',verified_at:null,last_used_at:null,metadata:{}};
    if(verify){try{await verifyApollo(env.APOLLO_API_KEY);}catch(cause){return {provider,name:PROVIDER_NAMES[provider],configured:false,source:'managed',state:'bad',label:'Managed fallback error',key_hint:'',verified_at:null,last_used_at:null,metadata:{error:clean(cause?.message||cause,180)}};}}
    return {provider,name:PROVIDER_NAMES[provider],configured:false,source:'managed',state:'good',label:'LeadIntel managed fallback',key_hint:'',verified_at:null,last_used_at:null,metadata:{}};
  }
  if(provider==='hunter')return {provider,name:PROVIDER_NAMES[provider],configured:false,source:'none',state:'neutral',label:'Not connected',key_hint:'',verified_at:null,last_used_at:null,metadata:{}};
  const check=verify?await verifyManagedFirecrawl(env):{ok:true,status:200};
  return {provider,name:PROVIDER_NAMES[provider],configured:false,source:'managed',state:check.ok?'good':'bad',label:check.status===402?'Credits exhausted':check.ok?'LeadIntel managed fallback':'Managed fallback unavailable',key_hint:'',verified_at:null,last_used_at:null,metadata:{proxy_status:check.status}};
}

function workspaceIdFrom(url){return clean(url.searchParams.get('workspace_id')||'',120);}
async function extractionFallback(env,url,access,workspaceId,credential,status){
  const auditResult=async result=>{await audit(env,{workspaceId,userId:access.user.id,type:'service.firecrawl_scrape',provider:'firecrawl',metadata:{source:result.data.metadata.source,upstream_source:credential.source,upstream_status:status}});return result;};
  try{const direct=await fetchDirectPublicPage(url);const text=direct.data.markdown;if(scraplingConfigured(env)&&(text.length<120||(/captcha|verify you are human|cloudflare ray id|access denied/i.test(text)&&text.length<1000)))throw new Error('Weak direct extraction');return await auditResult(direct);}catch{}
  if(scraplingConfigured(env))return auditResult(await fetchWithScrapling(env,url));
  throw new Error('No extraction fallback available');
}
async function forwardFirecrawl(request,env,cors,workspaceId,kind){
  const access=await requireMember(request,env,workspaceId,['owner','researcher','sales']);if(access.error)return error(access.error,access.status,cors);
  const body=await request.json().catch(()=>null);if(!body||typeof body!=='object')return error('Firecrawl request payload is required',400,cors);
  const credential=await resolveWorkspaceServiceCredential(env,workspaceId,'firecrawl');
  let target='',payload={},researchUrl=null;
  if(kind==='scrape'){
    researchUrl=publicResearchUrl(body.url);if(!researchUrl)return error('A valid public research URL is required',400,cors);
    payload={url:researchUrl.href,formats:Array.isArray(body.formats)&&body.formats.includes('links')?['markdown','links']:['markdown'],onlyMainContent:body.onlyMainContent!==false,timeout:Math.max(5000,Math.min(60000,Number(body.timeout)||30000))};
    target=credential.source==='customer'?'https://api.firecrawl.dev/v2/scrape':`${clean(env.FIRECRAWL_PROXY_URL||FIRECRAWL_PROXY_URL,500)}/firecrawl-scrape`;
  }else{
    const rawQuery=String(body.query||'').trim();if(!rawQuery||rawQuery.length>600)return error('Firecrawl search query is invalid',400,cors);const query=clean(rawQuery,600);
    const limit=Math.max(1,Math.min(10,Math.floor(Number(body.limit)||4)));
    const wantsMarkdown=Array.isArray(body.scrapeOptions?.formats)&&body.scrapeOptions.formats.includes('markdown');
    payload={query,limit,...(wantsMarkdown?{scrapeOptions:{formats:['markdown']}}:{})};
    target=credential.source==='customer'?'https://api.firecrawl.dev/v2/search':`${clean(env.FIRECRAWL_PROXY_URL||FIRECRAWL_PROXY_URL,500)}/firecrawl-search`;
  }
  const headers={'Content-Type':'application/json',Accept:'application/json'};if(credential.source==='customer')headers.Authorization=`Bearer ${credential.apiKey}`;
  let response;try{response=await fetch(target,{method:'POST',headers,body:JSON.stringify(payload)});}catch(cause){
    if(kind==='scrape'&&researchUrl){
      try{const direct=await extractionFallback(env,researchUrl.href,access,workspaceId,credential,0);return json(direct,200,cors);}catch{}
    }
    return error(`Firecrawl ${kind} is temporarily unavailable`,502,cors);
  }
  const upstream=await response.json().catch(()=>({}));
  if(!response.ok){
    if(creditFailure(response.status,upstream?.error||upstream?.message))await recordProviderCredit(env,{workspaceId,userId:access.user.id,provider:'firecrawl',kind:'failed',source:credential.source});
    const canFallback=kind==='scrape'&&researchUrl&&retryableFirecrawlStatus(response.status,{managed:credential.source==='managed'});
    if(canFallback){
      try{const direct=await extractionFallback(env,researchUrl.href,access,workspaceId,credential,response.status);return json(direct,200,cors);}catch{}
    }
    return error(upstream.error||`Firecrawl ${kind} failed (${response.status})`,response.status>=400&&response.status<600?response.status:502,cors);
  }
  if(kind==='scrape'&&scraplingConfigured(env)){
    const text=String(upstream?.data?.markdown||'').trim();
    if(upstream?.success===false||text.length<120||(/captcha|verify you are human|cloudflare ray id|access denied/i.test(text)&&text.length<1000)){
      try{return json(await extractionFallback(env,researchUrl.href,access,workspaceId,credential,response.status),200,cors);}catch{return error('No usable website evidence was returned',422,cors);}
    }
  }
  await recordProviderCredit(env,{workspaceId,userId:access.user.id,provider:'firecrawl',kind:'recovered',source:credential.source});
  if(credential.source==='customer')await env.DB.prepare(`UPDATE workspace_service_integrations SET last_used_at=CURRENT_TIMESTAMP,updated_at=CURRENT_TIMESTAMP WHERE workspace_id=? AND provider='firecrawl'`).bind(workspaceId).run();
  await audit(env,{workspaceId,userId:access.user.id,type:`service.firecrawl_${kind}`,provider:'firecrawl',metadata:{source:credential.source}});
  if(kind==='search'&&credential.source==='customer'&&Array.isArray(upstream?.data?.web))return json({success:true,data:upstream.data.web},200,cors);
  return json(upstream,200,cors);
}

function normalizeApolloPeopleSearch(body){
  const domains=Array.isArray(body?.q_organization_domains_list)?body.q_organization_domains_list:(body?.domain?[body.domain]:[]);
  if(domains.length!==1||typeof domains[0]!=='string')return {error:'Buyer search requires one verified company domain'};
  const domain=normalizeApolloDomain(domains[0]);
  if(!domain||!DNS_DOMAIN.test(domain)||/^\d+(?:\.\d+){3}$/.test(domain))return {error:'Buyer search requires one verified company domain'};
  const rawTitles=body?.person_titles??(body?.role?[body.role]:[]);
  if(!Array.isArray(rawTitles)||rawTitles.some(value=>typeof value!=='string'))return {error:'Buyer roles must be a list of text values'};
  const seen=new Set();const titles=[];
  for(const raw of rawTitles){const title=clean(raw,120);const key=title.toLowerCase();if(!title||seen.has(key))continue;seen.add(key);titles.push(title);if(titles.length===10)break;}
  return {payload:{q_organization_domains_list:[domain],person_titles:titles,include_similar_titles:true,person_seniorities:[...APOLLO_PEOPLE_SENIORITIES],page:1,per_page:10},domain,roleCount:titles.length};
}

function publicApolloBuyer(person={}){
  const name=clean(person.name||[person.first_name,person.last_name].filter(Boolean).join(' '),180);
  return {
    id:clean(person.id||person.person_id,180),name,title:clean(person.title,180),seniority:clean(person.seniority,80),
    organization_name:clean(person.organization?.name||person.organization_name,180),
    city:clean(person.city,120),country:clean(person.country,120),
    linkedin_url:clean(person.linkedin_url||person.linkedin_profile_url||person.linkedin,1000)
  };
}

async function forwardApolloPeopleSearch(request,env,cors,workspaceId){
  const access=await requireMember(request,env,workspaceId,['owner','researcher','sales']);if(access.error)return error(access.error,access.status,cors);
  const body=await request.json().catch(()=>null);if(!body||typeof body!=='object'||Array.isArray(body))return error('Apollo buyer-search payload is required',400,cors,'SERVICE_APOLLO_PAYLOAD_REQUIRED');
  const normalized=normalizeApolloPeopleSearch(body);if(normalized.error)return error(normalized.error,400,cors,'SERVICE_APOLLO_DOMAIN_INVALID');
  if(!(await apolloCapabilities(env,workspaceId)).discovery)return error('Apollo people discovery is disabled in Settings',409,cors,'SERVICE_APOLLO_DISCOVERY_DISABLED');
  const credential=await resolveWorkspaceServiceCredential(env,workspaceId,'apollo');
  if(!credential.configured||!credential.apiKey)return error('Apollo is not connected for this workspace. Connect it in Settings.',503,cors,'SERVICE_APOLLO_NOT_CONFIGURED');
  let response;
  try{response=await fetch(APOLLO_PEOPLE_SEARCH_URL,{method:'POST',headers:{'Content-Type':'application/json','Cache-Control':'no-cache','Accept':'application/json','X-Api-Key':credential.apiKey},body:JSON.stringify(normalized.payload),signal:request.signal});}
  catch{return error('Apollo buyer search is temporarily unavailable. Try again.',502,cors,'SERVICE_APOLLO_UNAVAILABLE');}
  const upstream=await response.json().catch(()=>({}));
  if(!response.ok){
    if(creditFailure(response.status,JSON.stringify(upstream).slice(0,800)))await recordProviderCredit(env,{workspaceId,userId:access.user.id,provider:'apollo',kind:'failed',source:credential.source});
    if(response.status===401||response.status===403)return error('Apollo rejected this key or API access. Verify the Apollo connection in Settings.',502,cors,'SERVICE_APOLLO_AUTH_FAILED');
    if(response.status===429)return error('Apollo request limit reached. Check the Apollo account and try again later.',429,cors,'SERVICE_APOLLO_RATE_LIMIT');
    return error(`Apollo buyer search failed (${response.status})`,502,cors,'SERVICE_APOLLO_UPSTREAM_FAILED');
  }
  await recordProviderCredit(env,{workspaceId,userId:access.user.id,provider:'apollo',kind:'recovered',source:credential.source});
  const rawPeople=Array.isArray(upstream?.people)?upstream.people:Array.isArray(upstream?.contacts)?upstream.contacts:Array.isArray(upstream?.data?.people)?upstream.data.people:[];
  const people=rawPeople.slice(0,10).map(publicApolloBuyer).filter(person=>person.name||person.title);
  if(credential.source==='customer')await env.DB.prepare(`UPDATE workspace_service_integrations SET last_used_at=CURRENT_TIMESTAMP,updated_at=CURRENT_TIMESTAMP WHERE workspace_id=? AND provider='apollo'`).bind(workspaceId).run();
  await audit(env,{workspaceId,userId:access.user.id,type:'service.apollo_people_search',provider:'apollo',metadata:{source:credential.source,domain:normalized.domain,role_count:normalized.roleCount,result_count:people.length}});
  return json({people},200,cors);
}

export async function handleServiceIntegrationRoute(request,env,cors={}){
  const url=new URL(request.url);const path=url.pathname;
  const known=path.startsWith('/api/integrations/services/');if(!known)return null;
  const workspaceId=workspaceIdFrom(url);if(!workspaceId)return error('workspace_id is required',400,cors);

  if(path==='/api/integrations/services/contact-policy'&&request.method==='GET'){
    const access=await requireMember(request,env,workspaceId);if(access.error)return error(access.error,access.status,cors);
    return json({confirmationLevel:await loadConfirmationLevel(env,workspaceId),apollo:await apolloCapabilities(env,workspaceId)},200,cors);
  }

  if(path==='/api/integrations/services/status'&&request.method==='GET'){
    const access=await requireMember(request,env,workspaceId);if(access.error)return error(access.error,access.status,cors);
    const verify=url.searchParams.get('verify')==='1';
    const providers=[];for(const provider of PROVIDERS){
      const state=await providerStatus(env,workspaceId,provider,{verify});
      state.credit_issue=await providerCreditIssue(env,workspaceId,provider);
      if(state.credit_issue?.source===state.source){state.state='bad';state.label='Credits exhausted';}
      providers.push(state);
    }
    return json({role:access.member.role,providers,checked_at:new Date().toISOString()},200,cors);
  }

  if(path==='/api/integrations/services/apollo/settings'&&request.method==='PUT'){
    const access=await requireMember(request,env,workspaceId,['owner']);if(access.error)return error(access.error,access.status,cors);
    const body=await request.json().catch(()=>null);
    if(!body||['discovery','email','phone'].some(key=>typeof body[key]!=='boolean')||!Number.isInteger(body.daily_limit)||body.daily_limit<0||body.daily_limit>1000||!Number.isInteger(body.monthly_limit)||body.monthly_limit<0||body.monthly_limit>10000)return error('Choose Apollo capabilities and valid daily/monthly credit limits',400,cors);
    const row=await integrationRow(env,workspaceId,'apollo');if(!row)return error('Connect your Apollo account before enabling credit-consuming enrichment',409,cors);
    await env.DB.batch([env.DB.prepare("UPDATE workspace_service_integrations SET metadata_json=json_set(metadata_json,'$.discovery_enabled',json(?),'$.email_enrichment_enabled',json(?),'$.phone_enrichment_enabled',json(?)),updated_at=CURRENT_TIMESTAMP WHERE workspace_id=? AND provider='apollo'").bind(JSON.stringify(body.discovery),JSON.stringify(body.email),JSON.stringify(body.phone),workspaceId),
      env.DB.prepare('INSERT INTO enrichment_policies(workspace_id,daily_credit_limit,monthly_credit_limit) VALUES(?,?,?) ON CONFLICT(workspace_id) DO UPDATE SET daily_credit_limit=excluded.daily_credit_limit,monthly_credit_limit=excluded.monthly_credit_limit').bind(workspaceId,body.daily_limit,body.monthly_limit)]);
    await audit(env,{workspaceId,userId:access.user.id,type:'service.apollo_policy_changed',provider:'apollo',metadata:{discovery:body.discovery,email:body.email,phone:body.phone,daily_limit:body.daily_limit,monthly_limit:body.monthly_limit}});
    return json({saved:true,capabilities:body},200,cors);
  }

  if(path==='/api/integrations/services/hunter/settings' &&request.method==='PUT'){
    const access=await requireMember(request,env,workspaceId,['owner']);if(access.error)return error(access.error,access.status,cors);
    const body=await request.json().catch(()=>null);if(typeof body?.enabled!=='boolean')return error('An enabled boolean is required',400,cors);
    const row=await integrationRow(env,workspaceId,'hunter');if(!row)return error('Connect your Hunter key before enabling additional verification',409,cors);
    let metadata={};try{metadata=JSON.parse(row.metadata_json||'{}');}catch{}
    metadata.additional_verification_enabled=body.enabled;
    await env.DB.prepare("UPDATE workspace_service_integrations SET metadata_json=json_set(metadata_json, '$.additional_verification_enabled', json(?)),updated_at=CURRENT_TIMESTAMP WHERE workspace_id=? AND provider='hunter'").bind(JSON.stringify(body.enabled),workspaceId).run();
    await audit(env,{workspaceId,userId:access.user.id,type:'service.hunter_policy_changed',provider:'hunter',metadata:{enabled:body.enabled}});
    return json({saved:true,enabled:body.enabled},200,cors);
  }

  if(path==='/api/integrations/services/provider'&&request.method==='PUT'){
    const access=await requireMember(request,env,workspaceId,['owner']);if(access.error)return error(access.error,access.status,cors);
    if(!encryptionConfigured(env))return error('Credential encryption is not configured',503,cors);
    const body=await request.json().catch(()=>null);const provider=normalizeProvider(body?.provider);if(!provider)return error('Unsupported service provider',400,cors);
    let apiKey;try{apiKey=validateApiKey(body.api_key);}catch(cause){return error(cause.message,400,cors);}
    let metadata;try{metadata=await verifyCredential(provider,apiKey);if(provider==='apollo'){let prior={};try{prior=JSON.parse((await integrationRow(env,workspaceId,provider))?.metadata_json||'{}');}catch{}for(const key of ['discovery_enabled','email_enrichment_enabled','phone_enrichment_enabled'])metadata[key]=prior[key]??(key==='discovery_enabled');}if(provider==='hunter')metadata.additional_verification_enabled=hunterVerificationEnabled(await integrationRow(env,workspaceId,provider));}catch(cause){return error(clean(cause?.message||'Provider verification failed',180),422,cors);}
    try{
      const key=await importAesKey(env.OAUTH_TOKEN_ENCRYPTION_KEY);const encrypted=await encryptSecret(apiKey,key);
      await env.DB.prepare(`INSERT INTO workspace_service_integrations(workspace_id,provider,encrypted_api_key,key_hint,metadata_json,verified_at,created_at,updated_at) VALUES(?,?,?,?,?,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP) ON CONFLICT(workspace_id,provider) DO UPDATE SET encrypted_api_key=excluded.encrypted_api_key,key_hint=excluded.key_hint,metadata_json=CASE WHEN provider='hunter' THEN json_set(excluded.metadata_json, '$.additional_verification_enabled', json(CASE WHEN json_extract(workspace_service_integrations.metadata_json,'$.additional_verification_enabled')=1 THEN 'true' ELSE 'false' END)) WHEN provider='apollo' THEN json_patch(excluded.metadata_json,json_object('discovery_enabled',json(CASE WHEN json_extract(workspace_service_integrations.metadata_json,'$.discovery_enabled')=0 THEN 'false' ELSE 'true' END),'email_enrichment_enabled',json(CASE WHEN json_extract(workspace_service_integrations.metadata_json,'$.email_enrichment_enabled')=1 THEN 'true' ELSE 'false' END),'phone_enrichment_enabled',json(CASE WHEN json_extract(workspace_service_integrations.metadata_json,'$.phone_enrichment_enabled')=1 THEN 'true' ELSE 'false' END))) ELSE excluded.metadata_json END,verified_at=CURRENT_TIMESTAMP,updated_at=CURRENT_TIMESTAMP`).bind(workspaceId,provider,encrypted,keyHint(apiKey),JSON.stringify(metadata)).run();
      await audit(env,{workspaceId,userId:access.user.id,type:'service.provider_saved',provider,metadata:{source:'customer'}});
      return json({saved:true,provider,name:PROVIDER_NAMES[provider],configured:true,source:'customer',key_hint:keyHint(apiKey),verified_at:new Date().toISOString(),metadata},200,cors);
    }catch{return error('Unable to save service provider configuration',500,cors);}
  }

  if(path==='/api/integrations/services/provider'&&request.method==='DELETE'){
    const access=await requireMember(request,env,workspaceId,['owner']);if(access.error)return error(access.error,access.status,cors);
    const body=await request.json().catch(()=>null);const provider=normalizeProvider(body?.provider);if(!provider)return error('Unsupported service provider',400,cors);
    const result=await env.DB.prepare(`DELETE FROM workspace_service_integrations WHERE workspace_id=? AND provider=?`).bind(workspaceId,provider).run();
    await audit(env,{workspaceId,userId:access.user.id,type:'service.provider_disconnected',provider});
    return json({disconnected:Number(result?.meta?.changes||0)>0,provider,fallback:provider==='firecrawl'||(provider==='apollo'&&Boolean(env.APOLLO_API_KEY))},200,cors);
  }

  if(path==='/api/integrations/services/hunter/verify-email'&&request.method==='POST'){
    const access=await requireMember(request,env,workspaceId,['owner','researcher','sales']);if(access.error)return error(access.error,access.status,cors);
    const body=await request.json().catch(()=>null);const email=clean(body?.email,320).toLowerCase();
    if(!/^[a-z0-9][a-z0-9._%+-]{0,63}@[a-z0-9](?:[a-z0-9.-]{0,251}[a-z0-9])?\.[a-z]{2,}$/i.test(email)||email.includes('..'))return error('A valid email address is required',400,cors);
    if(!(await hunterVerificationPolicy(env,workspaceId)).enabled)return error('Hunter is optional and disabled. Enable additional verification in Settings to use credits.',409,cors,'SERVICE_HUNTER_DISABLED');
    const credential=await resolveWorkspaceServiceCredential(env,workspaceId,'hunter');
    if(credential.source!=='customer'||!credential.apiKey)return error('Connect Hunter in Settings before checking an email',503,cors,'SERVICE_HUNTER_NOT_CONFIGURED');
    let response;try{response=await fetch(`https://api.hunter.io/v2/email-verifier?email=${encodeURIComponent(email)}`,{method:'GET',headers:{Accept:'application/json','X-API-KEY':credential.apiKey}});}catch{return error('Hunter is temporarily unavailable',502,cors);}
    if(response.status===451)return error('Hunter cannot process this address',451,cors,'SERVICE_HUNTER_CLAIMED_EMAIL');
    if(response.status===202||response.status===222)return json({email,status:'unknown',deliverability:'inconclusive',identity_confirmed:false,provider:'Hunter',pending:response.status===202},200,cors);
    if(!response.ok)return error(response.status===401?'Hunter key was rejected':response.status===403||response.status===429?'Hunter request limit reached':`Hunter verification failed (${response.status})`,response.status>=400&&response.status<500?response.status:502,cors);
    const payload=await response.json().catch(()=>({}));const data=payload.data||{};
    if(String(data.email||'').toLowerCase()!==email)return error('Hunter returned an unexpected email address',502,cors);
    const status=['valid','invalid','accept_all','webmail','disposable','unknown'].includes(data.status)?data.status:'unknown';
    const deliverability=status==='valid'&&!data.accept_all&&!data.block?'deliverable':status==='invalid'?'undeliverable':'inconclusive';
    await env.DB.prepare(`UPDATE workspace_service_integrations SET last_used_at=CURRENT_TIMESTAMP,updated_at=CURRENT_TIMESTAMP WHERE workspace_id=? AND provider='hunter'`).bind(workspaceId).run();
    await audit(env,{workspaceId,userId:access.user.id,type:'service.hunter_verify_email',provider:'hunter',metadata:{status,domain:email.split('@')[1]}});
    return json({email,status,deliverability,identity_confirmed:false,provider:'Hunter',checked_at:new Date().toISOString()},200,cors);
  }

  if(path==='/api/integrations/services/hunter/find-email'&&request.method==='POST'){
    const access=await requireMember(request,env,workspaceId,['owner','researcher','sales']);if(access.error)return error(access.error,access.status,cors);
    const body=await request.json().catch(()=>null),domain=clean(body?.domain,253).toLowerCase(),first=clean(body?.first_name,80),last=clean(body?.last_name,80);
    if(!DNS_DOMAIN.test(domain)||!first||!last||!/^[-\p{L}'’ ]{2,80}$/u.test(first)||!/^[-\p{L}'’ ]{2,80}$/u.test(last))return error('Company domain and full name are required',400,cors);
    if(!(await hunterVerificationPolicy(env,workspaceId)).enabled)return error('Hunter is optional and disabled. Enable additional verification in Settings to use credits.',409,cors,'SERVICE_HUNTER_DISABLED');
    const credential=await resolveWorkspaceServiceCredential(env,workspaceId,'hunter');
    if(credential.source!=='customer'||!credential.apiKey)return error('Connect Hunter in Settings before confirming email',503,cors,'SERVICE_HUNTER_NOT_CONFIGURED');
    const params=new URLSearchParams({domain,first_name:first,last_name:last});
    let response;try{response=await fetch(`https://api.hunter.io/v2/email-finder?${params}`,{method:'GET',headers:{Accept:'application/json','X-API-KEY':credential.apiKey}});}catch{return error('Hunter is temporarily unavailable',502,cors);}
    if(response.status===451)return error('Hunter cannot process this person',451,cors,'SERVICE_HUNTER_CLAIMED_EMAIL');
    if(!response.ok)return error(response.status===401?'Hunter key was rejected':response.status===403||response.status===429?'Hunter request limit reached':`Hunter email search failed (${response.status})`,response.status>=400&&response.status<500?response.status:502,cors);
    const payload=await response.json().catch(()=>({})),data=payload.data||{};
    const email=clean(data.email,320).toLowerCase();
    if(email&&!email.endsWith(`@${domain}`))return error('Hunter returned an unexpected company domain',502,cors);
    const source=Array.isArray(data.sources)?data.sources.find(item=>{try{const url=new URL(item.uri);return ['http:','https:'].includes(url.protocol)&&!url.username&&!url.password;}catch{return false;}})?.uri||'':'';
    await env.DB.prepare(`UPDATE workspace_service_integrations SET last_used_at=CURRENT_TIMESTAMP,updated_at=CURRENT_TIMESTAMP WHERE workspace_id=? AND provider='hunter'`).bind(workspaceId).run();
    await audit(env,{workspaceId,userId:access.user.id,type:'service.hunter_find_email',provider:'hunter',metadata:{found:Boolean(email),domain}});
    return json({email,source:clean(source,1000),source_type:clean(data.source_type,30),status:clean(data.verification?.status,30),provider:'Hunter',identity_confirmed:false},200,cors);
  }

  if(path==='/api/integrations/services/firecrawl/scrape'&&request.method==='POST')return forwardFirecrawl(request,env,cors,workspaceId,'scrape');
  if(path==='/api/integrations/services/firecrawl/search'&&request.method==='POST')return forwardFirecrawl(request,env,cors,workspaceId,'search');
  if(path==='/api/integrations/services/apollo/people-search'&&request.method==='POST')return forwardApolloPeopleSearch(request,env,cors,workspaceId);
  return error('Method not allowed',405,cors);
}
