import test from 'node:test';
import assert from 'node:assert/strict';
import {readOnlyD1,inspectBuyerJob,encryptInspection,inspectionLogLines} from '../scripts/inspect-buyer-job.mjs';
import {generateKeyPairSync,privateDecrypt,createDecipheriv,constants} from 'node:crypto';
import {buyerJobsFixture,workspaceId} from './buyer-research-jobs-fixture.mjs';
import {startBuyerJob} from '../src/buyer-research-store.js';
import {upsertCrmCompany,upsertCrmIntelligence} from '../src/crm.js';

test('production inspection uses bound read-only D1 queries and never forwards a write',async()=>{
 const requests=[],DB=readOnlyD1({accountId:'a'.repeat(32),databaseId:'79f8c0fb-82f9-4ff8-9ab7-38bf5742fc50',token:'controlled-credential',fetchImpl:async(url,options)=>{requests.push({url,body:JSON.parse(options.body)});return Response.json({success:true,result:[{success:true,results:[{status:'queued'}]}]});}});
 assert.equal((await DB.prepare('SELECT status FROM buyer_research_jobs WHERE workspace_id=? AND domain=?').bind('workspace-test','forge.example').first()).status,'queued');
 assert.deepEqual(requests[0].body.params,['workspace-test','forge.example']);assert.equal(new URL(requests[0].url).hostname,'api.cloudflare.com');
 for(const sql of ['UPDATE buyer_research_jobs SET status=\'complete\'','DELETE FROM buyer_research_jobs','WITH x AS (SELECT 1) UPDATE buyer_research_jobs SET phase=\'done\'','SELECT 1; DELETE FROM users'])assert.throws(()=>DB.prepare(sql),/read.only/i);
 assert.equal(requests.length,1,'Rejected writes never leave the process');
 const expired=readOnlyD1({accountId:'a'.repeat(32),databaseId:'79f8c0fb-82f9-4ff8-9ab7-38bf5742fc50',token:'controlled',notAfter:0,fetchImpl:async()=>assert.fail('Expired inspection cannot query production')});await assert.rejects(expired.prepare('SELECT 1').first(),/expired/);
});

test('detailed inspection explains the retained people and failed tasks without reading provider credentials',async t=>{
 const f=await buyerJobsFixture(t),job=await startBuyerJob(f.env,workspaceId,f.users.owner,f.body);
 f.DB.raw.prepare("INSERT INTO workspace_ai_integrations(workspace_id,provider,encrypted_api_key,key_hint,model,active) VALUES(?,'gemini','PRIVATE_CREDENTIAL_SENTINEL','PRIVATE_HINT','configured-model',0)").run(workspaceId);
 f.DB.raw.prepare("INSERT INTO buyer_research_tasks(job_id,task_key,kind,phase,request_value,status,attempts,error) VALUES(?,'failed-check','independent','contacts','Robert Lund company check','failed',2,'Independent unavailable')").run(job.id);
 const before=f.DB.raw.prepare('SELECT total_changes() n').get().n,value=await inspectBuyerJob(f.DB,{workspaceId,domain:f.candidate.domain,details:true});
 assert.equal(value.details.people[0].name,'Robert Lund');assert.equal(value.details.failedTasks[0].attempts,2);assert.equal(value.details.models[0].model,'configured-model');
 assert.equal(JSON.stringify(value).includes('PRIVATE_CREDENTIAL_SENTINEL'),false);assert.equal(JSON.stringify(value).includes('PRIVATE_HINT'),false);assert.equal(f.DB.raw.prepare('SELECT total_changes() n').get().n,before);
});

test('large encrypted diagnostics survive bounded CI log lines without exposing the source record',()=>{
 const {publicKey}=generateKeyPairSync('rsa',{modulusLength:2048}),envelope=encryptInspection({privateAddress:'private@fixture.example',source:'x'.repeat(20000)},publicKey),lines=inspectionLogLines(envelope);
 assert.ok(lines.length>1);assert.ok(lines.every(line=>line.length<6200));assert.ok(lines.every(line=>!line.includes('private@fixture.example')));
 const parts=lines.map(line=>line.match(/^\[buyer-inspection-part\] ([a-f0-9]+) (\d+)\/(\d+) (.*)$/));assert.ok(parts.every(Boolean));assert.equal(new Set(parts.map(p=>p[1])).size,1);assert.equal(Number(parts[0][3]),parts.length);
 assert.deepEqual(JSON.parse(parts.sort((a,b)=>Number(a[2])-Number(b[2])).map(p=>p[4]).join('')),envelope,'Every byte of the encrypted report survives log transport');
});

test('source-failure inspection binds requested and actual URLs to the selected job without exposing page bodies',async t=>{
 const f=await buyerJobsFixture(t),job=await startBuyerJob(f.env,workspaceId,f.users.owner,f.body),requested='https://industry.example/staff/alex',actual=requested+'/',body='PRIVATE_PAGE_BODY_SENTINEL';
 const c=JSON.parse((await f.DB.prepare('SELECT result_json FROM buyer_research_jobs WHERE id=?').bind(job.id).first()).result_json);
 c.people[0].contactResearch={checks:{independent:{status:'partial',queryLog:[{sourceReads:[{url:requested,status:'partial',reason:'Attribution rejected'}]}]}}};
 f.DB.raw.prepare('UPDATE buyer_research_jobs SET result_json=? WHERE id=?').run(JSON.stringify(c),job.id);
 f.DB.raw.prepare("INSERT INTO buyer_research_tasks(job_id,task_key,kind,phase,request_value,status,attempts,result_json) VALUES(?,'redirected','read','contacts',?,'complete',1,?)").run(job.id,requested,JSON.stringify({url:actual,markdown:body,metadata:{sourceURL:actual,statusCode:200}}));
 const before=f.DB.raw.prepare('SELECT total_changes() n').get().n,value=await inspectBuyerJob(f.DB,{workspaceId,domain:f.candidate.domain,details:true});
 assert.equal(value.details.sourceFailures[0].requested,requested);assert.equal(value.details.sourceFailures[0].actual,actual);assert.equal(value.details.sourceFailures[0].metadataSourceURL,actual);
 assert.equal(JSON.stringify(value.details.sourceFailures).includes(body),false);assert.equal(f.DB.raw.prepare('SELECT total_changes() n').get().n,before);
});

test('inspection reads one selected workspace/company and encrypts its production evidence for the task owner',async t=>{
 const f=await buyerJobsFixture(t),job=await startBuyerJob(f.env,workspaceId,f.users.owner,f.body),context={workspaceId,userId:f.users.owner.id,role:'owner'},company=(await upsertCrmCompany(f.DB,context,{company:f.candidate.company,domain:f.candidate.domain})).company;
 await upsertCrmIntelligence(f.DB,context,company.id,{research_snapshot:{buyerResearch:{buyers:[]}}});f.DB.raw.prepare("UPDATE buyer_research_jobs SET result_json=json_set(result_json,'$.publicResearch.paidResearch',json(?)) WHERE id=?").run(JSON.stringify({version:1,status:'blocked',companyId:company.id}),job.id);
 const before=f.DB.raw.prepare('SELECT total_changes() n').get().n,DB=readOnlyD1({accountId:'a'.repeat(32),databaseId:'79f8c0fb-82f9-4ff8-9ab7-38bf5742fc50',token:'controlled',fetchImpl:async(_url,options)=>{const {sql,params}=JSON.parse(options.body),result=await f.DB.prepare(sql).bind(...params).all();return Response.json({success:true,result:[{...result,success:true}]});}});
 const value=await inspectBuyerJob(DB,{workspaceId,domain:f.candidate.domain});assert.equal(value.job.id,job.id);assert.equal(value.verdict,'RUNNING');assert.equal(value.job.authorized,true);assert.equal(f.DB.raw.prepare('SELECT total_changes() n').get().n,before,'Inspection including CRM hydration is read-only');
 assert.equal((await inspectBuyerJob(DB,{workspaceId:'different-workspace',domain:f.candidate.domain})).verdict,'NOT_FOUND');
 await assert.rejects(inspectBuyerJob(DB,{workspaceId:"bad'; DELETE FROM users",domain:f.candidate.domain}),/bounded/);
 const {publicKey,privateKey}=generateKeyPairSync('rsa',{modulusLength:2048}),envelope=encryptInspection(value,publicKey),key=privateDecrypt({key:privateKey,padding:constants.RSA_PKCS1_OAEP_PADDING,oaepHash:'sha256'},Buffer.from(envelope.key,'base64'));
 assert.equal(JSON.stringify(envelope).includes(job.id),false,'Public CI output must not expose the private inspection record');
 const decipher=createDecipheriv('aes-256-gcm',key,Buffer.from(envelope.iv,'base64'));decipher.setAuthTag(Buffer.from(envelope.tag,'base64'));const decoded=JSON.parse(Buffer.concat([decipher.update(Buffer.from(envelope.data,'base64')),decipher.final()]).toString());assert.equal(decoded.job.id,job.id);assert.equal(decoded.job.status,'queued');assert.equal(decoded.verdict,'RUNNING');
});
