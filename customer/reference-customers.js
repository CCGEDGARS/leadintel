(function(root,factory){
  const api=factory();
  if(typeof module!=="undefined"&&module.exports)module.exports=api;
  if(root)root.LeadIntelReferenceCustomers=api;
})(typeof globalThis!=="undefined"?globalThis:this,function(){
  "use strict";
  const MAX_ROWS=200,MAX_ACTIVE=50;
  const REFERENCE_WORKSPACE_STORAGE_KEY='leadintel_customer_v2_state';
  const clean=v=>String(v??'').replace(/\s+/g,' ').trim();
  const normName=v=>clean(v).toLowerCase().replace(/[^a-z0-9āčēģīķļņšūž]+/gi,' ').trim();
  const normKey=v=>clean(v).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[_./\\-]+/g,' ').replace(/\s+/g,' ').trim();
  function persistReferenceWorkspaceState(root,state,{render=true,eventName='leadintel:reference-customers-updated'}={}){
    root.localStorage.setItem(REFERENCE_WORKSPACE_STORAGE_KEY,JSON.stringify(state));
    if(eventName&&typeof root.dispatchEvent==='function'&&typeof root.CustomEvent==='function')root.dispatchEvent(new root.CustomEvent(eventName));
    if(render)root.LeadIntelReferenceCustomerUI?.render?.();
    try{
      const pending=root.LeadIntelServerBridge?.saveNow?.();
      if(pending&&typeof pending.then==='function')void Promise.resolve(pending).catch(()=>null);
    }catch{}
    return state;
  }
  function normalizeUrl(value){const raw=clean(value);if(!raw)return '';try{const u=new URL(/^https?:\/\//i.test(raw)?raw:`https://${raw}`);return ['http:','https:'].includes(u.protocol)?u.href:'';}catch{return '';}}
  function domain(value){try{return new URL(normalizeUrl(value)).hostname.replace(/^www\./i,'').toLowerCase();}catch{return '';}}
  function looksLikeWebsite(value){const v=clean(value);return /^(?:https?:\/\/|www\.)/i.test(v)||/^[a-z0-9][a-z0-9.-]*\.[a-z]{2,}(?:[\/:?#]|$)/i.test(v);}
  function stableId(value){let h=2166136261;for(const ch of String(value||'')){h^=ch.charCodeAt(0);h=Math.imul(h,16777619);}return (h>>>0).toString(36);}
  function fingerprint(ids){return `rc-${stableId([...ids].sort().join('|'))}`;}
  function parseCsv(text){
    const input=String(text||'').replace(/^\uFEFF/,'').replace(/^\u0000+/,'');const rows=[];let row=[],field='',quoted=false;
    const delimiter=(()=>{const first=(input.split(/\r?\n/)[0]||'');const candidates=[',',';','\t','|'];let best=',',count=-1;for(const candidate of candidates){const hits=first.split(candidate).length-1;if(hits>count){best=candidate;count=hits;}}return best;})();
    for(let i=0;i<=input.length;i++){
      const ch=input[i]??'\n';
      if(ch==='"'){
        if(quoted&&input[i+1]==='"'){field+='"';i++;}else quoted=!quoted;
      }else if(ch===delimiter&&!quoted){row.push(field);field='';}
      else if((ch==='\n'||ch==='\r')&&!quoted){if(ch==='\r'&&input[i+1]==='\n')i++;row.push(field);field='';if(row.some(x=>clean(x)))rows.push(row);row=[];}
      else field+=ch;
    }
    if(!rows.length)return [];
    const first=rows.shift().map(h=>clean(h));
    const headerSignals=['company','company name','customer','customer name','client','client name','uznemums','uznemuma nosaukums','klients','klienta uznemums','name','website','web','web site','url','domain','homepage','majaslapa','majas lapa','interneta adrese'];
    const hasRecognizedHeader=first.some(h=>headerSignals.includes(normKey(h)));
    const firstLooksLikeData=!hasRecognizedHeader&&first.some(looksLikeWebsite);
    const headers=firstLooksLikeData?first.map((_,i)=>`Column ${i+1}`):first;
    const dataRows=firstLooksLikeData?[first,...rows]:rows;
    return dataRows.map(values=>Object.fromEntries(headers.map((h,i)=>[h,clean(values[i])])));
  }
  const ALIASES={
    companyName:['company','company name','customer','customer name','client','client name','uzņēmums','uznemums','uzņēmuma nosaukums','uznemuma nosaukums','klients','klienta uzņēmums','klienta uznemums','name'],
    website:['website','web','web site','site','url','domain','homepage','mājaslapa','majaslapa','mājas lapa','majas lapa','interneta adrese'],country:['country','market','valsts'],
    productService:['product','service','product/service','offer','bought','purchased','produkts','pakalpojums'],
    approximateValue:['value','deal value','revenue','amount','commercial value','vērtība'],
    reason:['why good','reason','why','fit','reason good customer','iemesls'],notes:['notes','note','comments','comment','piezīmes']
  };
  function valueFor(row,key){const entries=Object.entries(row||{});const aliases=ALIASES[key].map(normKey);for(const [k,v] of entries){if(aliases.includes(normKey(k))&&clean(v))return clean(v);}return '';}
  function fallbackCompanyName(row){const values=Object.values(row||{}).map(clean).filter(Boolean);return values.find(value=>!looksLikeWebsite(value))||'';}
  function fallbackWebsite(row){const values=Object.values(row||{}).map(clean).filter(Boolean);return values.find(looksLikeWebsite)||'';}
  function normalizeImportedRows(rows=[],options={}){
    const sourceType=clean(options.sourceType||'manual').toLowerCase();const seen=new Set(),out=[];
    for(const raw of rows||[]){
      const companyName=valueFor(raw,'companyName')||clean(raw.companyName)||fallbackCompanyName(raw);
      const website=normalizeUrl(valueFor(raw,'website')||raw.website||fallbackWebsite(raw)),dom=domain(website),country=valueFor(raw,'country')||clean(raw.country);if(!companyName&&!website)continue;
      const dedupe=dom?`d:${dom}`:`n:${normName(companyName)}|${normName(country)}`;if(seen.has(dedupe))continue;seen.add(dedupe);
      const status=sourceType==='pdf'?'needs_review':dom&&companyName?'ready':'unresolved';
      out.push({id:`ref-${stableId(dedupe)}`,companyName,website,domain:dom,country,productService:valueFor(raw,'productService')||clean(raw.productService),approximateValue:valueFor(raw,'approximateValue')||clean(raw.approximateValue),reason:valueFor(raw,'reason')||clean(raw.reason),notes:valueFor(raw,'notes')||clean(raw.notes),status,active:false,reviewed:sourceType!=='pdf'});
      if(out.length>=MAX_ROWS)break;
    }
    return out;
  }
  function normalizeAnalysis(value={}){
    const copy={};
    for(const key of ['industry','sizeBand','businessModel','growthStage','operatingComplexity','customerOutcome'])if(clean(value[key]))copy[key]=clean(value[key]);
    for(const key of ['buyerRoles','buyingTriggers'])if(Array.isArray(value[key]))copy[key]=[...new Set(value[key].map(clean).filter(Boolean))].slice(0,8);
    copy.confidence=['high','medium','low'].includes(clean(value.confidence).toLowerCase())?clean(value.confidence).toLowerCase():'low';
    return copy;
  }
  function normalizeSegment(segment={},allowedRows=new Set()){
    const rowIds=[...new Set((segment.rowIds||[]).map(clean).filter(id=>allowedRows.has(id)))];
    if(!rowIds.length)return null;
    const id=clean(segment.id)||`segment-${stableId(rowIds.sort().join('|'))}`;
    return {id,name:clean(segment.name)||'Reference customer group',rowIds,count:rowIds.length,confidence:['high','medium','low'].includes(clean(segment.confidence).toLowerCase())?clean(segment.confidence).toLowerCase():'low',summary:clean(segment.summary),traits:Array.isArray(segment.traits)?segment.traits.map(clean).filter(Boolean).slice(0,8):[]};
  }
  function normalizeReferenceState(value={}){
    const rows=normalizeImportedRows((value.rows||[]).map(row=>({Company:row.companyName,Website:row.website,Country:row.country,Product:row.productService,Value:row.approximateValue,'Why good':row.reason,Notes:row.notes})),{sourceType:'state'}).map(row=>{
      const old=(value.rows||[]).find(x=>clean(x.id)===row.id||domain(x.website)===row.domain||(!row.domain&&normName(x.companyName)===normName(row.companyName)) )||{};
      return {...row,status:['ready','needs_review','unresolved'].includes(old.status)?old.status:row.status,reviewed:old.reviewed!==false};
    });
    const rowIds=new Set(rows.map(row=>row.id));
    const allowed=new Set(rows.filter(r=>r.status==='ready'&&r.reviewed!==false).map(r=>r.id));
    const analyses={};for(const [id,analysis] of Object.entries(value.analyses||{}))if(rowIds.has(id))analyses[id]=normalizeAnalysis(analysis);
    const segments=(value.segments||[]).map(segment=>normalizeSegment(segment,rowIds)).filter(Boolean);
    const segmentIds=new Set(segments.map(segment=>segment.id));
    const activeSegmentIds=[...new Set((value.activeSegmentIds||[]).map(clean).filter(id=>segmentIds.has(id)))];
    const activeIds=[...new Set((value.activeIds||[]).map(clean).filter(id=>allowed.has(id)))].slice(0,MAX_ACTIVE);
    const activated=Boolean(value.activated&&activeIds.length);
    return {version:2,source:value.source&&typeof value.source==='object'?{type:clean(value.source.type),name:clean(value.source.name)}:{type:'',name:''},rows,analyses,segments,segmentationMeaningful:Boolean(value.segmentationMeaningful&&segments.length>1),activeSegmentIds,activeIds,activated,fingerprint:activated?clean(value.fingerprint)||fingerprint(activeIds):'',dna:value.dna&&typeof value.dna==='object'?value.dna:null,activatedAt:activated?clean(value.activatedAt):'',analyzedAt:clean(value.analyzedAt)};
  }
  function activateReferenceCustomers(state={},ids=[]){
    const normalized=normalizeReferenceState({...state,activated:false,activeIds:[]});const allowed=new Set(normalized.rows.filter(r=>r.status==='ready'&&r.reviewed!==false).map(r=>r.id));
    const activeIds=[...new Set((ids||[]).map(clean).filter(id=>allowed.has(id)))].slice(0,MAX_ACTIVE);
    return {...normalized,activeSegmentIds:[],activeIds,activated:Boolean(activeIds.length),fingerprint:activeIds.length?fingerprint(activeIds):'',activatedAt:activeIds.length?new Date().toISOString():'',dna:activeIds.length?normalized.dna:null};
  }
  function activateReferenceSegments(state={},segmentIds=[]){
    const normalized=normalizeReferenceState({...state,activated:false,activeIds:[]});
    const selected=[...new Set((segmentIds||[]).map(clean))];
    const segments=normalized.segments.filter(segment=>selected.includes(segment.id));
    const rowIds=[...new Set(segments.flatMap(segment=>segment.rowIds))];
    const activated=activateReferenceCustomers(normalized,rowIds);
    return {...activated,activeSegmentIds:segments.map(segment=>segment.id)};
  }
  function getActiveReferenceModel(state={}){const normalized=normalizeReferenceState(state);if(!normalized.activated||!normalized.activeIds.length)return null;const ids=new Set(normalized.activeIds);return {active:true,fingerprint:normalized.fingerprint,activeRows:normalized.rows.filter(r=>ids.has(r.id)),activeSegments:normalized.segments.filter(segment=>normalized.activeSegmentIds.includes(segment.id)),dna:normalized.dna};}
  function confidenceFor(analyses,rowIds){const levels=rowIds.map(id=>clean(analyses[id]?.confidence).toLowerCase()).filter(Boolean);if(levels.filter(v=>v==='high').length>=Math.ceil(rowIds.length*.6))return 'high';if(levels.some(v=>v==='high'||v==='medium'))return 'medium';return 'low';}
  function commonValues(analyses,rowIds,key,arrayValue=false,limit=4){const counts=new Map();for(const id of rowIds){const raw=analyses[id]?.[key];const values=arrayValue?(Array.isArray(raw)?raw:[]):[raw];for(const value of values.map(clean).filter(Boolean))counts.set(value,(counts.get(value)||0)+1);}return [...counts.entries()].sort((a,b)=>b[1]-a[1]||a[0].localeCompare(b[0])).slice(0,limit).map(([value,count])=>({value,count}));}
  function segmentFromRows(name,rowIds,analyses){
    const traits=[];
    for(const [key,isArray] of [['industry',false],['sizeBand',false],['businessModel',false],['growthStage',false],['operatingComplexity',false],['customerOutcome',false],['buyerRoles',true],['buyingTriggers',true]]){
      const top=commonValues(analyses,rowIds,key,isArray,2);if(top.length)traits.push(...top.map(item=>`${key}: ${item.value}`));
    }
    return {id:`segment-${stableId(`${name}|${[...rowIds].sort().join('|')}`)}`,name,rowIds:[...rowIds],count:rowIds.length,confidence:confidenceFor(analyses,rowIds),summary:traits.slice(0,4).join(' · '),traits:traits.slice(0,8)};
  }
  function buildReferenceSegments(rows=[],analyses={}){
    const eligible=(rows||[]).filter(row=>row?.id&&analyses[row.id]&&Object.keys(analyses[row.id]).some(key=>key!=='confidence'&&clean(Array.isArray(analyses[row.id][key])?analyses[row.id][key].join(' '):analyses[row.id][key])));
    if(!eligible.length)return {meaningful:false,segments:[],analyzedCount:0};
    const byIndustry=new Map();
    for(const row of eligible){const industry=clean(analyses[row.id]?.industry);if(!industry)continue;const key=industry.toLowerCase();if(!byIndustry.has(key))byIndustry.set(key,{name:industry,rowIds:[]});byIndustry.get(key).rowIds.push(row.id);}
    const strongGroups=[...byIndustry.values()].filter(group=>group.rowIds.length>=2);
    const covered=new Set(strongGroups.flatMap(group=>group.rowIds));
    const meaningful=strongGroups.length>=2&&covered.size>=Math.max(4,Math.ceil(eligible.length*.6));
    if(meaningful){
      const segments=strongGroups.map(group=>segmentFromRows(group.name,group.rowIds,analyses));
      const remainder=eligible.filter(row=>!covered.has(row.id)).map(row=>row.id);
      if(remainder.length>=2)segments.push(segmentFromRows('Other reference customers',remainder,analyses));
      return {meaningful:true,segments,analyzedCount:eligible.length};
    }
    const rowIds=eligible.map(row=>row.id);return {meaningful:false,segments:[segmentFromRows('Reference customer group',rowIds,analyses)],analyzedCount:eligible.length};
  }
  function buildReferenceDna(state={},analysesArg={}){
    const model=getActiveReferenceModel(state);if(!model)return null;const rows=model.activeRows;const dimensions=[];const analyses=Object.keys(analysesArg||{}).length?analysesArg:normalizeReferenceState(state).analyses;
    const definitions=[['industry',false],['sizeBand',false],['businessModel',false],['growthStage',false],['operatingComplexity',false],['customerOutcome',false],['buyerRoles',true],['buyingTriggers',true]];
    for(const [key,isArray] of definitions){const counts=new Map(),conf=[];for(const row of rows){const a=analyses[row.id]||{};let values=isArray?(Array.isArray(a[key])?a[key]:[]):[a[key]];values=values.map(clean).filter(Boolean);if(values.length)conf.push(clean(a.confidence).toLowerCase());for(const v of values)counts.set(v,(counts.get(v)||0)+1);}if(counts.size){const values=[...counts.entries()].sort((a,b)=>b[1]-a[1]).slice(0,5).map(([v])=>v);const evidenceCount=Math.max(...counts.values());dimensions.push({key,values,weight:1,confidence:conf.includes('high')?'high':conf.includes('medium')?'medium':'low',evidenceCount});}}
    const uniqueAnalyzed=new Set(rows.filter(r=>analyses[r.id]&&Object.keys(analyses[r.id]).some(k=>k!=='confidence'&&clean(Array.isArray(analyses[r.id][k])?analyses[r.id][k].join(' '):analyses[r.id][k]))).map(r=>r.id)).size;
    const ratio=rows.length?uniqueAnalyzed/rows.length:0;const confidence=ratio>=.75&&rows.length>=4?'high':ratio>=.4?'medium':'low';
    return {version:2,active:true,fingerprint:model.fingerprint,activeCount:rows.length,analyzableCount:uniqueAnalyzed,confidence,dimensions,segmentIds:model.activeSegments.map(segment=>segment.id),builtAt:new Date().toISOString()};
  }
  function migrateLegacyLookalikes(value=''){
    const names=String(value||'').split(/\n|;|,/).map(clean).filter(Boolean);return normalizeImportedRows(names.map(name=>({Company:name})),{sourceType:'pdf'});
  }
  return {MAX_ROWS,MAX_ACTIVE,parseCsv,normalizeImportedRows,normalizeReferenceState,activateReferenceCustomers,activateReferenceSegments,getActiveReferenceModel,buildReferenceSegments,buildReferenceDna,migrateLegacyLookalikes,normalizeUrl,domain,persistReferenceWorkspaceState};
});
