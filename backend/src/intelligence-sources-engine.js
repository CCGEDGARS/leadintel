const clean=(value,max=2000)=>String(value??'').replace(/\s+/g,' ').trim().slice(0,max);
const uniq=(items,limit=50)=>[...new Set((Array.isArray(items)?items:String(items??'').split(/\n|;|\|/)).map(item=>clean(item,300)).filter(Boolean))].slice(0,limit);
const AUTH_MODES=new Set(['public','google','username_password','api_key','subscription','manual_only']);
const ACCESS=new Set(['not_tested','full','partial','no_access']);
const FREQUENCIES=new Set(['daily','weekly','monthly']);
const SOURCE_TYPES=new Set(['news','tenders','jobs','investments','company','registries','government','court','construction','industry','other']);

function isPrivateIpv4(host){
  const match=host.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);if(!match)return false;
  const p=match.slice(1).map(Number);if(p.some(n=>n<0||n>255))return true;
  return p[0]===10||p[0]===127||p[0]===0||(p[0]===169&&p[1]===254)||(p[0]===192&&p[1]===168)||(p[0]===172&&p[1]>=16&&p[1]<=31);
}
export function validateSourceUrl(value){
  try{
    const url=new URL(clean(value,1500));
    if(!['http:','https:'].includes(url.protocol))return {ok:false,error:'Only public http(s) sources are supported'};
    const host=url.hostname.toLowerCase().replace(/\.$/,'');
    if(!host||host==='localhost'||host.endsWith('.localhost')||host.endsWith('.local')||host.endsWith('.internal')||isPrivateIpv4(host)||host==='::1')return {ok:false,error:'Private or local network sources are not allowed'};
    url.hash='';url.hostname=host;url.pathname=url.pathname.replace(/\/+$/,'')||'/';
    const canonical=url.pathname==='/'&&!url.search?url.origin+'/':url.href;
    return {ok:true,url:canonical,host:host.replace(/^www\./,'')};
  }catch{return {ok:false,error:'Enter a valid public website URL'};}
}

export function normalizeSourceInput(input={}){
  const valid=validateSourceUrl(input.url||input.canonical_url||input.canonicalUrl||'');
  const status=ACCESS.has(clean(input.access_status||input.accessStatus).toLowerCase())?clean(input.access_status||input.accessStatus).toLowerCase():'not_tested';
  const authMode=AUTH_MODES.has(clean(input.auth_mode||input.authMode).toLowerCase())?clean(input.auth_mode||input.authMode).toLowerCase():'public';
  const frequency=FREQUENCIES.has(clean(input.frequency).toLowerCase())?clean(input.frequency).toLowerCase():'daily';
  const type=SOURCE_TYPES.has(clean(input.source_type||input.sourceType).toLowerCase())?clean(input.source_type||input.sourceType).toLowerCase():'other';
  const monitoringEnabled=Boolean(input.monitoring_enabled??input.monitoringEnabled);
  const useful=status==='full'||status==='partial';
  return {valid:valid.ok,error:valid.error||'',name:clean(input.name,180)||(valid.host||'Source'),url:valid.url||'',host:valid.host||'',sourceType:type,geography:uniq(input.geography||input.geography_json,20),authMode,authRequired:authMode!=='public',accessStatus:status,frequency,triggerIds:uniq(input.trigger_ids||input.triggerIds,40),monitoringEnabled,mandatory:Boolean(input.mandatory)&&useful,authenticatedAccessStatus:clean(input.authenticated_access_status||input.authenticatedAccessStatus).toLowerCase()||'not_connected'};
}

export function inferExtractableData(text=''){
  const hay=clean(text,50000).toLowerCase(),out=[];const add=(id,re)=>{if(re.test(hay))out.push(id);};
  add('company_identity',/company|uzņēmum|business|organisation|organization|reģistr/);
  add('legal_registry',/registration|register|legal address|juridisk|reģistrācijas|statuss|status/);
  add('leadership',/director|board|management|ceo|chairman|valde|vadīt|amatperson/);
  add('ownership',/owner|shareholder|beneficial|īpašnie|dalībnie|patiesais labuma/);
  add('financials',/revenue|turnover|profit|annual report|financial|apgrozījum|peļņ|gada pārskat/);
  add('workforce',/employees|employee count|darbiniek|workforce|headcount/);
  add('jobs',/vacanc|career|hiring|recruit|vakanc|darba piedāv/);
  add('projects',/project|construction|building permit|development|projek|būvniec|atļauj/);
  add('procurement',/procurement|tender|iepirkum|contract award/);
  add('contacts',/contact|email|phone|e-mail|tālrun|adrese/);
  add('news',/news|press release|announcement|ziņas|jaunumi|paziņoj/);
  return out;
}

export function gradeAccessAudit(result={}){
  if(!result.ok)return {status:'no_access',restrictionReason:clean(result.error||'No useful public content returned',500),contentChars:0};
  const text=String(result.text||''),contentChars=text.trim().length;
  if(!contentChars)return {status:'no_access',restrictionReason:'No readable public content returned',contentChars:0};
  const restricted=/sign in|log in|login|authenticate|subscription required|subscribe to continue|captcha|access denied|pieslēgties|autoriz/i.test(text);
  if(restricted)return {status:'partial',restrictionReason:'Public content is available, but an authentication or access boundary was detected',contentChars};
  if(contentChars<1200)return {status:'partial',restrictionReason:'Public extraction returned limited content',contentChars};
  return {status:'full',restrictionReason:'',contentChars};
}

function signalTerms(signal={}){return uniq(String(signal.keywords||signal.name||'').replace(/,/g,';'),4).join(' ');}
export function buildMandatorySourceQueries(sources=[],signals=[],profile={}){
  const signalMap=new Map((signals||[]).filter(s=>s&&s.active!==false).map(s=>[clean(s.id),s]));
  const market=clean(profile.targetMarkets||profile.researchMarkets||profile.currentMarkets,500);const offer=clean(profile.priorityOffers||profile.marketFocus,500);
  const out=[];
  for(const raw of sources||[]){
    const source={...raw,monitoringEnabled:Boolean(raw.monitoringEnabled??raw.monitoring_enabled),accessStatus:clean(raw.accessStatus||raw.access_status).toLowerCase(),triggerIds:uniq(raw.triggerIds||raw.trigger_ids,40)};
    if(!source.mandatory||!source.monitoringEnabled||!['full','partial'].includes(source.accessStatus)||!clean(source.host))continue;
    const selected=source.triggerIds.map(id=>signalMap.get(id)).filter(Boolean);if(!selected.length)continue;
    out.push({id:`mandatory-${clean(source.id,100)}`,sourceId:clean(source.id,120),sourceName:clean(source.name,180),sourceType:'mandatory',host:clean(source.host,240),signalIds:selected.map(s=>clean(s.id)),query:[`site:${clean(source.host,240)}`,market,offer,selected.map(signalTerms).join(' ')].filter(Boolean).join(' ')});
  }
  return out;
}

export const INTELLIGENCE_SOURCE_AUTH_MODES=[...AUTH_MODES];
export const INTELLIGENCE_SOURCE_ACCESS_STATES=[...ACCESS];
