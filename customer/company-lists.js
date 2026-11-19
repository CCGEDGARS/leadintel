(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;if(root)root.LeadIntelCompanyLists=api;})(typeof globalThis!=='undefined'?globalThis:this,function(){
 'use strict';
 const StrategyIntegrity=typeof module==='object'&&module.exports?require('./strategy-integrity.js'):globalThis.LeadIntelStrategyIntegrity;
 const clean=(v,n=500)=>String(v??'').replace(/\s+/g,' ').trim().slice(0,n);
 function url(v){try{const u=new URL(v);return ['https:','http:'].includes(u.protocol)&&!u.username&&!u.password&&!u.port&&u.hostname.includes('.')&&!/^(?:localhost|127\.|10\.|192\.168\.|169\.254\.)|\.local$/.test(u.hostname)?u.href:'';}catch{return '';}}
 const domain=v=>{try{return new URL(url(v)).hostname.replace(/^www\./,'').toLowerCase();}catch{return '';}};
 const QUALITY_VERSION='20261119-reviewed-evidence-v2';
 const PROFILE_VERSION='20261119-profiles-signals-v3';
 const isLookalike=s=>s?.kind==='lookalike'||s?.type==='lookalike'||/(?:^|[-_])lookalike(?:[-_]|$)/i.test(clean(s?.id))||/^look[ -]?alike(?:\s+(?:signal|companies|customers))?$/i.test(clean(s?.name));
 const recommendedBudget=count=>Math.min(5000,Math.max(100,Number(count||10)*20));
 function options(main={}){
  const refs=[],groups=[],seen=new Set(),portfolio=main.referenceCustomerPortfolio||{};
  const lists=(portfolio.lists||[]).slice();
  if(main.referenceCustomers?.rows?.length&&!lists.some(l=>l.id===portfolio.selectedListId))lists.push({id:'current',name:'Current references',active:true,reference:main.referenceCustomers});
  for(const list of lists){const ref=list.reference||{},members=[];
   for(const row of ref.rows||[]){const website=url(row.website),key=list.id+':'+row.id,analysis=ref.analyses?.[row.id]||{};
    if(!website||seen.has(key))continue;seen.add(key);
    const evidence=(analysis.sourceEvidence||[]).filter(e=>url(e.url)&&clean(e.quote).length>=12).map(e=>({field:clean(e.field,80),quote:clean(e.quote,700),url:url(e.url)})).slice(0,12);
    refs.push({id:key,name:clean(row.companyName,180)||domain(website),website,groupId:list.id,group:clean(list.name,120),active:list.active===true&&(ref.publishedModel?.active!==false)&&(!(ref.publishedModel?.activeIds||ref.activeIds)?.length||(ref.publishedModel?.activeIds||ref.activeIds).includes(row.id)),reason:clean(row.reason,500),evidence,summary:clean(analysis.summary,1200),ready:evidence.length>0});members.push(key);
   }
   if(members.length)groups.push({id:list.id,name:clean(list.name,120),referenceIds:members});
  }
  const signals=[],market=main.market||{},deleted=new Set(market.deletedSignalIds||[]),saved=market.signals||[];
  const lookalike=saved.find(isLookalike),lens=(market.icps||[]).find(i=>i.id==='icp-reference-lookalike'||i.type==='lookalike'||i.type==='lookalike-led');
  // Legacy reference-only workspaces have no signal configuration. Once signals
  // are configured, an inactive/deleted signal must never be silently restored.
  const lookalikeDeleted=[...deleted].some(id=>/(?:^|[-_])look[ -]?alike(?:[-_]|$)/i.test(id));
  if(lookalike?lookalike.active!==false&&!deleted.has(lookalike.id):!lookalikeDeleted&&(lens?lens.active!==false:!Array.isArray(market.signals)))signals.push({id:'lookalike',kind:'lookalike',name:'Lookalike',keywords:[],description:'Similarity to your selected reference companies',sourceId:lookalike?.id||'lookalike'});
  for(const s of saved){const id=clean(s.id,120);if(!id||s.active===false||deleted.has(id)||isLookalike(s)||signals.some(x=>x.id===id))continue;signals.push({id,name:clean(s.name||s.label||id,180),keywords:(Array.isArray(s.keywords)?s.keywords:String(s.keywords||'').split(/[,;\n]/)).map(v=>clean(v,120)).filter(Boolean).slice(0,10),description:clean(s.description||s.evidenceToLookFor||s.reason,700)});}
  const result={references:refs,groups,signals,markets:(main.targetMarkets||[]).map(v=>clean(v,100)).filter(Boolean),profile:{offers:clean(main.profile?.priorityOffers||main.answers?.priority_offers||main.answers?.priorityOffers,1500),idealCustomer:clean(main.profile?.idealCustomer||main.answers?.ideal_customer,1500),exclusions:clean(main.profile?.exclusions||main.answers?.exclusions,1500),website:url(main.website||main.profile?.website)}};
  return {...result,...profileOptions(main,result)};
 }
 function configuration(raw={},available={}){
  if(Object.hasOwn(raw,'profileIds'))return profileConfiguration(raw,available);
  const fail=m=>{throw Object.assign(Error(m),{status:400});};
  const count=Number(raw.count);if(!Number.isInteger(count)||count<1||count>200)fail('Choose between 1 and 200 companies.');
  const ids=[...new Set(raw.signalIds||[])];if(!ids.length||ids.length>8)fail('Select between one and eight signals.');
  const signals=ids.map(id=>available.signals.find(s=>s.id===id&&s.active!==false));if(signals.some(s=>!s))fail('A selected signal is no longer active. Reload the list criteria from Strategy.');
  const selected=[...new Set(raw.referenceIds||[])],references=selected.map(id=>available.references.find(r=>r.id===id));
  if(references.some(r=>!r))fail('A selected reference changed. Reload the list criteria.');
  if(ids.includes('lookalike')&&(!references.length||references.length>15||references.some(r=>!r.ready)))fail('Select 1–15 analyzed references. Analyze their websites in Profile first.');
  const markets=[...new Set((Array.isArray(raw.markets)?raw.markets:[]).map(v=>clean(v,100)).filter(Boolean))];if(!markets.length||markets.length>10)fail('Choose 1–10 target countries or markets.');
  const budget=Number(raw.budget??recommendedBudget(count));if(!Number.isInteger(budget)||budget<10||budget>5000)fail('Choose a research allowance between 10 and 5,000 operations.');
  const weights={};for(const s of signals){const w=Number(raw.weights?.[s.id]??1);if(!Number.isFinite(w)||w<1||w>5)fail('Signal importance must be between 1 and 5.');weights[s.id]=w;}
  return {version:2,qualityVersion:QUALITY_VERSION,name:clean(raw.name,120)||'Company list',count,signals,referenceIds:selected,references:ids.includes('lookalike')?references:[],markets,mode:raw.mode==='all'?'all':'any',weights,budget,profile:available.profile||{}};
 }
 const contains=(text,quote)=>clean(quote,3000).length>=12&&clean(text,60000).toLowerCase().includes(clean(quote,3000).toLowerCase());
 function assess(raw,config,pages,now=Date.now()){
  if(config.qualityVersion===PROFILE_VERSION)return assessProfiles(raw,config,pages,now);
  const website=url(raw.website),host=domain(website),company=clean(raw.company,180);if(!host||!company||host===domain(config.profile.website)||config.references.some(r=>domain(r.website)===host)||raw.excluded===true)return null;
  const proof=e=>{const page=pages.find(p=>p.url===url(e?.url));return page&&contains(page.text,e.quote)?{url:page.url,quote:clean(e.quote,1000),readAt:page.readAt,date:clean(e.date,40)}:null;};
  const identity=proof(raw.identity),location=proof(raw.location);if(!identity||domain(identity.url)!==host||!location||!config.markets.includes(raw.location?.market))return null;
  if(!clean(identity.quote).toLowerCase().includes(company.toLowerCase())&&!clean(identity.quote).toLowerCase().includes(host))return null;
  if(config.qualityVersion===QUALITY_VERSION){
   const text=clean(identity.quote).toLowerCase(),name=company.toLowerCase();let at=text.indexOf(name),named=false;
   while(at>=0){if(!/[\p{L}\p{N}]/u.test(text[at-1]||'')&&!/[\p{L}\p{N}]/u.test(text[at+name.length]||'')){named=true;break;}at=text.indexOf(name,at+1);}
   if(!named)return null;
  }
  if(!clean(raw.location?.label)||!clean(location.quote).toLowerCase().includes(clean(raw.location.label).toLowerCase()))return null;
  const matches=[];
  for(const s of config.signals){const m=(raw.matches||[]).find(x=>x.signalId===s.id),e=m&&proof(m);if(!e)continue;
   let reference=null,referenceEvidence=null;if(s.id==='lookalike'){reference=config.references.find(r=>r.id===m.referenceId&&r.evidence.some(x=>contains(x.quote,m.referenceQuote)));if(!reference)continue;referenceEvidence=reference.evidence.find(x=>contains(x.quote,m.referenceQuote));}
   const date=Date.parse(e.date),age=(now-date)/86400000;if(s.id!=='lookalike'&&(!Number.isFinite(date)||age< -1||age>365||!String(pages.find(p=>p.url===e.url)?.text||'').includes(e.date)))continue;
   const strength=Math.max(1,Math.min(100,Number(m.strength)||0));
   const quality=domain(e.url)===host?1:.85,recency=s.id==='lookalike'?1:age<=90?1:age<=180?.9:.75;
   if(!clean(m.reason))continue;
   matches.push({signalId:s.id,name:s.name,...e,score:Math.round(Math.min(90,strength)*quality*recency),reason:clean(m.reason,500),...(reference?{referenceId:reference.id,referenceName:reference.name,referenceQuote:clean(m.referenceQuote,700),referenceUrl:referenceEvidence.url}:{})});
  }
  if(!matches.length||config.mode==='all'&&matches.length!==config.signals.length)return null;
  const denominator=config.signals.reduce((n,s)=>n+config.weights[s.id],0),score=Math.round(matches.reduce((n,m)=>n+m.score*config.weights[m.signalId],0)/denominator);
  const commercialProof=proof(raw.commercialFit),commercialFit=raw.commercialFit?.status==='supported'&&commercialProof&&clean(raw.commercialFit.reason)?{...commercialProof,reason:clean(raw.commercialFit.reason,700),status:'supported',buyingIntent:'unconfirmed'}:null;
  return {company,website,domain:host,location:clean(raw.location.label,180)||raw.location.market,market:raw.location.market,score,matches,identity,locationEvidence:location,commercialFit,checkedAt:new Date(now).toISOString(),buyingIntent:'unconfirmed'};
 }
 function reviewResult(candidate,review,config,now=Date.now()){
  if(config.qualityVersion===PROFILE_VERSION)return reviewProfiles(candidate,review,config,now);
  if(!candidate||!candidate.commercialFit||review?.decision!=='pass'||!clean(review.reason))return null;
  if(['identityConfirmed','marketConfirmed','commercialFitConfirmed','exclusionsChecked'].some(k=>review[k]!==true))return null;
  const ids=new Set(Array.isArray(review.supportedSignalIds)?review.supportedSignalIds:[]),matches=candidate.matches.filter(m=>ids.has(m.signalId));
  if(!matches.length||matches.length!==candidate.matches.length||config.mode==='all'&&matches.length!==config.signals.length||(review.gaps||[]).length)return null;
  return {...candidate,quality:{version:QUALITY_VERSION,status:'reviewed',reason:clean(review.reason,1000),checkedAt:new Date(now).toISOString(),checks:['identity','market','selected_signals','commercial_fit','exclusions'],sourceCount:new Set([candidate.identity.url,candidate.locationEvidence.url,candidate.commercialFit.url,...matches.map(m=>m.url)]).size}};
 }
 const PROFILE_TYPES=[['core','Core'],['lookalike','Lookalike'],['trigger-led','Trigger-led'],['opportunity-led','Opportunity-led']];
 function profileType(p){
  if(p.id==='icp-reference-lookalike'||['lookalike','lookalike-led'].includes(p.type)||p.id==='icp-lookalike')return 'lookalike';
  return PROFILE_TYPES.find(([type])=>p.type===type||p.id==='icp-'+type||p.id===type)?.[0]||'';
 }
 function profileOptions(main,available){
  const market=StrategyIntegrity.executionMarketForState(main),configured=Array.isArray(market.icps),saved=market.icps||[];
  const opportunities=(market.opportunities||[]).filter(o=>o.active!==false&&!o.profileOnly).map(o=>({
   id:clean(o.id,120),title:clean(o.title,300),hypothesis:clean(o.hypothesis,1000),market:clean(o.market,100),
   evidence:(o.evidence||[]).filter(e=>e.verification?.relevance!=='reject'&&!e.verification?.contradiction).map(e=>({url:url(e.url),quote:clean(e.text||e.quote||e.description,1800),date:clean(e.date,40)})).filter(e=>e.url&&e.quote.length>=12).slice(0,8)
  })).filter(o=>o.id&&o.evidence.length).slice(0,12);
  const profiles=PROFILE_TYPES.map(([type,label])=>{
   const source=type==='lookalike'?(saved.find(p=>p.id==='icp-reference-lookalike')||saved.find(p=>profileType(p)===type)):saved.find(p=>profileType(p)===type);
   // Only workspaces without profile configuration receive legacy defaults.
   // An explicit empty collection or Off card never becomes an active default.
   const legacy=!configured&&(type==='lookalike'?available.signals.some(isLookalike):type==='core'&&Boolean(available.profile.idealCustomer));
   const p=source||{},active=source?p.active!==false:legacy;
   let description=clean(p.description,1800)||(type==='core'?available.profile.idealCustomer:type==='lookalike'?'Companies sharing substantive business traits with selected references.':'');
   // The generated Trigger-led card refers to the baseline customer definition.
   // Resolve that reference from Profile without importing an inactive Strategy card.
   if(type==='trigger-led'&&/fit the core profile|atbilst pamata profil/i.test(description)&&available.profile.idealCustomer)description+=' Customer definition: '+available.profile.idealCustomer;
   const ready=type==='lookalike'?available.references.some(r=>r.ready):type==='opportunity-led'?opportunities.length>0:true;
   return {id:clean(p.id,120)||'icp-'+type,type,name:clean(p.name,180)||label,active,ready,
    description,buyerRoles:clean(p.buyerRoles,1000),value:clean(p.value,500),
    offers:clean(p.offers,1500)||available.profile.offers,exclusions:clean(p.exclusions,1500),rationale:clean(p.rationale,1000),
    status:!active?'Off in Strategy':!ready?(type==='lookalike'?'Analyze reference websites in Profile':'Complete current market research with public evidence'):'Active'};
  });
  return {profiles,profileConfigurationPresent:configured,buyingSignals:available.signals.filter(s=>!isLookalike(s)),opportunities};
 }
 function profileConfiguration(raw,available){
  const fail=m=>{throw Object.assign(Error(m),{status:400});};
  const ids=Array.isArray(raw.profileIds)?[...new Set(raw.profileIds)]:[];
  if(!ids.length||ids.length>4)fail('Select one or more active targeting profiles.');
  const profiles=ids.map(id=>available.profiles?.find(p=>p.id===id&&p.active&&p.ready));
  if(profiles.some(p=>!p))fail('A selected profile is off or missing required evidence. Review Strategy and reload the list criteria.');
  if(raw.profileMode!==undefined&&!['any','all'].includes(raw.profileMode)||raw.mode!==undefined&&!['any','all'].includes(raw.mode))fail('Choose any or all for profile and signal matching.');
  const requestedSignalMode=raw.signalMode||'off';if(!['off','boost','require'].includes(requestedSignalMode))fail('Choose profiles only, prioritize buying signals, or require buying signals.');
  if(requestedSignalMode!=='off'&&raw.signalIds!==undefined&&!Array.isArray(raw.signalIds))fail('Select buying signals using the active signal list.');
  const signalIds=requestedSignalMode==='off'?[]:Array.isArray(raw.signalIds)?[...new Set(raw.signalIds)]:[];
  if(signalIds.length>20||requestedSignalMode==='require'&&!signalIds.length)fail('Select 1–20 active buying signals, or choose Profiles only.');
  const signalMode=signalIds.length?requestedSignalMode:'off';
  const signals=signalIds.map(id=>available.buyingSignals?.find(s=>s.id===id));
  if(signals.some(s=>!s))fail('A selected buying signal is no longer active. Reload the list criteria from Strategy.');
  if(profiles.some(p=>p.type==='trigger-led')&&!signals.length)fail('Trigger-led needs selected buying signals. Choose Prioritize or Require buying signals, or deselect Trigger-led.');
  const count=Number(raw.count);if(!Number.isInteger(count)||count<1||count>200)fail('Choose between 1 and 200 companies.');
  const markets=[...new Set((Array.isArray(raw.markets)?raw.markets:[]).map(v=>clean(v,100)).filter(Boolean))];if(!markets.length||markets.length>10)fail('Choose 1–10 target countries or markets.');
  const budget=Number(raw.budget??recommendedBudget(count));if(!Number.isInteger(budget)||budget<10||budget>5000)fail('Choose a research allowance between 10 and 5,000 operations.');
  const referenceIds=profiles.some(p=>p.type==='lookalike')?[...new Set(Array.isArray(raw.referenceIds)?raw.referenceIds:[])]:[];
  const references=referenceIds.map(id=>available.references?.find(r=>r.id===id&&r.ready));
  if(profiles.some(p=>p.type==='lookalike')&&(!references.length||references.length>15||references.some(r=>!r)))fail('Select 1–15 analyzed references for Lookalike.');
  const weights={};for(const s of signals){const w=Number(raw.weights?.[s.id]??1);if(!Number.isFinite(w)||w<1||w>5)fail('Signal importance must be between 1 and 5.');weights[s.id]=w;}
  const base=available.profile||{},join=values=>[...new Set(values.filter(Boolean))].join('; ');
  return {version:3,qualityVersion:PROFILE_VERSION,name:clean(raw.name,120)||'Company list',count,profiles,
   profileMode:raw.profileMode==='all'?'all':'any',signalMode,signals,mode:raw.mode==='all'?'all':'any',weights,
   referenceIds,references,opportunities:profiles.some(p=>p.type==='opportunity-led')?(available.opportunities||[]):[],markets,budget,
   profile:{website:base.website||'',offers:join(profiles.map(p=>p.offers))||base.offers||'',idealCustomer:join(profiles.map(p=>p.description)),exclusions:join([base.exclusions,...profiles.map(p=>p.exclusions)])}};
 }
 function sourceProof(pages,e){const page=pages.find(p=>p.url===url(e?.url));return page&&contains(page.text,e.quote)?{url:page.url,quote:clean(e.quote,1000),readAt:page.readAt,date:clean(e.date,40)}:null;}
 function datedProof(pages,e,now){
  const proof=sourceProof(pages,e);
  if(!proof||!proof.date)return null;
  // Date.parse supplies a missing day or month. Only count a date at day precision.
  const calendar=proof.date.split(/(?:T|\s)(?=\d{1,2}:\d{2})/i)[0];
  const numbers=calendar.match(/\d+/g)||[];
  const namedMonth=/\b(?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)/i.test(calendar);
  if(numbers.length!==(namedMonth?2:3))return null;
  const age=(now-Date.parse(proof.date))/86400000;
  return Number.isFinite(age)&&age>=-1&&age<=365&&pages.find(p=>p.url===proof.url).text.includes(proof.date)?{...proof,age}:null;
 }
 function namedIdentity(quote,name){
  const text=quote.toLowerCase();name=name.toLowerCase();let at=text.indexOf(name);
  while(at>=0){if(!/[\p{L}\p{N}]/u.test(text[at-1]||'')&&!/[\p{L}\p{N}]/u.test(text[at+name.length]||''))return true;at=text.indexOf(name,at+1);}return false;
 }
 function signalRule(matches,c){return matches.length>0&&(c.mode!=='all'||matches.length===c.signals.length);}
 function matchStrength(value){
  const score=typeof value==='string'?Number(value):value;
  return Number.isFinite(score)&&score>=1&&score<=100?score:0;
 }
 function profileScores(candidate,config){
  const profileMatches=candidate.profileMatches,signalMatches=candidate.signalMatches;
  const fitScore=(config.profileMode==='all'?Math.min:Math.max)(...profileMatches.map(m=>m.score));
  const denominator=config.signals.reduce((n,s)=>n+config.weights[s.id],0);
  const signalScore=denominator?Math.round(signalMatches.reduce((n,m)=>n+m.score*config.weights[m.signalId],0)/denominator):0;
  const signalBonus=config.signalMode==='off'?0:Math.min(10,Math.round(signalScore/10));
  return {...candidate,fitScore,signalScore,signalBonus,score:Math.min(100,fitScore+signalBonus),matches:[...profileMatches,...signalMatches]};
 }
 function assessProfiles(raw,c,pages,now){
  const website=url(raw.website),host=domain(website),company=clean(raw.company,180);
  if(!host||!company||host===domain(c.profile.website)||c.references.some(r=>domain(r.website)===host)||raw.excluded===true)return null;
  const identity=sourceProof(pages,raw.identity),location=sourceProof(pages,raw.location),commercial=sourceProof(pages,raw.commercialFit);
  if(!identity||domain(identity.url)!==host||!namedIdentity(identity.quote,company)||!location||!c.markets.includes(raw.location?.market)||!clean(raw.location?.label)||!location.quote.toLowerCase().includes(clean(raw.location.label).toLowerCase()))return null;
  if(!commercial||raw.commercialFit?.status!=='supported'||!clean(raw.commercialFit.reason))return null;
  const signalMatches=[];
  if(c.signalMode!=='off')for(const s of c.signals){
   const m=(raw.signalMatches||[]).find(m=>m?.signalId===s.id);
   const e=m&&datedProof(pages,m,now),strength=matchStrength(m?.strength);
   if(!e||!clean(m.reason)||!strength)continue;
   const recency=e.age<=90?1:e.age<=180?.9:.75,source=domain(e.url)===host?1:.85;
   signalMatches.push({kind:'signal',signalId:s.id,name:s.name,...e,strength,score:Math.round(strength*recency*source),reason:clean(m.reason,700)});
  }
  if(c.signalMode==='require'&&!signalRule(signalMatches,c))return null;
  const profileMatches=[];
  for(const p of c.profiles){
   const m=(raw.profileMatches||[]).find(m=>m?.profileId===p.id);
   const e=m&&sourceProof(pages,m),strength=matchStrength(m?.strength);
   if(!e||!clean(m.reason)||!strength)continue;
   const extra={};
   if(p.type==='lookalike'){
    const ref=c.references.find(r=>r.id===m.referenceId),evidence=ref?.evidence.find(e=>contains(e.quote,m.referenceQuote));if(!evidence)continue;
    Object.assign(extra,{referenceId:ref.id,referenceName:ref.name,referenceQuote:clean(m.referenceQuote,700),referenceUrl:evidence.url});
   }
   if(p.type==='trigger-led'&&!signalRule(signalMatches,c))continue;
   if(p.type==='opportunity-led'){
    const opportunity=c.opportunities.find(o=>o.id===m.opportunityId),proof=opportunity?.evidence.find(e=>contains(e.quote,m.opportunityQuote));
    if(!proof||!datedProof(pages,m,now))continue;
    Object.assign(extra,{opportunityId:opportunity.id,opportunityTitle:opportunity.title,opportunityQuote:clean(m.opportunityQuote,1000),opportunityUrl:proof.url});
   }
   profileMatches.push({kind:'profile',profileId:p.id,type:p.type,name:p.name,...e,...extra,strength,score:Math.min(90,strength),reason:clean(m.reason,700)});
  }
  if(!profileMatches.length||c.profileMode==='all'&&profileMatches.length!==c.profiles.length)return null;
  return profileScores({company,website,domain:host,location:clean(raw.location.label,180),market:raw.location.market,identity,locationEvidence:location,
   commercialFit:{...commercial,status:'supported',reason:clean(raw.commercialFit.reason,700),buyingIntent:'unconfirmed'},profileMatches,signalMatches,checkedAt:new Date(now).toISOString(),buyingIntent:'unconfirmed'},c);
 }
 function reviewProfiles(candidate,review,c,now){
  if(!candidate||review?.decision!=='pass'||!clean(review.reason)||(review.gaps||[]).length||['identityConfirmed','marketConfirmed','commercialFitConfirmed','exclusionsChecked'].some(k=>review[k]!==true))return null;
  const profiles=new Set(Array.isArray(review.supportedProfileIds)?review.supportedProfileIds:[]),signals=new Set(Array.isArray(review.supportedSignalIds)?review.supportedSignalIds:[]);
  const signalMatches=candidate.signalMatches.filter(m=>signals.has(m.signalId)&&matchStrength(m.score));
  const eventsSupported=signalRule(signalMatches,c);
  if(c.signalMode==='require'&&!eventsSupported)return null;
  const profileMatches=candidate.profileMatches.filter(m=>profiles.has(m.profileId)&&matchStrength(m.score)&&(m.type!=='trigger-led'||eventsSupported));
  if(!profileMatches.length||c.profileMode==='all'&&profileMatches.length!==c.profiles.length)return null;
  const result=profileScores({...candidate,profileMatches,signalMatches},c);
  return {...result,quality:{version:PROFILE_VERSION,status:'reviewed',reason:clean(review.reason,1000),checkedAt:new Date(now).toISOString(),checks:['identity','market','selected_profiles','commercial_fit','exclusions',...(c.signalMode==='off'?[]:['selected_buying_signals'])],sourceCount:new Set([result.identity.url,result.locationEvidence.url,result.commercialFit.url,...result.matches.map(m=>m.url)]).size}};
 }
 function criteriaSummary(c){return c.qualityVersion===PROFILE_VERSION?'Profiles ('+c.profileMode+'): '+c.profiles.map(p=>p.name).join(', ')+' · Buying signals: '+({off:'Profiles only',boost:'Prioritize',require:'Require'})[c.signalMode]+(c.signals.length?' ('+c.mode+'): '+c.signals.map(s=>s.name).join(', '):''):c.signals.map(s=>s.name).join(', ')+' · Match '+c.mode;}
 function mergeResult(previous,current,config){
  if(!current)return previous||null;if(!previous||previous.domain!==current.domain)return current;
  const byId=new Map();for(const m of [...previous.matches,...current.matches])if(config.signals.some(s=>s.id===m.signalId)&&(!byId.has(m.signalId)||byId.get(m.signalId).score<m.score))byId.set(m.signalId,m);
  const matches=[...byId.values()],total=config.signals.reduce((n,s)=>n+config.weights[s.id],0);
  return {...current,matches,score:Math.round(matches.reduce((n,m)=>n+m.score*config.weights[m.signalId],0)/total)};
 }
 function ranked(rows){const unique=new Map();for(const r of rows)if(!unique.has(r.domain)||unique.get(r.domain).score<=r.score)unique.set(r.domain,r);return [...unique.values()].sort((a,b)=>b.score-a.score||b.matches.length-a.matches.length||a.company.localeCompare(b.company));}
 // A saved search is a view of existing research, never a new qualification.
 // Keep its review labels separate from verified signal-list matches.
 function normalizeSearchSnapshot(input={}){
  const fail=message=>{throw Object.assign(Error(message),{status:400});};
  if(!input||typeof input!=='object')fail('Company results are required.');
  if(!Array.isArray(input.rows)||!input.rows.length||input.rows.length>1000)fail('Save between 1 and 1,000 company results.');
  const rows=input.rows.map(r=>{
   if(!r||typeof r!=='object')fail('Invalid company result.');
   const company=clean(r.company,180);if(!company)fail('Each company needs a name.');
   const score=typeof r.score==='number'&&Number.isFinite(r.score)&&r.score>=0&&r.score<=100?r.score:null;
   const scoreState=score===null?'pending':r.scoreState==='current'?'current':'previous';
   return {company,website:url(r.website),location:clean(r.location,300),score,scoreState,
    reviewStatus:r.reviewStatus==='Checked'&&scoreState==='current'?'Checked':'Needs review',
    signals:(Array.isArray(r.signals)?r.signals:[]).map(s=>clean(s,160)).filter(Boolean).slice(0,30),
    summary:clean(r.summary,2000),checkedAt:clean(r.checkedAt,80),
    evidence:(Array.isArray(r.evidence)?r.evidence:[]).filter(e=>e&&url(e.url)).slice(0,60).map(e=>({url:url(e.url),quote:clean(e.quote,2000),date:clean(e.date,80)}))};
  });
  return {version:1,rows,context:{markets:(Array.isArray(input.context?.markets)?input.context.markets:[]).map(s=>clean(s,120)).slice(0,30),signals:(Array.isArray(input.context?.signals)?input.context.signals:[]).map(s=>clean(s,160)).slice(0,30),sellerWebsite:url(input.context?.sellerWebsite)}};
 }
 function searchSnapshot(view,context){return normalizeSearchSnapshot({context,rows:view.rows.map(row=>{
  const c=row.candidate,q=row.qualification||{},evidence=[c.sourceEvidence,c.evidence,c.buyerFit?.evidence,c.operatingEvidence].flatMap(value=>Array.isArray(value)?value:value&&typeof value==='object'?[value]:[]).filter(e=>e&&typeof e==='object');
  return {company:c.company||c.companyName,website:c.website||('https://'+(c.domain||'')),location:c.location||c.country||c.market||'',score:row.score,scoreState:row.scoreState,reviewStatus:row.actionable?'Checked':'Needs review',signals:(Array.isArray(q.matchedSignals)?q.matchedSignals:Array.isArray(c.matchedSignals)?c.matchedSignals:[]).map(s=>typeof s==='string'?s:s.name||s.label||s.id),summary:c.description||c.summary||c.reason||'',checkedAt:c.qualification?.researchedAt||c.researchedAt||'',evidence:evidence.map(e=>({url:e.url||e.sourceUrl,quote:e.quote||e.description||e.text||e.title,date:e.date||e.publishedAt}))};
 })});}
 function exportRows(list){
  if(list.criteria.qualityVersion===PROFILE_VERSION){
   const c=list.criteria,rows=exportRows({...list,criteria:{...c,qualityVersion:QUALITY_VERSION}});
   rows[0][4]='Profiles and buying signals';rows[0].push('Profile fit','Buying-signal priority','Matched profiles','Matched buying signals','Profile matching','Buying signal effect','Opportunity evidence');
   for(let i=0;i<list.results.length;i++){const r=list.results[i],row=rows[i+1];row[10]=JSON.stringify({profiles:c.profiles.map(p=>({id:p.id,name:p.name})),profileMode:c.profileMode,signalMode:c.signalMode,signals:c.signals.map(s=>({id:s.id,name:s.name})),signalMatch:c.mode,weights:c.weights,markets:c.markets,references:c.references.map(r=>r.name)});row.push(r.fitScore??'',r.signalScore??'',(r.profileMatches||[]).map(m=>m.name).join('; '),(r.signalMatches||[]).map(m=>m.name).join('; '),c.profileMode,c.signalMode,(r.profileMatches||[]).filter(m=>m.opportunityId).map(m=>[m.opportunityTitle,m.opportunityQuote,m.opportunityUrl].join(' | ')).join('\n'));}
   return rows;
  }
  if(list.criteria.kind==='search_snapshot')return [['Company','Website','Location','Company fit score','Score status','Review status','Matched signals','Summary','Sources','Evidence','Checked at','Buying intent','List','Search context'],...(list.results||[]).map(r=>[r.company,r.website,r.location,r.score??'',r.scoreState==='current'?'Current':r.scoreState==='previous'?'Previous · needs review':'Awaiting score',r.reviewStatus,r.signals.join('; '),r.summary,[...new Set(r.evidence.map(e=>e.url))].join('; '),r.evidence.map(e=>[e.quote,e.url,e.date].filter(Boolean).join(' | ')).join('\n'),r.checkedAt,'Unconfirmed',list.name,JSON.stringify(list.criteria.context)])];return [['Company','Website','Location','Relevance score','Signals','Why it matches','Sources','Checked at','Buying intent','List','Criteria','Evidence review','Candidate evidence','Reference evidence','Commercial fit'],...(list.results||[]).map(r=>[r.company,r.website,r.location,r.score,r.matches.map(m=>m.name).join('; '),r.matches.map(m=>m.reason).join('; '),[...new Set([r.identity.url,r.locationEvidence.url,...r.matches.map(m=>m.url)])].join('; '),r.checkedAt,'Unconfirmed',list.name,JSON.stringify({signals:list.criteria.signals.map(s=>s.name),mode:list.criteria.mode,markets:list.criteria.markets,references:list.criteria.references.map(r=>r.name)}),r.quality?.status==='reviewed'?r.quality.reason:'Earlier evidence policy; separate review not recorded',[r.identity,r.locationEvidence,...r.matches].map(e=>e.quote+' | '+e.url).join('\n'),r.matches.filter(m=>m.referenceQuote).map(m=>m.referenceName+': '+m.referenceQuote+' | '+(m.referenceUrl||'')).join('\n'),r.commercialFit?[r.commercialFit.reason,r.commercialFit.quote,r.commercialFit.url].join(' | '):''])];}
 const safeCell=v=>/^[\s]*[=+@-]/.test(String(v))?"'"+v:String(v??'');
 const csv=list=>'\uFEFF'+exportRows(list).map(row=>row.map(v=>'"'+safeCell(v).replace(/"/g,'""')+'"').join(',')).join('\r\n');
 function xlsx(list){
  const xml=v=>String(v??'').replace(/[<>&"']/g,c=>({'<':'&lt;','>':'&gt;','&':'&amp;','"':'&quot;',"'":'&apos;'}[c])).replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g,'');
  const sheet='<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData>'+exportRows(list).map((row,i)=>'<row r="'+(i+1)+'">'+row.map((v,j)=>'<c r="'+String.fromCharCode(65+j)+(i+1)+'" t="inlineStr"><is><t xml:space="preserve">'+xml(v)+'</t></is></c>').join('')+'</row>').join('')+'</sheetData></worksheet>';
  const files={'[Content_Types].xml':'<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/></Types>','_rels/.rels':'<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>','xl/workbook.xml':'<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="Companies" sheetId="1" r:id="rId1"/></sheets></workbook>','xl/_rels/workbook.xml.rels':'<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/></Relationships>','xl/worksheets/sheet1.xml':sheet};
  const enc=new TextEncoder(),chunks=[],central=[];let offset=0;
  const crc=bytes=>{let c=0xffffffff;for(const b of bytes){c^=b;for(let k=0;k<8;k++)c=(c>>>1)^((c&1)?0xedb88320:0);}return (c^0xffffffff)>>>0;};
  for(const [name,text] of Object.entries(files)){const n=enc.encode(name),b=enc.encode(text),checksum=crc(b),h=new Uint8Array(30+n.length),d=new DataView(h.buffer);d.setUint32(0,0x04034b50,true);d.setUint16(4,20,true);d.setUint32(14,checksum,true);d.setUint32(18,b.length,true);d.setUint32(22,b.length,true);d.setUint16(26,n.length,true);h.set(n,30);chunks.push(h,b);const c=new Uint8Array(46+n.length),v=new DataView(c.buffer);v.setUint32(0,0x02014b50,true);v.setUint16(4,20,true);v.setUint16(6,20,true);v.setUint32(16,checksum,true);v.setUint32(20,b.length,true);v.setUint32(24,b.length,true);v.setUint16(28,n.length,true);v.setUint32(42,offset,true);c.set(n,46);central.push(c);offset+=h.length+b.length;}
  const size=central.reduce((n,c)=>n+c.length,0),end=new Uint8Array(22),v=new DataView(end.buffer);v.setUint32(0,0x06054b50,true);v.setUint16(8,central.length,true);v.setUint16(10,central.length,true);v.setUint32(12,size,true);v.setUint32(16,offset,true);chunks.push(...central,end);const result=new Uint8Array(offset+size+22);let i=0;for(const c of chunks){result.set(c,i);i+=c.length;}return result;
 }
 return {QUALITY_VERSION,PROFILE_VERSION,recommendedBudget,options,configuration,assess,reviewResult,criteriaSummary,mergeResult,ranked,searchSnapshot,normalizeSearchSnapshot,exportRows,csv,xlsx,safeCell,url,domain};
});
