(function(root,factory){const api=factory();if(typeof module!=='undefined'&&module.exports)module.exports=api;if(root)root.LeadIntelStrategyIntegrity=api;})(typeof globalThis!=='undefined'?globalThis:this,function(){
 'use strict';
 const VERSION='20261030-strategy-v1';
 const clean=value=>String(value??'').replace(/\s+/g,' ').trim();
 const rows=value=>Array.isArray(value)?value:[];
 const list=value=>[...new Set((Array.isArray(value)?value:String(value??'').split(/[;,\n]/)).map(clean).filter(Boolean))].sort();
 function canonical(value){if(Array.isArray(value))return value.map(canonical);if(value&&typeof value==='object')return Object.fromEntries(Object.keys(value).sort().filter(key=>value[key]!==undefined).map(key=>[key,canonical(value[key])]));return value;}
 // A deterministic content digest, never an authentication token or spending permission.
 function digest(value){
  const bytes=new TextEncoder().encode(String(value)),length=bytes.length,blocks=new Uint8Array(Math.ceil((length+9)/64)*64);blocks.set(bytes);blocks[length]=128;
  const view=new DataView(blocks.buffer);view.setUint32(blocks.length-8,Math.floor(length/0x20000000));view.setUint32(blocks.length-4,(length*8)>>>0);
  const k=[0x428a2f98,0x71374491,0xb5c0fbcf,0xe9b5dba5,0x3956c25b,0x59f111f1,0x923f82a4,0xab1c5ed5,0xd807aa98,0x12835b01,0x243185be,0x550c7dc3,0x72be5d74,0x80deb1fe,0x9bdc06a7,0xc19bf174,0xe49b69c1,0xefbe4786,0x0fc19dc6,0x240ca1cc,0x2de92c6f,0x4a7484aa,0x5cb0a9dc,0x76f988da,0x983e5152,0xa831c66d,0xb00327c8,0xbf597fc7,0xc6e00bf3,0xd5a79147,0x06ca6351,0x14292967,0x27b70a85,0x2e1b2138,0x4d2c6dfc,0x53380d13,0x650a7354,0x766a0abb,0x81c2c92e,0x92722c85,0xa2bfe8a1,0xa81a664b,0xc24b8b70,0xc76c51a3,0xd192e819,0xd6990624,0xf40e3585,0x106aa070,0x19a4c116,0x1e376c08,0x2748774c,0x34b0bcb5,0x391c0cb3,0x4ed8aa4a,0x5b9cca4f,0x682e6ff3,0x748f82ee,0x78a5636f,0x84c87814,0x8cc70208,0x90befffa,0xa4506ceb,0xbef9a3f7,0xc67178f2];
  const h=[0x6a09e667,0xbb67ae85,0x3c6ef372,0xa54ff53a,0x510e527f,0x9b05688c,0x1f83d9ab,0x5be0cd19],w=new Uint32Array(64),rotr=(n,b)=>(n>>>b)|(n<<(32-b));
  for(let offset=0;offset<blocks.length;offset+=64){for(let i=0;i<16;i++)w[i]=view.getUint32(offset+i*4);for(let i=16;i<64;i++){const a=w[i-15],b=w[i-2];w[i]=(w[i-16]+(rotr(a,7)^rotr(a,18)^(a>>>3))+w[i-7]+(rotr(b,17)^rotr(b,19)^(b>>>10)))>>>0;}let [a,b,c,d,e,f,g,j]=h;for(let i=0;i<64;i++){const t1=(j+(rotr(e,6)^rotr(e,11)^rotr(e,25))+((e&f)^(~e&g))+k[i]+w[i])>>>0,t2=((rotr(a,2)^rotr(a,13)^rotr(a,22))+((a&b)^(a&c)^(b&c)))>>>0;j=g;g=f;f=e;e=(d+t1)>>>0;d=c;c=b;b=a;a=(t1+t2)>>>0;}for(const [i,n]of [a,b,c,d,e,f,g,j].entries())h[i]=(h[i]+n)>>>0;}
  return h.map(n=>n.toString(16).padStart(8,'0')).join('');
 }
 const pick=(value,keys)=>Object.fromEntries(keys.map(key=>[key,value?.[key]??'']));
 function evidence(value){return rows(value).map(item=>({...pick(item,['id','url','type','title','description','date','dateSource','publishedDate','eventDate','extracted','extractedBy','status','role','sourceClass','market','companyId','companyDomain','company','supportedClaim','claim','confidence','qualityScore','commercialRelevance','publishedAt','detectedAt']),body:digest(String(item.text||item.markdown||'')),extractionComplete:Boolean(item.extractedAt),sourceProviders:list(item.sourceProviders),verification:item.verification||null})).sort((a,b)=>JSON.stringify(a).localeCompare(JSON.stringify(b)));}
 function referenceModel(ref={}){if(ref.publishedModel)return ref.publishedModel.active===true?ref.publishedModel:null;return ref.activated===true?pick(ref,['activeIds','activeSegmentIds','fingerprint','rows','analyses','dna']):null;}
 function material(state={},researchOnly=false){
  const profile=state.profile||{},market=state.market||{},portfolio=state.referenceCustomerPortfolio;
  const references=Array.isArray(portfolio?.lists)?portfolio.lists.filter(item=>item.active===true).map(item=>({id:item.id,model:referenceModel(item.reference)})).filter(item=>item.model).sort((a,b)=>String(a.id).localeCompare(String(b.id))):{legacy:referenceModel(state.referenceCustomers)};
  const fields=Object.fromEntries(Object.entries(profile.canonical?.fields||{}).map(([key,value])=>[key,{...pick(value,['value','status','provenance']),sourceIds:list(value.sourceIds)}]));
  return {version:VERSION,website:clean(state.website||profile.website),targetMarkets:list(state.targetMarkets?.length?state.targetMarkets:profile.targetMarkets),answers:state.answers||{},answerStatus:state.answerStatus||{},goals:state.workspaceGoals||{},profile:pick(profile,['companyName','companyOverview','priorityOffers','idealCustomer','customerPainPoints','decisionMakers','currentMarkets','targetMarkets','valueProposition','differentiation','proofPoints','buyingTriggers','commonObjections','exclusions','buyingOutcomes','commercialObjective','opportunityValue','marketFocus','lookalikeCustomers','researchMarkets','companyClassification','companyClaims','companyDomain','companyWebsite','website','referenceDomains','referenceSimilarityModel','collectAllCompanyContacts','discoveryPriority','searchFeedback','customerPainPointsStatus','customerPainPointsLanguage']),fields,sources:evidence(state.scrapedSources),documents:rows(state.documents).map(item=>({id:item.id||'',name:item.name||'',body:digest(String(item.text||'')),claims:item.claims||null})),references,icps:rows(market.icps).map(item=>({...pick(item,['id','type','name','description','targetMarkets','buyerRoles','offers','value','exclusions']),active:item.active!==false})).sort((a,b)=>String(a.id).localeCompare(String(b.id))),signals:rows(market.signals).map(item=>({...pick(item,['id','name','keywords','priority','source','description']),active:item.active!==false,weight:Number(item.weight??5)})).sort((a,b)=>String(a.id).localeCompare(String(b.id))),...(!researchOnly&&{opportunities:rows(market.opportunities).map(item=>({id:item.id,active:item.active!==false,market:item.market,evidence:evidence(item.evidence)}))}),researchMode:market.researchMode||'quick',sourceTypes:list(market.researchSourceTypes),sourceTypesCustomized:market.researchSourceTypesCustomized===true,customSources:list(market.researchCustomSources),instructions:clean(market.researchInstructions),...(!researchOnly&&{evidence:evidence(market.researchResults)})};
 }
 // Profile approval, seller research and targeting confirmation use two names
 // for reviewed answers. Canonical provenance, evidence and drafts stay material.
 const targetingFields=['priority_offers','ideal_customer','buyer_roles','exclusions'];
 function reviewedStatuses(statuses,marker,keys=Object.keys(statuses)){
  const next={...statuses};
  for(const key of keys)if(next[key]==='accepted'||next[key]==='user')next[key]=marker;
  return next;
 }
 function hasNoActiveReferences(references){return Array.isArray(references)?references.length===0:references?.legacy===null;}
 function normalizedScope(scope){
  return {...scope,answerStatus:reviewedStatuses(scope.answerStatus,'user'),references:hasNoActiveReferences(scope.references)?{legacy:null}:scope.references};
 }
 function scopeDigest(scope,research=false,legacy=false){
  const prefix=research?(legacy?':research:':':research:v2:'):':';
  return VERSION+prefix+digest(JSON.stringify(legacy?scope:canonical(scope)));
 }
 function historicalReferences(references){
  if(hasNoActiveReferences(references))return [references,Array.isArray(references)?{legacy:null}:[]];
  // The first library migration wraps the existing published model in a list.
  // A legacy digest had no list ID. Reproduce it only with the entire model.
  if(Array.isArray(references)&&references.length===1){
   const model=references[0].model;
   if(model?.active===true&&model.fingerprint)return [references,{legacy:model}];
  }
  return [references];
 }
 function matchesSavedScope(scope,saved,research=false){
  if(typeof saved!=='string')return false;
  const legacy=research&&!saved.startsWith(VERSION+':research:v2:');
  if(!saved.startsWith(VERSION+(research?':research:':':')))return false;
  // Accept historical digests only by reproducing their complete preimage.
  const references=historicalReferences(scope.references);
  const statuses=[scope.answerStatus,reviewedStatuses(scope.answerStatus,'user'),reviewedStatuses(scope.answerStatus,'accepted'),
   reviewedStatuses(scope.answerStatus,'user',targetingFields),reviewedStatuses(scope.answerStatus,'accepted',targetingFields)];
  const tried=new Set();
  for(const answerStatus of statuses){
   const key=JSON.stringify(answerStatus);if(tried.has(key))continue;tried.add(key);
   for(const reference of references){
    if(saved===scopeDigest({...scope,answerStatus,references:reference},research,legacy))return true;
   }
  }
  return false;
 }
 function signature(state={}){
  const scope=material(state),current=scopeDigest(normalizedScope(scope)),saved=state.market?.strategyApproval;
  // Company scores carry the approved digest. Keep its original identifier
  // across a compatible migration so a reload also preserves checked scores.
  if(saved?.version===1&&saved.signature&&saved.signature!==current&&matchesSavedScope(scope,saved.signature))return saved.signature;
  return current;
 }
 function researchFingerprint(state,legacy=false){
  const scope=material(state,true);
  return scopeDigest(legacy?scope:normalizedScope(scope),true,legacy);
 }
 function completedOpportunityScope(market,scope){
  const execution=market.researchExecution||{};
  if(!['complete','partial'].includes(market.researchStatus)||!['complete','partial'].includes(execution.status)
    ||!execution.runId||!Number(execution.completedAt)||market.researchQuality?.passed===false)return null;
  if(!rows(market.researchHistory).some(run=>run.id===execution.runId&&Number(run.sourceCount)>0)
    ||!rows(market.opportunities).some(item=>item.active!==false&&item.profileOnly!==true&&item.evidence?.length))return null;
  const opportunity=scope.icps.filter(item=>item.type==='opportunity-led'||item.id==='icp-opportunity-led');
  if(opportunity.length!==1||opportunity[0].active!==true)return null;
  return {...scope,icps:scope.icps.map(item=>item===opportunity[0]?{...item,active:false}:item)};
 }
 function researchContext(state={},companyBrain=globalThis.LeadIntelCompanyBrain){
  const market=state.market||{},saved=market.researchContextFingerprint||'';
  if(!rows(market.researchResults).length)return {stale:false,fingerprint:''};
  if(companyBrain?.unrelatedSignals?.(state.profile||{},market.signals)?.length)return {stale:true,fingerprint:saved};
  if(!saved||typeof saved!=='string'||!saved.startsWith(VERSION+':research:'))return {stale:saved!==''||market.researchContextStale===true,fingerprint:saved};
  const scope=material(state,true),current=scopeDigest(normalizedScope(scope),true);
  if(saved===current||matchesSavedScope(scope,saved,true))return {stale:false,fingerprint:current};
  const prior=completedOpportunityScope(market,scope);
  if(prior&&matchesSavedScope(prior,saved,true))return {stale:false,fingerprint:current};
  return {stale:true,fingerprint:saved};
 }
 const excludeEarlierResearch=market=>market.researchContextStale===true||market.strategyApproval?.researchBasis==='profile';
 const opportunityProfile=item=>item.type==='opportunity-led'||item.id==='icp-opportunity-led';
 function marketForExecution(market={},approvalStatus){
  if(!excludeEarlierResearch(market))return market;
  if(market.strategyApproval?.researchBasis!=='profile'&&approvalStatus?.current===true&&approvalStatus.researchBasis!=='profile'){
   return {...market,researchContextStale:false};
  }
  return {...market,...(Array.isArray(market.icps)&&{icps:market.icps.filter(item=>!opportunityProfile(item))}),opportunities:[],researchResults:[]};
 }
 function executionMarketForState(state={},approvalStatus){
  const market=state.market||{};
  const verify=market.researchContextStale===true&&market.strategyApproved===true&&market.strategyApproval?.version===1&&market.strategyApproval.researchBasis!=='profile';
  return marketForExecution(market,approvalStatus??(verify?status(state):undefined));
 }
 const profileBasisSignature=signature=>VERSION+':'+digest(JSON.stringify(['profile',signature]));
 function requirements(state={},researchBasis='research'){
  if(state.approved!==true||!state.profile)return {code:'profile_unapproved',recovery:'profile',reason:'Review and approve the current company Profile before activating Strategy.'};
  if(!clean(state.website||state.profile.website)||!clean(state.profile.priorityOffers)||!list(state.targetMarkets?.length?state.targetMarkets:state.profile.targetMarkets).length)return {code:'strategy_incomplete',recovery:'profile',reason:'Complete the seller website, priority offer and target markets in Profile.'};
  if(researchBasis!=='profile'&&researchContext(state).stale)return {code:'research_stale',recovery:'strategy',reason:'Earlier market research needs review. You can approve Strategy using the current Profile and signals, or update market research.'};
  const icps=rows(state.market?.icps).filter(item=>item.active!==false&&(researchBasis!=='profile'||!opportunityProfile(item))),signals=rows(state.market?.signals).filter(item=>item.active!==false);
  if(!icps.length||!signals.length)return {code:'strategy_incomplete',recovery:'strategy',reason:'Enable at least one customer profile and one buying signal, then review Strategy.'};
  if(signals.some(item=>!clean(item.id)||!clean(item.keywords||item.name)||!Number.isFinite(Number(item.weight??5))||Number(item.weight??5)<1||Number(item.weight??5)>10))return {code:'strategy_invalid',recovery:'strategy',reason:'Review active signal names, keywords and weights (1–10).'};
  return null;
 }
 function approval(state,at=new Date().toISOString(),researchBasis='research'){
  if(requirements(state,researchBasis))return null;
  const scope=signature(state);
  return {version:1,signature:scope,approvedAt:at,...(researchBasis==='profile'&&{researchBasis,profileSignature:profileBasisSignature(scope)})};
 }
 function status(state={}){
  const saved=state.market?.strategyApproval;
  const profileBasis=saved?.version===1&&saved.researchBasis==='profile'&&saved.profileSignature===profileBasisSignature(saved.signature);
  const issue=requirements(state,profileBasis?'profile':'research');if(issue)return {current:false,...issue,signature:''};
  const current=signature(state);
  if(saved?.version===1&&saved.signature!==current)return {current:false,code:'strategy_stale',recovery:'strategy',reason:'Strategy context changed. Review Strategy and activate it again; saved evidence is retained.',signature:current};
  if(state.market?.strategyApproved!==true)return {current:false,code:'strategy_unapproved',recovery:'strategy',reason:'Review and activate Strategy before starting new company searches or automatic runs.',signature:current};
  if(saved?.version!==1||saved.signature!==current)return {current:false,code:'strategy_stale',recovery:'strategy',reason:'Strategy context changed or predates revision checks. Review Strategy and activate it again; saved evidence is retained.',signature:current};
  return {current:true,code:'current',reason:'',signature:profileBasis?saved.profileSignature:current,...(profileBasis&&{researchBasis:'profile'})};
 }
 return {VERSION,digest,material,signature,researchFingerprint,researchContext,marketForExecution,executionMarketForState,requirements,approval,status};
});
