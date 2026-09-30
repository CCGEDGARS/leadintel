const test=require('node:test');
const assert=require('node:assert/strict');
const D=require('../discovery-engine.js');
const Ref=require('../reference-customers.js');
const profile={website:'https://ercon.lv',targetMarkets:'Sweden',idealCustomer:'industrial manufacturers forestry machinery',priorityOffers:'custom machinery steel components'};
const evidence={url:'https://nordic.example/about',sourceDomain:'nordic.example',title:'Nordic manufacturing',text:'Nordic is a manufacturer in Sweden producing forestry machinery and industrial steel components.'};
test('fit score depends on usable evidence and one source caps certainty',()=>{
 assert.equal(D.companyFitSummary({evidence:[]},profile).fitScore,null);
 const result=D.companyFitSummary({company:'Nordic',domain:'nordic.example',evidence:[evidence]},profile);
 assert.ok(result.fitScore>0&&result.fitScore<=70);
 assert.match(result.fitDescription,/machinery|industrial|components/);
});
test('reference type and business reason survive normalization',()=>{
 const rows=Ref.normalizeImportedRows([{Company:'Nordic',Website:'https://nordic.example',referenceType:'ideal_example',reason:'Needs custom machinery'}]);
 const saved=Ref.normalizeReferenceState({rows});
 assert.equal(saved.rows[0].referenceType,'ideal_example');
 assert.equal(saved.rows[0].reason,'Needs custom machinery');
});
test('reference domains are excluded from prospective company evidence',()=>{
 const market={signals:[]};
 const rows=[{...evidence,company:'Nordic',domain:'nordic.example',market:'Sweden'}];
 assert.deepEqual(D.buildPotentialCompanyCandidates(rows,{...profile,referenceDomains:['nordic.example']},market),[]);
});
test('fit score and explanation survive saved shortlist reload',()=>{
 const item={company:'Nordic',domain:'nordic.example',website:'https://nordic.example',evidence:[evidence],qualificationGaps:['No signal confirmed'],fitScore:65,fitDescription:'Matches machinery.'};
 const saved=D.normalizeDiscoveryState({...D.DEFAULT_DISCOVERY_STATE,potentialMatches:[item]});
 assert.equal(saved.potentialMatches[0].fitScore,65);
 assert.equal(saved.potentialMatches[0].fitDescription,'Matches machinery.');
});
const fs=require('node:fs');
const vm=require('node:vm');
test('new company search validates count and dispatches general full research without changing targets',()=>{
 const source=fs.readFileSync(require.resolve('../reference-customer-ui.js'),'utf8');
 const handler=source.match(/querySelector\('#targets-find-new'\)\?\.addEventListener\('click',\(\)=>\{([\s\S]*?)\n    \}\);/)[1];
 const fields={'#targets-find-count':{value:'20'},'#targets-find-custom':{value:'10',focus(){}},'#target-company-status':{textContent:''}};
 const data={};const events=[];let closed=0;
 const main={targetMarkets:['Sweden'],targetCompanies:[{companyName:'Sandvik'}]};
 const context={modal:{querySelector:s=>fields[s]},readState:()=>main,localStorage:{getItem:k=>data[k]||null,setItem:(k,v)=>data[k]=v},root:{dispatchEvent:e=>events.push(e)},CustomEvent:class{constructor(type,options){this.type=type;this.detail=options?.detail}},close:()=>closed++};
 vm.runInNewContext(`(()=>{${handler}})()`,context);
 assert.equal(JSON.parse(data.leadintel_customer_v2_discovery_meta).targetCount,20);
 assert.equal(events.at(-1).detail.source,'target-discovery');assert.equal(events.at(-1).detail.savingMode,false);
 assert.equal(main.targetCompanies.length,1);assert.equal(closed,1);
 fields['#targets-find-count'].value='custom';fields['#targets-find-custom'].value='0';
 vm.runInNewContext(`(()=>{${handler}})()`,context);assert.equal(closed,1);assert.match(fields['#target-company-status'].textContent,/whole number/);
});
test('discovery controls restore a saved preset or custom count on mount',()=>{
 const source=fs.readFileSync(require.resolve('../discovery-ui.js'),'utf8');
 const restore=source.match(/function restoreDiscoveryTarget\(\)\{([^\n]*)\}/)[0];
 const control={value:'5'},custom={};let meta={targetCount:20,targetMode:'preset'};
 const context={loadMeta:()=>meta,normalizedDiscoveryTarget:n=>Number(n)||10,$:id=>id==='discovery-target-count'?control:custom};
 vm.runInNewContext(restore+';restoreDiscoveryTarget();',context);assert.equal(control.value,'20');assert.equal(custom.hidden,true);
 meta={targetCount:17,targetMode:'custom'};vm.runInNewContext('restoreDiscoveryTarget();',context);assert.equal(control.value,'custom');assert.equal(custom.value,'17');assert.equal(custom.hidden,false);
});
