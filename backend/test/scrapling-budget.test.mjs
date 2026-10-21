import test from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {importAesKey,encryptSecret} from '../src/oauth.js';
import {readPublicBuyerPage} from '../src/service-integrations.js';
import {fetchWithScrapling} from '../src/scrapling.js';

async function fixture(){
 const db=new DatabaseSync(':memory:');db.exec('CREATE TABLE workspace_service_integrations(workspace_id TEXT,provider TEXT,encrypted_api_key TEXT,key_hint TEXT,metadata_json TEXT,verified_at TEXT,last_used_at TEXT)');
 const key=Buffer.alloc(32,7).toString('base64'),encrypted=await encryptSecret('private-firecrawl-key',await importAesKey(key));
 db.prepare('INSERT INTO workspace_service_integrations VALUES(?,?,?,?,?,?,?)').run('w1','firecrawl',encrypted,'test','{}',null,null);
 return {env:{DB:{prepare(sql){let args=[];return {bind(...v){args=v;return this;},async first(){return db.prepare(sql).get(...args);},async run(){return db.prepare(sql).run(...args);}};}},OAUTH_TOKEN_ENCRYPTION_KEY:key,SCRAPLING_SERVICE_URL:'https://scrapling.example/api/scrapling',SCRAPLING_SERVICE_TOKEN:'private-scrapling-key'},close:()=>db.close()};
}
const extracted=()=>new Response(JSON.stringify({success:true,data:{markdown:'Source-backed company management contact details. '.repeat(5),metadata:{source:'scrapling-fallback',sourceURL:'https://company.example/team'}}}));
function waitOrAbort(ms,signal){return new Promise((resolve,reject)=>{const aborted=()=>{clearTimeout(timer);reject(signal.reason);};const timer=setTimeout(()=>{signal.removeEventListener('abort',aborted);resolve();},ms);signal.addEventListener('abort',aborted,{once:true});if(signal.aborted)aborted();});}

// Removing the downstream reserve reproduces the dossier's 3+12+3 seconds starvation.
test('dossier deadline leaves enough time for a sequential Scrapling extraction after slow earlier tools',async()=>{
 const {env,close}=await fixture(),old=globalThis.fetch,calls=[];let active=0,maxActive=0;
 globalThis.fetch=async(url,{signal,...options})=>{calls.push(String(url));active++;maxActive=Math.max(maxActive,active);try{if(String(url).includes('scrapling.example')){await waitOrAbort(600,signal);return extracted();}await waitOrAbort(5000,signal);throw Error('unexpected');}finally{active--;}};
 try{const result=await readPublicBuyerPage(env,'w1','https://company.example/team',{signal:AbortSignal.timeout(1800),totalTimeoutMs:1800,directTimeoutMs:300,firecrawlTimeoutMs:1200});assert.equal(result.data.metadata.source,'scrapling-fallback');assert.deepEqual(result.researchTrace.map(x=>[x.provider,x.status]),[['direct','failed'],['firecrawl','failed'],['scrapling','succeeded']]);assert.equal(calls.length,3);assert.equal(maxActive,1);}finally{globalThis.fetch=old;close();}
});

// The mandatory contact reader uses a 25-second page ceiling (scaled here).
test('mandatory page deadline reserves a usable fallback window instead of spending it all on direct and Firecrawl',async()=>{
 const {env,close}=await fixture(),old=globalThis.fetch;let calls=0;
 globalThis.fetch=async(url,{signal})=>{calls++;if(String(url).includes('scrapling.example')){await waitOrAbort(900,signal);return extracted();}await waitOrAbort(5000,signal);throw Error('unexpected');};
 try{const result=await readPublicBuyerPage(env,'w1','https://company.example/team',{signal:AbortSignal.timeout(2500),totalTimeoutMs:2500,directTimeoutMs:1000,firecrawlTimeoutMs:2000});assert.equal(result.data.metadata.source,'scrapling-fallback');assert.equal(calls,3);assert.equal(result.researchTrace[0].failureKind,'timeout');assert.equal(result.researchTrace[1].failureKind,'timeout');}finally{globalThis.fetch=old;close();}
});

test('parent cancellation during Firecrawl stops before starting Scrapling and retains timeout category',async()=>{
 const {env,close}=await fixture(),old=globalThis.fetch,calls=[];
 globalThis.fetch=async(url,{signal})=>{calls.push(String(url));if(calls.length===1)return new Response('Denied',{status:403});await waitOrAbort(5000,signal);return extracted();};
 try{await assert.rejects(readPublicBuyerPage(env,'w1','https://company.example/team',{signal:AbortSignal.timeout(80),totalTimeoutMs:1800}),cause=>{assert.equal(cause.status,504);assert.equal(cause.researchTrace.at(-1).failureKind,'timeout');return true;});assert.equal(calls.length,2);}finally{globalThis.fetch=old;close();}
});

test('Scrapling authentication failure retains safe category and HTTP status without provider secrets',async()=>{
 const {env,close}=await fixture(),old=globalThis.fetch;
 globalThis.fetch=async(url)=>String(url).includes('scrapling.example')?new Response(JSON.stringify({detail:'Unauthorized private-scrapling-key https://user:pass@example.com/?token=private-firecrawl-key'}),{status:401}):new Response('Denied',{status:403});
 try{await assert.rejects(readPublicBuyerPage(env,'w1','https://company.example/team'),cause=>{const receipt=cause.researchTrace.at(-1);assert.equal(receipt.failureKind,'authentication');assert.equal(receipt.httpStatus,401);assert.match(receipt.reason,/auth/i);assert.doesNotMatch(JSON.stringify(cause.researchTrace),/private-|user:pass|token=/);return true;});}finally{globalThis.fetch=old;close();}
});

test('Scrapling adapter bounds service extraction to its caller budget and refuses endpoint redirects',async()=>{
 const old=globalThis.fetch;let request;
 globalThis.fetch=async(url,options)=>{request=options;return extracted();};
 try{await fetchWithScrapling({SCRAPLING_SERVICE_URL:'https://scrapling.example/api/scrapling'},'https://company.example/team',{timeoutMs:1200});assert.equal(JSON.parse(request.body).timeout_ms,1200);assert.equal(request.redirect,'error');}finally{globalThis.fetch=old;}
});
