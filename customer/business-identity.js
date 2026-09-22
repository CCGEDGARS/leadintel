(function(root,factory){
  const api=factory();
  if(typeof module!=="undefined"&&module.exports)module.exports=api;
  if(root){root.LeadIntelBusinessIdentity=api;if(root.document)api.install(root);}
})(typeof globalThis!=="undefined"?globalThis:this,function(){
  "use strict";

  const STORAGE_KEY="leadintel_customer_v2_state";
  let originals=null;
  let installed=false;
  let layoutObserver=null;
  let layoutQueued=false;

  function clean(value){return String(value??"").replace(/\s+/g," ").trim();}
  const NAVIGATION_LABELS=[/\bUZZINĀT\s+VAIRĀK\b/gi,/\b(?:LEARN|READ|VIEW)\s+MORE\b/gi,/\bGET\s+IN\s+TOUCH\b/gi,/\bCONTACT\s+US\b/gi];
  const NAVIGATION_FRAGMENTS=[/\bRealizētie\s+projekti\b/i,/\bUzņēmumi,?\s+kas\s+izvēlas(?:\s+mūsu)?\s+risinājumus\b/i,/\bCase\s+studies\b/i,/\bCompanies\s+that\s+choose\s+us\b/i];
  function stripNavigationNoise(value){
    return String(value??"").replace(new RegExp(NAVIGATION_LABELS.map(pattern=>pattern.source).join("|"),"gi")," ").replace(/\s+/g," ").trim();
  }
  function hasNavigationNoise(value){
    const text=String(value??"");
    return NAVIGATION_LABELS.some(pattern=>{pattern.lastIndex=0;return pattern.test(text);})||NAVIGATION_FRAGMENTS.some(pattern=>pattern.test(text));
  }
  function stripNoise(value){
    return clean(String(value??"")
      .replace(/!\[[^\]]*\]\([^)]+\)/gi," ")
      .replace(/\[([^\]]+)\]\((?:https?:\/\/)[^)]+\)/gi," $1 ")
      .replace(/https?:\/\/\S+/gi," ")
      .replace(/\b\S+\.(?:png|jpe?g|gif|webp|svg)(?:\?\S*)?\b/gi," ")
      .replace(/<[^>]+>/g," ")
      .replace(/[#*_`>|]/g," "))
      .replace(new RegExp(NAVIGATION_LABELS.map(pattern=>pattern.source).join("|"),"gi")," ");
  }
  function neutral(value){
    return stripNoise(value)
      .replace(/\bmy\b/gi,"the company's")
      .replace(/\bI\b/g,"the company")
      .replace(/^\s*we\s+/i,"the company ")
      .replace(/\bour\b/gi,"the company's")
      .replace(/\s+/g," ")
      .trim();
  }
  function phrase(value){return clean(value).replace(/[.!?]+$/,"");}
  function subjectCompany(value){return clean(value)||"Uzņēmums";}
  function sentence(value){const text=clean(value);return text&&!/[.!?]$/.test(text)?`${text}.`:text;}
  function lowerFirst(value){const text=clean(value);return text?text.charAt(0).toLowerCase()+text.slice(1):"";}
  function words(value){return clean(value).split(/\s+/).filter(Boolean);}
  function limitWords(value,max){const list=words(value);return list.length<=max?clean(value):`${list.slice(0,max).join(" ").replace(/[,:;.-]+$/,"")}…`;}
  function startsWithOffer(value,offers){const text=clean(value).toLowerCase();const offer=clean(offers).toLowerCase();return Boolean(text&&offer&&text.startsWith(offer));}
  function readStatus(input,id){return clean(input?.answerStatus?.[id]).toLowerCase();}
  function hasEvidence(input={}){return (input.scrapedSources||[]).some(item=>clean(item?.text))||(input.documents||[]).some(item=>clean(item?.text));}
  function identityValue(value){
    const text=neutral(value);
    return hasNavigationNoise(value)?"":text;
  }
  function splitOffers(value){return identityValue(value).replace(/\s*;\s*/g,", ");}
  function scorePercent(values){return Math.round(values.filter(Boolean).length/values.length*100);}
  function detectLanguage(profile={},input={},context={}){
    const requested=clean(input.uiLanguage||context.language||profile.uiLanguage).toLowerCase();
    if(requested.startsWith("lv")||requested==="auto"||!requested)return "lv";
    if(requested.startsWith("en"))return "en";
    const text=clean([profile.companyOverview,profile.priorityOffers,profile.idealCustomer,profile.buyingOutcomes,profile.differentiation,...(input.scrapedSources||[]).map(source=>source?.text)].join(" "));
    return /[āčēģīķļņšūž]/i.test(text)||/\b(mēs|un|kas|darba|uzņēm|noliktav|biroj)\b/i.test(text)?"lv":"en";
  }
  function copy(language,key){
    const words={en:{hypothesis:"The positioning hypothesis for {company} requires confirmation of the ideal customer, offer and commercial outcome.",why:"Clarify the customer outcome this company creates.",how:"Clarify the approach or proof that makes the company preferable.",what:"Clarify the priority product or service.",benefitFallback:"Customer benefits are not yet evidenced; confirm the operational and commercial result.",diagnosisStrong:"The commercial story is sufficiently defined for targeting and message development.",diagnosisWeak:"The commercial story is still a working hypothesis. Confirm the missing inputs before treating the positioning as final.",proposed:"Proposed · confirmation recommended",customerConfirmed:"Customer-confirmed",evidenceAccepted:"Evidence-backed · accepted",confirmed:"Confirmed"},lv:{hypothesis:"Pozicionēšanas hipotēzei par {company} nepieciešams apstiprināt ideālo klientu, piedāvājumu un komerciālo rezultātu.",why:"Jāprecizē klienta rezultāts, ko uzņēmums rada.",how:"Jāprecizē pieeja vai pierādījums, kas padara uzņēmumu par labāku izvēli.",what:"Jāprecizē prioritārais produkts vai pakalpojums.",benefitFallback:"Klienta ieguvumi vēl nav pietiekami pamatoti; jāapstiprina praktiskais un komerciālais rezultāts.",diagnosisStrong:"Komerciālais stāsts ir pietiekami skaidrs mērķēšanai un vēstījuma izstrādei.",diagnosisWeak:"Komerciālais stāsts joprojām ir darba hipotēze. Pirms pozicionējuma apstiprināšanas jāprecizē trūkstošā informācija.",proposed:"Piedāvāts · nepieciešams apstiprinājums",customerConfirmed:"Klienta apstiprināts",evidenceAccepted:"Ar pierādījumiem pamatots · pieņemts",confirmed:"Apstiprināts"}};
    return (words[language]||words.en)[key];
  }
  function uiText(language,key){
    const words={
      en:{businessIdentity:"Business identity",businessIdentitySub:"A concise factual view of what the company does, what it sells and who it serves.",businessSummary:"Business summary",commercialAnalysis:"Commercial analysis",commercialAnalysisSub:"What LeadIntel currently understands, how strong the evidence is, and what still requires confirmation.",commercialFrameworks:"Commercial frameworks",commercialFrameworksSub:"Structured models that turn the evidence into usable sales and marketing language.",commercialPositioning:"Commercial positioning",commercialPositioningSub:"Why the ideal customer should choose this company instead of a credible alternative.",salesMessage:"Sales message",salesMessageSub:"A short persuasive explanation that can be used in conversation and adapted for outreach.",commercialContext:"Commercial context",commercialContextSub:"The confirmed inputs LeadIntel uses for targeting, qualification and signal discovery.",businessSummaryField:"Business summary",uspField:"USP / value proposition",pitchField:"Elevator pitch",why:"Golden Circle · Why",how:"Golden Circle · How",what:"Golden Circle · What",valueProposition:"Value proposition",features:"FAB · Features",advantages:"FAB · Advantages",benefits:"FAB · Benefits",evidenceBacked:"Evidence-backed",proposedReview:"Proposed · review recommended",needsReview:"Needs review"},
      lv:{businessIdentity:"Uzņēmuma identitāte",businessIdentitySub:"Koncentrēts faktu kopsavilkums par uzņēmuma darbību, piedāvājumu un klientiem.",businessSummary:"Uzņēmuma kopsavilkums",commercialAnalysis:"Komerciālā analīze",commercialAnalysisSub:"Ko LeadIntel pašlaik ir noskaidrojis, cik pamatoti ir secinājumi un kas vēl jāapstiprina.",commercialFrameworks:"Komerciālie ietvari",commercialFrameworksSub:"Strukturēti modeļi, kas pierādījumus pārvērš praktiskā pārdošanas un mārketinga valodā.",commercialPositioning:"Komerciālais pozicionējums",commercialPositioningSub:"Kāpēc ideālajam klientam būtu jāizvēlas šis uzņēmums, nevis līdzvērtīga alternatīva.",salesMessage:"Pārdošanas vēstījums",salesMessageSub:"Īss pārliecinošs skaidrojums sarunām un uzrunām.",commercialContext:"Komerciālais konteksts",commercialContextSub:"Apstiprinātie dati, ko LeadIntel izmanto mērķēšanai, kvalificēšanai un signālu noteikšanai.",businessSummaryField:"Uzņēmuma kopsavilkums",uspField:"USP / vērtības piedāvājums",pitchField:"Īsais pārdošanas vēstījums",why:"Zelta aplis · Kāpēc",how:"Zelta aplis · Kā",what:"Zelta aplis · Ko",valueProposition:"Vērtības piedāvājums",features:"FAB · Iespējas",advantages:"FAB · Priekšrocības",benefits:"FAB · Ieguvumi",evidenceBacked:"Pamatots ar pierādījumiem",proposedReview:"Piedāvāts · nepieciešama pārskatīšana",needsReview:"Nepieciešama pārskatīšana"}
    };
    return (words[language]||words.en)[key]||({businessSummary:"Business summary",uniqueSellingProposition:"USP / value proposition",elevatorPitch:"Elevator pitch",buyingOutcomes:"Customer outcomes"})[key]||key;
  }
  function reviewLabel(language,status){
    if(status==="Evidence-backed")return uiText(language,"evidenceBacked");
    if(status==="Proposed · review recommended")return uiText(language,"proposedReview");
    if(status==="Needs review")return uiText(language,"needsReview");
    return status||"";
  }
  function fieldText(language,key){
    const lv={companyOverview:"Uzņēmuma pārskats",priorityOffers:"Prioritārie piedāvājumi",idealCustomer:"Ideālais klients",lookalikeCustomers:"Līdzīgie klienti",decisionMakers:"Lēmuma pieņēmēji",currentMarkets:"Pašreizējie tirgi",targetMarkets:"Prioritārie izaugsmes tirgi",marketFocus:"Prioritārā tirgus fokuss",differentiation:"Konkurences priekšrocības",buyingTriggers:"Pirkuma situācijas un signāli",exclusions:"Izslēdzamie klienti",opportunityValue:"Komerciālā vērtība",commercialObjective:"Komerciālais mērķis"};
    const en={companyOverview:"Company overview",priorityOffers:"Priority offers",idealCustomer:"Ideal customer profile",customerPainPoints:"Customer Pain Points",lookalikeCustomers:"Lookalike customers",decisionMakers:"Decision makers",currentMarkets:"Current market footprint",targetMarkets:"Priority growth markets",marketFocus:"Priority market focus",differentiation:"Competitive advantages",buyingTriggers:"Buying situations / triggers",exclusions:"Negative ICP / exclusions",opportunityValue:"Commercial value",commercialObjective:"Commercial objective"};
    return (language==="lv"?lv:en)[key]||({businessSummary:"Business summary",uniqueSellingProposition:"USP / value proposition",elevatorPitch:"Elevator pitch",buyingOutcomes:"Customer outcomes"})[key]||key;
  }
  function analysisText(language,key){
    const text={en:{clarity:"Commercial input coverage",clarityDesc:"The commercial story is still a working hypothesis. Confirm the missing inputs before treating the positioning as final.",icp:"Customer input coverage",icpDesc:"Presence of customer, buyer and outcome inputs; not a measure of targeting quality.",strength:"Positioning input coverage",strengthDesc:"Presence of offer, outcome and differentiation inputs; not proof of competitive strength.",evidence:"Source coverage",evidenceDesc:"Availability of source categories; not verification of individual claims.",statement:"Positioning statement"},lv:{clarity:"Komerciālā skaidrība",clarityDesc:"Komerciālais stāsts joprojām ir darba hipotēze. Pirms pozicionējuma apstiprināšanas jāprecizē trūkstošā informācija.",icp:"Ideālā klienta precizitāte",icpDesc:"Cik skaidri ir definēts ideālais klients, pircējs un sasniedzamais rezultāts.",strength:"Pozicionējuma spēks",strengthDesc:"Cik skaidri savienojas piedāvājums, klienta rezultāts un atšķirība no alternatīvām.",evidence:"Pierādījumu pārliecība",evidenceDesc:"Tīmekļa vietnes, dokumentu un citu avotu sniegtā pamatojuma kvalitāte.",statement:"Pozicionēšanas formulējums"}};return (text[language]||text.en)[key]||key;
  }
  function inferBenefits(offers,input={},profile={},language="en"){
    const text=clean([offers,profile.companyOverview,profile.differentiation,...(input.scrapedSources||[]).map(source=>source?.text),...(input.documents||[]).map(doc=>doc?.text)].join(" "));
    const benefits=[];const add=value=>{if(value&&!benefits.includes(value))benefits.push(value);};
    if(/biroj|office|ergonom|darba viet|workplace/i.test(text))add(language==="lv"?"ergonomiskāku, ērtāku un profesionālāku darba vidi":"a more ergonomic, comfortable and professional workplace");
    if(/noliktav|warehouse|darbnīc|workshop|instrument|plaukt|shelf|storage|uzglab/i.test(text))add(language==="lv"?"sakārtotāku un efektīvāku noliktavas vai darbnīcas darbu":"more organised and efficient warehouse or workshop operations");
    if(/skol|school|izglīt|education|bērn|kindergarten|dārziņ/i.test(text))add(language==="lv"?"drošāku un funkcionālāku mācību vidi":"a safer and more functional learning environment");
    if(/3d|vizualiz|visuali[sz]/i.test(text))add(language==="lv"?"iespēju vizualizēt risinājumu pirms iegādes un samazināt nepareizu lēmumu risku":"the ability to visualise the solution before purchase and reduce decision risk");
    return benefits.length?benefits.join("; "):copy(language,"benefitFallback");
  }
  function inferAdvantages(offers,input={},profile={},language="en"){
    const text=clean([offers,profile.companyOverview,...(input.scrapedSources||[]).map(source=>source?.text),...(input.documents||[]).map(doc=>doc?.text)].join(" "));
    const advantages=[];const add=value=>{if(value&&!advantages.includes(value))advantages.push(value);};
    if(/3d|vizualiz|visuali[sz]/i.test(text))add(language==="lv"?"3D vizualizācija un darba vietu plānošana palīdz klientam pieņemt pārdomātus lēmumus pirms iegādes":"3D visualisation and workplace planning help customers make informed decisions before purchase");
    if(/ergonom|regulējam|height.adjust|office|biroj/i.test(text))add(language==="lv"?"Ergonomiski un pielāgojami risinājumi dažādām darba vidēm":"ergonomic and adaptable solutions for different work environments");
    if(/noliktav|warehouse|darbnīc|workshop|instrument|plaukt|shelf|storage|uzglab/i.test(text))add(language==="lv"?"Plašs aprīkojuma klāsts birojiem, noliktavām un darbnīcām vienuviet":"a broad equipment range for offices, warehouses and workshops in one place");
    if(/school|skol|izglīt|education|bērn|kindergarten|dārziņ/i.test(text))add(language==="lv"?"Risinājumi arī skolām un izglītības iestādēm":"solutions for schools and educational institutions as well");
    return advantages.length?advantages.join(language==="lv"?"; ":"; "):(language==="lv"?"Priekšrocība izsecināta no piedāvājuma, taču nepieciešama klienta apstiprināšana":"The advantage is inferred from the offer and requires customer confirmation");
  }
  function deriveCustomerPainPoints(profile={},input={},language="en"){
    const source=clean([profile.priorityOffers,profile.companyOverview,profile.idealCustomer,profile.buyingOutcomes,...(input.scrapedSources||[]).map(item=>item?.text),...(input.documents||[]).map(item=>item?.text)].join(" "));
    const pains=[];const add=value=>{if(value&&!pains.includes(value))pains.push(value);};const lv=language==="lv";
    if(/biroj|office|ergonom|darba viet|workplace|regulējam|chair|desk/i.test(source))add(lv?"Neergonomiskas vai nepielāgotas darba vietas var veicināt diskomfortu un nogurumu, mazinot darbinieku apmierinātību un darba efektivitāti.":"Non-ergonomic or poorly adapted workstations can contribute to discomfort and fatigue, reducing employee satisfaction and work efficiency.");
    if(/noliktav|warehouse|darbnīc|workshop|instrument|plaukt|shelf|storage|uzglab/i.test(source))add(lv?"Nesakārtota instrumentu, materiālu un preču uzglabāšana var aizņemt lieku platību, paildzināt meklēšanu un palielināt kļūdu vai darba drošības risku.":"Disorganised storage of tools, materials and goods can waste space, extend retrieval time and increase the risk of mistakes or safety problems.");
    if(/3d|vizualiz|visuali[sz]|plānošan|planning/i.test(source))add(lv?"Darba vides plānošana bez vizuāla priekšstata var palielināt nepiemērota aprīkojuma iegādes un vēlāku pārkārtojumu risku.":"Planning a workplace without a clear visual preview can increase the risk of unsuitable purchases and later rework.");
    if(/sales|pārdošan|training|apmācīb|coaching|koučing|leadership|vadītāj/i.test(source))add(lv?"Nevienmērīgas pārdošanas, vadības vai komunikācijas prasmes var kavēt rezultātu sasniegšanu un radīt nekonsekventu klientu pieredzi.":"Inconsistent sales, leadership or communication skills can slow performance and create an uneven customer experience.");
    if(/automation|automatiz|software|programmat|artificial intelligence|mākslīg.*intelekt|\bAI\b/i.test(source))add(lv?"Manuāli un sadrumstaloti darba procesi var patērēt lieku laiku, palielināt kļūdu risku un ierobežot izaugsmi.":"Manual and fragmented processes can consume unnecessary time, increase error risk and constrain growth.");
    if(!pains.length)add(lv?"Neatrisinātas klienta vajadzības var radīt neefektīvus procesus, liekas izmaksas un neizmantotas izaugsmes iespējas; konkrētā problēma jāapstiprina ar klientu.":"Unresolved customer needs can create inefficient processes, avoidable costs and missed growth opportunities; the specific problem must be validated with the customer.");
    const outcomes=identityValue(profile.buyingOutcomes);
    const earn=lv?`Kā var palīdzēt nopelnīt vairāk: piemērotāks risinājums var palīdzēt paaugstināt darba ražīgumu, klientu apkalpošanas kvalitāti un izaugsmes kapacitāti${outcomes?`, veicinot ${lowerFirst(outcomes)}`:""}.`:`How it can help earn more: a better-fitting solution can support productivity, customer experience and capacity for growth${outcomes?`, contributing to ${lowerFirst(outcomes)}`:""}.`;
    const save=lv?"Kā var palīdzēt samazināt izmaksas: piemērots un kvalitatīvs risinājums var palīdzēt mazināt kļūdainu pirkumu, dīkstāves, atkārtota darba un darbinieku mainības risku.":"How it can help reduce costs: an appropriate, durable solution can help reduce the risk of unsuitable purchases, downtime, rework and employee turnover.";
    const easy=lv?"Kā var palīdzēt vienkāršot darbu: vienots un pārdomāts risinājums var atvieglot izvēli, ieviešanu un ikdienas darba organizēšanu.":"How it can make work easier: a coherent, well-planned solution can simplify selection, implementation and day-to-day operations.";
    return [...pains.slice(0,4),earn,save,easy].join("\n\n");
  }
  function renderCustomerPainPoints(value){
    const angle=/^(Kā var palīdzēt nopelnīt vairāk|Kā var palīdzēt samazināt izmaksas|Kā var palīdzēt vienkāršot darbu|How it can help earn more|How it can help reduce costs|How it can make work easier)\s*:\s*(.*)$/i;
    return String(value??"").split(/\n\s*\n/).map(part=>clean(part)).filter(Boolean).map(part=>{
      const match=part.match(angle);
      if(!match)return `<p>${esc(part)}</p>`;
      return `<p class="pain-angle-highlight"><strong class="pain-angle-heading">${esc(match[1])}</strong>: ${esc(match[2])}</p>`;
    }).join("");
  }
  function deriveAnalysis(profile={},input={},context={}){
    const language=detectLanguage(profile,input,context);
    const company=context.company||identityValue(profile.companyName)||(language==="lv"?"Uzņēmums":"The company");
    const offers=phrase(context.offers||splitOffers(profile.priorityOffers));
    const customer=phrase(context.customer||identityValue(profile.idealCustomer));
    const outcomes=phrase(context.outcomes||identityValue(profile.buyingOutcomes));
    const benefits=outcomes||inferBenefits(offers,input,profile,language);
    const differentiation=context.differentiation||identityValue(profile.differentiation);
    const advantage=differentiation||inferAdvantages(offers,input,profile,language);
    const buyers=identityValue(profile.decisionMakers);
    const evidence=hasEvidence(input);
    const status=readStatus(input,"differentiation")==="user"||readStatus(input,"differentiation")==="accepted"?(language==="lv"?copy(language,"confirmed"):"Confirmed"):(language==="lv"?copy(language,"proposed"):"Proposed · confirmation recommended");
    const positioningStatement=customer&&offers&&outcomes
      ? language==="lv"?`${subjectCompany(company)} nodrošina ${lowerFirst(offers)}. Klienti: ${customer}. Ieguvumi: ${outcomes}.`:`For ${lowerFirst(customer)}, ${company} provides ${lowerFirst(offers)} to ${lowerFirst(outcomes)}.`
      : copy(language,"hypothesis").replace("{company}",company);
    const frameworks={
      goldenCircle:{why:benefits,how:advantage,what:offers||copy(language,"what")},
      valueProposition:positioningStatement,
      fab:{features:offers||(language==="lv"?"Prioritārais piedāvājums nav apstiprināts.":"Priority offer not confirmed."),advantages:advantage,benefits}
    };
    const scores={
      commercialClarity:scorePercent([offers,customer,outcomes,differentiation]),
      icpSpecificity:scorePercent([customer,buyers,outcomes]),
      positioningStrength:scorePercent([offers,outcomes,differentiation]),
      evidenceConfidence:scorePercent([evidence,Boolean(input.scrapedSources?.length),Boolean(input.documents?.length)])
    };
    const diagnosis= scores.commercialClarity>=75
      ? copy(language,"diagnosisStrong")
      : copy(language,"diagnosisWeak");
    const reviewed=(id,value)=>!value?"Needs review":readStatus(input,id)==="user"?"Customer-confirmed":readStatus(input,id)==="accepted"?"Evidence-backed":"Proposed · review recommended";
    const review={goldenCircle:{why:reviewed("buying_outcomes",outcomes),how:reviewed("differentiation",differentiation),what:reviewed("priority_offers",offers)},valueProposition:"Proposed · review recommended",fab:{features:reviewed("priority_offers",offers),advantages:reviewed("differentiation",differentiation),benefits:reviewed("buying_outcomes",outcomes)}};
    return {status,positioningStatement,diagnosis,scores,frameworks,review,language,scoreKind:"input-coverage"};
  }

  function deriveIdentity(profile={},input={}){
    const language=detectLanguage(profile,input);
    const company=neutral(profile.companyName)||(language==="lv"?"Uzņēmums":"The company");
    const offers=phrase(splitOffers(profile.priorityOffers));
    const customer=phrase(identityValue(profile.idealCustomer));
    const outcomes=phrase(identityValue(profile.buyingOutcomes));
    const differentiation=identityValue(profile.differentiation);
    const diffStatus=readStatus(input,"differentiation");
    const diffConfirmed=Boolean(differentiation)&&["user","accepted"].includes(diffStatus);

    const summary=[];
    const companySubject=subjectCompany(company);
    if(offers)summary.push(language==="lv"?`${companySubject} nodrošina ${lowerFirst(offers)}`:`${company} is a business focused on ${lowerFirst(offers)}`);
    else if(profile.companyOverview)summary.push(neutral(profile.companyOverview));
    if(customer)summary.push(language==="lv"?`Piedāvājums paredzēts ${lowerFirst(customer)}`:`It primarily serves ${lowerFirst(customer)}`);
    if(outcomes)summary.push(language==="lv"?`Risinājumi palīdz iegūt ${lowerFirst(outcomes)}`:`Customers engage ${company} to ${lowerFirst(outcomes)}`);
    if(diffConfirmed)summary.push(language==="lv"?`Atšķirīgā priekšrocība ir ${lowerFirst(differentiation)}`:`Its positioning is differentiated by ${lowerFirst(differentiation)}`);
    const businessSummary=limitWords(summary.map(sentence).join(" "),130);

    let uniqueSellingProposition="";
    let uspStatus=language==="lv"?copy(language,"proposed"):"Proposed · confirmation recommended";
    if(customer&&outcomes&&offers){
      uniqueSellingProposition=language==="lv"?`${subjectCompany(company)} palīdz ${lowerFirst(customer)} iegūt ${lowerFirst(outcomes)}, nodrošinot ${lowerFirst(offers)}`:`${company} helps ${lowerFirst(customer)} ${lowerFirst(outcomes)} through ${lowerFirst(offers)}`;
      if(diffConfirmed)uniqueSellingProposition+=language==="lv"?`, ko atšķir ${lowerFirst(differentiation)}`:`, differentiated by ${lowerFirst(differentiation)}`;
      uniqueSellingProposition=sentence(uniqueSellingProposition);
    }else if(customer&&offers){
      uniqueSellingProposition=sentence(language==="lv"?`${company} apkalpo ${lowerFirst(customer)}, nodrošinot ${lowerFirst(offers)}`:`${company} serves ${lowerFirst(customer)} through ${lowerFirst(offers)}`);
    }else if(offers){
      uniqueSellingProposition=sentence(language==="lv"?`${company} piedāvā ${lowerFirst(offers)}`:`${company} provides ${lowerFirst(offers)}`);
    }
    if(diffConfirmed){
      if(diffStatus==="user")uspStatus=language==="lv"?copy(language,"customerConfirmed"):"Customer-confirmed";
      else if(diffStatus==="accepted")uspStatus=language==="lv"?copy(language,"evidenceAccepted"):"Evidence-backed · accepted";
      else uspStatus=language==="lv"?copy(language,"confirmed"):"Confirmed";
    }

    const pitch=[];
    if(customer&&outcomes)pitch.push(language==="lv"?`${subjectCompany(company)} palīdz ${lowerFirst(customer)} iegūt ${lowerFirst(outcomes)}`:`We help ${lowerFirst(customer)} ${lowerFirst(outcomes)}`);
    else if(customer&&offers)pitch.push(language==="lv"?`${subjectCompany(company)} palīdz ${lowerFirst(customer)} ar ${lowerFirst(offers)}`:`We help ${lowerFirst(customer)} through ${lowerFirst(offers)}`);
    else if(offers)pitch.push(language==="lv"?`${subjectCompany(company)} piedāvā ${lowerFirst(offers)}`:`${company} provides ${lowerFirst(offers)}`);
    if(offers&&customer&&outcomes)pitch.push(language==="lv"?`${subjectCompany(company)} nodrošina ${lowerFirst(offers)}`:`${company} provides ${lowerFirst(offers)}`);
    if(diffConfirmed)pitch.push(language==="lv"?`Mūsu pieeju atšķir ${lowerFirst(differentiation)}`:`Our approach is differentiated by ${lowerFirst(differentiation)}`);
    const elevatorPitch=limitWords(pitch.map(sentence).join(" "),90);

    const positioningInputs=[offers,customer,outcomes,diffConfirmed?differentiation:""] .filter(Boolean).length;
    const positioningConfidence=positioningInputs===4&&hasEvidence(input)?(language==="lv"?"Augsta":"High"):positioningInputs>=3?(language==="lv"?"Vidēja":"Medium"):(language==="lv"?"Nepieciešams apstiprinājums":"Needs confirmation");
    const analysis=deriveAnalysis(profile,input,{company,offers,customer,outcomes,differentiation});
    if(!uniqueSellingProposition)uniqueSellingProposition=analysis.frameworks.valueProposition;
    const customerPainPoints=deriveCustomerPainPoints(profile,input,language);
    return {businessSummary,uniqueSellingProposition,elevatorPitch,uspStatus,positioningConfidence,analysis,identityLanguage:language,customerPainPoints,customerPainPointsStatus:"AI-inferred · review recommended",customerPainPointsLanguage:language};
  }

  function patchProfileEngine(engine,root=null){
    if(!engine||engine.__businessIdentityPatched)return engine;
    originals={buildCompanyIntelligenceProfile:engine.buildCompanyIntelligenceProfile,normalizeSavedState:engine.normalizeSavedState};
    engine.buildCompanyIntelligenceProfile=function(input={}){
      const profile=originals.buildCompanyIntelligenceProfile(input);
      return {...profile,...deriveIdentity(profile,input)};
    };
    engine.normalizeSavedState=function(value={}){
      const normalized=originals.normalizeSavedState(value);
      if(!normalized.profile||typeof normalized.profile!=="object")return normalized;
      for(const key of ["priorityOffers","idealCustomer","buyingOutcomes","differentiation"]){
        if(hasNavigationNoise(normalized.profile[key]))normalized.profile[key]="";
      }
      const identity=deriveIdentity(normalized.profile,normalized);
      for(const key of ["businessSummary","uniqueSellingProposition","elevatorPitch"]){
        if(!clean(normalized.profile[key])||hasNavigationNoise(normalized.profile[key])||(key==="businessSummary"&&startsWithOffer(normalized.profile[key],normalized.profile.priorityOffers)))normalized.profile[key]=identity[key];
      }
      if(!clean(normalized.profile.uspStatus))normalized.profile.uspStatus=identity.uspStatus;
      if(!clean(normalized.profile.positioningConfidence))normalized.profile.positioningConfidence=identity.positioningConfidence;
      const painStatus=clean(normalized.profile.customerPainPointsStatus);
      const generatedPain=!painStatus||painStatus==="AI-inferred · review recommended";
      if(!clean(normalized.profile.customerPainPoints)||(generatedPain&&clean(normalized.profile.customerPainPointsLanguage)!==identity.identityLanguage)){
        normalized.profile.customerPainPoints=identity.customerPainPoints;
        normalized.profile.customerPainPointsStatus=identity.customerPainPointsStatus;
        normalized.profile.customerPainPointsLanguage=identity.customerPainPointsLanguage;
      }
      return normalized;
    };
    engine.deriveBusinessIdentity=deriveIdentity;
    engine.__businessIdentityPatched=true;
    return engine;
  }

  function esc(value){return String(value??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));}
  function readState(root){try{return JSON.parse(root.localStorage?.getItem(STORAGE_KEY)||"{}");}catch{return {};}}
  function injectStyles(root){
    if(root.document.getElementById("business-identity-style"))return;
    const style=root.document.createElement("style");style.id="business-identity-style";style.textContent=`
      #profile-editor.profile-identity-layout{display:block}
      .profile-identity-section{margin:0 0 22px;padding:22px;border:1px solid var(--line,#d8e0dc);border-radius:18px;background:rgba(255,255,255,.58)}
      .profile-identity-section.primary{background:rgba(232,244,239,.45);border-color:rgba(22,107,87,.24)}
      .profile-identity-head{display:flex;align-items:flex-end;justify-content:space-between;gap:18px;margin-bottom:16px}
      .profile-identity-head div{display:grid;gap:4px}
      .profile-identity-head span{font:600 12px/1.2 'IBM Plex Mono',monospace;letter-spacing:.14em;text-transform:uppercase;color:var(--accent,#0f6b58)}
      .profile-identity-head strong{font-size:20px;color:var(--ink,#10231d)}
      .profile-identity-head p{margin:0;max-width:620px;color:var(--muted,#6f7d77);font-size:14px}
      .profile-identity-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:16px}
      .profile-identity-grid .profile-field.wide,.profile-identity-grid .identity-wide{grid-column:1/-1}
      .profile-identity-section .profile-field{margin:0}
      .profile-identity-grid .identity-customerPainPoints{grid-column:1/-1}
      .identity-customerPainPoints .pain-points-rendered{display:grid;gap:10px;padding:14px 16px;border:1px solid var(--line,#d8e0dc);border-radius:12px;background:#fff;color:var(--ink,#10231d);font-size:15px;line-height:1.55}
      .identity-customerPainPoints .pain-points-rendered p{margin:0}
      .identity-customerPainPoints .pain-angle-highlight{padding:10px 12px;border-left:4px solid #bc8f2a;border-radius:6px;background:#fbf6e9}
      .identity-customerPainPoints .pain-angle-heading{font-weight:800;color:var(--ink,#10231d)}
      .pain-points-note{display:inline-flex;margin-top:8px;padding:5px 8px;border-radius:999px;background:#f4eee0;color:#876920;font:600 10px/1.2 'IBM Plex Mono',monospace}
      .profile-analysis-grid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:12px}
      .profile-analysis-card{padding:16px;border:1px solid var(--line,#d8e0dc);border-radius:14px;background:#fff;min-height:110px}
      .profile-analysis-card strong{display:block;color:var(--ink,#10231d);font-size:14px;margin-bottom:8px}
      .profile-analysis-card span{display:block;color:var(--muted,#6f7d77);font-size:13px;line-height:1.45}
      .profile-analysis-card .analysis-score{font:700 26px/1 ui-monospace,SFMono-Regular,Menlo,monospace;color:var(--accent,#0f6b58);margin-bottom:8px}
      .profile-analysis-card .analysis-status{display:inline-flex;padding:5px 8px;border-radius:999px;background:#f4eee0;color:#876920;font:600 10px/1.2 "IBM Plex Mono",monospace;margin-bottom:9px}.profile-analysis-card .analysis-status.evidence{background:#e7f2ea;color:#337247}.profile-analysis-card .analysis-status.review{background:#f4eee0;color:#876920}
      .profile-analysis-card.positioning-statement-card{grid-column:1/-1}
      @media(max-width:1020px){.profile-analysis-grid{grid-template-columns:repeat(2,minmax(0,1fr))}}
      @media(max-width:620px){.profile-analysis-grid{grid-template-columns:1fr}}
      .identity-meta{display:flex;gap:8px;flex-wrap:wrap;margin-top:8px}
      .identity-meta span{display:inline-flex;align-items:center;padding:6px 9px;border:1px solid var(--line,#d8e0dc);border-radius:999px;font:600 11px/1 'IBM Plex Mono',monospace;color:var(--muted,#6f7d77);background:#fff}
      @media(max-width:820px){.profile-identity-grid{grid-template-columns:1fr}.profile-identity-head{display:grid}.profile-identity-grid .profile-field.wide,.profile-identity-grid .identity-wide{grid-column:auto}}
    `;root.document.head.appendChild(style);
  }
  function createInsightCard(root,title,value,score,status,language="en"){
    const node=root.document.createElement("div");node.className="profile-analysis-card";
    const heading=root.document.createElement("strong");heading.textContent=title;
    const text=root.document.createElement("span");text.textContent=clean(value)||uiText(language,"needsReview");
    node.append(heading);
    if(score!==undefined){const scoreNode=root.document.createElement("div");scoreNode.className="analysis-score";scoreNode.textContent=`${score}%`;scoreNode.title="Input coverage only — not a quality or confidence score.";node.append(scoreNode);}
    if(status){const statusNode=root.document.createElement("small");statusNode.className=`analysis-status ${status==="Evidence-backed"?"evidence":"review"}`;statusNode.textContent=reviewLabel(language,status);node.append(statusNode);}
    node.append(text);return node;
  }
  function createField(root,key,label,value,readOnly,wide=true){
    const wrap=root.document.createElement("div");wrap.className=`profile-field ${wide?"wide":""} identity-${key}`;
    const lab=root.document.createElement("label");lab.htmlFor=`profile-${key}`;lab.textContent=label;
    const textarea=root.document.createElement("textarea");textarea.id=`profile-${key}`;textarea.dataset.profileField=key;textarea.rows=wide?3:2;textarea.readOnly=readOnly;textarea.value=clean(value);
    wrap.append(lab,textarea);return wrap;
  }
  function section(root,title,subtitle,primary=false){
    const node=root.document.createElement("section");node.className=`profile-identity-section${primary?" primary":""}`;node.dataset.profileIdentitySection=title.toLowerCase().replace(/\s+/g,"-");
    const head=root.document.createElement("div");head.className="profile-identity-head";head.innerHTML=`<div><span>${esc(title)}</span><strong>${esc(title)}</strong></div><p>${esc(subtitle)}</p>`;
    const grid=root.document.createElement("div");grid.className="profile-identity-grid";node.append(head,grid);return {node,grid};
  }
  function needsLayout(editor){
    if(!editor)return false;
    if(editor.querySelector(":scope > .profile-field"))return true;
    if(!editor.querySelector('[data-profile-field="businessSummary"]'))return true;
    if(!editor.querySelector('[data-profile-field="uniqueSellingProposition"]'))return true;
    if(!editor.querySelector('[data-profile-field="elevatorPitch"]'))return true;
    const outcomes=editor.querySelector('[data-profile-field="buyingOutcomes"]');
    if(outcomes&&!outcomes.closest('[data-profile-identity-section="commercial-context"]'))return true;
    return false;
  }
  function layoutProfile(root,force=false){
    const editor=root.document.getElementById("profile-editor");if(!editor||(!force&&!needsLayout(editor)))return;
    const state=readState(root);const profile=state.profile;if(!profile||typeof profile!=="object")return;
    const derived=root.LeadIntelProfile?.deriveBusinessIdentity?.(profile,state)||deriveIdentity(profile,state);
    const analysisData=derived.analysis||deriveAnalysis(profile,state);
    const language=analysisData.language||derived.identityLanguage||"lv";
    const chromeLanguage="en";
    const generatedLanguageChanged=Boolean(derived.identityLanguage&&derived.identityLanguage!==profile.identityLanguage);
    const sample=editor.querySelector("textarea[data-profile-field]");const readOnly=sample?sample.readOnly:true;
    const existing=[...editor.querySelectorAll(".profile-field")];
    const byKey=new Map(existing.map(node=>[node.querySelector("[data-profile-field]")?.dataset.profileField,node]).filter(([key])=>key));
    const take=key=>byKey.get(key)||null;
    byKey.get("companyOverview")?.remove();byKey.delete("companyOverview");

    let summary=take("businessSummary");if(!summary)summary=createField(root,"businessSummary",uiText(chromeLanguage,"businessSummaryField"),generatedLanguageChanged?derived.businessSummary:(profile.businessSummary||derived.businessSummary),readOnly,true);
    let usp=take("uniqueSellingProposition");if(!usp)usp=createField(root,"uniqueSellingProposition",uiText(chromeLanguage,"uspField"),generatedLanguageChanged?derived.uniqueSellingProposition:(profile.uniqueSellingProposition||derived.uniqueSellingProposition),readOnly,true);
    let pitch=take("elevatorPitch");if(!pitch)pitch=createField(root,"elevatorPitch",uiText(chromeLanguage,"pitchField"),generatedLanguageChanged?derived.elevatorPitch:(profile.elevatorPitch||derived.elevatorPitch),readOnly,true);
    const painNode=take("customerPainPoints");const generatedPain=!clean(profile.customerPainPointsStatus)||profile.customerPainPointsStatus==="AI-inferred · review recommended";
    if(painNode&&generatedPain&&profile.customerPainPointsLanguage!==language){const field=painNode.querySelector('[data-profile-field="customerPainPoints"]');if(field)field.value=derived.customerPainPoints;}

    const business=section(root,uiText(chromeLanguage,"businessIdentity"),uiText(chromeLanguage,"businessIdentitySub"),true);business.grid.append(summary);
    const analysis=section(root,uiText(chromeLanguage,"commercialAnalysis"),uiText(chromeLanguage,"commercialAnalysisSub"));
    analysis.grid.classList.add("profile-analysis-grid");
    analysis.grid.append(
      createInsightCard(root,analysisText(chromeLanguage,"clarity"),analysisData.diagnosis,analysisData.scores?.commercialClarity,undefined,language),
      createInsightCard(root,analysisText(chromeLanguage,"icp"),analysisText(chromeLanguage,"icpDesc"),analysisData.scores?.icpSpecificity,undefined,language),
      createInsightCard(root,analysisText(chromeLanguage,"strength"),analysisText(chromeLanguage,"strengthDesc"),analysisData.scores?.positioningStrength,undefined,language),
      createInsightCard(root,analysisText(chromeLanguage,"evidence"),analysisText(chromeLanguage,"evidenceDesc"),analysisData.scores?.evidenceConfidence,undefined,language),
      (()=>{const card=createInsightCard(root,analysisText(chromeLanguage,"statement"),analysisData.positioningStatement,undefined,analysisData.review?.valueProposition,chromeLanguage);card.classList.add("positioning-statement-card");return card;})()
    );
    const frameworks=section(root,uiText(chromeLanguage,"commercialFrameworks"),uiText(chromeLanguage,"commercialFrameworksSub"));
    frameworks.grid.classList.add("profile-analysis-grid");
    frameworks.grid.append(
      createInsightCard(root,uiText(chromeLanguage,"why"),analysisData.frameworks?.goldenCircle?.why,undefined,analysisData.review?.goldenCircle?.why,language),
      createInsightCard(root,uiText(chromeLanguage,"how"),analysisData.frameworks?.goldenCircle?.how,undefined,analysisData.review?.goldenCircle?.how,language),
      createInsightCard(root,uiText(chromeLanguage,"what"),analysisData.frameworks?.goldenCircle?.what,undefined,analysisData.review?.goldenCircle?.what,language),
      createInsightCard(root,uiText(chromeLanguage,"valueProposition"),analysisData.frameworks?.valueProposition,undefined,analysisData.review?.valueProposition,language),
      createInsightCard(root,uiText(chromeLanguage,"features"),analysisData.frameworks?.fab?.features,undefined,analysisData.review?.fab?.features,language),
      createInsightCard(root,uiText(chromeLanguage,"advantages"),analysisData.frameworks?.fab?.advantages,undefined,analysisData.review?.fab?.advantages,language),
      createInsightCard(root,uiText(chromeLanguage,"benefits"),analysisData.frameworks?.fab?.benefits,undefined,analysisData.review?.fab?.benefits,language)
    );
    const positioning=section(root,uiText(chromeLanguage,"commercialPositioning"),uiText(chromeLanguage,"commercialPositioningSub"));positioning.grid.append(usp);
    const diff=take("differentiation");if(diff){diff.classList.add("wide","identity-wide");positioning.grid.append(diff);}
    const meta=root.document.createElement("div");meta.className="identity-meta identity-wide";meta.innerHTML=`<span>${esc(profile.uspStatus||derived.uspStatus||"Proposed · confirmation recommended")}</span><span>${esc(profile.positioningConfidence||derived.positioningConfidence||"Needs confirmation")} confidence</span>`;positioning.grid.append(meta);
    const sales=section(root,uiText(chromeLanguage,"salesMessage"),uiText(chromeLanguage,"salesMessageSub"));sales.grid.append(pitch);
    const context=section(root,uiText(chromeLanguage,"commercialContext"),uiText(chromeLanguage,"commercialContextSub"));
    const contextOrder=["priorityOffers","idealCustomer","customerPainPoints","buyingOutcomes","lookalikeCustomers","decisionMakers","currentMarkets","targetMarkets","marketFocus","buyingTriggers","exclusions","opportunityValue","commercialObjective"];
    const used=new Set(["companyOverview","businessSummary","uniqueSellingProposition","elevatorPitch","differentiation"]);
    for(const key of contextOrder){const node=take(key);if(node){context.grid.append(node);used.add(key);}}
    const painField=context.grid.querySelector('[data-profile-field="customerPainPoints"]')?.closest('.profile-field');
    if(painField){
      painField.classList.add('wide','identity-customerPainPoints');
      const field=painField.querySelector('[data-profile-field="customerPainPoints"]');
      painField.querySelector('.pain-points-rendered')?.remove();
      if(field){
        field.hidden=false;
        if(field.readOnly){
          const rendered=root.document.createElement('div');rendered.className='pain-points-rendered';rendered.innerHTML=renderCustomerPainPoints(field.value);field.hidden=true;field.after(rendered);
        }
      }
      if(!painField.querySelector('.pain-points-note')){const note=root.document.createElement('small');note.className='pain-points-note';note.textContent=profile.customerPainPointsStatus||'AI-inferred · review recommended';painField.append(note);}
    }
    for(const [key,node] of byKey){if(!used.has(key))context.grid.append(node);}
    editor.replaceChildren(business.node,analysis.node,frameworks.node,positioning.node,sales.node,context.node);editor.classList.add("profile-identity-layout");
    editor.querySelectorAll("[data-profile-field]").forEach(field=>{
      const label=field.closest(".profile-field")?.querySelector("label");if(label)label.textContent=fieldText(chromeLanguage,field.dataset.profileField);
      
    });
  }
  function queueLayout(root,force=false){if(layoutQueued)return;layoutQueued=true;setTimeout(()=>{layoutQueued=false;layoutProfile(root,force);},0);}
  function watchProfile(root){
    const editor=root.document.getElementById("profile-editor");if(!editor||typeof MutationObserver==="undefined")return;
    if(layoutObserver)layoutObserver.disconnect();layoutObserver=new MutationObserver(()=>queueLayout(root));layoutObserver.observe(editor,{childList:true,subtree:true});
  }
  function install(root){
    if(installed)return;installed=true;injectStyles(root);patchProfileEngine(root.LeadIntelProfile,root);watchProfile(root);queueLayout(root);
    root.addEventListener("leadintel:module-opened",event=>{if(Number(event.detail?.step)===3){setTimeout(()=>queueLayout(root),0);setTimeout(()=>queueLayout(root),80);}});
    root.addEventListener("leadintel:workspace-changed",()=>queueLayout(root,true));
    root.addEventListener("leadintel:server-ready",()=>queueLayout(root,true));
    root.addEventListener("leadintel:language-changed",()=>queueLayout(root,true));
    root.document.getElementById("edit-profile")?.addEventListener("click",()=>setTimeout(()=>queueLayout(root),0));
  }

  return {deriveIdentity,deriveCustomerPainPoints,renderCustomerPainPoints,patchProfileEngine,layoutProfile,install,hasNavigationNoise,stripNavigationNoise};
});
