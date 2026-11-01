import {apolloWebhookSigningSecret} from './apollo-crm-webhook.js';
import {exposePublishedEmailHtml} from './published-email-html.js';
import {loadConfirmationLevel} from './contact-confirmation-policy.js';
import {sha256,cookieValue} from './security.js';
import {importAesKey,encryptSecret,decryptSecret} from './oauth.js';
import {APOLLO_PEOPLE_SEARCH_URL,normalizeDomain as normalizeApolloDomain} from './enrichment.js';
import {fetchWithScrapling,scraplingConfigured} from './scrapling.js';
import {creditFailure,recordProviderCredit,providerCreditIssue,verifiedCreditBalance} from './provider-credit-health.js';
import {acquireFirecrawlSlot,firecrawlPlanFromRow,parseRetryAfterMs,recordFirecrawlRateLimit} from './firecrawl-rate-gate.js';

const PROVIDERS=Object.freeze(['apollo','firecrawl','hunter','treg']);
const PROVIDER_NAMES=Object.freeze({apollo:'Apollo.io',firecrawl:'Firecrawl',hunter:'Hunter',treg:'Treg'});
const MAX_DIRECT_PAGE_BYTES=2_000_000;
const MAX_DIRECT_PAGE_CHARS=60_000;
const MAX_DIRECT_REDIRECTS=4;
const APOLLO_PEOPLE_SENIORITIES=Object.freeze(['owner','founder','c_suite','partner','vp','head','director','manager']);
const DNS_DOMAIN=/^(?=.{1,253}$)(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/i;
const json=(value,status=200,headers={})=>new Response(JSON.stringify(value),{status,headers:{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store',...headers}});
const error=(message,status,headers,code)=>json({error:message,...(code?{code}:{})},status,headers);
const uuid=()=>crypto.randomUUID();
const providerSignal=(request,timeout=30000)=>AbortSignal.any([request.signal,AbortSignal.timeout(timeout)]);
const cancelledResponse=(signal,cors)=>error(signal.reason?.name==='TimeoutError'?'Provider request timed out':'Provider request was cancelled',signal.reason?.name==='TimeoutError'?504:499,cors,'SERVICE_REQUEST_CANCELLED');
const clean=(value,max=1000)=>String(value??'').replace(/\s+/g,' ').trim().slice(0,max);
const keyHint=apiKey=>`••••${String(apiKey||'').slice(-4)}`;

async function sessionUser(request,env){
  const token=cookieValue(request,'leadintel_session');if(!token)return null;
  const tokenHash=await sha256(token);
  const user=await env.DB.prepare(`SELECT users.id,users.email,users.display_name,users.role,sessions.expires_at FROM sessions JOIN users ON users.id=sessions.user_id WHERE sessions.token_hash=? AND sessions.expires_at>datetime('now')`).bind(tokenHash).first();
  return user?{...user,sessionTokenHash:tokenHash}:null;
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
const OWNER_SESSION_GUARD="EXISTS(SELECT 1 FROM sessions s JOIN users u ON u.id=s.user_id JOIN workspace_members wm ON wm.user_id=u.id WHERE s.token_hash=? AND s.user_id=? AND s.expires_at>datetime('now') AND wm.workspace_id=? AND wm.role='owner')";
async function deniedOwnerCommit(env,{workspaceId,user,provider,operationId,cors}){
  const session=await env.DB.prepare("SELECT 1 FROM sessions JOIN users ON users.id=sessions.user_id WHERE sessions.token_hash=? AND sessions.user_id=? AND sessions.expires_at>datetime('now')").bind(user.sessionTokenHash,user.id).first();
  const member=session?await membership(env,workspaceId,user.id):null;
  const status=!session?401:member?.role!=='owner'?403:0;if(!status)return null;
  await audit(env,{workspaceId,userId:user.id,type:'service.provider_authorization_revoked',provider,metadata:{operation_id:operationId,reason:status===401?'session_expired_or_revoked':'workspace_owner_revoked'}});
  return error(status===401?'Authentication expired or was revoked. Sign in again before changing connections.':'Workspace owner permission changed. Reload Settings.',status,cors);
}
function encryptionConfigured(env){return Boolean(String(env.OAUTH_TOKEN_ENCRYPTION_KEY||'').trim());}
function verificationMessage(provider,cause){
  // Provider bodies and network errors can echo credentials or account details.
  return creditFailure(0,cause?.message)||/\(402\)/.test(String(cause?.message))?`${PROVIDER_NAMES[provider]} credits exhausted or payment required`:`${PROVIDER_NAMES[provider]} connection check failed. Check the API key and try again.`;
}
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
  const payload=await response.json().catch(()=>({}));
  if(!response.ok)throw new Error(creditFailure(response.status,JSON.stringify(payload))?'Hunter credits exhausted or payment required':response.status===401||response.status===403?'Hunter rejected this API key':`Hunter connection check failed (${response.status})`);
  if(!payload?.data||typeof payload.data!=='object')throw new Error('Hunter account information was unavailable');
  const remaining=kind=>{const value=payload.data.requests?.[kind]?.remaining;return value!=null&&String(value).trim()!==''&&Number.isFinite(Number(value))?Number(value):null;};
  return {plan:clean(payload.data.plan_name,80),remaining_credits:remaining('credits'),remaining_searches:remaining('searches'),remaining_verifications:remaining('verifications')};
}
async function verifyTreg(apiKey){
  const response=await fetch('https://treg.to/mcp/',{method:'POST',headers:{Authorization:'Bearer '+apiKey,Accept:'application/json, text/event-stream','Content-Type':'application/json'},body:JSON.stringify({jsonrpc:'2.0',id:1,method:'tools/call',params:{name:'balance',arguments:{}}}),signal:AbortSignal.timeout(20000)});
  const payload=await response.json().catch(()=>({}));let balance=payload.result?.structuredContent;
  if(!balance){try{balance=JSON.parse(payload.result?.content?.find(row=>row.type==='text')?.text||'{}');}catch{}}
  if(!response.ok||payload.error||payload.result?.isError||!balance?.team||!Number.isFinite(Number(balance.balance_usd)))throw new Error('Treg could not verify this team token.');
  return {team:clean(balance.team,100),balance_usd:Number(balance.balance_usd)};
}
async function verifyCredential(provider,apiKey){if(provider==='treg')return verifyTreg(apiKey);if(provider==='apollo')return verifyApollo(apiKey);if(provider==='firecrawl')return verifyFirecrawl(apiKey);return verifyHunter(apiKey);}

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
  // URL canonicalizes dotted IPv4-mapped addresses to two hexadecimal groups.
  const mappedHex=host.match(/^::ffff:([0-9a-f]{1,4}):([0-9a-f]{1,4})$/);
  if(mappedHex){const high=parseInt(mappedHex[1],16),low=parseInt(mappedHex[2],16);return privateIpv4([high>>8,high&255,low>>8,low&255].join('.'));}
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
function htmlText(html,baseUrl){
  const withoutNoise=exposePublishedEmailHtml(String(html||'').replace(/<!--[\s\S]*?-->/g,' ').replace(/<(script|style|noscript|svg|template)\b[^>]*>[\s\S]*?<\/\1>/gi,' '));
  const semantic=withoutNoise.replace(/<h([1-6])\b[^>]*>/gi,(_,level)=>'\n'+'#'.repeat(Number(level))+' ').replace(/<(strong|b)\b[^>]*>([\s\S]*?)<\/\1>/gi,(_,tag,text)=>'**'+clean(text.replace(/<[^>]*>/g,' '))+'** ').replace(/<\/t[dh]>/gi,' | ').replace(/<a\b[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi,(_,href,label)=>{let target;try{target=new URL(decodeHtmlEntities(href),baseUrl);}catch{return label;}return ['http:','https:','mailto:','tel:'].includes(target.protocol)?'['+label+']('+target.href+')':label;});
  return decodeHtmlEntities(semantic.replace(/<(br|hr)\b[^>]*>/gi,'\n').replace(/<\/(p|div|section|article|main|header|footer|nav|li|h[1-6]|tr)>/gi,'\n').replace(/<[^>]+>/g,' ')).replace(/[ \t]+/g,' ').replace(/\s*\n\s*/g,'\n').replace(/\n{3,}/g,'\n\n').trim().slice(0,MAX_DIRECT_PAGE_CHARS);
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
async function boundedPageBytes(response,signal){
  if(!response.body)return new Uint8Array();
  const reader=response.body.getReader(),chunks=[];let bytes=0;
  try{for(;;){signal?.throwIfAborted();const {done,value}=await reader.read();if(done)break;bytes+=value.byteLength;if(bytes>MAX_DIRECT_PAGE_BYTES)throw new Error('Website page is too large to read safely');chunks.push(value);}signal?.throwIfAborted();const data=new Uint8Array(bytes);let offset=0;for(const chunk of chunks){data.set(chunk,offset);offset+=chunk.byteLength;}return data;}
  catch(cause){await reader.cancel().catch(()=>{});throw cause;}finally{reader.releaseLock();}
}
async function boundedPageText(response,signal){return new TextDecoder().decode(await boundedPageBytes(response,signal));}
async function publicPdfText(response,url,signal){
  const declared=Number(response.headers.get('content-length')||0);if(declared>MAX_DIRECT_PAGE_BYTES)throw Error('Website page is too large to read safely');
  const bytes=await boundedPageBytes(response,signal);if(new TextDecoder().decode(bytes.subarray(0,5))!=='%PDF-')throw Error('Invalid PDF signature');signal?.throwIfAborted();
  const {getDocumentProxy}=await import('unpdf');
  const pdf=await getDocumentProxy(bytes,{isEvalSupported:false,useSystemFonts:true,disableFontFace:true});
  try{
    if(pdf.numPages>40)throw Error('Public PDF exceeds the 40-page direct extraction limit');const sections=[];let characters=0;
    for(let n=1;n<=pdf.numPages;n++){signal?.throwIfAborted();const page=await pdf.getPage(n);try{const content=await page.getTextContent(),text=content.items.map(item=>typeof item.str==='string'?item.str+(item.hasEOL?'\n':' '):'').join('').trim();characters+=text.length;if(characters>MAX_DIRECT_PAGE_CHARS)throw Error('Public PDF exceeds the direct extraction text limit');if(text)sections.push('## Page '+n+'\n'+text);}finally{page.cleanup();}}
    signal?.throwIfAborted();if(!sections.length)throw Error('PDF has no readable text');return {success:true,data:{markdown:sections.join('\n\n'),links:[],metadata:{title:new URL(url).pathname.split('/').pop(),sourceURL:url,url,statusCode:response.status,source:'direct-pdf',totalPages:pdf.numPages,readablePages:sections.length}}};
  }finally{await pdf.loadingTask.destroy();}
}
export async function fetchDirectPublicPage(value,{signal=AbortSignal.timeout(10000)}={}){
  let current=publicResearchUrl(value);if(!current)throw new Error('A valid public research URL is required');
  for(let redirects=0;redirects<=MAX_DIRECT_REDIRECTS;redirects++){
    signal?.throwIfAborted();
    const response=await fetch(current.href,{method:'GET',headers:{Accept:'text/html,application/xhtml+xml,text/plain;q=0.8,*/*;q=0.1','User-Agent':'LeadIntel/1.0 (+https://leadintel.ccgroup.lv)'},redirect:'manual',signal});
    if(response.status>=300&&response.status<400){
      const location=response.headers.get('location');if(!location)throw new Error(`Website redirect failed (${response.status})`);
      const next=publicResearchUrl(location,current.href);if(!next)throw new Error('Website redirected to a non-public URL');
      current=next;continue;
    }
    if(!response.ok)throw Object.assign(new Error(`Website returned ${response.status}`),{status:response.status});
    const contentType=(response.headers.get('content-type')||'').toLowerCase();
    if(contentType.includes('application/pdf')||/\.pdf$/i.test(current.pathname)&&contentType.includes('application/octet-stream'))return publicPdfText(response,current.href,signal);
    const sitemap=/\/(?:[^/]*sitemap[^/]*)\.xml$/i.test(current.pathname)&&/xml/i.test(contentType);
    if(!sitemap&&contentType&&!contentType.includes('text/html')&&!contentType.includes('application/xhtml+xml')&&!contentType.includes('text/plain'))throw new Error('Website did not return readable text');
    const declared=Number(response.headers.get('content-length')||0);if(declared>MAX_DIRECT_PAGE_BYTES)throw new Error('Website page is too large to read safely');
    const raw=await boundedPageText(response,signal);
    const links=[...raw.matchAll(sitemap?/<loc>\s*([^<]+)\s*<\/loc>/gi:/<a\b[^>]*href=["']([^"']+)["']/gi)].map(match=>publicResearchUrl(decodeHtmlEntities(match[1]),current.href)?.href).filter(Boolean).slice(0,500);
    const text=sitemap?'# Sitemap\n'+links.map(link=>'['+link+']('+link+')').join('\n'):contentType.includes('text/plain')?clean(raw,MAX_DIRECT_PAGE_CHARS):htmlText(raw,current.href);if(!text)throw new Error('No readable website content was returned');
    const title=contentType.includes('text/plain')?'':htmlMeta(raw,'title');const description=contentType.includes('text/plain')?'':htmlMeta(raw,'description');
    return {success:true,data:{markdown:text,links,metadata:{title:sitemap?'Sitemap':title||current.hostname,description,sourceURL:current.href,url:current.href,statusCode:response.status,source:'direct-fallback'}}};
  }
  throw new Error('Website redirected too many times');
}
function retryableFirecrawlStatus(status){return status===402||status===408||status===429||status>=500;}

export function hunterVerificationEnabled(row){
  try{return JSON.parse(row?.metadata_json||'{}')?.additional_verification_enabled===true;}catch{return false;}
}
export async function hunterVerificationPolicy(env,workspaceId){
  const row=await integrationRow(env,workspaceId,'hunter');
  let tregPrimary=false;try{tregPrimary=(await env.DB.prepare('SELECT provider FROM additional_contact_policies WHERE workspace_id=?').bind(workspaceId).first())?.provider==='treg';}catch(error){if(!/no such table/i.test(String(error.message)))throw error;}
  return {enabled:!tregPrimary&&hunterVerificationEnabled(row),configured:Boolean(row)};
}

export async function resolveWorkspaceServiceCredential(env,workspaceId,provider){
  const normalized=normalizeProvider(provider);if(!normalized||!workspaceId)return {provider:normalized,apiKey:'',source:'none',configured:false,row:null};
  try{
    const row=await integrationRow(env,workspaceId,normalized);
    if(row){const apiKey=await decryptRow(env,row);if(apiKey)return {provider:normalized,apiKey,source:'customer',configured:true,row};}
  }catch{}
  return {provider:normalized,apiKey:'',source:'none',configured:false,row:null};
}

export async function apolloCapabilities(env,workspaceId){
  let row=null;try{row=await integrationRow(env,workspaceId,'apollo');}catch{}let metadata={};try{metadata=JSON.parse(row?.metadata_json||'{}');}catch{}
  return {discovery:metadata.discovery_enabled!==false,email:metadata.email_enrichment_enabled===true,phone:metadata.phone_enrichment_enabled===true};
}

export async function requireWorkspaceServiceCredential(env,workspaceId,provider){
  const credential=await resolveWorkspaceServiceCredential(env,workspaceId,provider);
  if(credential.source!=='customer'||!credential.configured||!credential.apiKey)throw Object.assign(new Error(`Connect your own ${PROVIDER_NAMES[provider]||provider} API key in Settings. Shared provider billing is disabled.`),{status:409,code:'CUSTOMER_SERVICE_KEY_REQUIRED'});
  return credential;
}

export async function withWorkspaceServiceCredentials(request,env){
  const runtime=Object.create(env);runtime.APOLLO_API_KEY='';runtime.APOLLO_CREDENTIAL_REVISION='';
  runtime.APOLLO_WEBHOOK_SECRET=apolloWebhookSigningSecret(env);
  runtime.APOLLO_WEBHOOK_SERVER_BOUND=true;
  try{
    const url=new URL(request.url);const workspaceId=clean(url.searchParams.get('workspace_id')||'',120);if(!workspaceId)return runtime;
    const access=await requireMember(request,env,workspaceId);if(access.error)return runtime;
    const apolloCredential=await resolveWorkspaceServiceCredential(env,workspaceId,'apollo');
    if(apolloCredential.source==='customer'&&apolloCredential.apiKey){runtime.APOLLO_API_KEY=apolloCredential.apiKey;runtime.APOLLO_CREDENTIAL_REVISION=apolloCredential.row?.encrypted_api_key||'';}
  }catch{}
  return runtime;
}

async function providerStatus(env,workspaceId,provider,{verify=false,operationId,userId}={}){
  let row=null;try{row=await integrationRow(env,workspaceId,provider);}catch{}
  if(row){
    let metadata={};try{metadata=JSON.parse(row.metadata_json||'{}')||{};}catch{}
    let state='good',label='Connected';
    if(verify){
      const trace=type=>audit(env,{workspaceId,userId,type,provider,metadata:{operation_id:operationId}});
      await trace('service.provider_check_started');
      try{
        const apiKey=await decryptRow(env,row);metadata={...metadata,...await verifyCredential(provider,apiKey)};
        // A check belongs to the exact encrypted credential it read. Replacing or
        // disconnecting that credential while the provider responds invalidates it.
        const saved=await env.DB.prepare(`UPDATE workspace_service_integrations SET metadata_json=CASE WHEN provider='hunter' THEN json_set(?, '$.additional_verification_enabled', json(CASE WHEN json_extract(metadata_json,'$.additional_verification_enabled')=1 THEN 'true' ELSE 'false' END)) ELSE json_patch(?,CASE WHEN provider='apollo' THEN json_object('discovery_enabled',json(CASE WHEN json_extract(metadata_json,'$.discovery_enabled')=0 THEN 'false' ELSE 'true' END),'email_enrichment_enabled',json(CASE WHEN json_extract(metadata_json,'$.email_enrichment_enabled')=1 THEN 'true' ELSE 'false' END),'phone_enrichment_enabled',json(CASE WHEN json_extract(metadata_json,'$.phone_enrichment_enabled')=1 THEN 'true' ELSE 'false' END)) ELSE json('{}') END) END,verified_at=CURRENT_TIMESTAMP,updated_at=CURRENT_TIMESTAMP
          WHERE workspace_id=? AND provider=? AND encrypted_api_key=?`).bind(JSON.stringify(metadata),JSON.stringify(metadata),workspaceId,provider,row.encrypted_api_key).run();
        if(!saved?.meta?.changes){await trace('service.provider_check_superseded');return providerStatus(env,workspaceId,provider);}
        const balance=verifiedCreditBalance(provider,metadata);if(balance)await recordProviderCredit(env,{workspaceId,provider,kind:balance,source:'customer'});
        await trace('service.provider_check_succeeded');return providerStatus(env,workspaceId,provider);
      }
      catch(cause){
        if((await integrationRow(env,workspaceId,provider))?.encrypted_api_key!==row.encrypted_api_key){await trace('service.provider_check_superseded');return providerStatus(env,workspaceId,provider);}
        await trace('service.provider_check_failed');
        if(creditFailure(0,cause?.message)||/\(402\)/.test(String(cause?.message)))await recordProviderCredit(env,{workspaceId,provider,kind:'failed',source:'customer'});
        state='bad';label='Connection error';metadata={...metadata,error:verificationMessage(provider,cause)};
      }
    }
    return {provider,name:PROVIDER_NAMES[provider],configured:true,source:'customer',state,label,key_hint:row.key_hint||'',verified_at:row.verified_at||null,last_used_at:row.last_used_at||null,metadata};
  }
  return {provider,name:PROVIDER_NAMES[provider],configured:false,source:'none',state:'neutral',label:'Not connected',key_hint:'',verified_at:null,last_used_at:null,metadata:{billing:'customer_only'}};
}

function workspaceIdFrom(url){return clean(url.searchParams.get('workspace_id')||'',120);}
async function extractionFallback(env,url,access,workspaceId,credential,status,signal,operationId){
  const direct=await fetchDirectPublicPage(url,{signal:AbortSignal.any([signal,AbortSignal.timeout(10000)])});
  const researchTrace=[{provider:'firecrawl',operation:'extract',status:'failed',results:0,...(status?{httpStatus:status}:{})},{provider:'direct',operation:'extract',status:'succeeded',results:1}];
  await audit(env,{workspaceId,userId:access.user.id,type:'service.firecrawl_scrape',provider:'firecrawl',metadata:{operation_id:operationId,source:direct.data.metadata.source,upstream_source:'customer',upstream_status:status,researchTrace}});
  return {...direct,researchTrace};
}
export async function readPublicBuyerPage(env,workspaceId,url,{signal=new AbortController().signal,totalTimeoutMs=25000,directTimeoutMs=10000,firecrawlTimeoutMs=20000}={}){
  if(!publicResearchUrl(url))throw Object.assign(new Error('A valid public research URL is required'),{status:400});
  const totalBudget=Math.max(100,Math.min(55000,Math.floor(Number(totalTimeoutMs)||25000))),deadline=Date.now()+totalBudget;
  const pageSignal=AbortSignal.any([signal,AbortSignal.timeout(totalBudget)]),remaining=()=>Math.max(0,deadline-Date.now());
  const hasScrapling=scraplingConfigured(env),reserve=hasScrapling?Math.min(15000,Math.floor(totalBudget*.6)):0;
  const researchTrace=[],unused=provider=>researchTrace.push({provider,operation:'extract',status:'skipped',results:0,reason:'Earlier extractor succeeded'});
  const check=()=>{if(pageSignal.aborted||remaining()<=0){const timedOut=pageSignal.reason?.name==='TimeoutError'||remaining()<=0;throw Object.assign(new Error(timedOut?'Public extraction deadline exceeded':'Public extraction canceled'),{status:timedOut?504:499,researchTrace});}};
  const valid=page=>{const text=String(page?.markdown||page?.content||'').trim();return text.length>=40&&!(/just a moment|access denied|verify you are human|cloudflare ray id/i.test(text)&&text.length<1600);};
  const blocked=()=>Object.assign(new Error('Blocked or empty page'),{failureKind:'blocked_content',code:'PUBLIC_EXTRACTION_BLOCKED_CONTENT'});
  const attemptSignal=ms=>AbortSignal.any([pageSignal,AbortSignal.timeout(Math.max(1,Math.floor(ms)))]);
  const failed=(provider,cause,started,timeoutMs,attempt)=>{
    const kind=attempt.aborted?(attempt.reason?.name==='TimeoutError'?'timeout':'cancelled'):cause.failureKind||((cause.httpStatus||cause.status)?'http':'network');
    const httpStatus=Number(cause.httpStatus||cause.status)||0;
    researchTrace.push({provider,operation:'extract',status:'failed',results:0,failureKind:kind,code:cause.code||`PUBLIC_EXTRACTION_${kind.toUpperCase()}`,reason:kind==='timeout'?'Extraction deadline exceeded':kind==='cancelled'?'Extraction canceled':kind==='authentication'?`${provider==='scrapling'?'Scrapling':'Firecrawl'} service authentication failed`:kind==='blocked_content'?'Blocked or unreadable page':httpStatus?`Extractor returned HTTP ${httpStatus}`:'Extractor request failed',...(httpStatus?{httpStatus}:{}),elapsedMs:Math.max(0,Date.now()-started),timeoutMs});
  };
  check();
  let budget=Math.max(1,Math.min(Number(directTimeoutMs)||10000,10000,hasScrapling?totalBudget*.2:remaining())),attempt=attemptSignal(budget),started=Date.now();
  try{const result=await fetchDirectPublicPage(url,{signal:attempt});check();if(!valid(result.data))throw blocked();researchTrace.push({provider:'direct',operation:'extract',status:'succeeded',results:1});unused('firecrawl');unused('scrapling');return {...result,researchTrace};}
  catch(cause){failed('direct',cause,started,budget,attempt);check();}
  let credential;
  try{credential=await requireWorkspaceServiceCredential(env,workspaceId,'firecrawl');}catch{researchTrace.push({provider:'firecrawl',operation:'extract',status:'skipped',results:0,reason:'Workspace Firecrawl credential unavailable'});}
  if(credential){
    check();budget=Math.max(1,Math.min(Number(firecrawlTimeoutMs)||20000,20000,remaining()-reserve));attempt=attemptSignal(budget);started=Date.now();
    try{
      const response=await fetch('https://api.firecrawl.dev/v2/scrape',{method:'POST',headers:{'Content-Type':'application/json',Accept:'application/json',Authorization:`Bearer ${credential.apiKey}`},body:JSON.stringify({url,formats:['markdown','links'],onlyMainContent:false,waitFor:2000,maxAge:0}),signal:attempt});
      const payload=await response.json(),data=payload.data||payload;check();attempt.throwIfAborted();if(!response.ok)throw Object.assign(new Error('Extractor HTTP failure'),{httpStatus:response.status,failureKind:[401,403].includes(response.status)?'authentication':'http'});if(payload.success===false||!valid(data))throw blocked();
      researchTrace.push({provider:'firecrawl',operation:'extract',status:'succeeded',results:1});unused('scrapling');
      if(credential.source==='customer')await env.DB.prepare("UPDATE workspace_service_integrations SET last_used_at=CURRENT_TIMESTAMP WHERE workspace_id=? AND provider='firecrawl'").bind(workspaceId).run();
      return {success:true,data:{...data,metadata:{...data.metadata,source:'firecrawl'}},researchTrace};
    }catch(cause){failed('firecrawl',cause,started,budget,attempt);check();}
  }
  check();
  if(hasScrapling){budget=Math.max(1,Math.min(35000,remaining()));attempt=attemptSignal(budget);started=Date.now();try{const result=await fetchWithScrapling(env,url,{signal:attempt,timeoutMs:budget});check();if(!valid(result.data))throw blocked();researchTrace.push({provider:'scrapling',operation:'extract',status:'succeeded',results:1});return {...result,researchTrace};}catch(cause){failed('scrapling',cause,started,budget,attempt);check();}}
  else researchTrace.push({provider:'scrapling',operation:'extract',status:'skipped',results:0,reason:'Fallback not configured'});
  throw Object.assign(new Error('Public source extraction unavailable'),{status:502,researchTrace});
}
async function forwardFirecrawl(request,env,cors,workspaceId,kind,operationId){
  const access=await requireMember(request,env,workspaceId,['owner','researcher','sales']);if(access.error)return error(access.error,access.status,cors);
  const body=await request.json().catch(()=>null);if(!body||typeof body!=='object')return error('Firecrawl request payload is required',400,cors);
  let target='',payload={},researchUrl=null;
  if(kind==='scrape'){
    researchUrl=publicResearchUrl(body.url);if(!researchUrl)return error('A valid public research URL is required',400,cors);
    payload={url:researchUrl.href,formats:Array.isArray(body.formats)&&body.formats.includes('links')?['markdown','links']:['markdown'],onlyMainContent:body.onlyMainContent!==false,timeout:Math.max(5000,Math.min(60000,Number(body.timeout)||30000))};
    target='https://api.firecrawl.dev/v2/scrape';
  }else{
    const rawQuery=String(body.query||'').trim();if(!rawQuery||rawQuery.length>600)return error('Firecrawl search query is invalid',400,cors);const query=clean(rawQuery,600);
    const limit=Math.max(1,Math.min(10,Math.floor(Number(body.limit)||4)));
    const wantsMarkdown=Array.isArray(body.scrapeOptions?.formats)&&body.scrapeOptions.formats.includes('markdown');
    const location=typeof body.location==='string'?clean(body.location,100):'';
    const country=typeof body.country==='string'&&/^[a-z]{2}$/i.test(body.country)?body.country.toUpperCase():'';
    payload={query,limit,...(location?{location}:{}),...(country?{country}:{}),...(wantsMarkdown?{scrapeOptions:{formats:['markdown']}}:{})};
    target='https://api.firecrawl.dev/v2/search';
  }
  if(kind==='scrape'&&body.publicFirst===true){
    if(request.signal.aborted)return cancelledResponse(request.signal,cors);
    try{const extracted=await readPublicBuyerPage(env,workspaceId,researchUrl.href,{signal:providerSignal(request,55000)});await audit(env,{workspaceId,userId:access.user.id,type:'service.public_page',provider:'public_web',metadata:{operation_id:operationId,source:extracted.data.metadata?.source,researchTrace:extracted.researchTrace}});return json(extracted,200,cors);}
    catch(cause){await audit(env,{workspaceId,userId:access.user.id,type:'service.public_page',provider:'public_web',metadata:{operation_id:operationId,status:'failed',researchTrace:cause.researchTrace||[]}});return json({error:cause.message,code:'PUBLIC_EXTRACTION_UNAVAILABLE',researchTrace:cause.researchTrace||[]},cause.status||502,cors);}
  }
  let credential;try{credential=await requireWorkspaceServiceCredential(env,workspaceId,'firecrawl');}catch(cause){return error(cause.message,cause.status,cors,cause.code);}
  const headers={'Content-Type':'application/json',Accept:'application/json'};if(credential.source==='customer')headers.Authorization=`Bearer ${credential.apiKey}`;
  const signal=providerSignal(request,kind==='scrape'?Math.min(65000,payload.timeout+5000):30000);
  if(signal.aborted)return cancelledResponse(signal,cors);
  const protectedResult=async value=>{
    if(signal.aborted)return cancelledResponse(signal,cors);
    const current=await requireMember(request,env,workspaceId,['owner','researcher','sales']);
    return current.error?error(current.error,current.status,cors):json(value,200,cors);
  };
  // Workspace gate (firecrawl-rate-gate.js): Firecrawl limits are per team per minute, the browser fans out from many
  // places and tabs, so the Worker paces every customer-key request and WAITS for the next slot while the request's
  // own deadline allows. Only when the slot is further away than the deadline does the caller get a 429 that names
  // the plan limit — a 429 from this gate never reached Firecrawl and never cost a credit.
  const plan=firecrawlPlanFromRow(credential.row);
  const waitBudgetMs=kind==='scrape'?Math.max(0,Math.min(65000,payload.timeout+5000)-15000):20000;
  const gate=await acquireFirecrawlSlot(env,workspaceId,kind,{limit:plan?plan[kind]:null,signal,deadlineMs:waitBudgetMs});
  if(gate.aborted||signal.aborted)return cancelledResponse(signal,cors);
  if(!gate.allowed){
    const seconds=Math.max(1,Math.ceil(gate.retryAfterMs/1000));
    const message=gate.reason==='upstream_429'?`Firecrawl reported a rate limit on this plan; the next ${kind} can start in ${seconds} s.`:`Firecrawl ${kind} limit on the ${plan?.name||'current'} plan is ${plan?.[kind]??'a fixed number of'} requests per minute; the next slot opens in ${seconds} s.`;
    return json({error:message,code:'FIRECRAWL_RATE_LIMIT',retry_after:seconds,plan:plan?.name||null,limit_per_minute:plan?.[kind]??null,kind},429,{...cors,'Retry-After':String(seconds)});
  }
  let response;try{response=await fetch(target,{method:'POST',headers,body:JSON.stringify(payload),signal});}catch(cause){
    if(signal.aborted)return cancelledResponse(signal,cors);
    if(kind==='scrape'&&researchUrl){
      try{const direct=await extractionFallback(env,researchUrl.href,access,workspaceId,credential,0,signal,operationId);return protectedResult(direct);}catch{if(signal.aborted)return cancelledResponse(signal,cors);}
    }
    return error(`Firecrawl ${kind} is temporarily unavailable`,502,cors);
  }
  const upstream=await response.json().catch(()=>({}));
  if(signal.aborted)return cancelledResponse(signal,cors);
  const current=await requireMember(request,env,workspaceId,['owner','researcher','sales']);if(current.error)return error(current.error,current.status,cors);
  if(!response.ok||upstream?.success===false){
    const status=response.ok?502:response.status;
    if(creditFailure(status,upstream?.error||upstream?.message))await recordProviderCredit(env,{workspaceId,userId:access.user.id,provider:'firecrawl',kind:'failed',source:credential.source});
    let upstreamRetryAfterMs=0;if(response.status===429){upstreamRetryAfterMs=parseRetryAfterMs(response,upstream);await recordFirecrawlRateLimit(env,workspaceId,kind,upstreamRetryAfterMs);}
    const canFallback=kind==='scrape'&&researchUrl&&retryableFirecrawlStatus(status);
    if(canFallback){
      try{const direct=await extractionFallback(env,researchUrl.href,access,workspaceId,credential,status,signal,operationId);return protectedResult(direct);}catch{if(signal.aborted)return cancelledResponse(signal,cors);}
    }
    if(response.status===429){const seconds=Math.max(1,Math.ceil(upstreamRetryAfterMs/1000));return json({error:`Firecrawl rate limit reached on your plan (429). The next ${kind} can start in ${seconds} s.`,code:'FIRECRAWL_UPSTREAM_RATE_LIMIT',retry_after:seconds,kind},429,{...cors,'Retry-After':String(seconds)});}
    return error(`Firecrawl ${kind} failed (${status})`,status>=400&&status<600?status:502,cors);
  }
  await recordProviderCredit(env,{workspaceId,userId:access.user.id,provider:'firecrawl',kind:'recovered',source:credential.source});
  if(credential.source==='customer')await env.DB.prepare(`UPDATE workspace_service_integrations SET last_used_at=CURRENT_TIMESTAMP,updated_at=CURRENT_TIMESTAMP WHERE workspace_id=? AND provider='firecrawl'`).bind(workspaceId).run();
  const rows=Array.isArray(upstream?.data?.web)?upstream.data.web:Array.isArray(upstream?.data)?upstream.data:[];
  const researchTrace=[{provider:'firecrawl',operation:kind==='search'?'search':'extract',status:'succeeded',results:kind==='search'?rows.length:String(upstream?.data?.markdown||upstream?.data?.content||'').trim()?1:0}];
  await audit(env,{workspaceId,userId:access.user.id,type:`service.firecrawl_${kind}`,provider:'firecrawl',metadata:{operation_id:operationId,source:credential.source,researchTrace}});
  if(kind==='search'&&credential.source==='customer'&&Array.isArray(upstream?.data?.web))return protectedResult({...upstream,data:upstream.data.web,researchTrace});
  if(kind==='scrape'&&upstream.data&&typeof upstream.data==='object')return protectedResult({...upstream,data:{...upstream.data,metadata:{...upstream.data.metadata,source:'firecrawl'}},researchTrace});
  return protectedResult({...upstream,researchTrace});
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
  const broad=body.discovery_scope==='company',keywords=clean(body.q_keywords,180),fallback=broad&&body.companyNameFallback===true&&keywords&&keywords===clean(body.company_name,180);
  return {payload:{...(fallback?{q_keywords:keywords}:{q_organization_domains_list:[domain]}),person_titles:broad?[]:titles,include_similar_titles:true,person_seniorities:broad?[]:[...APOLLO_PEOPLE_SENIORITIES],page:1,per_page:broad?25:10},domain,roleCount:broad?0:titles.length};
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
  if(!credential.configured||!credential.apiKey)return error('Apollo is not connected for this workspace. Connect it in Settings.',409,cors,'SERVICE_APOLLO_NOT_CONFIGURED');
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
  const people=rawPeople.slice(0,normalized.payload.per_page).map(publicApolloBuyer).filter(person=>person.name||person.title);
  if(credential.source==='customer')await env.DB.prepare(`UPDATE workspace_service_integrations SET last_used_at=CURRENT_TIMESTAMP,updated_at=CURRENT_TIMESTAMP WHERE workspace_id=? AND provider='apollo'`).bind(workspaceId).run();
  await audit(env,{workspaceId,userId:access.user.id,type:'service.apollo_people_search',provider:'apollo',metadata:{source:credential.source,domain:normalized.domain,role_count:normalized.roleCount,result_count:people.length}});
  return json({people},200,cors);
}

export async function handleServiceIntegrationRoute(request,env,cors={}){
  const url=new URL(request.url);const path=url.pathname;
  const known=path.startsWith('/api/integrations/services/');if(!known)return null;
  const requestedOperation=request.headers.get('X-LeadIntel-Operation-Id')||'';
  const operationId=/^[A-Za-z0-9._:-]{8,80}$/.test(requestedOperation)?requestedOperation:uuid();
  cors={...cors,'X-LeadIntel-Operation-Id':operationId};
  const workspaceId=workspaceIdFrom(url);if(!workspaceId)return error('workspace_id is required',400,cors);

  if(path==='/api/integrations/services/contact-policy'&&request.method==='GET'){
    const access=await requireMember(request,env,workspaceId);if(access.error)return error(access.error,access.status,cors);
    return json({confirmationLevel:await loadConfirmationLevel(env,workspaceId),apollo:await apolloCapabilities(env,workspaceId)},200,cors);
  }

  if(path==='/api/integrations/services/status'&&request.method==='GET'){
    const access=await requireMember(request,env,workspaceId);if(access.error)return error(access.error,access.status,cors);
    const verify=url.searchParams.get('verify')==='1';
    const providers=[];for(const provider of PROVIDERS){
      const state=await providerStatus(env,workspaceId,provider,{verify,operationId,userId:access.user.id});
      state.credit_issue=state.source==='customer'?await providerCreditIssue(env,workspaceId,provider):null;
      if(state.source==='customer'&&verifiedCreditBalance(provider,state.metadata)==='failed')state.credit_issue={code:'credits_exhausted',source:'customer'};
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
    const previous=await integrationRow(env,workspaceId,provider);
    await audit(env,{workspaceId,userId:access.user.id,type:'service.provider_check_started',provider,metadata:{operation_id:operationId}});
    let metadata;try{metadata=await verifyCredential(provider,apiKey);if(provider==='apollo'){let prior={};try{prior=JSON.parse((await integrationRow(env,workspaceId,provider))?.metadata_json||'{}');}catch{}for(const key of ['discovery_enabled','email_enrichment_enabled','phone_enrichment_enabled'])metadata[key]=prior[key]??(key==='discovery_enabled');}if(provider==='hunter')metadata.additional_verification_enabled=hunterVerificationEnabled(await integrationRow(env,workspaceId,provider));}catch(cause){await audit(env,{workspaceId,userId:access.user.id,type:'service.provider_check_failed',provider,metadata:{operation_id:operationId}});return error(verificationMessage(provider,cause),422,cors);}
    try{
      const key=await importAesKey(env.OAUTH_TOKEN_ENCRYPTION_KEY);const encrypted=await encryptSecret(apiKey,key);
      const saved=await env.DB.prepare(`INSERT INTO workspace_service_integrations(workspace_id,provider,encrypted_api_key,key_hint,metadata_json,verified_at,created_at,updated_at)
        SELECT ?,?,?,?,?,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP
        WHERE COALESCE((SELECT encrypted_api_key FROM workspace_service_integrations WHERE workspace_id=? AND provider=?),'')=?
          AND ${OWNER_SESSION_GUARD}
        ON CONFLICT(workspace_id,provider) DO UPDATE SET encrypted_api_key=excluded.encrypted_api_key,key_hint=excluded.key_hint,metadata_json=CASE WHEN provider='hunter' THEN json_set(excluded.metadata_json, '$.additional_verification_enabled', json(CASE WHEN json_extract(workspace_service_integrations.metadata_json,'$.additional_verification_enabled')=1 THEN 'true' ELSE 'false' END)) WHEN provider='apollo' THEN json_patch(excluded.metadata_json,json_object('discovery_enabled',json(CASE WHEN json_extract(workspace_service_integrations.metadata_json,'$.discovery_enabled')=0 THEN 'false' ELSE 'true' END),'email_enrichment_enabled',json(CASE WHEN json_extract(workspace_service_integrations.metadata_json,'$.email_enrichment_enabled')=1 THEN 'true' ELSE 'false' END),'phone_enrichment_enabled',json(CASE WHEN json_extract(workspace_service_integrations.metadata_json,'$.phone_enrichment_enabled')=1 THEN 'true' ELSE 'false' END))) ELSE excluded.metadata_json END,verified_at=CURRENT_TIMESTAMP,updated_at=CURRENT_TIMESTAMP`).bind(workspaceId,provider,encrypted,keyHint(apiKey),JSON.stringify(metadata),workspaceId,provider,
        previous?.encrypted_api_key||'',access.user.sessionTokenHash,access.user.id,workspaceId).run();
      if(!saved?.meta?.changes){const denied=await deniedOwnerCommit(env,{workspaceId,user:access.user,provider,operationId,cors});if(denied)return denied;await audit(env,{workspaceId,userId:access.user.id,type:'service.provider_check_superseded',provider,metadata:{operation_id:operationId}});return error('Service connection changed while checking the key. Reload Settings before retrying.',409,cors,'SERVICE_CONNECTION_CONFLICT');}
      const balance=verifiedCreditBalance(provider,metadata);if(balance)await recordProviderCredit(env,{workspaceId,userId:access.user.id,provider,kind:balance,source:'customer'});
      await audit(env,{workspaceId,userId:access.user.id,type:'service.provider_saved',provider,metadata:{source:'customer',operation_id:operationId}});
      return json({saved:true,provider,name:PROVIDER_NAMES[provider],configured:true,source:'customer',key_hint:keyHint(apiKey),verified_at:new Date().toISOString(),metadata},200,cors);
    }catch{await audit(env,{workspaceId,userId:access.user.id,type:'service.provider_save_failed',provider,metadata:{operation_id:operationId}});return error('Unable to save service provider configuration',500,cors);}
  }

  if(path==='/api/integrations/services/provider'&&request.method==='DELETE'){
    const access=await requireMember(request,env,workspaceId,['owner']);if(access.error)return error(access.error,access.status,cors);
    const body=await request.json().catch(()=>null);const provider=normalizeProvider(body?.provider);if(!provider)return error('Unsupported service provider',400,cors);
    const result=await env.DB.prepare(`DELETE FROM workspace_service_integrations WHERE workspace_id=? AND provider=?`).bind(workspaceId,provider).run();
    await audit(env,{workspaceId,userId:access.user.id,type:'service.provider_disconnected',provider,metadata:{operation_id:operationId}});
    return json({disconnected:Number(result?.meta?.changes||0)>0,provider,fallback:false},200,cors);
  }

  if(path==='/api/integrations/services/hunter/verify-email'&&request.method==='POST'){
    const access=await requireMember(request,env,workspaceId,['owner','researcher','sales']);if(access.error)return error(access.error,access.status,cors);
    const body=await request.json().catch(()=>null);const email=clean(body?.email,320).toLowerCase();
    if(!/^[a-z0-9][a-z0-9._%+-]{0,63}@[a-z0-9](?:[a-z0-9.-]{0,251}[a-z0-9])?\.[a-z]{2,}$/i.test(email)||email.includes('..'))return error('A valid email address is required',400,cors);
    if(!(await hunterVerificationPolicy(env,workspaceId)).enabled)return error('Hunter is optional and disabled. Enable additional verification in Settings to use credits.',409,cors,'SERVICE_HUNTER_DISABLED');
    const credential=await resolveWorkspaceServiceCredential(env,workspaceId,'hunter');
    if(credential.source!=='customer'||!credential.apiKey)return error('Connect Hunter in Settings before checking an email',409,cors,'SERVICE_HUNTER_NOT_CONFIGURED');
    let response;try{response=await fetch(`https://api.hunter.io/v2/email-verifier?email=${encodeURIComponent(email)}`,{method:'GET',headers:{Accept:'application/json','X-API-KEY':credential.apiKey}});}catch{return error('Hunter is temporarily unavailable',502,cors);}
    if(response.status===451)return error('Hunter cannot process this address',451,cors,'SERVICE_HUNTER_CLAIMED_EMAIL');
    if(response.status===202||response.status===222)return json({email,status:'unknown',deliverability:'inconclusive',identity_confirmed:false,provider:'Hunter',pending:response.status===202},200,cors);
    const payload=await response.json().catch(()=>({}));
    if(!response.ok){const payment=creditFailure(response.status,JSON.stringify(payload));if(payment)await recordProviderCredit(env,{workspaceId,userId:access.user.id,provider:'hunter',kind:'failed',source:'customer'});return error(payment?'Hunter credits exhausted or payment required':response.status===401?'Hunter key was rejected':response.status===403||response.status===429?'Hunter request limit reached':`Hunter verification failed (${response.status})`,response.status>=400&&response.status<500?response.status:502,cors);}
    await recordProviderCredit(env,{workspaceId,userId:access.user.id,provider:'hunter',kind:'recovered',source:'customer'});
    const data=payload.data||{};
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
    if(credential.source!=='customer'||!credential.apiKey)return error('Connect Hunter in Settings before confirming email',409,cors,'SERVICE_HUNTER_NOT_CONFIGURED');
    const params=new URLSearchParams({domain,first_name:first,last_name:last});
    let response;try{response=await fetch(`https://api.hunter.io/v2/email-finder?${params}`,{method:'GET',headers:{Accept:'application/json','X-API-KEY':credential.apiKey}});}catch{return error('Hunter is temporarily unavailable',502,cors);}
    if(response.status===451)return error('Hunter cannot process this person',451,cors,'SERVICE_HUNTER_CLAIMED_EMAIL');
    const payload=await response.json().catch(()=>({}));
    if(!response.ok){const payment=creditFailure(response.status,JSON.stringify(payload));if(payment)await recordProviderCredit(env,{workspaceId,userId:access.user.id,provider:'hunter',kind:'failed',source:'customer'});return error(payment?'Hunter credits exhausted or payment required':response.status===401?'Hunter key was rejected':response.status===403||response.status===429?'Hunter request limit reached':`Hunter email search failed (${response.status})`,response.status>=400&&response.status<500?response.status:502,cors);}
    await recordProviderCredit(env,{workspaceId,userId:access.user.id,provider:'hunter',kind:'recovered',source:'customer'});
    const data=payload.data||{};
    const email=clean(data.email,320).toLowerCase();
    if(email&&!email.endsWith(`@${domain}`))return error('Hunter returned an unexpected company domain',502,cors);
    const source=Array.isArray(data.sources)?data.sources.find(item=>{try{const url=new URL(item.uri);return ['http:','https:'].includes(url.protocol)&&!url.username&&!url.password;}catch{return false;}})?.uri||'':'';
    await env.DB.prepare(`UPDATE workspace_service_integrations SET last_used_at=CURRENT_TIMESTAMP,updated_at=CURRENT_TIMESTAMP WHERE workspace_id=? AND provider='hunter'`).bind(workspaceId).run();
    await audit(env,{workspaceId,userId:access.user.id,type:'service.hunter_find_email',provider:'hunter',metadata:{found:Boolean(email),domain}});
    return json({email,source:clean(source,1000),source_type:clean(data.source_type,30),status:clean(data.verification?.status,30),provider:'Hunter',identity_confirmed:false},200,cors);
  }

  if(path==='/api/integrations/services/firecrawl/scrape'&&request.method==='POST')return forwardFirecrawl(request,env,cors,workspaceId,'scrape',operationId);
  if(path==='/api/integrations/services/firecrawl/search'&&request.method==='POST')return forwardFirecrawl(request,env,cors,workspaceId,'search',operationId);
  if(path==='/api/integrations/services/apollo/people-search'&&request.method==='POST')return forwardApolloPeopleSearch(request,env,cors,workspaceId);
  return error('Method not allowed',405,cors);
}
