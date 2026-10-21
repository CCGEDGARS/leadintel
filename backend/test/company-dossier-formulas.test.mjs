import test from 'node:test';
import assert from 'node:assert/strict';
import {runDossierResearch} from '../src/company-dossier.js';
const D=globalThis.LeadIntelCompanyDossier;
const connections=['openai','gemini'].map(provider=>({provider,model:'test'}));
const company={company:'Northwind',domain:'northwind.example',seller:{offer:'Logistics'},formulas:Array.from({length:30},(_,i)=>`"Northwind" exact buying signal ${i+1}`)};
const text='Alex Smith is Operations Director at Northwind.';
const common={connections,company,read:async()=>({text}),extract:async()=>({people:[{name:'Alex Smith',title:'Operations Director',sourceUrl:'https://northwind.example/team',quote:text}]})};
test('every one of 30 formulas is independently executed by both providers with durable actual coverage',async()=>{
 const calls=[];const result=await runDossierResearch({...common,search:async(c,q)=>{calls.push([c.provider,q]);return {web_search:true,results:[{url:'https://northwind.example/team'}]};}});
 assert.equal(result.status,'complete');assert.equal(calls.length,64);
 for(const p of ['openai','gemini'])for(const f of company.formulas)assert.equal(calls.filter(([provider,q])=>provider===p&&q.includes('Search formula: '+f+'\n')).length,1);
 assert.equal(result.coverage.formulaCount,30);assert.ok(result.coverage.providers.every(p=>p.completed===32&&p.pending===0));
 const saved=D.safe(JSON.parse(JSON.stringify(result)),company.domain);assert.equal(saved.status,'complete');assert.equal(saved.passes[0].searchFamilies.length,32);assert.equal(saved.plan.signature,result.plan.signature);
});
test('failed formula remains incomplete and resume reuses every successful query after a JSON save',async()=>{
 let failed=true;const calls=[];const search=async(c,q)=>{calls.push([c.provider,q]);if(failed&&q.includes('Search formula: '+company.formulas[29]+'\n'))throw Error('unavailable');return {web_search:true,results:[{url:'https://northwind.example/team'}]};};
 const extract=async()=>({...await common.extract(),gaps:['Supplier authority remains unconfirmed']});
 const partial=await runDossierResearch({...common,search,extract});assert.equal(partial.status,'partial');assert.equal(partial.coverage.providers[0].failed,1);assert.ok(partial.gaps.includes('formula-30 source search did not complete'));failed=false;calls.length=0;
 const resumed=await runDossierResearch({...common,search,extract,prior:D.safe(JSON.parse(JSON.stringify(partial)),company.domain)});
 assert.equal(resumed.status,'complete');assert.equal(calls.length,2);assert.ok(calls.every(([,q])=>q.includes('Search formula: '+company.formulas[29]+'\n')));
 assert.equal(resumed.gaps.includes('formula-30 source search did not complete'),false);assert.ok(resumed.gaps.includes('Supplier authority remains unconfirmed'));assert.ok(resumed.passes.every(p=>!p.gaps.includes('formula-30 source search did not complete')&&p.gaps.includes('Supplier authority remains unconfirmed')));
});
test('changing a formula invalidates completed research rather than returning stale coverage',async()=>{
 const search=async()=>({web_search:true,results:[{url:'https://northwind.example/team'}]});const prior=await runDossierResearch({...common,search});let calls=0;
 const changed={...company,formulas:[...company.formulas.slice(0,29),'new supplier investments']};assert.notEqual(D.contextKey(company),D.contextKey(changed));
 const result=await runDossierResearch({...common,company:changed,prior,search:async()=>{calls++;return search();}});assert.equal(calls,64);assert.notEqual(result.plan.signature,prior.plan.signature);
});
test('legacy complete provider flags cannot fabricate required formula execution',async()=>{
 const prior={...D.reconcile([] ,company),status:'complete',passes:connections.map(c=>({provider:c.provider,status:'complete',webSearch:true,sources:['https://northwind.example/team']}))};let calls=0;
 const result=await runDossierResearch({...common,prior,search:async()=>{calls++;return {web_search:true,results:[{url:'https://northwind.example/team'}]};}});assert.equal(calls,64);assert.equal(result.status,'complete');
 const forged=D.safe({...result,passes:result.passes.map(p=>({...p,searchFamilies:p.searchFamilies.slice(0,2)}))},company.domain);assert.equal(forged.status,'partial');
});
test('deadline retains executed formula checkpoints and resume does not repeat them',async()=>{
 let checkpoint,stall=true;const calls=[];
 const partial=await runDossierResearch({...common,timeoutMs:40,onCheckpoint:async r=>{checkpoint=JSON.parse(JSON.stringify(r));},search:async(c,q)=>{calls.push(q);if(stall&&q.includes('Search formula:'))return new Promise(()=>{});return {web_search:true,results:[{url:'https://northwind.example/team'}]};}});
 assert.equal(partial.status,'partial');assert.ok(checkpoint.passes.every(p=>p.searchFamilies.some(f=>f.status==='complete')));stall=false;calls.length=0;
 const result=await runDossierResearch({...common,prior:checkpoint,search:async(c,q)=>{calls.push(q);return {web_search:true,results:[{url:'https://northwind.example/team'}]};}});assert.equal(result.status,'complete');assert.equal(calls.length,60);
});
test('unsupported formula input fails explicitly before any provider call',async()=>{let calls=0;await assert.rejects(runDossierResearch({...common,company:{...company,formulas:[...company.formulas,'overflow']},search:async()=>{calls++;}}),/30/);assert.equal(calls,0);});
test('completed extraction batches survive a deadline and resume only the unextracted evidence tail',async()=>{
 const selected={...company,formulas:company.formulas.slice(0,12)};let stalled=true,extractions=0;const reads=[];
 const search=async(c,q)=>{const n=q.match(/signal (\d+)/)?.[1]||'team';return {web_search:true,results:[{url:'https://northwind.example/'+n}]};};
 const extract=async(c,prompt)=>{extractions++;const sources=JSON.parse(prompt.split('Sources: ')[1]);if(stalled&&sources.some(s=>s.url.endsWith('/12')))return new Promise(()=>{});return {people:[{name:'Alex Smith',title:'Operations Director',evidenceId:sources[0].passages[0].id}]};};
 const partial=await runDossierResearch({...common,company:selected,timeoutMs:200,search,extract});assert.equal(partial.status,'partial');assert.ok(partial.passes.every(p=>p.people.length>0&&p.extractedSources.length===8));
 stalled=false;extractions=0;const resumed=await runDossierResearch({...common,company:selected,prior:D.safe(JSON.parse(JSON.stringify(partial)),company.domain),search,extract,read:async url=>{reads.push(url);return {text};}});
 assert.equal(resumed.status,'complete');assert.equal(extractions,2);assert.equal(reads.length,5);assert.ok(reads.every(url=>!partial.passes[0].extractedSources.includes(url)));
});
test('cancellation preserves earlier settled query receipts but ignores late provider results',async()=>{
 const controller=new AbortController();let checkpoint,lateResolve,started=0,extractions=0;
 const run=runDossierResearch({...common,signal:controller.signal,onCheckpoint:async r=>{checkpoint=JSON.parse(JSON.stringify(r));},extract:async()=>{extractions++;},search:async(c,q)=>{started++;if(started===1)return {web_search:true,results:[{url:'https://northwind.example/team'}]};if(started===3){controller.abort();return {web_search:true,results:[{url:'https://northwind.example/late'}]};}return new Promise(resolve=>{lateResolve=resolve;});}});
 await assert.rejects(run);const saved=JSON.stringify(checkpoint);lateResolve?.({web_search:true,results:[{url:'https://northwind.example/late'}]});await new Promise(resolve=>setImmediate(resolve));assert.equal(JSON.stringify(checkpoint),saved);assert.equal(checkpoint.passes.length,1);assert.equal(checkpoint.passes[0].searchFamilies.filter(f=>f.status==='complete').length,1);assert.equal(extractions,0);
});
test('OpenAI dossier search reports actual tool execution rather than configured tool availability',async()=>{
 const {searchDossierProvider}=await import('../src/dossier-provider-search.js');
 const connection={provider:'openai',apiKey:'test',model:'test'};
 const unexecuted=await searchDossierProvider(connection,'Northwind projects',{fetchImpl:async()=>Response.json({output_text:'{"results":[]}',output:[]})});assert.equal(unexecuted.web_search,false);
 const executed=await searchDossierProvider(connection,'Northwind projects',{fetchImpl:async()=>Response.json({output_text:'{"results":[]}',output:[{type:'web_search_call',status:'completed',action:{sources:[]}}]})});assert.equal(executed.web_search,true);assert.equal(executed.results.length,0);
});
test('query substitution, missing execution timestamps and stripped source evidence cannot claim completion',async()=>{
 const result=await runDossierResearch({...common,search:async()=>({web_search:true,results:[{url:'https://northwind.example/team'}]})});
 for(const mutate of [p=>({...p,searchFamilies:p.searchFamilies.map(f=>f.kind==='formula'?{...f,query:'CONTACT ROUTES'}:f)}),p=>({...p,searchFamilies:p.searchFamilies.map(f=>({...f,completedAt:''}))}),p=>({...p,people:[],facts:[],channels:[]})]){
  const saved=D.safe({...result,passes:result.passes.map(mutate)},company.domain);assert.equal(saved.status,'partial');assert.equal(D.coverageComplete(saved,company),false);
 }
});
test('an Anthropic web tool error is not a successfully completed grounded search',async()=>{
 const {searchAnthropicWeb}=await import('../src/dossier-provider-search.js');const result=await searchAnthropicWeb({apiKey:'test',model:'test',query:'Northwind projects',fetchImpl:async()=>Response.json({content:[{type:'server_tool_use',name:'web_search'},{type:'web_search_tool_result',content:{type:'web_search_tool_result_error',error_code:'unavailable'}}],stop_reason:'end_turn'})});assert.equal(result.web_search,false);assert.deepEqual(result.results,[]);
});
test('actual extractor failure and reused source traces survive safe checkpoints without provider secrets',async()=>{
 const result=await runDossierResearch({...common,company:{...company,formulas:[]},search:async()=>({web_search:true,results:[{url:'https://northwind.example/blocked'},{url:'https://northwind.example/team'}]}),read:async url=>{if(url.endsWith('/blocked'))throw Object.assign(Error('Bearer top-secret'),{researchTrace:[{provider:'scrapling',status:'failed',results:0,failureKind:'authentication',code:'SCRAPLING_AUTH_FAILED',httpStatus:401,reason:'Bearer top-secret',elapsedMs:12,timeoutMs:100}]});return {text,researchTrace:[{provider:'direct',status:'succeeded',results:1}]};}});
 const saved=D.safe(JSON.parse(JSON.stringify(result)),company.domain);assert.equal(saved.status,'complete');
 const failed=saved.passes[0].sourceReads.find(r=>r.url.endsWith('/blocked'));assert.equal(failed.status,'failed');assert.equal(failed.researchTrace[0].httpStatus,401);assert.equal(failed.researchTrace[0].code,'SCRAPLING_AUTH_FAILED');assert.equal(failed.researchTrace[0].failureKind,'authentication');assert.doesNotMatch(JSON.stringify(saved),/top-secret|Bearer/);
 const reused=saved.passes[1].sourceReads.find(r=>r.url.endsWith('/team'));assert.equal(reused.reused,true);assert.equal(reused.researchTrace[0].provider,'direct');assert.equal(saved.passes[0].sourceReads.find(r=>r.url.endsWith('/team')).reused,false);
});
test('resume repairs a completed label whose execution receipt is missing',async()=>{
 const search=async()=>({web_search:true,results:[{url:'https://northwind.example/team'}]});const prior=await runDossierResearch({...common,search});prior.passes[0].searchFamilies[31].completedAt='';const saved=D.safe(JSON.parse(JSON.stringify(prior)),company.domain);let calls=0;
 const result=await runDossierResearch({...common,prior:saved,search:async()=>{calls++;return search();}});assert.equal(result.status,'complete');assert.equal(calls,1);
});
