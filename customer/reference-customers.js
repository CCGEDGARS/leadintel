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
  async function saveReferenceWorkflowState(root){
    const SAVE_TIMEOUT_MS=20000;
    const bridge=root?.LeadIntelServerBridge;
    if(!bridge?.session?.authenticated)return {synced:false,localOnly:true,message:'Sign in to sync this change to your LeadIntel account.'};
    if(!bridge.workspace)return {synced:false,localOnly:true,message:'No LeadIntel workspace is selected. Your change remains in this browser.'};
    if(typeof bridge.saveNow!=='function')return {synced:false,localOnly:false,message:'LeadIntel could not start workspace sync.'};
    let timeoutId;
    try{
      const result=await Promise.race([
        Promise.resolve().then(()=>bridge.saveNow({saveIntent:true,explicitSave:true})),
        new Promise((_,reject)=>{timeoutId=setTimeout(()=>reject(new Error('Workspace sync timed out')),SAVE_TIMEOUT_MS);})
      ]);
      if(result?.saved===true)return {synced:true,localOnly:false,version:Number(result.version)||0};
      return {synced:false,localOnly:false,message:bridge.conflict?'Another session changed this workspace. Resolve the sync conflict before continuing.':'LeadIntel did not confirm the save. Your change remains in this browser; click Save workspace and check the sync status.'};
    }catch(error){
      const message=error?.message==='Workspace sync timed out'?'Workspace sync is taking too long. Your change remains in this browser; check the sync status before leaving.':'Workspace sync failed. Your change remains in this browser; click Save workspace and check the sync status.';
      return {synced:false,localOnly:false,message};
    }finally{
      clearTimeout(timeoutId);
    }
  }
  function referenceWorkflowSaveNotice(action,result={}){
    if(result.synced)return `${action} saved and synced to your LeadIntel account.`;
    if(result.localOnly)return `${action} is saved in this browser only. ${result.message||'Sign in to sync it to your account.'}`;
    return `${action} is saved in this browser, but account sync is not confirmed. ${result.message||'Click Save workspace and check the sync status before leaving.'}`;
  }
  function normalizeUrl(value){const raw=clean(value);if(!raw)return '';try{const u=new URL(/^https?:\/\//i.test(raw)?raw:`https://${raw}`);return ['http:','https:'].includes(u.protocol)?u.href:'';}catch{return '';}}
  function domain(value){try{return new URL(normalizeUrl(value)).hostname.replace(/^www\./i,'').toLowerCase();}catch{return '';}}
  function normalizeTargetCompanies(rows=[],sellerWebsite=''){
    const seller=domain(sellerWebsite),seen=new Set(),out=[];
    for(const raw of Array.isArray(rows)?rows:[]){
      const companyName=clean(raw?.companyName||raw?.Company).slice(0,180);
      const website=normalizeUrl(raw?.website||raw?.Website),host=domain(website);
      if(!companyName&&!host)continue;
      if(seller&&host&&(host===seller||host.endsWith(`.${seller}`)))continue;
      const key=host||normName(companyName);if(seen.has(key))continue;
      seen.add(key);out.push({companyName:companyName||host,website,domain:host,addedAt:clean(raw?.addedAt)||new Date().toISOString()});
      if(out.length>=50)break;
    }
    return out;
  }
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
      out.push({id:`ref-${stableId(dedupe)}`,companyName,website,domain:dom,country,referenceType:clean(raw.referenceType||raw.Type).toLowerCase()==='ideal_example'?'ideal_example':'existing_customer',productService:valueFor(raw,'productService')||clean(raw.productService),approximateValue:valueFor(raw,'approximateValue')||clean(raw.approximateValue),reason:valueFor(raw,'reason')||clean(raw.reason),notes:valueFor(raw,'notes')||clean(raw.notes),status,active:false,reviewed:sourceType!=='pdf'});
      if(out.length>=MAX_ROWS)break;
    }
    return out;
  }
  function normalizeAnalysis(value={}){
    const copy={};
    for(const key of ['industry','broadIndustry','productionModel','sizeBand','businessModel','growthStage','operatingComplexity','customerOutcome','summary'])if(clean(value[key]))copy[key]=clean(value[key]);
    for(const key of ['buyerRoles','buyingTriggers','capabilities'])if(Array.isArray(value[key]))copy[key]=[...new Set(value[key].map(clean).filter(Boolean))].slice(0,8);
    copy.sourceEvidence=(Array.isArray(value.sourceEvidence)?value.sourceEvidence:[]).map(item=>({field:clean(item.field),quote:clean(item.quote),url:normalizeUrl(item.url)})).filter(item=>item.field&&item.quote&&item.url).slice(0,16);
    if(value.analysisVersion===4)copy.analysisVersion=4;
    copy.confidence=['high','medium','low'].includes(clean(value.confidence).toLowerCase())?clean(value.confidence).toLowerCase():'low';
    return copy;
  }
  function normalizeSegment(segment={},allowedRows=new Set(),analyses={}){
    const rowIds=[...new Set((segment.rowIds||[]).map(clean).filter(id=>allowedRows.has(id)))];
    if(!rowIds.length)return null;
    const id=clean(segment.id)||`segment-${stableId(rowIds.sort().join('|'))}`;
    const name=clean(segment.name)||'Reference customer group';
    if(rowIds.some(rowId=>analyses[rowId]))return {...segmentFromRows(name,rowIds,analyses),id};
    let confidence=['high','medium','low'].includes(clean(segment.confidence).toLowerCase())?clean(segment.confidence).toLowerCase():'low';
    if(rowIds.length<=1)confidence='low';else if(rowIds.length<=3&&confidence==='high')confidence='medium';
    return {id,name,rowIds,count:rowIds.length,confidence,summary:clean(segment.summary),traits:Array.isArray(segment.traits)?segment.traits.map(clean).filter(Boolean).slice(0,8):[],recurringDimensionCount:Math.max(0,Number(segment.recurringDimensionCount)||0),canActivate:segment.canActivate!==false};
  }
  function normalizeReferenceState(value={}){
    const rows=normalizeImportedRows((value.rows||[]).map(row=>({Company:row.companyName,Website:row.website,Country:row.country,Product:row.productService,Value:row.approximateValue,'Why good':row.reason,Notes:row.notes})),{sourceType:'state'}).map(row=>{
      const old=(value.rows||[]).find(x=>clean(x.id)===row.id||domain(x.website)===row.domain||(!row.domain&&normName(x.companyName)===normName(row.companyName)) )||{};
      return {...row,referenceType:old.referenceType==='ideal_example'?'ideal_example':'existing_customer',status:['ready','needs_review','unresolved'].includes(old.status)?old.status:row.status,reviewed:old.reviewed!==false};
    });
    const rowIds=new Set(rows.map(row=>row.id));
    const allowed=new Set(rows.filter(r=>r.status==='ready'&&r.reviewed!==false).map(r=>r.id));
    const analyses={};for(const [id,analysis] of Object.entries(value.analyses||{}))if(rowIds.has(id))analyses[id]=normalizeAnalysis(analysis);
    const segments=(value.segments||[]).map(segment=>normalizeSegment(segment,rowIds,analyses)).filter(Boolean);
    const segmentIds=new Set(segments.map(segment=>segment.id));
    const activeSegmentIds=[...new Set((value.activeSegmentIds||[]).map(clean).filter(id=>segmentIds.has(id)))];
    const activeIds=[...new Set((value.activeIds||[]).map(clean).filter(id=>allowed.has(id)))].slice(0,MAX_ACTIVE);
    const activated=Boolean(value.activated&&activeIds.length);
    const map=value.opportunityMap&&typeof value.opportunityMap==='object'?value.opportunityMap:null;
    const opportunityMap=map&&rowIds.has(clean(map.customerId))?{
      customerId:clean(map.customerId),service:clean(map.service).slice(0,600),problem:clean(map.problem).slice(0,900),dealTrigger:clean(map.dealTrigger).slice(0,600),
      hypotheses:(Array.isArray(map.hypotheses)?map.hypotheses:[]).slice(0,5).map(item=>({niche:clean(item.niche).slice(0,160),sharedNeed:clean(item.sharedNeed).slice(0,400),whyRelevant:clean(item.whyRelevant).slice(0,500),evidenceToCheck:clean(item.evidenceToCheck).slice(0,300)})).filter(item=>item.niche&&item.sharedNeed),
      updatedAt:clean(map.updatedAt),analysisAt:clean(map.analysisAt)
    }:null;
    const normalized={version:2,source:value.source&&typeof value.source==='object'?{type:clean(value.source.type),name:clean(value.source.name)}:{type:'',name:''},rows,analyses,segments,segmentationMeaningful:Boolean(value.segmentationMeaningful&&segments.length>1),activeSegmentIds,activeIds,activated,fingerprint:activated?clean(value.fingerprint)||fingerprint(activeIds):'',dna:value.dna&&typeof value.dna==='object'?value.dna:null,activatedAt:activated?clean(value.activatedAt):'',analyzedAt:clean(value.analyzedAt),opportunityMap};
    if(activated&&activeIds.some(id=>hasAnalysisFacts(analyses[id])))normalized.dna=buildReferenceDnaFromState(normalized,analyses);
    return normalized;
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
  function getActiveReferenceModel(state={}){const normalized=normalizeReferenceState(state);if(!normalized.activated||!normalized.activeIds.length||!hasUsableReferenceDna(normalized.dna))return null;const ids=new Set(normalized.activeIds);return {active:true,fingerprint:normalized.fingerprint,activeRows:normalized.rows.filter(r=>ids.has(r.id)),activeSegments:normalized.segments.filter(segment=>normalized.activeSegmentIds.includes(segment.id)),dna:normalized.dna};}
  function confidenceFor(analyses,rowIds){const levels=rowIds.map(id=>clean(analyses[id]?.confidence).toLowerCase()).filter(Boolean);if(levels.filter(v=>v==='high').length>=Math.ceil(rowIds.length*.6))return 'high';if(levels.some(v=>v==='high'||v==='medium'))return 'medium';return 'low';}
  const PROFILE_DIMENSIONS=[['broadIndustry',false],['productionModel',false],['capabilities',true],['industry',false],['sizeBand',false],['businessModel',false],['growthStage',false],['operatingComplexity',false],['customerOutcome',false],['buyerRoles',true],['buyingTriggers',true]];
  const DIMENSION_LABELS={broadIndustry:'Commercial sector',productionModel:'Production model',capabilities:'Products and capabilities',industry:'Industry',sizeBand:'Company size',businessModel:'Business model',growthStage:'Growth stage',operatingComplexity:'Operating complexity',customerOutcome:'Customer outcome',buyerRoles:'Buyer roles',buyingTriggers:'Buying triggers'};
  function hasAnalysisFacts(analysis={}){if(analysis.analysisVersion===4&&!analysis.sourceEvidence?.some(item=>['broadIndustry','productionModel','capabilities'].includes(item.field)))return false;return PROFILE_DIMENSIONS.some(([key,arrayValue])=>arrayValue?Array.isArray(analysis[key])&&analysis[key].some(clean):Boolean(clean(analysis[key])));}
  function hasUsableReferenceDna(dna){return Boolean(dna?.active&&(dna.dimensions?.length||dna.referenceProfiles?.some(profile=>profile.dimensions?.length)));}
  function supportThreshold(sampleSize){return sampleSize<=1?1:Math.max(2,Math.ceil(sampleSize*.6));}
  function commonValues(analyses,rowIds,key,arrayValue=false,limit=4){const counts=new Map();for(const id of rowIds){const raw=analyses[id]?.[key];const values=[...new Set((arrayValue?(Array.isArray(raw)?raw:[]):[raw]).map(clean).filter(Boolean))];for(const value of values)counts.set(value,(counts.get(value)||0)+1);}return [...counts.entries()].sort((a,b)=>b[1]-a[1]||a[0].localeCompare(b[0])).slice(0,limit).map(([value,count])=>({value,count}));}
  function dimensionConsensus(rowIds,analyses){const threshold=supportThreshold(rowIds.length);return PROFILE_DIMENSIONS.map(([key,arrayValue])=>({key,top:commonValues(analyses,rowIds,key,arrayValue,5),arrayValue})).map(item=>({...item,recurring:item.top.some(value=>value.count>=threshold)}));}
  function profileConfidence(rowIds,analyses){if(rowIds.length<=1)return 'low';const dimensions=dimensionConsensus(rowIds,analyses);const recurring=dimensions.filter(item=>item.recurring);if(!recurring.length)return 'low';const evidenceConfidence=confidenceFor(analyses,rowIds);if(evidenceConfidence==='low')return 'low';if(rowIds.length<=3)return 'medium';const strong=recurring.filter(item=>item.top[0]?.count/rowIds.length>=.8);return evidenceConfidence==='high'&&strong.length>=2?'high':'medium';}
  function titleCase(value){const text=clean(value);return text?text[0].toLocaleUpperCase()+text.slice(1):'';}
  function inferredProfileName(rowIds,analyses){const dominant=commonValues(analyses,rowIds,'industry',false,3)[0];if(!dominant||dominant.count/rowIds.length<.6)return 'Reference customer profile';return rowIds.length===1?`Hypothesis: ${dominant.value}`:`${titleCase(dominant.value)} customers`;}
  function segmentFromRows(name,rowIds,analyses){
    const traits=[];
    for(const [key,isArray] of PROFILE_DIMENSIONS){
      const top=commonValues(analyses,rowIds,key,isArray,2);if(top.length)traits.push(...top.map(item=>`${DIMENSION_LABELS[key]}: ${item.value} (${item.count}/${rowIds.length})`));
    }
    const dominantIndustry=commonValues(analyses,rowIds,'industry',false,1)[0],industry=dominantIndustry&&dominantIndustry.count/rowIds.length>=.6?dominantIndustry.value:'';
    const recurringDimensionCount=dimensionConsensus(rowIds,analyses).filter(item=>item.recurring).length,threshold=supportThreshold(rowIds.length);
    const summary=rowIds.length===1?`1 reference company analyzed. Its evidenced characteristics guide similarity search directly; each prospect is verified independently. Population-pattern confidence remains low with one example.`:recurringDimensionCount?`${rowIds.length} analyzed reference companies support ${recurringDimensionCount} recurring commercial dimensions. Shared traits guide the combined profile; individual reference profiles also guide similarity search without requiring repetition.`:`No recurring commercial traits were found across ${rowIds.length} analyzed reference companies. Search uses each evidenced reference as a separate similarity example; no shared pattern is claimed.`;
    return {id:`segment-${stableId(`${name}|${[...rowIds].sort().join('|')}`)}`,name:industry&&name==='Reference customer profile'?`${titleCase(industry)} customers`:name,rowIds:[...rowIds],count:rowIds.length,confidence:profileConfidence(rowIds,analyses),summary,traits:traits.slice(0,8),recurringDimensionCount,canActivate:rowIds.some(id=>hasAnalysisFacts(analyses[id]))};
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
    const rowIds=eligible.map(row=>row.id);return {meaningful:false,segments:[segmentFromRows(inferredProfileName(rowIds,analyses),rowIds,analyses)],analyzedCount:eligible.length};
  }
  function buildReferenceDnaFromState(normalized,analyses){
    analyses=Object.fromEntries(Object.entries(analyses).map(([id,analysis])=>{
      if(analysis.analysisVersion!==4)return [id,analysis];
      const supported=new Set((analysis.sourceEvidence||[]).map(item=>item.field)),verified={...analysis};
      for(const [key,arrayValue] of PROFILE_DIMENSIONS)if(!supported.has(key))verified[key]=arrayValue?[]:'';
      return [id,verified];
    }));
    const ids=new Set(normalized.activeIds||[]),rows=(normalized.rows||[]).filter(row=>ids.has(row.id)&&(analyses[row.id]?.analysisVersion!==4||hasAnalysisFacts(analyses[row.id])));if(!normalized.activated||!rows.length)return null;
    const rowIds=rows.map(row=>row.id),dimensions=[],threshold=supportThreshold(rows.length);
    for(const [key,arrayValue] of PROFILE_DIMENSIONS){
      const allValues=commonValues(analyses,rowIds,key,arrayValue,100),values=allValues.filter(item=>item.count>=threshold).slice(0,5);if(!values.length)continue;
      const strongest=values[0],prevalence=strongest.count/rows.length,evidenceConfidence=confidenceFor(analyses,rowIds);
      const dimensionConfidence=rows.length<=1?'low':evidenceConfidence==='low'?'low':rows.length>=4&&prevalence>=.8&&evidenceConfidence==='high'?'high':'medium';
      dimensions.push({key,label:DIMENSION_LABELS[key],values:values.map(item=>item.value),evidenceByValue:Object.fromEntries(values.map(item=>[item.value,item.count])),weight:1,confidence:dimensionConfidence,evidenceCount:strongest.count,supportThreshold:threshold,prevalence:Number(prevalence.toFixed(2))});
    }
    const referenceProfiles=rows.filter(row=>hasAnalysisFacts(analyses[row.id])).map(row=>({rowId:row.id,companyName:row.companyName,website:row.website,confidence:analyses[row.id].confidence||'low',dimensions:PROFILE_DIMENSIONS.map(([key,isArray])=>({key,label:DIMENSION_LABELS[key],values:(isArray?analyses[row.id][key]||[]:[analyses[row.id][key]]).map(clean).filter(Boolean),weight:['broadIndustry','industry','productionModel','capabilities'].includes(key)?2:1,confidence:analyses[row.id].confidence||'low'})).filter(d=>d.values.length),sourceEvidence:analyses[row.id].sourceEvidence||[]}));
    const uniqueAnalyzed=new Set(rows.filter(row=>hasAnalysisFacts(analyses[row.id])).map(row=>row.id)).size;
    const coverage=rows.length?uniqueAnalyzed/rows.length:0;
    const selectedSegments=(normalized.segments||[]).filter(segment=>(normalized.activeSegmentIds||[]).includes(segment.id));
    const fallbackProfile=segmentFromRows('Reference customer profile',rowIds,analyses);
    const profileName=selectedSegments.length===1?selectedSegments[0].name:selectedSegments.length?'Selected reference customer profiles':fallbackProfile.name;
    const profileSummary=selectedSegments.map(segment=>segment.summary).filter(Boolean).join(' ')||fallbackProfile.summary;
    let confidence=profileConfidence(rowIds,analyses);
    if(coverage<.4)confidence='low';else if(coverage<.75&&confidence==='high')confidence='medium';
    if(selectedSegments.some(segment=>segment.confidence==='low'))confidence='low';else if(selectedSegments.some(segment=>segment.confidence==='medium')&&confidence==='high')confidence='medium';
    return {version:4,calibrationVersion:2,active:true,fingerprint:normalized.fingerprint,activeCount:rows.length,sampleSize:rows.length,analyzableCount:uniqueAnalyzed,confidence,profileName,profileSummary,profileConfidence:confidence,dimensions,referenceProfiles,segmentIds:selectedSegments.map(segment=>segment.id),builtAt:new Date().toISOString()};
  }
  function buildReferenceDna(state={},analysesArg={}){
    const normalized=normalizeReferenceState(state);if(!normalized.activated||!normalized.activeIds.length)return null;
    const analyses=Object.keys(analysesArg||{}).length?analysesArg:normalized.analyses;
    return buildReferenceDnaFromState(normalized,analyses);
  }
  function migrateLegacyLookalikes(value=''){
    const names=String(value||'').split(/\n|;|,/).map(clean).filter(Boolean);return normalizeImportedRows(names.map(name=>({Company:name})),{sourceType:'pdf'});
  }
  function targetResearchSummary(target={},discovery={},meta={}){
    const key=domain(target.domain||target.website),name=clean(target.companyName).toLowerCase();
    const matches=item=>key&&domain(item.domain||item.website)===key||clean(item.company).toLowerCase()===name;
    const saved=meta.targetResearchByDomain?.[key];
    const qualified=(discovery.candidates||[]).find(matches),review=(discovery.potentialMatches||[]).find(matches);
    const completed=Boolean(saved?.completedAt)||(meta.lastTargetResearchNames||[]).includes(name)&&Boolean(discovery.lastRunAt);
    const verified=saved?saved.qualified===true:Boolean(qualified);
    const gaps=saved?.gaps||review?.qualificationGaps||[];
    const evidence=saved?.evidence||review?.evidence||qualified?.evidence||[];
    return {completed:completed||Boolean(qualified||review),qualified:verified,label:verified?'Research completed · Qualified':completed||review?'Research completed · Opportunity unverified':'Research pending',gaps:verified?[]:gaps.length?gaps:['The search did not confirm all opportunity requirements.'],evidence,completedAt:saved?.completedAt||discovery.lastRunAt||''};
  }
  return {hasUsableReferenceDna,MAX_ROWS,MAX_ACTIVE,parseCsv,normalizeImportedRows,normalizeTargetCompanies,normalizeReferenceState,activateReferenceCustomers,activateReferenceSegments,getActiveReferenceModel,buildReferenceSegments,buildReferenceDna,migrateLegacyLookalikes,normalizeUrl,domain,persistReferenceWorkspaceState,saveReferenceWorkflowState,referenceWorkflowSaveNotice,targetResearchSummary};
});
