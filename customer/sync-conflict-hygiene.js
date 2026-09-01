(function(root){
  "use strict";

  const DIRTY_KEY="leadintel_customer_v2_server_dirty";
  const CONFLICT_KEY="leadintel_customer_v2_server_conflict";
  const KEYS={
    main:"leadintel_customer_v2_state",
    discovery:"leadintel_customer_v2_discovery",
    outreach:"leadintel_customer_v2_outreach",
    delivery:"leadintel_customer_v2_delivery"
  };

  function parse(key){try{return JSON.parse(root.localStorage?.getItem(key)||"{}");}catch{return {};}}
  function hasItems(value){return Array.isArray(value)&&value.length>0;}
  function hasText(value){return Boolean(String(value??"").trim());}
  function hasAnswers(value){return value&&typeof value==="object"&&Object.values(value).some(hasText);}
  function hasMarketData(value){
    if(!value||typeof value!=="object")return false;
    return hasItems(value.icps)||hasItems(value.signals)||hasItems(value.researchQueries)||hasItems(value.researchResults)||hasItems(value.opportunities)||hasText(value.lastResearchAt)||value.strategyApproved===true||hasText(value.strategyApprovedAt);
  }
  function hasMainData(main){
    if(!main||typeof main!=="object")return false;
    return hasText(main.website)||hasItems(main.targetMarkets)||hasItems(main.additionalLinks)||hasItems(main.documents)||hasItems(main.scrapedSources)||hasAnswers(main.answers)||Boolean(main.profile)||main.approved===true||Number(main.step)>1||hasMarketData(main.market);
  }
  function hasModuleData(value){return value&&typeof value==="object"&&Object.keys(value).length>0;}
  function hasMeaningfulWorkspaceData(){
    return hasMainData(parse(KEYS.main))||hasModuleData(parse(KEYS.discovery))||hasModuleData(parse(KEYS.outreach))||hasModuleData(parse(KEYS.delivery));
  }
  function clearStaleBlankConflict(){
    if(!root.localStorage?.getItem(DIRTY_KEY))return false;
    if(hasMeaningfulWorkspaceData())return false;
    root.localStorage.removeItem(DIRTY_KEY);
    try{root.sessionStorage?.removeItem(CONFLICT_KEY);}catch{}
    return true;
  }

  const api={DIRTY_KEY,CONFLICT_KEY,KEYS,hasMeaningfulWorkspaceData,clearStaleBlankConflict};
  root.LeadIntelSyncConflictHygiene=api;
  clearStaleBlankConflict();
})(typeof globalThis!=="undefined"?globalThis:this);
