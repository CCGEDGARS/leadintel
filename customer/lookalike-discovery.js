(function(root,factory){
  const api=factory(root);
  if(typeof module!=="undefined"&&module.exports)module.exports=api;
  if(root?.LeadIntelDiscovery)api.install(root.LeadIntelDiscovery);
})(typeof globalThis!=="undefined"?globalThis:this,function(root){
  "use strict";
  const clean=v=>String(v??'').replace(/\s+/g,' ').trim();
  const split=v=>Array.isArray(v)?v.map(clean).filter(Boolean):String(v||'').split(/\n|;|,|\|/).map(clean).filter(Boolean);
  const slug=v=>clean(v).toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'')||'market';
  const STOP=new Set(['company','companies','business','businesses','customer','customers','industrial','market','markets','with','from','that','this']);
  function words(v){return clean(v).toLowerCase().replace(/[^a-z0-9āčēģīķļņšūžäöåüß\s-]/g,' ').split(/\s+/).filter(x=>x.length>=3&&!STOP.has(x));}
  function haystack(candidate={}){return clean([candidate.company,candidate.domain,candidate.market,candidate.industry,candidate.sizeBand,candidate.businessModel,candidate.growthStage,candidate.operatingComplexity,candidate.description,...(candidate.evidence||[]).flatMap(e=>[e.title,e.description,e.text])].join(' ')).toLowerCase();}
  function scoreLookalikeMatch(candidate={},dna=null){
    if(!dna?.active||!Array.isArray(dna.dimensions)||!dna.dimensions.length)return {active:false,total:0,dimensions:[],reasons:[]};
    const hay=haystack(candidate);const dimensions=[];let earned=0,possible=0;
    for(const dimension of dna.dimensions){
      const values=(dimension.values||[]).map(clean).filter(Boolean);if(!values.length)continue;
      const weight=Math.max(.25,Math.min(3,Number(dimension.weight)||1));possible+=weight;
      const matched=values.filter(value=>{
        const literal=clean(value).toLowerCase();if(literal&&hay.includes(literal))return true;
        const tokens=words(value);return tokens.length&&tokens.filter(t=>hay.includes(t)).length>=Math.min(2,tokens.length);
      });
      if(matched.length)earned+=weight;
      dimensions.push({key:clean(dimension.key),matched:Boolean(matched.length),matchedValues:matched.slice(0,3),weight,confidence:clean(dimension.confidence)||'low'});
    }
    const total=possible?Math.round(100*earned/possible):0;
    const reasons=dimensions.filter(d=>d.matched).map(d=>`${d.key}: ${d.matchedValues.join(', ')}`);
    return {active:true,total,dimensions,reasons};
  }
  function buildLookalikeDiscoveryQueries(profile={},dna=null,maxQueries=4){
    if(!dna?.active)return [];
    const markets=split(profile.targetMarkets);if(!markets.length)return [];
    const traits=(dna.dimensions||[]).flatMap(d=>(d.values||[]).slice(0,2)).map(clean).filter(Boolean).slice(0,8);
    const offer=split(profile.priorityOffers)[0]||'commercial solution';const icp=clean(profile.idealCustomer);
    const limit=Math.max(1,Math.min(12,Number(maxQueries)||4));const out=[];
    for(const market of markets){
      if(out.length>=limit)break;
      out.push({id:`lookalike-${slug(market)}-${out.length+1}`,market,offer,query:[market,traits.join(' '),icp,offer,'company official website'].filter(Boolean).join(' '),lookalike:true});
    }
    return out;
  }
  function isHardExcluded(candidate={},profile={}){
    const exclusions=split(profile.exclusions).map(x=>x.toLowerCase()).filter(Boolean);if(!exclusions.length)return false;
    const hay=haystack(candidate);
    return exclusions.some(rule=>{
      const normalized=rule.replace(/^exclude\s+/,'').trim();if(!normalized)return false;
      if(hay.includes(normalized))return true;
      const tokens=words(normalized);return tokens.length>=1&&tokens.every(token=>hay.includes(token));
    });
  }
  function rankCandidates(candidates=[],profile={},dna=null){
    return (candidates||[]).filter(c=>!isHardExcluded(c,profile)).map(candidate=>{
      const lookalikeMatch=scoreLookalikeMatch(candidate,dna);
      const base=Math.max(0,Math.min(100,Number(candidate?.score?.total)||0));
      const priorityScore=lookalikeMatch.active?Math.round(lookalikeMatch.total*.58+base*.42):base;
      return {...candidate,lookalikeMatch,priorityScore};
    }).sort((a,b)=>b.priorityScore-a.priorityScore||Number(b.score?.total||0)-Number(a.score?.total||0));
  }
  function activeModelFromBrowser(){
    try{
      if(typeof localStorage==='undefined'||!root?.LeadIntelReferenceCustomers)return null;
      const state=JSON.parse(localStorage.getItem('leadintel_customer_v2_state')||'{}');
      return root.LeadIntelReferenceCustomers.getActiveReferenceModel(state.referenceCustomers||{});
    }catch{return null;}
  }
  function install(Discovery){
    if(!Discovery||Discovery.__lookalikeInstalled)return Discovery;
    const originalQueries=Discovery.buildDiscoveryQueries?.bind(Discovery);const originalMerge=Discovery.mergeCompanyCandidates?.bind(Discovery);
    Discovery.scoreLookalikeMatch=scoreLookalikeMatch;Discovery.buildLookalikeDiscoveryQueries=buildLookalikeDiscoveryQueries;Discovery.isHardExcluded=isHardExcluded;Discovery.rankCandidatesWithLookalike=rankCandidates;
    if(originalQueries)Discovery.buildDiscoveryQueries=function(profile={},marketState={},maxQueries=4){
      const model=activeModelFromBrowser();const dna=model?.dna;
      if(!dna?.active)return originalQueries(profile,marketState,maxQueries);
      const look=buildLookalikeDiscoveryQueries(profile,dna,maxQueries);const base=originalQueries(profile,marketState,maxQueries);const seen=new Set(look.map(q=>q.query));return [...look,...base.filter(q=>!seen.has(q.query))].slice(0,Math.max(1,Math.min(12,Number(maxQueries)||4)));
    };
    if(originalMerge)Discovery.mergeCompanyCandidates=function(results=[],profile={},marketState={}){
      const base=originalMerge(results,profile,marketState);const model=activeModelFromBrowser();return rankCandidates(base,profile,model?.dna||null).slice(0,12);
    };
    Discovery.__lookalikeInstalled=true;return Discovery;
  }
  return {install,scoreLookalikeMatch,buildLookalikeDiscoveryQueries,isHardExcluded,rankCandidates};
});
