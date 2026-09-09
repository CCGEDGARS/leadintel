(function(root,factory){
  const api=factory();
  if(typeof module!=="undefined"&&module.exports)module.exports=api;
  if(root)root.LeadIntelCanonicalIntelligence=api;
})(typeof globalThis!=="undefined"?globalThis:this,function(){
  "use strict";

  const VERSION=1;
  const FIELD_MAP=Object.freeze({
    priorityOffers:'priority_offers',idealCustomer:'ideal_customer',buyingTriggers:'buying_triggers',
    decisionMakers:'buyer_roles',differentiation:'differentiation',commercialObjective:'success_outcome',
    exclusions:'exclusions',opportunityValue:'opportunity_value',marketFocus:'growth_markets'
  });
  const DIAGNOSTIC_FIELDS=Object.freeze(['priorityOffers','idealCustomer','targetMarkets','customerPainPoints','buyingTriggers','decisionMakers','differentiation','commercialObjective']);
  const PRECEDENCE=Object.freeze({user:40,document:30,website:20,ai_inference:10,external:0,unknown:-1});
  const VALID_STATUS=new Set(['user_confirmed','first_party_evidence','ai_inferred_first_party','external_validated','needs_confirmation','unknown']);
  const VALID_CONFIDENCE=new Set(['high','medium','low']);

  const clean=value=>String(value??'').replace(/\s+/g,' ').trim();
  const uniq=list=>[...new Set((list||[]).map(clean).filter(Boolean))];
  function host(value){try{return new URL(String(value||'')).hostname.replace(/^www\./i,'').toLowerCase();}catch{return '';}}
  function safeUrl(value){try{const u=new URL(String(value||''));return ['http:','https:'].includes(u.protocol)?u.href:'';}catch{return '';}}
  function status(value,fallback='unknown'){return VALID_STATUS.has(value)?value:fallback;}
  function confidence(value,fallback='low'){return VALID_CONFIDENCE.has(String(value||'').toLowerCase())?String(value).toLowerCase():fallback;}
  function fieldRecord(value,{status:state='unknown',provenance='unknown',sourceIds=[],confidence:level='low',updatedAt=''}={}){
    return {value:clean(value),status:status(state),provenance:PRECEDENCE[provenance]!==undefined?provenance:'unknown',sourceIds:uniq(sourceIds),confidence:confidence(level),updatedAt:clean(updatedAt)||new Date().toISOString()};
  }

  function classifySource(source={},companyWebsite=''){
    if(source.type==='user')return {class:'user_confirmed',authority:40,firstParty:true};
    if(source.type==='document'||source.kind==='document'||source.name&&!source.url)return {class:'first_party_document',authority:30,firstParty:true};
    const url=safeUrl(source.url),companyHost=host(companyWebsite),sourceHost=host(url);
    if(url&&companyHost&&sourceHost===companyHost)return {class:'first_party_website',authority:20,firstParty:true};
    if(url)return {class:'external_validation',authority:0,firstParty:false};
    return {class:'unknown',authority:-1,firstParty:false};
  }
  function partitionSources(sources=[],companyWebsite=''){
    const firstParty=[],external=[],unknown=[];
    for(const source of sources||[]){
      const classification=classifySource(source,companyWebsite);
      if(classification.firstParty)firstParty.push(source);
      else if(classification.class==='external_validation')external.push(source);
      else unknown.push(source);
    }
    return {firstParty,external,unknown};
  }
  function externalValidationRecord(source,index){
    return {
      id:clean(source?.id)||`X${index+1}`,
      url:safeUrl(source?.url),
      title:clean(source?.title)||host(source?.url)||'External source',
      type:clean(source?.type)||'external',
      role:'external_validation',
      pageCategory:clean(source?.pageCategory),
      confidence:confidence(source?.confidence,'medium'),
      claims:source?.claims&&typeof source.claims==='object'?{...source.claims}:{},
      excerpt:clean(source?.excerpt||source?.description||source?.text).slice(0,420)
    };
  }

  function reconcileField(fieldKey,candidates=[]){
    const usable=(candidates||[]).map((item,index)=>({...item,value:clean(item?.value),provenance:PRECEDENCE[item?.provenance]!==undefined?item.provenance:'unknown',_index:index})).filter(item=>item.value);
    if(!usable.length)return fieldRecord('',{status:'unknown',provenance:'unknown',confidence:'low'});
    usable.sort((a,b)=>(PRECEDENCE[b.provenance]-PRECEDENCE[a.provenance])||(confidenceRank(b.confidence)-confidenceRank(a.confidence))||(a._index-b._index));
    const winner=usable[0];
    return fieldRecord(winner.value,{status:winner.status||defaultStatus(winner.provenance),provenance:winner.provenance,sourceIds:winner.sourceIds||winner.evidenceIds||[],confidence:winner.confidence||defaultConfidence(winner.provenance),updatedAt:winner.updatedAt});
  }
  function confidenceRank(value){return ({high:3,medium:2,low:1})[String(value||'').toLowerCase()]||0;}
  function defaultStatus(provenance){return provenance==='user'?'user_confirmed':provenance==='document'||provenance==='website'?'first_party_evidence':provenance==='ai_inference'?'ai_inferred_first_party':'unknown';}
  function defaultConfidence(provenance){return provenance==='user'||provenance==='document'?'high':provenance==='website'?'medium':'low';}
  function researchProvenance(meta={}){
    const ids=uniq(meta.sourceIds||meta.source_ids||[]);
    if(ids.some(id=>/^D\d+$/i.test(id)))return 'document';
    if(ids.some(id=>/^S\d+$/i.test(id)))return 'website';
    return 'ai_inference';
  }
  function answerCandidate(input,fieldKey){
    const answerKey=FIELD_MAP[fieldKey];if(!answerKey)return null;
    const value=clean(input?.answers?.[answerKey]);if(!value)return null;
    const meta=input?.researchMeta?.fields?.[answerKey]||{};
    const marker=clean(input?.answerStatus?.[answerKey]||meta.origin).toLowerCase();
    if(marker==='user')return {value,provenance:'user',status:'user_confirmed',confidence:'high',sourceIds:[`U:${answerKey}`]};
    if(['accepted','draft','research','ai','inferred'].includes(marker)||clean(meta.origin).toLowerCase()==='research'){
      const provenance=researchProvenance(meta);const reviewed=Boolean(meta.reviewed||marker==='accepted');const sourceIds=uniq(meta.sourceIds||meta.source_ids||[]);
      return {value,provenance,status:reviewed&&provenance!=='ai_inference'?'first_party_evidence':'needs_confirmation',confidence:confidence(meta.confidence,provenance==='document'?'high':'medium'),sourceIds:sourceIds.length?sourceIds:[`AI:${answerKey}`]};
    }
    return {value,provenance:'user',status:'user_confirmed',confidence:'high',sourceIds:[`U:${answerKey}`]};
  }
  function docCandidates(input,fieldKey){
    return (input?.documents||[]).flatMap((doc,index)=>{const value=clean(doc?.claims?.[fieldKey]||doc?.fields?.[fieldKey]);return value?[{value,provenance:'document',status:'first_party_evidence',confidence:'high',sourceIds:[clean(doc.id)||`D${index+1}`]}]:[];});
  }
  function websiteCandidate(input,fieldKey,derived){
    const value=clean(derived?.websiteFields?.[fieldKey]||input?.baseProfile?.[fieldKey]);if(!value)return null;
    const ids=partitionSources(input?.scrapedSources||[],input.website).firstParty.filter(s=>clean(s.text)).slice(0,5).map((s,index)=>clean(s.id)||`W${index+1}`);
    return {value,provenance:'website',status:'first_party_evidence',confidence:ids.length?'medium':'low',sourceIds:ids};
  }
  function derivedCandidate(derived,fieldKey){
    const value=clean(derived?.[fieldKey]);if(!value)return null;
    return {value,provenance:'ai_inference',status:'ai_inferred_first_party',confidence:clean(derived?.[`${fieldKey}Confidence`])||'medium',sourceIds:uniq(derived?.[`${fieldKey}SourceIds`]||[])};
  }

  function buildCanonicalProfile(input={},derived={}){
    const fields={};
    for(const fieldKey of [...DIAGNOSTIC_FIELDS,'exclusions','opportunityValue','marketFocus']){
      const candidates=[];const answer=answerCandidate(input,fieldKey);if(answer)candidates.push(answer);candidates.push(...docCandidates(input,fieldKey));
      if(fieldKey==='targetMarkets'){const value=Array.isArray(input.targetMarkets)?input.targetMarkets.map(clean).filter(Boolean).join('; '):clean(input.targetMarkets);if(value)candidates.push({value,provenance:'user',status:'user_confirmed',confidence:'high',sourceIds:['U:targetMarkets']});}
      const website=websiteCandidate(input,fieldKey,derived);if(website)candidates.push(website);const inferred=derivedCandidate(derived,fieldKey);if(inferred)candidates.push(inferred);fields[fieldKey]=reconcileField(fieldKey,candidates);
    }
    const profile={canonical:{version:VERSION,fields,diagnostics:[],contradictions:[],generatedAt:new Date().toISOString()}};for(const [key,record] of Object.entries(fields))profile[key]=record.value;profile.canonical.diagnostics=diagnoseCanonicalProfile(profile);return profile;
  }

  function diagnoseCanonicalProfile(profile={}){
    const fields=profile?.canonical?.fields||{};
    return DIAGNOSTIC_FIELDS.map(field=>{const record=fields[field]||fieldRecord('',{});let state='missing';if(record.value)state=['user_confirmed','first_party_evidence','external_validated'].includes(record.status)?'known':'needs_confirmation';return {field,state,status:record.status,confidence:record.confidence,sourceIds:record.sourceIds||[]};});
  }

  function comparable(value){return clean(value).toLowerCase().replace(/[^a-z0-9āčēģīķļņšūž]+/gi,' ').replace(/\s+/g,' ').trim();}
  function compareExternalEvidence(profile={},externalSources=[]){
    const fields=profile?.canonical?.fields||{};const contradictions=[];
    for(const source of externalSources||[]){if(classifySource(source,profile.website).firstParty)continue;const claims=source?.claims||{};for(const [field,claimValue] of Object.entries(claims)){const canonical=fields[field];const external=clean(claimValue);if(!canonical?.value||!external)continue;const a=comparable(canonical.value),b=comparable(external);if(a===b||a.includes(b)||b.includes(a))continue;contradictions.push({field,canonicalClaim:canonical.value,canonicalSourceIds:canonical.sourceIds||[],conflictingClaim:external,externalSourceIds:[clean(source.id)||safeUrl(source.url)].filter(Boolean),confidence:confidence(source.confidence,'medium'),resolution:'Primary retained · review recommended'});}}
    return contradictions;
  }

  function normalizeCanonicalProfile(profile={},input={},derived={}){
    const baseProfile=profile&&typeof profile==='object'?profile:{};const rebuilt=buildCanonicalProfile({...input,baseProfile},derived);const out={...baseProfile,...rebuilt};
    const partition=partitionSources(input.scrapedSources||[],input.website);
    out.externalValidationSources=partition.external.map(externalValidationRecord);
    out.canonical.contradictions=compareExternalEvidence(out,partition.external);
    out.canonical.diagnostics=diagnoseCanonicalProfile(out);
    return out;
  }
  function activeFirstPartySources(input={}){const web=partitionSources(input.scrapedSources||[],input.website).firstParty.filter(source=>clean(source.text));const docs=(input.documents||[]).filter(doc=>clean(doc?.text)||clean(doc?.name)).map((doc,index)=>({...doc,id:clean(doc.id)||`D${index+1}`,type:'document'}));return [...web,...docs];}

  return {VERSION,DIAGNOSTIC_FIELDS,classifySource,partitionSources,reconcileField,buildCanonicalProfile,diagnoseCanonicalProfile,compareExternalEvidence,normalizeCanonicalProfile,activeFirstPartySources,fieldRecord};
});
