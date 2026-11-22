import test from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {importAesKey,encryptSecret} from '../src/oauth.js';
import {readPublicBuyerPage} from '../src/service-integrations.js';

// How one page's time is shared between its three readers: the direct read, Firecrawl, then the Scrapling fallback.
// Measured on the Buyers jobs of 19–22 Nov 2026: with 60 % of the time held back for the fallback, Firecrawl had
// 4–7 of 18 seconds, was cut off and still charged (17 of 36 page reads in one run, most of them PDF files at up to
// ten credits each). The fallback is a plain HTTP read that answers in 0.4–2.5 s, and it cannot read a PDF at all.
// So a third of the time is held back for it, and none for an address that names a PDF.
async function workspace(){
  const db=new DatabaseSync(':memory:');db.exec('CREATE TABLE workspace_service_integrations(workspace_id TEXT,provider TEXT,encrypted_api_key TEXT,key_hint TEXT,metadata_json TEXT,verified_at TEXT,last_used_at TEXT)');
  const key=Buffer.alloc(32,7).toString('base64');
  db.prepare('INSERT INTO workspace_service_integrations VALUES(?,?,?,?,?,?,?)').run('w1','firecrawl',await encryptSecret('private-firecrawl-key',await importAesKey(key)),'test','{}',null,null);
  return {env:{DB:{prepare(sql){let args=[];return {bind(...v){args=v;return this;},async first(){return db.prepare(sql).get(...args);},async run(){return db.prepare(sql).run(...args);}};}},OAUTH_TOKEN_ENCRYPTION_KEY:key,SCRAPLING_SERVICE_URL:'https://scrapling.example/api/scrapling',SCRAPLING_SERVICE_TOKEN:'private-scrapling-key'},close:()=>db.close()};
}
const TEXT='Source-backed company management contact details. '.repeat(5);
const scraplingPage=()=>new Response(JSON.stringify({success:true,data:{markdown:TEXT,metadata:{source:'scrapling-fallback',sourceURL:'https://company.example/team'}}}));
const firecrawlPage=()=>new Response(JSON.stringify({success:true,data:{markdown:TEXT,links:[],metadata:{sourceURL:'https://company.example/team',statusCode:200}}}));
const denied=()=>new Response('Denied',{status:403});
const unavailable=()=>new Response(JSON.stringify({error:'Temporary failure'}),{status:503});
function waitOrAbort(ms,signal){return new Promise((resolve,reject)=>{const aborted=()=>{clearTimeout(timer);reject(signal.reason);};const timer=setTimeout(()=>{signal.removeEventListener('abort',aborted);resolve();},ms);signal.addEventListener('abort',aborted,{once:true});if(signal.aborted)aborted();});}
const after=(ms,answer)=>async signal=>{await waitOrAbort(ms,signal);return answer();};
const never=async signal=>{await waitOrAbort(60000,signal);throw Error('unexpected');};
const who=url=>String(url).includes('scrapling.example')?'scrapling':String(url).includes('api.firecrawl.dev')?'firecrawl':'direct';
// One page read with each reader played by `readers[name](signal)`; returns the result or the error, and who was asked.
async function read(url,readers,options){
  const {env,close}=await workspace(),original=globalThis.fetch,asked=[];
  globalThis.fetch=async(target,{signal}={})=>{const name=who(target);asked.push(name);return readers[name](signal);};
  try{return {result:await readPublicBuyerPage(env,'w1',url,options),asked};}
  catch(error){return {error,asked};}
  finally{globalThis.fetch=original;close();}
}
const step=(outcome,provider)=>(outcome.result||outcome.error).researchTrace.find(entry=>entry.provider===provider);
// All times are a tenth of production's: 1,800 ms stands for the 18 s a Buyers page read has.
const PAGE={totalTimeoutMs:1800,directTimeoutMs:300,firecrawlTimeoutMs:1200};

test('Firecrawl has two thirds of the page time when the site refuses the direct read at once',async()=>{
  // 1,000 of 1,800 ms: with 60 % held back for the fallback Firecrawl was cut off after about 700.
  const outcome=await read('https://company.example/team',{direct:denied,firecrawl:after(1000,firecrawlPage),scrapling:()=>{throw Error('the fallback must not be asked');}},PAGE);
  assert.equal(outcome.result?.data.metadata.source,'firecrawl');
  assert.deepEqual(outcome.asked,['direct','firecrawl']);
  assert.deepEqual(outcome.result.researchTrace.map(entry=>[entry.provider,entry.status]),[['direct','failed'],['firecrawl','succeeded'],['scrapling','skipped']]);
});

test('a third of the page time is still held back for the fallback, which reads the page when Firecrawl does not answer',async()=>{
  // The caller allows Firecrawl 1,700 ms, so only the held-back third keeps it to 1,200.
  const outcome=await read('https://company.example/team',{direct:denied,firecrawl:never,scrapling:after(350,scraplingPage)},{...PAGE,firecrawlTimeoutMs:1700});
  assert.equal(outcome.result?.data.metadata.source,'scrapling-fallback');
  assert.deepEqual(outcome.asked,['direct','firecrawl','scrapling']);
  const firecrawl=step(outcome,'firecrawl');
  assert.equal(firecrawl.failureKind,'timeout');
  assert.ok(firecrawl.timeoutMs>=1100&&firecrawl.timeoutMs<=1200,'Firecrawl was allowed '+firecrawl.timeoutMs+' ms of 1,800');
});

test('after a direct read that used all of its time, Firecrawl still has half of the page time and the fallback reads the page',async()=>{
  const outcome=await read('https://company.example/team',{direct:never,firecrawl:never,scrapling:after(350,scraplingPage)},PAGE);
  assert.equal(outcome.result?.data.metadata.source,'scrapling-fallback');
  const firecrawl=step(outcome,'firecrawl');
  assert.ok(firecrawl.timeoutMs>=800&&firecrawl.timeoutMs<=900,'Firecrawl was allowed '+firecrawl.timeoutMs+' ms of 1,800');
});

test('the held-back third is a floor, not a limit: after a quick Firecrawl failure the fallback has all the remaining time',async()=>{
  const outcome=await read('https://company.example/team',{direct:denied,firecrawl:unavailable,scrapling:after(1100,scraplingPage)},PAGE);
  assert.equal(outcome.result?.data.metadata.source,'scrapling-fallback');
});

test('a PDF address is not given to the fallback, and nothing is held back from Firecrawl',async()=>{
  for(const url of ['https://company.example/wp-content/uploads/2025/07/EPD.pdf','https://company.example/files/Report.PDF?download=1']){
    // 1,400 of 1,800 ms: more than Firecrawl has for another page, where a third is held back.
    const outcome=await read(url,{direct:denied,firecrawl:after(1400,firecrawlPage),scrapling:()=>{throw Error('the fallback must not be asked for a PDF');}},{...PAGE,firecrawlTimeoutMs:1700});
    assert.equal(outcome.result?.data.metadata.source,'firecrawl',url);
    assert.deepEqual(outcome.asked,['direct','firecrawl'],url);
    assert.equal(step(outcome,'scrapling').status,'skipped');
  }
});

test('a PDF address that Firecrawl cannot read either is left unread without asking the fallback',async()=>{
  const outcome=await read('https://company.example/EPD.pdf',{direct:denied,firecrawl:unavailable,scrapling:()=>{throw Error('the fallback must not be asked for a PDF');}},PAGE);
  assert.equal(outcome.error?.status,502);
  assert.deepEqual(outcome.asked,['direct','firecrawl']);
  assert.deepEqual(outcome.error.researchTrace.map(entry=>[entry.provider,entry.status]),[['direct','failed'],['firecrawl','failed'],['scrapling','skipped']]);
  assert.match(step(outcome,'scrapling').reason,/PDF/);
});

test('an address that only mentions a PDF, in its path, query or fragment, still reaches the fallback',async()=>{
  for(const url of ['https://company.example/pdf-library/overview','https://company.example/viewer.php?file=report.pdf','https://company.example/search?q=annual.pdf','https://company.example/reports#download.pdf','https://company.example/report.pdf/view']){
    const outcome=await read(url,{direct:denied,firecrawl:unavailable,scrapling:scraplingPage},PAGE);
    assert.equal(outcome.result?.data.metadata.source,'scrapling-fallback',url);
    assert.deepEqual(outcome.asked,['direct','firecrawl','scrapling'],url);
  }
});

test('for a page with more than 18 seconds the fallback is held back six seconds, not a third',async()=>{
  // A 24 s page read, given up by its caller after 150 ms: the trace still says how long Firecrawl was allowed.
  const outcome=await read('https://company.example/team',{direct:denied,firecrawl:never,scrapling:never},{totalTimeoutMs:24000,firecrawlTimeoutMs:20000,signal:AbortSignal.timeout(150)});
  const firecrawl=step(outcome,'firecrawl');
  assert.ok(firecrawl.timeoutMs>=17500&&firecrawl.timeoutMs<=18000,'Firecrawl was allowed '+firecrawl.timeoutMs+' ms of 24,000');
  assert.deepEqual(outcome.asked,['direct','firecrawl']);
});
