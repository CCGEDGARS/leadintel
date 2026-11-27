import test from 'node:test';
import assert from 'node:assert/strict';
import {storageDb} from './workspace-storage-fixture.mjs';
import {encryptSecret,importAesKey} from '../src/oauth.js';
import {lookupFirecrawlEmails,checkFreeEmails,interpretEmail,saveLiveEmail,applySavedEmails} from '../src/firecrawl-buyer-email.js';

const workspaceId='storage-w1',domain='forge.example',companyId='forge';
const buyers=[{id:'ada',name:'Ada Smith',title:'Director'},{id:'sam',name:'Sam Smith',title:'Manager'}];
const candidate=()=>({domain,company:'Forge',people:structuredClone(buyers)});
const receipt=(email,provider,data)=>({fields:{work_email:{value:email,provider,domain_match:true,verified:true}},results:[{provider,data:{email,...data}}]});
const deliverable={status:'safe',substatus:'deliverable',confidence:98,is_domain_catch_all:false};
function fixture(t){
 const DB=storageDb();
 t.after(()=>DB.raw.close());
 DB.raw.prepare('INSERT INTO crm_companies(id,workspace_id,normalized_domain,company_name,first_seen_at,last_seen_at,created_at,updated_at) VALUES(?,?,?,?,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP)').run(companyId,workspaceId,domain,'Forge');
 const env={DB,OAUTH_TOKEN_ENCRYPTION_KEY:btoa('a'.repeat(32))};
 const context={workspaceId,guard:async()=>{},writeAuthority:()=>({sql:'1',args:[]})};
 return {DB,env,context};
}
test('the batched email-only waterfall enforces a zero budget and persists per-buyer receipts after restart',async t=>{
 const {DB,env,context}=fixture(t);
 const encrypted=await encryptSecret('test-api-token',await importAesKey(env.OAUTH_TOKEN_ENCRYPTION_KEY));
 DB.raw.prepare('INSERT INTO workspace_service_integrations(workspace_id,provider,encrypted_api_key,key_hint) VALUES(?,?,?,?)').run(workspaceId,'firecrawl',encrypted,'test');
 const c=candidate();let calls=0;
 const fetchImpl=async(url,request)=>{
  calls++; assert.equal(url,'https://api.firecrawl.dev/v2/scrape');
  const payload=JSON.parse(request.body);
  assert.deepEqual(payload.alexandria,[{provider:'firecrawl',capability:'enrich/auto',options:{people:buyers.map(({name})=>({name,domain})),profile:false,contact_fields:['work_email'],max_credits:0}}]);
  assert.ok(request.headers['x-request-id']);assert.equal(payload.parsers,undefined);
  return Response.json({success:true,data:{alexandria:[{data:{credits_used:0,people:[
   {input_index:1,...receipt('sam@forge.example','enrow',{qualification:'valid'})},
   {input_index:0,...receipt('ada@forge.example','orbisearch',deliverable)}
  ]}}]}});
 };
 const opts={jobId:'one',lookup:(env,id,domain,names,options)=>lookupFirecrawlEmails(env,id,domain,names,{...options,fetchImpl})};
 await checkFreeEmails(env,context,c,companyId,c.people,opts);
 assert.deepEqual(c.people.map(p=>[p.waterfallEmail.email,p.waterfallEmail.mailbox]),[['ada@forge.example','deliverable'],['sam@forge.example','unverified']]);
 assert.equal(DB.raw.prepare("SELECT external_person_id FROM crm_contacts WHERE verification_provider='Firecrawl'").get().external_person_id,'ada');
 const restored=candidate();await checkFreeEmails(env,context,restored,companyId,restored.people,{...opts,jobId:'two'});
 assert.equal(calls,1);assert.equal(restored.people[1].waterfallEmail.finder,'enrow');
 assert.equal(JSON.parse(DB.raw.prepare("SELECT metadata_json FROM audit_events WHERE event_type='service.firecrawl_request'").get().metadata_json).reportedCredits,0);
 await applySavedEmails(env,'storage-w2',companyId,restored);assert.ok(restored.people.every(p=>!p.waterfallEmail));
});
test('completed misses, zero providers, an employer mismatch and a catch-all have distinct outcomes',()=>{
 assert.equal(interpretEmail({calls:[]},domain).status,'incomplete');
 assert.equal(interpretEmail({calls:[{status:'miss'}]},domain).status,'not_found');
 assert.equal(interpretEmail({calls:[{status:'timeout'}]},domain).status,'incomplete');
 assert.equal(interpretEmail(receipt('ada@other.example','orbisearch',deliverable),domain).status,'incomplete');
 assert.equal(interpretEmail(receipt('ada@forge.example','orbisearch',{...deliverable,is_domain_catch_all:true}),domain).mailbox,'catch_all');
});
test('a deliverability response cannot reassign an existing address or revive a suppressed contact',async t=>{
 const {DB,env,context}=fixture(t),c=candidate(),person=c.people[0];
 const evidence={...interpretEmail(receipt('ada@forge.example','orbisearch',deliverable),domain),checkedAt:new Date().toISOString()};
 DB.raw.prepare("INSERT INTO crm_contacts(id,workspace_id,company_id,external_person_id,name,title,normalized_email,email_status,created_at,updated_at) VALUES('old',?,?,?,?,?,?,?,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP)").run(workspaceId,companyId,'different',person.name,person.title,evidence.email,'suppressed');
 for(const id of ['different',person.id]){
  DB.raw.prepare("UPDATE crm_contacts SET external_person_id=? WHERE id='old'").run(id);
  assert.equal((await saveLiveEmail(env,context,c,person,companyId,evidence)).contact,undefined);
  assert.equal(DB.raw.prepare("SELECT email_status FROM crm_contacts").get().email_status,'suppressed');
 }
});
