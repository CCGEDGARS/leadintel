import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {storageFixture} from './writing-reference-fixture.mjs';
import {sha256} from '../src/security.js';
const api=await import('../src/company-materials.js').catch(()=>({}));
const jobs=await import('../src/company-materials-analysis.js').catch(()=>({}));
export async function fixture(){
 const env=storageFixture();env.DB.raw.exec(readFileSync(new URL('../migrations/0052_company_materials.sql',import.meta.url),'utf8'));
 env.DB.raw.exec("CREATE TABLE users(id TEXT);CREATE TABLE sessions(token_hash TEXT,user_id TEXT,expires_at TEXT);CREATE TABLE workspace_members(workspace_id TEXT,user_id TEXT,role TEXT);INSERT INTO users VALUES('u1');INSERT INTO workspace_members VALUES('w1','u1','owner');");
 await env.DB.prepare("INSERT INTO sessions VALUES(?,'u1',datetime('now','+1 day'))").bind(await sha256('session')).run();return env;
}
export const pdf=()=>new File(['%PDF-1.7\nSample training testimonial'], 'training.pdf',{type:'application/pdf'});
export function req(path='',method='GET',body,workspace='w1',signed=true){return new Request('https://api.example.test/api/company-materials'+path+'?workspace_id='+workspace,{method,headers:{...(signed?{Cookie:'leadintel_session=session'}:{}),...(body&&! (body instanceof FormData)?{'Content-Type':'application/json'}:{})},...(body?{body:body instanceof FormData?body:JSON.stringify(body)}:{})});}
export async function upload(env,file=pdf()) {const form=new FormData();form.set('file',file);return api.handleCompanyMaterialsRoute(req('','POST',form),env);}
test('company material upload implementation exists',()=>assert.equal(typeof api.handleCompanyMaterialsRoute,'function'));
test('original is preserved before analysis, persists on reload and duplicate uploads reuse the same source',async()=>{
 const env=await fixture(),response=await upload(env);assert.equal(response.status,201);const first=(await response.json()).cards[0];assert.equal(first.status,'Processing');
 const original=await api.handleCompanyMaterialsRoute(req('/'+first.id+'/original'),env);assert.equal(await original.text(),await pdf().text());
 assert.equal((await upload(env)).status,200);const list=await api.handleCompanyMaterialsRoute(req(),env);assert.equal((await list.json()).cards.length,1);
});
test('limits are atomic and independent for five PDFs and ten images, unrelated to books',async()=>{
 const env=await fixture();for(let i=0;i<5;i++)assert.equal((await upload(env,new File(['%PDF-'+i],i+'.pdf',{type:'application/pdf'}))).status,201);
 assert.equal((await upload(env)).status,409);
 for(let i=0;i<10;i++)assert.equal((await upload(env,new File([Uint8Array.from([137,80,78,71,13,10,26,10,i])],i+'.png',{type:'image/png'}))).status,201);
 assert.equal((await upload(env,new File([Uint8Array.from([255,216,255,5])],'more.jpg',{type:'image/jpeg'}))).status,409);
});
test('rejects mismatched signatures, unsafe names, unsupported files and oversize bytes',async()=>{
 const env=await fixture();for(const file of [new File(['not png'],'fake.png',{type:'image/png'}),new File(['%PDF-'],'../bad.pdf',{type:'application/pdf'}),new File(['hello'],'x.txt',{type:'text/plain'})])assert.equal((await upload(env,file)).status,400);
 assert.equal((await upload(env,new File([new Uint8Array(15*1024*1024+1)],'large.png',{type:'image/png'}))).status,413);
});
test('authentication, workspace isolation, ticket expiry and one-time upload authorization are enforced',async()=>{
 const env=await fixture();assert.equal((await api.handleCompanyMaterialsRoute(req('','GET',null,'w1',false),env)).status,401);assert.equal((await api.handleCompanyMaterialsRoute(req('','GET',null,'w2'),env)).status,403);
 const card=(await (await upload(env)).json()).cards[0];env.DB.raw.exec("INSERT INTO workspace_members VALUES('w2','u1','owner')");
 assert.equal((await api.handleCompanyMaterialsRoute(req('/'+card.id+'/original','GET',null,'w2'),env)).status,404);
 const ticket=await (await api.handleCompanyMaterialsRoute(req('/upload-ticket','POST',{}),env)).json();const form=new FormData();form.set('ticket',ticket.ticket);form.set('file',new File(['%PDF-other'],'other.pdf',{type:'application/pdf'}));
 const direct=()=>new Request('https://api.example.test/company-material-upload',{method:'POST',body:form});assert.equal((await api.handleCompanyMaterialsRoute(direct(),env)).status,201);assert.equal((await api.handleCompanyMaterialsRoute(direct(),env)).status,401);
});
test('delete cannot resurrect a processing file; stale revisions are rejected',async()=>{
 const env=await fixture(),card=(await (await upload(env)).json()).cards[0];
 assert.equal((await api.handleCompanyMaterialsRoute(req('/'+card.id,'DELETE',{expectedRevision:99}),env)).status,409);
 assert.equal((await api.handleCompanyMaterialsRoute(req('/'+card.id,'DELETE',{expectedRevision:1}),env)).status,200);
 assert.equal(env.objects.size,0);assert.deepEqual((await (await api.handleCompanyMaterialsRoute(req(),env)).json()).cards,[]);
});
test('analysis accepts only evidence anchored in extracted text and never creates missing outcomes',()=>{
 assert.equal(typeof jobs.validateAnalysis,'function');
 const sections=[{location:'page:1',text:'Acme: sales training. Excellent practical workshop.'}];
 const analysis=jobs.validateAnalysis({summary:'Training testimonial',customer:'Acme',industry:'',challenge:'',solution:'sales training',outcome:'',evidence:[{location:'page:1',quote:'Acme: sales training. Excellent practical workshop.'}]},sections);
 assert.equal(analysis.outcome,'');
 assert.throws(()=>jobs.validateAnalysis({...analysis,outcome:'Sales increased 30%'},sections),/unsupported|evidence/i);
 assert.throws(()=>jobs.validateAnalysis({...analysis,evidence:[{location:'page:8',quote:'invented'}]},sections),/evidence/i);
});
test('durable job leases process once; failures remain retryable and deletion during analysis cannot restore the source',async()=>{
 const env=await fixture(),card=(await (await upload(env)).json()).cards[0];let calls=0;
 const process=async()=>{calls++;return {sections:[{location:'page:1',text:'Practical sales training.'}],analysis:{summary:'Practical sales training.',customer:'',industry:'',challenge:'',solution:'sales training',outcome:'',evidence:[{location:'page:1',quote:'Practical sales training.'}]}};};
 await Promise.all([jobs.runCompanyMaterialJobs(env,{process}),jobs.runCompanyMaterialJobs(env,{process})]);assert.equal(calls,1);
 let current=(await (await api.handleCompanyMaterialsRoute(req(),env)).json()).cards[0];assert.equal(current.status,'Ready');
 await api.handleCompanyMaterialsRoute(req('/'+card.id,'DELETE',{expectedRevision:current.revision}),env);
 const second=(await (await upload(env)).json()).cards[0];await jobs.runCompanyMaterialJobs(env,{process:async()=>{throw Error('private provider details');}});
 current=(await (await api.handleCompanyMaterialsRoute(req(),env)).json()).cards[0];assert.equal(current.status,'Needs attention');assert.ok(!current.error.includes('private provider details'));
 assert.equal((await api.handleCompanyMaterialsRoute(req('/'+second.id+'/retry','POST',{expectedRevision:current.revision}),env)).status,200);
 await jobs.runCompanyMaterialJobs(env,{process:async()=>{const live=(await (await api.handleCompanyMaterialsRoute(req(),env)).json()).cards[0];await api.handleCompanyMaterialsRoute(req('/'+second.id,'DELETE',{expectedRevision:live.revision}),env);return process();}});
 assert.deepEqual((await (await api.handleCompanyMaterialsRoute(req(),env)).json()).cards,[]);assert.equal(env.objects.size,0);
});
import {importAesKey,encryptSecret} from '../src/oauth.js';
test('real job transcribes an image with customer-owned AI credentials, validates evidence and stores Ready analysis',async()=>{
 const env=await fixture();env.OAUTH_TOKEN_ENCRYPTION_KEY=Buffer.alloc(32,7).toString('base64');
 env.DB.raw.exec('CREATE TABLE workspace_ai_integrations(workspace_id TEXT,provider TEXT,model TEXT,encrypted_api_key TEXT,last_used_at TEXT);CREATE TABLE audit_events(id TEXT,workspace_id TEXT,user_id TEXT,event_type TEXT,entity_type TEXT,entity_id TEXT,metadata_json TEXT);');
 const key=await importAesKey(env.OAUTH_TOKEN_ENCRYPTION_KEY);await env.DB.prepare("INSERT INTO workspace_ai_integrations VALUES('w1','gemini','test-model',?,NULL)").bind(await encryptSecret('test-key',key)).run();
 const file=new File([Uint8Array.from([137,80,78,71,13,10,26,10,1])],'reference.png',{type:'image/png'});await upload(env,file);let calls=0;const prior=globalThis.fetch;
 globalThis.fetch=async(url,options)=>{calls++;assert.match(url,/generativelanguage.googleapis.com/);const body=JSON.parse(options.body);assert.ok(!JSON.stringify(body).includes('test-key'));assert.ok([...env.objects.keys()].some(k=>k.endsWith('/original')));
 const value=calls===1?{sections:[{location:'image:1',text:'Acme sales training: excellent workshop.'}]}:{summary:'Sales training testimonial',customer:'Acme',industry:'',challenge:'',solution:'sales training',outcome:'',evidence:[{location:'image:1',quote:'Acme sales training: excellent workshop.'}]};return Response.json({candidates:[{finishReason:'STOP',content:{parts:[{text:JSON.stringify(value)}]}}],usageMetadata:{}});};
 try{await jobs.runCompanyMaterialJobs(env);assert.equal(calls,2);const card=(await (await api.handleCompanyMaterialsRoute(req(),env)).json()).cards[0];assert.equal(card.status,'Ready');assert.equal(card.analysis.outcome,'');assert.equal(card.analysis.customer,'Acme');}finally{globalThis.fetch=prior;}
});
test('expired tickets cannot upload and interrupted uploads recover without occupying a slot forever',async()=>{
 const env=await fixture(),ticket=await (await api.handleCompanyMaterialsRoute(req('/upload-ticket','POST',{}),env)).json();env.DB.raw.exec('UPDATE company_material_upload_tickets SET expires_at=0');const form=new FormData();form.set('ticket',ticket.ticket);form.set('file',pdf());assert.equal((await api.handleCompanyMaterialsRoute(new Request('https://api.example.test/company-material-upload',{method:'POST',body:form}),env)).status,401);
 await upload(env);env.DB.raw.exec("UPDATE company_materials SET status='Uploading',lease_until=1");await jobs.runCompanyMaterialJobs(env,{now:Date.now()});assert.equal(env.objects.size,0);assert.deepEqual((await (await api.handleCompanyMaterialsRoute(req(),env)).json()).cards,[]);
});
