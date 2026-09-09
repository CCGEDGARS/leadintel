(function(root,factory){
  const api=factory();
  if(typeof module!=="undefined"&&module.exports)module.exports=api;
  if(root)root.LeadIntelReferenceCustomers=api;
})(typeof globalThis!=="undefined"?globalThis:this,function(){
  "use strict";
  const MAX_ROWS=200,MAX_ACTIVE=50;
  const clean=v=>String(v??'').replace(/\s+/g,' ').trim();
  const normName=v=>clean(v).toLowerCase().replace(/[^a-z0-9āčēģīķļņšūž]+/gi,' ').trim();
  function normalizeUrl(value){const raw=clean(value);if(!raw)return '';try{const u=new URL(/^https?:\/\//i.test(raw)?raw:`https://${raw}`);return ['http:','https:'].includes(u.protocol)?u.href:'';}catch{return '';}}
  function domain(value){try{return new URL(normalizeUrl(value)).hostname.replace(/^www\./i,'').toLowerCase();}catch{return '';}}
  function stableId(value){let h=2166136261;for(const ch of String(value||'')){h^=ch.charCodeAt(0);h=Math.imul(h,16777619);}return (h>>>0).toString(36);}
  function parseCsv(text){
    const input=String(text||'').replace(/^\uFEFF/,'');const rows=[];let row=[],field='',quoted=false;
    const delimiter=(()=>{const first=(input.split(/\r?\n/)[0]||'');return (first.match(/;/g)||[]).length>(first.match(/,/g)||[]).length?';':',';})();
    for(let i=0;i<=input.length;i++){
      const ch=input[i]??'\n';
      if(ch==='"'){
        if(quoted&&input[i+1]==='"'){field+='"';i++;}else quoted=!quoted;
      }else if(ch===delimiter&&!quoted){row.push(field);field='';}
      else if((ch==='\n'||ch==='\r')&&!quoted){if(ch==='\r'&&input[i+1]==='\n')i++;row.push(field);field='';if(row.some(x=>clean(x)))rows.push(row);row=[];}
      else field+=ch;
    }
    if(!rows.length)return [];
    const headers=rows.shift().map(h=>clean(h));
    return rows.map(values=>Object.fromEntries(headers.map((h,i)=>[h,clean(values[i])])));
  }
  const ALIASES={
    companyName:['company','company name','customer','customer name','client','client name','uzņēmums','klients','name'],
    website:['website','web','url','domain','homepage','mājaslapa'],country:['country','market','valsts'],
    productService:['product','service','product/service','offer','bought','purchased','produkts','pakalpojums'],
    approximateValue:['value','deal value','revenue','amount','commercial value','vērtība'],
    reason:['why good','reason','why','fit','reason good customer','iemesls'],notes:['notes','note','comments','comment','piezīmes']
  };
  function valueFor(row,key){const entries=Object.entries(row||{});for(const alias of ALIASES[key]){const hit=entries.find(([k])=>clean(k).toLowerCase()===alias);if(hit&&clean(hit[1]))return clean(hit[1]);}return '';}
  function normalizeImportedRows(rows=[],options={}){
    const sourceType=clean(options.sourceType||'manual').toLowerCase();const seen=new Set(),out=[];
    for(const raw of rows||[]){
      const companyName=valueFor(raw,'companyName')||clean(raw.companyName);if(!companyName)continue;
      const website=normalizeUrl(valueFor(raw,'website')||raw.website),dom=domain(website),country=valueFor(raw,'country')||clean(raw.country);
      const dedupe=dom?`d:${dom}`:`n:${normName(companyName)}|${normName(country)}`;if(seen.has(dedupe))continue;seen.add(dedupe);
      const status=sourceType==='pdf'?'needs_review':dom?'ready':'unresolved';
      out.push({id:`ref-${stableId(dedupe)}`,companyName,website,domain:dom,country,productService:valueFor(raw,'productService')||clean(raw.productService),approximateValue:valueFor(raw,'approximateValue')||clean(raw.approximateValue),reason:valueFor(raw,'reason')||clean(raw.reason),notes:valueFor(raw,'notes')||clean(raw.notes),status,active:false,reviewed:sourceType!=='pdf'});
      if(out.length>=MAX_ROWS)break;
    }
    return out;
  }
  function normalizeReferenceState(value={}){
    const rows=normalizeImportedRows((value.rows||[]).map(row=>({Company:row.companyName,Website:row.website,Country:row.country,Product:row.productService,Value:row.approximateValue,'Why good':row.reason,Notes:row.notes})),{sourceType:'state'}).map(row=>{
      const old=(value.rows||[]).find(x=>clean(x.id)===row.id||domain(x.website)===row.domain||(!row.domain&&normName(x.companyName)===normName(row.companyName)) )||{};
      return {...row,status:['ready','needs_review','unresolved'].includes(old.status)?old.status:row.status,reviewed:old.reviewed!==false};
    });
    const allowed=new Set(rows.filter(r=>r.status==='ready'&&r.reviewed!==false).map(r=>r.id));
    const activeIds=[...new Set((value.activeIds||[]).map(clean).filter(id=>allowed.has(id)))].slice(0,MAX_ACTIVE);
    const activated=Boolean(value.activated&&activeIds.length);
    return {version:1,source:value.source&&typeof value.source==='object'?{type:clean(value.source.type),name:clean(value.source.name)}:{type:'',name:''},rows,activeIds,activated,fingerprint:activated?clean(value.fingerprint)||fingerprint(activeIds):'',dna:value.dna&&typeof value.dna==='object'?value.dna:null,activatedAt:activated?clean(value.activatedAt):'',analyzedAt:clean(value.analyzedAt)};
  }
  function fingerprint(ids){return `rc-${stableId([...ids].sort().join('|'))}`;}
  function activateReferenceCustomers(state={},ids=[]){
    const normalized=normalizeReferenceState({...state,activated:false,activeIds:[]});const allowed=new Set(normalized.rows.filter(r=>r.status==='ready'&&r.reviewed!==false).map(r=>r.id));
    const activeIds=[...new Set((ids||[]).map(clean).filter(id=>allowed.has(id)))].slice(0,MAX_ACTIVE);
    return {...normalized,activeIds,activated:Boolean(activeIds.length),fingerprint:activeIds.length?fingerprint(activeIds):'',activatedAt:activeIds.length?new Date().toISOString():'',dna:activeIds.length?normalized.dna:null};
  }
  function getActiveReferenceModel(state={}){const normalized=normalizeReferenceState(state);if(!normalized.activated||!normalized.activeIds.length)return null;const ids=new Set(normalized.activeIds);return {active:true,fingerprint:normalized.fingerprint,activeRows:normalized.rows.filter(r=>ids.has(r.id)),dna:normalized.dna};}
  function buildReferenceDna(state={},analyses={}){
    const model=getActiveReferenceModel(state);if(!model)return null;const rows=model.activeRows;const dimensions=[];
    const definitions=[['industry',false],['sizeBand',false],['businessModel',false],['growthStage',false],['operatingComplexity',false],['buyerRoles',true],['buyingTriggers',true]];
    let analyzed=0;
    for(const [key,isArray] of definitions){const counts=new Map(),conf=[];for(const row of rows){const a=analyses[row.id]||{};let values=isArray?(Array.isArray(a[key])?a[key]:[]):[a[key]];values=values.map(clean).filter(Boolean);if(values.length){analyzed++;conf.push(clean(a.confidence).toLowerCase());}for(const v of values)counts.set(v,(counts.get(v)||0)+1);}if(counts.size){const values=[...counts.entries()].sort((a,b)=>b[1]-a[1]).slice(0,5).map(([v])=>v);const evidenceCount=Math.max(...counts.values());dimensions.push({key,values,weight:1,confidence:conf.includes('high')?'high':conf.includes('medium')?'medium':'low',evidenceCount});}}
    const uniqueAnalyzed=new Set(rows.filter(r=>analyses[r.id]&&Object.keys(analyses[r.id]).some(k=>k!=='confidence'&&clean(Array.isArray(analyses[r.id][k])?analyses[r.id][k].join(' '):analyses[r.id][k]))).map(r=>r.id)).size;
    const ratio=rows.length?uniqueAnalyzed/rows.length:0;const confidence=ratio>=.75&&rows.length>=4?'high':ratio>=.4?'medium':'low';
    return {version:1,active:true,fingerprint:model.fingerprint,activeCount:rows.length,analyzableCount:uniqueAnalyzed,confidence,dimensions,builtAt:new Date().toISOString()};
  }
  function migrateLegacyLookalikes(value=''){
    const names=String(value||'').split(/\n|;|,/).map(clean).filter(Boolean);return normalizeImportedRows(names.map(name=>({Company:name})),{sourceType:'pdf'});
  }
  return {MAX_ROWS,MAX_ACTIVE,parseCsv,normalizeImportedRows,normalizeReferenceState,activateReferenceCustomers,getActiveReferenceModel,buildReferenceDna,migrateLegacyLookalikes,normalizeUrl,domain};
});
