const test=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs'),{JSDOM}=require('jsdom');
const source=fs.readFileSync(require.resolve('../discovery-ui.js'),'utf8');
function part(start,end){const i=source.indexOf(start);assert.ok(i>=0,`${start} missing`);return source.slice(i,source.indexOf(end,i));}
test('Companies status can be asked to render before the lazy research state is initialized',()=>{
 const document=new JSDOM('<span id="discovery-status"></span>').window.document;
 const c={discovery:null,mainState:()=>({website:'https://seller.example'}),selectedDiscoveryTarget:()=>5,loadMeta:()=>({}),$:id=>document.getElementById(id),DEFAULT_DISCOVERY_TARGET:10};
 assert.doesNotThrow(()=>vm.runInNewContext(part('function renderStatus(){','function companyQualificationProfile(')+';renderStatus()',c));
});
test('saved discovery amount counts as selected in the progress guide before the first search',()=>{
 const Journey=require('../journey-progress.js');const model=Journey.buildJourneyModel({currentStep:5,activeJourneyStage:4,discoveryMeta:{targetCount:5},discovery:{},availability:{4:true}});
 assert.equal(model[3].steps.find(x=>x.id==='scope').complete,true);
});
test('running progress reports the actual phase without an impossible zero denominator',()=>{
 const c={discoveryProgress:{phase:'buyer-fit',completed:0,total:2}};vm.runInNewContext(part('function companySearchProgressText(','async function cancelCompanyDiscovery('),c);
 assert.match(c.companySearchProgressText(),/purchasing fit.*0\/2/);c.discoveryProgress={phase:'finding',completed:0,total:0};assert.doesNotMatch(c.companySearchProgressText(),/0\/0/);
});
test('Cancel delegates to the registered task cancellation and keeps the results intact',async()=>{
 const discovery={status:'running',candidates:[{domain:'kept.example'}]},calls=[],c={discovery,activeDiscoveryTaskId:'task-a',window:{LeadIntelTaskCentre:{cancel:async id=>{calls.push(id);return true;}}},showToast:()=>{}};
 vm.runInNewContext(part('async function cancelCompanyDiscovery(','function renderStatus(){'),c);await c.cancelCompanyDiscovery();assert.deepEqual(calls,['task-a']);assert.equal(discovery.candidates[0].domain,'kept.example');
 discovery.status='complete';await c.cancelCompanyDiscovery();assert.equal(calls.length,1);
});
test('company extraction sends bounded relevant context, not the complete saved profile',()=>{
 const c={};vm.runInNewContext(part('function buildCompanyExtractionPrompt(','async function extractCompaniesFromEvidence('),c);
 const prompt=c.buildCompanyExtractionPrompt({profile:{companyName:'Seller',idealCustomer:'Export producers',priorityOffers:'Find buyers',evidenceSources:['x'.repeat(180000)],researchReports:['y'.repeat(180000)]},market:'Latvia',references:[],sources:Array.from({length:16},(_,i)=>({id:`E${i}`,url:`https://source.example/${i}`,title:'x'.repeat(5000),description:'x'.repeat(10000),text:'x'.repeat(10000)}))});
 assert.ok(prompt.length<75000);assert.match(prompt,/Export producers/);assert.doesNotMatch(prompt,/evidenceSources|researchReports/);assert.match(prompt,/https:\/\/source.example\/0/);
});
test('failed AI extraction stays visible and cannot become a confirmed no-match',async()=>{
 const Discovery=require('../discovery-engine.js'),record=[],c={discovery:{searchFeedback:[]},companyExtractionFailures:[],discoveryProgress:{},activeDiscoveryTaskId:'task',LeadIntelDiscovery:{...Discovery,extractCompanyMentions:()=>[]},bridge:()=>({session:{authenticated:true},workspace:{id:'workspace'}}),window:{LeadIntelTaskCentre:{update:()=>{}}},renderDiscoverySafely:()=>{},mainState:()=>({profile:{}}),companyQualificationProfile:()=>({}),withDiscoveryDeadline:operation=>operation(),fetch:async()=>({ok:false,status:400,json:async()=>({error:'AI generation prompt is invalid or too large'})}),LEADINTEL_API:'https://api.example',setCompanyExtraction:(...args)=>record.push(args),discoverySearchFailure:(error,queryMeta,phase)=>({status:error.status,queryMeta,phase}),encodeURIComponent};
 vm.runInNewContext(part('function throwIfDiscoveryRunAborted(','function discoveryFailureReason(')+part('function buildCompanyExtractionPrompt(','async function runCompanyDiscovery('),c);
 await c.extractCompaniesFromEvidence([{url:'https://source.example/news',title:'Source',text:'Evidence'}],'Latvia',5);
 assert.equal(c.companyExtractionFailures.length,1);assert.equal(c.companyExtractionFailures[0].phase,'extracting');assert.equal(c.companyExtractionFailures[0].status,400);
 assert.equal(Discovery.discoveryOutcomeStatus({failures:c.companyExtractionFailures.length,candidateCount:0}),'error');
});
test('extraction failures retain their phase and status through save/reload',()=>{
 const Discovery=require('../discovery-engine.js');const state=Discovery.normalizeDiscoveryState({status:'error',searchFailures:[{id:'extract-0',phase:'extracting',reason:'request_rejected',status:400,queryMeta:{id:'extract-0',market:'Latvia'}}]});
 assert.equal(state.searchFailures[0].phase,'extracting');assert.equal(state.searchFailures[0].status,400);
});
test('changing the amount refreshes the progress guide immediately',()=>{
 let saved,refreshes=0;const c={$:()=>({value:'5'}),selectedDiscoveryTarget:()=>5,loadMeta:()=>({}),saveMeta:v=>saved=v,window:{LeadIntelJourney:{refresh:()=>refreshes++}}};
 vm.runInNewContext(part('function persistDiscoveryTarget(){','function resetLocalDownstreamState(){')+';persistDiscoveryTarget()',c);assert.equal(saved.targetCount,5);assert.equal(refreshes,1);
});
test('commercial assessment keeps its dedicated deadline while recovery can select a bounded deadline',async()=>{
 const timeouts=[],c={COMPANY_EXTRACTION_TIMEOUT_MS:47000,DISCOVERY_REQUEST_TIMEOUT_MS:25000,withDiscoveryDeadline:async(_operation,_signal,timeout)=>timeouts.push(timeout)};
 vm.runInNewContext(part('async function generateDiscoveryBuyerFit(','async function runCompanyDiscovery('),c);
 await c.generateDiscoveryBuyerFit('Evidence');await c.generateDiscoveryBuyerFit('Evidence',undefined,40000);assert.deepEqual(timeouts,[47000,40000]);
});
function statusFixture({status='complete',needsRefresh=false,approved=true,selected=0,count=0}={}){
 const document=new JSDOM('<span id="discovery-company"></span><span id="discovery-markets"></span><span id="discovery-pipeline-count"></span><span id="discovery-status"></span><div id="company-discovery-status"></div><button id="run-company-discovery"></button><div id="company-candidates"></div>').window.document;
 const c={recoveredInterruptedRun:false,discoveryProgress:{phase:'complete'},window:{LeadIntelStrategyIntegrity:{status:()=>({current:approved,reason:'Review and approve the current Strategy.'})},LeadIntelTargeting:{isConfirmed:()=>true}},document,discovery:{status,needsRefresh,candidates:Array.from({length:count},()=>({})),rawResults:[],lastRunAt:'2026-11-01T08:00:00Z'},mainState:()=>({website:'https://seller.example',profile:{},market:{}}),selectedDiscoveryTarget:()=>5,loadMeta:()=>({}),$:id=>document.getElementById(id),DEFAULT_DISCOVERY_TARGET:10,renderCompanyReviewBatch(){},companySearchProgressText:()=> 'Researching 1/5',qualificationAssessment:()=>({eligible:true}),companyStrategyCurrent:()=>true,selectedProspects:()=>Array.from({length:selected},()=>({})),rankedCheckedCompanies:()=>[],companyExtractionMiss:()=>false,searchRunContextHtml:()=>'',esc:String};
 vm.runInNewContext(part('function renderStatus(){','function companyQualificationProfile(')+part('function renderCandidates(){','async function findDecisionMakers('),c);return {c,document};
}
test('stale successful run is labelled Needs recheck instead of Complete',()=>{const {c,document}=statusFixture({needsRefresh:true});c.renderStatus();assert.match(document.getElementById('discovery-status').textContent,/recheck/i);});
test('completed run with no checked shortlist cannot claim company completion',()=>{const {c,document}=statusFixture();c.renderStatus();assert.doesNotMatch(document.getElementById('discovery-status').textContent,/^complete$/i);assert.match(document.getElementById('discovery-status').textContent,/no.*checked|needs.*review/i);});
test('blocked search explains Strategy approval beside its disabled action',()=>{const {c,document}=statusFixture({needsRefresh:true,approved:false});c.renderStatus();assert.equal(document.getElementById('run-company-discovery').disabled,true);assert.match(document.getElementById('company-discovery-status').textContent,/review.*approve.*strategy/i);});
test('zero selected companies never claims selections remain in Buyers',()=>{const {c,document}=statusFixture({needsRefresh:true});c.renderCandidates();assert.doesNotMatch(document.getElementById('company-candidates').textContent,/selected companies remain in Buyers/i);assert.match(document.getElementById('company-candidates').textContent,/recheck/i);});
