"use strict";

const STORAGE_KEY = "leadintel_v2_state";
const STATE_SCHEMA_VERSION = 3;

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

const workflowNodes = [
  {id:"sources",type:"Input",icon:"⌘",x:8.5,y:30,status:"Healthy",metric:"25 sources",lastRun:"06:00",controlLabel:"Source limit",unit:"monitored sources",config:{title:"Market sources",enabled:true,cadence:"Daily · 06:00",value:25,description:"Latvian business, procurement, recruitment and company sources.",instructions:"Monitor only approved public sources. Preserve the source URL, publication date and exact evidence for every finding."}},
  {id:"scan",type:"Collection",icon:"↻",x:25,y:30,status:"Healthy",metric:"142 findings",lastRun:"06:31",controlLabel:"Page limit",unit:"pages per source",config:{title:"Scan & collect",enabled:true,cadence:"Daily · 06:00",value:30,description:"Collect new pages, vacancies, announcements and market activity.",instructions:"Fetch only new or materially changed content. Remove duplicates and tag each finding by source, company and signal date."}},
  {id:"analysis",type:"AI reasoning",icon:"✦",x:41.5,y:30,status:"Healthy",metric:"24 signals",lastRun:"06:39",controlLabel:"Evidence minimum",unit:"independent sources",config:{title:"AI signal analysis",enabled:true,cadence:"After collection",value:1,description:"Turn raw findings into evidence-backed commercial signals.",instructions:"Separate verified facts from inference. Detect hiring, funding, expansion, leadership, CRM, AI, training and sales-process signals."}},
  {id:"score",type:"Decision",icon:"◆",x:58,y:30,status:"Review",metric:"9 qualified",lastRun:"06:44",controlLabel:"Minimum score",unit:"points out of 10",config:{title:"Opportunity scoring",enabled:true,cadence:"After analysis",value:7,description:"Rank each company against Edgars' offers and active buying signals.",instructions:"Score ICP fit, signal strength, urgency, recency, offer relevance, likely budget and decision-maker accessibility. Explain every score."}},
  {id:"shortlist",type:"Output",icon:"★",x:74.5,y:30,status:"Healthy",metric:"5 saved",lastRun:"06:47",controlLabel:"Daily shortlist",unit:"companies saved",config:{title:"Save top 5",enabled:true,cadence:"Daily",value:5,description:"Save the strongest opportunities and their complete dossiers in the app.",instructions:"Keep the five highest-scoring companies that pass the evidence rule. Prefer opportunities with a verified business contact."}},
  {id:"contacts",type:"Enrichment",icon:"◎",x:91,y:30,status:"Review",metric:"3 verified",lastRun:"06:49",controlLabel:"Contacts per lead",unit:"primary decision-makers",config:{title:"Contact enrichment",enabled:true,cadence:"Qualified only",value:1,description:"Find the most relevant decision-maker and verify business contact data.",instructions:"Use Apollo and public company evidence. Keep predicted emails hidden and research-only until independently verified."}},
  {id:"email",type:"Delivery",icon:"✉",x:82,y:72,status:"Healthy",metric:"3 emailed",lastRun:"06:52",controlLabel:"Morning brief",unit:"opportunities emailed",config:{title:"Email top 3",enabled:true,cadence:"Daily · 07:00",value:3,description:"Send Edgars a concise internal brief with the three strongest opportunities.",instructions:"Include one primary decision-maker per company, the opportunity score, why now, pain points, evidence and verified contact data when available."}},
  {id:"outreach",type:"Approval",icon:"✓",x:94,y:72,status:"Planned",metric:"Human gate",lastRun:"Not connected",controlLabel:"Approval gate",unit:"required approval",config:{title:"Outreach approval",enabled:true,cadence:"On demand",value:1,description:"Generate a tailored message and require human approval before any send.",instructions:"Never send automatically during the pilot. Check eligibility, suppression and unsubscribe state immediately before approval."}}
];

const workflowEdges = [
  {from:"sources",to:"scan",d:"M 156 156 L 179 156"},
  {from:"scan",to:"analysis",d:"M 321 156 L 344 156"},
  {from:"analysis",to:"score",d:"M 486 156 L 509 156"},
  {from:"score",to:"shortlist",d:"M 651 156 L 674 156"},
  {from:"shortlist",to:"contacts",d:"M 816 156 L 839 156"},
  {from:"contacts",to:"email",d:"M 910 212 C 910 260, 820 267, 820 318",branch:true},
  {from:"contacts",to:"outreach",d:"M 910 212 C 910 260, 940 267, 940 318",branch:true}
];

const defaultWorkflowConfigs = Object.fromEntries(workflowNodes.map(node=>[node.id,structuredClone(node.config)]));

const defaultState = {
  schemaVersion:STATE_SCHEMA_VERSION,
  statuses:Object.fromEntries(demoOpportunities.map(o=>[o.id,o.status])),
  listStates:Object.fromEntries(demoOpportunities.map(o=>[o.id,o.contact.listState])),
  settings:{emailCount:3,appCount:5,minScore:7},
  workspace:{id:"edgars-latvia",name:"Edgars · Latvia",market:"Latvia"},
  integrations:{dataUrl:"",runUrl:""},
  runtime:{mode:"demo",lastSync:"",lastRunRequest:"",error:""},
  runtimeData:null,
  map:{publishedConfigs:structuredClone(defaultWorkflowConfigs),draftConfigs:structuredClone(defaultWorkflowConfigs),version:1,lastPublished:"15 Jul 2026 · system baseline",history:[{version:1,date:"15 Jul 2026 · system baseline",changes:0}],tests:{}}
};

let state = loadState();
let currentSignalFilter = "All";
let currentContactFilter = "All";
let selectedMapNode = "sources";

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
function loadState(){
  try{
    const parsed=JSON.parse(localStorage.getItem(STORAGE_KEY)||"{}");
    const saved=isRecord(parsed)?parsed:{};
    const savedMap=isRecord(saved.map)?saved.map:{};
    const settings=isRecord(saved.settings)?saved.settings:{};
    const workspace=isRecord(saved.workspace)?saved.workspace:{};
    const integrations=isRecord(saved.integrations)?saved.integrations:{};
    const runtime=isRecord(saved.runtime)?saved.runtime:{};
    const mapHistory=Array.isArray(savedMap.history)?savedMap.history.filter(isRecord):defaultState.map.history;
    const emailCount=Number(settings.emailCount);
    const appCount=Number(settings.appCount);
    const minScore=Number(settings.minScore);
    return {
      ...structuredClone(defaultState),
      schemaVersion:STATE_SCHEMA_VERSION,
      statuses:{...defaultState.statuses,...(isRecord(saved.statuses)?saved.statuses:{})},
      listStates:{...defaultState.listStates,...(isRecord(saved.listStates)?saved.listStates:{})},
      settings:{
        emailCount:Number.isInteger(emailCount)&&emailCount>=1&&emailCount<=5?emailCount:defaultState.settings.emailCount,
        appCount:Number.isInteger(appCount)&&appCount>=3&&appCount<=10?appCount:defaultState.settings.appCount,
        minScore:Number.isFinite(minScore)&&minScore>=1&&minScore<=10?minScore:defaultState.settings.minScore
      },
      workspace:{
        id:typeof workspace.id==="string"&&workspace.id.trim()?workspace.id.trim():defaultState.workspace.id,
        name:typeof workspace.name==="string"&&workspace.name.trim()?workspace.name.trim():defaultState.workspace.name,
        market:typeof workspace.market==="string"&&workspace.market.trim()?workspace.market.trim():defaultState.workspace.market
      },
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
        history:mapHistory,
        tests:isRecord(savedMap.tests)?savedMap.tests:{}}
    };
  }
  catch{return structuredClone(defaultState);}
}
function saveState(){localStorage.setItem(STORAGE_KEY,JSON.stringify(state));}
function esc(value){return String(value??"").replace(/[&<>'"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;","'":"&#39;",'"':"&quot;"}[c]));}
function initials(name){return name.split(/\s+/).map(p=>p[0]).slice(0,2).join("").toUpperCase();}
function showToast(message){const el=document.getElementById("toast");el.textContent=message;el.classList.add("show");setTimeout(()=>el.classList.remove("show"),2200);}
function statusClass(value){return /verified|eligible|healthy|complete|qualified|connected/i.test(value)?"good":/predicted|review|partial|monitor|triaged|planned/i.test(value)?"warn":"bad";}
function firstValue(row,keys,fallback=""){for(const key of keys){if(row?.[key]!==undefined&&row[key]!==null&&String(row[key]).trim()!=="")return row[key];}return fallback;}
function numberValue(value,fallback=0){const parsed=Number(value);return Number.isFinite(parsed)?parsed:fallback;}
function listValue(value){if(Array.isArray(value))return value.filter(Boolean).map(String);if(typeof value!=="string"||!value.trim())return [];try{const parsed=JSON.parse(value);if(Array.isArray(parsed))return parsed.map(String);}catch{}return value.split(/\n|\s*;\s*/).filter(Boolean);}
function safeUrl(value){try{const url=new URL(String(value));return ["https:","http:"].includes(url.protocol)?url.href:"";}catch{return "";}}
function isPrivateEndpoint(value){if(!value)return true;try{const url=new URL(value);return url.protocol==="https:"||["localhost","127.0.0.1"].includes(url.hostname);}catch{return false;}}
function formatNow(){return new Intl.DateTimeFormat("en-GB",{dateStyle:"medium",timeStyle:"short",timeZone:"Europe/Riga"}).format(new Date());}

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
  return {
    id,company,website:safeUrl(firstValue(row,["website","Website"],sourceUrl)),industry:String(firstValue(row,["industry","Industry"],"Business")),location:String(firstValue(row,["location","Location"],state.workspace.market)),
    score:score10,confidence:String(firstValue(row,["confidence","Confidence"],"Medium")),emailed:Boolean(firstValue(row,["emailed"],false)),status:String(firstValue(row,["status","Status"],score10>=state.settings.minScore?"New":"Monitor")),
    primaryOffer:String(firstValue(row,["primary_offer","recommended_offer","Recommended Offer","Primary Solution","Lead Solution"],"Digital Sales Book")),
    signal:String(firstValue(row,["signal","signal_summary","Signal Summary","Evidence Summary"],"Public market signal captured")),
    signalType:String(firstValue(row,["signal_type","Signal Type","Signal"],"Market signal")),signalDate:String(firstValue(row,["signal_date","Signal Date","captured_at","Captured At","Date Found"],new Date().toISOString().slice(0,10))),
    whyNow:String(firstValue(row,["why_now","commercial_reason","Commercial Reason","Suggested Commercial Angle"],"The current signal creates a timely reason for a focused commercial conversation.")),
    facts:listValue(firstValue(row,["facts","factual_evidence","Factual Evidence","evidence_summary"],[evidenceText])).length?listValue(firstValue(row,["facts","factual_evidence","Factual Evidence","evidence_summary"],[evidenceText])):[evidenceText],
    pains:pains.length?pains:["Validate the likely operational pain directly with the decision-maker."],
    scores:isRecord(row.scores)?row.scores:{"ICP fit":Math.min(2,score10/5),"Signal strength":Math.min(2,score10/5),"Urgency":Math.min(1.5,score10*.15),"Recency":Math.min(1,score10*.1),"Offer relevance":Math.min(1.5,score10*.15),"Budget":Math.min(1,score10*.1),"Accessibility":Math.min(1,score10*.1)},
    contact:{name:contactName,role,email,emailStatus,source:String(firstValue(contactRow,["source"],firstValue(row,["verification_provider","Verification Provider"],sourceUrl?"Public source":"Not enriched"))),linkedin:safeUrl(firstValue(contactRow,["linkedin"],firstValue(row,["linkedin_url","LinkedIn URL"],""))),listState:String(firstValue(contactRow,["listState","list_state"],firstValue(row,["list_state","List State"],"Research")))},
    evidence:[{label:String(firstValue(row,["source_title","Source Title","Page Title"],"Source evidence")),url:sourceUrl||"#"}],
    queryId:String(firstValue(row,["query_id","Query ID"],"")),runId:String(firstValue(row,["run_id","Run ID"],"")),keep:Boolean(firstValue(row,["keep","Keep"],score10>=state.settings.minScore))
  };
}

function applyRuntimePayload(payload,{persist=true,mode="imported"}={}){
  if(!isRecord(payload))throw new Error("Workspace payload must be a JSON object");
  const rows=Array.isArray(payload.opportunities)?payload.opportunities:Array.isArray(payload.qualified_leads)?payload.qualified_leads:Array.isArray(payload.findings)?payload.findings:Array.isArray(payload.raw_findings)?payload.raw_findings:[];
  const normalized=rows.map(normalizeOpportunity).filter(item=>item.company&&item.score>=0).sort((a,b)=>b.score-a.score);
  if(!normalized.length)throw new Error("No opportunities or findings were found in the payload");
  opportunities=normalized;
  signals=Array.isArray(payload.signals)?payload.signals.map((item,index)=>({company:String(firstValue(item,["company","company_name"],normalized[index]?.company||"Unknown")),text:String(firstValue(item,["text","signal","signal_summary"],"Market signal")),type:String(firstValue(item,["type","signal_type"],"Market signal")),date:String(firstValue(item,["date","signal_date"],new Date().toISOString().slice(0,10))),confidence:String(firstValue(item,["confidence"],"Medium")),status:String(firstValue(item,["status"],"Qualified"))})):normalized.map(o=>({company:o.company,text:o.signal,type:o.signalType,date:o.signalDate,confidence:o.confidence,status:o.score>=state.settings.minScore?"Qualified":"Monitor"}));
  sources=Array.isArray(payload.sources)&&payload.sources.length?payload.sources.map(item=>({name:String(firstValue(item,["name","source"],"Source")),group:String(firstValue(item,["group","type"],"Public web")),cadence:String(firstValue(item,["cadence","frequency"],"Daily")),health:String(firstValue(item,["health","status"],"Healthy")),findings:numberValue(firstValue(item,["findings","count"],0))})):structuredClone(demoSources);
  runs=Array.isArray(payload.runs)&&payload.runs.length?payload.runs.map((item,index)=>({id:String(firstValue(item,["id","run_id"],`RUN-${index+1}`)),started:String(firstValue(item,["started","start_time"],"—")),findings:numberValue(firstValue(item,["findings","pages_found"],0)),qualified:numberValue(firstValue(item,["qualified","qualified_leads"],0)),saved:numberValue(firstValue(item,["saved"],normalized.length)),emailed:numberValue(firstValue(item,["emailed"],0)),errors:numberValue(firstValue(item,["errors"],0)),status:String(firstValue(item,["status"],"Complete"))})):structuredClone(demoRuns);
  state.statuses={...Object.fromEntries(normalized.map(o=>[o.id,o.status])),...state.statuses};
  state.listStates={...Object.fromEntries(normalized.map(o=>[o.id,o.contact.listState])),...state.listStates};
  if(isRecord(payload.workspace))state.workspace={...state.workspace,...payload.workspace};
  state.runtime={...state.runtime,mode,lastSync:formatNow(),error:""};
  state.runtimeData={workspace:state.workspace,opportunities:normalized,signals,sources,runs,generated_at:new Date().toISOString()};
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
  try{const response=await fetch(url,{headers:{Accept:"application/json"}});if(!response.ok)throw new Error(`Endpoint returned ${response.status}`);applyRuntimePayload(await response.json(),{mode:"live"});showToast(`Synced ${opportunities.length} opportunities`);return true;}
  catch(error){state.runtime.error=error.message;saveState();renderRuntimeStatus();showToast(`Sync failed: ${error.message}`);return false;}
  finally{setBusy("sync-btn",false,"Sync data");}
}

async function triggerResearch({test=false}={}){
  const url=state.integrations.runUrl.trim();
  if(!url){showToast("Add the private Make run webhook in Settings");switchView("settings");return false;}
  if(!isPrivateEndpoint(url)){showToast("Use an HTTPS webhook");return false;}
  if(!test)setBusy("run-btn",true,"Starting…");
  const body={workspace_id:state.workspace.id,market:state.workspace.market,test,requested_at:new Date().toISOString(),settings:{email_count:state.settings.emailCount,app_count:state.settings.appCount,min_score:state.settings.minScore},workflow:state.map.publishedConfigs};
  try{const response=await fetch(url,{method:"POST",headers:{"Content-Type":"application/json",Accept:"application/json"},body:JSON.stringify(body)});if(!response.ok)throw new Error(`Webhook returned ${response.status}`);state.runtime.lastRunRequest=formatNow();state.runtime.error="";saveState();renderRuntimeStatus();showToast(test?"Make webhook test passed":"Research run accepted by Make");return true;}
  catch(error){state.runtime.error=error.message;saveState();renderRuntimeStatus();showToast(`Run failed: ${error.message}`);return false;}
  finally{if(!test)setBusy("run-btn",false,"Run research");}
}

function mapConfig(id,published=false){return (published?state.map.publishedConfigs:state.map.draftConfigs)[id];}
function dirtyMapNodes(){return workflowNodes.filter(node=>JSON.stringify(mapConfig(node.id))!==JSON.stringify(mapConfig(node.id,true)));}
function mapMetric(node,config){
  if(node.id==="sources")return `${config.value} sources`;
  if(node.id==="score")return `≥${config.value} score`;
  if(node.id==="shortlist")return `${config.value} saved`;
  if(node.id==="contacts")return `${config.value} / company`;
  if(node.id==="email")return `${config.value} emailed`;
  return node.metric;
}

function renderSystemMap(){
  const dirty=dirtyMapNodes();
  const enabled=workflowNodes.filter(node=>mapConfig(node.id,true).enabled).length;
  const healthy=workflowNodes.filter(node=>node.status==="Healthy").length;
  document.getElementById("map-summary").innerHTML=`
    <div class="map-summary-card"><span>◇</span><div><strong>${enabled} / ${workflowNodes.length}</strong><small>Active workflow steps</small></div></div>
    <div class="map-summary-card"><span>●</span><div><strong>${healthy} healthy</strong><small>2 steps need review</small></div></div>
    <div class="map-summary-card"><span>⌁</span><div><strong>${dirty.length} drafts</strong><small>Not active until published</small></div></div>
    <div class="map-summary-card"><span>V</span><div><strong>Version ${state.map.version}</strong><small>${esc(state.map.lastPublished)}</small></div></div>`;
  document.getElementById("map-draft-count").textContent=dirty.length;
  document.getElementById("map-version-label").textContent=state.map.version;
  document.getElementById("publish-map").textContent=dirty.length?`Publish ${dirty.length} change${dirty.length===1?"":"s"}`:"Published";
  document.getElementById("publish-map").disabled=!dirty.length;
  document.getElementById("discard-map-drafts").disabled=!dirty.length;
  document.getElementById("map-edges").innerHTML=workflowEdges.map(edge=>`<path class="connection ${edge.branch?"branch":""}" d="${edge.d}"></path>`).join("");
  document.getElementById("map-nodes").innerHTML=workflowNodes.map((node,index)=>{
    const config=mapConfig(node.id);
    const changed=dirty.some(item=>item.id===node.id);
    return `<button class="map-node ${selectedMapNode===node.id?"selected":""} ${config.enabled?"":"disabled"}" style="--x:${node.x}%;--y:${node.y}%" data-map-node="${node.id}" aria-pressed="${selectedMapNode===node.id}">
      ${changed?'<i class="map-draft-mark" aria-label="Draft changed"></i>':''}
      <span class="map-node-head"><span class="map-node-icon">${node.icon}</span><span class="map-node-index">0${index+1}</span><i class="map-node-status ${node.status.toLowerCase()}"></i></span>
      <h3>${esc(config.title)}</h3><p>${esc(node.type)} · ${config.enabled?esc(config.cadence):"Disabled"}</p>
      <span class="map-node-foot"><strong>${esc(mapMetric(node,config))}</strong><span>${esc(node.lastRun)}</span></span>
    </button>`;
  }).join("");
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
        <div class="map-inspector-head"><div class="map-inspector-title"><span class="inspector-icon">${node.icon}</span><div><p class="kicker">${esc(node.type)} step · ${String(workflowNodes.indexOf(node)+1).padStart(2,"0")}</p><h2>${esc(config.title)}</h2></div></div><span class="status ${statusClass(node.status)}">${esc(node.status)}</span></div>
        <p class="map-inspector-description">${esc(config.description)}</p>
        <div class="map-inspector-meta"><span>Last run <strong>${esc(node.lastRun)}</strong></span><span>Output <strong>${esc(mapMetric(node,config))}</strong></span>${changed?'<span><strong>Draft changed</strong></span>':''}</div>
      </div>
      <div class="inspector-tabs"><span class="inspector-tab">Configuration</span><span class="inspector-tab">Recent output</span><span class="inspector-tab">Evidence</span></div>
      <form class="map-form" id="map-node-form">
      <label>Step name<input id="map-field-title" value="${esc(config.title)}" required></label>
      <label>Run cadence<select id="map-field-cadence">${cadenceOptions.map(option=>`<option ${option===config.cadence?"selected":""}>${esc(option)}</option>`).join("")}</select></label>
      <label class="wide">Purpose<textarea id="map-field-description" required>${esc(config.description)}</textarea></label>
      <div class="map-control-pair wide"><label>${esc(node.controlLabel)}<input id="map-field-value" type="number" min="1" max="100" step="${node.id==="score"?"0.1":"1"}" value="${config.value}" required></label><span class="map-control-unit">${esc(node.unit)}</span></div>
      <label class="wide">Operating instructions<textarea id="map-field-instructions" required>${esc(config.instructions)}</textarea></label>
      <label class="map-switch wide"><span>Step active${node.id==="outreach"?" · required safety gate":""}</span><input id="map-field-enabled" type="checkbox" ${config.enabled?"checked":""} ${node.id==="outreach"?"disabled":""}></label>
      <div class="map-inspector-actions"><button class="btn secondary" type="button" data-test-map="${node.id}">Test step</button><button class="btn secondary" type="button" data-reset-map="${node.id}" ${changed?"":"disabled"}>Reset</button><button class="btn primary" type="button" id="save-map-draft">Save draft</button></div>
      ${test?`<div class="map-test-result ${test.status==="Review"?"warn":""}"><strong>${esc(test.status)} · ${esc(test.date)}</strong><br>${esc(test.output)}</div>`:""}
      </form>
    </div>`;
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
  if(id==="outreach"&&!config.enabled)errors.push("Human outreach approval must remain active during the pilot");
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
  if(!configs.outreach.enabled)errors.push("Human outreach approval must remain active during the pilot");
  return errors;
}

function publishWorkflow(){
  if(document.getElementById("map-node-form")&&!saveMapDraft(false))return;
  const errors=validateWorkflow();
  if(errors.length){
    document.getElementById("modal-content").innerHTML=`<p class="kicker">Publish blocked</p><h2>Fix ${errors.length} validation issue${errors.length===1?"":"s"}</h2><div class="notice"><strong>The active workflow was not changed.</strong></div><ul>${errors.map(error=>`<li>${esc(error)}</li>`).join("")}</ul><button class="btn primary" id="close-preview-action">Return to map</button>`;
    openModal();return;
  }
  const changes=dirtyMapNodes().length;
  if(!changes)return;
  state.map.publishedConfigs=structuredClone(state.map.draftConfigs);
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
  const outputs={sources:"12 approved sources responded; evidence metadata is present.",scan:"Simulation processed 30 pages with duplicate detection enabled.",analysis:"Sample finding separated into verified facts and commercial hypotheses.",score:"Sample opportunity produced a complete seven-factor score explanation.",shortlist:"Five qualifying companies fit the current shortlist rule.",contacts:"Apollo/public-data gate returned three verified contacts and hid one prediction.",email:"Preview generated exactly three internal opportunities with one contact each.",outreach:"Safety rules passed; sender connection remains planned and human approval is enforced."};
  state.map.tests[id]={status:id==="outreach"?"Review":"Passed",date:"Just now",output:outputs[id]};
  saveState();renderSystemMap();showToast(id==="outreach"?"Rule test passed; connection still planned":"Step simulation passed");
}

function renderMetrics(){
  const verified=opportunities.filter(o=>o.contact.emailStatus==="Verified").length;
  const eligible=opportunities.filter(o=>state.listStates[o.id]==="Eligible").length;
  const qualified=opportunities.filter(o=>o.score>=state.settings.minScore).length;
  const data=[
    ["Opportunities loaded",opportunities.length,state.runtime.mode==="demo"?"Demo workspace":"Current workspace"],["Qualified signals",qualified,`Score ≥ ${state.settings.minScore}`],
    ["Saved in V2",Math.min(state.settings.appCount,opportunities.length),"Daily maximum"],["Email shortlist",Math.min(state.settings.emailCount,qualified),"One contact each"],
    ["Verified / eligible",`${verified} / ${eligible}`,"Business contacts"]
  ];
  document.getElementById("metrics").innerHTML=data.map(([label,value,note])=>`<div class="metric"><span>${label}</span><strong>${value}</strong><small>${note}</small></div>`).join("");
}

function renderOpportunities(){
  const list=opportunities.slice(0,state.settings.appCount);
  document.getElementById("today-count").textContent=list.length;
  document.getElementById("opportunity-list").innerHTML=list.map((o,index)=>{
    const listState=state.listStates[o.id]||"Research";
    return `<article class="opp-card">
      <div class="rank">${index+1}</div>
      <div class="opp-main">
        <div class="opp-title-row"><h3>${esc(o.company)}</h3>${o.emailed?'<span class="tag email">Morning email</span>':''}${o.contact.emailStatus==="Verified"?'<span class="tag verified">Verified email</span>':''}</div>
        <p class="signal">${esc(o.signal)}</p>
        <div class="opp-meta"><span><strong>${esc(o.primaryOffer)}</strong></span><span>${esc(o.signalDate)}</span><span>Status: ${esc(state.statuses[o.id])}</span></div>
        <div class="contact-line"><span class="avatar">${initials(o.contact.name)}</span><span><strong>${esc(o.contact.name)}</strong> · ${esc(o.contact.role)} · ${esc(o.contact.emailStatus)} · ${esc(listState)}</span></div>
      </div>
      <div class="opp-side"><div class="score">${o.score.toFixed(1)}<small>/10</small></div><div class="confidence">${esc(o.confidence)} evidence confidence</div><div class="card-actions"><button class="btn small secondary" data-message="${o.id}">Draft</button><button class="btn small primary" data-open="${o.id}">Open</button></div></div>
    </article>`;
  }).join("");
}

function renderSignals(){
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
  document.getElementById("contact-filters").innerHTML=filters.map(f=>`<button class="filter ${f===currentContactFilter?"active":""}" data-contact-filter="${esc(f)}">${esc(f)}</button>`).join("");
  let list=opportunities;
  if(["Verified","Public business","Predicted"].includes(currentContactFilter)) list=list.filter(o=>o.contact.emailStatus===currentContactFilter);
  if(["Eligible","Suppressed"].includes(currentContactFilter)) list=list.filter(o=>state.listStates[o.id]===currentContactFilter);
  document.getElementById("contact-count").textContent=opportunities.length;
  document.getElementById("contacts-body").innerHTML=list.map(o=>`<tr>
    <td><strong>${esc(o.contact.name)}</strong></td><td>${esc(o.company)}</td><td>${esc(o.contact.role)}</td>
    <td>${o.contact.emailStatus==="Predicted"?'<span class="status warn">Hidden until verified</span>':`<a class="evidence" href="mailto:${esc(o.contact.email)}">${esc(o.contact.email)}</a>`}</td>
    <td><span class="status ${statusClass(o.contact.emailStatus)}">${esc(o.contact.emailStatus)}</span><br><small>${esc(o.contact.source)}</small></td>
    <td><select data-list-state="${o.id}"><option ${state.listStates[o.id]==="Research"?"selected":""}>Research</option><option ${state.listStates[o.id]==="Eligible"?"selected":""}>Eligible</option><option ${state.listStates[o.id]==="Suppressed"?"selected":""}>Suppressed</option><option ${state.listStates[o.id]==="Unsubscribed"?"selected":""}>Unsubscribed</option></select></td>
    <td><button class="btn small secondary" data-open="${o.id}">Dossier</button></td></tr>`).join("");
}

function renderSources(){
  document.getElementById("source-grid").innerHTML=sources.map(s=>`<article class="source-card"><div class="opp-title-row"><h3>${esc(s.name)}</h3><span class="status ${statusClass(s.health)}">${esc(s.health)}</span></div><p>${esc(s.group)} · ${esc(s.cadence)}</p><div class="source-foot"><span>${s.findings} findings today</span><button class="btn small secondary">Inspect</button></div></article>`).join("");
}

function renderRuns(){
  document.getElementById("runs-body").innerHTML=runs.map(r=>`<tr><td><strong>${esc(r.id)}</strong></td><td>${esc(r.started)}</td><td>${r.findings}</td><td>${r.qualified}</td><td>${r.saved}</td><td>${r.emailed}</td><td>${r.errors}</td><td><span class="status ${statusClass(r.status)}">${esc(r.status)}</span></td></tr>`).join("");
}

function renderOutreach(){
  const list=opportunities.filter(o=>["Draft ready","Approved"].includes(state.statuses[o.id])||state.listStates[o.id]==="Eligible");
  document.getElementById("outreach-count").textContent=list.length;
  document.getElementById("outreach-grid").innerHTML=list.length?list.map(o=>{
    const eligible=state.listStates[o.id]==="Eligible"&&o.contact.emailStatus==="Verified";
    return `<article class="outreach-card"><div><p class="kicker">${esc(state.statuses[o.id]||"Research")}</p><h3>${esc(o.company)}</h3><p>${esc(o.signal)}</p></div><div class="outreach-meta"><span>${esc(o.contact.name)}</span><span>${esc(o.contact.role)}</span><span class="status ${eligible?"good":"warn"}">${eligible?"Eligible contact":"Review required"}</span></div><div class="card-actions"><button class="btn secondary" data-message="${o.id}">Edit draft</button><button class="btn primary" data-status-action="Approved" data-id="${o.id}" ${eligible?"":"disabled"}>Approve</button></div></article>`;
  }).join(""):'<div class="empty-state"><h3>No outreach drafts yet</h3><p>Open a qualified company and generate a message. The draft appears here only after you mark it ready or the verified contact becomes campaign eligible.</p></div>';
}

function renderRuntimeStatus(){
  const pill=document.getElementById("runtime-pill");
  const modes={demo:"Demo data",imported:"Imported data",live:"Live endpoint"};
  pill.lastChild.textContent=` ${modes[state.runtime.mode]||"Local data"}`;
  pill.classList.toggle("live",state.runtime.mode==="live");
  document.getElementById("status-make").textContent=state.integrations.runUrl?"Configured":"Endpoint needed";
  document.getElementById("status-make").classList.toggle("pending",!state.integrations.runUrl);
  document.getElementById("status-sheets").textContent="Workbook ready";
  document.getElementById("setting-workspace-id").value=state.workspace.id;
  document.getElementById("setting-workspace-name").value=state.workspace.name;
  document.getElementById("setting-market").value=state.workspace.market;
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
}

function openDrawer(id){
  const o=opportunities.find(item=>item.id===id);if(!o)return;
  const scoreMax={"ICP fit":2,"Signal strength":2,"Urgency":1.5,"Recency":1,"Offer relevance":1.5,"Budget":1,"Accessibility":1};
  document.getElementById("drawer-content").innerHTML=`
    <p class="kicker">${esc(o.id)} · ${esc(o.signalType)}</p><h2>${esc(o.company)}</h2><p class="drawer-sub">${esc(o.industry)} · ${esc(o.location)} · Signal ${esc(o.signalDate)}</p>
    <div class="detail-score"><strong>${o.score.toFixed(1)}</strong><div><b>Opportunity score /10</b><p class="drawer-sub">${esc(o.confidence)} evidence confidence · ${esc(o.primaryOffer)}</p></div></div>
    <div class="score-bars">${Object.entries(o.scores).map(([label,value])=>`<div class="bar-row"><span>${esc(label)}</span><span class="bar"><i style="width:${Math.min(100,value/scoreMax[label]*100)}%"></i></span><b>${value.toFixed(1)}</b></div>`).join("")}</div>
    <section class="detail-section"><h3>Why now</h3><p>${esc(o.whyNow)}</p></section>
    <section class="detail-section"><h3>Verified facts</h3><ul>${o.facts.map(f=>`<li>${esc(f)}</li>`).join("")}</ul></section>
    <section class="detail-section"><h3>Pain-point assessment</h3><ul>${o.pains.map(p=>`<li>${esc(p)}</li>`).join("")}</ul></section>
    <section class="detail-section"><h3>Primary decision-maker</h3><p><strong>${esc(o.contact.name)}</strong><br>${esc(o.contact.role)}<br>${o.contact.emailStatus==="Predicted"?"Email requires verification":esc(o.contact.email)}<br><span class="status ${statusClass(o.contact.emailStatus)}">${esc(o.contact.emailStatus)}</span> · ${esc(o.contact.source)}</p></section>
    <section class="detail-section"><h3>Evidence</h3>${o.evidence.map(e=>`<a class="evidence" href="${esc(e.url)}" target="_blank" rel="noopener">${esc(e.label)} ↗</a>`).join("")}</section>
    <div class="drawer-actions"><button class="btn secondary" data-status-action="Monitor" data-id="${o.id}">Monitor</button><button class="btn secondary" data-message="${o.id}">Generate message</button><button class="btn primary" data-status-action="Approved" data-id="${o.id}">Approve outreach</button></div>`;
  document.getElementById("lead-drawer").classList.add("open");
  document.getElementById("drawer-backdrop").classList.add("open");
  document.getElementById("lead-drawer").setAttribute("aria-hidden","false");
}

function closeDrawer(){document.getElementById("lead-drawer").classList.remove("open");document.getElementById("drawer-backdrop").classList.remove("open");document.getElementById("lead-drawer").setAttribute("aria-hidden","true");}

function openEmailPreview(){
  const top=opportunities.filter(o=>o.score>=state.settings.minScore&&o.keep!==false).slice(0,state.settings.emailCount);
  document.getElementById("modal-content").innerHTML=`<p class="kicker">Morning brief preview</p><h2>Latvia Opportunity Radar · ${top.length} leads</h2><p class="drawer-sub">Only leads meeting the score and evidence threshold appear.</p><div class="email-preview"><h4>Good morning, Edgars</h4><p>Today’s strongest evidence-backed business opportunities:</p>${top.map((o,i)=>`<div class="email-lead"><strong>${i+1}. ${esc(o.company)} — ${o.score.toFixed(1)}/10</strong><p>${esc(o.signal)}</p><p><b>Likely need:</b> ${esc(o.primaryOffer)}</p><p><b>Contact:</b> ${esc(o.contact.name)}, ${esc(o.contact.role)} · ${o.contact.emailStatus==="Predicted"?"email not verified":esc(o.contact.email)}</p></div>`).join("")}</div><button class="btn primary" id="close-preview-action">Close preview</button>`;
  openModal();
}

function openMessage(id){
  const o=opportunities.find(item=>item.id===id);if(!o)return;
  const first=o.contact.name.split(" ")[0];
  const message=`Subject: ${o.signalType.toLowerCase()} at ${o.company}\n\nHi ${first},\n\nI noticed ${o.company} is ${o.signal.toLowerCase()}\n\nChanges like this often create a short window where sales knowledge, CRM workflows and management expectations need to become much more consistent. I help Latvian teams turn that transition into a practical operating system rather than another document or disconnected tool.\n\nWould it be useful if I sent you a one-page outline of how I would approach this for ${o.company}?\n\nBest,\nEdgars`;
  document.getElementById("modal-content").innerHTML=`<p class="kicker">Approval-required draft</p><h2>${esc(o.company)}</h2><p class="drawer-sub">Generated from verified evidence. Review every statement before sending.</p><textarea class="message-box">${esc(message)}</textarea><div class="card-actions" style="margin-top:12px"><button class="btn secondary" id="copy-message">Copy draft</button><button class="btn primary" data-status-action="Draft ready" data-id="${o.id}">Mark draft ready</button></div>`;
  openModal();
}

function openModal(){document.getElementById("modal-backdrop").classList.add("open");}
function closeModal(){document.getElementById("modal-backdrop").classList.remove("open");}

function switchView(name){
  document.querySelectorAll(".view").forEach(v=>v.classList.toggle("active",v.id===`view-${name}`));
  document.querySelectorAll(".nav-item[data-view]").forEach(b=>b.classList.toggle("active",b.dataset.view===name));
  const today=new Intl.DateTimeFormat("en-GB",{weekday:"long",day:"numeric",month:"long",year:"numeric",timeZone:"Europe/Riga"}).format(new Date());
  const labels={map:["Research automation","System Map"],today:[today,`Good morning · ${state.workspace.name}`],signals:["Evidence stream","Market signals"],companies:["Opportunity memory","Company dossiers"],contacts:["Verified business data","Contact list"],outreach:["Human approval required","Outreach queue"],sources:["Monitoring network","Source health"],runs:["Automation audit","Daily runs"],settings:["Operating rules","Research settings"]};
  const [kicker,title]=labels[name]||labels.map;document.getElementById("view-kicker").textContent=kicker;document.getElementById("view-title").textContent=title;
  document.getElementById("sidebar").classList.remove("open");window.scrollTo(0,0);
}

function renderAll(){
  renderSystemMap();renderMetrics();renderOpportunities();renderSignals();renderCompanies();renderContacts();renderOutreach();renderSources();renderRuns();renderRuntimeStatus();
  document.getElementById("setting-email").value=state.settings.emailCount;
  document.getElementById("setting-app").value=state.settings.appCount;
  document.getElementById("setting-score").value=state.settings.minScore;
}

document.addEventListener("click",event=>{
  const view=event.target.closest("[data-view]");if(view){
    if(view.dataset.view!=="map"&&document.getElementById("view-map").classList.contains("active")&&document.getElementById("map-node-form")&&!saveMapDraft(false))return;
    switchView(view.dataset.view);return;
  }
  const mapNode=event.target.closest("[data-map-node]");if(mapNode){
    if(mapNode.dataset.mapNode!==selectedMapNode&&document.getElementById("map-node-form")&&!saveMapDraft(false))return;
    selectedMapNode=mapNode.dataset.mapNode;renderSystemMap();
    if(window.matchMedia("(max-width: 800px)").matches)document.getElementById("map-inspector").scrollIntoView({behavior:"smooth",block:"start"});
    return;
  }
  const testMap=event.target.closest("[data-test-map]");if(testMap){testMapStep(testMap.dataset.testMap);return;}
  const resetMap=event.target.closest("[data-reset-map]");if(resetMap){state.map.draftConfigs[resetMap.dataset.resetMap]=structuredClone(state.map.publishedConfigs[resetMap.dataset.resetMap]);saveState();renderAll();showToast("Step draft reset");return;}
  const open=event.target.closest("[data-open]");if(open){openDrawer(open.dataset.open);return;}
  const message=event.target.closest("[data-message]");if(message){openMessage(message.dataset.message);return;}
  const signalFilter=event.target.closest("[data-signal-filter]");if(signalFilter){currentSignalFilter=signalFilter.dataset.signalFilter;renderSignals();return;}
  const contactFilter=event.target.closest("[data-contact-filter]");if(contactFilter){currentContactFilter=contactFilter.dataset.contactFilter;renderContacts();return;}
  const action=event.target.closest("[data-status-action]");if(action){
    const opportunity=opportunities.find(item=>item.id===action.dataset.id);
    if(action.dataset.statusAction==="Approved"&&opportunity){
      const listState=state.listStates[opportunity.id];
      if(opportunity.contact.emailStatus!=="Verified"||listState!=="Eligible"){
        showToast("Approval requires a verified, campaign-eligible contact");return;
      }
      if(["Suppressed","Unsubscribed"].includes(listState)){showToast("Suppressed contacts cannot be approved");return;}
    }
    state.statuses[action.dataset.id]=action.dataset.statusAction;saveState();renderAll();closeModal();showToast(`Status changed to ${action.dataset.statusAction}`);return;
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
  if(event.target.id==="reset-demo-btn"){opportunities=structuredClone(demoOpportunities);signals=structuredClone(demoSignals);sources=structuredClone(demoSources);runs=structuredClone(demoRuns);state.runtimeData=null;state.runtime={...structuredClone(defaultState.runtime)};state.statuses=Object.fromEntries(opportunities.map(o=>[o.id,o.status]));state.listStates=Object.fromEntries(opportunities.map(o=>[o.id,o.contact.listState]));saveState();renderAll();showToast("Demo data restored");}
  if(event.target.id==="save-map-draft")saveMapDraft();
  if(event.target.id==="publish-map")publishWorkflow();
  if(event.target.id==="discard-map-drafts"){state.map.draftConfigs=structuredClone(state.map.publishedConfigs);saveState();renderAll();showToast("All workflow drafts discarded");}
  if(event.target.id==="copy-message")navigator.clipboard.writeText(document.querySelector(".message-box").value).then(()=>showToast("Draft copied"));
  if(event.target.id==="save-settings"){
    const workspaceId=document.getElementById("setting-workspace-id").value.trim().toLowerCase().replace(/[^a-z0-9-]+/g,"-").replace(/^-|-$/g,"");
    const dataUrl=document.getElementById("setting-data-url").value.trim();
    const runUrl=document.getElementById("setting-run-url").value.trim();
    if(!workspaceId){showToast("Workspace ID is required");return;}
    if(!isPrivateEndpoint(dataUrl)||!isPrivateEndpoint(runUrl)){showToast("Runtime endpoints must use HTTPS");return;}
    state.workspace={id:workspaceId,name:document.getElementById("setting-workspace-name").value.trim()||workspaceId,market:document.getElementById("setting-market").value.trim()||"Latvia"};
    state.integrations={dataUrl,runUrl};
    state.map.draftConfigs.email.value=Math.max(1,Math.min(5,Number(document.getElementById("setting-email").value)||3));
    state.map.draftConfigs.shortlist.value=Math.max(3,Math.min(10,Number(document.getElementById("setting-app").value)||5));
    state.map.draftConfigs.score.value=Math.max(1,Math.min(10,Number(document.getElementById("setting-score").value)||7));
    saveState();renderAll();showToast("Workspace and workflow draft saved");
  }
});

document.addEventListener("change",event=>{
  const select=event.target.closest("[data-list-state]");if(!select)return;
  const id=select.dataset.listState;
  const opp=opportunities.find(o=>o.id===id);
  const previousState=state.listStates[id]||"Research";
  if(select.value==="Eligible"&&opp.contact.emailStatus!=="Verified"){
    select.value=state.listStates[id]||"Research";
    showToast("Only verified emails can be marked eligible");return;
  }
  if(select.value==="Eligible"&&["Suppressed","Unsubscribed"].includes(previousState)){
    select.value=previousState;
    showToast("Suppressed contacts require a separate compliance review");return;
  }
  state.listStates[id]=select.value;saveState();renderMetrics();showToast(`Contact moved to ${select.value}`);
});

document.getElementById("company-search").addEventListener("input",event=>renderCompanies(event.target.value));
document.getElementById("data-import").addEventListener("change",async event=>{
  const [file]=event.target.files;if(!file)return;
  try{applyRuntimePayload(JSON.parse(await file.text()),{mode:"imported"});showToast(`Imported ${opportunities.length} opportunities`);}catch(error){showToast(`Import failed: ${error.message}`);}finally{event.target.value="";}
});
document.addEventListener("keydown",event=>{if(event.key==="Escape"){closeDrawer();closeModal();}});

restoreRuntimeData();
renderAll();
