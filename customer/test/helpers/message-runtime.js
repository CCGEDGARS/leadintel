const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),{JSDOM}=require('jsdom');
const S=require('../../message-studio.js'),E=require('../../message-editor.js'),O=require('../../outreach-engine.js');
const read=name=>fs.readFileSync(path.join(__dirname,'..','..',name),'utf8');
function mounted({selected='curiosity',outreachSnapshot=null,mainSnapshot=null,runtimeSetup=''}={}){
 const w=new JSDOM(read('index.html'),{url:'https://example.test/customer/',runScripts:'outside-only'}).window;
 const essentials={sender:'Robin Lane',company:'North Works',offer:'steel and installation',target:'industrial teams',problem:'supplier handoffs',value:'simplify project delivery',difference:'Our team supports industrial projects.',approach:'Project delivery to EN 1090 requirements',meetingValue:'relevant project lessons',calendly:'https://calendly.com/north/intro',nextAction:'Choose a suitable time here: {{calendly}}'};
 const main={step:1,website:'https://north.example',brandIdentity:{senderName:essentials.sender,companyDisplayName:essentials.company},profile:{companyName:essentials.company,priorityOffers:essentials.offer,idealCustomer:essentials.target,customerProblem:essentials.problem,valueProposition:essentials.value,differentiation:essentials.difference,deliveryApproach:essentials.approach,meetingValue:essentials.meetingValue}};
 if(mainSnapshot)Object.assign(main,JSON.parse(JSON.stringify(mainSnapshot)));
 const person={id:'p1',name:'Alex Buyer',title:'Operations Director',kept:true,email:'alex@buyer.example'},candidate={domain:'buyer.example',website:'https://buyer.example',company:'Buyer',fitScore:80,people:[person]},trigger={url:'https://buyer.example/news',companyDomain:candidate.domain,excerpt:'Buyer is investing in a new sorting plant at Northport.',verification:'source_verified'};
 const studio=S.foundation(S.normalize({mode:'professional',essentials}),main),context={channel:'email',buyerName:person.name,firstName:'Alex',buyerCompany:candidate.company,buyerRole:person.title,trigger};
 let item=E.apply({domain:candidate.domain,company:candidate.company,selectedPersonId:person.id,channel:'email',drafts:{},dossier:{domain:candidate.domain,company:candidate.company,people:[person],evidence:[{url:trigger.url,text:trigger.excerpt,sourceRead:true}],selectedTrigger:trigger}},E.tailor(studio,context),{original:true,key:'first',style:'professional',essentials:studio.essentials,origin:'tailored'});
 item.messageStudioDraft.scriptSavedAt='today';item.messageStudioDraft.savedDraft=E.workingDraft(item);studio.mode=selected;
 w.localStorage.setItem('leadintel_customer_v2_state',JSON.stringify(main));w.localStorage.setItem('leadintel_customer_v2_discovery',JSON.stringify({pipeline:[candidate]}));w.localStorage.setItem('leadintel_customer_v2_discovery_meta',JSON.stringify({scriptBuyer:{workspaceId:'w1',domain:candidate.domain,personId:person.id,channel:'email',recipientIdentity:require('./recipient-identity.cjs')(candidate,person,'crm1')}}));w.localStorage.setItem('leadintel_customer_v2_outreach',JSON.stringify(outreachSnapshot||{selectedDomain:candidate.domain,items:[item],messageStudio:S.storageState(studio)}));
 Object.assign(w,{LeadIntelContactPolicy:require('../../contact-confirmation-policy.js'),LeadIntelSubjectEditor:require('../../subject-editor.js'),LeadIntelMessageStudio:S,LeadIntelMessageEditor:E,LeadIntelOutreach:O,LeadIntelDiscovery:require('../../discovery-engine.js'),LeadIntelMessageFacts:require('../../message-facts.js'),LeadIntelMessageTranslations:require('../../message-translations.js'),LeadIntelMessageEvidence:require('../../message-evidence.js'),LeadIntelTriggerPreview:require('../../trigger-preview.js'),LeadIntelContentLanguage:{workspaceContentLanguage:()=> 'en'},LeadIntelServerBridge:{ready:true,session:{authenticated:true,user:{name:essentials.sender}},workspace:{id:'w1'}}});
 w.LeadIntelWritingAssistantContext=require('../../writing-assistant-context.js');
 w.eval(read('original-scripts.js'));w.eval(read('original-scripts-ui.js'));
 w.eval(read('message-workspace.js'));w.eval(read('message-translation-ui.js'));w.eval(read('sender-identity-location.js'));
 const requests=[];w.fetch=(url,options)=>new Promise(resolve=>requests.push({url,options,resolve}));
 w.eval(read('outreach-ui.js').replace(/^import .*;\s*$/gm,'')+"\nhandoffContact={domain:'buyer.example',personId:'p1',channel:'email',contact:{work_email:'alex@buyer.example'}};renderAll();\n"+runtimeSetup);
 return {w,q:id=>w.document.getElementById(id),requests,item:()=>JSON.parse(w.localStorage.getItem('leadintel_customer_v2_outreach')).items[0],before:E.workingDraft(item)};
}
module.exports={mounted};
// Finish bounded external fact reads in tests whose subject is generation or editor behavior.
// AI draft/field requests remain pending for each test to control explicitly.
async function settleFactResearch(h){
 for(let round=0;round<30;round++){
  await new Promise(resolve=>setImmediate(resolve));
  const rows=h.requests.filter(row=>!row.factSettled&&/\/api\/ai\/web-search|\/firecrawl\/(?:search|scrape)/.test(String(row.url)));
  for(const row of rows){row.factSettled=true;row.resolve({ok:true,json:async()=>({success:true,results:[],data:[]})});}
  if(!rows.length&&h.requests.some(row=>String(row.url).includes('/api/ai/generate')))return;
 }
}
module.exports.settleFactResearch=settleFactResearch;
