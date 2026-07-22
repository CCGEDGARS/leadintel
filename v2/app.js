"use strict";

const STORAGE_KEY = "leadintel_v2_state";
const STATE_SCHEMA_VERSION = 10;
const DOCUMENT_DB_NAME = "leadintel_v2_documents";
const DOCUMENT_STORE_NAME = "files";
const BUSINESS_PROFILE_PDF_KEY = "business-profile-pdf";
const MAX_PROFILE_PDF_BYTES = 15 * 1024 * 1024;
const BACKEND_API_URL = "https://leadintel-api.edgars-7e7.workers.dev";
const MAP_WORLD = Object.freeze({width:1940,height:820,nodeWidth:142,nodeHeight:112});
let backendSession = null;

const MARKET_PROFILES = [
  {id:"latvia",name:"Latvia",countries:["Latvia"],countryCodes:["LV"],languages:["Latvian","English"],decisionTitles:["Sales Director","Commercial Director","Head of Sales","CEO"],sourceFocus:"Latvian business, procurement, recruitment and company sources"},
  {id:"estonia",name:"Estonia",countries:["Estonia"],countryCodes:["EE"],languages:["Estonian","English"],decisionTitles:["Sales Director","Commercial Director","Head of Sales","CEO"],sourceFocus:"Estonian business, procurement, recruitment and company sources"},
  {id:"lithuania",name:"Lithuania",countries:["Lithuania"],countryCodes:["LT"],languages:["Lithuanian","English"],decisionTitles:["Sales Director","Commercial Director","Head of Sales","CEO"],sourceFocus:"Lithuanian business, procurement, recruitment and company sources"},
  {id:"baltics",name:"Baltics",countries:["Latvia","Estonia","Lithuania"],countryCodes:["LV","EE","LT"],languages:["Latvian","Estonian","Lithuanian","English"],decisionTitles:["Sales Director","Commercial Director","Head of Sales","CEO"],sourceFocus:"Baltic business, procurement, recruitment and company sources"},
  {id:"custom",name:"Custom market",countries:["Finland"],countryCodes:["FI"],languages:["English"],decisionTitles:["Sales Director","Commercial Director","Head of Sales","CEO"],sourceFocus:"Approved public business, procurement, recruitment and company sources"}
];
const COUNTRY_PRESETS=[
  {name:"Latvia",code:"LV"},{name:"Estonia",code:"EE"},{name:"Lithuania",code:"LT"},{name:"Finland",code:"FI"},{name:"Sweden",code:"SE"},{name:"Norway",code:"NO"},{name:"Denmark",code:"DK"},{name:"Poland",code:"PL"},{name:"Germany",code:"DE"}
];
const LANGUAGE_PRESETS=["Latvian","Estonian","Lithuanian","English","Finnish","Swedish","Norwegian","Danish","Polish","German","Russian"];
const LANGUAGE_MODES=[
  {id:"auto-market",label:"Auto by market",hint:"Use the local market language unless the company or source looks international."},
  {id:"latvian-only",label:"Latvian only",hint:"Force Latvian outreach and customer-facing copy."},
  {id:"english-only",label:"English only",hint:"Force English outreach and customer-facing copy."},
  {id:"bilingual-lv-en",label:"Bilingual: Latvian first, English fallback",hint:"Prefer Latvian for local Latvian companies, otherwise use English."}
];
const SOURCE_PACKS={
  LV:[{id:"lv-cv",name:"CV.lv",url:"https://www.cv.lv/",group:"Jobs",cadence:"Daily"},{id:"lv-firmas",name:"Firmas.lv",url:"https://www.firmas.lv/",group:"Company activity",cadence:"Daily"},{id:"lv-lursoft",name:"Lursoft",url:"https://www.lursoft.lv/",group:"Company intelligence",cadence:"Daily"},{id:"lv-iub",name:"IUB Procurement",url:"https://www.eis.gov.lv/EKEIS/Supplier/Procurement",group:"Public procurement",cadence:"Daily"},{id:"lv-labs",name:"Labs of Latvia",url:"https://labsoflatvia.com/",group:"Startups and funding",cadence:"Daily"},{id:"lv-lsm",name:"LSM Business",url:"https://www.lsm.lv/",group:"Business news",cadence:"Daily"}],
  EE:[{id:"ee-cvkeskus",name:"CVKeskus",url:"https://www.cvkeskus.ee/",group:"Jobs",cadence:"Daily"},{id:"ee-register",name:"Estonian e-Business Register",url:"https://ariregister.rik.ee/",group:"Company activity",cadence:"Daily"},{id:"ee-riigihanked",name:"Riigihanked",url:"https://riigihanked.riik.ee/",group:"Public procurement",cadence:"Daily"},{id:"ee-err",name:"ERR Business",url:"https://www.err.ee/",group:"Business news",cadence:"Daily"},{id:"ee-startup",name:"Startup Estonia",url:"https://startupestonia.ee/",group:"Startups and funding",cadence:"Daily"}],
  LT:[{id:"lt-cvbankas",name:"CVbankas",url:"https://www.cvbankas.lt/",group:"Jobs",cadence:"Daily"},{id:"lt-register",name:"Registrų centras",url:"https://www.registrucentras.lt/",group:"Company activity",cadence:"Daily"},{id:"lt-cvonline",name:"CV-Online Lithuania",url:"https://www.cvonline.lt/",group:"Jobs",cadence:"Daily"},{id:"lt-cvpp",name:"CVPP Procurement",url:"https://cvpp.eviesiejipirkimai.lt/",group:"Public procurement",cadence:"Daily"},{id:"lt-vz",name:"Verslo žinios",url:"https://www.vz.lt/",group:"Business news",cadence:"Daily"},{id:"lt-startup",name:"Startup Lithuania",url:"https://www.startuplithuania.com/",group:"Startups and funding",cadence:"Daily"}],
  FI:[{id:"fi-business",name:"Business Finland",url:"https://www.businessfinland.fi/",group:"Investment and growth",cadence:"Daily"},{id:"fi-ytj",name:"YTJ",url:"https://www.ytj.fi/",group:"Company activity",cadence:"Daily"},{id:"fi-hilma",name:"Hilma",url:"https://www.hankintailmoitukset.fi/",group:"Public procurement",cadence:"Daily"},{id:"fi-duunitori",name:"Duunitori",url:"https://duunitori.fi/",group:"Jobs",cadence:"Daily"}],
  SE:[{id:"se-bolagsverket",name:"Bolagsverket",url:"https://www.bolagsverket.se/",group:"Company activity",cadence:"Daily"},{id:"se-jobs",name:"Arbetsförmedlingen",url:"https://arbetsformedlingen.se/",group:"Jobs",cadence:"Daily"},{id:"se-procurement",name:"Upphandlingsmyndigheten",url:"https://www.upphandlingsmyndigheten.se/",group:"Public procurement",cadence:"Daily"},{id:"se-breakit",name:"Breakit",url:"https://www.breakit.se/",group:"Business news",cadence:"Daily"}],
  NO:[{id:"no-register",name:"Brønnøysund Registers",url:"https://www.brreg.no/",group:"Company activity",cadence:"Daily"},{id:"no-nav",name:"NAV Jobs",url:"https://www.nav.no/",group:"Jobs",cadence:"Daily"},{id:"no-doffin",name:"Doffin",url:"https://www.doffin.no/",group:"Public procurement",cadence:"Daily"}],
  DK:[{id:"dk-cvr",name:"CVR",url:"https://datacvr.virk.dk/",group:"Company activity",cadence:"Daily"},{id:"dk-jobindex",name:"Jobindex",url:"https://www.jobindex.dk/",group:"Jobs",cadence:"Daily"},{id:"dk-udbud",name:"Udbud.dk",url:"https://udbud.dk/",group:"Public procurement",cadence:"Daily"}],
  PL:[{id:"pl-krs",name:"KRS",url:"https://ekrs.ms.gov.pl/",group:"Company activity",cadence:"Daily"},{id:"pl-pracuj",name:"Pracuj.pl",url:"https://www.pracuj.pl/",group:"Jobs",cadence:"Daily"},{id:"pl-procurement",name:"e-Zamówienia",url:"https://ezamowienia.gov.pl/",group:"Public procurement",cadence:"Daily"}],
  DE:[{id:"de-register",name:"Handelsregister",url:"https://www.handelsregister.de/",group:"Company activity",cadence:"Daily"},{id:"de-jobs",name:"Bundesagentur für Arbeit",url:"https://www.arbeitsagentur.de/",group:"Jobs",cadence:"Daily"},{id:"de-procurement",name:"Bund.de Procurement",url:"https://www.service.bund.de/",group:"Public procurement",cadence:"Daily"}],
  GLOBAL:[{id:"global-company",name:"Company websites",group:"Primary evidence",cadence:"On demand",sourceKind:"evidence"},{id:"global-linkedin",name:"LinkedIn public signals",url:"https://www.linkedin.com/",group:"People and hiring",cadence:"Daily",sourceKind:"public-platform"}]
};
const SOURCE_ARCHETYPES=[
  {id:"jobs",label:"Jobs and hiring",role:"Mandatory discovery",layer:"Signal",group:"Jobs",cadence:"Daily",activation:"Auto when live",costGuard:"Search/list pages only",keywords:"sales manager, head of sales, account manager, business development"},
  {id:"procurement",label:"Public procurement",role:"Mandatory discovery",layer:"Signal + product",group:"Public procurement",cadence:"Daily",activation:"Auto when live",costGuard:"Tender list + detail only",keywords:"procurement, tender, contract, sales training, CRM, digital transformation"},
  {id:"registry",label:"Company registry",role:"Mandatory verification",layer:"Company",group:"Company activity",cadence:"Daily",activation:"Auto when live",costGuard:"Company profile and recent changes only",keywords:"new company activity, directors, legal changes, filings"},
  {id:"business-news",label:"Business news",role:"Mandatory support",layer:"Signal",group:"Business news",cadence:"Daily",activation:"Auto when live",costGuard:"Business section and search pages only",keywords:"expansion, launch, investment, restructuring, leadership"},
  {id:"startup-funding",label:"Startup and funding",role:"Support discovery",layer:"Signal",group:"Startups and funding",cadence:"Daily",activation:"Review first",costGuard:"Funding/news pages only",keywords:"funding, investment, accelerator, startup, export"},
  {id:"associations",label:"Industry associations",role:"Support discovery",layer:"Company + product",group:"Industry associations",cadence:"Weekly",activation:"Review first",costGuard:"Member/news pages only",keywords:"members, events, awards, export, industry news"},
  {id:"company-websites",label:"Company websites",role:"Mandatory proof",layer:"Evidence",group:"Primary evidence",cadence:"On demand",activation:"After qualification only",costGuard:"Top 5 companies · 6 pages · depth 1",keywords:"homepage, about, services, news, careers, contact"},
  {id:"linkedin",label:"LinkedIn public signals",role:"Manual verification",layer:"People",group:"People and hiring",cadence:"Daily",activation:"Open links only",costGuard:"No scraping or automated outreach",keywords:"company page, role verification, hiring context"},
  {id:"apollo",label:"Apollo enrichment",role:"Enrichment only",layer:"Contacts",group:"Qualified contacts",cadence:"Qualified only",activation:"Settings only",costGuard:"Run after score gate; proven emails only",keywords:"verified work email, decision maker, LinkedIn URL"},
  {id:"custom",label:"Custom source",role:"Optional support",layer:"Market-specific",group:"Other",cadence:"Daily",activation:"Review first",costGuard:"HTTPS only; deterministic quality gate",keywords:"local market source selected by owner"}
];
const SOURCE_LIBRARY_BY_COUNTRY={
  LV:{jobs:"lv-cv",registry:"lv-firmas",companyIntel:"lv-lursoft",procurement:"lv-iub",businessNews:"lv-lsm",startup:"lv-labs"},
  EE:{jobs:"ee-cvkeskus",registry:"ee-register",procurement:"ee-riigihanked",businessNews:"ee-err",startup:"ee-startup"},
  LT:{jobs:"lt-cvbankas",registry:"lt-register",procurement:"lt-cvpp",businessNews:"lt-vz",startup:"lt-startup"},
  FI:{jobs:"fi-duunitori",registry:"fi-ytj",procurement:"fi-hilma",businessNews:"fi-business",startup:"fi-business"},
  SE:{jobs:"se-jobs",registry:"se-bolagsverket",procurement:"se-procurement",businessNews:"se-breakit"},
  NO:{jobs:"no-nav",registry:"no-register",procurement:"no-doffin"},
  DK:{jobs:"dk-jobindex",registry:"dk-cvr",procurement:"dk-udbud"},
  PL:{jobs:"pl-pracuj",registry:"pl-krs",procurement:"pl-procurement"},
  DE:{jobs:"de-jobs",registry:"de-register",procurement:"de-procurement"}
};
const CRM_STAGES=["Discovered","Qualified","Contact Found","Ready for Outreach","Contacted","Replied","Meeting","Proposal","Won","Lost"];
const DEFAULT_BUSINESS_PROFILE={owner:"Edgars Untāls",company:"Coaching & Consulting Group",summary:"B2B sales development, practical sales systems and AI implementation for commercial teams.",website:"",email:"",document:null,documentNotes:""};
const DEFAULT_OFFERS=[
  {id:"digital-sales-book",name:"Digital Sales Book",description:"Practical sales process, playbook, messaging, objections, scripts, onboarding and execution system.",active:true},
  {id:"ai-sales-integration",name:"AI Sales Systems Integration",description:"AI implementation in CRM, lead management, sales workflows, follow-up, automation and sales intelligence.",active:true},
  {id:"sales-team-development",name:"Sales Team Development",description:"Sales training, coaching, onboarding and sales leadership support.",active:true}
];
const DEFAULT_SIGNAL_RULES=[
  {id:"sales-hiring",name:"Sales hiring",keywords:"sales manager, head of sales, account manager, business development",weight:9,active:true},
  {id:"crm-ai",name:"CRM or AI implementation",keywords:"CRM, automation, AI, digital transformation, sales intelligence",weight:10,active:true},
  {id:"growth",name:"Expansion, funding or major project",keywords:"expansion, export, investment, funding, tender, contract, new market",weight:8,active:true},
  {id:"leadership",name:"Commercial leadership change",keywords:"appointed, promoted, new director, new manager, restructuring",weight:8,active:true},
  {id:"training",name:"Training and capability request",keywords:"sales training, coaching, onboarding, learning and development",weight:8,active:true}
];
const DEFAULT_PLAYBOOKS=[
  {id:"sales-hiring-book",name:"New sales leader · Digital Sales Book",offerId:"digital-sales-book",signalId:"sales-hiring",role:"Sales leader",channel:"Email",language:"English",sendMode:"Approval required",ctaMode:"Include in initial email",minScore:8,dailyLimit:3,requireHighConfidence:true,autoApproved:false,subject:"A practical sales system for {{company}}",body:"Hi {{first_name}},\n\nI noticed the recent {{signal_type}} at {{company}}. This kind of change often creates an immediate need for consistent messaging, onboarding and execution standards.\n\nI help commercial teams build a practical Digital Sales Book that managers and sellers can use every day. Would a short outline tailored to {{company}} be useful?\n\nBest,\nEdgars",active:true},
  {id:"crm-ai-integration",name:"CRM/AI signal · Integration",offerId:"ai-sales-integration",signalId:"crm-ai",role:"Commercial or digital leader",channel:"Email",language:"English",sendMode:"Approval required",ctaMode:"Include in initial email",minScore:8,dailyLimit:3,requireHighConfidence:true,autoApproved:false,subject:"Turning {{company}}'s AI/CRM initiative into a working sales process",body:"Hi {{first_name}},\n\nI saw the recent {{signal_type}} at {{company}}. AI and CRM projects usually create value only when the sales process, data and follow-up routines are designed together.\n\nI help teams translate that goal into a practical implementation plan. Would a one-page diagnostic for {{company}} be useful?\n\nBest,\nEdgars",active:true}
];

const demoOpportunities = [
  {
    id:"OPP-DEMO-001", company:"Nordic Flow Systems SIA", website:"https://example.com", industry:"B2B technology", location:"Riga",
    score:9.2, confidence:"High", emailed:true, status:"New", primaryOffer:"AI Sales Systems Integration",
    signal:"Hiring a Head of Sales and CRM Process Manager while announcing regional expansion.", signalType:"Hiring + expansion", signalDate:"2026-07-14",
    whyNow:"Several simultaneous commercial changes indicate an active window for redesigning sales workflows before the new team scales.",
    facts:["Two senior commercial vacancies published this week","Regional expansion mentioned in the company announcement","CRM process ownership is being created as a new function"],
    pains:["Strong inference: sales knowledge may not yet be standardized","Strong inference: CRM adoption and workflow consistency will become urgent","Hypothesis: the incoming sales leader will need a 90-day enablement plan"],
    scores:{"ICP fit":2,"Signal strength":2,"Urgency":1.4,"Recency":1,"Offer relevance":1.5,"Budget":.7,"Accessibility":.6},
    contact:{name:"Anna Ozola",role:"Commercial Director",email:"anna.ozola@example.com",emailStatus:"Verified",source:"Apollo demo verification",linkedin:"https://www.linkedin.com/",listState:"Research"},
    evidence:[{label:"Company expansion announcement",url:"https://example.com"},{label:"Head of Sales vacancy",url:"https://example.com"}]
  },
  {
    id:"OPP-DEMO-002", company:"Baltic Precision Manufacturing SIA", website:"https://example.com", industry:"Manufacturing", location:"Jelgava",
    score:8.7, confidence:"High", emailed:true, status:"Review", primaryOffer:"Digital Sales Book",
    signal:"Won a major export contract and is recruiting six account managers for new markets.", signalType:"Contract + hiring", signalDate:"2026-07-13",
    whyNow:"Fast commercial hiring after a large contract creates an immediate onboarding and sales-consistency problem.",
    facts:["Export contract publicly announced","Six account-management vacancies across two markets","New hires are expected to start within the quarter"],
    pains:["Strong inference: experienced managers will onboard people inconsistently","Strong inference: product and objection knowledge needs one shared source","Hypothesis: management needs a repeatable international sales process"],
    scores:{"ICP fit":1.8,"Signal strength":2,"Urgency":1.5,"Recency":1,"Offer relevance":1.5,"Budget":.5,"Accessibility":.4},
    contact:{name:"Mārtiņš Kalniņš",role:"Sales Director",email:"martins.kalnins@example.com",emailStatus:"Verified",source:"Public company page · demo",linkedin:"https://www.linkedin.com/",listState:"Eligible"},
    evidence:[{label:"Export contract announcement",url:"https://example.com"},{label:"Account manager vacancies",url:"https://example.com"}]
  },
  {
    id:"OPP-DEMO-003", company:"Riga Health Network AS", website:"https://example.com", industry:"Healthcare", location:"Riga",
    score:8.1, confidence:"Medium", emailed:true, status:"New", primaryOffer:"Leadership & Team Performance",
    signal:"Created three regional team-lead positions following an organizational restructuring.", signalType:"Leadership change", signalDate:"2026-07-12",
    whyNow:"New managers and changed reporting lines create a short window for leadership alignment and common operating standards.",
    facts:["Three newly created leadership roles","New regional structure described publicly","Management transition planned for the next two months"],
    pains:["Strong inference: new managers need a shared leadership model","Hypothesis: responsibilities and decision rights may be unclear","Hypothesis: cross-location communication will need reinforcement"],
    scores:{"ICP fit":1.7,"Signal strength":1.7,"Urgency":1.2,"Recency":.9,"Offer relevance":1.5,"Budget":.7,"Accessibility":.4},
    contact:{name:"Ilze Bērziņa",role:"People & Culture Director",email:"ilze.berzina@example.com",emailStatus:"Public business",source:"Company contact page · demo",linkedin:"https://www.linkedin.com/",listState:"Research"},
    evidence:[{label:"Organizational update",url:"https://example.com"}]
  },
  {
    id:"OPP-DEMO-004", company:"Green Route Logistics SIA", website:"https://example.com", industry:"Logistics", location:"Mārupe",
    score:7.8, confidence:"Medium", emailed:false, status:"Monitor", primaryOffer:"Sales Team Development",
    signal:"Opened a new Baltic service line and promoted an internal manager to Head of Business Development.", signalType:"Expansion + promotion", signalDate:"2026-07-10",
    whyNow:"A new commercial offer and first-time leader create a credible need for opportunity management and team coaching.",
    facts:["New service line launched","Business-development leadership role changed","Commercial targets expanded to three markets"],
    pains:["Strong inference: pipeline qualification must adapt to the new offer","Hypothesis: the promoted leader needs coaching in team management","Hypothesis: sales messaging differs between markets"],
    scores:{"ICP fit":1.6,"Signal strength":1.5,"Urgency":1.1,"Recency":.8,"Offer relevance":1.4,"Budget":.6,"Accessibility":.8},
    contact:{name:"Jānis Liepa",role:"Head of Business Development",email:"janis.liepa@example.com",emailStatus:"Verified",source:"Apollo demo verification",linkedin:"https://www.linkedin.com/",listState:"Research"},
    evidence:[{label:"New service announcement",url:"https://example.com"},{label:"Leadership promotion",url:"https://example.com"}]
  },
  {
    id:"OPP-DEMO-005", company:"Amber Property Group SIA", website:"https://example.com", industry:"Real estate", location:"Riga",
    score:7.4, confidence:"Medium", emailed:false, status:"Monitor", primaryOffer:"AI Sales Systems Integration",
    signal:"Published a digital-transformation role focused on CRM automation and AI-assisted customer journeys.", signalType:"AI + CRM project", signalDate:"2026-07-09",
    whyNow:"The company has stated the transformation objective, but implementation ownership and sales adoption still need validation.",
    facts:["CRM automation appears in the published role scope","AI-assisted customer journey is an explicit objective","Role reports to the commercial function"],
    pains:["Strong inference: process design must precede automation","Hypothesis: fragmented customer data may limit AI usefulness","Hypothesis: sales adoption and governance will require support"],
    scores:{"ICP fit":1.5,"Signal strength":1.5,"Urgency":1,"Recency":.7,"Offer relevance":1.5,"Budget":.8,"Accessibility":.4},
    contact:{name:"Līga Jansone",role:"Chief Commercial Officer",email:"liga.jansone@example.com",emailStatus:"Predicted",source:"Demo pattern only",linkedin:"https://www.linkedin.com/",listState:"Research"},
    evidence:[{label:"Digital transformation vacancy",url:"https://example.com"}]
  }
];

const demoSignals = [
  ...demoOpportunities.map(o=>({company:o.company,text:o.signal,type:o.signalType,date:o.signalDate,confidence:o.confidence,status:o.score>=7?"Qualified":"Monitor"})),
  {company:"Demo Retail Latvia SIA",text:"Recruiting a Learning and Development Manager.",type:"Training role",date:"2026-07-14",confidence:"Medium",status:"Triaged"},
  {company:"Demo Finance AS",text:"Announced a customer-service transformation programme.",type:"Transformation",date:"2026-07-13",confidence:"Low",status:"Research"},
  {company:"Demo Export SIA",text:"Received an export development grant.",type:"Funding",date:"2026-07-12",confidence:"High",status:"Triaged"}
];

const demoSources = [
  {name:"CV.lv",group:"Job market",cadence:"Daily",health:"Healthy",findings:18},
  {name:"WorkingDay Latvia",group:"Recruitment",cadence:"Daily",health:"Healthy",findings:7},
  {name:"Grafton Latvia",group:"Recruitment",cadence:"Daily",health:"Healthy",findings:5},
  {name:"Firmas.lv",group:"Company registry",cadence:"Daily",health:"Healthy",findings:22},
  {name:"Lursoft news",group:"Company intelligence",cadence:"Daily",health:"Review",findings:11},
  {name:"IUB procurement",group:"Public procurement",cadence:"Daily",health:"Healthy",findings:14},
  {name:"Labs of Latvia",group:"Startups and funding",cadence:"Daily",health:"Healthy",findings:9},
  {name:"Company websites",group:"Primary evidence",cadence:"On demand",health:"Healthy",findings:31},
  {name:"Apollo",group:"Contact enrichment",cadence:"Qualified only",health:"Connected",findings:5}
];

const demoRuns = [
  {id:"LV-20260715-0600",started:"15 Jul · 06:00",findings:142,qualified:9,saved:5,emailed:3,errors:1,status:"Complete"},
  {id:"LV-20260714-0600",started:"14 Jul · 06:00",findings:127,qualified:7,saved:5,emailed:3,errors:0,status:"Complete"},
  {id:"LV-20260713-0600",started:"13 Jul · 06:00",findings:98,qualified:4,saved:4,emailed:3,errors:2,status:"Partial"}
];

let opportunities=structuredClone(demoOpportunities);
let signals=structuredClone(demoSignals);
let sources=structuredClone(demoSources);
let runs=structuredClone(demoRuns);
let quality={recent_rejections:[]};
let orchestration={policy:null,budget:null};
let enrichmentControl={policy:null,usage:{daily:0,monthly:0},configured:false};

const workflowNodes = [
  {id:"sources",type:"Input",icon:"⌘",x:8.5,y:30,status:"Healthy",metric:"25 sources",lastRun:"06:00",controlLabel:"Source limit",unit:"monitored sources",config:{title:"Market sources",enabled:true,cadence:"Daily · 06:00",value:25,description:"Latvian business, procurement, recruitment and company sources.",instructions:"Monitor only approved public sources. Preserve the source URL, publication date and exact evidence for every finding."}},
  {id:"scan",type:"Collection",icon:"↻",x:25,y:30,status:"Healthy",metric:"142 findings",lastRun:"06:31",controlLabel:"Page limit",unit:"pages per source",config:{title:"Scan & collect",enabled:true,cadence:"Daily · 06:00",value:30,description:"Collect new pages, vacancies, announcements and market activity.",instructions:"Fetch only new or materially changed content. Remove duplicates and tag each finding by source, company and signal date."}},
  {id:"analysis",type:"AI reasoning",icon:"✦",x:41.5,y:30,status:"Healthy",metric:"24 signals",lastRun:"06:39",controlLabel:"Evidence minimum",unit:"independent sources",config:{title:"AI signal analysis",enabled:true,cadence:"After collection",value:1,description:"Turn raw findings into evidence-backed commercial signals.",instructions:"Separate verified facts from inference. Detect hiring, funding, expansion, leadership, CRM, AI, training and sales-process signals."}},
  {id:"score",type:"Decision",icon:"◆",x:58,y:30,status:"Review",metric:"9 qualified",lastRun:"06:44",controlLabel:"Minimum score",unit:"points out of 10",config:{title:"Opportunity scoring",enabled:true,cadence:"After analysis",value:7,description:"Rank each company against Edgars' offers and active buying signals.",instructions:"Score ICP fit, signal strength, urgency, recency, offer relevance, likely budget and decision-maker accessibility. Explain every score."}},
  {id:"shortlist",type:"Output",icon:"★",x:74.5,y:30,status:"Healthy",metric:"5 saved",lastRun:"06:47",controlLabel:"Daily shortlist",unit:"companies saved",config:{title:"Save top 5",enabled:true,cadence:"Daily",value:5,description:"Save the strongest opportunities and their complete dossiers in the app.",instructions:"Keep the five highest-scoring companies that pass the evidence rule. Prefer opportunities with a verified business contact."}},
  {id:"contacts",type:"Enrichment",icon:"◎",x:91,y:30,status:"Review",metric:"3 verified",lastRun:"06:49",controlLabel:"Contacts per lead",unit:"primary decision-makers",config:{title:"Contact enrichment",enabled:true,cadence:"Qualified only",value:1,description:"Find the most relevant decision-maker and verify business contact data.",instructions:"Use Apollo and public company evidence. Keep predicted emails hidden and research-only until independently verified."}},
  {id:"email",type:"Delivery",icon:"✉",x:82,y:72,status:"Healthy",metric:"3 emailed",lastRun:"06:52",controlLabel:"Morning brief",unit:"opportunities emailed",config:{title:"Email top 3",enabled:true,cadence:"Daily · 07:00",value:3,description:"Send Edgars a concise internal brief with the three strongest opportunities.",instructions:"Include one primary decision-maker per company, the opportunity score, why now, pain points, evidence and verified contact data when available."}},
  {id:"match",type:"Routing",icon:"⇄",status:"Healthy",metric:"2 playbooks",lastRun:"Ready",controlLabel:"Matching threshold",unit:"minimum rule score",config:{title:"Match signal to playbook",enabled:true,cadence:"After enrichment",value:7,description:"Select an approved script using the signal, offer, role and language.",instructions:"Use only active playbooks. Prefer an exact signal and offer match; route unmatched opportunities to review."}},
  {id:"message",type:"Content",icon:"✎",status:"Healthy",metric:"Personalized",lastRun:"Ready",controlLabel:"Daily generation cap",unit:"messages per day",config:{title:"Personalize message",enabled:true,cadence:"After enrichment",value:5,description:"Populate the approved subject and message template with verified opportunity data.",instructions:"Use controlled fields only. Never invent facts, budgets, relationships or pain points."}},
  {id:"safety",type:"Compliance",icon:"◈",status:"Healthy",metric:"7 checks",lastRun:"Ready",controlLabel:"Safety checks",unit:"required checks",config:{title:"Eligibility & safety gate",enabled:true,cadence:"Before delivery",value:7,description:"Validate evidence, contact eligibility, suppression, frequency and daily limits.",instructions:"Block personal emails, predicted addresses, duplicates, unsubscribed contacts and messages above the daily cap."}},
  {id:"outreach",type:"Approval",icon:"✓",status:"Planned",metric:"Conditional",lastRun:"On demand",controlLabel:"Approval route",unit:"manual-review route",config:{title:"Human review",enabled:true,cadence:"On demand",value:1,description:"Review messages from approval-required playbooks or failed automatic checks.",instructions:"Allow editing, approval, rejection or returning the lead to research."}},
  {id:"delivery",type:"Delivery",icon:"➤",status:"Planned",metric:"Sender needed",lastRun:"Not connected",controlLabel:"Daily send cap",unit:"emails per day",config:{title:"Send or export",enabled:true,cadence:"After safety gate",value:5,description:"Deliver eligible messages automatically or export approved drafts when no sender is connected.",instructions:"Send at most five messages per day. Record provider response and never report delivery without confirmation."}},
  {id:"tracking",type:"Audit",icon:"↗",status:"Planned",metric:"Audit trail",lastRun:"Not connected",controlLabel:"Follow-up delay",unit:"days before follow-up",config:{title:"Delivery & reply tracking",enabled:true,cadence:"After delivery",value:4,description:"Track queued, sent, delivered, replied, bounced, suppressed and unsubscribed outcomes.",instructions:"Stop follow-up after reply, bounce, suppression or unsubscribe. Preserve every transition in the audit log."}},
  {id:"booking",type:"Scheduling",icon:"◷",status:"Healthy",metric:"30 min · Zoom",lastRun:"Link ready",controlLabel:"Meeting duration",unit:"minutes",config:{title:"Calendly Strategy Call",enabled:true,cadence:"On demand",value:30,description:"Let an interested prospect choose an available 30-minute Zoom slot.",instructions:"Use the configured Calendly event link. Calendly owns availability and creates the Zoom meeting after booking."}},
  {id:"meeting",type:"Conversion",icon:"✓",status:"Planned",metric:"Webhook needed",lastRun:"Manual fallback",controlLabel:"CRM stage",unit:"meeting stage",config:{title:"Meeting booked",enabled:true,cadence:"After booking",value:1,description:"Record the confirmed appointment and move the opportunity to the Meeting stage.",instructions:"Use the Calendly booking webhook when connected. Until then, mark the meeting booked manually and preserve an audit event."}}
];

const workflowEdges = [
  {from:"sources",to:"scan"},{from:"scan",to:"analysis"},{from:"analysis",to:"score"},
  {from:"score",to:"shortlist"},{from:"shortlist",to:"contacts"},{from:"contacts",to:"email",branch:true},
  {from:"contacts",to:"match",branch:true},{from:"match",to:"message"},{from:"message",to:"safety"},
  {from:"safety",to:"outreach",branch:true},{from:"safety",to:"delivery",branch:true},{from:"outreach",to:"delivery"},{from:"delivery",to:"tracking"},{from:"tracking",to:"booking"},{from:"booking",to:"meeting"}
];

const defaultWorkflowLayout = Object.freeze({
  sources:{x:90,y:170},scan:{x:290,y:170},analysis:{x:490,y:170},score:{x:690,y:170},shortlist:{x:890,y:170},contacts:{x:1090,y:170},
  email:{x:1030,y:420},match:{x:1250,y:300},message:{x:1450,y:300},safety:{x:1450,y:510},outreach:{x:1250,y:690},delivery:{x:1420,y:690},tracking:{x:1600,y:690},booking:{x:1770,y:510},meeting:{x:1770,y:690}
});

const workflowDestinations = Object.freeze({
  sources:"sources", scan:"runs", analysis:"signals", score:"signals",
  shortlist:"companies", contacts:"contacts", email:"today", match:"control", message:"outreach", safety:"outreach", outreach:"outreach", delivery:"outreach", tracking:"runs", booking:"settings", meeting:"crm"
});

const defaultWorkflowConfigs = Object.fromEntries(workflowNodes.map(node=>[node.id,structuredClone(node.config)]));

const defaultState = {
  schemaVersion:STATE_SCHEMA_VERSION,
  statuses:Object.fromEntries(demoOpportunities.map(o=>[o.id,o.status])),
  listStates:Object.fromEntries(demoOpportunities.map(o=>[o.id,o.contact.listState])),
  settings:{emailCount:3,appCount:5,minScore:7,languageMode:"auto-market",internalLanguage:"English",outreachFallbackLanguage:"English"},
  workspace:{id:"edgars-latvia",name:"Edgars · Latvia",market:"Latvia"},
  activeMarketProfileId:"latvia",
  marketProfiles:structuredClone(MARKET_PROFILES),
  businessProfile:structuredClone(DEFAULT_BUSINESS_PROFILE),
  offers:structuredClone(DEFAULT_OFFERS),
  signalRules:structuredClone(DEFAULT_SIGNAL_RULES),
  playbooks:structuredClone(DEFAULT_PLAYBOOKS),
  customSources:[],
  sourceDrafts:{},
  ui:{controlSections:{markets:true,profile:true,offers:false,signals:false,playbooks:false},signalRulesExpanded:true},
  crm:{stageOrder:structuredClone(CRM_STAGES),records:{}},
  outreachDrafts:{},outreachAudit:[],
  outreachAutomation:{enabled:true,dailyLimit:5,senderConnected:false,requireVerifiedWorkEmail:true,suppressionDays:30},
  scheduling:{bookingUrl:"https://calendly.com/edgars-7go/strategy-call",eventName:"Strategy Call",duration:30,platform:"Zoom",ctaCopy:"If this is relevant, choose a convenient time for a focused 30-minute Strategy Call: {{booking_link}}",bookingWebhookConnected:false},
  integrations:{dataUrl:"",runUrl:""},
  runtime:{mode:"demo",lastSync:"",lastRunRequest:"",error:""},
  runtimeData:null,
  map:{publishedConfigs:structuredClone(defaultWorkflowConfigs),draftConfigs:structuredClone(defaultWorkflowConfigs),publishedLayout:structuredClone(defaultWorkflowLayout),draftLayout:structuredClone(defaultWorkflowLayout),viewport:{zoom:0.82,panX:0,panY:22,initialized:false},version:1,lastPublished:"15 Jul 2026 · system baseline",history:[{version:1,date:"15 Jul 2026 · system baseline",changes:0}],tests:{}}
};

let state = loadState();
let currentSignalFilter = "All";
let currentContactFilter = "All";
let crmSearch="";
let crmStageFilter="All";
let selectedMapNode = "sources";
let mapArrangeMode=false;
let selectedMapInspectorTab="configuration";
let mapInspectorCollapsed=false;
let mapInspectorFocused=false;
let mapFullscreenMode=false;
let mapPointerSession=null;
let suppressMapClick=false;
let mapViewportSaveTimer=null;

function isRecord(value){return Boolean(value)&&typeof value==="object"&&!Array.isArray(value);}
function normalizeWorkflowConfig(base,value){
  const saved=isRecord(value)?value:{};
  const numeric=Number(saved.value);
  return {
    title:typeof saved.title==="string"&&saved.title.trim()?saved.title:base.title,
    enabled:typeof saved.enabled==="boolean"?saved.enabled:base.enabled,
    cadence:typeof saved.cadence==="string"&&saved.cadence.trim()?saved.cadence:base.cadence,
    value:Number.isFinite(numeric)?numeric:base.value,
    description:typeof saved.description==="string"&&saved.description.trim()?saved.description:base.description,
    instructions:typeof saved.instructions==="string"&&saved.instructions.trim()?saved.instructions:base.instructions
  };
}
function normalizeWorkflowCollection(saved){
  const source=isRecord(saved)?saved:{};
  return Object.fromEntries(workflowNodes.map(node=>[node.id,normalizeWorkflowConfig(node.config,source[node.id])]));
}
function normalizeWorkflowLayout(saved){
  const source=isRecord(saved)?saved:{};
  return Object.fromEntries(workflowNodes.map(node=>{
    const fallback=defaultWorkflowLayout[node.id];const item=isRecord(source[node.id])?source[node.id]:{};
    const x=Number(item.x),y=Number(item.y);
    return [node.id,{x:Number.isFinite(x)?Math.max(72,Math.min(MAP_WORLD.width-72,x)):fallback.x,y:Number.isFinite(y)?Math.max(62,Math.min(MAP_WORLD.height-62,y)):fallback.y}];
  }));
}
function normalizeArray(value,fallback){return Array.isArray(value)&&value.length?value.filter(isRecord):structuredClone(fallback);}
function loadState(){
  try{
    const parsed=JSON.parse(localStorage.getItem(STORAGE_KEY)||"{}");
    const saved=isRecord(parsed)?parsed:{};
    const savedMap=isRecord(saved.map)?saved.map:{};
    const settings=isRecord(saved.settings)?saved.settings:{};
    const workspace=isRecord(saved.workspace)?saved.workspace:{};
    const integrations=isRecord(saved.integrations)?saved.integrations:{};
    const runtime=isRecord(saved.runtime)?saved.runtime:{};
    const crm=isRecord(saved.crm)?saved.crm:{};
    const businessProfile=isRecord(saved.businessProfile)?saved.businessProfile:{};
    const ui=isRecord(saved.ui)?saved.ui:{};
    const controlSections=isRecord(ui.controlSections)?ui.controlSections:{};
    const mapHistory=Array.isArray(savedMap.history)?savedMap.history.filter(isRecord):defaultState.map.history;
    const emailCount=Number(settings.emailCount);
    const appCount=Number(settings.appCount);
    const minScore=Number(settings.minScore);
    const allowedLanguageModes=new Set(LANGUAGE_MODES.map(item=>item.id));
    const languageMode=typeof settings.languageMode==="string"?settings.languageMode:defaultState.settings.languageMode;
    const internalLanguage=typeof settings.internalLanguage==="string"&&settings.internalLanguage.trim()?settings.internalLanguage.trim():defaultState.settings.internalLanguage;
    const outreachFallbackLanguage=typeof settings.outreachFallbackLanguage==="string"&&settings.outreachFallbackLanguage.trim()?settings.outreachFallbackLanguage.trim():defaultState.settings.outreachFallbackLanguage;
    return {
      ...structuredClone(defaultState),
      schemaVersion:STATE_SCHEMA_VERSION,
      statuses:{...defaultState.statuses,...(isRecord(saved.statuses)?saved.statuses:{})},
      listStates:{...defaultState.listStates,...(isRecord(saved.listStates)?saved.listStates:{})},
      settings:{
        emailCount:Number.isInteger(emailCount)&&emailCount>=1&&emailCount<=5?emailCount:defaultState.settings.emailCount,
        appCount:Number.isInteger(appCount)&&appCount>=3&&appCount<=10?appCount:defaultState.settings.appCount,
        minScore:Number.isFinite(minScore)&&minScore>=1&&minScore<=10?minScore:defaultState.settings.minScore,
        languageMode:allowedLanguageModes.has(languageMode)?languageMode:defaultState.settings.languageMode,
        internalLanguage,
        outreachFallbackLanguage
      },
      workspace:{
        id:typeof workspace.id==="string"&&workspace.id.trim()?workspace.id.trim():defaultState.workspace.id,
        name:typeof workspace.name==="string"&&workspace.name.trim()?workspace.name.trim():defaultState.workspace.name,
        market:typeof workspace.market==="string"&&workspace.market.trim()?workspace.market.trim():defaultState.workspace.market
      },
      activeMarketProfileId:typeof saved.activeMarketProfileId==="string"?saved.activeMarketProfileId:defaultState.activeMarketProfileId,
      marketProfiles:normalizeArray(saved.marketProfiles,MARKET_PROFILES),
      businessProfile:{
        ...structuredClone(DEFAULT_BUSINESS_PROFILE),
        ...businessProfile,
        document:isRecord(businessProfile.document)?businessProfile.document:null,
        documentNotes:typeof businessProfile.documentNotes==="string"?businessProfile.documentNotes:""
      },
      offers:normalizeArray(saved.offers,DEFAULT_OFFERS),
      signalRules:normalizeArray(saved.signalRules,DEFAULT_SIGNAL_RULES),
      playbooks:normalizeArray(saved.playbooks,DEFAULT_PLAYBOOKS),
      customSources:Array.isArray(saved.customSources)?saved.customSources.filter(isRecord):[],
      sourceDrafts:isRecord(saved.sourceDrafts)?saved.sourceDrafts:{},
      ui:{controlSections:{...defaultState.ui.controlSections,...controlSections},signalRulesExpanded:typeof ui.signalRulesExpanded==="boolean"?ui.signalRulesExpanded:defaultState.ui.signalRulesExpanded},
      crm:{stageOrder:Array.isArray(crm.stageOrder)?crm.stageOrder:structuredClone(CRM_STAGES),records:isRecord(crm.records)?crm.records:{}},
      outreachDrafts:isRecord(saved.outreachDrafts)?saved.outreachDrafts:{},
      outreachAudit:Array.isArray(saved.outreachAudit)?saved.outreachAudit.filter(isRecord):[],
      outreachAutomation:{
        ...structuredClone(defaultState.outreachAutomation),
        ...(isRecord(saved.outreachAutomation)?saved.outreachAutomation:{}),
        enabled:typeof saved.outreachAutomation?.enabled==="boolean"?saved.outreachAutomation.enabled:defaultState.outreachAutomation.enabled,
        dailyLimit:Math.max(3,Math.min(5,Number(saved.outreachAutomation?.dailyLimit)||defaultState.outreachAutomation.dailyLimit)),
        senderConnected:Boolean(saved.outreachAutomation?.senderConnected),
        requireVerifiedWorkEmail:true
      },
      scheduling:{...structuredClone(defaultState.scheduling),...(isRecord(saved.scheduling)?saved.scheduling:{}),bookingUrl:typeof saved.scheduling?.bookingUrl==="string"?saved.scheduling.bookingUrl:defaultState.scheduling.bookingUrl,bookingWebhookConnected:Boolean(saved.scheduling?.bookingWebhookConnected)},
      integrations:{
        dataUrl:typeof integrations.dataUrl==="string"?integrations.dataUrl:"",
        runUrl:typeof integrations.runUrl==="string"?integrations.runUrl:""
      },
      runtime:{...structuredClone(defaultState.runtime),...runtime},
      runtimeData:isRecord(saved.runtimeData)?saved.runtimeData:null,
      map:{...structuredClone(defaultState.map),...savedMap,
        version:Number.isInteger(Number(savedMap.version))&&Number(savedMap.version)>0?Number(savedMap.version):defaultState.map.version,
        lastPublished:typeof savedMap.lastPublished==="string"?savedMap.lastPublished:defaultState.map.lastPublished,
        publishedConfigs:normalizeWorkflowCollection(savedMap.publishedConfigs),
        draftConfigs:normalizeWorkflowCollection(savedMap.draftConfigs||savedMap.publishedConfigs),
        publishedLayout:normalizeWorkflowLayout(savedMap.publishedLayout),
        draftLayout:normalizeWorkflowLayout(savedMap.draftLayout||savedMap.publishedLayout),
        viewport:{zoom:Math.max(.5,Math.min(1.5,Number(savedMap.viewport?.zoom)||defaultState.map.viewport.zoom)),panX:Number(savedMap.viewport?.panX)||0,panY:Number(savedMap.viewport?.panY)||0,initialized:Boolean(savedMap.viewport?.initialized)},
        history:mapHistory,
        tests:isRecord(savedMap.tests)?savedMap.tests:{}}
    };
  }
  catch{return structuredClone(defaultState);}
}

function openDocumentDb(){
  return new Promise((resolve,reject)=>{
    if(!("indexedDB" in window)){reject(new Error("Browser document storage is unavailable"));return;}
    const request=indexedDB.open(DOCUMENT_DB_NAME,1);
    request.onupgradeneeded=()=>{if(!request.result.objectStoreNames.contains(DOCUMENT_STORE_NAME))request.result.createObjectStore(DOCUMENT_STORE_NAME);};
    request.onsuccess=()=>resolve(request.result);
    request.onerror=()=>reject(request.error||new Error("Could not open document storage"));
  });
}
async function getProfileDocument(){
  const db=await openDocumentDb();
  return new Promise((resolve,reject)=>{
    const request=db.transaction(DOCUMENT_STORE_NAME,"readonly").objectStore(DOCUMENT_STORE_NAME).get(BUSINESS_PROFILE_PDF_KEY);
    request.onsuccess=()=>{db.close();resolve(request.result||null);};
    request.onerror=()=>{db.close();reject(request.error);};
  });
}
async function putProfileDocument(file){
  const db=await openDocumentDb();
  return new Promise((resolve,reject)=>{
    const transaction=db.transaction(DOCUMENT_STORE_NAME,"readwrite");
    transaction.objectStore(DOCUMENT_STORE_NAME).put(file,BUSINESS_PROFILE_PDF_KEY);
    transaction.oncomplete=()=>{db.close();resolve();};
    transaction.onerror=()=>{db.close();reject(transaction.error);};
  });
}
async function deleteProfileDocument(){
  const db=await openDocumentDb();
  return new Promise((resolve,reject)=>{
    const transaction=db.transaction(DOCUMENT_STORE_NAME,"readwrite");
    transaction.objectStore(DOCUMENT_STORE_NAME).delete(BUSINESS_PROFILE_PDF_KEY);
    transaction.oncomplete=()=>{db.close();resolve();};
    transaction.onerror=()=>{db.close();reject(transaction.error);};
  });
}
function formatBytes(bytes){
  if(!Number.isFinite(bytes)||bytes<=0)return "0 KB";
  if(bytes<1024*1024)return `${Math.max(1,Math.round(bytes/1024))} KB`;
  return `${(bytes/(1024*1024)).toFixed(1)} MB`;
}
function saveState(){localStorage.setItem(STORAGE_KEY,JSON.stringify(state));}
function activeMarket(){return state.marketProfiles.find(item=>item.id===state.activeMarketProfileId)||state.marketProfiles[0]||MARKET_PROFILES[0];}
function sourcePackForMarket(market=activeMarket()){
  const runtimeByName=new Map(sources.map(item=>[String(item.name||"").toLowerCase(),item]));
  const seen=new Set();
  const builtIn=[...(market.countryCodes||[]),"GLOBAL"].flatMap(code=>(SOURCE_PACKS[code]||[]).map(item=>({...item,country:code,custom:false})));
  const custom=state.customSources.filter(item=>item.marketProfileId===market.id).map(item=>({...item,custom:true,country:item.country||market.countryCodes?.[0]||"GLOBAL"}));
  return [...builtIn,...custom].filter(item=>{
    if(seen.has(item.id))return false;seen.add(item.id);return true;
  }).map(item=>{const runtime=runtimeByName.get(item.name.toLowerCase());const role=sourceRoleForSource(item);return {...item,sourceRole:role.role,sourceLayer:role.layer,costGuard:role.costGuard,health:runtime?.health||"Ready",findings:Number(runtime?.findings)||0};});
}
function sourceEnabled(market,id){return !Array.isArray(market.enabledSourceIds)||market.enabledSourceIds.includes(id);}
function sourceRoleForSource(source){
  const group=String(source?.group||"").toLowerCase();
  const id=String(source?.id||"").toLowerCase();
  if(id==="global-company"||source?.sourceKind==="evidence")return SOURCE_ARCHETYPES.find(item=>item.id==="company-websites");
  if(id==="global-linkedin"||source?.sourceKind==="public-platform")return SOURCE_ARCHETYPES.find(item=>item.id==="linkedin");
  if(group.includes("job")||group.includes("hiring"))return SOURCE_ARCHETYPES.find(item=>item.id==="jobs");
  if(group.includes("procurement"))return SOURCE_ARCHETYPES.find(item=>item.id==="procurement");
  if(group.includes("registry")||group.includes("company activity")||group.includes("company intelligence"))return SOURCE_ARCHETYPES.find(item=>item.id==="registry");
  if(group.includes("startup")||group.includes("funding")||group.includes("investment"))return SOURCE_ARCHETYPES.find(item=>item.id==="startup-funding");
  if(group.includes("business news"))return SOURCE_ARCHETYPES.find(item=>item.id==="business-news");
  if(group.includes("association")||group.includes("member"))return SOURCE_ARCHETYPES.find(item=>item.id==="associations");
  return SOURCE_ARCHETYPES.find(item=>item.id==="custom");
}
function draftSourceKey(market=activeMarket()){return market.id||market.name||"active";}
function sourceByIdForMarket(market,id){return sourcePackForMarket(market).find(item=>item.id===id)||null;}
function sourceDraftItem(market,archetypeId,options={}){
  const archetype=SOURCE_ARCHETYPES.find(item=>item.id===archetypeId);
  const existing=options.sourceId?sourceByIdForMarket(market,options.sourceId):null;
  return {
    id:archetype.id,
    label:archetype.label,
    role:archetype.role,
    layer:archetype.layer,
    group:archetype.group,
    cadence:archetype.cadence,
    activation:archetype.activation,
    costGuard:archetype.costGuard,
    keywords:options.keywords||archetype.keywords,
    sourceId:existing?.id||"",
    sourceName:existing?.name||options.name||`Add ${archetype.label} source`,
    url:existing?.url||options.url||"",
    country:options.country||market.countryCodes?.[0]||"GLOBAL",
    action:existing?"enable":options.url?"add":"needs-url",
    confidence:existing?"Known pack":options.url?"Candidate URL":"Needs URL"
  };
}
function buildSourcePackDraft(market=activeMarket()){
  const primaryCode=(market.countryCodes||[])[0]||"GLOBAL";
  const library=SOURCE_LIBRARY_BY_COUNTRY[primaryCode]||{};
  const items=[
    sourceDraftItem(market,"jobs",{sourceId:library.jobs,country:primaryCode}),
    sourceDraftItem(market,"procurement",{sourceId:library.procurement,country:primaryCode}),
    sourceDraftItem(market,"registry",{sourceId:library.registry,country:primaryCode}),
    sourceDraftItem(market,"business-news",{sourceId:library.businessNews,country:primaryCode}),
    sourceDraftItem(market,"startup-funding",{sourceId:library.startup,country:primaryCode}),
    sourceDraftItem(market,"associations",{country:primaryCode,name:`${market.name} industry association source`}),
    sourceDraftItem(market,"company-websites",{sourceId:"global-company",country:"GLOBAL"}),
    sourceDraftItem(market,"linkedin",{sourceId:"global-linkedin",country:"GLOBAL"}),
    sourceDraftItem(market,"apollo",{name:"Apollo enrichment",url:"https://app.apollo.io/",country:"GLOBAL"}),
    sourceDraftItem(market,"custom",{country:primaryCode,name:`${market.name} custom market monitor`})
  ];
  return {marketId:market.id,marketName:market.name,country:market.countries?.[0]||market.name,generatedAt:new Date().toISOString(),mode:"local-deterministic",items};
}
function currentSourceDraft(market=activeMarket()){return state.sourceDrafts?.[draftSourceKey(market)]||null;}
function sourceDraftRoleClass(role=""){return /mandatory/i.test(role)?"mandatory":/enrichment/i.test(role)?"enrichment":/manual/i.test(role)?"manual":/support/i.test(role)?"support":"optional";}
function renderSourcePackGenerator(market=activeMarket()){
  const draft=currentSourceDraft(market);
  if(!draft)return `<div class="source-generator-panel wide"><div><p class="kicker">Source architecture</p><h4>Generate a regional source pack</h4><span>Creates a review draft with mandatory discovery, support, proof, manual and enrichment roles. No paid AI call.</span></div><button type="button" class="btn primary" id="generate-source-pack-panel">Generate source pack</button></div>`;
  return `<div class="source-generator-panel wide has-draft"><div class="source-generator-head"><div><p class="kicker">Generated source architecture</p><h4>${esc(draft.marketName)} source pack draft</h4><span>Local deterministic draft · generated ${esc(new Date(draft.generatedAt).toLocaleString())}. Apply only safe public sources; Apollo stays in Settings.</span></div><div class="source-pack-actions"><button type="button" class="btn secondary" id="discard-source-pack-draft">Discard draft</button><button type="button" class="btn primary" id="apply-source-pack-draft">Apply safe sources</button></div></div><div class="source-draft-grid">${draft.items.map(item=>`<article class="source-draft-card ${sourceDraftRoleClass(item.role)}"><div><strong>${esc(item.label)}</strong><span class="mini-badge">${esc(item.role)}</span></div><p>${esc(item.sourceName)}</p><small>${esc(item.layer)} · ${esc(item.cadence)} · ${esc(item.activation)}</small><em>${item.url?`<a href="${esc(item.url)}" target="_blank" rel="noopener">${esc(new URL(item.url).hostname.replace(/^www\./,""))} ↗</a>`:"Needs local URL before activation"}</em><b>${esc(item.costGuard)}</b></article>`).join("")}</div></div>`;
}
function generateSourcePackDraft(){
  readControlCentre();
  const market=activeMarket();
  state.sourceDrafts={...(state.sourceDrafts||{}),[draftSourceKey(market)]:buildSourcePackDraft(market)};
  saveState();renderControlCentre();showToast(`${market.name} source pack draft generated`);
}
function applySourcePackDraft(){
  readControlCentre();
  const market=activeMarket();
  const draft=currentSourceDraft(market);
  if(!draft){showToast("Generate a source pack draft first");return;}
  const pack=sourcePackForMarket(market);
  if(!Array.isArray(market.enabledSourceIds))market.enabledSourceIds=pack.map(item=>item.id);
  let enabledCount=0,addedCount=0,reviewCount=0;
  draft.items.forEach(item=>{
    if(/enrichment|manual/i.test(item.role)){reviewCount++;return;}
    if(item.sourceId){
      if(!market.enabledSourceIds.includes(item.sourceId)){market.enabledSourceIds.push(item.sourceId);enabledCount++;}
      return;
    }
    const url=safeUrl(item.url);
    if(!url){reviewCount++;return;}
    const exists=sourcePackForMarket(market).some(source=>String(source.url||"").replace(/\/$/,"")===url.replace(/\/$/,""));
    if(exists){reviewCount++;return;}
    const id=makeId("source",item.sourceName);
    state.customSources.push({id,marketProfileId:market.id,name:item.sourceName,url,group:item.group,cadence:item.cadence,country:item.country,languages:market.languages||[],keywords:item.keywords,custom:true,sourceRole:item.role,sourceLayer:item.layer,costGuard:item.costGuard});
    market.enabledSourceIds.push(id);addedCount++;
  });
  saveState();renderAll();showToast(`Source pack applied: ${addedCount} added, ${enabledCount} enabled, ${reviewCount} kept for review`);
}
function discardSourcePackDraft(){
  const market=activeMarket();
  if(state.sourceDrafts)delete state.sourceDrafts[draftSourceKey(market)];
  saveState();renderControlCentre();showToast("Source pack draft discarded");
}
function makeId(prefix,name=""){return `${prefix}-${String(name||Date.now()).toLowerCase().replace(/[^a-z0-9]+/g,"-").replace(/^-|-$/g,"")}-${Date.now().toString(36).slice(-4)}`;}
function esc(value){return String(value??"").replace(/[&<>'"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;","'":"&#39;",'"':"&quot;"}[c]));}
function marketSummary(market=activeMarket()){
  const countries=(market.countries||[]).join(", ")||"No countries selected";
  const languages=(market.languages||[]).join(" · ")||"No languages selected";
  return `${countries} · ${languages}`;
}
function initials(name){return name.split(/\s+/).map(p=>p[0]).slice(0,2).join("").toUpperCase();}
function showToast(message){const el=document.getElementById("toast");el.textContent=message;el.classList.add("show");setTimeout(()=>el.classList.remove("show"),2200);}
function statusClass(value){return /verified|eligible|healthy|complete|qualified|connected/i.test(value)?"good":/predicted|review|partial|monitor|triaged|planned|not live|ready|configured/i.test(value)?"warn":"bad";}
function firstValue(row,keys,fallback=""){for(const key of keys){if(row?.[key]!==undefined&&row[key]!==null&&String(row[key]).trim()!=="")return row[key];}return fallback;}
function numberValue(value,fallback=0){const parsed=Number(value);return Number.isFinite(parsed)?parsed:fallback;}
function listValue(value){if(Array.isArray(value))return value.filter(Boolean).map(String);if(typeof value!=="string"||!value.trim())return [];try{const parsed=JSON.parse(value);if(Array.isArray(parsed))return parsed.map(String);}catch{}return value.split(/\n|\s*;\s*/).filter(Boolean);}
function safeUrl(value){try{const url=new URL(String(value));return ["https:","http:"].includes(url.protocol)?url.href:"";}catch{return "";}}
function linkedInLookupUrl(opportunity){
  const direct=safeUrl(opportunity?.contact?.linkedin||"");
  if(direct){
    try{
      const url=new URL(direct);
      if(/(^|\.)linkedin\.com$/i.test(url.hostname)&&url.pathname.replace(/\/+$/,"")&&url.pathname!=="/")return direct;
    }catch{}
  }
  const terms=[opportunity?.contact?.name,opportunity?.contact?.role,opportunity?.company].filter(Boolean).join(" ");
  return `https://www.linkedin.com/search/results/people/?keywords=${encodeURIComponent(terms)}`;
}
function linkedInTargetRoles(opportunity){
  const signal=`${opportunity?.signalType||""} ${opportunity?.signal||""} ${opportunity?.primaryOffer||""}`.toLowerCase();
  const groups=[
    [/crm|ai|automation|revops|sales intelligence/,["Revenue Operations","CRM Manager","Commercial Director"]],
    [/sales hiring|head of sales|sales manager|account manager|business development/,["Head of Sales","Sales Director","Commercial Director"]],
    [/training|coaching|onboarding|learning/,["Head of Sales","HR Director","Sales Enablement"]],
    [/fund|investment|expansion|export|tender|contract|procurement/,["CEO","Commercial Director","Business Development Director"]],
    [/leadership|ceo|board|director|manager|restructuring/,["CEO","Commercial Director","Head of Sales"]]
  ];
  const selected=groups.find(([pattern])=>pattern.test(signal))?.[1]||activeMarket().decisionTitles||["Sales Director","Commercial Director","CEO"];
  return [...new Set([...selected,...(activeMarket().decisionTitles||[])])].slice(0,3);
}
function linkedInContactTargets(opportunity){
  return linkedInTargetRoles(opportunity).map(role=>({
    role,
    url:`https://www.linkedin.com/search/results/people/?keywords=${encodeURIComponent(`${role} ${opportunity?.company||""}`)}`
  }));
}
function isPrivateEndpoint(value){if(!value)return true;try{const url=new URL(value);return url.protocol==="https:"||["localhost","127.0.0.1"].includes(url.hostname);}catch{return false;}}
function formatNow(){return new Intl.DateTimeFormat("en-GB",{dateStyle:"medium",timeStyle:"short",timeZone:"Europe/Riga"}).format(new Date());}
function dateAge(value){const date=new Date(value);if(Number.isNaN(date.getTime()))return null;return Math.max(0,Math.floor((Date.now()-date.getTime())/86400000));}
function sourceProfile(value){
  const url=safeUrl(value);if(!url)return {label:"No source link",tone:"weak",detail:"Cannot be independently opened"};
  const host=new URL(url).hostname.replace(/^www\./,"");
  if(/\.gov\.|gov\.lv$|iub\.gov\.lv$|ur\.gov\.lv$/.test(host))return {label:"Official source",tone:"strong",detail:host};
  if(/linkedin\.com|reddit\.com|facebook\.com/.test(host))return {label:"Public platform",tone:"review",detail:host};
  return {label:"Direct web source",tone:"good",detail:host};
}

function normalizeOpportunity(row,index=0){
  const company=String(firstValue(row,["company","company_name","Company Name","Company"],"Unknown company"));
  const score10=Math.max(0,Math.min(10,numberValue(firstValue(row,["score","score_10","Score 10","Opportunity Score /10"],numberValue(firstValue(row,["score_100","Score 100","Total Score /100"],0))/10),0)));
  const sourceUrl=safeUrl(firstValue(row,["source_url","Source URL","Source 1 URL","url"],""));
  const contactRow=isRecord(row.contact)?row.contact:{};
  const email=String(firstValue(contactRow,["email"],firstValue(row,["email","business_email","Public Business Email","Business Email"],"")));
  const emailStatus=String(firstValue(contactRow,["emailStatus","email_status"],firstValue(row,["email_status","Email Status"],email?"Public business":"Not found")));
  const contactName=String(firstValue(contactRow,["name"],firstValue(row,["decision_maker","Decision Maker","contact_name"],"Decision-maker not yet enriched")));
  const role=String(firstValue(contactRow,["role"],firstValue(row,["decision_maker_role","Decision Maker Role","Role"],"Commercial decision-maker")));
  const pains=listValue(firstValue(row,["pains","pain_points","inferred_pain_points","Pain Points"],[]));
  const evidenceText=String(firstValue(row,["factual_evidence","Factual Evidence","evidence_summary","Evidence Summary"],"Evidence summary pending"));
  const id=String(firstValue(row,["id","opportunity_id","lead_id","Lead ID","Query ID"],`LIVE-${Date.now()}-${index+1}`));
  const evidenceRows=Array.isArray(row.evidence_items)?row.evidence_items.map(item=>({claim:String(item.claim||item.claim_text||""),label:String(item.source_title||"Source evidence"),url:safeUrl(item.source_url||""),observedAt:String(item.observed_at||"")})).filter(item=>item.claim):[];
  return {
    id,company,domain:String(firstValue(row,["domain","company_domain","Company Domain"],"")).trim().toLowerCase(),website:safeUrl(firstValue(row,["website","Website","company_website","Company Website"],"")),industry:String(firstValue(row,["industry","Industry"],"Business")),location:String(firstValue(row,["location","Location"],state.workspace.market)),
    score:score10,confidence:String(firstValue(row,["confidence","Confidence"],"Medium")),emailed:Boolean(firstValue(row,["emailed"],false)),status:String(firstValue(row,["status","Status"],score10>=state.settings.minScore?"New":"Monitor")),
    primaryOffer:String(firstValue(row,["primary_offer","recommended_offer","Recommended Offer","Primary Solution","Lead Solution"],"Digital Sales Book")),
    signal:String(firstValue(row,["signal","signal_summary","Signal Summary","Evidence Summary"],"Public market signal captured")),
    signalType:String(firstValue(row,["signal_type","Signal Type","Signal"],"Market signal")),signalDate:String(firstValue(row,["signal_date","Signal Date","captured_at","Captured At","Date Found"],new Date().toISOString().slice(0,10))),
    whyNow:String(firstValue(row,["why_now","commercial_reason","Commercial Reason","Suggested Commercial Angle"],"The current signal creates a timely reason for a focused commercial conversation.")),
    facts:listValue(firstValue(row,["facts","factual_evidence","Factual Evidence","evidence_summary"],[evidenceText])).length?listValue(firstValue(row,["facts","factual_evidence","Factual Evidence","evidence_summary"],[evidenceText])):[evidenceText],
    pains:pains.length?pains:["Validate the likely operational pain directly with the decision-maker."],
    scores:isRecord(row.scores)?row.scores:{"ICP fit":Math.min(2,score10/5),"Signal strength":Math.min(2,score10/5),"Urgency":Math.min(1.5,score10*.15),"Recency":Math.min(1,score10*.1),"Offer relevance":Math.min(1.5,score10*.15),"Budget":Math.min(1,score10*.1),"Accessibility":Math.min(1,score10*.1)},
    contact:{name:contactName,role,email,emailStatus,emailType:String(firstValue(contactRow,["emailType","email_type"],firstValue(row,["email_type"],emailStatus==="Strong match"?"personal":"work"))),matchConfidence:String(firstValue(contactRow,["matchConfidence","match_confidence"],firstValue(row,["match_confidence"],""))),source:String(firstValue(contactRow,["source"],firstValue(row,["verification_provider","Verification Provider"],sourceUrl?"Public source":"Not enriched"))),linkedin:safeUrl(firstValue(contactRow,["linkedin"],firstValue(row,["linkedin_url","LinkedIn URL"],""))),listState:String(firstValue(contactRow,["listState","list_state"],firstValue(row,["list_state","List State"],"Research"))),enrichmentStatus:String(firstValue(row,["enrichment_status"],"not_requested"))},
    evidence:evidenceRows.length?evidenceRows:[{claim:evidenceText,label:String(firstValue(row,["source_title","Source Title","Page Title"],"Source evidence")),url:sourceUrl,observedAt:String(firstValue(row,["captured_at","Captured At","signal_date"],""))}],
    queryId:String(firstValue(row,["query_id","Query ID"],"")),runId:String(firstValue(row,["run_id","Run ID"],"")),keep:Boolean(firstValue(row,["keep","Keep"],score10>=state.settings.minScore)),
    pipelineStage:String(firstValue(row,["pipeline_stage","pipelineStage"],"")),nextAction:String(firstValue(row,["next_action","nextAction"],"")),notes:String(firstValue(row,["notes"],""))
  };
}

function applyRuntimePayload(payload,{persist=true,mode="imported"}={}){
  if(!isRecord(payload))throw new Error("Workspace payload must be a JSON object");
  const rows=Array.isArray(payload.opportunities)?payload.opportunities:Array.isArray(payload.qualified_leads)?payload.qualified_leads:Array.isArray(payload.findings)?payload.findings:Array.isArray(payload.raw_findings)?payload.raw_findings:[];
  const normalized=rows.map(normalizeOpportunity).filter(item=>item.company&&item.score>=0).sort((a,b)=>b.score-a.score);
  if(!normalized.length)throw new Error("No opportunities or findings were found in the payload");
  opportunities=normalized;
  signals=Array.isArray(payload.signals)?payload.signals.map((item,index)=>({company:String(firstValue(item,["company","company_name"],normalized[index]?.company||"Unknown")),text:String(firstValue(item,["text","signal","signal_summary"],"Market signal")),type:String(firstValue(item,["type","signal_type"],"Market signal")),date:String(firstValue(item,["date","signal_date"],new Date().toISOString().slice(0,10))),confidence:String(firstValue(item,["confidence"],"Medium")),status:String(firstValue(item,["status"],"Qualified"))})):normalized.map(o=>({company:o.company,text:o.signal,type:o.signalType,date:o.signalDate,confidence:o.confidence,status:o.score>=state.settings.minScore?"Qualified":"Monitor"}));
  sources=Array.isArray(payload.sources)?payload.sources.map(item=>({name:String(firstValue(item,["name","source"],"Source")),group:String(firstValue(item,["group","type"],"Public web")),cadence:String(firstValue(item,["cadence","frequency"],"Daily")),health:String(firstValue(item,["health","status"],"Healthy")),findings:numberValue(firstValue(item,["findings","count"],0))})):structuredClone(demoSources);
  runs=Array.isArray(payload.runs)?payload.runs.map((item,index)=>({id:String(firstValue(item,["id","run_id"],`RUN-${index+1}`)),started:String(firstValue(item,["started","start_time"],"—")),findings:numberValue(firstValue(item,["findings","pages_found","candidates_used"],0)),qualified:numberValue(firstValue(item,["qualified","qualified_leads"],0)),saved:numberValue(firstValue(item,["saved"],normalized.length)),emailed:numberValue(firstValue(item,["emailed"],0)),errors:numberValue(firstValue(item,["errors"],item.error_code?1:0)),status:String(firstValue(item,["status"],"Complete")),candidateBudget:numberValue(firstValue(item,["candidate_budget"],0)),attempts:numberValue(firstValue(item,["attempts"],0)),errorCode:String(firstValue(item,["error_code"],"")),errorMessage:String(firstValue(item,["error_message"],"")),test:Boolean(firstValue(item,["test"],false))})):structuredClone(demoRuns);
  quality=isRecord(payload.quality)?payload.quality:{recent_rejections:[]};
  state.statuses={...Object.fromEntries(normalized.map(o=>[o.id,o.status])),...state.statuses};
  state.listStates={...Object.fromEntries(normalized.map(o=>[o.id,o.contact.listState])),...state.listStates};
  normalized.forEach(o=>{
    const record=state.crm.records[o.id];if(!record)return;
    if(o.pipelineStage)record.stage=o.pipelineStage;
    if(o.nextAction)record.nextAction=o.nextAction;
    if(o.notes)record.notes=o.notes;
  });
  if(isRecord(payload.workspace))state.workspace={...state.workspace,...payload.workspace};
  state.runtime={...state.runtime,mode,lastSync:formatNow(),error:""};
  state.runtimeData={workspace:state.workspace,opportunities:normalized,signals,sources,runs,quality,generated_at:new Date().toISOString()};
  if(persist)saveState();
  renderAll();
}

function restoreRuntimeData(){if(isRecord(state.runtimeData)){try{applyRuntimePayload(state.runtimeData,{persist:false,mode:state.runtime.mode||"imported"});}catch{state.runtimeData=null;state.runtime.mode="demo";}}}
function exportJson(filename,value){const blob=new Blob([JSON.stringify(value,null,2)],{type:"application/json"});const url=URL.createObjectURL(blob);const link=document.createElement("a");link.href=url;link.download=filename;link.click();setTimeout(()=>URL.revokeObjectURL(url),500);}
function setBusy(id,busy,label){const button=document.getElementById(id);if(!button)return;if(busy){button.dataset.label=button.textContent;button.disabled=true;button.textContent=label;}else{button.disabled=false;button.textContent=button.dataset.label||button.textContent;}}

async function syncData({silent=false}={}){
  const url=state.integrations.dataUrl.trim();
  if(!url){if(!silent)showToast("Add a private snapshot endpoint in Settings");return false;}
  if(!isPrivateEndpoint(url)){showToast("Use an HTTPS endpoint");return false;}
  setBusy("sync-btn",true,"Syncing…");
  try{
    const payload=/script\.google\.com$/.test(new URL(url).hostname)?await fetchJsonp(url):await fetchJson(url);
    applyRuntimePayload(payload,{mode:"live"});showToast(`Synced ${opportunities.length} opportunities`);return true;
  }
  catch(error){state.runtime.error=error.message;saveState();renderRuntimeStatus();showToast(`Sync failed: ${error.message}`);return false;}
  finally{setBusy("sync-btn",false,"Sync data");}
}

async function fetchJson(url){
  const response=await fetch(url,{credentials:"include",headers:{Accept:"application/json"}});
  if(!response.ok)throw new Error(`Endpoint returned ${response.status}`);
  return response.json();
}

async function refreshBackendSession(){
  try{
    const response=await fetch(`${BACKEND_API_URL}/api/session`,{credentials:"include",headers:{Accept:"application/json"}});
    backendSession=response.ok?(await response.json()).user:null;
  }catch{backendSession=null;}
  if(backendSession)await Promise.all([loadRunPolicy(),loadEnrichmentPolicy()]);else {orchestration={policy:null,budget:null};enrichmentControl={policy:null,usage:{daily:0,monthly:0},configured:false};}
  renderBackendAccess();return backendSession;
}

async function loadRunPolicy(){
  if(!backendSession)return null;
  try{
    const response=await fetch(`${BACKEND_API_URL}/api/run-policy?workspace_id=${encodeURIComponent(state.workspace.id)}`,{credentials:"include",headers:{Accept:"application/json"}});
    if(!response.ok)throw new Error(`Policy returned ${response.status}`);
    orchestration=await response.json();renderRuns();return orchestration;
  }catch{orchestration={policy:null,budget:null};return null;}
}

async function loadEnrichmentPolicy(){
  if(!backendSession)return null;
  try{
    const response=await fetch(`${BACKEND_API_URL}/api/enrichment-policy?workspace_id=${encodeURIComponent(state.workspace.id)}`,{credentials:"include",headers:{Accept:"application/json"}});
    if(!response.ok)throw new Error(`Enrichment policy returned ${response.status}`);
    enrichmentControl=await response.json();renderContacts();renderRuntimeStatus();return enrichmentControl;
  }catch{enrichmentControl={policy:null,usage:{daily:0,monthly:0},configured:false};return null;}
}

async function enrichOpportunity(id,{allowPersonal=false}={}){
  if(!backendSession){showToast("Sign in securely before using Apollo");switchView("settings");return false;}
  if(allowPersonal){
    const approved=window.confirm("Owner exception: continue only if you have documented consent, an existing relationship, or another reviewed lawful basis. A personal email may consume an Apollo credit and will not become campaign-eligible automatically. Continue?");
    if(!approved)return false;
  }
  let opportunity=opportunities.find(item=>item.id===id);
  if(!opportunity?.domain&&!opportunity?.website){
    const supplied=window.prompt(`Enter the verified company website or domain for ${opportunity?.company||"this company"}. Apollo will only accept an email on this domain.`)?.trim();
    if(!supplied)return false;
    try{
      const response=await fetch(`${BACKEND_API_URL}/api/opportunities/${encodeURIComponent(id)}?workspace_id=${encodeURIComponent(state.workspace.id)}`,{method:"PATCH",credentials:"include",headers:{"Content-Type":"application/json",Accept:"application/json"},body:JSON.stringify({company_domain:supplied})});
      const result=await response.json().catch(()=>({}));
      if(!response.ok)throw new Error(result.error||"Enter a valid company domain");
      await syncData({silent:true});opportunity=opportunities.find(item=>item.id===id);
      showToast(`Company domain verified · ${result.company_domain}`);
    }catch(error){showToast(error.message);return false;}
  }
  const button=document.querySelector(`[data-enrich="${CSS.escape(id)}"]`);if(button){button.disabled=true;button.textContent="Checking…";}
  try{
    const response=await fetch(`${BACKEND_API_URL}/api/opportunities/${encodeURIComponent(id)}/enrich?workspace_id=${encodeURIComponent(state.workspace.id)}`,{method:"POST",credentials:"include",headers:{"Content-Type":"application/json",Accept:"application/json"},body:JSON.stringify({allow_personal_email:allowPersonal})});
    const result=await response.json().catch(()=>({}));
    const labels={verified_contact_exists:"A verified business email already exists",score_below_threshold:"Lead score is below the enrichment threshold",evidence_required:"Source evidence is required first",company_domain_required:"A verified company domain is required first",recent_lookup_exists:"This lead was already checked recently",daily_credit_limit:"Today’s Apollo credit limit is reached",monthly_credit_limit:"This month’s Apollo credit limit is reached",apollo_not_configured:"Apollo’s secure API key still needs to be connected"};
    if(!response.ok)throw new Error(labels[result.code]||result.error||`Enrichment returned ${response.status}`);
    await syncData({silent:true});await loadEnrichmentPolicy();
    showToast(result.contact?`${result.contact.email_type==="personal"?"Strong personal-email match":"Verified work email"} found for ${result.contact.name}`:`No strong email match found · ${result.request?.credits_used||0} credit used`);return true;
  }catch(error){showToast(error.message);return false;}
  finally{if(button){button.disabled=false;button.textContent="Find work email · 1 lookup";}}
}

function renderBackendAccess(){
  const status=document.getElementById("backend-auth-status");if(!status)return;
  const signedIn=Boolean(backendSession);
  status.textContent=signedIn?`Signed in · ${backendSession.name}`:"Signed out";
  status.className=`status ${signedIn?"good":"warn"}`;
  document.getElementById("backend-login-fields").hidden=signedIn;
  document.getElementById("backend-login-btn").hidden=signedIn;
  document.getElementById("backend-logout-btn").hidden=!signedIn;
}

async function loginBackend(){
  const email=document.getElementById("backend-login-email").value.trim();
  const password=document.getElementById("backend-login-password").value;
  if(!email||!password){showToast("Enter the owner email and password");return;}
  setBusy("backend-login-btn",true,"Signing in…");
  try{
    const response=await fetch(`${BACKEND_API_URL}/api/login`,{method:"POST",credentials:"include",headers:{"Content-Type":"application/json",Accept:"application/json"},body:JSON.stringify({email,password})});
    if(!response.ok)throw new Error(response.status===401?"Invalid owner credentials":`Backend returned ${response.status}`);
    backendSession=(await response.json()).user;
    state.integrations.dataUrl=`${BACKEND_API_URL}/api/snapshot?workspace_id=${encodeURIComponent(state.workspace.id)}`;
    saveState();renderAll();document.getElementById("backend-login-password").value="";
    await Promise.all([syncData(),loadRunPolicy(),loadEnrichmentPolicy()]);showToast("Secure workspace connected");
  }catch(error){showToast(`Sign-in failed: ${error.message}`);}
  finally{setBusy("backend-login-btn",false,"Sign in securely");renderBackendAccess();}
}

async function logoutBackend(){
  try{await fetch(`${BACKEND_API_URL}/api/logout`,{method:"POST",credentials:"include",headers:{Accept:"application/json"}});}catch{}
  backendSession=null;renderBackendAccess();showToast("Signed out of the secure workspace");
}

async function persistOpportunityWorkflow(id){
  if(!backendSession)return true;
  const record=state.crm.records[id];if(!record)return false;
  const response=await fetch(`${BACKEND_API_URL}/api/opportunities/${encodeURIComponent(id)}?workspace_id=${encodeURIComponent(state.workspace.id)}`,{
    method:"PATCH",credentials:"include",headers:{"Content-Type":"application/json",Accept:"application/json"},
    body:JSON.stringify({status:state.statuses[id]||"New",pipeline_stage:record.stage,next_action:record.nextAction||"",notes:record.notes||""})
  });
  if(!response.ok)throw new Error(response.status===401?"Sign in again to save workflow changes":`Secure save failed (${response.status})`);
  return true;
}

function fetchJsonp(url){
  return new Promise((resolve,reject)=>{
    const callback=`leadintelSnapshot_${Date.now()}_${Math.random().toString(36).slice(2)}`;
    const script=document.createElement("script");
    const timeout=setTimeout(()=>finish(new Error("Snapshot endpoint timed out")),15000);
    function finish(error,value){
      clearTimeout(timeout);delete window[callback];script.remove();error?reject(error):resolve(value);
    }
    window[callback]=value=>finish(null,value);
    script.onerror=()=>finish(new Error("Snapshot endpoint could not be loaded"));
    const endpoint=new URL(url);endpoint.searchParams.set("callback",callback);endpoint.searchParams.set("_",Date.now());
    script.src=endpoint.href;document.head.appendChild(script);
  });
}

async function triggerResearch({test=false}={}){
  const url=state.integrations.runUrl.trim();
  if(!url){showToast("Add the private Make run webhook in Settings");switchView("settings");return false;}
  if(!isPrivateEndpoint(url)){showToast("Use an HTTPS webhook");return false;}
  if(!backendSession){showToast("Sign in securely before starting a protected run");switchView("settings");return false;}
  if(!test)setBusy("run-btn",true,"Starting…");
  const market=activeMarket();
  const body={
    workspace_id:state.workspace.id,
    market:market.name,
    test,
    requested_at:new Date().toISOString(),
    market_profile:{id:market.id,name:market.name,countries:market.countries,country_codes:market.countryCodes,languages:market.languages,decision_maker_titles:market.decisionTitles,source_focus:market.sourceFocus},
    enabled_sources:sourcePackForMarket(market).filter(item=>sourceEnabled(market,item.id)).map(({id,name,group,cadence,country,url,languages,keywords,custom,sourceKind,sourceRole,sourceLayer,costGuard})=>({id,name,group,cadence,country,url:url||"",languages:languages||[],keywords:keywords||"",custom:Boolean(custom),source_kind:sourceKind||"",source_role:sourceRole||"",source_layer:sourceLayer||"",cost_guard:costGuard||""})),
    business_profile:state.businessProfile,
    offers:state.offers.filter(item=>item.active),
    signal_rules:state.signalRules.filter(item=>item.active),
    playbooks:state.playbooks.filter(item=>item.active),
    language_policy:{
      mode:state.settings.languageMode,
      mode_label:languageModeLabel(),
      internal_language:state.settings.internalLanguage,
      outreach_fallback_language:state.settings.outreachFallbackLanguage,
      market_languages:market.languages,
      script_control:"Use the predefined playbooks. Adapt language according to the selected policy, but do not invent new outreach scripts when no matching playbook exists."
    },
    settings:{email_count:state.settings.emailCount,app_count:state.settings.appCount,min_score:state.settings.minScore,language_mode:state.settings.languageMode,internal_language:state.settings.internalLanguage,outreach_fallback_language:state.settings.outreachFallbackLanguage},
    workflow:state.map.publishedConfigs
  };
  const key=state.runtime.pendingRunKey||crypto.randomUUID();state.runtime.pendingRunKey=key;saveState();
  try{
    const response=await fetch(`${BACKEND_API_URL}/api/runs?workspace_id=${encodeURIComponent(state.workspace.id)}`,{method:"POST",credentials:"include",headers:{"Content-Type":"application/json",Accept:"application/json","Idempotency-Key":key},body:JSON.stringify({dispatch_url:url,test,payload:body})});
    const result=await response.json().catch(()=>({}));
    if(!response.ok){
      const labels={run_in_progress:"A research run is already active",daily_run_limit:"The daily run limit is reached",monthly_candidate_limit:"The monthly candidate budget is reached",cooldown:"Please wait before starting another run",dispatch_timeout:"Make did not confirm receipt; no automatic retry was made"};
      const message=labels[result.code]||result.error||`Protected run returned ${response.status}`;
      if(result.run||response.status<500)state.runtime.pendingRunKey="";
      throw new Error(message);
    }
    state.runtime.pendingRunKey="";state.runtime.lastRunId=result.run?.id||"";state.runtime.lastRunRequest=formatNow();state.runtime.error="";saveState();
    await syncData({silent:true});await loadRunPolicy();renderRuntimeStatus();
    showToast(test?"Run endpoint validated · no Make or OpenAI credits used":`Protected run accepted · ${result.run?.id||"queued"}`);return true;
  }
  catch(error){state.runtime.error=error.message;saveState();renderRuntimeStatus();showToast(`Run blocked: ${error.message}`);return false;}
  finally{if(!test)setBusy("run-btn",false,"Run research");}
}

function mapConfig(id,published=false){return (published?state.map.publishedConfigs:state.map.draftConfigs)[id];}
function dirtyMapNodes(){return workflowNodes.filter(node=>JSON.stringify(mapConfig(node.id))!==JSON.stringify(mapConfig(node.id,true)));}
function layoutIsDirty(){return JSON.stringify(state.map.draftLayout)!==JSON.stringify(state.map.publishedLayout);}
function mapChangeCount(){return dirtyMapNodes().length+(layoutIsDirty()?1:0);}
function mapPositionAvailable(id,x,y){return Object.entries(state.map.draftLayout).every(([otherId,position])=>otherId===id||Math.abs(position.x-x)>=MAP_WORLD.nodeWidth+18||Math.abs(position.y-y)>=MAP_WORLD.nodeHeight+18);}
function mapEdgePath(edge,layout=state.map.draftLayout){
  const from=layout[edge.from],to=layout[edge.to];if(!from||!to)return "";
  const horizontal=to.x>=from.x+MAP_WORLD.nodeWidth;
  const start=horizontal?{x:from.x+MAP_WORLD.nodeWidth/2,y:from.y}:{x:from.x,y:from.y+MAP_WORLD.nodeHeight/2};
  const end=horizontal?{x:to.x-MAP_WORLD.nodeWidth/2-7,y:to.y}:{x:to.x,y:to.y-MAP_WORLD.nodeHeight/2-7};
  if(horizontal){const bend=Math.max(45,(end.x-start.x)*.48);return `M ${start.x} ${start.y} C ${start.x+bend} ${start.y}, ${end.x-bend} ${end.y}, ${end.x} ${end.y}`;}
  const bend=Math.max(50,Math.abs(end.y-start.y)*.45);return `M ${start.x} ${start.y} C ${start.x} ${start.y+bend}, ${end.x} ${end.y-bend}, ${end.x} ${end.y}`;
}
function renderMapEdges(){const target=document.getElementById("map-edges");if(target)target.innerHTML=workflowEdges.map(edge=>`<path class="connection ${edge.branch?"branch":""}" d="${mapEdgePath(edge)}"></path>`).join("");}
function applyMapViewport(){
  const world=document.getElementById("map-world");if(!world)return;
  const {zoom,panX,panY}=state.map.viewport;world.style.transform=`translate(${panX}px, ${panY}px) scale(${zoom})`;
  document.getElementById("map-canvas")?.style.setProperty("--map-zoom",zoom);
}
function fitMapViewport(persist=true){
  const canvas=document.getElementById("map-canvas");if(!canvas)return;
  const zoom=Math.max(.68,Math.min(1,(canvas.clientWidth-36)/MAP_WORLD.width));
  state.map.viewport={zoom,panX:Math.max(18,(canvas.clientWidth-MAP_WORLD.width*zoom)/2),panY:24,initialized:true};
  if(persist)saveState();applyMapViewport();
}
function setMapZoom(next,anchorX=null,anchorY=null){
  const canvas=document.getElementById("map-canvas");if(!canvas)return;
  const old=state.map.viewport.zoom;const zoom=Math.max(.5,Math.min(1.5,next));
  const cx=anchorX??canvas.clientWidth/2,cy=anchorY??canvas.clientHeight/2;const ratio=zoom/old;
  state.map.viewport.panX=cx-(cx-state.map.viewport.panX)*ratio;state.map.viewport.panY=cy-(cy-state.map.viewport.panY)*ratio;state.map.viewport.zoom=zoom;state.map.viewport.initialized=true;
  saveState();applyMapViewport();
}
function panMapViewport(dx,dy,persist=true){
  state.map.viewport.panX+=dx;state.map.viewport.panY+=dy;state.map.viewport.initialized=true;applyMapViewport();
  if(persist){clearTimeout(mapViewportSaveTimer);mapViewportSaveTimer=setTimeout(saveState,140);}
}
function setArrangeMode(enabled){
  mapArrangeMode=enabled;document.getElementById("map-canvas")?.classList.toggle("arranging",enabled);document.querySelector(".map-workbench")?.classList.toggle("arranging",enabled);
  const button=document.getElementById("map-arrange");if(button){button.classList.toggle("active",enabled);button.setAttribute("aria-pressed",String(enabled));button.textContent=enabled?"Done arranging":"Arrange";}
}
function setMapInspectorCollapsed(collapsed,{refit=true}={}){
  if(collapsed&&mapInspectorFocused)setMapInspectorFocused(false,{refit:false});
  mapInspectorCollapsed=collapsed;
  const workbench=document.querySelector(".map-workbench");workbench?.classList.toggle("inspector-collapsed",collapsed);
  const button=document.getElementById("map-toggle-inspector");if(button){button.textContent=collapsed?"Show details":"Hide details";button.setAttribute("aria-pressed",String(collapsed));button.setAttribute("aria-label",collapsed?"Show workflow details":"Hide workflow details");}
  if(refit)requestAnimationFrame(()=>fitMapViewport(false));
}
function setMapInspectorFocused(focused,{refit=true}={}){
  mapInspectorFocused=focused;
  const workbench=document.querySelector(".map-workbench");workbench?.classList.toggle("inspector-focused",focused);
  const button=document.getElementById("map-inspector-focus");if(button){button.textContent=focused?"Show canvas":"Focus details";button.setAttribute("aria-pressed",String(focused));button.setAttribute("aria-label",focused?"Show workflow canvas":"Focus workflow details");}
  if(refit)requestAnimationFrame(()=>fitMapViewport(false));
}
function setMapFullscreen(enabled,{refit=true}={}){
  mapFullscreenMode=enabled;
  const workbench=document.querySelector(".map-workbench");workbench?.classList.toggle("map-fullscreen",enabled);document.body.classList.toggle("map-fullscreen-open",enabled);
  const button=document.getElementById("map-fullscreen");if(button){button.textContent=enabled?"Exit full canvas":"Full canvas";button.setAttribute("aria-pressed",String(enabled));button.setAttribute("aria-label",enabled?"Exit full canvas view":"Open full canvas view");}
  if(refit)requestAnimationFrame(()=>fitMapViewport(false));
}
function mapMetric(node,config){
  if(node.id==="sources")return `${config.value} sources`;
  if(state.runtime.mode!=="demo"&&node.id==="scan")return `${numberValue(runs[0]?.findings,opportunities.length)} findings`;
  if(state.runtime.mode!=="demo"&&node.id==="analysis")return `${signals.length} signals`;
  if(node.id==="score")return `≥${config.value} score`;
  if(node.id==="shortlist")return `${state.runtime.mode==="demo"?config.value:Math.min(config.value,opportunities.length)} saved`;
  if(node.id==="contacts")return `${config.value} / company`;
  if(node.id==="email")return `${config.value} emailed`;
  if(node.id==="match")return `${state.playbooks.filter(item=>item.active).length} playbooks`;
  if(node.id==="message")return `${Object.keys(state.outreachDrafts).length} drafts`;
  if(node.id==="safety")return `${opportunities.filter(o=>automationDecision(o,matchingPlaybook(o)).eligible).length} eligible`;
  if(node.id==="outreach")return `${opportunities.filter(o=>automationDecision(o,matchingPlaybook(o)).route==="Human review").length} to review`;
  if(node.id==="delivery")return state.outreachAutomation.senderConnected?`${state.outreachAutomation.dailyLimit}/day`:`${state.outreachAutomation.dailyLimit}/day · sender needed`;
  if(node.id==="tracking")return `${state.outreachAudit.length} events`;
  if(node.id==="booking")return state.scheduling.bookingUrl?`${state.scheduling.duration} min · ${state.scheduling.platform}`:"Link needed";
  if(node.id==="meeting")return state.scheduling.bookingWebhookConnected?"CRM automatic":"Manual fallback";
  return node.metric;
}

function renderSystemMap(){
  const dirty=dirtyMapNodes();
  const changeCount=mapChangeCount();
  const enabled=workflowNodes.filter(node=>mapConfig(node.id,true).enabled).length;
  const healthy=workflowNodes.filter(node=>node.status==="Healthy").length;
  document.getElementById("map-summary").innerHTML=`
    <button class="map-summary-card" type="button" data-view="control"><span>◇</span><div><strong>${enabled} / ${workflowNodes.length}</strong><small>Active workflow steps</small></div><i>→</i></button>
    <button class="map-summary-card" type="button" data-view="runs"><span>●</span><div><strong>${healthy} healthy</strong><small>2 steps need review</small></div><i>→</i></button>
    <button class="map-summary-card" type="button" data-map-node="${dirty[0]?.id||selectedMapNode}"><span>⌁</span><div><strong>${dirty.length} drafts</strong><small>Not active until published</small></div><i>→</i></button>
    <button class="map-summary-card" type="button" data-view="runs"><span>V</span><div><strong>Version ${state.map.version}</strong><small>${esc(state.map.lastPublished)}</small></div><i>→</i></button>`;
  document.getElementById("map-draft-count").textContent=changeCount;
  document.getElementById("map-version-label").textContent=state.map.version;
  document.getElementById("publish-map").textContent=changeCount?`Publish ${changeCount} change${changeCount===1?"":"s"}`:"Published";
  document.getElementById("publish-map").disabled=!changeCount;
  document.getElementById("discard-map-drafts").disabled=!changeCount;
  renderMapEdges();
  document.getElementById("map-nodes").innerHTML=workflowNodes.map((node,index)=>{
    const config=mapConfig(node.id);
    const changed=dirty.some(item=>item.id===node.id);
    const destination=workflowDestinations[node.id];
    const position=state.map.draftLayout[node.id];
    return `<div class="map-node ${selectedMapNode===node.id?"selected":""} ${config.enabled?"":"disabled"}" style="--x:${position.x}px;--y:${position.y}px" data-node-id="${node.id}" data-map-node="${node.id}" role="button" tabindex="0" aria-label="Inspect ${esc(config.title)} configuration" aria-pressed="${selectedMapNode===node.id}">
      ${changed?'<i class="map-draft-mark" aria-label="Draft changed"></i>':''}
      <span class="map-node-head"><span class="map-node-icon">${node.icon}</span><span class="map-node-index">0${index+1}</span><i class="map-node-status ${node.status.toLowerCase()}"></i><button class="map-node-inspect" type="button" data-map-node="${node.id}" aria-label="Inspect ${esc(config.title)} configuration">⚙</button></span>
      <h3>${esc(config.title)}</h3><p>${esc(node.type)} · ${config.enabled?esc(config.cadence):"Disabled"}</p>
      <span class="map-node-foot"><strong>${esc(mapMetric(node,config))}</strong><button type="button" class="map-node-open" data-step-view="${destination}" aria-label="Open ${esc(config.title)} page">Open page →</button></span>
    </div>`;
  }).join("");
  applyMapViewport();setArrangeMode(mapArrangeMode);setMapInspectorCollapsed(mapInspectorCollapsed,{refit:false});setMapInspectorFocused(mapInspectorFocused,{refit:false});setMapFullscreen(mapFullscreenMode,{refit:false});
  if(!state.map.viewport.initialized)requestAnimationFrame(()=>fitMapViewport());
  renderMapInspector();
  const history=(state.map.history||[]).slice(0,4);
  document.getElementById("map-history").innerHTML=`<div class="map-history-list">${history.map(item=>`<span class="version-chip"><strong>V${item.version}</strong> · ${esc(item.date)} · ${item.changes} changes</span>`).join("")}</div>`;
}

function renderMapInspector(){
  const node=workflowNodes.find(item=>item.id===selectedMapNode)||workflowNodes[0];
  const config=mapConfig(node.id);
  const changed=JSON.stringify(config)!==JSON.stringify(mapConfig(node.id,true));
  const test=state.map.tests[node.id];
  const cadenceOptions=["Daily · 06:00","Daily · 07:00","Daily","After collection","After analysis","Qualified only","On demand"];
  document.getElementById("map-inspector").innerHTML=`
    <div class="map-inspector-shell">
      <div class="map-inspector-top">
        <div class="map-inspector-head"><div class="map-inspector-title"><span class="inspector-icon">${node.icon}</span><div><p class="kicker">${esc(node.type)} step · ${String(workflowNodes.indexOf(node)+1).padStart(2,"0")}</p><h2>${esc(config.title)}</h2></div></div><div class="map-inspector-head-actions"><span class="status ${statusClass(node.status)}">${esc(node.status)}</span><button class="map-inspector-focus" type="button" id="map-inspector-focus" aria-pressed="${mapInspectorFocused}" aria-label="${mapInspectorFocused?"Show workflow canvas":"Focus workflow details"}">${mapInspectorFocused?"Show canvas":"Focus details"}</button><button class="map-inspector-close" type="button" id="map-inspector-close" aria-label="Hide workflow details">×</button></div></div>
        <p class="map-inspector-description">${esc(config.description)}</p>
        <div class="map-inspector-meta"><span>Last run <strong>${esc(node.lastRun)}</strong></span><span>Output <strong>${esc(mapMetric(node,config))}</strong></span>${changed?'<span><strong>Draft changed</strong></span>':''}</div>
      </div>
      <div class="inspector-tabs" role="tablist" aria-label="Step details">
        ${[["configuration","Configuration"],["output","Recent output"],["evidence","Evidence"]].map(([id,label])=>`<button class="inspector-tab ${selectedMapInspectorTab===id?"active":""}" type="button" role="tab" aria-selected="${selectedMapInspectorTab===id}" data-inspector-tab="${id}">${label}</button>`).join("")}
      </div>
      <form class="map-form" id="map-node-form" ${selectedMapInspectorTab==="configuration"?"":"hidden"}>
      <label>Step name<input id="map-field-title" value="${esc(config.title)}" required></label>
      <label>Run cadence<select id="map-field-cadence">${cadenceOptions.map(option=>`<option ${option===config.cadence?"selected":""}>${esc(option)}</option>`).join("")}</select></label>
      <label class="wide">Purpose<textarea id="map-field-description" required>${esc(config.description)}</textarea></label>
      <div class="map-control-pair wide"><label>${esc(node.controlLabel)}<input id="map-field-value" type="number" min="1" max="100" step="${node.id==="score"?"0.1":"1"}" value="${config.value}" required></label><span class="map-control-unit">${esc(node.unit)}</span></div>
      <label class="wide">Operating instructions<textarea id="map-field-instructions" required>${esc(config.instructions)}</textarea></label>
      <label class="map-switch wide"><span>Step active${node.id==="outreach"?" · required safety gate":""}</span><input id="map-field-enabled" type="checkbox" ${config.enabled?"checked":""} ${node.id==="outreach"?"disabled":""}></label>
      <div class="map-inspector-actions"><button class="btn secondary" type="button" data-test-map="${node.id}">Test step</button><button class="btn secondary" type="button" data-reset-map="${node.id}" ${changed?"":"disabled"}>Reset</button><button class="btn primary" type="button" id="save-map-draft">Save draft</button></div>
      ${test?`<div class="map-test-result ${test.status==="Review"?"warn":""}"><strong>${esc(test.status)} · ${esc(test.date)}</strong><br>${esc(test.output)}</div>`:""}
      </form>
      <section class="inspector-panel" ${selectedMapInspectorTab==="output"?"":"hidden"}>${renderInspectorOutput(node,config,test)}</section>
      <section class="inspector-panel" ${selectedMapInspectorTab==="evidence"?"":"hidden"}>${renderInspectorEvidence(node)}</section>
    </div>`;
}

function renderInspectorOutput(node,config,test){
  const items=[
    ["Latest result",mapMetric(node,config)],
    ["Last completed",node.lastRun||"Not run yet"],
    ["Health",node.status],
    ["Cadence",config.cadence]
  ];
  return `<div class="inspector-output-list">${items.map(([label,value])=>`<div class="inspector-output-item"><strong>${esc(label)}</strong><span>${esc(String(value))}</span></div>`).join("")}</div>${test?`<div class="map-test-result ${test.status==="Review"?"warn":""}"><strong>Latest test · ${esc(test.status)}</strong><br>${esc(test.output)}</div>`:'<p class="inspector-empty">No test output yet. Open Configuration and run “Test step” to validate this stage without publishing changes.</p>'}`;
}

function renderInspectorEvidence(node){
  let evidence=[];
  if(node.id==="sources")evidence=sources.slice(0,5).map(item=>`${item.name} · ${item.health} · ${item.findings} findings`);
  else if(["scan","analysis","score","shortlist"].includes(node.id))evidence=opportunities.slice(0,5).map(item=>`${item.company} · ${item.signalType} · score ${item.score}`);
  else if(node.id==="contacts")evidence=opportunities.slice(0,5).map(item=>`${item.company} · ${item.contact.emailStatus} · ${item.contact.source}`);
  else if(["match","message","safety","outreach","delivery","tracking","booking","meeting","email"].includes(node.id))evidence=state.outreachAudit.slice(0,5).map(item=>`${item.date||"Recent"} · ${item.action||item.status||"Workflow event"}`);
  return evidence.length?`<ul class="inspector-evidence-list">${evidence.map(item=>`<li>${esc(item)}</li>`).join("")}</ul>`:`<p class="inspector-empty">No evidence has been recorded for this step yet. Evidence will appear here after a live or test run reaches this stage.</p>`;
}

function readMapForm(){
  return {
    title:document.getElementById("map-field-title").value.trim(),
    enabled:document.getElementById("map-field-enabled").checked,
    cadence:document.getElementById("map-field-cadence").value,
    value:Number(document.getElementById("map-field-value").value),
    description:document.getElementById("map-field-description").value.trim(),
    instructions:document.getElementById("map-field-instructions").value.trim()
  };
}

function validateNodeConfig(id,config){
  const errors=[];
  if(!config.title||!config.description||!config.instructions)errors.push("Complete all required step fields");
  if(!Number.isFinite(config.value))errors.push("The step limit must be a number");
  if(id==="email"&&(!Number.isInteger(config.value)||config.value<1||config.value>5))errors.push("Morning email must contain 1–5 opportunities");
  else if(id==="shortlist"&&(!Number.isInteger(config.value)||config.value<3||config.value>10))errors.push("The app shortlist must contain 3–10 companies");
  else if(id==="score"&&(config.value<1||config.value>10))errors.push("Opportunity score threshold must be between 1 and 10");
  else if(!["email","shortlist","score"].includes(id)&&(config.value<1||config.value>100))errors.push("The step limit must be between 1 and 100");
  if(id==="outreach"&&!config.enabled)errors.push("Human review must remain active as the fallback route");
  return errors;
}

function saveMapDraft(notify=true){
  const config=readMapForm();
  const errors=validateNodeConfig(selectedMapNode,config);
  if(errors.length){showToast(errors[0]);return false;}
  state.map.draftConfigs[selectedMapNode]=config;saveState();renderSystemMap();
  if(notify)showToast("Draft saved — publish to activate");
  return true;
}

function validateWorkflow(){
  const configs=state.map.draftConfigs;
  const errors=[];
  workflowNodes.forEach(node=>{
    const config=configs[node.id];
    if(!config){errors.push(`${node.config.title}: required configuration is missing`);return;}
    validateNodeConfig(node.id,{...config,value:Number(config.value)}).forEach(error=>errors.push(`${node.config.title}: ${error}`));
  });
  if(Number(configs.email.value)>Number(configs.shortlist.value))errors.push("Morning email cannot contain more companies than the saved shortlist");
  if(Number(configs.score.value)>10)errors.push("Opportunity score threshold cannot exceed 10");
  if(!configs.outreach.enabled)errors.push("Human review must remain active as the fallback route");
  return errors;
}

function publishWorkflow(){
  if(document.getElementById("map-node-form")&&!saveMapDraft(false))return;
  const errors=validateWorkflow();
  if(errors.length){
    document.getElementById("modal-content").innerHTML=`<p class="kicker">Publish blocked</p><h2>Fix ${errors.length} validation issue${errors.length===1?"":"s"}</h2><div class="notice"><strong>The active workflow was not changed.</strong></div><ul>${errors.map(error=>`<li>${esc(error)}</li>`).join("")}</ul><button class="btn primary" id="close-preview-action">Return to map</button>`;
    openModal();return;
  }
  const changes=mapChangeCount();
  if(!changes)return;
  state.map.publishedConfigs=structuredClone(state.map.draftConfigs);
  state.map.publishedLayout=structuredClone(state.map.draftLayout);
  state.map.version+=1;
  state.map.lastPublished=new Intl.DateTimeFormat("en-GB",{day:"numeric",month:"short",year:"numeric",hour:"2-digit",minute:"2-digit"}).format(new Date());
  state.map.history=[{version:state.map.version,date:state.map.lastPublished,changes},...(state.map.history||[])].slice(0,8);
  state.settings.emailCount=Math.max(1,Math.min(5,Number(mapConfig("email").value)));
  state.settings.appCount=Math.max(3,Math.min(10,Number(mapConfig("shortlist").value)));
  state.settings.minScore=Math.max(1,Math.min(10,Number(mapConfig("score").value)));
  saveState();renderAll();showToast(`Workflow version ${state.map.version} published`);
}

function testMapStep(id){
  selectedMapNode=id;
  if(!saveMapDraft(false))return;
  const outputs={sources:"12 approved sources responded; evidence metadata is present.",scan:"Simulation processed 30 pages with duplicate detection enabled.",analysis:"Sample finding separated into verified facts and commercial hypotheses.",score:"Sample opportunity produced a complete seven-factor score explanation.",shortlist:"Five qualifying companies fit the current shortlist rule.",contacts:"Apollo/public-data gate returned three verified work contacts and routed one personal address to review.",email:"Preview generated exactly three internal opportunities with one contact each.",match:"Active signal and offer rules selected a predefined playbook.",message:"Approved template fields were populated without adding unsupported claims.",safety:"Verified work email, evidence, score, suppression and daily cap checks passed.",outreach:"Manual fallback is available for personal email, weak matches and unapproved scripts.",delivery:"Queue is valid; an email sender must be connected before delivery can be confirmed.",tracking:"Queue and approval transitions are preserved in the outreach audit.",booking:"The configured Calendly Strategy Call opens a 30-minute Zoom booking page.",meeting:"Manual CRM fallback is ready; connect the Calendly webhook for automatic Meeting-stage updates."};
  const review=["outreach","delivery","meeting"].includes(id);
  state.map.tests[id]={status:review?"Review":"Passed",date:"Just now",output:outputs[id]||"Step configuration passed."};
  saveState();renderSystemMap();showToast(review?"Rule test passed; external delivery is not connected":"Step simulation passed");
}

function renderMetrics(){
  const verified=opportunities.filter(isVerifiedWorkEmail).length;
  const eligible=opportunities.filter(o=>state.listStates[o.id]==="Eligible").length;
  const qualified=opportunities.filter(o=>o.score>=state.settings.minScore).length;
  const approved=opportunities.filter(o=>state.statuses[o.id]==="Approved").length;
  const contactGaps=opportunities.filter(o=>o.score>=state.settings.minScore&&!isVerifiedWorkEmail(o)).length;
  const data=[
    ["Review now",qualified,`Score ≥ ${state.settings.minScore}`,"companies"],["Contact gaps",contactGaps,"Research before outreach","contacts"],
    ["Verified / eligible",`${verified} / ${eligible}`,"Business contacts","contacts"],["Approved",approved,"Controlled outreach actions","outreach"]
  ];
  document.getElementById("metrics").innerHTML=data.map(([label,value,note,view],index)=>`<button class="metric decision-metric" type="button" data-view="${view}"><span><i>0${index+1}</i>${label}</span><strong>${value}</strong><small>${note}</small><em>Open →</em></button>`).join("");
}

function todayRecommendation(o){
  const stage=state.crm.records[o.id]?.stage||"Discovered";
  const listState=state.listStates[o.id]||"Research";
  const status=state.statuses[o.id]||"New";
  if(!isVerifiedWorkEmail(o))return {label:"Research decision-maker",kind:"open",reason:isPersonalEmail(o.contact)?"Personal email · approval route only":"No verified work email yet",tone:"research"};
  if(listState!=="Eligible")return {label:"Review contact eligibility",kind:"contacts",reason:"Verified email · campaign review required",tone:"review"};
  if(status==="Approved")return {label:"Continue in pipeline",kind:"crm",reason:`Approved · ${stage}`,tone:"approved"};
  if(status==="Draft ready")return {label:"Review outreach draft",kind:"message",reason:"Draft prepared · approval pending",tone:"ready"};
  const decision=automationDecision(o,matchingPlaybook(o));
  if(decision.automatic)return {label:"Review automatic queue",kind:"outreach",reason:decision.route,tone:"approved"};
  return {label:"Prepare outreach draft",kind:"message",reason:"Verified and eligible · controlled routing next",tone:"ready"};
}

function renderOpportunities(){
  const list=opportunities.filter(o=>o.score>=state.settings.minScore).slice(0,state.settings.appCount);
  document.getElementById("today-count").textContent=list.length;
  document.getElementById("opportunity-list").innerHTML=list.map((o,index)=>{
    const listState=state.listStates[o.id]||"Research";
    const action=todayRecommendation(o);const record=state.crm.records[o.id];
    const actionButton=action.kind==="message"?`<button class="btn primary" data-message="${o.id}">${action.label}</button>`:action.kind==="open"?`<button class="btn primary" data-open="${o.id}">${action.label}</button>`:`<button class="btn primary" data-view="${action.kind}">${action.label}</button>`;
    return `<article class="opp-card decision-card ${action.tone}">
      <div class="decision-priority"><span>Priority</span><strong>${String(index+1).padStart(2,"0")}</strong><div class="score">${o.score.toFixed(1)}<small>/10</small></div></div>
      <div class="opp-main decision-main">
        <div class="opp-title-row"><div><p class="kicker">${esc(o.signalType)} · ${esc(o.signalDate)}</p><h3>${esc(o.company)}</h3></div>${o.contact.emailStatus==="Verified"?'<span class="tag verified">Verified email</span>':'<span class="tag">Contact gap</span>'}</div>
        <p class="signal">${esc(o.signal)}</p>
        <div class="decision-evidence"><span><b>Why now</b>${esc(o.whyNow)}</span><span><b>Best-fit offer</b>${esc(o.primaryOffer)}</span></div>
        <div class="contact-line"><span class="avatar">${initials(o.contact.name||o.company)}</span><span><strong>${esc(o.contact.name||"Decision-maker not verified")}</strong><small>${esc(o.contact.role||"Role research required")} · ${esc(o.contact.emailStatus)} · ${esc(listState)}</small></span></div>
      </div>
      <aside class="decision-action"><span class="decision-state ${action.tone}">${esc(action.reason)}</span><label>Pipeline stage<select data-crm-stage="${esc(o.id)}">${state.crm.stageOrder.map(value=>`<option ${value===record.stage?"selected":""}>${esc(value)}</option>`).join("")}</select></label><label>Next action<input data-crm-next-action="${esc(o.id)}" value="${esc(record.nextAction||"")}" placeholder="Define the next commercial action"></label><div class="decision-buttons"><button class="btn secondary" data-open="${o.id}">Evidence dossier</button>${actionButton}</div></aside>
    </article>`;
  }).join("")||'<div class="empty-state"><h3>No qualified decisions waiting</h3><p>The next research run will add companies here when they meet the score and evidence thresholds.</p></div>';
}

function renderSignals(){
  document.getElementById("signal-count").textContent=signals.length;
  const activeRules=state.signalRules.filter(item=>item.active).length;
  const rulesExpanded=state.ui.signalRulesExpanded!==false;
  const rulesPanel=document.querySelector(".signal-rules-panel");
  const rulesToggle=document.getElementById("toggle-signal-rules");
  const rulesManager=document.getElementById("signal-rules-manager");
  rulesPanel?.classList.toggle("collapsed",!rulesExpanded);
  if(rulesToggle){rulesToggle.textContent=rulesExpanded?"Hide rules":"Expand rules";rulesToggle.setAttribute("aria-expanded",String(rulesExpanded));}
  if(rulesManager)rulesManager.hidden=!rulesExpanded;
  document.getElementById("signal-rules-summary").textContent=`${activeRules}/${state.signalRules.length} active · changes affect the next research run`;
  rulesManager.innerHTML=state.signalRules.map(item=>`<article class="signal-rule-card ${item.active?"":"paused"}" data-signal-rule="${esc(item.id)}">
    <div class="signal-rule-card-head">
      <span class="status ${item.active?"good":"warn"}">${item.active?"Active":"Paused"}</span>
      <div class="signal-rule-actions">
        <button class="btn small secondary" type="button" data-toggle-signal-rule="${esc(item.id)}">${item.active?"Pause":"Resume"}</button>
        <button class="icon-button" type="button" data-delete-signal-rule="${esc(item.id)}" aria-label="Delete signal rule">×</button>
      </div>
    </div>
    <label>Rule name<input data-signal-rule-name value="${esc(item.name)}"></label>
    <label>Keywords<textarea data-signal-rule-keywords>${esc(item.keywords)}</textarea></label>
    <label>Priority weight<input data-signal-rule-weight type="number" min="1" max="10" value="${Number(item.weight)||5}"></label>
  </article>`).join("");
  const types=["All",...new Set(signals.map(s=>s.type))];
  document.getElementById("signal-filters").innerHTML=types.map(t=>`<button class="filter ${t===currentSignalFilter?"active":""}" data-signal-filter="${esc(t)}">${esc(t)}</button>`).join("");
  const filtered=currentSignalFilter==="All"?signals:signals.filter(s=>s.type===currentSignalFilter);
  document.getElementById("signals-body").innerHTML=filtered.map(s=>`<tr><td><strong>${esc(s.text)}</strong></td><td>${esc(s.company)}</td><td>${esc(s.type)}</td><td>${esc(s.date)}</td><td><span class="status ${statusClass(s.confidence)}">${esc(s.confidence)}</span></td><td><span class="status ${statusClass(s.status)}">${esc(s.status)}</span></td></tr>`).join("");
}

function renderCompanies(query=""){
  const q=query.toLowerCase();
  const list=opportunities.filter(o=>`${o.company} ${o.industry} ${o.primaryOffer}`.toLowerCase().includes(q));
  document.getElementById("company-grid").innerHTML=list.map(o=>`<article class="company-card" data-open="${o.id}"><div class="opp-title-row"><h3>${esc(o.company)}</h3><span class="tag">${esc(o.industry)}</span></div><p>${esc(o.whyNow)}</p><div class="company-foot"><span class="status ${statusClass(state.statuses[o.id])}">${esc(state.statuses[o.id])}</span><strong class="score">${o.score.toFixed(1)}</strong></div></article>`).join("");
}

function renderContacts(){
  const filters=["All","Verified","Public business","Predicted","Eligible","Suppressed"];
  const policy=enrichmentControl.policy;const usage=enrichmentControl.usage||{};
  document.getElementById("enrichment-safety").innerHTML=policy?`<article><span>Apollo connection</span><strong>${enrichmentControl.configured?"Ready":"Setup needed"}</strong><small>Secure backend key</small></article><article><span>Default lookup</span><strong>Work only</strong><small>One decision-maker · one lookup</small></article><article><span>Today</span><strong>${usage.daily||0} / ${policy.daily_credit_limit}</strong><small>Reserved credit cap</small></article><article><span>Personal email</span><strong>Owner exception</strong><small>Lawful basis required · phones off</small></article>`:'<article><span>Email enrichment</span><strong>Sign in</strong><small>Controls load from the secure backend</small></article>';
  document.getElementById("contact-filters").innerHTML=filters.map(f=>`<button class="filter ${f===currentContactFilter?"active":""}" data-contact-filter="${esc(f)}">${esc(f)}</button>`).join("");
  let list=opportunities;
  if(["Verified","Public business","Predicted"].includes(currentContactFilter)) list=list.filter(o=>o.contact.emailStatus===currentContactFilter);
  if(["Eligible","Suppressed"].includes(currentContactFilter)) list=list.filter(o=>state.listStates[o.id]===currentContactFilter);
  document.getElementById("contact-count").textContent=opportunities.length;
  document.getElementById("contacts-body").innerHTML=list.map(o=>{const linkedinTargets=linkedInContactTargets(o);return `<tr>
    <td><strong>${esc(o.contact.name)}</strong></td><td>${esc(o.company)}</td><td>${esc(o.contact.role)}</td>
    <td>${o.contact.emailStatus==="Predicted"?'<span class="status warn">Hidden until verified</span>':`<a class="evidence" href="mailto:${esc(o.contact.email)}">${esc(o.contact.email)}</a>`}</td>
    <td><span class="status ${statusClass(o.contact.emailStatus)}">${esc(o.contact.emailStatus)}</span><br><small>${o.contact.emailType==="personal"?"Personal · exact person/company/role match":esc(o.contact.source)}</small><br><small class="linkedin-note">LinkedIn is for role verification, not automated outreach.</small></td>
    <td><select data-list-state="${o.id}"><option ${state.listStates[o.id]==="Research"?"selected":""}>Research</option><option ${state.listStates[o.id]==="Eligible"?"selected":""}>Eligible</option><option ${state.listStates[o.id]==="Manual review"?"selected":""}>Manual review</option><option ${state.listStates[o.id]==="Suppressed"?"selected":""}>Suppressed</option><option ${state.listStates[o.id]==="Unsubscribed"?"selected":""}>Unsubscribed</option></select></td>
    <td><div class="card-actions contact-actions">${["Verified","Strong match"].includes(o.contact.emailStatus)?"":`<button class="btn small primary" data-enrich="${o.id}" ${o.contact.enrichmentStatus==="processing"?"disabled":""}>${o.contact.enrichmentStatus==="processing"?"Checking…":"Find work email · 1 lookup"}</button>${backendSession?.role==="owner"?`<button class="btn small secondary" data-enrich-personal="${o.id}">Personal exception</button>`:""}`}<a class="btn small secondary linkedin-action" href="${esc(linkedInLookupUrl(o))}" target="_blank" rel="noopener">Known LI/profile ↗</a><button class="btn small secondary" data-open="${o.id}">Dossier</button><div class="linkedin-targets" aria-label="Suggested LinkedIn contact searches">${linkedinTargets.map(target=>`<a href="${esc(target.url)}" target="_blank" rel="noopener">${esc(target.role)} ↗</a>`).join("")}</div></div></td></tr>`;}).join("");
}

function renderSources(){
  const market=activeMarket();
  const pack=sourcePackForMarket(market);
  const enabled=pack.filter(item=>sourceEnabled(market,item.id));
  const customCount=pack.filter(item=>item.custom).length;
  const visibleSources=pack.filter(item=>item.custom||item.findings>0||!sourceEnabled(market,item.id));
  const standbySources=pack.filter(item=>!item.custom&&sourceEnabled(market,item.id)&&item.findings===0);
  const companyWebsitePolicy=()=>({
    companies:5,
    pages:6,
    depth:1,
    trigger:"After qualification only",
    purpose:"Primary evidence validation",
    paths:["Homepage","About","Services","News/blog","Careers","Contact"]
  });
  const companyWebsitePolicyMarkup=()=>{
    const policy=companyWebsitePolicy();
    const checked=opportunities.filter(o=>o.score>=state.settings.minScore).slice(0,policy.companies);
    return `<div class="company-source-policy" aria-label="Company website scan policy">
      <div><strong>${policy.companies}</strong><span>top qualified companies</span></div>
      <div><strong>${policy.pages}</strong><span>pages / company</span></div>
      <div><strong>${policy.depth}</strong><span>click depth</span></div>
      <div><strong>${esc(policy.trigger)}</strong><span>not discovery</span></div>
      <p class="company-source-why"><b>Why:</b> ${esc(policy.purpose)}. Checks ${esc(policy.paths.join(", ").toLowerCase())}; avoids full-site crawls to protect Firecrawl/OpenAI spend.</p>
      <p class="company-source-sample"><b>Next sample:</b> ${checked.length?checked.map(o=>esc(o.company)).join(" · "):"No qualified companies ready"}</p>
    </div>`;
  };
  const sourceCard=s=>{
    const isEnabled=sourceEnabled(market,s.id);
    const sourceUrl=safeUrl(s.url||"");
    const host=sourceUrl?new URL(sourceUrl).hostname.replace(/^www\./,""):"Managed connector";
    const reportedHealth=isEnabled?s.health:"Paused";
    const healthLabel=!isEnabled?"Paused":state.runtime.mode==="demo"?"Not live-tested":reportedHealth==="Healthy"?"Reported healthy":reportedHealth;
    const healthDetail=!isEnabled?"Excluded from the Make payload":state.runtime.mode==="demo"?"No recent live collector result":`Latest Make payload reports: ${reportedHealth}`;
    const role=s.sourceKind==="public-platform"?"Public platform · company-page signals only":(s.sourceRole||"Source monitor");
    const linkLabel=sourceUrl?"Open source":"No public link";
    const companyWebsite=s.id==="global-company";
    return `<article class="source-card ${s.custom?"custom-source":"recommended-source"} ${companyWebsite?"company-website-source":""} ${isEnabled?"":"source-paused"}" data-source-open="${esc(s.id)}" tabindex="0" role="button" aria-label="Inspect ${esc(s.name)} source details"><div class="opp-title-row"><h3>${esc(s.name)}</h3><span class="status ${statusClass(healthLabel)}">${esc(healthLabel)}</span></div><p><span class="mini-badge">${esc(s.country==="GLOBAL"?"Global":s.country)}</span> ${esc(s.group)} · ${esc(s.cadence)} ${s.custom?'<span class="mini-badge custom-badge">Custom</span>':""}</p><p class="source-role">${companyWebsite?"Proof source · qualified companies only":esc(role)}</p><p class="source-health-note"><strong>Layer:</strong> ${esc(s.sourceLayer||"Market")} · <strong>Cost guard:</strong> ${esc(s.costGuard||"Quality gate before paid steps")}</p><p class="source-url">${sourceUrl?`<a href="${esc(sourceUrl)}" target="_blank" rel="noopener" aria-label="${esc(linkLabel)}: ${esc(s.name)}">${esc(linkLabel)} <span>${esc(host)} ↗</span></a>`:"<span class=\"source-link-unavailable\">No public source link — evidence comes from the qualified company URL</span>"}${s.languages?.length?` · ${esc(s.languages.join(", "))}`:""}</p><p class="source-health-note"><strong>Health:</strong> ${esc(healthDetail)}</p>${companyWebsite?companyWebsitePolicyMarkup():""}${s.keywords?`<p class="source-keywords">${esc(s.keywords)}</p>`:""}<div class="source-foot"><span>${s.findings} findings today</span><div class="source-card-actions">${companyWebsite?'<button class="btn small secondary" data-company-source-info>View policy</button><button class="btn small secondary" data-company-source-test>Test company URL</button>':""}${s.custom?`<button class="btn small secondary" data-source-test="${esc(s.id)}">Check setup</button><button class="btn small secondary" data-source-edit="${esc(s.id)}">Edit</button><button class="btn small secondary danger" data-source-delete="${esc(s.id)}">Delete</button>`:""}<button class="btn small secondary" data-source-toggle="${esc(s.id)}">${isEnabled?"Pause":"Enable"}</button></div></div><span class="source-card-hint">Click card for details</span></article>`;
  };
  document.getElementById("source-pack-summary").innerHTML=`<strong>${esc(market.name)} source network:</strong> ${enabled.length} of ${pack.length} discovery sources enabled · ${visibleSources.length} shown · ${standbySources.length} zero-result connector${standbySources.length===1?"":"s"} hidden below · ${customCount} custom. Apollo is handled in Settings as qualified-only enrichment, so it does not run as a market source. <strong>Health is reported configuration status:</strong> use an active source link to inspect the public page; a verified live check needs a successful Make/collector result with a timestamp.`;
  document.getElementById("source-grid").innerHTML=visibleSources.map(sourceCard).join("");
  document.getElementById("source-standby-count").textContent=`${standbySources.length} hidden`;
  document.getElementById("source-standby").hidden=standbySources.length===0;
  document.getElementById("source-standby-grid").innerHTML=standbySources.map(sourceCard).join("");
}

function openCompanyWebsitePolicy(){
  const qualified=opportunities.filter(o=>o.score>=state.settings.minScore).slice(0,5);
  document.getElementById("modal-content").innerHTML=`<p class="kicker">Primary evidence source</p><h2>Company websites scan policy</h2><p class="drawer-sub">This source is intentionally shallow and qualified-only. It should confirm business fit and evidence, not discover the whole internet.</p><div class="company-policy-modal"><article><strong>How many?</strong><span>Top 5 qualified companies per run.</span></article><article><strong>How deep?</strong><span>Depth 1, maximum 6 pages per company.</span></article><article><strong>Which pages?</strong><span>Homepage, About, Services, News/blog, Careers and Contact when available.</span></article><article><strong>Why these?</strong><span>They prove the company exists, what it sells, recent activity, fit and safe outreach context.</span></article><article><strong>Cost rule</strong><span>No full crawl. No personal email extraction. Company websites run after scoring so Firecrawl/OpenAI spend is protected.</span></article></div><div class="source-policy-list"><strong>Next companies to check</strong>${qualified.length?`<ul>${qualified.map(o=>`<li>${esc(o.company)}${o.website?` · <a href="${esc(o.website)}" target="_blank" rel="noopener">open website ↗</a>`:" · website needed"}</li>`).join("")}</ul>`:"<p>No qualified companies are ready yet.</p>"}</div><div class="card-actions" style="margin-top:14px"><button class="btn secondary" id="company-source-test-modal">Test company URL</button><button class="btn primary" id="close-preview-action">Got it</button></div>`;
  openModal();
}

function testCompanyWebsiteSource(){
  const sample=opportunities.find(o=>o.website)?.website||"";
  const value=window.prompt("Paste one qualified company website URL to test the shallow scan policy:",sample)?.trim();
  if(!value)return;
  const url=safeUrl(value);
  if(!url){showToast("Use a valid public HTTPS company URL");return;}
  showToast(`Ready to scan ${new URL(url).hostname}: max 6 pages, depth 1, after qualification only`);
}

function openSourceEditor(id=""){
  const market=activeMarket();
  const source=state.customSources.find(item=>item.id===id&&item.marketProfileId===market.id)||{name:"",url:"",group:"Business news",cadence:"Daily",country:market.countryCodes?.[0]||"GLOBAL",languages:market.languages||[],keywords:""};
  const groups=["Jobs","Company activity","Company intelligence","Public procurement","Business news","Startups and funding","Primary evidence","People and hiring","Other"];
  const countries=[...(market.countryCodes||[]),"GLOBAL"].filter((value,index,array)=>array.indexOf(value)===index);
  document.getElementById("modal-content").innerHTML=`<p class="kicker">Monitoring network</p><h2>${id?"Edit":"Add"} custom source</h2><p class="drawer-sub">Add a public HTTPS page that strengthens your evidence coverage. Custom sources are sent to Make only when enabled.</p><div class="form-grid source-editor"><label>Source name<input id="source-editor-name" value="${esc(source.name)}" placeholder="Example: Latvian Exporters Association"></label><label>Public HTTPS URL<input id="source-editor-url" type="url" value="${esc(source.url)}" placeholder="https://example.lv/news"></label><label>Category<select id="source-editor-group">${groups.map(group=>`<option ${group===source.group?"selected":""}>${esc(group)}</option>`).join("")}</select></label><label>Frequency<select id="source-editor-cadence">${["Daily","Weekly","On demand"].map(value=>`<option ${value===source.cadence?"selected":""}>${value}</option>`).join("")}</select></label><label>Country<select id="source-editor-country">${countries.map(value=>`<option ${value===source.country?"selected":""}>${esc(value==="GLOBAL"?"Global":value)}</option>`).join("")}</select></label><label>Languages <small>comma separated</small><input id="source-editor-languages" value="${esc((source.languages||[]).join(", "))}" placeholder="Latvian, English"></label><label class="wide">Keywords or page paths <small>Optional guidance for collection</small><textarea id="source-editor-keywords" placeholder="funding, hiring, procurement, /news/">${esc(source.keywords||"")}</textarea></label></div><div class="notice source-editor-note"><strong>Quality rule:</strong> A source adds candidates, but evidence still has to pass the deterministic quality gate before any OpenAI spend.</div><div class="card-actions" style="margin-top:14px"><button class="btn secondary" id="close-preview-action">Cancel</button><button class="btn primary" id="save-custom-source" data-source-id="${esc(id)}">Save source</button></div>`;
  openModal();
}

function saveCustomSource(id=""){
  const market=activeMarket();
  const name=document.getElementById("source-editor-name").value.trim();
  const rawUrl=document.getElementById("source-editor-url").value.trim();
  let parsedUrl;
  try{parsedUrl=new URL(rawUrl);}catch{showToast("Enter a valid public HTTPS URL");return;}
  if(parsedUrl.protocol!=="https:"){showToast("Custom sources must use HTTPS");return;}
  if(!name){showToast("Add a source name");return;}
  const duplicate=state.customSources.some(item=>item.marketProfileId===market.id&&item.id!==id&&String(item.url||"").replace(/\/$/,"")===parsedUrl.href.replace(/\/$/,""));
  if(duplicate){showToast("This source URL is already in the market pack");return;}
  const sourceId=id||makeId("source",name);
  const value={id:sourceId,marketProfileId:market.id,name,url:parsedUrl.href,group:document.getElementById("source-editor-group").value,cadence:document.getElementById("source-editor-cadence").value,country:document.getElementById("source-editor-country").value,languages:csvValues(document.getElementById("source-editor-languages").value),keywords:document.getElementById("source-editor-keywords").value.trim(),custom:true};
  const index=state.customSources.findIndex(item=>item.id===sourceId);
  if(index>=0)state.customSources[index]=value;else state.customSources.push(value);
  if(!Array.isArray(market.enabledSourceIds))market.enabledSourceIds=sourcePackForMarket(market).map(item=>item.id);
  if(!market.enabledSourceIds.includes(sourceId))market.enabledSourceIds.push(sourceId);
  saveState();closeModal();renderSources();renderControlCentre();showToast(id?"Custom source updated":"Custom source added and enabled");
}

function testSource(id){
  const source=sourcePackForMarket(activeMarket()).find(item=>item.id===id);
  if(!source)return;
  if(source.custom){const url=safeUrl(source.url);if(!url||new URL(url).protocol!=="https:"){showToast(`${source.name}: invalid HTTPS URL`);return;}}
  showToast(`${source.name}: setup passed · a successful Make collector result is needed for live verification`);
}

function sourceDetailPolicy(source){
  if(source.id==="global-company")return {
    trigger:"After qualification only",
    depth:"Depth 1",
    volume:"Top 5 companies · 6 pages per company",
    evidence:"Homepage, About, Services, News/blog, Careers and Contact",
    cost:"No full-site crawl. Runs only after scoring to protect Firecrawl/OpenAI spend.",
    why:"Confirms the company exists, what it sells, recent activity, fit and safe outreach context."
  };
  if(source.id==="global-apollo")return {
    trigger:"After a company is qualified",
    depth:"One enrichment lookup per company",
    volume:"Only for the selected decision-maker shortlist",
    evidence:"Verified business email, role, company match and LinkedIn/profile evidence when available",
    cost:"Reserved for qualified opportunities. Not used for broad discovery.",
    why:"Finds proven business contacts after the commercial signal is already good enough."
  };
  if(source.id==="global-linkedin")return {
    trigger:"Manual verification support",
    depth:"Open company/person profile only",
    volume:"Three suggested decision-maker searches",
    evidence:"Company page, public role/title match and visible profile signals",
    cost:"Manual public review only. No automated scraping or outreach.",
    why:"Helps you confirm the right person before sending anything."
  };
  return {
    trigger:source.cadence||"Daily",
    depth:source.custom?"Configured source page only":"Public source monitor",
    volume:source.custom?"One approved custom source":"Recommended regional connector",
    evidence:source.keywords||"Public business evidence related to the active signal rules",
    cost:source.costGuard||"Quality gate before paid AI or enrichment steps",
    why:`Supports ${source.group||"market"} signals for ${activeMarket().name}.`
  };
}

function openSourceDetails(id){
  const market=activeMarket();
  const source=sourcePackForMarket(market).find(item=>item.id===id);
  if(!source)return;
  const isEnabled=sourceEnabled(market,source.id);
  const url=safeUrl(source.url||"");
  const host=url?new URL(url).hostname.replace(/^www\./,""):"No fixed public URL";
  const role=source.id==="global-company"?"Mandatory proof":source.sourceKind==="public-platform"?"Manual verification":(source.sourceRole||sourceRoleForSource(source));
  const layer=source.sourceLayer||source.group||"Market evidence";
  const health=!isEnabled?"Paused":state.runtime.mode==="demo"?"Not live-tested":source.health||"Ready";
  const policy=sourceDetailPolicy(source);
  const actions=[
    url?`<a class="btn secondary" href="${esc(url)}" target="_blank" rel="noopener">Open source ↗</a>`:"",
    source.id==="global-company"?`<button class="btn secondary" data-company-source-info>View scan policy</button>`:"",
    source.custom?`<button class="btn secondary" data-source-edit="${esc(source.id)}">Edit source</button>`:"",
    `<button class="btn primary" data-source-toggle="${esc(source.id)}">${isEnabled?"Pause source":"Enable source"}</button>`
  ].filter(Boolean).join("");
  document.getElementById("modal-content").innerHTML=`<p class="kicker">Source details · ${esc(layer)}</p><h2>${esc(source.name)}</h2><p class="drawer-sub">${esc(source.group||"Public evidence")} · ${esc(source.cadence||"On demand")} · ${esc(source.country==="GLOBAL"?"Global":source.country||market.name)}</p><div class="source-detail-hero"><article><span>Status</span><strong>${esc(health)}</strong><small>${isEnabled?"Included in Make payload":"Excluded from Make payload"}</small></article><article><span>Role</span><strong>${esc(role)}</strong><small>${esc(source.activation||"Active when matching signal rules need it")}</small></article><article><span>Source link</span><strong>${esc(host)}</strong><small>${url?"Public page can be opened":"Uses qualified company URL or backend connector"}</small></article><article><span>Spend guard</span><strong>${esc(source.costGuard||"Quality gate")}</strong><small>Designed to avoid unnecessary paid lookups</small></article></div><div class="source-detail-grid"><article><strong>When does it run?</strong><p>${esc(policy.trigger)}</p></article><article><strong>How deep?</strong><p>${esc(policy.depth)}</p></article><article><strong>How many?</strong><p>${esc(policy.volume)}</p></article><article><strong>What evidence?</strong><p>${esc(policy.evidence)}</p></article><article><strong>Why this source?</strong><p>${esc(policy.why)}</p></article><article><strong>Cost rule</strong><p>${esc(policy.cost)}</p></article></div>${source.languages?.length?`<div class="notice source-detail-note"><strong>Languages:</strong> ${esc(source.languages.join(", "))}</div>`:""}${source.keywords?`<div class="notice source-detail-note"><strong>Keywords / paths:</strong> ${esc(source.keywords)}</div>`:""}<div class="card-actions source-detail-actions">${actions}<button class="btn secondary" id="close-preview-action">Close</button></div>`;
  openModal();
}

function renderRuns(){
  const rejected=Array.isArray(quality.recent_rejections)?quality.recent_rejections:[];
  const reasonLabels={junk_or_reference_page:"Reference or dictionary page",commercial_signal_missing:"No commercial signal",company_not_mentioned_in_evidence:"Company absent from evidence",discussion_source_not_primary_evidence:"Discussion page",source_too_old:"Source too old",source_url_invalid:"Invalid source URL",source_not_https:"Insecure source URL",company_missing:"Company missing",evidence_missing:"Evidence missing"};
  const reasonCounts={};rejected.forEach(item=>(item.reasons||[]).forEach(reason=>{reasonCounts[reason]=(reasonCounts[reason]||0)+1;}));
  const topReason=Object.entries(reasonCounts).sort((a,b)=>b[1]-a[1])[0];
  const policy=orchestration.policy;const budget=orchestration.budget;
  document.getElementById("run-safety-dashboard").innerHTML=policy?`<article><span>Daily run cap</span><strong>${policy.daily_run_limit}</strong><small>Hard backend limit</small></article><article><span>Per-run candidates</span><strong>${policy.per_run_candidate_limit}</strong><small>Maximum paid evaluations</small></article><article><span>Monthly candidate cap</span><strong>${policy.monthly_candidate_limit}</strong><small>Resets monthly</small></article><article><span>Dispatch protection</span><strong class="safe">${budget?.allowed?"Ready":"Protected"}</strong><small>${budget?.reason==="within_budget"?"Duplicate guard · no timeout retry":esc(String(budget?.reason||"Sign in to load limits").replaceAll("_"," "))}</small></article>`:'<article><span>Cost controls</span><strong>Sign in</strong><small>Protected runs require secure backend access</small></article>';
  document.getElementById("quality-dashboard").innerHTML=`<div class="quality-summary"><article><span>Rejected before storage</span><strong>${rejected.length}</strong><small>Low-quality candidates blocked</small></article><article><span>Most common failure</span><strong>${esc(topReason?reasonLabels[topReason[0]]||topReason[0]:"None")}</strong><small>${topReason?`${topReason[1]} recent ${topReason[1]===1?"result":"results"}`:"All recent candidates passed"}</small></article><article><span>Quality policy</span><strong>Deterministic</strong><small>No OpenAI call required</small></article></div>${rejected.length?`<div class="rejection-ledger"><div class="rejection-head"><strong>Recent quality rejections</strong><span>These candidates never enter the opportunity database</span></div>${rejected.map(item=>`<article><div><strong>${esc(item.company_name||"Unknown candidate")}</strong><a href="${esc(item.source_url||"#")}" ${item.source_url?'target="_blank" rel="noopener"':""}>${esc(item.source_title||item.source_url||"Source unavailable")}</a></div><div>${(item.reasons||[]).map(reason=>`<span>${esc(reasonLabels[reason]||reason)}</span>`).join("")}</div><time>${esc(item.created_at||"")}</time></article>`).join("")}</div>`:'<div class="quality-clear"><span>✓</span><div><strong>No recent quality failures</strong><p>New candidates will be checked for company relevance, commercial intent, source type, HTTPS, and freshness.</p></div></div>'}`;
  document.getElementById("runs-body").innerHTML=runs.map(r=>`<tr title="${esc(r.errorMessage||"")}"><td><strong>${esc(r.id)}</strong>${r.test?"<br><small>€0 validation</small>":""}</td><td>${esc(r.started)}</td><td>${r.findings}${r.candidateBudget?`<br><small>cap ${r.candidateBudget}</small>`:""}</td><td>${r.qualified}</td><td>${r.saved}</td><td>${r.emailed}</td><td>${r.errors}${r.errorCode?`<br><small>${esc(r.errorCode)}</small>`:""}</td><td><span class="status ${statusClass(r.status)}">${esc(r.status)}</span></td></tr>`).join("");
}

function ensureCrmRecords(){
  let changed=false;
  opportunities.forEach(o=>{
    if(state.crm.records[o.id])return;
    let stage="Discovered";
    if(o.score>=state.settings.minScore)stage="Qualified";
    if(o.contact.emailStatus==="Verified")stage="Contact Found";
    if(state.statuses[o.id]==="Approved")stage="Ready for Outreach";
    state.crm.records[o.id]={opportunityId:o.id,company:o.company,stage:o.pipelineStage||stage,owner:state.businessProfile.owner||"Unassigned",nextAction:o.nextAction||"Review evidence and decide the next step",notes:o.notes||"",updatedAt:formatNow()};
    changed=true;
  });
  if(changed)saveState();
}

function renderControlCentre(){
  const market=activeMarket();
  const countryChoices=[...COUNTRY_PRESETS,...(market.countries||[]).map((name,index)=>({name,code:(market.countryCodes||[])[index]||""})).filter(item=>!COUNTRY_PRESETS.some(preset=>preset.name===item.name))];
  const languageChoices=[...new Set([...LANGUAGE_PRESETS,...(market.languages||[])])];
  const pack=sourcePackForMarket(market);
  document.getElementById("market-profile-grid").innerHTML=state.marketProfiles.map(item=>`<button class="market-profile-card ${item.id===market.id?"selected":""}" data-market-profile="${esc(item.id)}"><strong>${esc(item.name)}</strong><span>${esc((item.countries||[]).join(", "))}</span><small>${esc((item.languages||[]).join(" · "))}</small></button>`).join("");
  document.getElementById("market-profile-editor").innerHTML=`
    <div class="editor-card market-editor-card" data-market-editor="${esc(market.id)}">
      <div class="editor-head"><div><p class="kicker">Active research region</p><h3>${esc(market.name)}</h3></div>${market.id==="custom"?'<button class="btn small secondary" data-remove-market="custom">Reset custom</button>':""}</div>
      <div class="editor-grid">
        <label>Profile name<input id="market-name" value="${esc(market.name)}"></label>
        <label class="wide">Countries <small>Choose presets or add a market</small><div class="choice-grid" id="market-country-choices">${countryChoices.map(item=>`<button type="button" class="choice-chip ${(market.countries||[]).includes(item.name)?"selected":""}" data-market-country="${esc(item.name)}" data-country-code="${esc(item.code)}">${esc(item.name)} <small>${esc(item.code)}</small></button>`).join("")}</div><div class="inline-add"><input id="market-custom-country" placeholder="Add another country"><input id="market-custom-code" maxlength="2" placeholder="Code"><button type="button" class="btn secondary" id="add-market-country">Add</button></div><input type="hidden" id="market-countries" value="${esc((market.countries||[]).join(", "))}"><input type="hidden" id="market-codes" value="${esc((market.countryCodes||[]).join(", "))}"></label>
        <label class="wide">Languages <small>Click to include or exclude</small><div class="choice-grid" id="market-language-choices">${languageChoices.map(language=>`<button type="button" class="choice-chip ${(market.languages||[]).includes(language)?"selected":""}" data-market-language="${esc(language)}">${esc(language)}</button>`).join("")}</div><div class="inline-add compact"><input id="market-custom-language" placeholder="Add another language"><button type="button" class="btn secondary" id="add-market-language">Add</button></div><input type="hidden" id="market-languages" value="${esc((market.languages||[]).join(", "))}"></label>
        <label class="wide">Decision-maker titles <small>comma separated</small><input id="market-titles" value="${esc((market.decisionTitles||[]).join(", "))}"></label>
        <label class="wide">Source focus<textarea id="market-source-focus">${esc(market.sourceFocus||"")}</textarea></label>
        <div class="source-pack-preview wide"><strong>${pack.filter(item=>!item.custom).length} recommended · ${pack.filter(item=>item.custom).length} custom sources</strong><span>${esc(pack.slice(0,6).map(item=>item.name).join(" · "))}${pack.length>6?" · …":""}</span><div class="source-pack-actions"><button type="button" class="btn small primary" id="generate-source-pack">Generate pack</button><button type="button" class="btn small secondary" data-view="sources">Manage sources</button></div></div>
        ${renderSourcePackGenerator(market)}
      </div>
    </div>`;
  document.getElementById("profile-owner").value=state.businessProfile.owner||"";
  document.getElementById("profile-company").value=state.businessProfile.company||"";
  document.getElementById("profile-summary").value=state.businessProfile.summary||"";
  document.getElementById("profile-website").value=state.businessProfile.website||"";
  document.getElementById("profile-email").value=state.businessProfile.email||"";
  document.getElementById("profile-document-notes").value=state.businessProfile.documentNotes||"";
  renderBusinessDocument();
  document.getElementById("offers-editor").innerHTML=state.offers.map(item=>`<article class="editor-card" data-offer-card="${esc(item.id)}"><div class="editor-head"><label class="inline-check"><input type="checkbox" data-offer-active ${item.active?"checked":""}> Active</label><button class="icon-button" data-remove-offer="${esc(item.id)}" aria-label="Delete offer">×</button></div><div class="editor-grid"><label>Offer name<input data-offer-name value="${esc(item.name)}"></label><label class="wide">What it solves<textarea data-offer-description>${esc(item.description)}</textarea></label></div></article>`).join("");
  document.getElementById("signal-rules-editor").innerHTML=state.signalRules.map(item=>`<article class="editor-card" data-signal-card="${esc(item.id)}"><div class="editor-head"><label class="inline-check"><input type="checkbox" data-signal-active ${item.active?"checked":""}> Active</label><button class="icon-button" data-remove-signal="${esc(item.id)}" aria-label="Delete signal">×</button></div><div class="editor-grid"><label>Signal name<input data-signal-name value="${esc(item.name)}"></label><label>Priority weight /10<input data-signal-weight type="number" min="1" max="10" value="${Number(item.weight)||5}"></label><label class="wide">Keywords and phrases<textarea data-signal-keywords>${esc(item.keywords)}</textarea></label></div></article>`).join("");
  const offerOptions=state.offers.map(item=>`<option value="${esc(item.id)}">${esc(item.name)}</option>`).join("");
  const signalOptions=state.signalRules.map(item=>`<option value="${esc(item.id)}">${esc(item.name)}</option>`).join("");
  document.getElementById("playbooks-editor").innerHTML=state.playbooks.map(item=>{const mode=item.sendMode==="Automatic after approval rule"?"Automatic":item.sendMode||"Approval required";const ctaMode=item.ctaMode||"Include in initial email";return `<article class="editor-card playbook-card" data-playbook-card="${esc(item.id)}"><div class="editor-head"><label class="inline-check"><input type="checkbox" data-playbook-active ${item.active?"checked":""}> Active</label><span class="playbook-route ${mode==="Automatic"?"auto":"review"}">${esc(mode)}</span><button class="icon-button" data-remove-playbook="${esc(item.id)}" aria-label="Delete playbook">×</button></div><div class="editor-grid"><label>Playbook name<input data-playbook-name value="${esc(item.name)}"></label><label>Offer<select data-playbook-offer>${offerOptions}</select></label><label>Signal<select data-playbook-signal>${signalOptions}</select></label><label>Decision-maker role<input data-playbook-role value="${esc(item.role||"")}"></label><label>Channel<select data-playbook-channel>${["Email","LinkedIn"].map(value=>`<option ${value===item.channel?"selected":""}>${value}</option>`).join("")}</select></label><label>Language<input data-playbook-language value="${esc(item.language||"English")}"></label><label>Delivery mode<select data-playbook-send-mode>${["Approval required","Draft only","Automatic"].map(value=>`<option ${value===mode?"selected":""}>${value}</option>`).join("")}</select></label><label>Booking CTA<select data-playbook-cta-mode>${["Include in initial email","Include after positive reply","Never include"].map(value=>`<option ${value===ctaMode?"selected":""}>${value}</option>`).join("")}</select></label><label>Minimum score<input data-playbook-min-score type="number" min="1" max="10" step=".1" value="${Math.max(1,Math.min(10,Number(item.minScore)||8))}"></label><label>Playbook daily cap<input data-playbook-daily-limit type="number" min="1" max="5" value="${Math.max(1,Math.min(5,Number(item.dailyLimit)||3))}"></label><label class="toggle-row"><span>High confidence only<small>Required for automatic route</small></span><input type="checkbox" data-playbook-high-confidence ${item.requireHighConfidence!==false?"checked":""}></label><label class="toggle-row wide"><span>Script approved for automatic use<small>Still requires verified work email, evidence, eligibility and available daily capacity</small></span><input type="checkbox" data-playbook-auto-approved ${item.autoApproved?"checked":""}></label><label class="wide">Subject<input data-playbook-subject value="${esc(item.subject||"")}"></label><label class="wide">Predefined message template<textarea class="script-box" data-playbook-body>${esc(item.body||"")}</textarea><small>The booking invitation is added according to the CTA setting; you do not need to paste the URL into every script.</small></label></div></article>`}).join("");
  state.playbooks.forEach(item=>{const card=document.querySelector(`[data-playbook-card="${CSS.escape(item.id)}"]`);if(card){card.querySelector("[data-playbook-offer]").value=item.offerId;card.querySelector("[data-playbook-signal]").value=item.signalId;}});
  const counts={offers:state.offers.filter(item=>item.active).length,signals:state.signalRules.filter(item=>item.active).length,playbooks:state.playbooks.filter(item=>item.active).length};
  document.getElementById("control-markets-meta").textContent=`${market.name} · ${(market.countries||[]).length} ${(market.countries||[]).length===1?"country":"countries"}`;
  document.getElementById("control-profile-meta").textContent=`${state.businessProfile.company||"Profile incomplete"} · ${state.businessProfile.document?"PDF attached":"No PDF"}`;
  document.getElementById("control-offers-meta").textContent=`${counts.offers}/${state.offers.length} active`;
  document.getElementById("control-signals-meta").textContent=`${counts.signals}/${state.signalRules.length} active`;
  const automatic=state.playbooks.filter(item=>item.active&&(item.sendMode==="Automatic"||item.sendMode==="Automatic after approval rule")&&item.autoApproved).length;
  document.getElementById("control-playbooks-meta").textContent=`${counts.playbooks}/${state.playbooks.length} active · ${automatic} automatic-approved`;
  document.querySelectorAll("[data-control-section]").forEach(section=>{section.open=state.ui.controlSections[section.dataset.controlSection]!==false;});
}

function renderBusinessDocument(){
  const metadata=state.businessProfile.document;
  const status=document.getElementById("profile-pdf-status");
  if(!status)return;
  document.getElementById("profile-pdf-open").disabled=!metadata;
  document.getElementById("profile-pdf-remove").disabled=!metadata;
  status.innerHTML=metadata
    ? `<div class="profile-document-file"><span aria-hidden="true">PDF</span><div><strong>${esc(metadata.name)}</strong><small>${esc(formatBytes(Number(metadata.size)))} · added ${esc(new Date(metadata.uploadedAt).toLocaleDateString())}</small></div></div>`
    : '<div class="profile-document-empty"><strong>No reference PDF attached</strong><small>Add one document to strengthen the reusable business profile.</small></div>';
}

function csvValues(value){return String(value||"").split(",").map(item=>item.trim()).filter(Boolean);}
function readControlCentre(){
  const market=activeMarket();
  Object.assign(market,{name:document.getElementById("market-name").value.trim()||market.name,countries:csvValues(document.getElementById("market-countries").value),countryCodes:csvValues(document.getElementById("market-codes").value).map(item=>item.toUpperCase()),languages:csvValues(document.getElementById("market-languages").value),decisionTitles:csvValues(document.getElementById("market-titles").value),sourceFocus:document.getElementById("market-source-focus").value.trim()});
  state.workspace.market=market.name;
  state.businessProfile={...state.businessProfile,owner:document.getElementById("profile-owner").value.trim(),company:document.getElementById("profile-company").value.trim(),summary:document.getElementById("profile-summary").value.trim(),website:document.getElementById("profile-website").value.trim(),email:document.getElementById("profile-email").value.trim(),documentNotes:document.getElementById("profile-document-notes").value.trim()};
  state.offers=[...document.querySelectorAll("[data-offer-card]")].map(card=>({id:card.dataset.offerCard,name:card.querySelector("[data-offer-name]").value.trim(),description:card.querySelector("[data-offer-description]").value.trim(),active:card.querySelector("[data-offer-active]").checked})).filter(item=>item.name);
  state.signalRules=[...document.querySelectorAll("[data-signal-card]")].map(card=>({id:card.dataset.signalCard,name:card.querySelector("[data-signal-name]").value.trim(),keywords:card.querySelector("[data-signal-keywords]").value.trim(),weight:Math.max(1,Math.min(10,Number(card.querySelector("[data-signal-weight]").value)||5)),active:card.querySelector("[data-signal-active]").checked})).filter(item=>item.name);
  state.playbooks=[...document.querySelectorAll("[data-playbook-card]")].map(card=>({id:card.dataset.playbookCard,name:card.querySelector("[data-playbook-name]").value.trim(),offerId:card.querySelector("[data-playbook-offer]").value,signalId:card.querySelector("[data-playbook-signal]").value,role:card.querySelector("[data-playbook-role]").value.trim(),channel:card.querySelector("[data-playbook-channel]").value,language:card.querySelector("[data-playbook-language]").value.trim(),sendMode:card.querySelector("[data-playbook-send-mode]").value,ctaMode:card.querySelector("[data-playbook-cta-mode]").value,minScore:Math.max(1,Math.min(10,Number(card.querySelector("[data-playbook-min-score]").value)||8)),dailyLimit:Math.max(1,Math.min(5,Number(card.querySelector("[data-playbook-daily-limit]").value)||3)),requireHighConfidence:card.querySelector("[data-playbook-high-confidence]").checked,autoApproved:card.querySelector("[data-playbook-auto-approved]").checked,subject:card.querySelector("[data-playbook-subject]").value.trim(),body:card.querySelector("[data-playbook-body]").value,active:card.querySelector("[data-playbook-active]").checked})).filter(item=>item.name);
}

function syncMarketChoiceFields(){
  const countries=[...document.querySelectorAll("[data-market-country].selected")];
  const languages=[...document.querySelectorAll("[data-market-language].selected")];
  const countryField=document.getElementById("market-countries");
  if(countryField)countryField.value=countries.map(item=>item.dataset.marketCountry).join(", ");
  const codeField=document.getElementById("market-codes");
  if(codeField)codeField.value=countries.map(item=>item.dataset.countryCode).filter(Boolean).join(", ");
  const languageField=document.getElementById("market-languages");
  if(languageField)languageField.value=languages.map(item=>item.dataset.marketLanguage).join(", ");
}

function renderCRM(){
  ensureCrmRecords();
  const allRecords=opportunities.map(o=>({o,record:state.crm.records[o.id]}));
  const query=crmSearch.trim().toLowerCase();
  const records=allRecords.filter(({o,record})=>(crmStageFilter==="All"||record.stage===crmStageFilter)&&(!query||`${o.company} ${o.signal} ${o.primaryOffer} ${o.contact.name} ${record.notes||""}`.toLowerCase().includes(query)));
  document.getElementById("crm-count").textContent=query||crmStageFilter!=="All"?`${records.length}/${allRecords.length}`:allRecords.length;
  document.getElementById("crm-search").value=crmSearch;
  document.getElementById("crm-stage-filter").innerHTML=`<option value="All">All stages</option>${state.crm.stageOrder.map(stage=>`<option value="${esc(stage)}">${esc(stage)}</option>`).join("")}`;
  document.getElementById("crm-stage-filter").value=crmStageFilter;
  const visibleStages=crmStageFilter==="All"?state.crm.stageOrder:[crmStageFilter];
  document.getElementById("crm-board").innerHTML=visibleStages.map(stage=>{
    const list=records.filter(item=>item.record.stage===stage);
    return `<section class="crm-column"><header><strong>${esc(stage)}</strong><span>${list.length}</span></header><div class="crm-column-body">${list.map(({o,record})=>`<article class="crm-card"><div class="crm-card-score">${o.score.toFixed(1)}</div><h3>${esc(o.company)}</h3><p>${esc(o.signal)}</p><small>${esc(o.primaryOffer)}</small><label>Stage<select data-crm-stage="${esc(o.id)}">${state.crm.stageOrder.map(value=>`<option ${value===record.stage?"selected":""}>${esc(value)}</option>`).join("")}</select></label><label>Next action<input data-crm-next-action="${esc(o.id)}" value="${esc(record.nextAction||"")}" placeholder="Call, research, follow up…"></label><details><summary>Notes</summary><textarea data-crm-notes="${esc(o.id)}" placeholder="Private working notes">${esc(record.notes||"")}</textarea></details><div class="crm-card-actions"><button class="btn small secondary" data-open="${esc(o.id)}">Open dossier</button><button class="btn small secondary" data-message="${esc(o.id)}">Draft outreach</button>${record.stage==="Meeting"?'<span class="status good">Meeting booked</span>':`<button class="btn small secondary" data-meeting-booked="${esc(o.id)}">Mark meeting booked</button>`}</div></article>`).join("")||'<div class="crm-empty">No companies</div>'}</div></section>`;
  }).join("");
}

function matchingPlaybook(o){
  const offer=state.offers.find(item=>item.name===o.primaryOffer);
  const text=`${o.signalType} ${o.signal}`.toLowerCase();
  const signal=state.signalRules.find(item=>String(item.keywords||"").split(",").some(keyword=>keyword.trim()&&text.includes(keyword.trim().toLowerCase())));
  return state.playbooks.find(item=>item.active&&item.offerId===offer?.id&&(!signal||item.signalId===signal.id))||state.playbooks.find(item=>item.active&&item.offerId===offer?.id)||state.playbooks.find(item=>item.active&&(!signal||item.signalId===signal.id))||state.playbooks.find(item=>item.active);
}
function languageModeLabel(mode=state.settings.languageMode){
  return LANGUAGE_MODES.find(item=>item.id===mode)?.label||LANGUAGE_MODES[0].label;
}
function resolvedOutreachLanguage(o={},playbook=null){
  const mode=state.settings.languageMode||"auto-market";
  if(mode==="latvian-only")return "Latvian";
  if(mode==="english-only")return "English";
  const market=activeMarket();
  const localLanguage=market.languages?.[0]||playbook?.language||"English";
  const text=[o.company,o.location,o.signal,o.signalType,o.contact?.role,playbook?.language].filter(Boolean).join(" ").toLowerCase();
  const looksLatvian=/latvia|riga|jelgava|mārupe|sia|as\b|latv/i.test(text);
  const looksInternational=/english|global|international|export|baltic|nordic|cee|europe/i.test(text);
  if(mode==="bilingual-lv-en")return looksLatvian&&!looksInternational?"Latvian":"English";
  return looksInternational?state.settings.outreachFallbackLanguage:localLanguage;
}
function fillTemplate(value,o){const first=o.contact.name.split(" ")[0]||"there";return String(value||"").replaceAll("{{company}}",o.company).replaceAll("{{first_name}}",first).replaceAll("{{signal_type}}",o.signalType).replaceAll("{{signal}}",o.signal).replaceAll("{{offer}}",o.primaryOffer).replaceAll("{{booking_link}}",state.scheduling.bookingUrl);}
function shouldIncludeBooking(o,playbook){
  const mode=playbook?.ctaMode||"Include in initial email";if(mode==="Never include"||!state.scheduling.bookingUrl)return false;
  if(mode==="Include in initial email")return true;
  const stage=state.crm.records[o.id]?.stage||"Discovered";return state.crm.stageOrder.indexOf(stage)>=state.crm.stageOrder.indexOf("Replied");
}
function applyBookingInvitation(body,o,playbook){
  if(!shouldIncludeBooking(o,playbook))return body;
  if(body.includes(state.scheduling.bookingUrl))return body;
  const cta=fillTemplate(state.scheduling.ctaCopy,o);const signoff=body.search(/\n\n(?:Best|Regards|Kind regards|Sincerely),/i);
  return signoff>=0?`${body.slice(0,signoff).trim()}\n\n${cta}\n\n${body.slice(signoff).trim()}`:`${body.trim()}\n\n${cta}`;
}

function isPersonalEmail(contact={}){
  const email=String(contact.email||"").toLowerCase();
  return contact.emailType==="personal"||contact.emailStatus==="Strong match"||/@(gmail|outlook|hotmail|icloud|yahoo|protonmail|proton)\./.test(email);
}
function isVerifiedWorkEmail(o){return o.contact?.emailStatus==="Verified"&&!isPersonalEmail(o.contact);}
function automationDecision(o,playbook,index=0){
  const reasons=[];const listState=state.listStates[o.id]||"Research";const mode=playbook?.sendMode==="Automatic after approval rule"?"Automatic":playbook?.sendMode||"Approval required";
  const minScore=Math.max(state.settings.minScore,Number(playbook?.minScore)||8);
  if(!playbook?.active)reasons.push("No active playbook match");
  if(!playbook?.subject?.trim()||!playbook?.body?.trim())reasons.push("Predefined script incomplete");
  if(!o.evidence?.some(item=>item.url))reasons.push("Source evidence missing");
  if(Number(o.score)<minScore)reasons.push(`Score below ${minScore}`);
  if(playbook?.requireHighConfidence!==false&&o.confidence!=="High")reasons.push("High confidence required");
  if(isPersonalEmail(o.contact))reasons.push("Personal email requires review");
  else if(!isVerifiedWorkEmail(o))reasons.push("Verified work email required");
  if(listState!=="Eligible")reasons.push(listState==="Suppressed"||listState==="Unsubscribed"?`Contact is ${listState.toLowerCase()}`:"Campaign eligibility not approved");
  const cap=Math.min(state.outreachAutomation.dailyLimit,Math.max(1,Math.min(5,Number(playbook?.dailyLimit)||3)));
  if(index>=cap)reasons.push(`Daily cap of ${cap} reached`);
  const eligible=reasons.length===0;
  let route="Human review";
  if(mode==="Draft only")route="Draft only";
  else if(state.statuses[o.id]==="Approved"&&isPersonalEmail(o.contact)&&listState==="Manual review")route="Approved export only";
  else if(state.statuses[o.id]==="Approved"&&eligible)route=state.outreachAutomation.senderConnected?"Approved to send":"Ready for sender";
  else if(mode==="Automatic"&&state.outreachAutomation.enabled&&playbook?.autoApproved&&eligible)route=state.outreachAutomation.senderConnected?"Automatic send ready":"Ready for sender";
  else if(mode==="Automatic"&&!playbook?.autoApproved)reasons.unshift("Script not approved for automatic use");
  return {mode,eligible,route,reasons,cap,automatic:route==="Automatic send ready"||route==="Ready for sender"&&mode==="Automatic"};
}
function outreachDecisions(){
  const ordered=[...opportunities].sort((a,b)=>b.score-a.score);let automaticIndex=0;
  return ordered.map(o=>{const playbook=matchingPlaybook(o);const preliminary=automationDecision(o,playbook,automaticIndex);if((playbook?.sendMode==="Automatic"||playbook?.sendMode==="Automatic after approval rule")&&preliminary.eligible)automaticIndex+=1;return {o,playbook,decision:preliminary};});
}
function addOutreachAudit(opportunityId,event,detail){
  state.outreachAudit=[{id:makeId("audit"),opportunityId,event,detail,date:formatNow()},...state.outreachAudit].slice(0,100);
}

function renderOutreach(){
  const decisions=outreachDecisions();
  const list=decisions.filter(({o,decision})=>["Draft ready","Approved"].includes(state.statuses[o.id])||state.listStates[o.id]==="Eligible"||decision.route==="Human review");
  document.getElementById("outreach-count").textContent=list.length;
  const automatic=decisions.filter(item=>item.decision.automatic).length;const review=decisions.filter(item=>item.decision.route==="Human review").length;const ready=decisions.filter(item=>item.decision.route==="Ready for sender"||item.decision.route==="Approved to send").length;
  const notice=document.getElementById("outreach-automation-notice");notice.innerHTML=state.outreachAutomation.enabled?`<strong>Safe automatic route is on.</strong> Only approved scripts with a verified work email, evidence, eligibility, score and daily capacity can bypass review. Personal emails always require approval. ${state.outreachAutomation.senderConnected?"The sender is connected.":"No sender is connected, so ready messages remain queued and nothing is reported as sent."}`:'<strong>Automatic routing is off.</strong> Every message stays in draft or human review.';
  document.getElementById("outreach-summary").innerHTML=`<article><strong>${automatic}</strong><span>Automatic-ready</span></article><article><strong>${review}</strong><span>Human review</span></article><article><strong>${ready}</strong><span>Waiting for sender</span></article><article><strong>${state.outreachAutomation.dailyLimit}</strong><span>Daily maximum</span></article>`;
  document.getElementById("outreach-grid").innerHTML=list.length?list.map(({o,playbook,decision})=>{
    const stage=state.crm.records[o.id]?.stage||"Discovered";
    const language=resolvedOutreachLanguage(o,playbook);
    const routeTone=decision.route.includes("Automatic")||decision.route.includes("sender")||decision.route.includes("send")?"good":decision.route==="Draft only"?"":"warn";
    const canManualApprove=decision.eligible||(isPersonalEmail(o.contact)&&o.contact.emailStatus==="Strong match"&&state.listStates[o.id]==="Manual review");
    const routeAction=decision.route==="Human review"?`<button class="btn primary" data-status-action="Approved" data-id="${o.id}" ${canManualApprove?"":"disabled"}>Approve</button>`:decision.route==="Approved export only"?'<button class="btn primary" disabled>Export ready</button>':`<button class="btn primary" disabled>${state.outreachAutomation.senderConnected?"Queued safely":"Connect sender"}</button>`;
    return `<article class="outreach-card"><div class="outreach-card-head"><div><p class="kicker">${esc(state.statuses[o.id]||"Research")} · ${esc(stage)}</p><h3>${esc(o.company)}</h3></div><span class="status ${routeTone}">${esc(decision.route)}</span></div><p>${esc(o.signal)}</p><div class="outreach-meta"><span>${esc(o.contact.name||"Contact needed")}</span><span>${esc(o.contact.role||"Role needed")}</span><span>${esc(playbook?.name||"No playbook match")}</span><span>${esc(languageModeLabel())}: ${esc(language)}</span><span>${esc(decision.mode)}</span></div><div class="safety-checks">${decision.reasons.length?decision.reasons.map(reason=>`<span class="failed">× ${esc(reason)}</span>`).join(""):'<span class="passed">✓ All delivery checks passed</span>'}</div><div class="card-actions"><button class="btn secondary" data-message="${o.id}">Edit script</button>${routeAction}</div></article>`;
  }).join(""):'<div class="empty-state"><h3>No outreach candidates yet</h3><p>Qualified opportunities appear here after playbook matching and contact eligibility checks.</p></div>';
  const current=decisions.slice(0,8).map(({o,playbook,decision})=>({opportunityId:o.id,event:decision.route,detail:`${o.company} · ${playbook?.name||"No playbook"}`}));
  const audit=[...state.outreachAudit,...current].slice(0,12);
  document.getElementById("outreach-audit").innerHTML=audit.length?`<div class="audit-list">${audit.map(item=>`<article><i></i><div><strong>${esc(item.event)}</strong><span>${esc(item.detail||item.opportunityId)}</span></div><small>${esc(item.date||"Current evaluation")}</small></article>`).join("")}</div>`:'<p class="panel-copy">No outreach decisions have been recorded.</p>';
}

function renderRuntimeStatus(){
  const pill=document.getElementById("runtime-pill");
  const modes={demo:"Demo data",imported:"Imported data",live:"Live endpoint"};
  pill.lastChild.textContent=` ${modes[state.runtime.mode]||"Local data"}`;
  pill.classList.toggle("live",state.runtime.mode==="live");
  document.getElementById("status-make").textContent=state.integrations.runUrl?"Configured":"Endpoint needed";
  document.getElementById("status-make").classList.toggle("pending",!state.integrations.runUrl);
  const apollo=document.getElementById("status-apollo");if(apollo){apollo.textContent=enrichmentControl.configured?"Securely connected":"Secure key needed";apollo.classList.toggle("pending",!enrichmentControl.configured);}
  const sender=document.getElementById("status-sender");if(sender){sender.textContent=state.outreachAutomation.senderConnected?"Connected":"Not connected";sender.classList.toggle("pending",!state.outreachAutomation.senderConnected);}
  const calendly=document.getElementById("status-calendly");if(calendly){calendly.textContent=state.scheduling.bookingUrl?"Configured":"Link needed";calendly.classList.toggle("pending",!state.scheduling.bookingUrl);}
  const zoom=document.getElementById("status-zoom");if(zoom){zoom.textContent=state.scheduling.platform==="Zoom"?"Configured":"Review";zoom.classList.toggle("pending",state.scheduling.platform!=="Zoom");}
  const bookingWebhook=document.getElementById("status-booking-webhook");if(bookingWebhook){bookingWebhook.textContent=state.scheduling.bookingWebhookConnected?"Connected":"Not connected";bookingWebhook.classList.toggle("pending",!state.scheduling.bookingWebhookConnected);}
  document.getElementById("status-sheets").textContent="Workbook ready";
  document.getElementById("setting-workspace-id").value=state.workspace.id;
  document.getElementById("setting-workspace-name").value=state.workspace.name;
  const marketSelect=document.getElementById("setting-market");
  if(marketSelect){
    marketSelect.innerHTML=state.marketProfiles.map(item=>`<option value="${esc(item.id)}">${esc(item.name)} · ${esc((item.countries||[]).join(", ")||"No countries")}</option>`).join("");
    marketSelect.value=state.activeMarketProfileId;
  }
  const marketSummaryEl=document.getElementById("setting-market-summary");
  if(marketSummaryEl)marketSummaryEl.textContent=`Current pack: ${marketSummary(activeMarket())}. Edit exact countries, languages and source rules in the Control centre.`;
  document.getElementById("setting-data-url").value=state.integrations.dataUrl;
  document.getElementById("setting-run-url").value=state.integrations.runUrl;
  const last=runs[0]||{};
  const qualified=opportunities.filter(o=>o.score>=state.settings.minScore&&o.keep!==false).length;
  const saved=Math.min(state.settings.appCount,qualified);
  const emailed=Math.min(state.settings.emailCount,saved);
  const findings=numberValue(last.findings,opportunities.length);
  const signalCount=signals.length;
  const runLabel=state.runtime.lastSync?`Last synced ${state.runtime.lastSync}`:state.runtime.mode==="demo"?"Demo snapshot · no live endpoint connected":`${modes[state.runtime.mode]||"Local data"} loaded`;
  document.getElementById("latest-run-label").textContent=runLabel;
  document.getElementById("latest-run-status").textContent=state.runtime.mode==="demo"?"Demo":state.runtime.error?"Review":"Ready";
  document.getElementById("funnel-findings").textContent=findings;
  document.getElementById("funnel-signals").textContent=signalCount;
  document.getElementById("funnel-qualified").textContent=qualified;
  document.getElementById("funnel-saved").textContent=saved;
  document.getElementById("funnel-emailed").textContent=emailed;
  document.getElementById("funnel-threshold").textContent=`Score ≥ ${state.settings.minScore.toFixed(1)}`;
  document.getElementById("hero-run-label").textContent=runLabel;
  document.getElementById("hero-funnel-label").innerHTML=`${findings} findings → ${signalCount} signals → ${qualified} qualified → <strong>${saved} saved</strong> · Top <strong>${emailed} emailed</strong>`;
  renderOperationalReminders();
}

function renderOperationalReminders(){
  const policy=enrichmentControl.policy||{};
  const usage=enrichmentControl.usage||{};
  const dailyLimit=Number(policy.daily_credit_limit)||0;
  const monthlyLimit=Number(policy.monthly_credit_limit)||0;
  const usedRatio=(used,limit)=>limit?Number(used||0)/limit:0;
  const reminders=[];
  if(state.runtime.mode==="demo")reminders.push({tone:"warn",title:"Demo data is active",detail:"Connect or sync the live endpoint before trusting production counts.",action:"Sync data"});
  if(state.runtime.error)reminders.push({tone:"bad",title:"Latest sync needs review",detail:state.runtime.error,action:"Open run history"});
  if(!state.integrations.runUrl)reminders.push({tone:"bad",title:"Make run endpoint missing",detail:"Run research cannot trigger the production scenario yet.",action:"Add webhook"});
  if(!enrichmentControl.configured)reminders.push({tone:"warn",title:"Apollo secure key needed",detail:"Contact lookup stays off until the backend key is connected.",action:"Connect Apollo"});
  if(dailyLimit&&usedRatio(usage.daily,dailyLimit)>=.8)reminders.push({tone:"warn",title:"Apollo daily credits running low",detail:`${usage.daily||0} of ${dailyLimit} lookups used today.`,action:"Slow enrichment"});
  if(monthlyLimit&&usedRatio(usage.monthly,monthlyLimit)>=.8)reminders.push({tone:"warn",title:"Apollo monthly credits running low",detail:`${usage.monthly||0} of ${monthlyLimit} lookups used this month.`,action:"Protect budget"});
  if(!state.outreachAutomation.senderConnected)reminders.push({tone:"warn",title:"Email sender not connected",detail:"Drafts can be prepared, but delivery should stay manual until sender status is green.",action:"Connect sender"});
  if(!state.scheduling?.bookingUrl)reminders.push({tone:"warn",title:"Calendly booking link missing",detail:"Meeting CTA will not be inserted into outreach drafts.",action:"Add booking URL"});
  const good=reminders.length===0;
  const count=document.getElementById("reminder-count");
  const grid=document.getElementById("operational-reminders");
  if(count){
    count.textContent=good?"All clear":`${reminders.length} alert${reminders.length===1?"":"s"}`;
    count.classList.toggle("good",good);
    count.classList.toggle("warn",!good);
  }
  if(grid)grid.innerHTML=good?'<article class="reminder-card good"><strong>All critical systems look ready</strong><p>Credits, core endpoints and scheduling checks are not reporting problems.</p><span>Monitor after each live run</span></article>':reminders.map(item=>`<article class="reminder-card ${esc(item.tone)}"><strong>${esc(item.title)}</strong><p>${esc(item.detail)}</p><span>${esc(item.action)}</span></article>`).join("");
}

function scoreFactorExplanation(o,label,value,max){
  const evidenceCount=o.evidence.filter(item=>item.claim).length;
  const age=dateAge(o.signalDate);
  const explanations={
    "ICP fit":`${o.industry} matched against the active business profile and target market.`,
    "Signal strength":`${evidenceCount} sourced ${evidenceCount===1?"claim":"claims"} support this opportunity.`,
    "Urgency":o.whyNow||"Urgency requires commercial validation.",
    "Recency":age===null?"The source date is unavailable; treat recency cautiously.":age===0?"Captured today.":`Captured ${age} ${age===1?"day":"days"} ago.`,
    "Offer relevance":`${o.primaryOffer} is the model-selected best-fit offer.`,
    "Budget":/fund|invest|procure|tender|budget/i.test(`${o.signal} ${o.whyNow}`)?"The public signal contains a budget, funding, investment, or procurement indicator.":"No direct budget evidence; this component is inferred.",
    "Accessibility":o.contact.emailStatus==="Verified"?"A verified business email is available.":"No verified business email is available yet."
  };
  const factual=["Signal strength","Recency","Accessibility"].includes(label);
  return {text:explanations[label]||"Model assessment based on the captured signal.",basis:factual?"Evidence-based":"AI assessment",ratio:Math.min(100,Math.max(0,(Number(value)||0)/(max||1)*100))};
}

function dossierQuality(o){
  const sourced=o.evidence.filter(item=>item.url&&item.claim).length;
  const fresh=o.evidence.filter(item=>{const age=dateAge(item.observedAt||o.signalDate);return age!==null&&age<=90;}).length;
  const verified=o.contact.emailStatus==="Verified";
  const complete=sourced>0&&fresh>0;
  return {sourced,fresh,verified,label:complete&&verified?"Decision ready":complete?"Evidence ready":"Needs verification",tone:complete&&verified?"strong":complete?"good":"review"};
}

function openDrawer(id){
  const o=opportunities.find(item=>item.id===id);if(!o)return;
  const scoreMax={"ICP fit":2,"Signal strength":2,"Urgency":1.5,"Recency":1,"Offer relevance":1.5,"Budget":1,"Accessibility":1};
  const quality=dossierQuality(o);
  const factorTotal=Object.values(o.scores).reduce((sum,value)=>sum+(Number(value)||0),0);
  const scoreAligned=Math.abs(factorTotal-o.score)<.11;
  const canApprove=isVerifiedWorkEmail(o)&&state.listStates[o.id]==="Eligible"||isPersonalEmail(o.contact)&&o.contact.emailStatus==="Strong match"&&state.listStates[o.id]==="Manual review";
  const linkedinTargets=linkedInContactTargets(o);
  document.getElementById("drawer-content").innerHTML=`
    <div class="dossier-head"><div><p class="kicker">Decision dossier · ${esc(o.id)}</p><h2>${esc(o.company)}</h2><p class="drawer-sub">${esc(o.industry)} · ${esc(o.location)} · ${esc(o.signalType)}</p></div><span class="dossier-readiness ${quality.tone}"><i></i>${quality.label}</span></div>
    <div class="dossier-summary"><div class="detail-score"><strong>${o.score.toFixed(1)}</strong><div><b>Opportunity score /10</b><p>${esc(o.confidence)} model confidence</p></div></div><dl><div><dt>Sourced claims</dt><dd>${quality.sourced}</dd></div><div><dt>Fresh ≤90 days</dt><dd>${quality.fresh}</dd></div><div><dt>Verified contact</dt><dd>${quality.verified?"Yes":"No"}</dd></div></dl></div>
    <div class="dossier-notice ${scoreAligned?"":"score-warning"}"><strong>${scoreAligned?"How to read this dossier":"Score reconciliation needed"}</strong><span>${scoreAligned?'Green “evidence-based” labels point to checkable facts. Amber “AI assessment” labels are commercial interpretations and should be validated before outreach.':`The factor total is ${factorTotal.toFixed(1)}, while the stored score is ${o.score.toFixed(1)}. Review the scoring output before acting.`}</span></div>
    <section class="detail-section score-explanation"><div class="section-title"><div><span>01</span><h3>Score explanation</h3></div><small>Transparent 10-point model</small></div><div class="score-factors">${Object.entries(o.scores).map(([label,rawValue])=>{const value=Number(rawValue)||0;const rationale=scoreFactorExplanation(o,label,value,scoreMax[label]);return `<article class="score-factor"><div class="factor-head"><strong>${esc(label)}</strong><b>${value.toFixed(1)}<small>/${scoreMax[label]}</small></b></div><span class="bar"><i style="width:${rationale.ratio}%"></i></span><p>${esc(rationale.text)}</p><em class="basis ${rationale.basis==="Evidence-based"?"evidence-based":"assessment"}">${rationale.basis}</em></article>`;}).join("")}</div></section>
    <section class="detail-section"><div class="section-title"><div><span>02</span><h3>Sourced evidence</h3></div><small>${quality.sourced} independently openable</small></div><div class="evidence-ledger">${o.evidence.map((e,index)=>{const profile=sourceProfile(e.url);const age=dateAge(e.observedAt||o.signalDate);return `<article class="evidence-item"><div class="evidence-index">${String(index+1).padStart(2,"0")}</div><div><p>${esc(e.claim||"Evidence statement unavailable")}</p><div class="evidence-meta"><span class="source-quality ${profile.tone}">${profile.label}</span><span>${esc(profile.detail)}</span><span>${age===null?"Date unavailable":age===0?"Today":`${age}d old`}</span></div>${e.url?`<a href="${esc(e.url)}" target="_blank" rel="noopener">Open original source ↗</a>`:'<span class="missing-source">Source URL missing · verify before use</span>'}</div></article>`;}).join("")}</div></section>
    <section class="detail-section assessment-section"><div class="section-title"><div><span>03</span><h3>Commercial assessment</h3></div><em class="basis assessment">AI assessment</em></div><h4>Why now</h4><p>${esc(o.whyNow)}</p><h4>Likely pain points to validate</h4><ul>${o.pains.map(p=>`<li>${esc(p)}</li>`).join("")}</ul><div class="assessment-warning">These pain points are hypotheses, not verified company statements.</div></section>
    <section class="detail-section"><div class="section-title"><div><span>04</span><h3>Decision-maker verification</h3></div><span class="status ${statusClass(o.contact.emailStatus)}">${esc(o.contact.emailStatus)}</span></div><div class="contact-proof"><span class="avatar">${initials(o.contact.name||o.company)}</span><div><strong>${esc(o.contact.name)}</strong><p>${esc(o.contact.role)}</p><p>${o.contact.emailStatus==="Verified"?esc(o.contact.email):"No proven business email"}</p><small>Verification source: ${esc(o.contact.source||"Not recorded")}</small></div></div><div class="linkedin-shortlist"><div><strong>LinkedIn contact shortlist</strong><small>Open three role searches for this exact company and choose manually.</small></div>${linkedinTargets.map(target=>`<a class="btn small secondary" href="${esc(target.url)}" target="_blank" rel="noopener">${esc(target.role)} ↗</a>`).join("")}</div></section>
    <div class="drawer-actions"><button class="btn secondary" data-status-action="Monitor" data-id="${o.id}">Monitor</button><button class="btn secondary" data-message="${o.id}">Generate message</button><button class="btn primary" data-status-action="Approved" data-id="${o.id}" ${canApprove?'':'disabled title="Requires a verified, eligible business contact"'}>Approve outreach</button></div>`;
  document.getElementById("lead-drawer").classList.add("open");
  document.getElementById("drawer-backdrop").classList.add("open");
  document.getElementById("lead-drawer").setAttribute("aria-hidden","false");
}

function closeDrawer(){document.getElementById("lead-drawer").classList.remove("open");document.getElementById("drawer-backdrop").classList.remove("open");document.getElementById("lead-drawer").setAttribute("aria-hidden","true");}

function openEmailPreview(){
  const top=opportunities.filter(o=>o.score>=state.settings.minScore&&o.keep!==false).slice(0,state.settings.emailCount);
  document.getElementById("modal-content").innerHTML=`<p class="kicker">Morning brief preview</p><h2>${esc(activeMarket().name)} Opportunity Radar · ${top.length} leads</h2><p class="drawer-sub">Only leads meeting the score and evidence threshold appear.</p><div class="email-preview"><h4>Good morning, ${esc((state.businessProfile.owner||"Edgars").split(" ")[0])}</h4><p>Today’s strongest evidence-backed business opportunities:</p>${top.map((o,i)=>`<div class="email-lead"><strong>${i+1}. ${esc(o.company)} — ${o.score.toFixed(1)}/10</strong><p>${esc(o.signal)}</p><p><b>Likely need:</b> ${esc(o.primaryOffer)}</p><p><b>Contact:</b> ${esc(o.contact.name)}, ${esc(o.contact.role)} · ${o.contact.emailStatus==="Predicted"?"email not verified":esc(o.contact.email)}</p></div>`).join("")}</div><button class="btn primary" id="close-preview-action">Close preview</button>`;
  openModal();
}

function openMessage(id){
  const o=opportunities.find(item=>item.id===id);if(!o)return;
  const playbook=matchingPlaybook(o);
  const saved=state.outreachDrafts[o.id];
  const subject=saved?.subject||fillTemplate(playbook?.subject||`${o.signalType} at {{company}}`,o);
  const templateBody=fillTemplate(playbook?.body||`Hi {{first_name}},\n\nI noticed {{signal}}\n\nWould it be useful if I sent a short outline of how {{offer}} could support {{company}}?\n\nBest,\n${state.businessProfile.owner||"Edgars"}`,o);
  const body=applyBookingInvitation(saved?.body||templateBody,o,playbook);
  const message=`Subject: ${subject}\n\n${body}`;
  const decision=automationDecision(o,playbook);
  const language=resolvedOutreachLanguage(o,playbook);
  const bookingState=shouldIncludeBooking(o,playbook)?`${state.scheduling.eventName} link included`:`Booking link: ${playbook?.ctaMode||"Include in initial email"}`;
  document.getElementById("modal-content").innerHTML=`<p class="kicker">Predefined script · ${esc(playbook?.channel||"Email")}</p><h2>${esc(o.company)}</h2><p class="drawer-sub">${esc(playbook?.name||"Default playbook")} · ${esc(languageModeLabel())}: ${esc(language)} · ${esc(decision.route)}</p><div class="message-route"><strong>${esc(decision.mode)}</strong><span>${decision.reasons.length?esc(decision.reasons.join(" · ")):"All current safety checks pass"}</span></div><div class="message-route"><strong>Language route</strong><span>${esc(languageModeLabel())} · Manual script language: ${esc(playbook?.language||"English")} · Output: ${esc(language)}</span></div><div class="booking-state"><span>◷</span><div><strong>${esc(bookingState)}</strong><small>${esc(state.scheduling.duration)} minutes · ${esc(state.scheduling.platform)} · Calendly availability</small></div></div><textarea class="message-box" data-draft-id="${esc(o.id)}">${esc(message)}</textarea><div class="card-actions" style="margin-top:12px"><button class="btn secondary" id="copy-message">Copy draft</button><button class="btn primary" data-status-action="Draft ready" data-id="${o.id}">Save to outreach queue</button></div>`;
  openModal();
}

function openModal(){document.getElementById("modal-backdrop").classList.add("open");}
function saveOpenDraft(){
  const box=document.querySelector(".message-box[data-draft-id]");
  if(!box)return false;
  const [subjectLine,...bodyParts]=box.value.split(/\n\n/);
  state.outreachDrafts[box.dataset.draftId]={subject:subjectLine.replace(/^Subject:\s*/i,"").trim(),body:bodyParts.join("\n\n").trim(),updatedAt:formatNow()};
  saveState();
  return true;
}
function closeModal(){saveOpenDraft();document.getElementById("modal-backdrop").classList.remove("open");}

function switchView(name){
  if(name!=="map"&&mapFullscreenMode)setMapFullscreen(false,{refit:false});
  document.querySelectorAll(".view").forEach(v=>v.classList.toggle("active",v.id===`view-${name}`));
  document.querySelectorAll(".nav-item[data-view]").forEach(b=>b.classList.toggle("active",b.dataset.view===name));
  const today=new Intl.DateTimeFormat("en-GB",{weekday:"long",day:"numeric",month:"long",year:"numeric",timeZone:"Europe/Riga"}).format(new Date());
  const labels={map:["Research automation","System Map"],control:["Editable operating context","Control Centre"],today:[today,`Good morning · ${state.workspace.name}`],signals:["Evidence stream","Market signals"],companies:["Opportunity memory","Company dossiers"],crm:["Commercial pipeline","Practical CRM"],contacts:["Verified business data","Contact list"],outreach:["Controlled delivery","Outreach queue"],sources:["Monitoring network","Source health"],runs:["Automation audit","Daily runs"],settings:["Operating rules","Research settings"]};
  const [kicker,title]=labels[name]||labels.map;document.getElementById("view-kicker").textContent=kicker;document.getElementById("view-title").textContent=title;
  document.getElementById("sidebar").classList.remove("open");window.scrollTo(0,0);
}

document.addEventListener("keydown",event=>{
  if(event.key==="Escape"&&mapFullscreenMode){setMapFullscreen(false);return;}
  const sourceCard=event.target.closest?.("[data-source-open]");
  if(sourceCard&&["Enter"," "].includes(event.key)&&!event.target.closest("a,button,input,select,textarea")){
    event.preventDefault();openSourceDetails(sourceCard.dataset.sourceOpen);return;
  }
  const step=event.target.closest?.(".map-node");
  if(mapArrangeMode&&step&&["ArrowLeft","ArrowRight","ArrowUp","ArrowDown"].includes(event.key)){
    event.preventDefault();const id=step.dataset.nodeId;const current=state.map.draftLayout[id];const amount=event.shiftKey?50:10;
    const candidate={x:Math.max(72,Math.min(MAP_WORLD.width-72,current.x+(event.key==="ArrowLeft"?-amount:event.key==="ArrowRight"?amount:0))),y:Math.max(62,Math.min(MAP_WORLD.height-62,current.y+(event.key==="ArrowUp"?-amount:event.key==="ArrowDown"?amount:0)))};
    if(mapPositionAvailable(id,candidate.x,candidate.y)){state.map.draftLayout[id]=candidate;saveState();renderSystemMap();requestAnimationFrame(()=>document.querySelector(`[data-node-id="${id}"]`)?.focus());}
    return;
  }
  if(!step||!["Enter"," "].includes(event.key)||event.target.closest(".map-node-open,.map-node-inspect"))return;
  if(mapArrangeMode){event.preventDefault();return;}
  event.preventDefault();
  if(step.dataset.nodeId!==selectedMapNode&&document.getElementById("map-node-form")&&!saveMapDraft(false))return;
  selectedMapNode=step.dataset.nodeId;selectedMapInspectorTab="configuration";renderSystemMap();
});

function renderAll(){
  ensureCrmRecords();renderSystemMap();renderControlCentre();renderMetrics();renderOpportunities();renderSignals();renderCompanies();renderCRM();renderContacts();renderOutreach();renderSources();renderRuns();renderRuntimeStatus();
  document.getElementById("setting-email").value=state.settings.emailCount;
  document.getElementById("setting-app").value=state.settings.appCount;
  document.getElementById("setting-score").value=state.settings.minScore;
  document.getElementById("setting-language-mode").value=state.settings.languageMode;
  document.getElementById("setting-internal-language").value=state.settings.internalLanguage;
  document.getElementById("setting-fallback-language").value=state.settings.outreachFallbackLanguage;
  document.getElementById("setting-auto-outreach").checked=state.outreachAutomation.enabled;
  document.getElementById("setting-outreach-limit").value=state.outreachAutomation.dailyLimit;
  document.getElementById("setting-booking-url").value=state.scheduling.bookingUrl;
  document.getElementById("setting-booking-name").value=state.scheduling.eventName;
  document.getElementById("setting-booking-cta").value=state.scheduling.ctaCopy;
  renderBackendAccess();
}

document.addEventListener("click",async event=>{
  if(suppressMapClick&&event.target.closest(".map-canvas")){suppressMapClick=false;event.preventDefault();return;}
  if(event.target.id==="backend-login-btn"){await loginBackend();return;}
  if(event.target.id==="backend-logout-btn"){await logoutBackend();return;}
  const enrich=event.target.closest("[data-enrich]");if(enrich){await enrichOpportunity(enrich.dataset.enrich);return;}
  const enrichPersonal=event.target.closest("[data-enrich-personal]");if(enrichPersonal){await enrichOpportunity(enrichPersonal.dataset.enrichPersonal,{allowPersonal:true});return;}
  if(event.target.id==="profile-pdf-open"){
    try{
      const file=await getProfileDocument();
      if(!file)throw new Error("The PDF is no longer stored in this browser");
      const url=URL.createObjectURL(file);window.open(url,"_blank");setTimeout(()=>URL.revokeObjectURL(url),60000);
    }catch(error){showToast(error.message||"Could not open the PDF");}
    return;
  }
  if(event.target.id==="profile-pdf-remove"){
    try{await deleteProfileDocument();}catch(error){showToast("Could not remove the stored PDF");return;}
    state.businessProfile.document=null;document.getElementById("profile-pdf-input").value="";saveState();renderBusinessDocument();showToast("Business reference PDF removed");return;
  }
  const stepView=event.target.closest("[data-step-view]");if(stepView){if(document.getElementById("map-node-form")&&!saveMapDraft(false))return;switchView(stepView.dataset.stepView);return;}
  const inspectorTab=event.target.closest("[data-inspector-tab]");if(inspectorTab){if(selectedMapInspectorTab==="configuration"&&document.getElementById("map-node-form")&&!saveMapDraft(false))return;selectedMapInspectorTab=inspectorTab.dataset.inspectorTab;renderMapInspector();return;}
  const mapNode=event.target.closest("[data-map-node]");if(mapNode){
    if(mapNode.dataset.mapNode!==selectedMapNode&&document.getElementById("map-node-form")&&!saveMapDraft(false))return;
    selectedMapNode=mapNode.dataset.mapNode;selectedMapInspectorTab="configuration";
    if(mapInspectorCollapsed)setMapInspectorCollapsed(false,{refit:false});
    renderSystemMap();
    if(!mapInspectorCollapsed&&window.innerWidth<1280)document.getElementById("map-inspector").scrollIntoView({behavior:"smooth",block:"start"});
    return;
  }
  const arrangedNode=event.target.closest(".map-node");if(mapArrangeMode&&arrangedNode){selectedMapNode=arrangedNode.dataset.nodeId;renderSystemMap();return;}
  const view=event.target.closest("[data-view]");if(view){
    if(view.dataset.view!=="map"&&document.getElementById("view-map").classList.contains("active")&&document.getElementById("map-node-form")&&!saveMapDraft(false))return;
    switchView(view.dataset.view);return;
  }
  const testMap=event.target.closest("[data-test-map]");if(testMap){testMapStep(testMap.dataset.testMap);return;}
  const resetMap=event.target.closest("[data-reset-map]");if(resetMap){state.map.draftConfigs[resetMap.dataset.resetMap]=structuredClone(state.map.publishedConfigs[resetMap.dataset.resetMap]);saveState();renderAll();showToast("Step draft reset");return;}
  const open=event.target.closest("[data-open]");if(open){openDrawer(open.dataset.open);return;}
  const message=event.target.closest("[data-message]");if(message){openMessage(message.dataset.message);return;}
  const meetingBooked=event.target.closest("[data-meeting-booked]");if(meetingBooked){
    const record=state.crm.records[meetingBooked.dataset.meetingBooked];const opportunity=opportunities.find(item=>item.id===meetingBooked.dataset.meetingBooked);if(!record)return;
    record.stage="Meeting";record.nextAction="Prepare for the 30-minute Strategy Call";record.updatedAt=formatNow();addOutreachAudit(meetingBooked.dataset.meetingBooked,"Meeting booked",`${opportunity?.company||meetingBooked.dataset.meetingBooked} · ${state.scheduling.eventName} · ${state.scheduling.platform}`);saveState();
    try{await persistOpportunityWorkflow(meetingBooked.dataset.meetingBooked);renderAll();showToast("Meeting recorded in CRM");}catch(error){renderAll();showToast(`Meeting saved locally · ${error.message}`);}return;
  }
  const signalFilter=event.target.closest("[data-signal-filter]");if(signalFilter){currentSignalFilter=signalFilter.dataset.signalFilter;renderSignals();return;}
  if(event.target.id==="toggle-signal-rules"){
    state.ui.signalRulesExpanded=state.ui.signalRulesExpanded===false;
    saveState();renderSignals();showToast(state.ui.signalRulesExpanded?"Signal rules expanded":"Signal rules hidden");return;
  }
  const toggleSignalRule=event.target.closest("[data-toggle-signal-rule]");if(toggleSignalRule){
    const rule=state.signalRules.find(item=>item.id===toggleSignalRule.dataset.toggleSignalRule);if(!rule)return;
    rule.active=!rule.active;saveState();renderSignals();renderControlCentre();showToast(rule.active?"Signal rule resumed":"Signal rule paused");return;
  }
  const deleteSignalRule=event.target.closest("[data-delete-signal-rule]");if(deleteSignalRule){
    if(state.signalRules.length<=1){showToast("Keep at least one signal rule");return;}
    const rule=state.signalRules.find(item=>item.id===deleteSignalRule.dataset.deleteSignalRule);if(!rule)return;
    if(!window.confirm(`Delete signal rule “${rule.name}”?`))return;
    state.signalRules=state.signalRules.filter(item=>item.id!==rule.id);state.playbooks=state.playbooks.filter(item=>item.signalId!==rule.id);saveState();renderSignals();renderControlCentre();showToast("Signal rule deleted");return;
  }
  const contactFilter=event.target.closest("[data-contact-filter]");if(contactFilter){currentContactFilter=contactFilter.dataset.contactFilter;renderContacts();return;}
  const marketProfile=event.target.closest("[data-market-profile]");if(marketProfile){
    readControlCentre();state.activeMarketProfileId=marketProfile.dataset.marketProfile;state.workspace.market=activeMarket().name;saveState();renderAll();showToast(`Research market changed to ${activeMarket().name}`);return;
  }
  const marketCountry=event.target.closest("[data-market-country]");if(marketCountry){marketCountry.classList.toggle("selected");syncMarketChoiceFields();return;}
  const marketLanguage=event.target.closest("[data-market-language]");if(marketLanguage){marketLanguage.classList.toggle("selected");syncMarketChoiceFields();return;}
  if(event.target.id==="generate-source-pack"||event.target.id==="generate-source-pack-panel"){generateSourcePackDraft();return;}
  if(event.target.id==="apply-source-pack-draft"){applySourcePackDraft();return;}
  if(event.target.id==="discard-source-pack-draft"){discardSourcePackDraft();return;}
  if(event.target.id==="add-custom-source"){openSourceEditor();return;}
  if(event.target.id==="test-all-sources"){
    const pack=sourcePackForMarket(activeMarket()).filter(item=>sourceEnabled(activeMarket(),item.id));
    const invalid=pack.filter(item=>item.custom&&(!safeUrl(item.url)||new URL(safeUrl(item.url)).protocol!=="https:"));
    showToast(invalid.length?`${invalid.length} custom source URL${invalid.length===1?"":"s"} need attention`:`${pack.length} enabled services configured · collector results verify live health`);return;
  }
  if(event.target.closest("[data-company-source-info]")){openCompanyWebsitePolicy();return;}
  if(event.target.closest("[data-company-source-test]")||event.target.id==="company-source-test-modal"){testCompanyWebsiteSource();return;}
  const sourceEdit=event.target.closest("[data-source-edit]");if(sourceEdit){openSourceEditor(sourceEdit.dataset.sourceEdit);return;}
  const sourceTest=event.target.closest("[data-source-test]");if(sourceTest){testSource(sourceTest.dataset.sourceTest);return;}
  const sourceDelete=event.target.closest("[data-source-delete]");if(sourceDelete){
    const source=state.customSources.find(item=>item.id===sourceDelete.dataset.sourceDelete);if(!source)return;
    if(!window.confirm(`Delete custom source “${source.name}”?`))return;
    state.customSources=state.customSources.filter(item=>item.id!==source.id);state.marketProfiles.forEach(market=>{if(Array.isArray(market.enabledSourceIds))market.enabledSourceIds=market.enabledSourceIds.filter(id=>id!==source.id);});saveState();renderSources();renderControlCentre();showToast("Custom source deleted");return;
  }
  if(event.target.id==="save-custom-source"){saveCustomSource(event.target.dataset.sourceId||"");return;}
  const sourceToggle=event.target.closest("[data-source-toggle]");if(sourceToggle){
    const market=activeMarket();const pack=sourcePackForMarket(market);
    if(!Array.isArray(market.enabledSourceIds))market.enabledSourceIds=pack.map(item=>item.id);
    market.enabledSourceIds=market.enabledSourceIds.includes(sourceToggle.dataset.sourceToggle)?market.enabledSourceIds.filter(id=>id!==sourceToggle.dataset.sourceToggle):[...market.enabledSourceIds,sourceToggle.dataset.sourceToggle];
    saveState();renderSources();renderControlCentre();showToast("Source pack updated");return;
  }
  const sourceOpen=event.target.closest("[data-source-open]");if(sourceOpen&&!event.target.closest("a,button,input,select,textarea")){
    openSourceDetails(sourceOpen.dataset.sourceOpen);return;
  }
  const removeMarket=event.target.closest("[data-remove-market]");if(removeMarket){
    const reset=structuredClone(MARKET_PROFILES.find(item=>item.id==="custom"));
    state.marketProfiles=state.marketProfiles.map(item=>item.id===removeMarket.dataset.removeMarket?reset:item);state.activeMarketProfileId="custom";state.workspace.market=reset.name;saveState();renderAll();showToast("Custom market reset");return;
  }
  const removeOffer=event.target.closest("[data-remove-offer]");if(removeOffer){
    readControlCentre();if(state.offers.length<=1){showToast("Keep at least one offer");return;}state.offers=state.offers.filter(item=>item.id!==removeOffer.dataset.removeOffer);state.playbooks=state.playbooks.filter(item=>item.offerId!==removeOffer.dataset.removeOffer);saveState();renderControlCentre();showToast("Offer removed");return;
  }
  const removeSignal=event.target.closest("[data-remove-signal]");if(removeSignal){
    readControlCentre();if(state.signalRules.length<=1){showToast("Keep at least one signal rule");return;}state.signalRules=state.signalRules.filter(item=>item.id!==removeSignal.dataset.removeSignal);state.playbooks=state.playbooks.filter(item=>item.signalId!==removeSignal.dataset.removeSignal);saveState();renderControlCentre();showToast("Signal rule removed");return;
  }
  const removePlaybook=event.target.closest("[data-remove-playbook]");if(removePlaybook){
    readControlCentre();state.playbooks=state.playbooks.filter(item=>item.id!==removePlaybook.dataset.removePlaybook);saveState();renderControlCentre();showToast("Playbook removed");return;
  }
  const action=event.target.closest("[data-status-action]");if(action){
    const opportunity=opportunities.find(item=>item.id===action.dataset.id);
    if(action.dataset.statusAction==="Approved"&&opportunity){
      const listState=state.listStates[opportunity.id];
      const verifiedAutomatic=isVerifiedWorkEmail(opportunity)&&listState==="Eligible";
      const reviewedPersonal=isPersonalEmail(opportunity.contact)&&opportunity.contact.emailStatus==="Strong match"&&listState==="Manual review";
      if(!verifiedAutomatic&&!reviewedPersonal){
        showToast("Approval requires an eligible verified work email or an owner-reviewed strong-match personal email");return;
      }
      if(["Suppressed","Unsubscribed"].includes(listState)){showToast("Suppressed contacts cannot be approved");return;}
    }
    saveOpenDraft();
    state.statuses[action.dataset.id]=action.dataset.statusAction;
    addOutreachAudit(action.dataset.id,action.dataset.statusAction,`${opportunity?.company||action.dataset.id} · ${matchingPlaybook(opportunity)?.name||"No playbook"}`);
    const record=state.crm.records[action.dataset.id];
    if(record){
      if(action.dataset.statusAction==="Approved")record.stage="Ready for Outreach";
      if(action.dataset.statusAction==="Draft ready"&&["Discovered","Qualified"].includes(record.stage))record.stage=opportunity?.contact.emailStatus==="Verified"?"Contact Found":"Qualified";
      record.updatedAt=formatNow();
    }
    saveState();
    try{await persistOpportunityWorkflow(action.dataset.id);renderAll();closeModal();showToast(`Status changed to ${action.dataset.statusAction}`);}catch(error){showToast(error.message);}
    return;
  }
  if(event.target.id==="drawer-close"||event.target.id==="drawer-backdrop")closeDrawer();
  if(event.target.id==="modal-close"||event.target.id==="modal-backdrop"||event.target.id==="close-preview-action")closeModal();
  if(event.target.id==="email-preview-btn")openEmailPreview();
  if(event.target.id==="menu-btn")document.getElementById("sidebar").classList.toggle("open");
  if(event.target.id==="sync-btn")syncData();
  if(event.target.id==="run-btn")triggerResearch();
  if(event.target.id==="test-data-btn")syncData();
  if(event.target.id==="test-run-btn")triggerResearch({test:true});
  if(event.target.id==="import-data-btn")document.getElementById("data-import").click();
  if(event.target.id==="export-data-btn")exportJson(`leadintel-${state.workspace.id}-${new Date().toISOString().slice(0,10)}.json`,state.runtimeData||{workspace:state.workspace,opportunities,signals,sources,runs});
  if(event.target.id==="export-outreach-btn")exportJson(`leadintel-outreach-${new Date().toISOString().slice(0,10)}.json`,opportunities.filter(o=>state.statuses[o.id]==="Approved").map(o=>({opportunity_id:o.id,company:o.company,contact:o.contact,status:state.statuses[o.id],offer:o.primaryOffer,signal:o.signal})));
  if(event.target.id==="reset-demo-btn"){opportunities=structuredClone(demoOpportunities);signals=structuredClone(demoSignals);sources=structuredClone(demoSources);runs=structuredClone(demoRuns);quality={recent_rejections:[]};state.runtimeData=null;state.runtime={...structuredClone(defaultState.runtime)};state.statuses=Object.fromEntries(opportunities.map(o=>[o.id,o.status]));state.listStates=Object.fromEntries(opportunities.map(o=>[o.id,o.contact.listState]));saveState();renderAll();showToast("Demo data restored");}
  if(event.target.id==="save-map-draft")saveMapDraft();
  if(event.target.id==="publish-map")publishWorkflow();
  if(event.target.id==="discard-map-drafts"){state.map.draftConfigs=structuredClone(state.map.publishedConfigs);state.map.draftLayout=structuredClone(state.map.publishedLayout);saveState();renderAll();showToast("All workflow drafts discarded");}
  if(event.target.id==="map-arrange"){setArrangeMode(!mapArrangeMode);requestAnimationFrame(()=>fitMapViewport());showToast(mapArrangeMode?"Arrange mode on — drag cards or empty space":"Layout draft saved in this browser");return;}
  if(event.target.id==="map-toggle-inspector"||event.target.id==="map-inspector-close"||event.target.id==="map-reopen-inspector"){setMapInspectorCollapsed(event.target.id==="map-reopen-inspector"?false:!mapInspectorCollapsed);showToast(mapInspectorCollapsed?"Details hidden — full canvas width available":"Step details restored");return;}
  if(event.target.id==="map-inspector-focus"){setMapInspectorFocused(!mapInspectorFocused);showToast(mapInspectorFocused?"Details focused — canvas hidden for a wider editing view":"Canvas restored — select any workflow step to inspect it");return;}
  if(event.target.id==="map-fullscreen"){setMapFullscreen(!mapFullscreenMode);showToast(mapFullscreenMode?"Full canvas view — press Esc to exit":"Normal canvas view restored");return;}
  if(event.target.id==="map-auto-layout"){state.map.draftLayout=structuredClone(defaultWorkflowLayout);saveState();renderSystemMap();fitMapViewport();showToast("Workflow automatically arranged — publish to save this version");return;}
  if(event.target.id==="map-reset-layout"){state.map.draftLayout=structuredClone(state.map.publishedLayout);saveState();renderSystemMap();fitMapViewport();showToast("Layout reset to the published version");return;}
  if(event.target.id==="map-zoom-in"){setMapZoom(state.map.viewport.zoom+.1);return;}
  if(event.target.id==="map-zoom-out"){setMapZoom(state.map.viewport.zoom-.1);return;}
  if(event.target.id==="map-zoom-fit"){fitMapViewport();return;}
  if(event.target.id==="control-expand-all"||event.target.id==="control-collapse-all"){
    const open=event.target.id==="control-expand-all";
    document.querySelectorAll("[data-control-section]").forEach(section=>{section.open=open;state.ui.controlSections[section.dataset.controlSection]=open;});
    saveState();showToast(open?"All control sections expanded":"All control sections collapsed");
  }
  if(event.target.id==="crm-clear-filters"){crmSearch="";crmStageFilter="All";renderCRM();return;}
  if(event.target.id==="add-market-country"){
    const name=document.getElementById("market-custom-country").value.trim();const code=document.getElementById("market-custom-code").value.trim().toUpperCase();
    if(!name||code.length!==2){showToast("Enter a country and its two-letter code");return;}
    readControlCentre();const market=activeMarket();if(!market.countries.includes(name)){market.countries.push(name);market.countryCodes.push(code);}saveState();renderAll();showToast(`${name} added to the research region`);return;
  }
  if(event.target.id==="add-market-language"){
    const language=document.getElementById("market-custom-language").value.trim();if(!language){showToast("Enter a language");return;}
    readControlCentre();const market=activeMarket();if(!market.languages.includes(language))market.languages.push(language);saveState();renderAll();showToast(`${language} added`);return;
  }
  if(event.target.id==="save-control"){
    readControlCentre();
    if(!activeMarket().countries.length||!activeMarket().languages.length){showToast("Select at least one country and one language");return;}
    ensureCrmRecords();saveState();renderAll();showToast("Control centre saved");
  }
  if(event.target.id==="add-market-profile"){
    readControlCentre();const id=makeId("market");state.marketProfiles.push({id,name:"New market",countries:[],countryCodes:[],languages:["English"],decisionTitles:["Sales Director","Commercial Director","Head of Sales","CEO"],sourceFocus:"Approved public business, procurement, recruitment and company sources"});state.activeMarketProfileId=id;state.workspace.market="New market";saveState();renderAll();showToast("New market profile added");
  }
  if(event.target.id==="add-offer"){
    readControlCentre();state.offers.push({id:makeId("offer"),name:"New offer",description:"Describe the business problem this offer solves.",active:true});saveState();renderControlCentre();showToast("Offer added");
  }
  if(event.target.id==="add-signal"){
    readControlCentre();state.signalRules.push({id:makeId("signal"),name:"New signal",keywords:"keyword, phrase",weight:5,active:true});saveState();renderControlCentre();showToast("Signal rule added");
  }
  if(event.target.id==="add-signal-rule-quick"){
    state.signalRules.push({id:makeId("signal"),name:"New signal",keywords:"keyword, phrase",weight:5,active:true});saveState();renderSignals();renderControlCentre();showToast("Signal rule added");
  }
  if(event.target.id==="add-playbook"){
    readControlCentre();state.playbooks.push({id:makeId("playbook"),name:"New outreach playbook",offerId:state.offers[0]?.id||"",signalId:state.signalRules[0]?.id||"",role:"Decision maker",channel:"Email",language:activeMarket().languages?.[0]||"English",sendMode:"Approval required",ctaMode:"Include in initial email",minScore:8,dailyLimit:3,requireHighConfidence:true,autoApproved:false,subject:"A practical idea for {{company}}",body:`Hi {{first_name}},\n\nI noticed {{signal}}\n\nWould a short outline of how {{offer}} could support {{company}} be useful?\n\nBest,\n${state.businessProfile.owner||"Edgars"}`,active:true});saveState();renderControlCentre();showToast("Playbook added");
  }
  if(event.target.id==="copy-message")navigator.clipboard.writeText(document.querySelector(".message-box").value).then(()=>showToast("Draft copied"));
  if(event.target.id==="save-settings"){
    const workspaceId=document.getElementById("setting-workspace-id").value.trim().toLowerCase().replace(/[^a-z0-9-]+/g,"-").replace(/^-|-$/g,"");
    const dataUrl=document.getElementById("setting-data-url").value.trim();
    const runUrl=document.getElementById("setting-run-url").value.trim();
    const selectedMarketId=document.getElementById("setting-market").value;
    if(!workspaceId){showToast("Workspace ID is required");return;}
    if(!state.marketProfiles.some(item=>item.id===selectedMarketId)){showToast("Choose a valid market");return;}
    if(!isPrivateEndpoint(dataUrl)||!isPrivateEndpoint(runUrl)){showToast("Runtime endpoints must use HTTPS");return;}
    const bookingUrl=document.getElementById("setting-booking-url").value.trim();
    try{const parsedBooking=new URL(bookingUrl);if(parsedBooking.protocol!=="https:"||!(parsedBooking.hostname==="calendly.com"||parsedBooking.hostname.endsWith(".calendly.com")))throw new Error();}catch{showToast("Enter a valid HTTPS Calendly booking URL");return;}
    state.activeMarketProfileId=selectedMarketId;
    state.workspace={id:workspaceId,name:document.getElementById("setting-workspace-name").value.trim()||workspaceId,market:activeMarket().name};
    state.integrations={dataUrl,runUrl};
    state.map.draftConfigs.email.value=Math.max(1,Math.min(5,Number(document.getElementById("setting-email").value)||3));
    state.map.draftConfigs.shortlist.value=Math.max(3,Math.min(10,Number(document.getElementById("setting-app").value)||5));
    state.map.draftConfigs.score.value=Math.max(1,Math.min(10,Number(document.getElementById("setting-score").value)||7));
    state.settings={
      ...state.settings,
      emailCount:state.map.draftConfigs.email.value,
      appCount:state.map.draftConfigs.shortlist.value,
      minScore:state.map.draftConfigs.score.value,
      languageMode:document.getElementById("setting-language-mode").value,
      internalLanguage:document.getElementById("setting-internal-language").value,
      outreachFallbackLanguage:document.getElementById("setting-fallback-language").value
    };
    state.outreachAutomation.enabled=document.getElementById("setting-auto-outreach").checked;
    state.outreachAutomation.dailyLimit=Math.max(3,Math.min(5,Number(document.getElementById("setting-outreach-limit").value)||5));
    state.scheduling={...state.scheduling,bookingUrl,eventName:document.getElementById("setting-booking-name").value.trim()||"Strategy Call",ctaCopy:document.getElementById("setting-booking-cta").value.trim()||defaultState.scheduling.ctaCopy,duration:30,platform:"Zoom"};
    saveState();renderAll();showToast("Workspace and workflow draft saved");
  }
});

document.addEventListener("change",async event=>{
  if(event.target.id==="setting-market"){
    const market=state.marketProfiles.find(item=>item.id===event.target.value);
    const summary=document.getElementById("setting-market-summary");
    if(summary&&market)summary.textContent=`Selected pack: ${marketSummary(market)}. Click Save settings to apply it to the next research run.`;
    return;
  }
  const quickSignalCard=event.target.closest("[data-signal-rule]");
  if(quickSignalCard){
    const rule=state.signalRules.find(item=>item.id===quickSignalCard.dataset.signalRule);if(!rule)return;
    rule.name=quickSignalCard.querySelector("[data-signal-rule-name]").value.trim()||"Untitled signal";
    rule.keywords=quickSignalCard.querySelector("[data-signal-rule-keywords]").value.trim();
    rule.weight=Math.max(1,Math.min(10,Number(quickSignalCard.querySelector("[data-signal-rule-weight]").value)||5));
    saveState();renderSignals();renderControlCentre();showToast("Signal rule updated");return;
  }
  if(event.target.id==="profile-pdf-input"){
    const file=event.target.files?.[0];
    if(!file)return;
    if(file.type!=="application/pdf"&&!file.name.toLowerCase().endsWith(".pdf")){event.target.value="";showToast("Please choose a PDF file");return;}
    if(file.size>MAX_PROFILE_PDF_BYTES){event.target.value="";showToast("The PDF must be 15 MB or smaller");return;}
    try{
      await putProfileDocument(file);
      state.businessProfile.document={name:file.name,size:file.size,type:"application/pdf",lastModified:file.lastModified,uploadedAt:new Date().toISOString(),storage:"browser"};
      saveState();renderBusinessDocument();showToast("Business reference PDF saved in this browser");
    }catch(error){event.target.value="";showToast("This browser could not store the PDF");}
    return;
  }
  if(event.target.id==="crm-stage-filter"){crmStageFilter=event.target.value;renderCRM();return;}
  const crmStage=event.target.closest("[data-crm-stage]");if(crmStage){
    const record=state.crm.records[crmStage.dataset.crmStage];if(!record)return;
    record.stage=crmStage.value;record.updatedAt=formatNow();saveState();
    try{await persistOpportunityWorkflow(crmStage.dataset.crmStage);renderCRM();renderOutreach();showToast(`CRM stage changed to ${crmStage.value}`);}catch(error){showToast(error.message);}
    return;
  }
  const nextAction=event.target.closest("[data-crm-next-action]");if(nextAction){
    const record=state.crm.records[nextAction.dataset.crmNextAction];if(!record)return;
    record.nextAction=nextAction.value.trim();record.updatedAt=formatNow();saveState();
    try{await persistOpportunityWorkflow(nextAction.dataset.crmNextAction);showToast("Next action saved");}catch(error){showToast(error.message);}
    return;
  }
  const notes=event.target.closest("[data-crm-notes]");if(notes){
    const record=state.crm.records[notes.dataset.crmNotes];if(!record)return;
    record.notes=notes.value.trim();record.updatedAt=formatNow();saveState();
    try{await persistOpportunityWorkflow(notes.dataset.crmNotes);showToast("CRM notes saved");}catch(error){showToast(error.message);}
    return;
  }
  const select=event.target.closest("[data-list-state]");if(!select)return;
  const id=select.dataset.listState;
  const opp=opportunities.find(o=>o.id===id);
  const previousState=state.listStates[id]||"Research";
  if(select.value==="Eligible"&&!isVerifiedWorkEmail(opp)){
    select.value=state.listStates[id]||"Research";
    showToast("Only verified work emails can be marked eligible; personal emails require review");return;
  }
  if(select.value==="Manual review"&&!(isPersonalEmail(opp.contact)&&opp.contact.emailStatus==="Strong match")){
    select.value=previousState;showToast("Manual review is reserved for owner-approved strong-match personal emails");return;
  }
  if(select.value==="Eligible"&&["Suppressed","Unsubscribed"].includes(previousState)){
    select.value=previousState;
    showToast("Suppressed contacts require a separate compliance review");return;
  }
  state.listStates[id]=select.value;saveState();renderMetrics();showToast(`Contact moved to ${select.value}`);
});

document.addEventListener("toggle",event=>{
  const section=event.target.closest?.("[data-control-section]");
  if(!section)return;
  state.ui.controlSections[section.dataset.controlSection]=section.open;
  saveState();
},true);

document.addEventListener("pointerdown",event=>{
  if(event.button!==0)return;
  const canvas=event.target.closest?.("#map-canvas");if(!canvas)return;
  const node=event.target.closest(".map-node");if(node&&event.target.closest(".map-node-inspect"))return;
  if(node&&!mapArrangeMode)return;
  event.preventDefault();try{canvas.setPointerCapture?.(event.pointerId);}catch{}
  mapPointerSession={pointerId:event.pointerId,type:node&&mapArrangeMode?"node":"pan",nodeId:node?.dataset.nodeId||"",startX:event.clientX,startY:event.clientY,moved:false,origin:node?{...state.map.draftLayout[node.dataset.nodeId]}:{x:state.map.viewport.panX,y:state.map.viewport.panY}};
  node?.classList.add("dragging");canvas.classList.toggle("panning",!node);
});

document.addEventListener("pointermove",event=>{
  const session=mapPointerSession;if(!session||session.pointerId!==event.pointerId)return;
  const dx=event.clientX-session.startX,dy=event.clientY-session.startY;if(Math.hypot(dx,dy)>3)session.moved=true;
  if(session.type==="pan"){state.map.viewport.panX=session.origin.x+dx;state.map.viewport.panY=session.origin.y+dy;applyMapViewport();return;}
  const zoom=state.map.viewport.zoom;const snap=value=>Math.round(value/10)*10;
  const x=Math.max(72,Math.min(MAP_WORLD.width-72,snap(session.origin.x+dx/zoom)));
  const y=Math.max(62,Math.min(MAP_WORLD.height-62,snap(session.origin.y+dy/zoom)));
  if(!mapPositionAvailable(session.nodeId,x,y))return;
  state.map.draftLayout[session.nodeId]={x,y};
  const node=document.querySelector(`.map-node[data-node-id="${session.nodeId}"]`);if(node){node.style.setProperty("--x",`${x}px`);node.style.setProperty("--y",`${y}px`);}renderMapEdges();
});

document.addEventListener("pointerup",event=>{
  const session=mapPointerSession;if(!session||session.pointerId!==event.pointerId)return;
  document.querySelector(".map-node.dragging")?.classList.remove("dragging");document.getElementById("map-canvas")?.classList.remove("panning");
  suppressMapClick=session.moved;if(session.moved){saveState();if(session.type==="node")renderSystemMap();else applyMapViewport();}
  mapPointerSession=null;
});

document.getElementById("map-canvas")?.addEventListener("wheel",event=>{
  event.preventDefault();
  if(event.ctrlKey||event.metaKey){const bounds=event.currentTarget.getBoundingClientRect();setMapZoom(state.map.viewport.zoom+(event.deltaY<0?.08:-.08),event.clientX-bounds.left,event.clientY-bounds.top);return;}
  const horizontal=event.shiftKey&&Math.abs(event.deltaX)<1?event.deltaY:event.deltaX;
  panMapViewport(-horizontal,-(event.shiftKey&&Math.abs(event.deltaX)<1?0:event.deltaY));
},{passive:false});

document.getElementById("company-search").addEventListener("input",event=>renderCompanies(event.target.value));
document.getElementById("crm-search").addEventListener("input",event=>{crmSearch=event.target.value;renderCRM();});
document.getElementById("data-import").addEventListener("change",async event=>{
  const [file]=event.target.files;if(!file)return;
  try{applyRuntimePayload(JSON.parse(await file.text()),{mode:"imported"});showToast(`Imported ${opportunities.length} opportunities`);}catch(error){showToast(`Import failed: ${error.message}`);}finally{event.target.value="";}
});
document.addEventListener("keydown",event=>{if(event.key==="Escape"){closeDrawer();closeModal();}});

restoreRuntimeData();
renderAll();
refreshBackendSession();
