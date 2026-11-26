import test from 'node:test';
import assert from 'node:assert/strict';
import {storageDb} from './workspace-storage-fixture.mjs';
import {requestPerplexitySearch,PERPLEXITY_RECEIPT_EVENT,PERPLEXITY_MAX_QUERIES} from '../src/perplexity-request.js';
import {searchPublicPeople} from '../src/buyer-source-search.js';

// B3, 26 Nov 2026: the manual search that found a company's current people was one Perplexity request carrying five
// people queries. The Search API answers up to five queries in one request, billed once (Perplexity API reference and
// rate-limit page, read 26 Nov 2026, dossier Izpete/perplexity-search-api A1, A11).
const W='storage-w1',KEY={apiKey:'pplx-fixture'};
const receipts=DB=>DB.raw.prepare('SELECT metadata_json FROM audit_events WHERE workspace_id=? AND event_type=? ORDER BY rowid').all(W,PERPLEXITY_RECEIPT_EVENT).map(row=>JSON.parse(row.metadata_json));

test('one request carries up to five queries and is priced once',async t=>{
 const DB=storageDb();t.after(()=>DB.raw.close());const bodies=[];
 const queries=['a one','b two','c three','d four','e five','f six'];
 const response=await requestPerplexitySearch({DB},W,{credential:KEY,query:queries,maxResults:20,purpose:'buyer_research',fetchImpl:async(url,init)=>{bodies.push(JSON.parse(init.body));return Response.json({results:[{url:'https://example.com/a',title:'A',snippet:'text'}]});}});
 assert.equal(response.status,200);assert.equal(PERPLEXITY_MAX_QUERIES,5);
 assert.deepEqual(bodies,[{query:queries.slice(0,5),max_results:20}]);
 const [receipt,...more]=receipts(DB);assert.equal(more.length,0);
 assert.equal(receipt.outcome,'succeeded');assert.equal(receipt.listPriceUsdMicros,5000);
});

test('blank queries are dropped and an all-blank request is refused without sending anything',async()=>{
 let body;await requestPerplexitySearch({},W,{credential:KEY,query:['',' first ','  '],fetchImpl:async(url,init)=>{body=JSON.parse(init.body);return Response.json({results:[]});}});
 assert.deepEqual(body.query,['first']);
 await assert.rejects(requestPerplexitySearch({},W,{credential:KEY,query:['',' '],fetchImpl:async()=>assert.fail('nothing is sent')}),/Perplexity connection is required/);
});

test('the public people search returns Perplexity rows as search excerpts and reports the attempt',async t=>{
 const DB=storageDb();t.after(()=>DB.raw.close());const seen=[];let body;
 const rows=await searchPublicPeople({DB},W,['Fjord Staal A/S LinkedIn medarbejder','Fjord Staal A/S direktør ledelse'],{credential:KEY,observe:entry=>seen.push(entry),fetchImpl:async(url,init)=>{body=JSON.parse(init.body);return Response.json({results:[{url:'https://www.linkedin.com/in/ida-larsen-1',title:'Ida Larsen | LinkedIn',snippet:'**Ida Larsen**\n'+'x'.repeat(500),last_updated:'2026-11-02'},{url:'not a url',title:'x',snippet:'y'}]});}});
 assert.deepEqual(body,{query:['Fjord Staal A/S LinkedIn medarbejder','Fjord Staal A/S direktør ledelse'],max_results:20});
 assert.equal(rows.length,1);
 assert.equal(rows[0].url,'https://www.linkedin.com/in/ida-larsen-1');assert.equal(rows[0].evidenceKind,'search_excerpt');
 assert.equal(rows[0].searchProvider,'perplexity');assert.equal(rows[0].lastUpdated,'2026-11-02');
 assert.equal(rows[0].description.length,300);assert.ok(rows[0].markdown.length>500,'the whole excerpt stays as page text');
 assert.notEqual(rows[0].sourceRead,true,'a search excerpt is never a source read');
 assert.deepEqual(seen,[{provider:'perplexity',operation:'search',status:'succeeded',results:1}]);
 assert.equal(receipts(DB).length,1);
});

test('a failed people search is reported, thrown and not priced',async t=>{
 const DB=storageDb();t.after(()=>DB.raw.close());const seen=[];
 await assert.rejects(searchPublicPeople({DB},W,['q'],{credential:KEY,observe:entry=>seen.push(entry),fetchImpl:async()=>new Response('{}',{status:500})}),/HTTP 500/);
 assert.equal(seen.length,1);assert.equal(seen[0].status,'failed');assert.equal(seen[0].httpStatus,500);
 assert.equal(receipts(DB)[0].listPriceUsdMicros,0);
});
