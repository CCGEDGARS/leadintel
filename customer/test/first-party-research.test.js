const test=require('node:test');
const assert=require('node:assert/strict');
const R=require('../first-party-research.js');
const AI=require('../reference-customer-ai.js');
const fs=require('node:fs');
const evidence='We manufacture lifting equipment and industrial machinery for factories in Sweden. Our production includes cranes, steel assemblies and custom machines. ';
test('internal page selection finds Swedish capabilities and buyers, excludes foreign and unsafe links',()=>{
 const page={text:'[Tillverkning](/tillverkning) [Kontakt](/kontakt) [Ledning](/ledning) [Privacy](/privacy)',links:['https://evil.example/products','javascript:alert(1)','https://user:pass@company.se/team','/products?login=yes','/produkte.pdf']};
 assert.deepEqual(R.selectInternalLinks(page,'https://company.se/','company',1),['https://company.se/tillverkning']);
 assert.deepEqual(R.selectInternalLinks(page,'https://company.se/','buyers',2),['https://company.se/kontakt','https://company.se/ledning']);
});
test('reads discovered pages once, keeps actual URLs and reports partial extraction without invented pages',async()=>{
 const requests=[];
 const result=await R.collectWebsiteEvidence({website:'https://company.se/',fetchImpl:async(_,options)=>{
   const body=JSON.parse(options.body);requests.push(body);assert.deepEqual(body.formats,['markdown','links']);
   if(body.url.endsWith('/contact'))return {ok:false,status:503,json:async()=>({})};
   return {ok:true,json:async()=>({data:{markdown:evidence,links:body.url.endsWith('.se/')?['/products','/contact']:[],metadata:{sourceURL:body.url,title:'Company'}}})};
 }});
 assert.equal(requests.length,3);assert.equal(result.pages.length,2);assert.equal(result.coverage.partial,true);assert.equal(result.issues[0].url,'https://company.se/contact');
 assert.equal(result.pages[1].url,'https://company.se/products');
});
test('cross-domain redirects and readable blocker pages cannot verify a company',async()=>{
 for(const data of [{markdown:evidence,metadata:{sourceURL:'https://directory.example/company'}},{markdown:'Verify you are human. '.repeat(8)}])await assert.rejects(R.collectWebsiteEvidence({website:'https://company.se/',fetchImpl:async()=>({ok:true,json:async()=>({data})})}),/outside|Insufficient/);
});
test('cancelled research stops before making another wave of requests',async()=>{
 const controller=new AbortController();controller.abort();let calls=0;
 await assert.rejects(R.collectWebsiteEvidence({website:'https://company.se/',signal:controller.signal,fetchImpl:async(_,options)=>{calls++;assert.equal(options.signal.aborted,true);throw options.signal.reason;}}));assert.equal(calls,0);
});
test('cancellation ends research even if an upstream promise ignores its signal',async()=>{
 const controller=new AbortController();const pending=R.collectWebsiteEvidence({website:'https://company.se/',signal:controller.signal,fetchImpl:()=>new Promise(()=>{})});controller.abort();await assert.rejects(pending);
});
test('weak HTTP 200 extraction invokes Scrapling while authentication failures remain visible',async()=>{
 const vm=require('node:vm'),source=fs.readFileSync(require.resolve('../firecrawl-workspace-router.js'),'utf8').replace(/^export .*;$/gm,'');
 const requests=[];let primaryStatus=200;
 const context={Headers,Response,URL,console,window:{location:{href:'https://leadintel.ccgroup.lv/customer/'},LeadIntelServerBridge:{session:{authenticated:true},workspace:{id:'ws'}},fetch:async(url)=>{requests.push(url);return new Response(JSON.stringify({data:{markdown:String(url).includes('/scrapling/')?evidence:'Verify you are human'}}),{status:String(url).includes('/scrapling/')?200:primaryStatus});}}};
 vm.runInNewContext(source,context);const options={method:'POST',body:JSON.stringify({url:'https://company.se/'})};
 const recovered=await context.window.fetch('https://apollo-proxy.edgars-7e7.workers.dev/firecrawl-scrape',options);assert.equal(recovered.headers.get('X-LeadIntel-Extractor'),'scrapling');assert.equal(requests.length,2);
 requests.length=0;primaryStatus=401;const denied=await context.window.fetch('https://apollo-proxy.edgars-7e7.workers.dev/firecrawl-scrape',options);assert.equal(denied.status,401);assert.equal(requests.length,1);
});
test('reference prompt contains multiple pages and validates quote against its precise source',()=>{
 const row={id:'a',website:'https://company.se/',text:'Generic home',sources:[{url:'https://company.se/products',text:evidence},{url:'https://company.se/team',text:'Our management team is led by experienced industrial engineers.'}]};
 const prompt=AI.buildReferenceCustomerPrompt([row]);assert.match(prompt,/company.se\/products/);assert.match(prompt,/We manufacture lifting equipment/);
 const company={id:'a',broadIndustry:'Industrial machinery',productionModel:'Manufacturer',sourceEvidence:[{field:'broadIndustry',quote:'We manufacture lifting equipment',url:'https://company.se/products'},{field:'productionModel',quote:'We manufacture lifting equipment',url:'https://company.se/team'}]};
 const parsed=AI.parseReferenceCustomerAnalysis(JSON.stringify({companies:[company]}),['a'],[row]).analyses.a;assert.equal(parsed.broadIndustry,'Industrial machinery');assert.equal(parsed.productionModel,'');
});
test('large reference uploads retain bounded evidence per page and fit the provider input budget',()=>{
 const rows=Array.from({length:24},(_,i)=>({id:String(i),website:`https://company${i}.se/`,sources:Array.from({length:5},(_,j)=>({url:`https://company${i}.se/products/${j}`,text:evidence.repeat(100)}))}));
 const prompt=AI.buildReferenceCustomerPrompt(rows);assert.ok(prompt.length<80000);assert.ok(prompt.includes('company23.se/products/4'));
});
test('local query plans reject unsupported markets, duplicate queries and malformed responses',()=>{
 const queries=R.parseQueryPlan(JSON.stringify({queries:[{market:'Sweden',query:'Sweden industrial equipment manufacturers',language:'en'},{market:'Sweden',query:'Sverige tillverkare industriutrustning',language:'sv'},{market:'Germany',query:'German manufacturers',language:'de'},{market:'Sweden',query:'Sverige tillverkare industriutrustning',language:'sv'}]}),['Sweden']);assert.equal(queries.length,2);assert.equal(queries[1].language,'sv');assert.deepEqual(R.parseQueryPlan('not json',['Sweden']),[]);
});
test('local planning uses existing authenticated AI connection and does not require a new provider',async()=>{
 const queries=await R.planLocalQueries({markets:['Sweden'],workspaceId:'ws',fetchImpl:async(url,options)=>{assert.match(url,/api\/ai\/generate\?workspace_id=ws/);assert.equal(options.credentials,'include');assert.match(JSON.parse(options.body).prompt,/native business language/);return {ok:true,json:async()=>({text:JSON.stringify({queries:[{market:'Sweden',language:'sv',query:'Sverige tillverkare industriutrustning'}]})})};}});assert.equal(queries.length,1);
});
test('buyer search verifies live company content before Apollo and does not manufacture buying intent',()=>{
 const source=fs.readFileSync(require.resolve('../discovery-ui.js'),'utf8');const start=source.indexOf('async function searchDecisionMakers'),end=source.indexOf('function personKey',start);const block=source.slice(start,end<0?undefined:end);
 assert.ok(block.indexOf('collectWebsiteEvidence')<block.indexOf('searchBuyerPublicPages'));assert.match(block,/purpose:'buyers'/);assert.doesNotMatch(block,/candidate\.qualified\s*=\s*true/);
});
test('country selector follows a discovered English page to product evidence within budget',async()=>{
 const seen=[];const result=await R.collectWebsiteEvidence({website:'https://equipment.example/',maxPages:3,fetchImpl:async(_,options)=>{const {url}=JSON.parse(options.body);seen.push(url);const locale=url.endsWith('/en');return {ok:true,json:async()=>({data:{markdown:url.endsWith('/products')?evidence:'Choose your country and regional customer contacts. '.repeat(4),links:url.endsWith('.example/')?['/en','/en/contact']:locale?['/en/products']:[],metadata:{sourceURL:url}}})};}});
 assert.ok(seen.includes('https://equipment.example/en/products'));assert.equal(result.pages.length,3);assert.equal(new Set(seen).size,seen.length);
});
test('product evidence beyond long navigation survives the bounded prompt budget',()=>{const text=Array.from({length:100},(_,i)=>`[Country ${i}](/region-${i})`).join('\n')+'\nWe manufacture hydraulic cranes and welded steel assemblies for industrial machinery.';const bounded=R.boundedSources([{url:'https://example.com/products',text}],180);assert.match(bounded[0].text,/manufacture hydraulic cranes/);assert.ok(bounded[0].text.length<=180);});
