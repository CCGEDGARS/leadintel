import test from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {createHash} from 'node:crypto';
import '../../customer/contact-confirmation-policy.js';

const ctx={workspaceId:'workspace-a',userId:'owner-a',role:'owner'};
const candidate={company:'Example',domain:'example.com'};
const person={id:'public-anna',name:'Anna Buyer',title:'Procurement Director',publicLinkedinUrl:'https://www.linkedin.com/in/anna-buyer'};
const finder={output:{email:'anna@example.com',first_name:'Anna',last_name:'Buyer'},raw:{},_treg:{provider:'test-finder'}};
const verifier={output:{email:'anna@example.com',status:'valid'},raw:{email:'anna@example.com',result:'deliverable',is_accept_all:false},_treg:{provider:'test-verifier'}};
async function fixture({find=finder,verify=verifier}={}){
 const mod=await import('../src/treg-contact-research.js').catch(()=>null);
 assert.ok(mod,'Treg contact adapter must exist');
 const calls=[],receipts=[],saved=[];
 const deps={credential:async(env,id)=>({source:id===ctx.workspaceId?'customer':'none',apiKey:id===ctx.workspaceId?'private-token':''}),fetch:async(url,options)=>{
  calls.push({url,options});return new Response(JSON.stringify(url.includes('email.find')?find:verify),{headers:{'X-Treg-Call-Id':'call-'+calls.length,'X-Treg-Cost-Micro':'4000'}});
 },receipt:async row=>receipts.push(row),save:async(email,evidence)=>{saved.push({email,evidence});return {name:person.name,work_email:email,email_status:'verified',source:'treg',verification_provider:'Treg'};}};
 return {mod,deps,calls,receipts,saved};
}
test('Treg finds then independently verifies a work email with workspace tags, caps, idempotency and settled cost',async()=>{
 const f=await fixture();const result=await f.mod.findTregWorkEmail({},ctx,candidate,person,'company-a',{attemptKey:'attempt-a'},f.deps);
 assert.equal(result.contact.work_email,'anna@example.com');assert.equal(f.calls.length,2);assert.equal(result.research.costMicro,8000);
 for(const c of f.calls){assert.match(c.options.headers['X-Treg-Meta'],/workspace=workspace-a/);assert.ok(c.options.headers['Idempotency-Key']);assert.ok(Number(c.options.headers['X-Treg-Route-Max-Cost'])<=0.05);}
 assert.equal(f.receipts.length,2);assert.equal(f.saved.length,1);
 const legacyHash=createHash('sha256').update([ctx.workspaceId,'company-a',person.id,'attempt-a'].join('|')).digest('hex');assert.equal(f.calls[0].options.headers['Idempotency-Key'],'leadintel-'+legacyHash+'-find');
 assert.equal(globalThis.LeadIntelContactPolicy.accepted(result.contact,'example.com','provider_verified'),true);
});
test('Treg rejects wrong identities, personal domains and shared inboxes without saving or verification spend',async()=>{
 for(const output of [{email:'anna@example.com',first_name:'Someone',last_name:'Else'},{email:'anna@gmail.com'},{email:'info@example.com'}]){
  const f=await fixture({find:{...finder,output}});const result=await f.mod.findTregWorkEmail({},ctx,candidate,person,'company-a',{attemptKey:'a'},f.deps);
  assert.equal(result.contact,null);assert.equal(f.saved.length,0);assert.equal(f.calls.length,1);
 }
});
test('Treg never accepts catch-all, unknown, different-address or pending verification as a recipient',async()=>{
 for(const verify of [{...verifier,raw:{...verifier.raw,is_accept_all:true}},{output:{status:'unknown'},raw:{}},{...verifier,output:{email:'other@example.com',status:'valid'}},{output:{status:'pending'},raw:{task_id:'task-1'}}]){
  const f=await fixture({verify});const result=await f.mod.findTregWorkEmail({},ctx,candidate,person,'company-a',{attemptKey:'a'},f.deps);
  assert.equal(result.contact,null);assert.equal(f.saved.length,0);
 }
});
test('Treg refuses another workspace and does not use a platform token',async()=>{
 const f=await fixture();await assert.rejects(f.mod.findTregWorkEmail({TREG_TOKEN:'platform-secret'},{...ctx,workspaceId:'other'},candidate,person,'company-a',{attemptKey:'a'},f.deps),/Connect.*Treg/i);assert.equal(f.calls.length,0);
});
test('Treg hides upstream account details when credit balance is exhausted',async()=>{
 const f=await fixture();f.deps.fetch=async()=>new Response(JSON.stringify({balance_usd:123,top_up_url:'https://private.invalid',error:'insufficient_balance'}),{status:402});
 await assert.rejects(f.mod.findTregWorkEmail({},ctx,candidate,person,'company-a',{attemptKey:'a'},f.deps),error=>!/123|private.invalid/.test(error.message)&&/credit|balance/i.test(error.message));
});
test('an interrupted verification resumes its saved finder result and reuses the verification idempotency key',async()=>{
 const f=await fixture(),db=new DatabaseSync(':memory:');
 db.exec("CREATE TABLE treg_contact_calls(workspace_id TEXT,request_key TEXT,phase TEXT,call_id TEXT,cost_micro INTEGER,result_json TEXT,poll_count INTEGER DEFAULT 1,created_at TEXT DEFAULT CURRENT_TIMESTAMP,updated_at TEXT DEFAULT CURRENT_TIMESTAMP,PRIMARY KEY(workspace_id,request_key,phase));CREATE TABLE workspace_service_integrations(workspace_id TEXT,provider TEXT,last_used_at TEXT,updated_at TEXT);");
 const env={DB:{prepare(sql){let args=[];return {bind(...v){args=v;return this;},async first(){return db.prepare(sql).get(...args)||null;},async run(){return db.prepare(sql).run(...args);}};}}};
 delete f.deps.receipt;let interrupted=true;const keys=[];
 f.deps.fetch=async(url,options)=>{f.calls.push(url);if(url.includes('email.verify')){keys.push(options.headers['Idempotency-Key']);if(interrupted)throw Error('connection lost');}return Response.json(url.includes('email.find')?finder:verifier,{headers:{'X-Treg-Call-Id':url.includes('email.find')?'find-1':'verify-1','X-Treg-Cost-Micro':'4000'}});};
 await assert.rejects(f.mod.findTregWorkEmail(env,ctx,candidate,person,'company-a',{attemptKey:'a'},f.deps),/saved lookup/);
 interrupted=false;const result=await f.mod.findTregWorkEmail(env,ctx,candidate,person,'company-a',{attemptKey:'a'},f.deps);
 assert.equal(result.contact.work_email,'anna@example.com');assert.equal(f.calls.filter(url=>url.includes('email.find')).length,1);assert.equal(keys[0],keys[1]);assert.equal(result.research.costMicro,8000);assert.equal(db.prepare('SELECT SUM(cost_micro) n FROM treg_contact_calls').get().n,8000);db.close();
});

test('manual Confirm data includes profile and optional phone while preserving email-specific verification',async()=>{
 const f=await fixture(),emailFetch=f.deps.fetch;
 f.deps.fetch=async(url,options)=>{
  if(!url.includes('people.enrich')&&!url.includes('phone.find'))return emailFetch(url,options);
  f.calls.push({url,options});return Response.json(url.includes('people.enrich')?{output:{full_name:'Anna Buyer',title:'Procurement Director',company_domain:'example.com',linkedin_url:person.publicLinkedinUrl,city:'Riga',country:'Latvia'}}:{output:{phone:'+37120000001'},_treg:{served_by:'test-phone'}},{headers:{'X-Treg-Cost-Micro':'5000','X-Treg-Call-Id':url.includes('phone')?'phone-1':'profile-1'}});
 };
 f.deps.saveData=async data=>data;
 const result=await f.mod.findTregWorkEmail({},ctx,candidate,person,'company-a',{attemptKey:'data-a',dataLookup:true,includePhone:true},f.deps);
 assert.equal(f.calls.length,4);assert.equal(result.contact.work_email,'anna@example.com');assert.equal(result.contactData.profile.city,'Riga');assert.equal(result.contactData.phone.number,'+37120000001');assert.equal(result.contactData.phone.status,'provider_listed');assert.equal(result.contactData.status,'updated');assert.equal(result.research.costMicro,18000);
 assert.equal(f.calls.find(c=>c.url.includes('phone.find')).options.headers['X-Treg-Route-Max-Cost'],'0.25');
 const retainedDataKey=createHash('sha256').update([ctx.workspaceId,'company-a',person.id,'data-a','annabuyer',candidate.domain,person.publicLinkedinUrl].join('|')).digest('hex');
 for(const phase of ['profile','phone'])assert.equal(f.calls.find(c=>c.url.includes(phase==='profile'?'people.enrich':'phone.find')).options.headers['Idempotency-Key'],'leadintel-'+retainedDataKey+'-'+phase,'name comparison hardening must preserve purchased phase keys');
});
test('profile enrichment remains available for an already confirmed email without buying email again',async()=>{
 const f=await fixture();f.deps.saveData=async data=>data;f.deps.fetch=async(url,options)=>{f.calls.push({url,options});return Response.json({output:{full_name:'Anna Buyer',title:'Procurement Director',company_domain:'example.com',linkedin_url:person.publicLinkedinUrl}});};
 const result=await f.mod.findTregWorkEmail({},ctx,candidate,person,'company-a',{attemptKey:'a',dataLookup:true,existingContact:{id:'saved',name:person.name,work_email:'anna@example.com',email_status:'verified'}},f.deps);
 assert.equal(f.calls.length,1);assert.match(f.calls[0].url,/people.enrich/);assert.equal(result.contactData.phone.status,'not_requested');assert.equal(result.contact.work_email,'anna@example.com');
});
test('a missing email does not discard available profile or phone and never approves sending',async()=>{
 const f=await fixture({find:{output:{}}}),emailFetch=f.deps.fetch;f.deps.saveData=async data=>data;
 f.deps.fetch=async(url,options)=>url.includes('email.find')?emailFetch(url,options):Response.json(url.includes('phone.find')?{output:{phone:'+37120000001'}}:{output:{full_name:'Anna Buyer',company_domain:'example.com',title:'Director'}});
 const result=await f.mod.findTregWorkEmail({},ctx,candidate,person,'c',{attemptKey:'a',dataLookup:true,includePhone:true},f.deps);
 assert.equal(result.contact,null);assert.equal(result.contactData.phone.status,'provider_listed');assert.equal(result.contactData.profile.title,'Director');assert.notEqual(result.research.status,'verified');
});
test('profile identity or employer conflicts are not saved and a phone error preserves a confirmed email',async()=>{
 for(const output of [{full_name:'Other Person',company_domain:'example.com'},{full_name:'Anna Buyer',company_domain:'wrong.example'},{full_name:'Anna Buyer',company_domain:'example.com',linkedin_url:'https://linkedin.com/in/another'}]){
  const f=await fixture(),emailFetch=f.deps.fetch;f.deps.saveData=async data=>data;f.deps.fetch=async(url,options)=>url.includes('people.enrich')?Response.json({output}):emailFetch(url,options);
  const result=await f.mod.findTregWorkEmail({},ctx,candidate,person,'c',{attemptKey:'a',dataLookup:true},f.deps);
  assert.equal(result.contactData.profile.status,'conflict');assert.equal(result.contactData.profile.title,undefined);assert.ok(result.contact.work_email);
 }
 const f=await fixture(),emailFetch=f.deps.fetch;f.deps.saveData=async data=>data;f.deps.fetch=async(url,options)=>url.includes('phone.find')?new Response('{}',{status:402}):url.includes('people.enrich')?Response.json({output:{}}):emailFetch(url,options);
 const result=await f.mod.findTregWorkEmail({},ctx,candidate,person,'c',{attemptKey:'a',dataLookup:true,includePhone:true},f.deps);assert.ok(result.contact.work_email);assert.equal(result.contactData.phone.status,'error');assert.equal(result.contactData.status,'partial');
});

test('email-only success counts as updated data and excluding phone preserves earlier phone evidence',async()=>{
 const f=await fixture(),emailFetch=f.deps.fetch;f.deps.saveData=async()=>{};
 f.deps.fetch=(url,options)=>url.includes('people.enrich')?Promise.resolve(Response.json({output:{}})):emailFetch(url,options);
 const p={...person,contactData:{version:1,domain:'example.com',personId:person.id,phone:{status:'provider_listed',number:'+37120000001',source:'previous-provider'}}};
 const result=await f.mod.findTregWorkEmail({},ctx,candidate,p,'c',{attemptKey:'a',dataLookup:true},f.deps);
 assert.equal(result.contactData.status,'updated');assert.equal(result.contactData.phone.number,'+37120000001');assert.equal(result.contactData.phone.source,'previous-provider');assert.equal(f.calls.length,2);
});

test('phone-only research never buys email or profile and retains existing professional data',async()=>{
 const f=await fixture();f.deps.saveData=async data=>data;
 f.deps.fetch=async(url,options)=>{f.calls.push({url,options});return Response.json({output:{phone:'+37120000001'}},{headers:{'X-Treg-Cost-Micro':'125000'}});};
 const selected={...person,contactData:{version:1,domain:'example.com',personId:person.id,profile:{status:'provider_reported',city:'Riga'}}};
 const result=await f.mod.findTregWorkEmail({},ctx,candidate,selected,'c',{attemptKey:'phone-only',dataLookup:true,includePhone:true,includeEmail:false},f.deps);
 assert.deepEqual(f.calls.map(c=>c.url),['https://treg.to/call/treg.people.phone.find']);assert.equal(result.contact,null);assert.equal(result.contactData.profile.city,'Riga');assert.equal(result.contactData.phone.number,'+37120000001');assert.equal(result.research.costMicro,125000);
});

test('phone-only lookup cannot relabel retained profile data from another identity',async()=>{
 for(const stale of [{identityName:'Other Person',identityLinkedinUrl:person.publicLinkedinUrl},{identityName:person.name,identityLinkedinUrl:'https://www.linkedin.com/in/other-person'}]){
  const f=await fixture();f.deps.saveData=async()=>{};f.deps.fetch=async()=>Response.json({output:{phone:'+37120000001'}});
  const selected={...person,contactData:{version:1,domain:'example.com',personId:person.id,...stale,profile:{status:'provider_reported',title:'Other Person role',city:'Other city'},phone:{status:'provider_listed',number:'+37120000002'}}};
  const result=await f.mod.findTregWorkEmail({},ctx,candidate,selected,'c',{attemptKey:'identity-check',dataLookup:true,includePhone:true,includeEmail:false},f.deps);
  assert.equal(result.contactData.identityName,person.name);assert.equal(result.contactData.profile.title,undefined);assert.equal(result.contactData.profile.city,undefined);assert.equal(result.contactData.profile.status,'not_requested');assert.equal(result.contactData.phone.number,'+37120000001');
 }
});

test('failed phone refresh preserves same-identity paid number and records latest failure',async()=>{
 const f=await fixture();f.deps.saveData=async()=>{};f.deps.fetch=async()=>new Response('{}',{status:429});
 const prior={version:1,domain:candidate.domain,personId:person.id,identityName:person.name,checkedAt:'2026-10-01T10:00:00Z',phone:{status:'provider_listed',number:'+37120000001',source:'earlier-provider'}};
 const r=await f.mod.findTregWorkEmail({},ctx,candidate,{...person,contactData:prior},'c',{attemptKey:'recover',dataLookup:true,includePhone:true,includeEmail:false},f.deps);
 assert.equal(r.contactData.phone.number,prior.phone.number);assert.equal(r.contactData.phone.source,'earlier-provider');assert.equal(r.contactData.lastAttempt.phone,'error');assert.match(r.contactData.lastAttempt.phoneReason,/limit/i);assert.equal(r.contactData.status,'partial');
});

test('Treg accepts a deliverable personal mailbox only with exact returned person ownership',async()=>{
 const find={...finder,output:{email:'anna@gmail.com',full_name:person.name}},verify={...verifier,output:{email:'anna@gmail.com',status:'valid'},raw:{email:'anna@gmail.com',is_free:true,is_accept_all:false}};
 const f=await fixture({find,verify});const result=await f.mod.findTregWorkEmail({},ctx,candidate,person,'company-a',{attemptKey:'personal-a'},f.deps);
 assert.equal(result.contact?.work_email,'anna@gmail.com');assert.equal(result.contact?.email_type,'personal');assert.equal(result.contact?.external_person_id,person.id);
 assert.equal(globalThis.LeadIntelContactPolicy.accepted(result.contact,'example.com'),true);
});
test('email-only research preserves the separate saved phone failure without a new phone call',async()=>{
 const f=await fixture();f.deps.saveData=async()=>{};const old='2026-10-01T10:00:00Z',p={...person,contactData:{version:1,domain:'example.com',personId:person.id,identityName:person.name,checkedAt:old,phone:{status:'error',reason:'Saved phone attempt failed'}}};
 const r=await f.mod.findTregWorkEmail({},ctx,candidate,p,'c',{attemptKey:'separate',dataLookup:true,includePhone:false,includeEmail:true},f.deps);
 assert.equal(r.contactData.phone.status,'error');assert.equal(r.contactData.phone.checkedAt,old);assert.equal(f.calls.some(call=>call.url.includes('phone.find')),false);
});

test('an arbitrary returned LinkedIn URL cannot establish email ownership without a matching expected profile',async()=>{
 const f=await fixture({find:{output:{email:'anna@example.com'},raw:{linkedin_url:'https://www.linkedin.com/in/somebody-else'}}});
 const result=await f.mod.findTregWorkEmail({},ctx,candidate,{...person,publicLinkedinUrl:''},'company-a',{attemptKey:'unattributed'},f.deps);
 assert.equal(result.contact,null);assert.equal(f.saved.length,0);assert.equal(f.calls.length,1);
});
test('a conflicting normalized finder LinkedIn profile blocks verification and saving',async()=>{
 const f=await fixture({find:{output:{email:'anna@example.com',full_name:person.name,linkedin_url:'https://www.linkedin.com/in/somebody-else'},raw:{}}});
 const result=await f.mod.findTregWorkEmail({},ctx,candidate,person,'company-a',{attemptKey:'profile-conflict'},f.deps);
 assert.equal(result.contact,null);assert.equal(f.saved.length,0);assert.equal(f.calls.length,1);
});

test('conflicting raw finder ownership cannot be hidden by normalized fields',async()=>{
 for(const raw of [{full_name:'Someone Else'},{full_name:'Ann A Buyer'},{first_name:'Somebody'},{last_name:'Else'},{email:'somebody@example.com'},{linkedin_url:'https://www.linkedin.com/in/somebody-else'},{company_domain:'wrong.example'},{person:{full_name:'Someone Else',email:'someone@example.com'}},{data:{full_name:'Anna Buyer'},person:{full_name:'Someone Else',email:'someone@example.com'}}]){
  const f=await fixture({find:{...finder,raw}});const result=await f.mod.findTregWorkEmail({},ctx,candidate,person,'company-a',{attemptKey:'raw-conflict'},f.deps);
  assert.equal(result.contact,null);assert.equal(f.saved.length,0);assert.equal(f.calls.length,1);
 }
});
test('conflicting raw verification verdicts and addresses never approve a recipient',async()=>{
 for(const raw of [{email:'other@example.com',is_accept_all:false},{result:'invalid',is_accept_all:false},{result:'invalid ',is_accept_all:false},{data:{email:'other@example.com',result:'invalid',is_accept_all:true}},{is_disposable:'true',is_accept_all:false},{is_accept_all:'TRUE',is_disposable:'TRUE'},{is_accept_all:' true ',is_disposable:' true '}]){
  const f=await fixture({verify:{...verifier,output:{...verifier.output,is_accept_all:false},raw}});const result=await f.mod.findTregWorkEmail({},ctx,candidate,person,'company-a',{attemptKey:'verify-conflict'},f.deps);
  assert.equal(result.contact,null);assert.equal(f.saved.length,0);
 }
});
test('token replacement after a paid finder retains its receipt and stops verification',async()=>{
 const f=await fixture();let token='first-token';f.deps.credential=async()=>({source:'customer',apiKey:token});
 const original=f.deps.fetch;f.deps.fetch=async(...args)=>{const response=await original(...args);token='replacement-token';return response;};
 await assert.rejects(f.mod.findTregWorkEmail({},ctx,candidate,person,'company-a',{attemptKey:'rotated'},f.deps),error=>error.code==='ADDITIONAL_CONTACT_PROVIDER_CHANGED');
 assert.equal(f.calls.length,1);assert.equal(f.receipts.length,1);assert.equal(f.receipts[0].costMicro,4000);assert.equal(f.saved.length,0);
});
test('unreadable and error responses retain settled Treg charge headers',async()=>{
 for(const status of [200,503]){
  const f=await fixture();f.deps.fetch=async()=>new Response('not-json',{status,headers:{'X-Treg-Cost-Micro':'7000','X-Treg-Call-Id':'billed-malformed'}});
  await assert.rejects(f.mod.findTregWorkEmail({},ctx,candidate,person,'company-a',{attemptKey:'malformed'},f.deps),error=>error.code==='TREG_RETRY_SAME_LOOKUP');
  assert.equal(f.receipts.length,1);assert.equal(f.receipts[0].costMicro,7000);assert.equal(f.receipts[0].callId,'billed-malformed');assert.equal(f.saved.length,0);
 }
});

test('a response from the old token cannot mark the replacement Treg connection used',async()=>{
 const f=await fixture(),db=new DatabaseSync(':memory:');db.exec("CREATE TABLE treg_contact_calls(workspace_id TEXT,request_key TEXT,phase TEXT,call_id TEXT,cost_micro INTEGER,result_json TEXT,poll_count INTEGER DEFAULT 1,created_at TEXT DEFAULT CURRENT_TIMESTAMP,updated_at TEXT DEFAULT CURRENT_TIMESTAMP,PRIMARY KEY(workspace_id,request_key,phase));CREATE TABLE workspace_service_integrations(workspace_id TEXT,provider TEXT,encrypted_api_key TEXT,last_used_at TEXT,updated_at TEXT);INSERT INTO workspace_service_integrations VALUES('workspace-a','treg','old-revision',NULL,NULL)");
 const env={DB:{prepare(sql){let args=[];return {bind(...v){args=v;return this;},async first(){return db.prepare(sql).get(...args)||null;},async run(){return db.prepare(sql).run(...args);}};}}};delete f.deps.receipt;
 f.deps.credential=async()=>{const row=db.prepare('SELECT encrypted_api_key FROM workspace_service_integrations').get();return {source:'customer',apiKey:row.encrypted_api_key,row};};
 f.deps.fetch=async()=>{db.exec("UPDATE workspace_service_integrations SET encrypted_api_key='new-revision'");return Response.json(finder,{headers:{'X-Treg-Call-Id':'old-call','X-Treg-Cost-Micro':'4000'}});};
 await assert.rejects(f.mod.findTregWorkEmail(env,ctx,candidate,person,'company-a',{attemptKey:'rotated-receipt'},f.deps),error=>error.code==='ADDITIONAL_CONTACT_PROVIDER_CHANGED');
 assert.equal(db.prepare('SELECT last_used_at FROM workspace_service_integrations').get().last_used_at,null);assert.equal(db.prepare('SELECT cost_micro FROM treg_contact_calls').get().cost_micro,4000);db.close();
});

test('normalized profile and phone matches cannot hide conflicting raw identity or employer',async()=>{
 for(const raw of [{full_name:'Someone Else'},{full_name:'Ann A Buyer'},{company_domain:'wrong.example'},{linkedin_url:'https://www.linkedin.com/in/other'},{person:{full_name:'Anna Buyer'},data:{full_name:'Someone Else'}}]){
  const f=await fixture();f.deps.saveData=async()=>{};f.deps.fetch=async url=>Response.json({output:{full_name:person.name,company_domain:candidate.domain,linkedin_url:person.publicLinkedinUrl,...(url.includes('phone.find')?{phone:'+37120000001'}:{title:person.title})},raw});
  const result=await f.mod.findTregWorkEmail({},ctx,candidate,person,'company-a',{attemptKey:'raw-data-conflict',dataLookup:true,includePhone:true,existingContact:{id:'saved',name:person.name,work_email:'anna@example.com',email_status:'verified'}},f.deps);
  assert.equal(result.contactData.profile.status,'conflict');assert.equal(result.contactData.phone.status,'conflict');assert.equal(result.contactData.phone.number,undefined);assert.equal(result.contact.work_email,'anna@example.com');
 }
});
