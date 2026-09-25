const test=require("node:test");
const assert=require("node:assert/strict");
const discovery=require("../discovery-engine.js");

test("discovery excludes the customer website and tender portals when tenders are disabled",()=>{
  const results=discovery.mergeCompanyCandidates([
    {url:"https://ajprodukti.lv/levelpath",domain:"ajprodukti.lv",title:"Levelpath – AJ Produkti",description:"AJ Produkti office furniture",text:"AJ Produkti office furniture"},
    {url:"https://eis.gov.lv/EKEIS/Supplier/ViewProcurement",domain:"eis.gov.lv",title:"Public procurement tender",description:"Supplier procurement notice",text:"Tender procurement notice"},
    {url:"https://buyer.lv/news/new-factory",domain:"buyer.lv",title:"Buyer opens a new factory in Latvia",description:"Expansion announcement",text:"The company opens a new factory and expands capacity in Latvia. It needs office furniture for the new offices."}
  ],{website:"https://www.ajprodukti.lv",targetMarkets:"Latvia",priorityOffers:"Office furniture",idealCustomer:"Companies and institutions",exclusions:"Tenders"},{researchSourceTypes:["news"],signals:[{id:"facility-expansion",name:"Facility expansion",active:true,weight:9,keywords:"new factory; expansion"}]});
  assert.deepEqual(results.map(item=>item.domain),["buyer.lv"]);
  assert.deepEqual(results[0].matchedSignals.map(item=>item.name),["Facility expansion"]);
  assert.equal(results[0].score.signal>0,true);
});

test("discovery query targets operating prospects and omits tenders when tenders are disabled",()=>{
  const queries=discovery.buildDiscoveryQueries({website:"https://www.ajprodukti.lv",targetMarkets:"Latvia",priorityOffers:"Office furniture",idealCustomer:"Companies and institutions",buyingTriggers:"New facilities and office expansion"},{researchSourceTypes:["news"],icps:[{active:true,description:"Companies opening or expanding facilities"}],signals:[{id:"tender",name:"Tender or procurement activity",active:true,weight:9,keywords:"tender; procurement"}]},1);
  assert.match(queries[0].query,/company|facility|investment/i);
  assert.doesNotMatch(queries[0].query,/office furniture|tender|procurement|iepirk/i);
});

test("discovery requires at least one active buying signal",()=>{
  assert.equal(discovery.hasActiveSignals({signals:[]}),false);
  assert.equal(discovery.hasActiveSignals({signals:[{name:"Expansion",active:false}]}),false);
  assert.equal(discovery.hasActiveSignals({signals:[{name:"Expansion",active:true}]}),true);
});

test("discovery withholds a company without signal evidence from the actionable shortlist",()=>{
  const results=discovery.mergeCompanyCandidates([{url:"https://generic.lv",domain:"generic.lv",title:"Generic office furniture",text:"Office furniture company in Latvia"}],{website:"https://ajprodukti.lv",priorityOffers:"Office furniture",idealCustomer:"Companies"},{researchSourceTypes:["news"],signals:[{name:"Facility expansion",active:true,weight:9,keywords:"new factory; expansion"}]});
  assert.deepEqual(results,[]);
});

test("signal matching does not treat substrings or generic product words as buying events",()=>{
  const profile={website:"https://ercon.lv",priorityOffers:"metal structures; installation",idealCustomer:"Swedish manufacturers of industrial equipment"};
  const market={signals:[
    {id:"ai-crm",name:"AI, CRM or sales-tech transformation",active:true,weight:9,keywords:"AI; CRM; sales-tech transformation"},
    {id:"launch",name:"Product or service launch",active:true,weight:8,keywords:"product; launch"}
  ]};
  const evidence=[{
    url:"https://modvion.com/news/wooden-tower",domain:"modvion.com",company:"Modvion",market:"Sweden",
    title:"Modvion introduces a sustainable wooden wind turbine tower",
    description:"Product information is available on the company site.",
    text:"The company maintains its product information and launches product improvements throughout the year in Sweden."
  }];
  assert.deepEqual(discovery.mergeCompanyCandidates(evidence,profile,market),[]);
  const possible=discovery.buildPotentialCompanyCandidates(evidence,profile,market,[]);
  assert.equal(possible.length,1);
  assert.ok(possible[0].qualificationGaps.includes("No active buying signal was confirmed"));
  assert.ok(possible[0].qualificationGaps.includes("Target customer fit is not evidenced"));
});

test("generic company directories do not add fit, signal, evidence or confidence points",()=>{
  const profile={website:"https://ercon.lv",priorityOffers:"metal structures; installation",idealCustomer:"wind energy infrastructure operators"};
  const market={signals:[{id:"expansion",name:"Capacity expansion",active:true,weight:9,keywords:"new factory; capacity expansion"}]};
  const verified=[
    {url:"https://nordicwind.se/news/factory",domain:"nordicwind.se",sourceDomain:"nordicwind.se",company:"Nordic Wind",market:"Sweden",title:"Nordic Wind plans a new factory",description:"The Swedish company is expanding capacity.",text:"Nordic Wind plans a new factory in Sweden and will install metal structures for its wind-energy infrastructure."},
    {url:"https://industrynews.se/nordicwind-expansion",domain:"nordicwind.se",sourceDomain:"industrynews.se",company:"Nordic Wind",market:"Sweden",title:"Nordic Wind expands",description:"Nordic Wind plans a new factory and expands capacity.",text:"Nordic Wind plans a new factory in Sweden and expands its production capacity."}
  ];
  const directory={url:"https://www.f6s.com/nordicwind",domain:"nordicwind.se",sourceDomain:"f6s.com",company:"Nordic Wind",market:"Sweden",title:"63 Top Manufacturing Companies in Sweden · September 2026 – F6S",description:"Company profile, product updates and funding.",text:"Nordic Wind is listed among manufacturing companies in Sweden. Latest product and AI updates."};
  assert.equal(discovery.isLowQualityDiscoveryEvidence(directory),true);
  assert.equal(discovery.isLowQualityDiscoveryEvidence({...directory,title:"Nordic Wind company profile"}),true,"known company directories remain low quality even without listicle titles");
  const clean=discovery.mergeCompanyCandidates(verified,profile,market)[0];
  const noisy=discovery.mergeCompanyCandidates([...verified,directory],profile,market)[0];
  assert.ok(clean);
  assert.ok(noisy);
  for(const key of ["fit","signal","evidence","timing","value","total"])assert.equal(noisy.score[key],clean.score[key],`${key} should ignore generic directory content`);
  assert.equal(noisy.confidence,clean.confidence);
});

test("discovery rejects a target-market label copied onto a conflicting country domain",()=>{
  const results=discovery.mergeCompanyCandidates([{
    url:"https://metals.lv/news/expansion",domain:"metals.lv",company:"Metals",market:"Sweden",
    title:"Metals expands production capacity",description:"The company is expanding production capacity for metal structures.",
    text:"We offer metal fabrication and metal structures from Latvia and are expanding production capacity."
  }],{
    website:"https://ercon.lv",priorityOffers:"metal fabrication; metal structures",idealCustomer:"Swedish industrial companies"
  },{
    signals:[{id:"expansion",name:"Capacity expansion",active:true,weight:9,keywords:"expanding production capacity; new factory"}]
  });
  assert.deepEqual(results,[]);
});

test("discovery rejects a same-service seller even when its target-market domain and signal match",()=>{
  const results=discovery.mergeCompanyCandidates([{
    url:"https://swedishmetal.se/news/expansion",domain:"swedishmetal.se",company:"Swedish Metal",market:"Sweden",
    title:"Swedish Metal expands capacity",description:"Swedish Metal is expanding production capacity.",
    text:"We offer metal fabrication and metal structure manufacturing services. We are expanding production capacity in Sweden."
  }],{
    website:"https://ercon.lv",priorityOffers:"metal fabrication; metal structure manufacturing",idealCustomer:"Swedish industrial companies buying outsourced fabrication"
  },{
    signals:[{id:"expansion",name:"Capacity expansion",active:true,weight:9,keywords:"expanding production capacity; new factory"}]
  });
  assert.deepEqual(results,[]);
});

test("a manufacturer that buys automation is not excluded as an automation seller",()=>{
  const results=discovery.mergeCompanyCandidates([{
    url:"https://steelworks.se/news/expansion",domain:"steelworks.se",company:"Steelworks AB",market:"Sweden",
    title:"Steelworks AB announces production capacity expansion",
    description:"The Swedish steel manufacturer is investing in industrial automation for its own production lines.",
    text:"Steelworks AB, a Swedish steel manufacturer, is investing in industrial automation to improve its own production lines as it expands capacity."
  }],{
    website:"https://ercon.lv",priorityOffers:"industrial automation",idealCustomer:"steel manufacturers"
  },{
    signals:[{id:"expansion",name:"Capacity expansion",active:true,weight:9,keywords:"capacity expansion; new factory"}]
  });
  assert.equal(results.length,1);
  assert.equal(results[0].domain,"steelworks.se");
});

test("a company explicitly offering the same automation service remains excluded",()=>{
  const results=discovery.mergeCompanyCandidates([{
    url:"https://automation.se/news/expansion",domain:"automation.se",company:"Automation AB",market:"Sweden",
    title:"Automation AB expands its business",description:"We provide industrial automation systems and equipment.",
    text:"We provide industrial automation systems and equipment to manufacturers in Sweden while expanding our business."
  }],{
    website:"https://ercon.lv",priorityOffers:"industrial automation",idealCustomer:"steel manufacturers"
  },{
    signals:[{id:"expansion",name:"Capacity expansion",active:true,weight:9,keywords:"business expansion; new factory"}]
  });
  assert.deepEqual(results,[]);
});

test("a company branded as the target service manufacturer remains excluded",()=>{
  const results=discovery.mergeCompanyCandidates([{
    url:"https://automation.se/news/expansion",domain:"automation.se",company:"Automation AB",market:"Sweden",
    title:"Automation AB announces business expansion",
    description:"Automation AB is an industrial automation systems manufacturer.",
    text:"Automation AB is an industrial automation systems manufacturer expanding in Sweden."
  }],{
    website:"https://ercon.lv",priorityOffers:"industrial automation",idealCustomer:"steel manufacturers"
  },{
    signals:[{id:"expansion",name:"Capacity expansion",active:true,weight:9,keywords:"business expansion; new factory"}]
  });
  assert.deepEqual(results,[]);
});

test("discovery keeps a verified target-market buyer with company-specific signal evidence",()=>{
  const results=discovery.mergeCompanyCandidates([{
    url:"https://nordicfood.se/news/new-factory",domain:"nordicfood.se",company:"Nordic Food AB",market:"Sweden",
    title:"Nordic Food opens a new factory",description:"The Swedish food producer is increasing manufacturing capacity.",
    text:"Nordic Food AB is opening a new factory in Sweden and expanding production capacity. The investment includes new production lines and requires outsourced metal fabrication for the new plant."
  }],{
    website:"https://ercon.lv",priorityOffers:"metal fabrication; metal structures",idealCustomer:"Swedish industrial and manufacturing companies"
  },{
    signals:[{id:"expansion",name:"Capacity expansion",active:true,weight:9,keywords:"expanding production capacity; new factory"}]
  });
  assert.equal(results.length,1);
  assert.equal(results[0].domain,"nordicfood.se");
  assert.equal(results[0].matchedSignals.length,1);
});

test("discovery searches a recognised target-country domain without repeating the seller offer",()=>{
  const [query]=discovery.buildDiscoveryQueries({
    website:"https://ercon.lv",targetMarkets:"Sweden",priorityOffers:"metal fabrication services",
    idealCustomer:"industrial manufacturing companies",customerPainPoints:"capacity bottlenecks"
  },{
    signals:[{id:"expansion",name:"Capacity expansion",active:true,weight:9,keywords:"new factory; capacity expansion"}]
  },1);
  assert.match(query.query,/site:\.se/i);
  assert.doesNotMatch(query.query,/metal fabrication services/i);
});

test("a repeat company search explores different query families and country filters",()=>{
  const profile={website:"https://ercon.lv",targetMarkets:"Sweden",priorityOffers:"metal fabrication services",idealCustomer:"industrial manufacturers"};
  const market={signals:[{name:"Capacity expansion",active:true,keywords:"new factory; investment"}]};
  const first=discovery.buildDiscoveryQueries(profile,market,6);
  const next=discovery.buildDiscoveryQueries(profile,market,6,first);
  assert.equal(first.length,6);
  assert.equal(next.length,6);
  assert.equal(new Set([...first,...next].map(item=>item.query)).size,12);
  assert.ok(first.some(item=>/site:\.se/.test(item.query)));
  assert.ok(first.some(item=>!/site:\.se/.test(item.query)));
  assert.ok(first.every(item=>!/metal fabrication services/i.test(item.query)));
});

test("a mixed-company article does not transfer another firm's sales hiring signal",()=>{
  const sourceUrl="https://industry.se/science-partners.pdf";
  const source={url:sourceUrl,domain:"industry.se",market:"Sweden",title:"LKAB and Coorstek industry partners",description:"Coorstek expands its sales team.",text:"LKAB is a Swedish industrial minerals producer. Coorstek hires sales representatives for its expansion."};
  const resolved={url:"https://lkab.com/",domain:"lkab.com",company:"LKAB",market:"Sweden",title:"LKAB minerals",description:"Industrial mineral producer",text:"LKAB produces minerals in Sweden."};
  const linked=discovery.attachSourceEvidenceToResolvedCompanies([resolved],[{company:"LKAB",market:"Sweden",sourceUrl}],[source]);
  assert.equal(linked.length,2);
  assert.doesNotMatch(linked[1].text,/Coorstek|sales representatives/i);
  const profile={website:"https://ercon.lv",idealCustomer:"Swedish industrial mineral producers",priorityOffers:"metal structures"};
  const market={signals:[{id:"sales",name:"Sales team hiring or expansion",active:true,keywords:"recruitment; expansion",weight:8}]};
  assert.deepEqual(discovery.mergeCompanyCandidates(linked,profile,market,10),[]);
});

test("Latvian market names resolve to the correct target-country search",()=>{
  const [query]=discovery.buildDiscoveryQueries({
    website:"https://ercon.lv",targetMarkets:"Zviedrija",priorityOffers:"metālapstrādes pakalpojumi",
    idealCustomer:"ražošanas uzņēmumi",customerPainPoints:"ražošanas jaudas ierobežojumi"
  },{
    opportunities:[{market:"Zviedrija",active:true,score:{total:80}}],
    signals:[{id:"expansion",name:"Ražošanas paplašināšana",active:true,weight:9,keywords:"jauna ražotne; jaudas palielināšana"}]
  },1);
  assert.match(query.query,/site:\.se/i);
  assert.match(query.query,/Sweden|Sverige/i);
});

test("Latvian buying signals search for and match equivalent Swedish evidence",()=>{
  const profile={website:"https://ercon.lv",priorityOffers:"metālapstrādes pakalpojumi",idealCustomer:"Zviedrijas ražošanas uzņēmumi"};
  const market={signals:[{id:"expansion",name:"Ražošanas paplašināšana",active:true,weight:9,keywords:"jauna ražotne; jaudas palielināšana"}]};
  const [verification]=discovery.buildCandidateVerificationQueries([{
    url:"https://nordicfood.se/",domain:"nordicfood.se",company:"Nordic Food",market:"Zviedrija",title:"Nordic Food"
  }],profile,market,1);
  assert.match(verification.query,/ny fabrik|capacity expansion/i);

  const candidates=discovery.mergeCompanyCandidates([{
    url:"https://nordicfood.se/nyheter/ny-fabrik",domain:"nordicfood.se",company:"Nordic Food",market:"Zviedrija",
    title:"Nordic Food bygger ny fabrik",description:"Bolaget utökar produktionskapaciteten i Sverige.",
    text:"Nordic Food bygger en ny fabrik och utökar produktionskapaciteten i Sverige. The expansion requires metal structures and on-site installation."
  }],profile,market,10);
  assert.equal(candidates.length,1);
  assert.equal(candidates[0].domain,"nordicfood.se");
  assert.deepEqual(candidates[0].matchedSignals.map(item=>item.id),["expansion"]);
});

test("Latvian market labels still reject a conflicting country domain",()=>{
  const candidates=discovery.mergeCompanyCandidates([{
    url:"https://latvianmetal.lv/news",domain:"latvianmetal.lv",company:"Latvian Metal",market:"Zviedrija",
    title:"Jauna ražotne",description:"Uzņēmums palielina jaudu.",text:"Jauna ražotne un jaudas palielināšana Latvijā."
  }],{website:"https://ercon.lv",priorityOffers:"metālapstrāde"},{
    signals:[{id:"expansion",name:"Ražošanas paplašināšana",active:true,weight:9,keywords:"jauna ražotne; jaudas palielināšana"}]
  });
  assert.deepEqual(candidates,[]);
});

test("generic service page titles do not become company identities",()=>{
  const [company]=discovery.normalizeCompanySearchResults({data:[{
    url:"https://metals.lv/",
    title:"Metāla konstrukcijas",
    description:"Metāla konstrukciju izgatavošana un montāža Latvijā."
  }]},{id:"q1",market:"Sweden",query:"buyers in Sweden"});
  assert.equal(company.company,"Metals");
});

test("legacy unverified candidates are removed from a restored discovery shortlist",()=>{
  const state=discovery.normalizeDiscoveryState({status:"complete",candidates:[{
    company:"IDM Serviss",domain:"idm.lv",website:"https://idm.lv/",market:"Sweden",matchedSignals:[],
    evidence:[{url:"https://idm.lv/",title:"IDM Serviss",description:"Steel manufacturer",text:""}]
  }]});
  assert.deepEqual(state.candidates,[]);
});

test("only fully qualified candidates are actionable",()=>{
  const base={
    company:"Nordic Food Group",domain:"nordicfood.se",website:"https://nordicfood.se/",
    matchedSignals:[{id:"expansion",name:"Expansion"}],
    evidence:[{url:"https://nordicfood.se/news",title:"New factory",description:"",text:""}]
  };
  assert.equal(discovery.isActionableCandidate(base),false);
  assert.equal(discovery.isActionableCandidate({...base,qualified:true,marketVerified:true,buyerVerified:true}),true);
});

test("market evidence is converted into named company resolution queries instead of treating the publisher as the lead",()=>{
  const evidence=[{
    url:"https://www.ri.se/en/unique-bio-based-industry-is-established-kopmanholmen",
    domain:"ri.se",market:"Zviedrija",title:"Unique bio-based industry is established",
    description:"Cinis Fertilizer intends to establish a new facility in Sweden and invest SEK 550 million.",
    text:"Cinis Fertilizer intends to establish a new facility at the dockyard in Köpmanholmen."
  }];
  const mentions=discovery.extractCompanyMentions(evidence,10);
  assert.deepEqual(mentions.map(item=>item.company),["Cinis Fertilizer"]);
  const [resolution]=discovery.buildCompanyResolutionQueries(mentions,{},10);
  assert.equal(resolution.kind,"resolution");
  assert.equal(resolution.company,"Cinis Fertilizer");
  assert.match(resolution.query,/"Cinis Fertilizer"/);
  assert.match(resolution.query,/Sweden|Sverige/);
  assert.doesNotMatch(resolution.query,/site:ri\.se/);
});

test("AI company extraction accepts only companies tied to supplied evidence URLs",()=>{
  const evidence=[{
    url:"https://industry-news.se/cinis-expansion",domain:"industry-news.se",market:"Zviedrija",
    title:"Cinis expands",description:"Cinis Fertilizer plans a new facility.",text:""
  }];
  const parsed=discovery.parseCompanyExtraction(JSON.stringify({companies:[
    {company:"Cinis Fertilizer",market:"Zviedrija",sourceUrl:"https://industry-news.se/cinis-expansion"},
    {company:"Fabricated Industries",market:"Zviedrija",sourceUrl:"https://industry-news.se/cinis-expansion"},
    {company:"Invented AB",market:"Zviedrija",sourceUrl:"https://unknown.example/fake"}
  ]}),evidence,10);
  assert.deepEqual(parsed.map(item=>item.company),["Cinis Fertilizer"]);
});

test("resolved official domains keep the extracted company identity for exact-domain verification",()=>{
  const [resolved]=discovery.normalizeCompanySearchResults({data:[{
    url:"https://cinis-fertilizer.com/",title:"Cinis Fertilizer",description:"Official company website"
  }]},{id:"resolve-cinis",kind:"resolution",company:"Cinis Fertilizer",market:"Zviedrija",query:'"Cinis Fertilizer" official website'});
  assert.equal(resolved.company,"Cinis Fertilizer");
  const [verification]=discovery.buildCandidateVerificationQueries([resolved],{website:"https://ercon.lv"},{
    signals:[{id:"expansion",name:"Ražošanas paplašināšana",active:true,weight:9,keywords:"jauna ražotne; jaudas palielināšana"}]
  },10);
  assert.equal(verification.domain,"cinis-fertilizer.com");
  assert.match(verification.query,/site:cinis-fertilizer\.com/);
});

test("company resolution rejects publisher domains even when their article names the company",()=>{
  const resolved=discovery.normalizeCompanySearchResults({data:[{
    url:"https://www.ri.se/en/cinis-expansion",title:"Cinis Fertilizer plans a new facility",description:"Expansion news"
  }]},{id:"resolve-cinis",kind:"resolution",company:"Cinis Fertilizer",market:"Zviedrija",query:'"Cinis Fertilizer" official website'});
  assert.deepEqual(resolved,[]);
});

test("resolved official company keeps its third-party buying-signal evidence",()=>{
  const sourceUrl="https://www.ri.se/en/unique-bio-based-industry-is-established-kopmanholmen";
  const evidence=[{
    url:sourceUrl,domain:"ri.se",market:"Zviedrija",title:"Unique bio-based industry is established",
    description:"Cinis Fertilizer intends to establish a new facility in Sweden and invest SEK 550 million.",
    text:"Cinis Fertilizer intends to establish a new facility at the dockyard in Kopmanholmen."
  }];
  const mentions=[{company:"Cinis Fertilizer",market:"Zviedrija",sourceUrl}];
  const resolved=[{
    url:"https://cinis-fertilizer.com/",domain:"cinis-fertilizer.com",company:"Cinis Fertilizer",market:"Zviedrija",
    title:"Cinis Fertilizer",description:"Fossil-free mineral fertilizer producer",text:"Official company website"
  }];

  assert.equal(typeof discovery.attachSourceEvidenceToResolvedCompanies,"function");
  if(typeof discovery.attachSourceEvidenceToResolvedCompanies!=="function")return;
  const linked=discovery.attachSourceEvidenceToResolvedCompanies(resolved,mentions,evidence);
  const profile={
    website:"https://ercon.lv",priorityOffers:"metālapstrādes pakalpojumi",idealCustomer:"Zviedrijas ražošanas uzņēmumi"
  };
  const market={
    signals:[{id:"expansion",name:"Ražošanas paplašināšana",active:true,weight:9,keywords:"jauna ražotne; jaudas palielināšana"}]
  };
  const candidates=discovery.mergeCompanyCandidates(linked,profile,market,10);

  assert.deepEqual(candidates,[],"a sector and event match without evidence of offer fit stays out of the qualified shortlist");
  const possible=discovery.buildPotentialCompanyCandidates(linked,profile,market,[]);
  assert.equal(possible.length,1);
  assert.equal(possible[0].company,"Cinis Fertilizer");
  assert.ok(possible[0].evidence.some(item=>item.url===sourceUrl),"publisher article remains evidence, never company identity");
  assert.ok(possible[0].matchedSignals.some(item=>item.id==="expansion"));
  assert.ok(possible[0].qualificationGaps.includes("Target customer fit is not evidenced"));
});

test("third-party evidence cannot qualify a company without a resolved official domain",()=>{
  assert.equal(typeof discovery.attachSourceEvidenceToResolvedCompanies,"function");
  if(typeof discovery.attachSourceEvidenceToResolvedCompanies!=="function")return;
  const sourceUrl="https://industry-news.se/example-expansion";
  const linked=discovery.attachSourceEvidenceToResolvedCompanies([], [{company:"Example AB",market:"Sweden",sourceUrl}], [{
    url:sourceUrl,domain:"industry-news.se",market:"Sweden",title:"Example AB expands",text:"Example AB opens a new factory in Sweden."
  }]);
  assert.deepEqual(linked,[]);
});

test("target market can be verified by the linked evidence country when the official company uses dot-com",()=>{
  const sourceUrl="https://industry-news.se/example-expansion";
  const linked=discovery.attachSourceEvidenceToResolvedCompanies([{
    url:"https://example-industries.com/",domain:"example-industries.com",company:"Example Industries",market:"Zviedrija",
    title:"Example Industries",description:"Industrial producer",text:"Official company website"
  }],[{company:"Example Industries",market:"Zviedrija",sourceUrl}],[{
    url:sourceUrl,domain:"industry-news.se",market:"Zviedrija",title:"Example Industries invests",
    description:"Example Industries builds a new facility and expands production capacity in Sweden. The expansion requires custom metal structures for installation.",text:""
  }]);
  const candidates=discovery.mergeCompanyCandidates(linked,{
    website:"https://ercon.lv",priorityOffers:"metālapstrādes pakalpojumi",idealCustomer:"Zviedrijas ražošanas uzņēmumi"
  },{
    signals:[{id:"expansion",name:"Ražošanas paplašināšana",active:true,weight:9,keywords:"jauna ražotne; jaudas palielināšana"}]
  },10);
  assert.equal(candidates.length,1);
  assert.equal(candidates[0].domain,"example-industries.com");
});


test("a technically successful run with zero qualified companies is a no-results outcome",()=>{
  assert.equal(discovery.discoveryOutcomeStatus({timedOut:false,failures:0,candidateCount:0}),"no_results");
  assert.equal(discovery.discoveryOutcomeStatus({timedOut:false,failures:0,candidateCount:2}),"complete");
  assert.equal(discovery.normalizeDiscoveryState({status:"no_results"}).status,"no_results");
});


test("zero-result guidance tells the user what to change before retrying",()=>{
  const limited=discovery.zeroResultGuidance({evidenceCount:20,activeSignalCount:1,targetCount:10});
  assert.equal(limited.primaryAction,"review_strategy");
  assert.equal(limited.primaryLabel,"Review Strategy");
  assert.match(limited.summary,/20 evidence results were checked/);
  assert.match(limited.steps.join(" "),/activate at least 3 buying signals/i);
  assert.match(limited.steps.join(" "),/keep the search at 10 companies/i);
  assert.doesNotMatch(limited.steps.join(" "),/increase.*25|increase.*50/i);

  const broader=discovery.zeroResultGuidance({evidenceCount:20,activeSignalCount:4,targetCount:25});
  assert.match(broader.steps.join(" "),/broaden narrow ICP or signal keywords/i);
  assert.match(broader.steps.join(" "),/return to 10 companies/i);
});
