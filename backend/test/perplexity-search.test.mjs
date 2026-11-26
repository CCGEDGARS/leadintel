import test from 'node:test';
import assert from 'node:assert/strict';
import {storageDb} from './workspace-storage-fixture.mjs';
import {requestPerplexitySearch,PERPLEXITY_RECEIPT_EVENT} from '../src/perplexity-request.js';
import {createBuyerSourceSearch} from '../src/buyer-source-search.js';

// Owner decision, 26 Nov 2026: Perplexity searches, Firecrawl reads pages, the AI engine reasons. A workspace that
// connected its own Perplexity key gets its public research searches from Perplexity first; one request carries one
// query and costs 0.005 USD when answered, failed requests are not billed (Perplexity pricing, 26 Nov 2026). Without a
// key every search path behaves exactly as before.
const W='storage-w1',KEY={apiKey:'pplx-fixture'};
const PPLX='https://api.perplexity.ai/search',FIRECRAWL='https://api.firecrawl.dev/v2/search';
const results=n=>Array.from({length:n},(_,i)=>({title:`Page ${i}`,url:`https://example.com/p${i}`,snippet:`Anna Andersson is Head of Procurement at Example. Item ${i}. `+'x'.repeat(400),date:'2026-10-01',last_updated:'2026-11-20'}));
const receipts=DB=>DB.raw.prepare('SELECT metadata_json FROM audit_events WHERE workspace_id=? AND event_type=? ORDER BY rowid').all(W,PERPLEXITY_RECEIPT_EVENT).map(row=>JSON.parse(row.metadata_json));
const firecrawlRows=[{url:'https://example.com/team',title:'Team',description:'People',markdown:'# Team'}];
const keyRequired=async()=>{throw Object.assign(Error('Connect your own Perplexity API key in Settings.'),{status:409,code:'CUSTOMER_SERVICE_KEY_REQUIRED'});};
const route=({perplexity,firecrawl,sent})=>async(url,init)=>{const toPerplexity=String(url).startsWith(PPLX);sent?.push(toPerplexity?'perplexity':'firecrawl');return toPerplexity?perplexity(init):firecrawl(init);};

test('one Perplexity search sends the query and result count with the workspace key and leaves a priced receipt',async t=>{
 const DB=storageDb();t.after(()=>DB.raw.close());const sent=[];
 const response=await requestPerplexitySearch({DB},W,{credential:KEY,query:'Example A/S direktør',maxResults:8,purpose:'buyer_research',fetchImpl:async(url,init)=>{sent.push({url,init});return Response.json({results:results(3),id:'r1'});}});
 assert.equal(response.status,200);
 assert.equal(sent.length,1);assert.equal(sent[0].url,PPLX);assert.equal(sent[0].init.method,'POST');
 assert.equal(sent[0].init.headers.Authorization,'Bearer pplx-fixture');
 assert.deepEqual(JSON.parse(sent[0].init.body),{query:'Example A/S direktør',max_results:8});
 const [receipt,...more]=receipts(DB);assert.equal(more.length,0);
 assert.equal(receipt.purpose,'buyer_research');assert.equal(receipt.outcome,'succeeded');assert.equal(receipt.httpStatus,200);
 assert.equal(receipt.requestedResults,8);assert.equal(receipt.results,3);assert.equal(receipt.listPriceUsdMicros,5000);
 assert.doesNotMatch(JSON.stringify(receipts(DB)),/pplx-fixture|Andersson/,'a receipt keeps neither the key nor the page text');
});

test('a request never asks Perplexity for more than 20 results',async()=>{
 let body;await requestPerplexitySearch({},W,{credential:KEY,query:'q',maxResults:50,fetchImpl:async(url,init)=>{body=JSON.parse(init.body);return Response.json({results:[]});}});
 assert.equal(body.max_results,20);
});

test('a rate-limited request waits for Retry-After once, at most two seconds, and only the answered request is priced',async t=>{
 const DB=storageDb();t.after(()=>DB.raw.close());let calls=0;const waits=[];
 const response=await requestPerplexitySearch({DB},W,{credential:KEY,query:'q',maxResults:5,sleep:async ms=>{waits.push(ms);},fetchImpl:async()=>{calls++;return calls===1?new Response('{"error":{"message":"rate limit"}}',{status:429,headers:{'Retry-After':'30'}}):Response.json({results:results(2)});}});
 assert.equal(response.status,200);assert.equal(calls,2);assert.deepEqual(waits,[2000]);
 assert.deepEqual(receipts(DB).map(r=>[r.outcome,r.listPriceUsdMicros]),[['rate_limited_upstream',0],['succeeded',5000]]);
 let again=0;const limited=await requestPerplexitySearch({},W,{credential:KEY,query:'q',sleep:async()=>{},fetchImpl:async()=>{again++;return new Response('{}',{status:429});}});
 assert.equal(limited.status,429);assert.equal(again,2,'a second rate limit is returned, not retried again');
});

test('an exhausted Perplexity account is recorded as a credit failure and costs nothing',async t=>{
 const DB=storageDb();t.after(()=>DB.raw.close());
 const response=await requestPerplexitySearch({DB},W,{credential:KEY,query:'q',fetchImpl:async()=>new Response('{"error":{"message":"Insufficient credits"}}',{status:402})});
 assert.equal(response.status,402);
 assert.deepEqual(receipts(DB).map(r=>[r.outcome,r.listPriceUsdMicros]),[['credits_exhausted',0]]);
 assert.deepEqual(DB.raw.prepare("SELECT event_type FROM audit_events WHERE workspace_id=? AND entity_type='provider_credit' AND entity_id='perplexity'").all(W).map(r=>r.event_type),['provider.credit_exhausted']);
});

test('a request that never gets an answer leaves an unpriced receipt and throws',async t=>{
 const DB=storageDb();t.after(()=>DB.raw.close());
 await assert.rejects(requestPerplexitySearch({DB},W,{credential:KEY,query:'q',fetchImpl:async()=>{throw new TypeError('fetch failed');}}),/fetch failed/);
 assert.deepEqual(receipts(DB).map(r=>[r.outcome,r.listPriceUsdMicros]),[['network_error',0]]);
});

test('no Perplexity request is sent without a workspace key',async()=>{
 await assert.rejects(requestPerplexitySearch({},W,{credential:{},query:'q',fetchImpl:()=>assert.fail('Nothing may be sent')}),/Perplexity connection is required/);
});

test('with a Perplexity key the shared search answers from Perplexity: page text as a search excerpt, never a source read',async()=>{
 const trace=[],sent=[];
 const search=createBuyerSourceSearch({},'w',{observe:r=>trace.push(r),credential:async()=>assert.fail('Firecrawl is not needed when Perplexity answers'),perplexityCredential:async(env,workspace,provider)=>{assert.equal(provider,'perplexity');return KEY;},grounded:async()=>assert.fail('No grounded fallback expected'),fetchImpl:async(url,init)=>{sent.push([String(url),JSON.parse(init.body)]);return Response.json({results:[...results(2),{title:'No address',url:'',snippet:'x'}]});}});
 const rows=await search('"Anna Andersson" Example');
 assert.deepEqual(sent,[[PPLX,{query:'"Anna Andersson" Example',max_results:8}]]);
 assert.equal(rows.length,2,'a result without a web address is dropped');assert.deepEqual(rows.searchProviders,['perplexity']);
 const [row]=rows;
 assert.equal(row.url,'https://example.com/p0');assert.equal(row.title,'Page 0');assert.equal(row.searchProvider,'perplexity');assert.equal(row.buyerSource,'perplexity');
 assert.equal(row.evidenceKind,'search_excerpt');assert.equal('sourceRead' in row,false);
 assert.ok(row.markdown.startsWith('Anna Andersson is Head of Procurement')&&row.markdown.length>300);
 assert.equal(row.description,row.markdown.slice(0,300));
 assert.equal(row.publishedDate,'2026-10-01');assert.equal(row.lastUpdated,'2026-11-20');
 assert.deepEqual(trace,[{provider:'perplexity',operation:'search',status:'succeeded',results:2}]);
 sent.length=0;await search('wide',{limit:30});assert.equal(sent[0][1].max_results,20);
});

test('without a Perplexity key the shared search sends what it sends today and reports nothing about Perplexity',async()=>{
 for(const lookup of [keyRequired,undefined]){
  const trace=[],sent=[];let lookups=0;
  const search=createBuyerSourceSearch({},'w',{observe:r=>trace.push(r),credential:async()=>({apiKey:'fixture'}),...(lookup?{perplexityCredential:async(...args)=>{lookups++;return lookup(...args);}}:{}),grounded:async()=>assert.fail('No fallback expected'),fetchImpl:async(url,init)=>{sent.push([String(url),JSON.parse(init.body)]);return Response.json({success:true,data:firecrawlRows});}});
  const rows=await search('Example procurement');await search('second');
  assert.deepEqual(sent.map(([url])=>url),[FIRECRAWL,FIRECRAWL]);assert.equal(sent[0][1].query,'Example procurement');assert.equal(sent[0][1].limit,8);
  assert.deepEqual(rows.searchProviders,['firecrawl']);assert.equal(rows[0].searchProvider,'firecrawl');
  assert.deepEqual(trace,[{provider:'firecrawl',operation:'search',status:'succeeded',results:1},{provider:'firecrawl',operation:'search',status:'succeeded',results:1}]);
  if(lookup)assert.equal(lookups,1,'a missing key is looked up once per search owner');
 }
});

test('a Perplexity failure hands that query to Firecrawl and the next query still asks Perplexity first',async()=>{
 const trace=[],sent=[];let down=true;
 const search=createBuyerSourceSearch({},'w',{observe:r=>trace.push(r),credential:async()=>({apiKey:'fixture'}),perplexityCredential:async()=>KEY,grounded:async()=>assert.fail('No grounded fallback expected'),fetchImpl:route({sent,perplexity:()=>down?new Response('{}',{status:503}):Response.json({results:results(1)}),firecrawl:()=>Response.json({success:true,data:firecrawlRows})})});
 assert.equal((await search('first'))[0].searchProvider,'firecrawl');
 down=false;assert.equal((await search('second'))[0].searchProvider,'perplexity');
 assert.deepEqual(sent,['perplexity','firecrawl','perplexity']);
 assert.ok(trace.some(r=>r.provider==='perplexity'&&r.status==='failed'&&r.httpStatus===503));
});

test('a rejected or exhausted Perplexity key is not asked again for every query',async()=>{
 for(const status of [401,402,403]){
  const sent=[];const search=createBuyerSourceSearch({},'w',{credential:async()=>({apiKey:'fixture'}),perplexityCredential:async()=>KEY,grounded:async()=>assert.fail('No grounded fallback expected'),fetchImpl:route({sent,perplexity:()=>new Response('{}',{status}),firecrawl:()=>Response.json({success:true,data:firecrawlRows})})});
  await search('first');await search('second');
  assert.deepEqual(sent,['perplexity','firecrawl','firecrawl'],`HTTP ${status}`);
 }
});

test('an empty Perplexity answer falls through to Firecrawl and then grounded search as today',async()=>{
 const sent=[];let grounded=0;
 const search=createBuyerSourceSearch({},'w',{credential:async()=>({apiKey:'fixture'}),perplexityCredential:async()=>KEY,grounded:async()=>{grounded++;return {status:'complete',results:[{url:'https://news.example/a',description:'Anna'}]};},fetchImpl:route({sent,perplexity:()=>Response.json({results:[]}),firecrawl:()=>Response.json({success:true,data:[]})})});
 const rows=await search('rare');
 assert.deepEqual(sent,['perplexity','firecrawl']);assert.equal(grounded,1);assert.equal(rows[0].searchProvider,'grounded');
});

test('a successful empty Perplexity answer stays an empty success when no other provider can answer',async()=>{
 const search=createBuyerSourceSearch({},'w',{credential:async()=>{throw Error('not configured');},perplexityCredential:async()=>KEY,grounded:async()=>{throw Error('offline');},fetchImpl:async()=>Response.json({results:[]})});
 const rows=await search('nobody');assert.equal(rows.length,0);assert.deepEqual(rows.searchProviders,['perplexity']);
});

test('a diversified search merges grounded results with Perplexity rows without spending Firecrawl',async()=>{
 const sent=[];
 const search=createBuyerSourceSearch({},'w',{credential:async()=>assert.fail('Firecrawl is not needed'),perplexityCredential:async()=>KEY,grounded:async()=>({status:'complete',results:[{url:'https://news.example/a',description:'Anna'},{url:'https://example.com/p0',description:'duplicate'}]}),fetchImpl:async url=>{sent.push(String(url));return Response.json({results:results(2)});}});
 const rows=await search('Anna',{diversify:true});
 assert.deepEqual(sent,[PPLX]);assert.deepEqual(rows.searchProviders,['perplexity','grounded']);
 assert.deepEqual(rows.map(r=>r.url).sort(),['https://example.com/p0','https://example.com/p1','https://news.example/a']);
 assert.equal(rows.find(r=>r.url==='https://example.com/p0').searchProvider,'perplexity','the Perplexity row wins over a grounded duplicate');
});

// Live run 26 Nov 2026 (nordisk-staal.dk): 40 Perplexity rows for site:linkedin.com/in/ searches were titled only
// "<name> | LinkedIn" (no role, no company in any title), so the headline reader that turns "Name - Role - Company"
// into a buyer found nobody. Firecrawl titles carry the headline (Firecrawl run 6774ff16: 39 rows, every one in parts,
// 26 with a role). LinkedIn profile searches therefore stay with Firecrawl first, with Perplexity as their fallback.
test('LinkedIn profile searches ask Firecrawl first while other searches still ask Perplexity first',async()=>{
 const sent=[];
 const search=createBuyerSourceSearch({},'w',{credential:async()=>({apiKey:'fixture'}),perplexityCredential:async()=>KEY,grounded:async()=>assert.fail('No grounded fallback expected'),fetchImpl:route({sent,perplexity:()=>Response.json({results:results(2)}),firecrawl:()=>Response.json({success:true,data:[{url:'https://www.linkedin.com/in/anna',title:'Anna Andersson - CEO - Example A/S | LinkedIn',description:'CEO at Example A/S'}]})})});
 const rows=await search('site:linkedin.com/in/ "Example A/S" ("CEO" OR "Managing Director")');
 assert.deepEqual(sent,['firecrawl']);assert.equal(rows[0].searchProvider,'firecrawl');
 sent.length=0;assert.equal((await search('site:example.com (team OR kontakt)'))[0].searchProvider,'perplexity');assert.deepEqual(sent,['perplexity']);
});

test('a LinkedIn profile search uses Perplexity when Firecrawl cannot answer it',async()=>{
 for(const firecrawl of ['missing','empty']){
  const sent=[];
  const search=createBuyerSourceSearch({},'w',{credential:firecrawl==='missing'?async()=>{throw Error('not configured');}:async()=>({apiKey:'fixture'}),perplexityCredential:async()=>KEY,grounded:async()=>assert.fail('No grounded fallback expected'),fetchImpl:route({sent,perplexity:()=>Response.json({results:results(1)}),firecrawl:()=>Response.json({success:true,data:[]})})});
  const rows=await search('site:linkedin.com/in/ "Example A/S" ("CEO")');
  assert.equal(rows[0].searchProvider,'perplexity',firecrawl);
  assert.deepEqual(sent,firecrawl==='missing'?['perplexity']:['firecrawl','perplexity'],firecrawl);
 }
});

test('cancellation stops Perplexity work instead of becoming a provider failure',async()=>{
 const parent=new AbortController();parent.abort(Error('Research scope ended'));
 const ended=createBuyerSourceSearch({},'w',{signal:parent.signal,perplexityCredential:async()=>assert.fail('Canceled scopes cannot request a credential'),credential:async()=>assert.fail('Canceled scopes cannot request a credential'),grounded:async()=>assert.fail('Canceled scopes cannot start a fallback')});
 await assert.rejects(ended('person'),/Research scope ended/);
 let canceled=false;const sent=[];
 const search=createBuyerSourceSearch({},'w',{guard:async()=>{if(canceled)throw Error('Canceled');},credential:async()=>({apiKey:'fixture'}),perplexityCredential:async()=>KEY,grounded:async()=>assert.fail('No fallback after cancellation'),fetchImpl:route({sent,perplexity:()=>{canceled=true;return new Response('{}',{status:503});},firecrawl:()=>assert.fail('No Firecrawl after cancellation')})});
 await assert.rejects(search('person'),/Canceled/);assert.deepEqual(sent,['perplexity']);
});
