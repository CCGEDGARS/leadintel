const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const source=fs.readFileSync(require.resolve('../discovery-ui.js'),'utf8');
function section(start,end){return source.slice(source.indexOf(start),source.indexOf(end,source.indexOf(start)));}
test('company search starts at five and migrates the old default once without overriding later choices',()=>{
 let meta={targetCount:10,targetMode:'preset'},control={value:'10'},custom={};
 const context={loadMeta:()=>meta,saveMeta:value=>{meta=value;},$:id=>id==='discovery-target-count'?control:custom};
 vm.createContext(context);vm.runInContext(section('const DEFAULT_DISCOVERY_TARGET=','function selectedDiscoveryTarget(')+section('function restoreDiscoveryTarget(){','function renderDiscoveryEstimate('),context);
 context.restoreDiscoveryTarget();assert.equal(control.value,'5');assert.equal(meta.targetCount,5);
 meta.targetCount=10;context.restoreDiscoveryTarget();assert.equal(control.value,'10');
 meta={targetCount:17,targetMode:'custom'};context.restoreDiscoveryTarget();assert.equal(control.value,'custom');assert.equal(custom.value,'17');
 meta={};context.restoreDiscoveryTarget();assert.equal(control.value,'5');
});
test('market evidence waiting reports elapsed time without claiming additional checks',()=>{
 const context={discoveryProgress:{phase:'searching',completed:1,total:6,startedAt:1000},Date:{now:()=>31000}};
 vm.createContext(context);vm.runInContext(section('function companySearchProgressText(){','async function cancelCompanyDiscovery('),context);
 assert.match(context.companySearchProgressText(),/1\/6/);assert.match(context.companySearchProgressText(),/30s/);assert.match(context.companySearchProgressText(),/Waiting for search providers/);
 context.discoveryProgress={phase:'searching',completed:6,total:6,startedAt:1000};assert.doesNotMatch(context.companySearchProgressText(),/Waiting/);
});
test('pending market searches refresh waiting feedback and clear the timer on completion',async()=>{
 let finish,tick,timerCleared=false,renders=0;
 const context={Date,discoveryProgress:{},window:{LeadIntelTaskCentre:{update(){}}},activeDiscoveryTaskId:'run',DISCOVERY_SEARCH_CONCURRENCY:1,throwIfDiscoveryRunAborted(){},renderDiscoverySafely(){renders++;},discoveryBudgetExhausted:()=>false,firecrawlCompanySearch:()=>new Promise(resolve=>{finish=resolve;}),discovery:{funnel:{marketSearchesCompleted:0},rawResults:[]},discoveryEvidenceUrls:new Set(),saveDiscovery(){},setTimeout:fn=>{tick=fn;return 1;},clearTimeout:()=>{timerCleared=true;}};
 vm.createContext(context);vm.runInContext(section('async function runDiscoverySearchBatch(','function setCompanyExtraction('),context);
 const run=context.runDiscoverySearchBatch([{query:'test'}],'searching',new AbortController().signal);
 const before=renders;tick();assert.equal(renders,before+1);assert.ok(context.discoveryProgress.startedAt);
 finish([]);await run;assert.equal(timerCleared,true);assert.equal(context.discoveryProgress.completed,1);
});
