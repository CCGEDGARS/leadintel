const SOURCE_TYPES=Object.freeze({news:'news announcement expansion relocation modernisation',tenders:'tender procurement public procurement contract',jobs:'hiring vacancies recruitment growth',investments:'investment expansion funding construction development',company:'official company website project reference case study',registries:'business registry annual report financial results'});
const clean=(value,max=1000)=>String(value??'').replace(/\s+/g,' ').trim().slice(0,max);
const list=value=>Array.isArray(value)?[...new Set(value.map(item=>clean(item)).filter(Boolean))]:[...new Set(String(value??'').split(/\n|;|\|/).map(item=>clean(item)).filter(Boolean))];
const clamp=(value,min,max,fallback)=>{const number=Number(value);return Number.isFinite(number)?Math.max(min,Math.min(max,number)):fallback;};
function publicUrl(value){try{const url=new URL(clean(value));return ['http:','https:'].includes(url.protocol)?url.href:'';}catch{return '';}}
export function normalizeMonitoringConfig(value={}){
  const sourceTypes=list(value.source_types??value.sourceTypes).filter(type=>SOURCE_TYPES[type]).slice(0,6);
  return {enabled:Boolean(value.enabled),frequency:['daily','weekly','monthly'].includes(value.frequency)?value.frequency:'weekly',researchDepth:(value.research_depth??value.researchDepth)==='quick'?'quick':'deep',minimumScore:clamp(value.minimum_score??value.minimumScore,1,100,70),sourceTypes:sourceTypes.length?sourceTypes:['news','tenders','jobs','investments','company'],signalIds:list(value.signal_ids??value.signalIds).slice(0,20),customSources:list(value.custom_sources??value.customSources).map(publicUrl).filter(Boolean).slice(0,20)};
}
export function nextMonitoringRun(from,frequency){const date=new Date(from);if(!Number.isFinite(date.getTime()))throw new Error('Valid monitoring date required');if(frequency==='daily')date.setUTCDate(date.getUTCDate()+1);else if(frequency==='monthly')date.setUTCMonth(date.getUTCMonth()+1);else date.setUTCDate(date.getUTCDate()+7);return date.toISOString();}
export function buildMonitoringQueries(payload={},rawConfig={}){
  const config=normalizeMonitoringConfig(rawConfig);const main=payload?.main||{};const profile=main.profile||{};const market=main.market||{};
  const markets=list(profile.targetMarkets||profile.currentMarkets);const offers=list(profile.priorityOffers);const selected=new Set(config.signalIds);const signals=(market.signals||[]).filter(signal=>signal?.active!==false&&(!selected.size||selected.has(clean(signal.id)))).sort((a,b)=>(Number(b.weight)||0)-(Number(a.weight)||0));
  const terms=signals.flatMap(signal=>list(String(signal.keywords||signal.name||'').replace(/,/g,';')).slice(0,2)).slice(0,config.researchDepth==='deep'?12:4);const limit=config.researchDepth==='deep'?12:4;const combinations=[];
  for(const marketName of (markets.length?markets:['priority market']))for(const offer of (offers.length?offers:['commercial opportunity']))for(const sourceType of config.sourceTypes)combinations.push({market:marketName,offer,sourceType});
  for(const customSource of config.customSources){const host=new URL(customSource).hostname;combinations.push({market:(markets[0]||'priority market'),offer:(offers[0]||'commercial opportunity'),sourceType:'custom',customHost:host});}
  const rows=[];for(let index=0;rows.length<limit&&combinations.length;index++){const base=combinations[index%combinations.length];const term=terms[index%Math.max(1,terms.length)]||'business expansion';const query=[base.customHost?`site:${base.customHost}`:base.market,base.offer,term,SOURCE_TYPES[base.sourceType]||'',new Date().getUTCFullYear()].filter(Boolean).join(' ');if(!rows.some(row=>row.query===query))rows.push({...base,query});if(index>limit*4)break;}return rows;
}
export function scoreMonitoringEvidence(evidence={},signals=[],now=new Date()){
  const corpus=clean(`${evidence.title||''} ${evidence.description||''} ${evidence.text||''}`,12000).toLowerCase();const matched=[];let signalPoints=0;
  for(const signal of signals){const terms=list(String(signal.keywords||signal.name||'').replace(/,/g,';'));if(terms.some(term=>corpus.includes(term.toLowerCase()))){matched.push(clean(signal.id));signalPoints+=clamp(signal.weight,1,10,5);}}
  const published=Date.parse(evidence.date||'');const age=Number.isFinite(published)?Math.max(0,(now.getTime()-published)/86400000):Infinity;const recency=age<=30?30:age<=90?22:age<=365?14:6;const evidenceQuality=publicUrl(evidence.url)?20:0;const total=Math.min(100,Math.round(signalPoints*5+recency+evidenceQuality));return {total,signalIds:matched,recency};
}
export {SOURCE_TYPES};
