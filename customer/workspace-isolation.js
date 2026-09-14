(function(root,factory){
  const api=factory();
  if(typeof module!=="undefined"&&module.exports)module.exports=api;
  if(root)root.LeadIntelWorkspaceIsolation=api;
})(typeof globalThis!=="undefined"?globalThis:this,function(){
  "use strict";

  const MAIN_KEY="leadintel_customer_v2_state";
  const DISCOVERY_KEY="leadintel_customer_v2_discovery";
  const OUTREACH_KEY="leadintel_customer_v2_outreach";
  const DELIVERY_KEY="leadintel_customer_v2_delivery";
  const DISCOVERY_META_KEY="leadintel_customer_v2_discovery_meta";
  const RESEARCH_META_KEY="leadintel_customer_v2_research_meta_v1";
  const MARKET_RESEARCH_RESUME_KEY="leadintel_customer_v2_market_research_resume";
  const DIRTY_KEY="leadintel_customer_v2_server_dirty";
  const DERIVED_KEYS=Object.freeze([
    DISCOVERY_KEY,OUTREACH_KEY,DELIVERY_KEY,DISCOVERY_META_KEY,
    RESEARCH_META_KEY,MARKET_RESEARCH_RESUME_KEY,DIRTY_KEY
  ]);

  function clean(value){return String(value??"").replace(/\s+/g," ").trim();}
  function normalizeUrl(value){
    const raw=clean(value);if(!raw)return "";
    try{
      const url=new URL(/^https?:\/\//i.test(raw)?raw:`https://${raw}`);
      if(!["http:","https:"].includes(url.protocol)||!url.hostname.includes("."))return "";
      url.hash="";return url.href;
    }catch{return "";}
  }
  function canonicalDomain(value){
    const normalized=normalizeUrl(value);if(!normalized)return "";
    try{return new URL(normalized).hostname.replace(/^www\./i,"").replace(/\.+$/g,"").toLowerCase();}catch{return "";}
  }
  function parse(value,fallback={}){
    try{
      const parsed=typeof value==="string"?JSON.parse(value||"null"):value;
      return parsed&&typeof parsed==="object"&&!Array.isArray(parsed)?parsed:fallback;
    }catch{return fallback;}
  }
  function read(storage,key){return parse(storage?.getItem(key)||"",{});}
  function websiteFromMain(main={}){
    return canonicalDomain(main.website||main.companyContextWebsite||main.profile?.website||"");
  }
  function websiteFromMeta(meta={}){
    const direct=canonicalDomain(meta.website||meta.sourceWebsite||"");if(direct)return direct;
    const fingerprint=parse(meta.fingerprint,null);
    return canonicalDomain(fingerprint?.website||"");
  }
  function hasMeaningfulDerivedData(storage){
    const discovery=read(storage,DISCOVERY_KEY);
    const outreach=read(storage,OUTREACH_KEY);
    const delivery=read(storage,DELIVERY_KEY);
    const meta=read(storage,DISCOVERY_META_KEY);
    const research=read(storage,RESEARCH_META_KEY);
    const hasArray=(value,key)=>Array.isArray(value?.[key])&&value[key].length>0;
    if([
      [discovery,"pipeline"],[discovery,"candidates"],[discovery,"rawResults"],[discovery,"queries"],
      [outreach,"items"],[outreach,"activities"],[delivery,"items"],[delivery,"events"]
    ].some(([value,key])=>hasArray(value,key)))return true;
    if(clean(outreach.selectedDomain))return true;
    if(Object.keys(meta).some(key=>!['fingerprint','visibleStep','website','sourceWebsite'].includes(key)))return true;
    if(Object.keys(research).length>0)return true;
    return false;
  }
  function clearDerivedWorkspaceData(storage){
    if(!storage)return 0;
    let removed=0;
    for(const key of DERIVED_KEYS){
      if(storage.getItem(key)!==null){storage.removeItem(key);removed++;}
    }
    return removed;
  }
  function reconcileLocalWorkspace(storage,main={}){
    const current=websiteFromMain(main);
    if(!current)return {cleared:false,reason:"no-current-website",website:"",previousWebsite:"",removedKeys:0};
    const meta=read(storage,DISCOVERY_META_KEY);
    const previous=websiteFromMeta(meta);
    const hasData=hasMeaningfulDerivedData(storage);
    const changed=Boolean(hasData&&previous&&previous!==current);
    const legacy=Boolean(hasData&&!previous);
    if(!changed&&!legacy)return {cleared:false,reason:"same-website",website:current,previousWebsite:previous,removedKeys:0};
    const removedKeys=clearDerivedWorkspaceData(storage);
    return {cleared:removedKeys>0,reason:changed?"website-changed":"legacy-unscoped",website:current,previousWebsite:previous,removedKeys};
  }
  function normalizedStep(value){
    const step=Number(value);return [1,2,3,4,5,6,7].includes(step)?step:1;
  }
  function safeStep(storage,main={},requested=1){
    const target=normalizedStep(requested);
    const website=websiteFromMain(main);
    const markets=Array.isArray(main.targetMarkets)?main.targetMarkets.filter(Boolean):[];
    if(!website||!markets.length)return 1;
    if(!main.profile)return Math.min(target,2);
    if(!main.approved)return Math.min(target,3);
    if(!main.market?.strategyApproved)return Math.min(target,4);
    if(target<=5)return target;
    const discovery=read(storage,DISCOVERY_KEY);
    const hasPipeline=Array.isArray(discovery.pipeline)&&discovery.pipeline.length>0;
    if(!hasPipeline)return 5;
    if(target===6)return 6;
    const outreach=read(storage,OUTREACH_KEY);
    const hasOutreach=Array.isArray(outreach.items)&&outreach.items.some(item=>item&&(
      item.approved||item.dossier||item.email||item.linkedin||item.callOpener||item.followUp
    ));
    return hasOutreach?7:6;
  }
  return {
    MAIN_KEY,DISCOVERY_KEY,OUTREACH_KEY,DELIVERY_KEY,DISCOVERY_META_KEY,
    RESEARCH_META_KEY,MARKET_RESEARCH_RESUME_KEY,DIRTY_KEY,DERIVED_KEYS,
    clean,normalizeUrl,canonicalDomain,websiteFromMain,websiteFromMeta,
    hasMeaningfulDerivedData,clearDerivedWorkspaceData,reconcileLocalWorkspace,safeStep
  };
});
