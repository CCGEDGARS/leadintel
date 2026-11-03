import test from 'node:test';
import assert from 'node:assert/strict';
import {readOnlyD1,inspectBuyerJob,encryptInspection} from '../scripts/inspect-buyer-job.mjs';
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
