import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {fixture,upload,req} from './company-materials.test.mjs';
import {handleCompanyMaterialsRoute} from '../src/company-materials.js';
import {processCompanyMaterial,runCompanyMaterialJobs} from '../src/company-materials-analysis.js';

async function source(name='mixed-native.pdf'){
 const env=await fixture();
 const bytes=readFileSync(new URL('./fixtures/'+name,import.meta.url));
 env.OAUTH_TOKEN_ENCRYPTION_KEY='';
 const card=(await (await upload(env,new File([bytes],'brochure.pdf',{type:'application/pdf'}))).json()).cards[0];
 const row=await env.DB.prepare('SELECT * FROM company_materials WHERE id=?').bind(card.id).first();
 return {env,bytes,card,row};
}
test('readable brochure pages remain usable without an AI key; blank/visual pages are an explicit coverage gap',async()=>{
 const {env,row,bytes}=await source();
 const result=await processCompanyMaterial(env,row);
 assert.ok(result.sections.some(s=>s.text.includes('KNOWN EXACT SOURCE')));
 assert.equal(result.analysisMode,'source-excerpts');
 assert.equal(result.analysisPartial,true);
 assert.equal(result.analysis.outcome,'');
 assert.deepEqual(new Uint8Array(await (await env.WRITING_REFERENCES_BUCKET.get(row.original_key)).arrayBuffer()),new Uint8Array(bytes));
});
test('job stores usable source excerpts as Ready and profile context exposes their text and revision',async()=>{
 const {env,row}=await source();await runCompanyMaterialJobs(env);
 const card=(await (await handleCompanyMaterialsRoute(req(),env)).json()).cards[0];
 assert.equal(card.status,'Ready');assert.equal(card.analysis.analysisMode,'source-excerpts');
 const context=await handleCompanyMaterialsRoute(req('/profile-context'),env);
 assert.equal(context.status,200);const data=await context.json();
 assert.equal(data.documents[0].id,'material:'+row.id);
 assert.equal(data.documents[0].materialRevision,card.revision);
 assert.match(data.documents[0].text,/page:1[\s\S]*KNOWN EXACT SOURCE/);
 assert.equal((await handleCompanyMaterialsRoute(req('/profile-context','GET',null,'w2'),env)).status,403);
});
test('a fully unreadable PDF remains retryable; no fabricated Ready result is returned',async()=>{
 const {env}=await source('blank-native.pdf');await runCompanyMaterialJobs(env);
 const card=(await (await handleCompanyMaterialsRoute(req(),env)).json()).cards[0];
 assert.equal(card.status,'Needs attention');assert.match(card.error,/AI provider|Settings/i);
 assert.equal(env.objects.size,1);
});

test('an unavailable AI service cannot erase deterministic PDF text or fabricate factual analysis',async()=>{
 const {env,row}=await source();const prior=globalThis.fetch;let calls=0;
 const {importAesKey,encryptSecret}=await import('../src/oauth.js');env.OAUTH_TOKEN_ENCRYPTION_KEY=Buffer.alloc(32,4).toString('base64');
 env.DB.raw.exec('CREATE TABLE workspace_ai_integrations(workspace_id TEXT,provider TEXT,model TEXT,encrypted_api_key TEXT,last_used_at TEXT);CREATE TABLE audit_events(id TEXT,workspace_id TEXT,user_id TEXT,event_type TEXT,entity_type TEXT,entity_id TEXT,metadata_json TEXT);');
 await env.DB.prepare("INSERT INTO workspace_ai_integrations VALUES('w1','gemini','fixture',?,NULL)").bind(await encryptSecret('fixture-key',await importAesKey(env.OAUTH_TOKEN_ENCRYPTION_KEY))).run();
 globalThis.fetch=async()=>{calls++;return Response.json({error:{message:'private upstream diagnostic'}},{status:503});};
 try{const result=await processCompanyMaterial(env,row);assert.ok(calls);assert.equal(result.analysisMode,'source-excerpts');assert.equal(result.analysis.customer,'');assert.equal(result.analysis.outcome,'');assert.match(result.analysis.evidence[0].quote,/KNOWN EXACT SOURCE/);assert.ok(!JSON.stringify(result).includes('private upstream'));}finally{globalThis.fetch=prior;}
});

test('profile context keeps every page intact when an uneven brochure fits the total document budget',async()=>{
 const {env,row}=await source();await runCompanyMaterialJobs(env);const current=await env.DB.prepare('SELECT * FROM company_materials WHERE id=?').bind(row.id).first();const sections=Array.from({length:8},(_,i)=>({location:'page:'+(i+1),text:i===3?'Engineering details. '.repeat(180)+' END_LONG_PAGE':('Company evidence '+i+'. ').repeat(40)}));const coverage={total:8,readable:8,unreadable:0};await env.WRITING_REFERENCES_BUCKET.put(current.text_key,JSON.stringify({sections,coverage}));
 const response=await handleCompanyMaterialsRoute(req('/profile-context'),env),data=await response.json(),doc=data.documents[0];assert.equal(doc.partial,false);assert.deepEqual(doc.coverage,coverage);for(const section of sections)assert.ok(doc.text.includes(section.location+'\n'+section.text),section.location);assert.match(doc.text,/END_LONG_PAGE/);
});
