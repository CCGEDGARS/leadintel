(function(root,factory){
  const api=factory();
  if(typeof module!=="undefined"&&module.exports)module.exports=api;
  if(root)root.LeadIntelCompanyBrain=api;
})(typeof globalThis!=="undefined"?globalThis:this,function(){
  "use strict";

  const clean=value=>String(value??"").replace(/\s+/g," ").trim();
  const unique=items=>[...new Set((items||[]).filter(Boolean))];
  const allText=input=>clean([
    input?.profile?.companyName,input?.profile?.companyOverview,input?.profile?.priorityOffers,
    input?.profile?.idealCustomer,input?.profile?.differentiation,input?.profile?.buyingOutcomes,
    input?.answers?.priority_offers,input?.answers?.ideal_customer,input?.answers?.differentiation,input?.answers?.buying_triggers,
    ...(input?.scrapedSources||[]).map(item=>item?.text),...(input?.documents||[]).map(item=>item?.text)
  ].join(" "));

  function claim(value,status="inferred",confidence="medium",evidenceIds=[]){
    return {value:clean(value),status:["confirmed","inferred","unknown"].includes(status)?status:"inferred",confidence:["high","medium","low"].includes(confidence)?confidence:"medium",evidenceIds:unique(evidenceIds.map(clean))};
  }

  const OFFER_CATEGORIES=[
    ["sales-training",/\b(sales training|sales coach|sales coaching|sales methodology|pārdošanas apmāc|pārdošanas trener|pārdošanas kouč)/i],
    ["coaching",/\b(coaching|business coach|business coaching|koučing|koučs|mentor(?:ing)?|mentoring|mentorings)\b/i],
    ["leadership-development",/\b(leadership|vadīb(?:a|as)|manager training|vadītāju apmāc)/i],
    ["ai-consulting",/\b(ai integration|artificial intelligence|mākslīg\w* intelekt|ai tools|ai for business|ai risin)/i],
    ["marketing",/\b(digital marketing|content creation|marketing|mārketing|satura veido)/i],
    ["software",/\b(software|saas|platform|application|app development|programmatūr)/i],
    ["manufacturing",/\b(manufactur|factory|production line|ražošan|rūpnīc)/i],
    ["warehouse-equipment",/\b(warehouse (?:equipment|storage|racking)|noliktav(?:u|as)? (?:aprīkoj|plaukt|sistēm)|workshop (?:equipment|storage)|darbnīc(?:u|as)? (?:aprīkoj|skap|sistēm)|tool cabinet|instrumentu skapis)\b/i],
    ["distribution",/\b(distribut(?:or|ion)|wholesale|vairumtirdzniec|izplatītāj)/i]
  ];

  function detectOfferCategories(text){return OFFER_CATEGORIES.filter(([,re])=>re.test(text)).map(([id])=>id);}

  function classifyCompany(input={}){
    const text=allText(input);
    const offerCategories=detectOfferCategories(text);
    let businessType="other";
    const professionalCount=["sales-training","coaching","leadership-development","ai-consulting","marketing"].filter(id=>offerCategories.includes(id)).length;
    if(professionalCount>=1&&/\b(training|coaching|consult|mentor|apmāc|kouč|konsult|mārketing|marketing)\b/i.test(text))businessType="professional-services";
    else if(offerCategories.includes("software"))businessType="software";
    else if(offerCategories.includes("manufacturing"))businessType="manufacturer";
    else if(offerCategories.includes("distribution"))businessType="distributor";
    const likelyBuyerFunctions=[];
    if(businessType==="professional-services")likelyBuyerFunctions.push("CEO/Owner","Sales/Commercial Leadership","HR/L&D","Team Leadership");
    if(businessType==="software")likelyBuyerFunctions.push("CEO/Owner","Operations","IT/Digital","Commercial Leadership");
    if(businessType==="manufacturer"||businessType==="distributor")likelyBuyerFunctions.push("Procurement","Operations","Production","CEO/Owner");
    const evidence=(input.scrapedSources||[]).filter(item=>clean(item?.text)).slice(0,5).map((item,index)=>({id:clean(item.id)||`E${index+1}`,url:clean(item.url),title:clean(item.title)}));
    const industries=[];
    if(offerCategories.includes("sales-training"))industries.push("sales enablement");
    if(offerCategories.includes("coaching")||offerCategories.includes("leadership-development"))industries.push("leadership and coaching");
    if(offerCategories.includes("ai-consulting"))industries.push("AI/business transformation");
    return {businessType,industries:unique(industries),offerCategories,likelyBuyerFunctions:unique(likelyBuyerFunctions),evidence,confidence:businessType==="other"?"low":offerCategories.length>=2?"high":"medium"};
  }

  function derivePainPoints(profile={},input={},language="en"){
    const classification=input.companyClassification||profile.companyClassification||classifyCompany({...input,profile});
    const text=allText({...input,profile});
    const lv=String(language).toLowerCase().startsWith("lv");
    const pains=[];const add=(en,latvian)=>{const value=lv?latvian:en;if(value&&!pains.includes(value))pains.push(value);};

    if(classification.businessType==="professional-services"){
      if(classification.offerCategories.includes("sales-training")||/\bsales|pārdošan/i.test(text))add(
        "Inconsistent sales skills and execution can reduce conversion, create uneven customer experiences and make results depend too heavily on individual performers.",
        "Nevienmērīgas pārdošanas prasmes un izpilde var samazināt konversiju, radīt nekonsekventu klientu pieredzi un padarīt rezultātus pārāk atkarīgus no atsevišķiem pārdevējiem."
      );
      if(classification.offerCategories.includes("leadership-development")||classification.offerCategories.includes("coaching"))add(
        "Managers may lack a consistent coaching and leadership system for developing people, accountability and performance.",
        "Vadītājiem var trūkt vienotas koučinga un līderības sistēmas cilvēku attīstīšanai, atbildībai un snieguma vadībai."
      );
      if(classification.offerCategories.includes("ai-consulting"))add(
        "Commercial teams can lose time and opportunities when AI is not integrated into prospecting, analysis, content and sales workflows.",
        "Komercdarba komandas var zaudēt laiku un iespējas, ja AI nav integrēts prospektēšanā, analīzē, satura veidošanā un pārdošanas procesos."
      );
      if(/process|system|methodolog|workflow|process|sistēm|metod|proces/i.test(text))add(
        "Sales and business processes can remain fragmented when teams lack one practical methodology and a repeatable implementation system.",
        "Pārdošanas un biznesa procesi var palikt sadrumstaloti, ja komandai nav vienotas praktiskas metodoloģijas un atkārtojamas ieviešanas sistēmas."
      );
    }

    const explicitWarehouse=/\b(warehouse (?:equipment|storage|racking)|warehouse operations|noliktav(?:u|as)? (?:aprīkoj|plaukt|sistēm|darbs)|workshop (?:equipment|storage|operations)|darbnīc(?:u|as)? (?:aprīkoj|skap|sistēm|darbs)|tool cabinet|instrumentu skapis)\b/i;
    if(classification.offerCategories.includes("warehouse-equipment")&&explicitWarehouse.test(text))add(
      "Disorganised storage of tools, materials and goods can waste space, extend retrieval time and increase mistakes or safety risk.",
      "Nesakārtota instrumentu, materiālu un preču uzglabāšana var aizņemt lieku platību, paildzināt meklēšanu un palielināt kļūdu vai darba drošības risku."
    );

    if(!pains.length)add(
      "The specific customer problem is not yet sufficiently evidenced; LeadIntel should ask for confirmation before treating a pain point as fact.",
      "Konkrētā klienta problēma vēl nav pietiekami pamatota; LeadIntel jāprasa apstiprinājums, pirms to uzskatīt par faktu."
    );
    return pains.slice(0,5);
  }

  const SIGNALS={
    "sales-leadership-change":{id:"sales-leadership-change",name:"New Sales or Commercial Director",priority:"High"},
    "sales-team-hiring":{id:"sales-team-hiring",name:"Sales team hiring or expansion",priority:"High"},
    "sales-transformation":{id:"sales-transformation",name:"Sales transformation or restructuring",priority:"High"},
    "ai-sales-tech":{id:"ai-sales-tech",name:"AI, CRM or sales-tech transformation",priority:"High"},
    "market-entry":{id:"market-entry",name:"New market or export expansion",priority:"High"},
    "product-launch":{id:"product-launch",name:"Product or service launch",priority:"Medium"},
    "leadership-development":{id:"leadership-development",name:"Leadership development initiative",priority:"Medium"},
    "merger-integration":{id:"merger-integration",name:"Merger or acquisition integration",priority:"Medium"},
    "facility-expansion":{id:"facility-expansion",name:"Facility expansion or new site",priority:"High"},
    "capital-investment":{id:"capital-investment",name:"Capital investment or modernization",priority:"High"},
    tender:{id:"tender",name:"Tender or procurement activity",priority:"High"}
  };

  function recommendSignals(input={}){
    const classification=input.companyClassification||input.profile?.companyClassification||classifyCompany(input);
    const text=allText(input);
    const triggerText=clean(input?.answers?.buying_triggers||input?.profile?.buyingTriggers);
    const ids=[];const add=id=>{if(SIGNALS[id]&&!ids.includes(id))ids.push(id);};
    if(classification.businessType==="professional-services"){
      add("sales-leadership-change");add("sales-team-hiring");add("sales-transformation");
      if(classification.offerCategories.includes("ai-consulting")||/\b(ai|crm|sales tech|automation|automatiz)/i.test(text))add("ai-sales-tech");
      if(/leadership|coaching|vadītāj|kouč/i.test(text))add("leadership-development");
      if(/new market|market entry|export|international expansion|jaun\w* tirg|eksport/i.test(triggerText))add("market-entry");
      if(/launch|new product|new service|jaun\w* produkt|jaun\w* pakalpoj/i.test(triggerText))add("product-launch");
      if(/merger|acquisition|m&a|apvienošan|iegāde/i.test(triggerText))add("merger-integration");
    }else{
      if(/facility|factory|new site|capacity expansion|rūpnīc|ražotn|jaun\w* viet/i.test(triggerText))add("facility-expansion");
      if(/capex|moderni[sz]ation|equipment investment|capital investment|moderniz|iekārtu iegād/i.test(triggerText))add("capital-investment");
      if(/new market|market entry|export|international expansion|jaun\w* tirg|eksport/i.test(triggerText))add("market-entry");
    }
    if(/\b(tender|procurement|rfp|request for proposal|iepirkum|konkurs)\b/i.test(triggerText))add("tender");
    return ids.map(id=>({...SIGNALS[id],reason:signalReason(id,classification,triggerText)}));
  }

  function signalReason(id,classification,triggerText){
    if(id==="tender")return "Explicit procurement/tender trigger was supplied or evidenced.";
    if(triggerText&&new RegExp(id==="market-entry"?"market|export":id==="product-launch"?"launch|product|service":"$a","i").test(triggerText))return "Matches an explicit buying trigger supplied for this workspace.";
    if(classification.businessType==="professional-services")return "Recommended because this event commonly creates demand for the company's sales, leadership, coaching or AI-enabled commercial services.";
    return "Recommended because the event matches the company's classified business model and supplied buying-trigger context.";
  }

  return {claim,classifyCompany,derivePainPoints,recommendSignals};
});
