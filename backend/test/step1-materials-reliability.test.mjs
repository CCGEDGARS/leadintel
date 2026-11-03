import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {storageFixture} from './writing-reference-fixture.mjs';
import {sha256} from '../src/security.js';
import {importAesKey,encryptSecret} from '../src/oauth.js';
import {handleCompanyMaterialsRoute} from '../src/company-materials.js';
import {processCompanyMaterial,runCompanyMaterialJobs} from '../src/company-materials-analysis.js';
import {extractServer} from '../src/writing-reference-validation.js';
import {selectCompanyMaterials,assertCompanyMaterialsCurrent} from '../src/company-materials-context.js';
import {storageDb} from './workspace-storage-fixture.mjs';
import {withWorkspaceStorage,reconcileStorageObjects} from '../src/workspace-storage-objects.js';

async function fixture(){
 const env=storageFixture();
 env.DB.raw.exec(readFileSync(new URL('../migrations/0052_company_materials.sql',import.meta.url),'utf8'));
 env.DB.raw.exec("CREATE TABLE users(id TEXT);CREATE TABLE sessions(token_hash TEXT,user_id TEXT,expires_at TEXT);CREATE TABLE workspace_members(workspace_id TEXT,user_id TEXT,role TEXT);INSERT INTO users VALUES('u1');INSERT INTO workspace_members VALUES('w1','u1','owner');");
 await env.DB.prepare("INSERT INTO sessions VALUES(?,'u1',datetime('now','+1 day'))").bind(await sha256('session')).run();
 return env;
}
const request=(path='',method='GET',body,workspace='w1')=>new Request('https://api.example.test/api/company-materials'+path+'?workspace_id='+workspace,{method,headers:{Cookie:'leadintel_session=session',...(body instanceof FormData?{}:{'Content-Type':'application/json'})},...(body?{body:body instanceof FormData?body:JSON.stringify(body)}:{})});
async function upload(env,bytes=readFileSync(new URL('./fixtures/mixed-native.pdf',import.meta.url)),workspace='w1'){
 const form=new FormData();form.set('file',new File([bytes],'brochure.pdf',{type:'application/pdf'}));
 const response=await handleCompanyMaterialsRoute(request('','POST',form,workspace),env);assert.equal(response.status,201);
 const card=(await response.json()).cards[0];
 return env.DB.prepare('SELECT * FROM company_materials WHERE id=?').bind(card.id).first();
}
async function connect(env){
 env.OAUTH_TOKEN_ENCRYPTION_KEY=Buffer.alloc(32,9).toString('base64');
 env.DB.raw.exec('CREATE TABLE workspace_ai_integrations(workspace_id TEXT,provider TEXT,model TEXT,encrypted_api_key TEXT,last_used_at TEXT);CREATE TABLE audit_events(id TEXT,workspace_id TEXT,user_id TEXT,event_type TEXT,entity_type TEXT,entity_id TEXT,metadata_json TEXT);');
 await env.DB.prepare("INSERT INTO workspace_ai_integrations VALUES('w1','gemini','fixture',?,NULL)").bind(await encryptSecret('fixture-key',await importAesKey(env.OAUTH_TOKEN_ENCRYPTION_KEY))).run();
}
function sparsePdf(){
 const first='BT /F1 12 Tf 20 700 Td (Exact native source: 12 mm.) Tj ET';
 const objects=['<< /Type /Catalog /Pages 2 0 R >>','<< /Type /Pages /Kids [4 0 R 6 0 R] /Count 2 >>','<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 600 800] /Resources << /Font << /F1 3 0 R >> >> /Contents 5 0 R >>`,`<< /Length ${first.length} >>\nstream\n${first}\nendstream`,'<< /Type /Page /Parent 2 0 R /MediaBox [0 0 600 800] /Resources << /Font << /F1 3 0 R >> >> /Contents 7 0 R >>','<< /Length 0 >>\nstream\n\nendstream'];
 let pdf='%PDF-1.4\n';const offsets=[0];
 for(const [i,object] of objects.entries()){offsets.push(pdf.length);pdf+=`${i+1} 0 obj\n${object}\nendobj\n`;}
 const start=pdf.length;pdf+=`xref\n0 ${objects.length+1}\n0000000000 65535 f \n`+offsets.slice(1).map(n=>String(n).padStart(10,'0')+' 00000 n \n').join('')+`trailer\n<< /Size ${objects.length+1} /Root 1 0 R >>\nstartxref\n${start}\n%%EOF`;
 return new TextEncoder().encode(pdf);
}
function result(text){return {sections:[{location:'page:1',text}],analysis:{summary:text,customer:'',industry:'',challenge:'',solution:'',outcome:'',evidence:[{location:'page:1',quote:text}]},coverage:{total:1,readable:1,unreadable:0}};}
function deferred(){let resolve;const promise=new Promise(done=>{resolve=done;});return {promise,resolve};}
async function meteredFixture(){
 const DB=storageDb(),objects=new Map();
 await DB.prepare("INSERT INTO sessions(token_hash,user_id,expires_at) VALUES(?,'storage-owner',datetime('now','+1 day'))").bind(await sha256('session')).run();
 const raw={DB,objects,WORKSPACE_STORAGE_ENABLED:'true',WRITING_REFERENCES_BUCKET:{
  async head(key){const bytes=objects.get(key);return bytes?{size:bytes.byteLength}:null;},
  async put(key,value){const bytes=typeof value==='string'?new TextEncoder().encode(value):new Uint8Array(value);objects.set(key,bytes);return {key,size:bytes.byteLength};},
  async get(key){const bytes=objects.get(key);return bytes?{async text(){return new TextDecoder().decode(bytes);},async arrayBuffer(){return bytes.buffer;}}:null;},
  async delete(key){objects.delete(key);}
 }};
 return {env:withWorkspaceStorage(raw),raw};
}
function accountedBytes(env){return env.DB.raw.prepare("SELECT files_bytes FROM workspace_storage_accounts WHERE workspace_id='storage-w1'").get().files_bytes;}
function actualBytes(env){return [...env.objects.values()].reduce((n,bytes)=>n+bytes.byteLength,0);}

test('short actual native PDF text survives OCR disagreement through saved Profile and writing evidence',async()=>{
 const env=await fixture(),bytes=sparsePdf(),row=await upload(env,bytes);await connect(env);
 const native=await extractServer(bytes,'application/pdf');assert.equal(native.sections[0].text,'Exact native source: 12 mm.');
 const prior=globalThis.fetch;let calls=0;
 globalThis.fetch=async()=>{calls++;return calls===1?Response.json({candidates:[{finishReason:'STOP',content:{parts:[{text:JSON.stringify({sections:[{location:'page:1',text:'OCR changed the measurement to 120 mm.'},{location:'page:2',text:'Recovered literal scan text.'}]})}]}}]}):Response.json({}, {status:503});};
 try{
  const processed=await processCompanyMaterial(env,row);
  assert.equal(processed.sections.find(s=>s.location==='page:1').text,native.sections[0].text);
  assert.equal(processed.sections.find(s=>s.location==='page:2').text,'Recovered literal scan text.');
  assert.equal(processed.coverage.readable,2);assert.equal(processed.analysis.outcome,'');
  assert.ok(!JSON.stringify(processed).includes('120 mm'));
  await runCompanyMaterialJobs(env,{process:async()=>processed});
  const documents=(await (await handleCompanyMaterialsRoute(request('/profile-context'),env)).json()).documents;
  assert.match(documents[0].text,/page:1\nExact native source: 12 mm\./);assert.match(documents[0].text,/page:2\nRecovered literal scan text\./);
  const refs=await selectCompanyMaterials(env,'w1','exact native source');assert.equal(refs.length,1);
  assert.equal(refs[0].revision,documents[0].materialRevision);assert.equal(refs[0].evidence[0].location,'page:1');assert.equal(refs[0].evidence[0].quote,native.sections[0].text);
  assert.deepEqual(await selectCompanyMaterials(env,'w2','exact native source'),[]);await assertCompanyMaterialsCurrent(env,'w1',refs);
  assert.equal((await handleCompanyMaterialsRoute(request('/'+row.id,'DELETE',{expectedRevision:refs[0].revision}),env)).status,200);
  await assert.rejects(assertCompanyMaterialsCurrent(env,'w1',refs),{status:409});
 }finally{globalThis.fetch=prior;}
});

test('a delayed expired lease cannot overwrite or delete the newer Ready extraction',async()=>{
 const env=await fixture(),row=await upload(env),entered=deferred(),release=deferred();
 const put=env.WRITING_REFERENCES_BUCKET.put.bind(env.WRITING_REFERENCES_BUCKET);let writes=0;
 env.WRITING_REFERENCES_BUCKET.put=async(key,value,...options)=>{writes++;if(writes===1){entered.resolve();await release.promise;}return put(key,value,...options);};
 const started=Date.now(),oldJob=runCompanyMaterialJobs(env,{now:started,process:async()=>result('Old lease evidence.')});
 await entered.promise;
 try{
  await runCompanyMaterialJobs(env,{now:started+300001,process:async()=>result('New lease evidence.')});
  release.resolve();await oldJob;
  const response=await handleCompanyMaterialsRoute(request('/'+row.id+'/extracted'),env);
  assert.equal(response.status,200,'the Ready material must retain its saved extraction');
  const card=await response.json();assert.equal(card.status,'Ready');assert.equal(card.sections[0].text,'New lease evidence.');
  const context=await handleCompanyMaterialsRoute(request('/profile-context'),env);assert.equal(context.status,200);
  assert.match((await context.json()).documents[0].text,/New lease evidence/);
  assert.equal(env.objects.size,2,'only the original and winning extraction remain');
 }finally{release.resolve();await oldJob;}
});

test('a cancelled readable PDF is not accepted through the deterministic fallback',async()=>{
 const env=await fixture(),row=await upload(env),controller=new AbortController();controller.abort();
 await assert.rejects(processCompanyMaterial(env,row,{signal:controller.signal}),{name:'AbortError'});
});

test('expired upload cleanup claims the row before a delayed upload can commit Processing',async()=>{
 const env=await fixture(),entered=deferred(),release=deferred(),put=env.WRITING_REFERENCES_BUCKET.put.bind(env.WRITING_REFERENCES_BUCKET),del=env.WRITING_REFERENCES_BUCKET.delete.bind(env.WRITING_REFERENCES_BUCKET);
 env.WRITING_REFERENCES_BUCKET.put=async(key,value,...options)=>{entered.resolve();await release.promise;return put(key,value,...options);};
 const form=new FormData();form.set('file',new File([sparsePdf()],'slow.pdf',{type:'application/pdf'}));
 const pending=handleCompanyMaterialsRoute(request('','POST',form),env);await entered.promise;
 let first=true;
 env.WRITING_REFERENCES_BUCKET.delete=async(key)=>{if(first){first=false;release.resolve();await pending;}return del(key);};
 try{
  await runCompanyMaterialJobs(env,{now:Date.now()+180001});
  const response=await pending;
  const rows=(await env.DB.prepare('SELECT * FROM company_materials').all()).results;
  assert.ok(rows.every(row=>row.status!=='Processing'||env.objects.has(row.original_key)),'cleanup must not leave Processing with a deleted original');
  assert.equal(response.status,409,'the expired upload must see cleanup ownership before committing');
  assert.equal(rows.length,0);assert.equal(env.objects.size,0);
 }finally{release.resolve();await pending;}
});

test('lease output uses private metered keys and deletion releases exact workspace bytes',async()=>{
 const {env}=await meteredFixture(),row=await upload(env,undefined,'storage-w1');
 await runCompanyMaterialJobs(env,{process:async()=>result('Metered exact source evidence.')});
 const response=await handleCompanyMaterialsRoute(request('/'+row.id+'/extracted','GET',null,'storage-w1'),env);
 assert.equal(response.status,200);const card=await response.json();assert.equal(card.sections[0].text,'Metered exact source evidence.');
 assert.equal(accountedBytes(env),actualBytes(env));assert.equal(env.objects.size,2);
 assert.equal(env.DB.raw.prepare("SELECT files_bytes FROM workspace_storage_accounts WHERE workspace_id='storage-w2'").get().files_bytes,0);
 const deleted=await handleCompanyMaterialsRoute(request('/'+row.id,'DELETE',{expectedRevision:card.revision},'storage-w1'),env);
 assert.equal(deleted.status,200);assert.equal(accountedBytes(env),0);assert.equal(env.objects.size,0);
});

test('file quota rejection preserves the original and explicit retry uses a fresh bounded lease',async()=>{
 const {env}=await meteredFixture(),row=await upload(env,undefined,'storage-w1'),originalBytes=accountedBytes(env);let attempts=0;
 env.DB.raw.prepare("UPDATE workspace_storage_accounts SET included_files_limit=? WHERE workspace_id='storage-w1'").run(originalBytes+1);
 const process=async()=>{attempts++;return result('Readable evidence too large for the remaining file quota.');};
 await runCompanyMaterialJobs(env,{process});await runCompanyMaterialJobs(env,{process});assert.equal(attempts,1);
 let card=(await (await handleCompanyMaterialsRoute(request('','GET',null,'storage-w1'),env)).json()).cards[0];
 assert.equal(card.status,'Needs attention');assert.match(card.error,/storage is full.*Settings.*Storage/i);assert.equal(accountedBytes(env),originalBytes);assert.ok(env.objects.has(row.original_key));
 env.DB.raw.exec("UPDATE workspace_storage_accounts SET included_files_limit=1000000000 WHERE workspace_id='storage-w1'");
 assert.equal((await handleCompanyMaterialsRoute(request('/'+row.id+'/retry','POST',{expectedRevision:card.revision},'storage-w1'),env)).status,200);
 await runCompanyMaterialJobs(env,{process});assert.equal(attempts,2);
 card=(await (await handleCompanyMaterialsRoute(request('','GET',null,'storage-w1'),env)).json()).cards[0];assert.equal(card.status,'Ready');
 assert.equal(accountedBytes(env),actualBytes(env));assert.equal(env.objects.size,2);
});

test('failed Ready database publication removes its staged text and keeps only the original',async()=>{
 const {env}=await meteredFixture(),row=await upload(env,undefined,'storage-w1'),originalBytes=accountedBytes(env);
 const prepare=env.DB.prepare.bind(env.DB);let refused=false;
 env.DB.prepare=sql=>{const statement=prepare(sql);if(sql.includes("SET status='Ready'")){const run=statement.run.bind(statement);statement.run=async()=>{if(!refused){refused=true;throw Error('Controlled database commit failure');}return run();};}return statement;};
 await runCompanyMaterialJobs(env,{process:async()=>result('Publication candidate source evidence.')});
 const card=(await (await handleCompanyMaterialsRoute(request('','GET',null,'storage-w1'),env)).json()).cards[0];
 assert.equal(card.status,'Needs attention');assert.ok(env.objects.has(row.original_key));assert.equal(env.objects.size,1);assert.equal(accountedBytes(env),originalBytes);
 assert.ok(!card.error.includes('Controlled database'));
});

test('failed storage put retains accounting until reconciliation and retry removes the abandoned lease reservation',async()=>{
 const {env,raw}=await meteredFixture(),row=await upload(env,undefined,'storage-w1'),originalBytes=accountedBytes(env),put=raw.WRITING_REFERENCES_BUCKET.put;
 raw.WRITING_REFERENCES_BUCKET.put=async()=>{throw Error('Controlled storage outage');};
 await runCompanyMaterialJobs(env,{process:async()=>result('Storage candidate source evidence.')});
 let card=(await (await handleCompanyMaterialsRoute(request('','GET',null,'storage-w1'),env)).json()).cards[0];assert.equal(card.status,'Needs attention');
 assert.ok(accountedBytes(env)>originalBytes,'unreconciled reservation must retain its file accounting');
 raw.WRITING_REFERENCES_BUCKET.put=put;env.DB.raw.exec('UPDATE workspace_storage_objects SET lease_until=0');await reconcileStorageObjects(env);
 assert.equal(accountedBytes(env),originalBytes);
 await handleCompanyMaterialsRoute(request('/'+row.id+'/retry','POST',{expectedRevision:card.revision},'storage-w1'),env);
 await runCompanyMaterialJobs(env,{process:async()=>result('Recovered storage source evidence.')});
 card=(await (await handleCompanyMaterialsRoute(request('','GET',null,'storage-w1'),env)).json()).cards[0];assert.equal(card.status,'Ready');assert.equal(env.objects.size,2);assert.equal(accountedBytes(env),actualBytes(env));
});

test('record quota cannot leave an analysis Processing or repeatedly consume provider work',async()=>{
 const {env}=await meteredFixture(),row=await upload(env,undefined,'storage-w1');let attempts=0;
 env.DB.raw.exec("UPDATE workspace_storage_accounts SET included_records_limit=records_bytes WHERE workspace_id='storage-w1'");
 const process=async()=>{attempts++;return result('Exact source evidence cannot fit in the remaining metadata allowance.');};
 await assert.doesNotReject(runCompanyMaterialJobs(env,{process}));
 await runCompanyMaterialJobs(env,{now:Date.now()+300001,process});assert.equal(attempts,1,'only an explicit retry may re-run a quota-failed analysis');
 const card=(await (await handleCompanyMaterialsRoute(request('','GET',null,'storage-w1'),env)).json()).cards[0];
 assert.equal(card.status,'Needs attention');assert.match(card.error,/Storage|storage/);assert.ok(env.objects.has(row.original_key));assert.equal(env.objects.size,1);
 assert.equal(env.DB.raw.prepare("SELECT count(*) n FROM workspace_storage_objects WHERE workspace_id='storage-w1'").get().n,1);
});

test('expired lease fencing also preserves winning text and exact accounting with storage enabled',async()=>{
 const {env,raw}=await meteredFixture(),row=await upload(env,undefined,'storage-w1'),entered=deferred(),release=deferred();
 const put=raw.WRITING_REFERENCES_BUCKET.put;let writes=0;
 raw.WRITING_REFERENCES_BUCKET.put=async(...args)=>{writes++;if(writes===1){entered.resolve();await release.promise;}return put(...args);};
 const started=Date.now(),oldJob=runCompanyMaterialJobs(env,{now:started,process:async()=>result('Old metered source evidence.')});await entered.promise;
 try{
  await runCompanyMaterialJobs(env,{now:started+300001,process:async()=>result('New metered source evidence.')});
  release.resolve();await oldJob;
  const response=await handleCompanyMaterialsRoute(request('/'+row.id+'/extracted','GET',null,'storage-w1'),env);
  assert.equal(response.status,200);assert.equal((await response.json()).sections[0].text,'New metered source evidence.');
  assert.equal(env.objects.size,2);assert.equal(accountedBytes(env),actualBytes(env));
  assert.equal(env.DB.raw.prepare("SELECT count(*) n FROM workspace_storage_objects WHERE workspace_id='storage-w1'").get().n,2);
 }finally{release.resolve();await oldJob;}
});

test('deleting during a metered extraction write cannot resurrect text and cleanup retries release all bytes',async()=>{
 const {env,raw}=await meteredFixture(),row=await upload(env,undefined,'storage-w1'),entered=deferred(),release=deferred(),put=raw.WRITING_REFERENCES_BUCKET.put;
 raw.WRITING_REFERENCES_BUCKET.put=async(...args)=>{entered.resolve();await release.promise;return put(...args);};
 const job=runCompanyMaterialJobs(env,{process:async()=>result('Cancelled material source evidence.')});await entered.promise;
 try{
  const response=await handleCompanyMaterialsRoute(request('/'+row.id,'DELETE',{expectedRevision:row.revision},'storage-w1'),env);
  assert.equal(response.status,409,'the in-flight private write requires cleanup to retry');
  assert.equal((await (await handleCompanyMaterialsRoute(request('','GET',null,'storage-w1'),env)).json()).cards[0].status,'Deleting');
  release.resolve();await job;await runCompanyMaterialJobs(env);
  assert.deepEqual((await (await handleCompanyMaterialsRoute(request('','GET',null,'storage-w1'),env)).json()).cards,[]);
  assert.equal(env.objects.size,0);assert.equal(accountedBytes(env),0);
  assert.equal(env.DB.raw.prepare("SELECT count(*) n FROM workspace_storage_objects WHERE workspace_id='storage-w1'").get().n,0);
 }finally{release.resolve();await job;}
});

test('failed losing-lease cleanup remains recoverable after the accepted material is deleted',async()=>{
 const {env,raw}=await meteredFixture(),row=await upload(env,undefined,'storage-w1'),entered=deferred(),release=deferred(),put=raw.WRITING_REFERENCES_BUCKET.put,del=raw.WRITING_REFERENCES_BUCKET.delete;
 let abandonedKey;
 raw.WRITING_REFERENCES_BUCKET.put=async(key,...args)=>{if(!abandonedKey){abandonedKey=key;entered.resolve();await release.promise;}return put(key,...args);};
 raw.WRITING_REFERENCES_BUCKET.delete=async key=>{if(key===abandonedKey)throw Error('Controlled cleanup outage');return del(key);};
 const started=Date.now(),oldJob=runCompanyMaterialJobs(env,{now:started,process:async()=>result('Abandoned lease source evidence.')});await entered.promise;
 try{
  await runCompanyMaterialJobs(env,{now:started+300001,process:async()=>result('Accepted lease source evidence.')});release.resolve();await oldJob;
  assert.ok(env.objects.has(abandonedKey));raw.WRITING_REFERENCES_BUCKET.delete=del;
  const card=(await (await handleCompanyMaterialsRoute(request('','GET',null,'storage-w1'),env)).json()).cards[0];
  assert.equal((await handleCompanyMaterialsRoute(request('/'+row.id,'DELETE',{expectedRevision:card.revision},'storage-w1'),env)).status,200);
  env.DB.raw.exec('UPDATE workspace_storage_objects SET lease_until=0');
  await runCompanyMaterialJobs(env,{now:started+3600000});
  assert.equal(env.objects.size,0,'abandoned private output remains a durable cleanup obligation');assert.equal(accountedBytes(env),0);
 }finally{release.resolve();await oldJob;}
});

test('bounded orphan cleanup preserves current and foreign sources while failed first keys cannot starve later work',async()=>{
 const {env}=await meteredFixture(),active=await upload(env,undefined,'storage-w1'),foreign=await upload(env,undefined,'storage-w2');
 await runCompanyMaterialJobs(env,{limit:2,process:async row=>result('Current source evidence for '+row.workspace_id+'.')});
 const activeRow=await env.DB.prepare('SELECT * FROM company_materials WHERE id=?').bind(active.id).first(),foreignRow=await env.DB.prepare('SELECT * FROM company_materials WHERE id=?').bind(foreign.id).first();
 env.DB.raw.prepare("UPDATE company_materials SET status='Processing' WHERE id=?").run(active.id);
 const bookKey='writing/storage-w2/unrelated/text.json';await env.WRITING_REFERENCES_BUCKET.put(bookKey,'Unrelated private writing source.');
 const foreignBytes=env.DB.raw.prepare("SELECT files_bytes FROM workspace_storage_accounts WHERE workspace_id='storage-w2'").get().files_bytes;
 const keys=['materials/storage-w1/abandoned-a/text.json','materials/storage-w1/abandoned-b/text.json','materials/storage-w1/abandoned-c/text.json'];
 for(const key of keys)await env.WRITING_REFERENCES_BUCKET.put(key,'Abandoned private material text.');
 const del=env.WRITING_REFERENCES_BUCKET.delete.bind(env.WRITING_REFERENCES_BUCKET),attempts=[];
 env.WRITING_REFERENCES_BUCKET.delete=async key=>{attempts.push(key);if(keys.slice(0,2).includes(key))throw Error('Controlled outage before deletion can claim a lease');return del(key);};
 const now=Date.now();let providerWork=0;
 await runCompanyMaterialJobs(env,{now,limit:0,process:async()=>{providerWork++;return result('Unexpected work.');}});
 assert.equal(attempts.length,2);assert.ok(env.objects.has(keys[2]),'one invocation must stay within two orphan deletions');
 await runCompanyMaterialJobs(env,{now:now+1000,limit:0,process:async()=>{providerWork++;return result('Unexpected work.');}});
 assert.ok(!env.objects.has(keys[2]),'persisted failure delay must allow later orphan cleanup');assert.equal(providerWork,0);
 for(const key of [active.original_key,activeRow.text_key,foreign.original_key,foreignRow.text_key,bookKey])assert.ok(env.objects.has(key),'current and unrelated objects must be retained: '+key);
 assert.equal(env.DB.raw.prepare("SELECT files_bytes FROM workspace_storage_accounts WHERE workspace_id='storage-w2'").get().files_bytes,foreignBytes);
});
