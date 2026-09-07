import test from 'node:test';
import assert from 'node:assert/strict';
import {fetchWithScrapling,scraplingConfigured} from '../src/scrapling.js';
import {handleScraplingRoute} from '../src/scrapling-routes.js';

test('Scrapling is unavailable without a configured service URL',()=>{
  assert.equal(scraplingConfigured({}),false);
  assert.equal(scraplingConfigured({SCRAPLING_SERVICE_URL:'https://example.com/api/scrapling'}),true);
});

test('Scrapling forwards bearer token and normalizes successful provenance',async()=>{
  const original=globalThis.fetch;
  let seen;
  globalThis.fetch=async (url,options)=>{
    seen={url:String(url),options};
    return new Response(JSON.stringify({success:true,data:{markdown:'Evidence text',metadata:{title:'Example',sourceURL:'https://example.com',statusCode:200,source:'scrapling-fallback'}}}),{status:200,headers:{'content-type':'application/json'}});
  };
  try{
    const result=await fetchWithScrapling({SCRAPLING_SERVICE_URL:'https://scrape.example/api/scrapling',SCRAPLING_SERVICE_TOKEN:'secret'},'https://example.com');
    assert.equal(seen.url,'https://scrape.example/api/scrapling');
    assert.equal(seen.options.headers.Authorization,'Bearer secret');
    assert.equal(result.data.metadata.source,'scrapling-fallback');
    assert.equal(result.data.metadata.sourceURL,'https://example.com/');
    assert.equal(result.data.markdown,'Evidence text');
  }finally{globalThis.fetch=original;}
});

test('Scrapling rejects malformed or falsely labelled runtime responses',async()=>{
  const original=globalThis.fetch;
  globalThis.fetch=async()=>new Response(JSON.stringify({success:true,data:{markdown:'x',metadata:{source:'direct-fallback'}}}),{status:200,headers:{'content-type':'application/json'}});
  try{
    await assert.rejects(()=>fetchWithScrapling({SCRAPLING_SERVICE_URL:'https://scrape.example/api/scrapling'},'https://example.com'),/invalid Scrapling response/i);
  }finally{globalThis.fetch=original;}
});

test('public Scrapling fallback probe performs one fixed real extraction without workspace access',async()=>{
  const original=globalThis.fetch;
  let seenTarget='';
  globalThis.fetch=async (_url,options)=>{
    seenTarget=JSON.parse(options.body).url;
    return new Response(JSON.stringify({success:true,data:{markdown:'Example Domain',metadata:{title:'Example Domain',sourceURL:'https://example.com/',statusCode:200,source:'scrapling-fallback'}}}),{status:200,headers:{'content-type':'application/json'}});
  };
  try{
    const response=await handleScraplingRoute(new Request('https://leadintel-api.example/api/integrations/services/scrapling/health'),{SCRAPLING_SERVICE_URL:'https://scrape.example/api/scrapling',SCRAPLING_SERVICE_TOKEN:'secret'},{});
    assert.equal(response.status,200);
    const payload=await response.json();
    assert.equal(seenTarget,'https://example.com/');
    assert.deepEqual(payload,{status:'ok',service:'leadintel-scrapling-fallback',source:'scrapling-fallback',statusCode:200});
  }finally{globalThis.fetch=original;}
});
