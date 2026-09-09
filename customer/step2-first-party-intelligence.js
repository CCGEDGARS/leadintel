(function(root,factory){
  const api=factory();
  if(typeof module!=="undefined"&&module.exports)module.exports=api;
  if(root){root.LeadIntelStep2FirstPartyIntelligence=api;if(root.document)api.install(root);}
})(typeof globalThis!=="undefined"?globalThis:this,function(){
  "use strict";

  const clean=value=>String(value??"").replace(/\s+/g," ").trim();
  const unique=list=>[...new Set((list||[]).map(clean).filter(Boolean))];
  const OFFER_LABELS={
    "sales-training":"Sales training",
    coaching:"Sales and business coaching",
    "leadership-development":"Leadership development",
    "ai-consulting":"AI for business / AI consulting",
    marketing:"Marketing services",
    software:"Software / platform solutions",
    manufacturing:"Manufacturing solutions",
    "warehouse-equipment":"Warehouse and workshop equipment",
    distribution:"Distribution / wholesale"
  };
  const OFFER_LABELS_LV={
    "sales-training":"Pārdošanas apmācības",
    coaching:"Pārdošanas un biznesa koučings",
    "leadership-development":"Vadītāju attīstība",
    "ai-consulting":"AI biznesam / AI konsultācijas",
    marketing:"Mārketinga pakalpojumi",
    software:"Programmatūras / platformu risinājumi",
    manufacturing:"Ražošanas risinājumi",
    "warehouse-equipment":"Noliktavu un darbnīcu aprīkojums",
    distribution:"Izplatīšana / vairumtirdzniecība"
  };

  function blank(){return {value:"",confidence:"",sourceIds:[],rationale:"Customer input recommended."};}
  function inferred(value,sourceIds,confidence="medium",rationale="Inferred from first-party website evidence; review before confirming."){
    return clean(value)?{value:clean(value),confidence,sourceIds:unique(sourceIds),rationale}:blank();
  }
  function firstPartySourceIds(sources=[]){return unique((sources||[]).filter(source=>clean(source?.text)).slice(0,5).map((source,index)=>clean(source?.id)||`S${index+1}`));}
  function isUnsupportedPain(value){return /not yet sufficiently evidenced|jāprasa apstiprinājums|vēl nav pietiekami pamatota/i.test(clean(value));}
  function idealCustomerFor(classification={},lv=false){
    if(classification.businessType==="professional-services")return lv
      ?"B2B uzņēmumi ar aktīvu pārdošanas vai vadības komandu, kuri vēlas uzlabot pārdošanas rezultātus, vadītāju spējas vai komerciālo izpildi."
      :"B2B companies with active sales, commercial or leadership teams seeking stronger sales performance, manager capability or commercial execution.";
    if(classification.businessType==="software")return lv
      ?"B2B organizācijas ar komerciālām, operāciju vai digitālajām komandām, kurām nepieciešams efektīvāks tehnoloģiju atbalstīts darba process."
      :"B2B organizations with commercial, operations or digital teams that need a more effective technology-supported workflow.";
    if(classification.businessType==="manufacturer"||classification.businessType==="distributor")return lv
      ?"B2B uzņēmumi ar iepirkumu, operāciju vai ražošanas funkcijām, kuriem ir skaidra vajadzība pēc uzņēmuma piedāvātajiem risinājumiem."
      :"B2B companies with procurement, operations or production functions and a clear need for the company's solutions.";
    return "";
  }

  function buildFirstPartyDraft(args={},brain=null){
    const sources=(args.sources||[]).filter(source=>clean(source?.text));
    if(!sources.length||!brain?.classifyCompany)return {};
    const lv=clean(args.uiLanguage).toLowerCase().startsWith("lv");
    const input={scrapedSources:sources,documents:args.documents||[],answers:{},profile:{}};
    const classification=brain.classifyCompany(input)||{};
    const sourceIds=firstPartySourceIds(sources);
    const labels=lv?OFFER_LABELS_LV:OFFER_LABELS;
    const offers=unique((classification.offerCategories||[]).map(id=>labels[id]).filter(Boolean)).slice(0,3).join("; ");
    const ideal=idealCustomerFor(classification,lv);
    const pains=typeof brain.derivePainPoints==="function"
      ?brain.derivePainPoints({}, {...input,companyClassification:classification}, lv?"lv":"en").filter(value=>!isUnsupportedPain(value)).slice(0,3)
      :[];
    const roles=unique(classification.likelyBuyerFunctions||[]).slice(0,4).join("; ");
    return {
      priority_offers:inferred(offers,sourceIds,classification.confidence==="high"?"medium":"low"),
      ideal_customer:inferred(ideal,sourceIds,"medium"),
      buyer_roles:inferred(roles,sourceIds,"medium"),
      buying_outcomes:inferred(pains.join(" "),sourceIds,"medium")
    };
  }

  function patchResearchEngine(engine,root=null){
    if(!engine||engine.__step2FirstPartyIntelligencePatched)return engine;
    const original=engine.buildEvidenceDraft;
    if(typeof original!=="function")return engine;
    engine.buildEvidenceDraft=function(args={}){
      const base=original.call(engine,args)||{};
      const inferredDraft=buildFirstPartyDraft(args,root?.LeadIntelCompanyBrain||root?.brain||null);
      const choose=(existing,suggestion)=>clean(existing?.value)?existing:(clean(suggestion?.value)?suggestion:(existing||blank()));
      return {
        ...base,
        priority_offers:choose(base.priority_offers,inferredDraft.priority_offers),
        ideal_customer:choose(base.ideal_customer,inferredDraft.ideal_customer),
        buyer_roles:choose(base.buyer_roles,inferredDraft.buyer_roles),
        buying_outcomes:choose(base.buying_outcomes,inferredDraft.buying_outcomes),
        buying_triggers:base.buying_triggers||blank(),
        exclusions:base.exclusions||blank(),
        opportunity_value:base.opportunity_value||blank(),
        success_outcome:base.success_outcome||blank()
      };
    };
    engine.__step2FirstPartyIntelligencePatched=true;
    return engine;
  }

  function install(root,attempt=0){
    const engine=root?.LeadIntelCompanyResearch;const brain=root?.LeadIntelCompanyBrain;
    if(engine&&brain&&engine.__step2ReadinessPatched){patchResearchEngine(engine,root);return true;}
    if(attempt<80)setTimeout(()=>install(root,attempt+1),50);
    return false;
  }

  return {buildFirstPartyDraft,patchResearchEngine,install};
});
