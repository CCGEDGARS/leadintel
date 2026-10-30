import Market from '../../customer/market-engine.js';
import Targeting from '../../customer/targeting-policy.js';
const SOURCE_TYPES=Object.freeze({news:'news announcement expansion relocation modernisation',tenders:'tender procurement public procurement contract',jobs:'hiring vacancies recruitment growth',investments:'investment expansion funding construction development',company:'official company website project reference case study',registries:'business registry annual report financial results'});
const clean=(value,max=1000)=>String(value??'').replace(/\s+/g,' ').trim().slice(0,max);
const list=value=>Array.isArray(value)?[...new Set(value.map(item=>clean(item)).filter(Boolean))]:[...new Set(String(value??'').split(/\n|;|\|/).map(item=>clean(item)).filter(Boolean))];
const clamp=(value,min,max,fallback)=>{const number=Number(value);return Number.isFinite(number)?Math.max(min,Math.min(max,number)):fallback;};
export function canonicalMonitoringUrl(value){
  try{
    const url=new URL(clean(value,2000)),host=url.hostname.toLowerCase().replace(/\.$/,'');
    if((url.port&&!['80','443'].includes(url.port))||!['http:','https:'].includes(url.protocol)||url.username||url.password||!host||!host.includes('.')||host.includes(':')||/^(?:localhost|.*\.(?:localhost|local|internal|lan))$/.test(host))return '';
    const ip=host.match(/^(\d+)\.(\d+)\.(\d+)\.(\d+)$/);
    if(ip){const [a,b]=ip.slice(1).map(Number);if(a===0||a===10||a===127||a>=224||(a===169&&b===254)||(a===172&&b>=16&&b<=31)||(a===192&&b===168)||(a===100&&b>=64&&b<=127))return '';}
    url.hostname=host;url.hash='';for(const key of [...url.searchParams.keys()])if(/^(?:utm_.+|fbclid|gclid|msclkid)$/i.test(key))url.searchParams.delete(key);
    url.searchParams.sort();return url.href;
  }catch{return '';}
}
const publicUrl=canonicalMonitoringUrl;
export const isTenderSignal=signal=>/tender|procurement|iepirk|закуп|тендер/i.test(`${signal?.id||''} ${signal?.name||''} ${signal?.keywords||''}`);
export function normalizeMonitoringConfig(value={}){
  const sourceTypes=list(value.source_types??value.sourceTypes).filter(type=>SOURCE_TYPES[type]).slice(0,6);
  return {enabled:value.enabled===true,frequency:['daily','weekly','monthly'].includes(value.frequency)?value.frequency:'weekly',researchDepth:(value.research_depth??value.researchDepth)==='quick'?'quick':'deep',minimumScore:clamp(value.minimum_score??value.minimumScore,1,100,70),sourceTypes:Array.isArray(value.source_types??value.sourceTypes)||sourceTypes.length?sourceTypes:['news','jobs','investments','company'],signalIds:list(value.signal_ids??value.signalIds).slice(0,20),customSources:[...new Set(list(value.custom_sources??value.customSources).map(publicUrl).filter(Boolean))].slice(0,20)};
}
export function nextMonitoringRun(from,frequency){const date=new Date(from);if(!Number.isFinite(date.getTime()))throw new Error('Valid monitoring date required');if(frequency==='daily')date.setUTCDate(date.getUTCDate()+1);else if(frequency==='monthly'){const day=date.getUTCDate();date.setUTCDate(1);date.setUTCMonth(date.getUTCMonth()+1);const last=new Date(Date.UTC(date.getUTCFullYear(),date.getUTCMonth()+1,0)).getUTCDate();date.setUTCDate(Math.min(day,last));}else date.setUTCDate(date.getUTCDate()+7);return date.toISOString();}
export function monitoringTargetingProfile(main={}){
  const reviewed=Object.fromEntries(Object.entries(Targeting.profileFields(main)).filter(([,value])=>value));
  const profile={...(main.profile||{}),...reviewed};
  if(main.targetMarkets?.length)profile.targetMarkets=list(main.targetMarkets).join('; ');
  return Market.effectiveTargetingProfile(profile,main.market||{});
}

// Cross-publisher alert identity requires a substantial named company event.
// Short/generic snippets retain URL-only identity to avoid merging distinct buyers.
export function monitoringEventIdentity(evidence={}){
  const body=clean(evidence.text,12000).toLowerCase().replace(/[^\p{L}\p{N}]+/gu,' ').trim();
  if(body.length<240||body.split(' ').length<40)return '';
  const title=clean(evidence.title,300);
  const eventAt=title.search(/(?:^|\s)(?:announc|open|expand|launch|invest|relocat|begin|secur|receiv|rais|will\b|has\b|is\b|atklāj|paplašin|откры|объяв|расшир)/iu);
  const candidate=eventAt>0?title.slice(0,eventAt).trim():'';
  const named=candidate&&candidate.split(/\s+/).length<=4&&candidate.split(/\s+/).every(word=>/^[\p{Lu}][\p{L}\p{N}&'-]+$/u.test(word))?candidate:'';
  const company=clean(evidence.company||named,160).toLowerCase();
  if(!company||/^(?:(?:the|this|company|business|group|new|we|our|public|a)\s*)+$/.test(company)||!body.includes(company))return '';
  if(!/announc|open|expan|relocat|fund|invest|hiring|atklāj|paplašin|откры|объяв|расшир/.test(body))return '';
  return `${company}\n${body}`;
}
export function buildMonitoringQueries(payload={},rawConfig={}){
  const config=normalizeMonitoringConfig(rawConfig);const main=payload?.main||{};const profile=monitoringTargetingProfile(main);const market=main.market||{};
  const markets=list(profile.targetMarkets||profile.currentMarkets);const offers=list(profile.priorityOffers);const selected=new Set(config.signalIds);const signals=(market.signals||[]).filter(signal=>signal?.active!==false&&(!selected.size||selected.has(clean(signal.id)))).sort((a,b)=>(Number(b.weight)||0)-(Number(a.weight)||0));
  if(!signals.length||!markets.length||!offers.length)return [];
  const sourceTypes=config.sourceTypes.filter(type=>type!=='tenders'||signals.some(isTenderSignal));
  const terms=signals.flatMap(signal=>list(String(signal.keywords||signal.name||'').replace(/,/g,';')).slice(0,2)).slice(0,config.researchDepth==='deep'?12:4);const limit=config.researchDepth==='deep'?12:4;const combinations=[];
  for(const marketName of (markets.length?markets:['priority market']))for(const offer of (offers.length?offers:['commercial opportunity']))for(const sourceType of sourceTypes)combinations.push({market:marketName,offer,sourceType});
  for(const customSource of config.customSources){const host=new URL(customSource).hostname;combinations.push({market:(markets[0]||'priority market'),offer:(offers[0]||'commercial opportunity'),sourceType:'custom',customHost:host});}
  const rows=[];for(let index=0;rows.length<limit&&combinations.length;index++){const base=combinations[index%combinations.length];const term=terms[index%Math.max(1,terms.length)]||'business expansion';const query=[base.customHost?`site:${base.customHost}`:base.market,base.offer,term,SOURCE_TYPES[base.sourceType]||'',new Date().getUTCFullYear()].filter(Boolean).join(' ');if(!rows.some(row=>row.query===query))rows.push({...base,query});if(index>limit*4)break;}return rows;
}
export function scoreMonitoringEvidence(evidence={},signals=[],now=new Date()){
  const corpus=clean(`${evidence.title||''} ${evidence.description||''} ${evidence.text||''}`,12000).toLowerCase();const matched=[];let signalPoints=0;
  for(const signal of signals){const terms=list(String(signal.keywords||signal.name||'').replace(/,/g,';'));if(terms.some(term=>corpus.includes(term.toLowerCase()))){matched.push(clean(signal.id));signalPoints+=clamp(signal.weight,1,10,5);}}
  const published=Date.parse(evidence.date||'');const age=Number.isFinite(published)?(now.getTime()-published)/86400000:Infinity;const recency=age<0||!Number.isFinite(age)?0:age<=30?30:age<=90?22:age<=365?14:0;const evidenceQuality=publicUrl(evidence.url)?20:0;const total=evidenceQuality&&matched.length?Math.min(100,Math.round(signalPoints*5+recency+evidenceQuality)):0;return {total,signalIds:matched,recency};
}
export {SOURCE_TYPES};
