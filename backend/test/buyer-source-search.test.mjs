import test from 'node:test';
import assert from 'node:assert/strict';
import {createBuyerSourceSearch} from '../src/buyer-source-search.js';
test('automatic public search falls back when Firecrawl is missing and records the actual source',async()=>{
 const trace=[],queries=[];const search=createBuyerSourceSearch({},'workspace',{observe:r=>trace.push(r),credential:async()=>{throw Error('not configured');},grounded:async(e,w,q)=>{queries.push([w,q]);return {status:'complete',results:[{url:'https://industry.example/event',description:'Anna Buyer at Example'}]};},fetchImpl:()=>{throw Error('No extractor call expected');}});
 const rows=await search('"Anna Buyer" "Example"');assert.equal(rows[0].searchProvider,'grounded');assert.equal(queries[0][0],'workspace');assert.ok(trace.some(r=>r.provider==='firecrawl'&&r.status==='skipped'));assert.ok(trace.some(r=>r.provider==='grounded'&&r.status==='succeeded'));
});
test('an exhausted Firecrawl account is not retried for every person; source failures do not become empty successes',async()=>{
 let calls=0;const search=createBuyerSourceSearch({},'w',{credential:async()=>({apiKey:'fixture'}),fetchImpl:async()=>{calls++;return new Response('{}',{status:402});},grounded:async()=>{throw Error('Grounded unavailable');}});
 await assert.rejects(search('first'),/unavailable/i);await assert.rejects(search('second'),/unavailable/i);assert.equal(calls,1);
});
test('successful empty public searches remain distinct from provider failure and cancellation blocks fallback',async()=>{
 let fallback=0,canceled=false;const search=createBuyerSourceSearch({},'w',{guard:async()=>{if(canceled)throw Error('Canceled');},credential:async()=>({apiKey:'fixture'}),fetchImpl:async()=>{canceled=true;return new Response('{}',{status:503});},grounded:async()=>{fallback++;return {status:'complete',results:[]};}});
 await assert.rejects(search('person'),/Canceled/);assert.equal(fallback,0);
 const empty=createBuyerSourceSearch({},'w',{credential:async()=>({apiKey:'fixture'}),fetchImpl:async()=>new Response(JSON.stringify({success:true,data:[]})),grounded:async()=>{throw Error('offline');}});assert.deepEqual(await empty('person'),[]);
});
