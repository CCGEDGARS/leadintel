import test from 'node:test';
import '../../customer/discovery-engine.js';
const D=globalThis.LeadIntelDiscovery;
import assert from 'node:assert/strict';
import fs from 'node:fs';
import researchReceipts from '../../customer/test/helpers/buyer-research-receipts.cjs';
import {DatabaseSync} from 'node:sqlite';
import {lookupAdditionalEmail,saveAdditionalContactPolicy,readAdditionalContactPolicy} from '../src/additional-contact-services.js';
class Statement{constructor(db,sql){this.db=db;this.sql=sql;this.args=[];}bind(...args){this.args=args;return this;}async first(){return this.db.prepare(this.sql).get(...this.args)||null;}async run(){const r=this.db.prepare(this.sql).run(...this.args);return {meta:{changes:Number(r.changes)}};}async all(){return {results:this.db.prepare(this.sql).all(...this.args)};}}
function fixture(){const raw=new DatabaseSync(':memory:');raw.exec(fs.readFileSync(new URL('../migrations/0041_additional_contact_services.sql',import.meta.url),'utf8'));raw.exec(fs.readFileSync(new URL('../migrations/0043_additional_contact_provider_receipts.sql',import.meta.url),'utf8'));raw.exec(fs.readFileSync(new URL('../migrations/0045_treg_paid_search.sql',import.meta.url),'utf8'));raw.exec(fs.readFileSync(new URL('../migrations/0047_paid_phone_permission.sql',import.meta.url),'utf8'));raw.exec(`CREATE TABLE workspace_service_integrations(workspace_id TEXT,provider TEXT,metadata_json TEXT);CREATE TABLE enrichment_policies(workspace_id TEXT PRIMARY KEY,daily_credit_limit INTEGER,monthly_credit_limit INTEGER);INSERT INTO workspace_service_integrations VALUES('w','apollo','{"email_enrichment_enabled":true}');INSERT INTO enrichment_policies VALUES('w',3,30);`);const DB={prepare:sql=>new Statement(raw,sql),batch:async rows=>Promise.all(rows.map(row=>row.run()))};const now=new Date().toISOString(),people=Array.from({length:4},(_,i)=>({id:'p'+i,name:'Anna '+['BuyerZero','BuyerOne','BuyerTwo','BuyerThree'][i],title:'Head of Procurement',organization:'Example',publicNameUrl:'https://example.com/team/'+i,emailResearch:{status:'complete',searches:5,failed:0,checkedAt:now},contactResearch:{policyVersion:D.BUYER_CONTACT_RESEARCH_POLICY.version,checks:Object.fromEntries([...D.BUYER_CONTACT_RESEARCH_POLICY.requiredChecks,'deep'].map(k=>[k,{status:'complete',checkedAt:now,queryLog:Array.from({length:k==='gmail'?3:k==='direct_email'?2:1},(_,i)=>({query:k+' business source query '+i,status:'complete',checkedAt:now,resultCount:0}))}]))}}));const detail={company:{id:'c',company_name:'Example',normalized_domain:'example.com',lifecycle_status:'prospect'},contacts:[],intelligence:{research_snapshot:{qualification:{eligible:true,researchedAt:now},buyerResearch:{publicResearch:{accountability:{...D.createBuyerResearchAccountability(),status:'complete',completedAt:now,totalPeople:4,checkedPeople:4,officialPages:1}},buyers:people,discovery:{opportunityRoles:['Procurement Director']}}}}};researchReceipts({company:'Example',domain:'example.com',people,publicResearch:detail.intelligence.research_snapshot.buyerResearch.publicResearch});const context={workspaceId:'w',userId:'u',role:'owner'},calls=[];return {raw,env:{DB,APOLLO_API_KEY:'test-only'},context,detail,people,calls,deps:{getCompany:async(_,ctx)=>{if(ctx.workspaceId!=='w')throw Object.assign(Error('Not found'),{status:404});return detail;},resolvePerson:async p=>p,enrich:async()=>{calls.push('paid');return new Response(JSON.stringify({contact:{name:'Anna BuyerZero',work_email:'anna@example.com',email_status:'verified',source:'apollo',verification_provider:'Apollo'},request:{status:'verified'}}),{status:201});}}};}
function currentReview(f){const s=f.detail.intelligence.research_snapshot;return {status:'complete',checkedAt:new Date().toISOString(),inputSignature:D.buyerReviewSignature({company:f.detail.company.company_name,domain:f.detail.company.normalized_domain,fitDescription:s.fitDescription,buyerRoles:s.buyerRoles,buyerRolesChanged:s.buyerRolesChanged,buyerFit:s.buyerFit,evidence:f.detail.intelligence.evidence||[],publicResearch:s.buyerResearch.publicResearch,buyerDiscovery:s.buyerResearch.discovery,people:f.people}),reviewedPersonIds:['p0'],findings:[],conflicts:[]};}
test('policy is off by default and only an owner can authorize scoped paid research',async()=>{const f=fixture();assert.equal((await readAdditionalContactPolicy(f.env,'w')).enabled,false);await assert.rejects(saveAdditionalContactPolicy(f.env,{...f.context,role:'sales'},{enabled:true,dailyLimit:3,monthlyLimit:30,maxPerCompany:2}),/owner/i);await saveAdditionalContactPolicy(f.env,f.context,{enabled:true,dailyLimit:3,monthlyLimit:30,maxPerCompany:2});assert.equal((await readAdditionalContactPolicy(f.env,'w')).enabled,true);assert.equal((await readAdditionalContactPolicy(f.env,'other')).enabled,false);});
test('automatic lookup requires separate upfront approval; manual lookup requires exact per-contact approval',async()=>{const f=fixture();for(const body of [{person_id:'p0',automatic:true},{person_id:'p0'},{person_id:'p0',approved:'true'}])await assert.rejects(lookupAdditionalEmail(f.env,f.context,'c',body,f.deps),/approv/i);assert.equal(f.calls.length,0);await lookupAdditionalEmail(f.env,f.context,'c',{person_id:'p0',approved:true},f.deps);assert.equal(f.calls.length,1);});
test('company, buyer, public research, roster and workspace holds block provider calls',async()=>{for(const mutate of [f=>f.detail.intelligence.research_snapshot.qualification.eligible=false,f=>f.people[0].organization='Wrong employer',f=>f.people[0].emailResearch.status='partial',f=>f.detail.company.lifecycle_status='suppressed',f=>f.context.workspaceId='other']){const f=fixture();mutate(f);await assert.rejects(lookupAdditionalEmail(f.env,f.context,'c',{person_id:'p0',approved:true},f.deps));assert.equal(f.calls.length,0);}});
test('duplicate, concurrent and repeated no-result lookups are cached without paying twice',async()=>{const f=fixture();f.deps.enrich=async()=>{f.calls.push('paid');return new Response(JSON.stringify({contact:null,request:{status:'not_found'}}));};const results=await Promise.all([0,1].map(()=>lookupAdditionalEmail(f.env,f.context,'c',{person_id:'p0',approved:true},f.deps)));assert.equal(f.calls.length,1);assert.ok(results.some(r=>r.cached));await lookupAdditionalEmail(f.env,f.context,'c',{person_id:'p0',approved:true},f.deps);assert.equal(f.calls.length,1);});
test('automatic consent is revocable and atomic company/daily caps stop further provider calls',async()=>{const f=fixture();await saveAdditionalContactPolicy(f.env,f.context,{enabled:true,dailyLimit:1,monthlyLimit:2,maxPerCompany:1});await lookupAdditionalEmail(f.env,f.context,'c',{person_id:'p0',automatic:true},f.deps);await assert.rejects(lookupAdditionalEmail(f.env,f.context,'c',{person_id:'p1',approved:true},f.deps),/limit/i);await saveAdditionalContactPolicy(f.env,f.context,{enabled:false,dailyLimit:1,monthlyLimit:2,maxPerCompany:1});await assert.rejects(lookupAdditionalEmail(f.env,f.context,'c',{person_id:'p2',automatic:true},f.deps),/approv/i);assert.equal(f.calls.length,1);});
test('existing attributable verified contact avoids provider lookup and consumes no reservation',async()=>{const f=fixture();f.detail.contacts=[{external_person_id:'p0',name:'Anna BuyerZero',work_email:'anna@example.com',email_status:'verified',verification_provider:'Apollo',source:'apollo'}];const result=await lookupAdditionalEmail(f.env,f.context,'c',{person_id:'p0',approved:true},f.deps);assert.equal(result.contact.work_email,'anna@example.com');assert.equal(f.calls.length,0);assert.equal(f.raw.prepare('SELECT count(*) n FROM additional_contact_attempts').get().n,0);});
test('public identity enrichment preserves the original buyer-to-CRM link through reload',async()=>{const f=fixture();f.raw.exec("CREATE TABLE crm_contacts(id TEXT,workspace_id TEXT,external_person_id TEXT);INSERT INTO crm_contacts VALUES('saved','w','apollo-real');");f.deps.resolvePerson=async p=>({...p,id:'apollo-real'});f.deps.enrich=async()=>new Response(JSON.stringify({contact:{id:'saved',external_person_id:'apollo-real',name:'Anna BuyerZero',work_email:'anna@example.com',email_status:'verified',source:'apollo',verification_provider:'Apollo'}}));const result=await lookupAdditionalEmail(f.env,f.context,'c',{person_id:'p0',approved:true},f.deps);assert.equal(result.contact.external_person_id,'p0');assert.equal(f.raw.prepare("SELECT external_person_id FROM crm_contacts WHERE id='saved'").get().external_person_id,'p0');});
test('automatic requests cannot target lower priority people after the strongest two or after enough emails exist',async()=>{const f=fixture();await saveAdditionalContactPolicy(f.env,f.context,{enabled:true,dailyLimit:3,monthlyLimit:30,maxPerCompany:2});await assert.rejects(lookupAdditionalEmail(f.env,f.context,'c',{person_id:'p3',automatic:true},f.deps));assert.equal(f.calls.length,0);});
test('stricter provider requirements confirm public attribution then allow the approved paid verification',async()=>{const f=fixture();f.raw.exec(`CREATE TABLE approved_workflows(workspace_id TEXT,config_json TEXT);INSERT INTO approved_workflows VALUES('w','{"buyers":{"confirmationLevel":"provider_verified"}}');`);Object.assign(f.people[0],{publicEmail:'anna@example.com',publicEmailUrl:'https://example.com/team'});f.deps.confirmPublic=async()=>({name:'Anna BuyerZero',work_email:'anna@example.com',email_status:'public_confirmed'});await lookupAdditionalEmail(f.env,f.context,'c',{person_id:'p0',approved:true},f.deps);assert.equal(f.calls.length,1);});
test('a policy limit lowered during preparation is enforced by the atomic reservation',async()=>{const f=fixture();await saveAdditionalContactPolicy(f.env,f.context,{enabled:true,dailyLimit:3,monthlyLimit:30,maxPerCompany:2});let release;const gate=new Promise(r=>release=r);f.deps.getCompany=async()=>{await gate;return f.detail;};const run=lookupAdditionalEmail(f.env,f.context,'c',{person_id:'p0',automatic:true},f.deps);await new Promise(r=>setTimeout(r,0));f.raw.prepare("INSERT INTO additional_contact_attempts(workspace_id,company_id,person_id,month) VALUES('w','c','other',?)").run(new Date().toISOString().slice(0,7));await saveAdditionalContactPolicy(f.env,f.context,{enabled:true,dailyLimit:1,monthlyLimit:1,maxPerCompany:1});release();await assert.rejects(run,/limit/i);assert.equal(f.calls.length,0);});
test('archiving a paid contact cannot resurrect the serialized cached contact',async()=>{const f=fixture();await lookupAdditionalEmail(f.env,f.context,'c',{person_id:'p0',approved:true},f.deps);f.detail.contacts=[];const result=await lookupAdditionalEmail(f.env,f.context,'c',{person_id:'p0',approved:true},f.deps);assert.equal(result.contact,undefined);assert.equal(result.request.status,'needs_review');assert.equal(f.calls.length,1);});
test('known no-charge credit-limit failures can be explicitly retried after funding without duplicate spending',async()=>{const f=fixture(),success=f.deps.enrich;f.deps.enrich=async()=>new Response(JSON.stringify({error:'Credit limit reached',code:'CRM_APOLLO_CREDIT_LIMIT'}),{status:429});await assert.rejects(lookupAdditionalEmail(f.env,f.context,'c',{person_id:'p0',approved:true},f.deps),/Credit/);f.deps.enrich=success;const result=await lookupAdditionalEmail(f.env,f.context,'c',{person_id:'p0',approved:true},f.deps);assert.equal(result.contact?.work_email,'anna@example.com');assert.equal(f.calls.length,1);});

test('legacy research complete cannot authorize a paid contact lookup without mandatory quality evidence',async()=>{const f=fixture();delete f.detail.intelligence.research_snapshot.buyerResearch.publicResearch;await assert.rejects(lookupAdditionalEmail(f.env,f.context,'c',{person_id:'p0',approved:true},f.deps),/mandatory public research/i);assert.equal(f.calls.length,0);});

test('manual provider lookup remains available for a qualified buyer when another identity has a conflict',async()=>{
 const f=fixture();f.detail.intelligence.research_snapshot.buyerResearch.publicResearch.conflicts=[{person_id:'p3'}];
 await lookupAdditionalEmail(f.env,f.context,'c',{person_id:'p0',approved:true},f.deps);assert.equal(f.calls.length,1);
});
test('Hunter lookup requires its own explicit approval and its enabled customer credential',async()=>{
 const f=fixture();f.env.HUNTER_API_KEY='test-hunter';f.raw.exec(`INSERT INTO workspace_service_integrations VALUES('w','hunter','{"additional_verification_enabled":true}');`);
 await assert.rejects(lookupAdditionalEmail(f.env,f.context,'c',{person_id:'p0',approved:true,provider:'hunter'},f.deps),/Hunter.*approval/i);
 assert.equal(f.calls.length,0);
});

test('separate provider receipts permit Hunter after Apollo misses without buying either result twice',async()=>{
 const f=fixture();f.raw.exec(`INSERT INTO workspace_service_integrations VALUES('w','hunter','{"additional_verification_enabled":true}');`);
 f.deps.enrich=async()=>{f.calls.push('apollo');return new Response(JSON.stringify({contact:null,request:{status:'not_found'}}));};
 f.deps.findHunter=async()=>{f.calls.push('hunter');return {contact:null,research:{provider:'hunter',status:'not_found'}};};
 const input={person_id:'p0',approved:true};await lookupAdditionalEmail(f.env,f.context,'c',input,f.deps);
 for(let i=0;i<2;i++)await lookupAdditionalEmail(f.env,f.context,'c',{...input,provider:'hunter',hunter_approved:true},f.deps);
 await lookupAdditionalEmail(f.env,f.context,'c',input,f.deps);
 assert.deepEqual(f.calls,['apollo','hunter']);assert.equal(f.raw.prepare('SELECT count(*) n FROM additional_contact_attempts').get().n,2);
});
test('Hunter fallback keeps the distinct-buyer cap and enforces the combined daily provider-call cap',async()=>{
 const f=fixture();f.raw.exec(`INSERT INTO workspace_service_integrations VALUES('w','hunter','{"additional_verification_enabled":true}');`);
 await saveAdditionalContactPolicy(f.env,f.context,{enabled:false,dailyLimit:2,monthlyLimit:30,maxPerCompany:1});
 f.deps.enrich=async()=>new Response(JSON.stringify({contact:null}));f.deps.findHunter=async()=>({contact:null});
 await lookupAdditionalEmail(f.env,f.context,'c',{person_id:'p0',approved:true},f.deps);
 await lookupAdditionalEmail(f.env,f.context,'c',{person_id:'p0',approved:true,provider:'hunter',hunter_approved:true},f.deps);
 await assert.rejects(lookupAdditionalEmail(f.env,f.context,'c',{person_id:'p1',approved:true},f.deps),/limit/);
});
import {findHunterWorkEmail} from '../src/hunter-contact-research.js';
function hunterDeps(data,verification={email:'anna@example.com',status:'valid'}){const calls=[];return {calls,credential:async()=>({source:'customer',apiKey:'test'}),fetch:async url=>{calls.push(url);return new Response(JSON.stringify({data:url.includes('/email-finder?')?data:verification}));},save:async email=>({id:'saved',name:'Anna BuyerZero',work_email:email,email_status:'verified',source:'hunter',verification_provider:'Hunter'})};}
test('Hunter finder plus verifier confirms exact named work email, retaining the actual provider receipt',async()=>{
 const f=fixture(),deps=hunterDeps({first_name:'Anna',last_name:'BuyerZero',email:'anna@example.com'});
 const result=await findHunterWorkEmail(f.env,f.context,{domain:'example.com'},f.people[0],'c',deps);
 assert.equal(result.contact.work_email,'anna@example.com');assert.equal(result.research.provider,'hunter');assert.equal(result.verification.deliverability,'deliverable');assert.equal(deps.calls.length,2);
});
test('wrong person, wrong domain, catch-all and mismatched verification never become usable contacts',async()=>{
 const f=fixture();
 for(const data of [{first_name:'Other',last_name:'Person',email:'anna@example.com'},{first_name:'Anna',last_name:'BuyerZero',email:'anna@wrong.example'},{first_name:'Anna',last_name:'BuyerZero',full_name:'Another Person',email:'anna@example.com'},{first_name:'Ann A',last_name:'BuyerZero',full_name:'Ann A BuyerZero',email:'anna@example.com'}]){
  const deps=hunterDeps(data);await assert.rejects(findHunterWorkEmail(f.env,f.context,{domain:'example.com'},f.people[0],'c',deps),/exact buyer/);assert.equal(deps.calls.length,1);
 }
 for(const verification of [{email:'anna@example.com',status:'accept_all'},{email:'anna@example.com',status:'valid',accept_all:true}]){
  const result=await findHunterWorkEmail(f.env,f.context,{domain:'example.com'},f.people[0],'c',hunterDeps({first_name:'Anna',last_name:'BuyerZero',email:'anna@example.com'},verification));assert.equal(result.contact,null);
 }
 await assert.rejects(findHunterWorkEmail(f.env,f.context,{domain:'example.com'},f.people[0],'c',hunterDeps({first_name:'Anna',last_name:'BuyerZero',email:'anna@example.com'},{email:'other@example.com',status:'valid'})),/different address/);
});
test('Hunter uses only a customer-owned key and preserves no-result versus failed-request outcomes',async()=>{
 const f=fixture(),deps=hunterDeps({});let result=await findHunterWorkEmail(f.env,f.context,{domain:'example.com'},f.people[0],'c',deps);assert.equal(result.research.status,'not_found');assert.equal(deps.calls.length,1);
 deps.credential=async()=>({source:'platform',apiKey:'shared'});await assert.rejects(findHunterWorkEmail(f.env,f.context,{domain:'example.com'},f.people[0],'c',deps),/your Hunter account/);
 deps.credential=async()=>({source:'customer',apiKey:'test'});deps.fetch=async()=>new Response('{}',{status:402});await assert.rejects(findHunterWorkEmail(f.env,f.context,{domain:'example.com'},f.people[0],'c',deps),/credits exhausted/);
});
test('provider migration preserves the existing cached Apollo receipt and timestamp',()=>{
 const raw=new DatabaseSync(':memory:');raw.exec(fs.readFileSync(new URL('../migrations/0041_additional_contact_services.sql',import.meta.url),'utf8'));
 raw.exec(`INSERT INTO additional_contact_attempts(workspace_id,company_id,person_id,month,status,result_json,created_at) VALUES('w','c','p','2026-10','not_found','{"reason":"earlier lookup"}','2026-10-20 12:00:00')`);
 raw.exec(fs.readFileSync(new URL('../migrations/0043_additional_contact_provider_receipts.sql',import.meta.url),'utf8'));
 const row=raw.prepare('SELECT * FROM additional_contact_attempts').get();assert.equal(row.provider,'apollo');assert.equal(row.created_at,'2026-10-20 12:00:00');assert.equal(JSON.parse(row.result_json).reason,'earlier lookup');
});
test('verified Hunter result is stored as a trusted scoped CRM contact and survives a real CRM read',async()=>{
 const f=fixture();for(const file of ['0011_master_crm.sql','0012_crm_contact_enrichment.sql','0022_crm_public_contact_sources.sql'])f.raw.exec(fs.readFileSync(new URL('../migrations/'+file,import.meta.url),'utf8'));
 f.raw.exec(`ALTER TABLE workspace_service_integrations ADD COLUMN last_used_at TEXT;ALTER TABLE workspace_service_integrations ADD COLUMN updated_at TEXT;
 INSERT INTO crm_companies(id,workspace_id,normalized_domain,company_name,lifecycle_status,first_seen_at,last_seen_at,created_at,updated_at) VALUES('c','w','example.com','Example','prospect','now','now','now','now');`);
 const deps=hunterDeps({first_name:'Anna',last_name:'BuyerZero',email:'anna@example.com',verification:{status:'valid'}});delete deps.save;
 const result=await findHunterWorkEmail(f.env,f.context,{domain:'example.com'},f.people[0],'c',deps);
 const saved=f.raw.prepare('SELECT * FROM crm_contacts WHERE workspace_id=? AND id=?').get('w',result.contact.id);
 assert.equal(saved.work_email,'anna@example.com');assert.equal(saved.external_person_id,'p0');assert.equal(saved.email_status,'verified');assert.equal(saved.verification_provider,'Hunter');
 assert.equal(globalThis.LeadIntelContactPolicy.accepted(saved,'example.com','provider_verified'),true);
 assert.equal(f.raw.prepare("SELECT count(*) n FROM crm_activities WHERE workspace_id='w' AND activity_type='contact.enriched'").get().n,1);
});

test('manual data research reuses confirmed email but still requests profile and explicitly approved phone',async()=>{
 const f=fixture();f.raw.exec("INSERT INTO additional_contact_policies(workspace_id,enabled,phone_enabled,provider) VALUES('w',1,1,'treg')");f.detail.contacts=[{id:'saved',external_person_id:'p0',name:'Anna BuyerZero',work_email:'anna@example.com',email_status:'verified',source:'treg',verification_provider:'Treg'}];
 f.deps.credential=async()=>({configured:true});let options;
 f.deps.findTreg=async(e,c,company,person,id,input)=>{options=input;return {contact:f.detail.contacts[0],contactData:{status:'updated',profile:{status:'provider_reported'},phone:{status:'provider_listed'}},research:{status:'verified'}};};
 const result=await lookupAdditionalEmail(f.env,f.context,'c',{person_id:'p0',provider:'treg',approved:true,data_lookup:true,phone_approved:true},f.deps);
 assert.equal(options.dataLookup,true);assert.equal(options.includePhone,true);assert.equal(options.existingContact.id,'saved');assert.equal(result.contactData.status,'updated');
});
test('automatic requests cannot upgrade email-only consent into manual profile or phone purchases',async()=>{
 const f=fixture();f.deps.credential=async()=>({configured:true});await saveAdditionalContactPolicy(f.env,f.context,{enabled:true,provider:'apollo',dailyLimit:3,monthlyLimit:30,maxPerCompany:1});f.raw.exec("UPDATE additional_contact_policies SET provider='treg'");
 for(const extra of [{data_lookup:true,phone_approved:true},{phone_approved:true}])await assert.rejects(lookupAdditionalEmail(f.env,f.context,'c',{person_id:'p0',provider:'treg',automatic:true,...extra},f.deps),/approval|off/i);
 assert.equal(f.calls.length,0);
});

test('manual profile and listed phone persist to the exact CRM buyer and replay without another paid phase',async()=>{
 for(const reorder of [false,true]){
 const {findTregWorkEmail}=await import('../src/treg-contact-research.js');const f=fixture();
 for(const file of ['0011_master_crm.sql','0012_crm_contact_enrichment.sql','0022_crm_public_contact_sources.sql'])f.raw.exec(fs.readFileSync(new URL('../migrations/'+file,import.meta.url),'utf8'));
 f.raw.exec("ALTER TABLE workspace_service_integrations ADD COLUMN last_used_at TEXT;ALTER TABLE workspace_service_integrations ADD COLUMN updated_at TEXT;INSERT INTO crm_companies(id,workspace_id,normalized_domain,company_name,lifecycle_status,first_seen_at,last_seen_at,created_at,updated_at) VALUES('c','w','example.com','Example','prospect','now','now','now','now');");
 f.raw.prepare("INSERT INTO crm_intelligence(company_id,workspace_id,research_snapshot_json,intelligence_updated_at) VALUES('c','w',?,'now')").run(JSON.stringify(f.detail.intelligence.research_snapshot));
 const original=f.env.DB.prepare;if(reorder)f.env.DB.prepare=sql=>{if(sql.startsWith('UPDATE crm_intelligence SET research_snapshot_json')){const row=f.raw.prepare("SELECT research_snapshot_json FROM crm_intelligence WHERE company_id='c'").get(),snapshot=JSON.parse(row.research_snapshot_json);snapshot.buyerResearch.buyers.reverse();f.raw.prepare("UPDATE crm_intelligence SET research_snapshot_json=? WHERE company_id='c'").run(JSON.stringify(snapshot));}return original(sql);};
 const calls=[],deps={credential:async()=>({source:'customer',apiKey:'test-token'}),fetch:async(url,options)=>{calls.push(url);return Response.json(url.includes('email.find')?{output:{}}:url.includes('people.enrich')?{output:{full_name:'Anna BuyerZero',company_domain:'example.com',title:'Director',city:'Riga'}}:{output:{phone:'+37120000001'}},{headers:{'X-Treg-Call-Id':url.split('/').pop(),'X-Treg-Cost-Micro':'4000'}});}};
 for(let i=0;i<2;i++){
  const result=await findTregWorkEmail(f.env,f.context,{company:'Example',domain:'example.com'},f.people[0],'c',{attemptKey:'month-a',dataLookup:true,includePhone:true},deps);
  assert.equal(result.contact.phone_number,'+37120000001');assert.equal(result.contact.phone_status,'provider_listed');assert.equal(result.contact.email_status,null);assert.equal(result.cached,i===1);
 }
 const snapshot=JSON.parse(f.raw.prepare("SELECT research_snapshot_json FROM crm_intelligence WHERE company_id='c'").get().research_snapshot_json);
 assert.equal(snapshot.buyerResearch.buyers.find(p=>p.id==='p0').contactData.profile.city,'Riga');assert.equal(snapshot.buyerResearch.buyers.find(p=>p.id==='p1').contactData,undefined);assert.equal(calls.length,3);assert.equal(f.raw.prepare('SELECT COUNT(*) n FROM crm_contacts').get().n,1);
 f.raw.exec("UPDATE crm_contacts SET phone_number='+37120000002',phone_status='manual'");
 await findTregWorkEmail(f.env,f.context,{company:'Example',domain:'example.com'},snapshot.buyerResearch.buyers.find(p=>p.id==='p0'),'c',{attemptKey:'month-a',dataLookup:true,includePhone:false},deps);
 assert.equal(f.raw.prepare('SELECT phone_number FROM crm_contacts').get().phone_number,'+37120000002');assert.equal(calls.length,3);
 }
});

test('phone approval persists independently and legacy email updates preserve it',async()=>{
 const f=fixture();assert.equal((await readAdditionalContactPolicy(f.env,'w')).phoneEnabled,false);
 await saveAdditionalContactPolicy(f.env,f.context,{enabled:false,phoneEnabled:true,provider:'apollo',dailyLimit:3,monthlyLimit:30,maxPerCompany:1});
 assert.equal((await readAdditionalContactPolicy(f.env,'w')).phoneEnabled,true);
 await saveAdditionalContactPolicy(f.env,f.context,{enabled:true,provider:'apollo',dailyLimit:3,monthlyLimit:30,maxPerCompany:1});
 assert.equal((await readAdditionalContactPolicy(f.env,'w')).phoneEnabled,true);assert.equal((await readAdditionalContactPolicy(f.env,'other')).phoneEnabled,false);
 await assert.rejects(saveAdditionalContactPolicy(f.env,f.context,{enabled:true,phoneEnabled:'true',dailyLimit:3,monthlyLimit:30,maxPerCompany:1}),/phone|valid/i);
});
test('Treg ignores attempts to bypass disabled email or phone permissions in manual and automatic calls',async()=>{
 const f=fixture();f.deps.credential=async()=>({configured:true});f.deps.findTreg=async()=>{f.calls.push('paid');return {research:{status:'not_found'}};};
 for(const automatic of [false,true])for(const request of [{data_lookup:true,phone_approved:true,email_lookup:false},{data_lookup:false}]){
  await assert.rejects(lookupAdditionalEmail(f.env,f.context,'c',{person_id:'p0',provider:'treg',approved:!automatic,automatic,...request},f.deps),/off|approved|approval|deactivated/i);
 }
 assert.equal(f.calls.length,0);
});
test('phone-only saved consent permits automatic strongest-buyer lookup with a saved email and no email purchase',async()=>{
 const f=fixture();f.raw.exec("INSERT INTO additional_contact_policies(workspace_id,enabled,phone_enabled,provider,max_per_company) VALUES('w',0,1,'treg',1)");
 f.detail.intelligence.research_snapshot.qualification.score=85;
 f.detail.intelligence.research_snapshot.buyerResearch.publicResearch.aiReview=currentReview(f);
 f.detail.contacts=[{id:'saved',external_person_id:'p0',name:'Anna BuyerZero',work_email:'anna@example.com',email_status:'verified',source:'treg',verification_provider:'Treg'}];
 f.deps.credential=async()=>({configured:true});let called;
 f.deps.findTreg=async(e,c,candidate,person,id,options)=>{called=options;return {contact:f.detail.contacts[0],contactData:{phone:{status:'provider_listed',number:'+37120000001'}},research:{status:'verified'}};};
 const result=await lookupAdditionalEmail(f.env,f.context,'c',{person_id:'p0',provider:'treg',automatic:true,data_lookup:true,phone_approved:true,email_lookup:false},f.deps);
 assert.equal(called.includeEmail,false);assert.equal(called.includePhone,true);assert.equal(result.contactData.phone.number,'+37120000001');
});

test('canonical contact reuse cannot attach a different identity, role or conflicting profile',async()=>{
 for(const patch of [{name:'Other Buyer'},{title:'Wrong role'},{linkedin_url:'https://www.linkedin.com/in/other'}]){
  const f=fixture();f.raw.exec("INSERT INTO additional_contact_policies(workspace_id,enabled,phone_enabled,provider) VALUES('w',0,1,'treg')");
  f.people[0].publicLinkedinUrl='https://www.linkedin.com/in/anna';researchReceipts({company:'Example',domain:'example.com',people:f.people,publicResearch:f.detail.intelligence.research_snapshot.buyerResearch.publicResearch});f.detail.contacts=[{id:'saved',external_person_id:'old-id',name:'Anna BuyerZero',title:'Head of Procurement',work_email:'anna@example.com',email_status:'verified',verification_provider:'Treg',source:'treg',...patch}];
  f.deps.credential=async()=>({configured:true});f.deps.findTreg=async(e,c,candidate,person,id,options)=>{assert.equal(options.existingContact,null);return {contact:null,research:{status:'not_found'}};};
  await assert.rejects(lookupAdditionalEmail(f.env,f.context,'c',{person_id:'p0',contact_id:'saved',provider:'treg',approved:true,data_lookup:true,phone_approved:true,email_lookup:false},f.deps),/saved contact|identity/i);
 }
});
test('company quota reports the exact application hold without dispatching a provider',async()=>{
 const f=fixture();await saveAdditionalContactPolicy(f.env,f.context,{enabled:true,dailyLimit:5,monthlyLimit:30,maxPerCompany:1});
 f.raw.prepare("INSERT INTO additional_contact_attempts(workspace_id,company_id,person_id,month,status) VALUES('w','c','other',?,'not_found')").run(new Date().toISOString().slice(0,7));
 await assert.rejects(lookupAdditionalEmail(f.env,f.context,'c',{person_id:'p0',approved:true},f.deps),e=>e.code==='ADDITIONAL_CONTACT_COMPANY_LIMIT'&&/1\/1/.test(e.message)&&/No provider lookup/.test(e.message));assert.equal(f.calls.length,0);
});
test('Treg retry retains its reservation and persists the recovered result',async()=>{
 const f=fixture(),month=new Date().toISOString().slice(0,7);f.raw.exec("INSERT INTO additional_contact_policies(workspace_id,enabled,phone_enabled,provider) VALUES('w',1,1,'treg')");f.deps.credential=async()=>({configured:true});
 f.deps.findTreg=async(e,c,candidate,person,id,{onDispatch})=>{await onDispatch();throw Object.assign(Error('Provider outcome uncertain'),{code:'TREG_RETRY_SAME_LOOKUP'});};
 await assert.rejects(lookupAdditionalEmail(f.env,f.context,'c',{person_id:'p0',provider:'treg',approved:true,data_lookup:true,phone_approved:true},f.deps),/uncertain/);
 f.deps.findTreg=async()=>({contact:null,request:{status:'not_found'},research:{status:'not_found'}});
 await lookupAdditionalEmail(f.env,f.context,'c',{person_id:'p0',provider:'treg',approved:true,data_lookup:true,phone_approved:true},f.deps);
 const row=f.raw.prepare("SELECT status,result_json FROM additional_contact_attempts WHERE person_id='p0'").get();assert.equal(row?.status,'not_found');assert.match(row.result_json,/not_found/);
});
test('daily and monthly app limits identify the exhausted scope without provider calls',async()=>{
 for(const scope of ['daily','monthly']){
  const f=fixture();await saveAdditionalContactPolicy(f.env,f.context,{enabled:true,dailyLimit:1,monthlyLimit:1,maxPerCompany:2});
  f.raw.prepare("INSERT INTO additional_contact_attempts(workspace_id,company_id,person_id,month,status,created_at) VALUES('w','different','other',?,'not_found',?)").run(new Date().toISOString().slice(0,7),scope==='daily'?new Date().toISOString().slice(0,10)+' 01:00:00':'2000-01-01 00:00:00');
  await assert.rejects(lookupAdditionalEmail(f.env,f.context,'c',{person_id:'p0',approved:true},f.deps),e=>e.code==='ADDITIONAL_CONTACT_'+scope.toUpperCase()+'_LIMIT');assert.equal(f.calls.length,0);
 }
});
test('explicit manual Treg lookups can research each selected buyer while preserving daily limits',async()=>{
 const f=fixture();f.raw.exec("INSERT INTO additional_contact_policies(workspace_id,enabled,phone_enabled,provider,daily_limit,monthly_limit,max_per_company) VALUES('w',1,1,'treg',2,30,1)");f.deps.credential=async()=>({configured:true});let calls=0;f.deps.findTreg=async()=>{calls++;return {contact:null,request:{status:'not_found'}};};
 for(const id of ['p0','p1'])await lookupAdditionalEmail(f.env,f.context,'c',{person_id:id,provider:'treg',approved:true,data_lookup:true,phone_approved:false},f.deps);
 assert.equal(calls,2);await assert.rejects(lookupAdditionalEmail(f.env,f.context,'c',{person_id:'p2',provider:'treg',approved:true,data_lookup:true},f.deps),e=>e.code==='ADDITIONAL_CONTACT_DAILY_LIMIT');assert.equal(calls,2);
});
test('a retained Hunter preference cannot add a hidden verification requirement to the Treg workflow',async()=>{
 const {hunterVerificationPolicy}=await import('../src/service-integrations.js'),f=fixture();f.raw.exec("INSERT INTO additional_contact_policies(workspace_id,enabled,provider) VALUES('w',1,'treg');INSERT INTO workspace_service_integrations VALUES('w','hunter','{\"additional_verification_enabled\":true}')");f.raw.exec('ALTER TABLE workspace_service_integrations ADD COLUMN encrypted_api_key TEXT;ALTER TABLE workspace_service_integrations ADD COLUMN key_hint TEXT;ALTER TABLE workspace_service_integrations ADD COLUMN verified_at TEXT;ALTER TABLE workspace_service_integrations ADD COLUMN last_used_at TEXT;');const policy=await hunterVerificationPolicy(f.env,'w');assert.equal(policy.enabled,false);assert.equal(policy.configured,true);
});
test('automatic Treg research requires a completed current AI review of the selected buyer before spending',async()=>{
 const f=fixture();f.raw.exec("INSERT INTO additional_contact_policies(workspace_id,enabled,provider,max_per_company) VALUES('w',1,'treg',1)");f.detail.intelligence.research_snapshot.qualification.score=85;f.deps.credential=async()=>({configured:true});let calls=0;f.deps.findTreg=async()=>{calls++;return {contact:null,request:{status:'not_found'}};};
 await assert.rejects(lookupAdditionalEmail(f.env,f.context,'c',{person_id:'p0',provider:'treg',automatic:true},f.deps),e=>e.code==='ADDITIONAL_CONTACT_REVIEW_REQUIRED');assert.equal(calls,0);
 f.detail.intelligence.research_snapshot.buyerResearch.publicResearch.aiReview=currentReview(f);await lookupAdditionalEmail(f.env,f.context,'c',{person_id:'p0',provider:'treg',automatic:true},f.deps);assert.equal(calls,1);
});

test('interrupted Treg calls retain daily and monthly budget while the saved lookup remains resumable',async()=>{
 for(const scope of ['daily','monthly']){
  const f=fixture();f.raw.exec("INSERT INTO additional_contact_policies(workspace_id,enabled,provider,daily_limit,monthly_limit) VALUES('w',1,'treg',1,1)");f.deps.credential=async()=>({configured:true});let calls=0;
  f.deps.findTreg=async(e,c,candidate,person,id,{onDispatch})=>{await onDispatch();calls++;throw Object.assign(Error('Retry the saved lookup'),{code:'TREG_RETRY_SAME_LOOKUP'});};
  await assert.rejects(lookupAdditionalEmail(f.env,f.context,'c',{person_id:'p0',provider:'treg',approved:true},f.deps),/saved lookup/);
  if(scope==='monthly')f.raw.exec("UPDATE additional_contact_attempts SET created_at='2000-01-01 00:00:00'");
  await assert.rejects(lookupAdditionalEmail(f.env,f.context,'c',{person_id:'p1',provider:'treg',approved:true},f.deps),e=>e.code==='ADDITIONAL_CONTACT_'+scope.toUpperCase()+'_LIMIT');
  assert.equal(calls,1);
  f.deps.findTreg=async()=>{calls++;return {contact:null,request:{status:'not_found'}};};
  await lookupAdditionalEmail(f.env,f.context,'c',{person_id:'p0',provider:'treg',approved:true},f.deps);assert.equal(calls,2);
 }
});
test('aborting manual paid research before dispatch consumes no reservation or provider call',async()=>{
 const f=fixture(),controller=new AbortController();controller.abort();
 await assert.rejects(lookupAdditionalEmail(f.env,f.context,'c',{person_id:'p0',approved:true},{...f.deps,signal:controller.signal}),e=>e.code==='ADDITIONAL_CONTACT_CANCELLED');
 assert.equal(f.calls.length,0);assert.equal(f.raw.prepare('SELECT COUNT(*) n FROM additional_contact_attempts').get().n,0);
});
test('aborting a submitted manual Treg lookup stops subsequent phases through the shared guard',async()=>{
 const f=fixture(),controller=new AbortController();f.raw.exec("INSERT INTO additional_contact_policies(workspace_id,enabled,provider) VALUES('w',1,'treg')");f.deps.credential=async()=>({configured:true});let nextPhase=false;
 f.deps.findTreg=async(e,c,candidate,person,id,{guard,onDispatch})=>{await onDispatch();controller.abort();await guard({phase:'verify'});nextPhase=true;return {contact:null};};
 await assert.rejects(lookupAdditionalEmail(f.env,f.context,'c',{person_id:'p0',provider:'treg',approved:true},{...f.deps,signal:controller.signal}),e=>e.code==='ADDITIONAL_CONTACT_CANCELLED');assert.equal(nextPhase,false);
});
test('the HTTP paid research route forwards client cancellation to the lookup boundary',async()=>{
 const {handleAdditionalContactRoute}=await import('../src/additional-contact-services.js'),{sha256}=await import('../src/security.js'),f=fixture(),controller=new AbortController();
 f.raw.exec('CREATE TABLE sessions(token_hash TEXT,user_id TEXT,expires_at TEXT);CREATE TABLE workspace_members(workspace_id TEXT,user_id TEXT,role TEXT)');
 f.raw.prepare("INSERT INTO sessions VALUES(?,'u','2099-01-01')").run(await sha256('test-session'));f.raw.exec("INSERT INTO workspace_members VALUES('w','u','owner')");controller.abort();
 const request=new Request('https://leadintel.test/api/additional-contact-services/email?workspace_id=w',{method:'POST',headers:{Cookie:'leadintel_session=test-session','Content-Type':'application/json'},body:JSON.stringify({company_id:'c',person_id:'p0',approved:true}),signal:controller.signal});
 const response=await handleAdditionalContactRoute(request,f.env);assert.equal((await response.json()).code,'ADDITIONAL_CONTACT_CANCELLED');assert.equal(f.calls.length,0);
});
test('automatic Treg research rejects a review whose identity inputs changed after supervision',async()=>{
 const f=fixture();f.raw.exec("INSERT INTO additional_contact_policies(workspace_id,enabled,provider,max_per_company) VALUES('w',1,'treg',1)");f.detail.intelligence.research_snapshot.qualification.score=85;f.deps.credential=async()=>({configured:true});let calls=0;f.deps.findTreg=async()=>{calls++;return {contact:null,request:{status:'not_found'}};};
 const snapshot=f.detail.intelligence.research_snapshot,candidate={company:'Example',domain:'example.com',qualification:snapshot.qualification,publicResearch:snapshot.buyerResearch.publicResearch,buyerDiscovery:snapshot.buyerResearch.discovery,people:f.people};
 snapshot.buyerResearch.publicResearch.aiReview={status:'complete',checkedAt:new Date().toISOString(),inputSignature:D.buyerReviewSignature(candidate),reviewedPersonIds:['p0'],findings:[],conflicts:[]};
 f.people[0].title='Procurement Director';researchReceipts(candidate);
 await assert.rejects(lookupAdditionalEmail(f.env,f.context,'c',{person_id:'p0',provider:'treg',automatic:true},f.deps),e=>e.code==='ADDITIONAL_CONTACT_REVIEW_REQUIRED');assert.equal(calls,0);
});

test('an unspent Treg hold must reacquire budget before it can be retried',async()=>{
 const f=fixture(),month=new Date().toISOString().slice(0,7);f.raw.exec("INSERT INTO additional_contact_policies(workspace_id,enabled,provider,daily_limit,monthly_limit) VALUES('w',1,'treg',1,1)");f.deps.credential=async()=>({configured:true});let calls=0;
 f.raw.prepare("INSERT INTO additional_contact_attempts(workspace_id,company_id,person_id,month,provider,status,result_json) VALUES('w','c','p0',?,'treg','retryable',?)").run(month,JSON.stringify({provider_started:false,error:'pre-dispatch cancellation'}));
 f.deps.findTreg=async()=>{calls++;return {contact:null,request:{status:'not_found'}};};
 await lookupAdditionalEmail(f.env,f.context,'c',{person_id:'p1',provider:'treg',approved:true},f.deps);
 await assert.rejects(lookupAdditionalEmail(f.env,f.context,'c',{person_id:'p0',provider:'treg',approved:true},f.deps),e=>e.code==='ADDITIONAL_CONTACT_DAILY_LIMIT');assert.equal(calls,1);
});

test('Hunter cancellation after finding stops verification and leaves the paid attempt reserved',async()=>{
 const f=fixture(),controller=new AbortController();f.raw.exec("INSERT INTO workspace_service_integrations VALUES('w','hunter','{\"additional_verification_enabled\":true}')");let calls=0;
 f.deps.findHunter=(env,context,candidate,person,companyId,options)=>findHunterWorkEmail(env,context,candidate,person,companyId,{...options,credential:async()=>({source:'customer',apiKey:'test'}),fetch:async()=>{calls++;controller.abort();return Response.json({data:{email:'anna@example.com',first_name:'Anna',last_name:'BuyerZero'}});},save:async()=>{throw Error('Cancelled contact must not be saved');}});
 await assert.rejects(lookupAdditionalEmail(f.env,f.context,'c',{person_id:'p0',provider:'hunter',hunter_approved:true,approved:true},{...f.deps,signal:controller.signal}),e=>e.code==='ADDITIONAL_CONTACT_CANCELLED');assert.equal(calls,1);
 assert.equal(f.raw.prepare('SELECT status FROM additional_contact_attempts').get().status,'needs_review');
});

test('automatic Treg activation never authorizes legacy Apollo spending',async()=>{
 const f=fixture();f.raw.exec("INSERT INTO additional_contact_policies(workspace_id,enabled,provider) VALUES('w',1,'treg')");
 await assert.rejects(lookupAdditionalEmail(f.env,f.context,'c',{person_id:'p0',provider:'apollo',automatic:true},f.deps),e=>e.code==='ADDITIONAL_CONTACT_APPROVAL_REQUIRED');assert.equal(f.calls.length,0);assert.equal(f.raw.prepare('SELECT COUNT(*) n FROM additional_contact_attempts').get().n,0);
 // Explicit per-contact legacy approval remains independent of Treg consent.
 await lookupAdditionalEmail(f.env,f.context,'c',{person_id:'p0',provider:'apollo',approved:true},f.deps);assert.equal(f.calls.length,1);
});

test('a later pre-dispatch hold cannot release the budget of an already submitted Treg retry',async()=>{
 const f=fixture();f.raw.exec("INSERT INTO additional_contact_policies(workspace_id,enabled,provider,daily_limit,monthly_limit) VALUES('w',1,'treg',1,1)");f.deps.credential=async()=>({configured:true});
 f.deps.findTreg=async(e,c,candidate,person,id,{onDispatch})=>{await onDispatch();throw Object.assign(Error('Provider outcome uncertain'),{code:'TREG_RETRY_SAME_LOOKUP'});};
 await assert.rejects(lookupAdditionalEmail(f.env,f.context,'c',{person_id:'p0',provider:'treg',approved:true},f.deps),/uncertain/);
 let checks=0;f.deps.guard=async()=>{if(++checks===2)throw Error('Buyer context changed before resume');};
 await assert.rejects(lookupAdditionalEmail(f.env,f.context,'c',{person_id:'p0',provider:'treg',approved:true},f.deps),/context changed/);delete f.deps.guard;
 f.deps.findTreg=async()=>({contact:null,request:{status:'not_found'}});
 await assert.rejects(lookupAdditionalEmail(f.env,f.context,'c',{person_id:'p1',provider:'treg',approved:true},f.deps),e=>e.code==='ADDITIONAL_CONTACT_DAILY_LIMIT');
});

test('Hunter token replacement after finder stops verification and saving',async()=>{
 const f=fixture(),deps=hunterDeps({first_name:'Anna',last_name:'BuyerZero',email:'anna@example.com'});let key='initial';
 deps.credential=async()=>({source:'customer',apiKey:key});const original=deps.fetch;deps.fetch=async(...args)=>{const response=await original(...args);key='replacement';return response;};
 await assert.rejects(findHunterWorkEmail(f.env,f.context,{domain:'example.com'},f.people[0],'c',deps),error=>error.code==='ADDITIONAL_CONTACT_PROVIDER_CHANGED');assert.equal(deps.calls.length,1);
});
test('Hunter malformed successful responses remain failed attempts rather than no-result evidence',async()=>{
 const f=fixture(),deps=hunterDeps({});deps.fetch=async()=>new Response('not-json');
 await assert.rejects(findHunterWorkEmail(f.env,f.context,{domain:'example.com'},f.people[0],'c',deps),error=>error.code==='ADDITIONAL_CONTACT_HUNTER');
});

test('changing a retained buyer identity cannot buy new Treg phases on the earlier reservation',async()=>{
 const f=fixture();f.raw.exec("INSERT INTO additional_contact_policies(workspace_id,enabled,provider) VALUES('w',1,'treg')");f.deps.credential=async()=>({configured:true});let calls=0;
 f.deps.findTreg=async(e,c,candidate,person,id,{onDispatch})=>{await onDispatch();calls++;return {contact:null,request:{status:'not_found'}};};
 const input={person_id:'p0',provider:'treg',approved:true,data_lookup:true};await lookupAdditionalEmail(f.env,f.context,'c',input,f.deps);
 f.people[0].name='Different Buyer';researchReceipts({company:'Example',domain:'example.com',people:f.people,publicResearch:f.detail.intelligence.research_snapshot.buyerResearch.publicResearch});
 await assert.rejects(lookupAdditionalEmail(f.env,f.context,'c',input,f.deps),error=>error.code==='ADDITIONAL_CONTACT_IDENTITY_CHANGED');assert.equal(calls,1);assert.equal(f.raw.prepare('SELECT COUNT(*) n FROM additional_contact_attempts').get().n,1);
});

test('a concurrent undispatched worker cannot release another worker’s submitted Treg reservation',async()=>{
 const f=fixture();f.raw.exec("INSERT INTO additional_contact_policies(workspace_id,enabled,provider,daily_limit,monthly_limit) VALUES('w',1,'treg',1,1)");f.deps.credential=async()=>({configured:true});
 let firstEntered,releaseFirst,calls=0;const entered=new Promise(r=>firstEntered=r),gate=new Promise(r=>releaseFirst=r);
 f.deps.findTreg=async(e,c,candidate,person,id,{onDispatch})=>{if(++calls===1){firstEntered();await gate;throw Error('First worker held before dispatch');}await onDispatch();throw Object.assign(Error('Second worker submitted; outcome uncertain'),{code:'TREG_RETRY_SAME_LOOKUP'});};
 const input={person_id:'p0',provider:'treg',approved:true},first=lookupAdditionalEmail(f.env,f.context,'c',input,f.deps);await entered;
 await assert.rejects(lookupAdditionalEmail(f.env,f.context,'c',input,f.deps),/uncertain/);releaseFirst();await assert.rejects(first,/before dispatch/);
 const row=f.raw.prepare('SELECT result_json FROM additional_contact_attempts').get();assert.equal(JSON.parse(row.result_json).provider_started,true);
 await assert.rejects(lookupAdditionalEmail(f.env,f.context,'c',{...input,person_id:'p1'},f.deps),error=>error.code==='ADDITIONAL_CONTACT_DAILY_LIMIT');assert.equal(calls,2);
});

test('revoking Hunter permission after finding retains the submitted attempt and stops verification',async()=>{
 const f=fixture();f.raw.exec(`INSERT INTO workspace_service_integrations VALUES('w','hunter','{"additional_verification_enabled":true}')`);let calls=0,saved=0;
 f.deps.findHunter=(env,context,candidate,person,id,options)=>findHunterWorkEmail(env,context,candidate,person,id,{...options,credential:async()=>({source:'customer',apiKey:'test'}),fetch:async()=>{calls++;f.raw.exec(`UPDATE workspace_service_integrations SET metadata_json='{"additional_verification_enabled":false}' WHERE provider='hunter'`);return Response.json({data:{first_name:'Anna',last_name:'BuyerZero',email:'anna@example.com'}});},save:async()=>{saved++;return {work_email:'anna@example.com'};}});
 await assert.rejects(lookupAdditionalEmail(f.env,f.context,'c',{person_id:'p0',provider:'hunter',approved:true,hunter_approved:true},f.deps),error=>error.code==='ADDITIONAL_CONTACT_APPROVAL_REQUIRED');
 assert.equal(calls,1);assert.equal(saved,0);const row=f.raw.prepare('SELECT status,result_json FROM additional_contact_attempts').get();assert.equal(row.status,'needs_review');assert.equal(JSON.parse(row.result_json).provider_started,true);
});

test('contradictory Hunter verification verdicts cannot confirm a buyer email',async()=>{
 const f=fixture();
 for(const inline of [true,false]){
  const verification={email:'anna@example.com',status:'valid',result:'undeliverable',date:new Date().toISOString()};
  const deps=hunterDeps({first_name:'Anna',last_name:'BuyerZero',email:'anna@example.com',...(inline?{verification}:{})},verification);
  const result=await findHunterWorkEmail(f.env,f.context,{domain:'example.com'},f.people[0],'c',deps);assert.equal(result.contact,null);assert.equal(result.research.status,'unconfirmed');
 }
});

test('an employer edit cannot authorize later paid phases even after new public checks complete',async()=>{
 const f=fixture();f.raw.exec("INSERT INTO additional_contact_policies(workspace_id,enabled,provider) VALUES('w',1,'treg')");f.deps.credential=async()=>({configured:true});f.deps.getCompany=async()=>structuredClone(f.detail);let dispatched=0;
 f.deps.findTreg=async(e,c,candidate,person,id,{guard,onDispatch})=>{f.people[0].organization='Example Ltd';researchReceipts({company:'Example',domain:'example.com',people:f.people,publicResearch:f.detail.intelligence.research_snapshot.buyerResearch.publicResearch});await guard({phase:'find'});await onDispatch();dispatched++;return {contact:null};};
 await assert.rejects(lookupAdditionalEmail(f.env,f.context,'c',{person_id:'p0',provider:'treg',approved:true},f.deps),/buyer changed|identity/i);assert.equal(dispatched,0);
});

test('manual and automatic APIs reject empty or duplicated saved buyer IDs before reserving credits',async()=>{
 for(const automatic of [false,true])for(const duplicate of [false,true]){
  const f=fixture();f.raw.exec("INSERT INTO additional_contact_policies(workspace_id,enabled,provider) VALUES('w',1,'apollo')");
  if(duplicate)f.people.push({...f.people[0],name:'Another Buyer'});else f.people[0].id='';
  await assert.rejects(lookupAdditionalEmail(f.env,f.context,'c',{person_id:duplicate?'p0':'',approved:!automatic,automatic},f.deps),error=>error.code==='ADDITIONAL_CONTACT_IDENTITY_REQUIRED');assert.equal(f.calls.length,0);assert.equal(f.raw.prepare('SELECT COUNT(*) n FROM additional_contact_attempts').get().n,0);
 }
});

test('pause while decoding Apollo response prevents late identity remapping and retains the submitted attempt',async()=>{
 const f=fixture();f.raw.exec("CREATE TABLE crm_contacts(id TEXT,workspace_id TEXT,external_person_id TEXT);INSERT INTO crm_contacts VALUES('saved','w','apollo-person');");
 let allowed=true;f.deps.guard=async()=>{if(!allowed)throw Error('Workflow paused');};f.deps.resolvePerson=async p=>({...p,id:'apollo-person'});
 f.deps.enrich=async()=>({ok:true,json:async()=>{allowed=false;return {contact:{id:'saved',name:'Anna BuyerZero',work_email:'anna@example.com',email_status:'verified',source:'apollo',verification_provider:'Apollo'},request:{status:'verified',credits_used:1}};}});
 await assert.rejects(()=>lookupAdditionalEmail(f.env,f.context,'c',{person_id:'p0',approved:true},f.deps),/Workflow paused/);
 assert.equal(f.raw.prepare("SELECT external_person_id FROM crm_contacts WHERE id='saved'").get().external_person_id,'apollo-person');
 const attempt=f.raw.prepare('SELECT status,result_json FROM additional_contact_attempts').get();assert.equal(attempt.status,'needs_review');assert.equal(JSON.parse(attempt.result_json).provider_started,true);
});

async function concurrentTregFixture({failedEmail=false,blockPhase=failedEmail?'find':'profile'}={}){
 const {findTregWorkEmail}=await import('../src/treg-contact-research.js'),f=fixture();
 for(const file of ['0011_master_crm.sql','0012_crm_contact_enrichment.sql','0022_crm_public_contact_sources.sql'])f.raw.exec(fs.readFileSync(new URL('../migrations/'+file,import.meta.url),'utf8'));
 f.raw.exec("ALTER TABLE workspace_service_integrations ADD COLUMN last_used_at TEXT;ALTER TABLE workspace_service_integrations ADD COLUMN updated_at TEXT;INSERT INTO crm_companies(id,workspace_id,normalized_domain,company_name,lifecycle_status,first_seen_at,last_seen_at,created_at,updated_at) VALUES('c','w','example.com','Example','prospect','now','now','now','now');INSERT INTO additional_contact_policies(workspace_id,enabled,phone_enabled,provider) VALUES('w',1,1,'treg');");
 f.raw.prepare("INSERT INTO crm_intelligence(company_id,workspace_id,research_snapshot_json,intelligence_updated_at) VALUES('c','w',?,'now')").run(JSON.stringify(f.detail.intelligence.research_snapshot));
 const load=()=>({...f.detail,contacts:f.raw.prepare('SELECT * FROM crm_contacts').all(),intelligence:{research_snapshot:JSON.parse(f.raw.prepare("SELECT research_snapshot_json FROM crm_intelligence WHERE company_id='c'").get().research_snapshot_json)}});
 let release,entered;const wait=new Promise(r=>release=r),started=new Promise(r=>entered=r),calls=[];
 const providerDeps={credential:async()=>({configured:true,source:'customer',apiKey:'test-only'}),fetch:async(url,options)=>{
  calls.push({url,options});let payload;const phase=url.includes('email.find')?'find':url.includes('email.verify')?'verify':url.includes('people.enrich')?'profile':'phone';
  if(phase===blockPhase){entered();await wait;}
  if(failedEmail&&phase==='find')return new Response('{}',{status:503,headers:{'X-Treg-Call-Id':'billed-finder','X-Treg-Cost-Micro':'7000'}});
  if(url.includes('email.find'))payload={output:{email:'anna@example.com',full_name:'Anna BuyerZero',company_domain:'example.com'}};
  else if(url.includes('email.verify'))payload={output:{email:'anna@example.com',status:'valid'},raw:{email:'anna@example.com',result:'deliverable',is_accept_all:false}};
  else if(url.includes('people.enrich'))payload={output:{full_name:'Anna BuyerZero',company_domain:'example.com',title:'Head of Procurement',city:'Riga'}};
  else payload={output:{phone:'+37120000001',full_name:'Anna BuyerZero',company_domain:'example.com'}};
  return Response.json(payload,{headers:{'X-Treg-Call-Id':url.split('/').pop(),'X-Treg-Cost-Micro':'4000'}});
 }};
 let authorized=true;
 const deps={guard:async()=>{if(!authorized)throw Object.assign(Error('Contact authorization was revoked.'),{code:'CONTACT_SESSION_REVOKED'});},getCompany:async()=>load(),credential:providerDeps.credential,findTreg:(...args)=>findTregWorkEmail(...args,providerDeps)};
 const input={person_id:'p0',provider:'treg',approved:true,data_lookup:true};
 return {...f,load,calls,release,started,revoke:()=>{authorized=false;},email:()=>lookupAdditionalEmail(f.env,f.context,'c',{...input,email_lookup:true,phone_approved:false},deps),phone:()=>lookupAdditionalEmail(f.env,f.context,'c',{...input,email_lookup:false,phone_approved:true},deps),attempt:()=>JSON.parse(f.raw.prepare('SELECT result_json FROM additional_contact_attempts').get().result_json)};
}
test('a late email completion preserves a concurrent phone result and all settled phase receipts after reload',async()=>{
 const f=await concurrentTregFixture();try{
  const email=f.email();await f.started;await f.phone();f.release();const result=await email;
  const data=f.load().intelligence.research_snapshot.buyerResearch.buyers[0].contactData,attempt=f.attempt();
  for(const retained of [data,result.contactData,attempt.contactData]){
   assert.equal(retained.phone.number,'+37120000001');assert.equal(retained.phone.status,'provider_listed');assert.equal(retained.profile.city,'Riga');
   assert.deepEqual([...retained.callIds].sort(),['treg.people.email.find','treg.people.email.verify','treg.people.enrich','treg.people.phone.find'].sort());assert.equal(retained.costMicro,16000);
  }
  assert.equal(attempt.contact.phone_number,'+37120000001');assert.equal(attempt.contact.work_email,'anna@example.com');assert.equal(attempt.research.costMicro,16000);
  const before=f.calls.length;const replay=await f.phone();assert.equal(f.calls.length,before);assert.equal(replay.contactData.phone.number,data.phone.number);assert.equal(replay.contactData.profile.city,'Riga');assert.equal(replay.research.costMicro,16000);
 }finally{f.release();f.raw.close();}
});
test('a failed concurrent email worker retains the successful phone evidence and both billed phase receipts',async()=>{
 const f=await concurrentTregFixture({failedEmail:true});try{
  const email=f.email();await f.started;await f.phone();f.release();await assert.rejects(email,/saved lookup/);
  const attempt=f.attempt();assert.ok(attempt.contactData,'A failed worker must retain the successful sibling data');assert.equal(attempt.contactData.phone.number,'+37120000001');assert.equal(attempt.contact.phone_number,'+37120000001');
  assert.equal(attempt.research.costMicro,11000);assert.deepEqual([...attempt.research.callIds].sort(),['billed-finder','treg.people.phone.find'].sort());assert.match(attempt.error,/saved lookup/);
  const data=f.load().intelligence.research_snapshot.buyerResearch.buyers[0].contactData;
  assert.equal(data.phone.number,'+37120000001');assert.equal(data.costMicro,11000);assert.equal(attempt.provider_started,true);
  const history=f.raw.prepare("SELECT metadata_json FROM crm_activities WHERE activity_type='contact.enriched' ORDER BY rowid DESC LIMIT 1").get();assert.equal(JSON.parse(history.metadata_json).contact_data.costMicro,11000);
 }finally{f.release();f.raw.close();}
});
test('a late phone response retains the completed email, professional data and aggregate phase cost',async()=>{
 const f=await concurrentTregFixture({blockPhase:'phone'});try{
  const phone=f.phone();await f.started;await f.email();f.release();const result=await phone;
  assert.equal(result.contact.work_email,'anna@example.com');assert.equal(result.contact.email_status,'verified');assert.equal(result.contact.phone_number,'+37120000001');
  for(const data of [result.contactData,f.attempt().contactData,f.load().intelligence.research_snapshot.buyerResearch.buyers[0].contactData]){
   assert.equal(data.profile.city,'Riga');assert.equal(data.phone.number,'+37120000001');assert.equal(data.costMicro,16000);assert.equal(new Set(data.callIds).size,4);
  }
 }finally{f.release();f.raw.close();}
});
test('simultaneous retries retain one settled charge per idempotent paid phase',{timeout:5000},async()=>{
 const f=await concurrentTregFixture();try{
  const first=f.email();await f.started;const second=f.email();
  // The second worker reaches the same saved profile phase before either completes.
  while(f.calls.filter(row=>row.url.includes('people.enrich')).length<2)await new Promise(setImmediate);
  f.release();await Promise.all([first,second]);
  assert.equal(f.raw.prepare('SELECT COUNT(*) n FROM treg_contact_calls').get().n,3);assert.equal(f.attempt().research.costMicro,12000);assert.equal(f.attempt().research.callIds.length,3);
  assert.equal(f.raw.prepare('SELECT COUNT(*) n FROM additional_contact_attempts').get().n,1);
  const byPhase=new Map();for(const call of f.calls){const phase=call.url.split('/').pop(),keys=byPhase.get(phase)||new Set();keys.add(call.options.headers['Idempotency-Key']);byPhase.set(phase,keys);}assert.ok([...byPhase.values()].every(keys=>keys.size===1));
 }finally{f.release();f.raw.close();}
});
test('a contact-data write retries a raced save and retains the newer same-buyer phone',async()=>{
 const f=await concurrentTregFixture({blockPhase:'none'});try{
  const original=f.env.DB.prepare;let raced=false;
  f.env.DB.prepare=sql=>{
   if(!raced&&sql.startsWith('UPDATE crm_intelligence SET research_snapshot_json')){
    raced=true;const snapshot=f.load().intelligence.research_snapshot,person=snapshot.buyerResearch.buyers[0],checkedAt=new Date(Date.now()+1000).toISOString();
    person.contactData={version:1,personId:person.id,identityName:person.name,identityTitle:person.title,identityOrganization:person.organization,domain:'example.com',checkedAt,status:'updated',profile:{status:'not_requested'},phone:{status:'provider_listed',number:'+37120000002',source:'newer-response',checkedAt},callIds:[],costMicro:0};
    f.raw.prepare("UPDATE crm_intelligence SET research_snapshot_json=? WHERE company_id='c'").run(JSON.stringify(snapshot));f.raw.prepare("UPDATE crm_contacts SET phone_number='+37120000002' WHERE external_person_id='p0'").run();
   }
   return original(sql);
  };
  const result=await f.phone();assert.equal(raced,true);assert.equal(result.contactData.phone.number,'+37120000002');assert.equal(result.contact.phone_number,'+37120000002');assert.equal(f.load().intelligence.research_snapshot.buyerResearch.buyers[0].contactData.phone.source,'newer-response');
  assert.equal(f.calls.length,1,'A raced local save must not replay a paid phase');
 }finally{f.raw.close();}
});
test('a phone arriving before the CRM phone write is consistent across CRM, snapshot and response',async()=>{
 const f=await concurrentTregFixture({blockPhase:'none'});try{
  const original=f.env.DB.prepare;let raced=false;
  f.env.DB.prepare=sql=>{
   if(!raced&&sql.startsWith('UPDATE crm_contacts SET phone_number=CASE')){
    raced=true;const snapshot=f.load().intelligence.research_snapshot,person=snapshot.buyerResearch.buyers[0],checkedAt=new Date(Date.now()+1000).toISOString();
    person.contactData={version:1,personId:person.id,identityName:person.name,identityTitle:person.title,identityOrganization:person.organization,domain:'example.com',checkedAt,status:'updated',profile:{status:'not_requested'},phone:{status:'provider_listed',number:'+37120000002',source:'newer-response',checkedAt},callIds:[],costMicro:0};
    f.raw.prepare("UPDATE crm_intelligence SET research_snapshot_json=? WHERE company_id='c'").run(JSON.stringify(snapshot));f.raw.prepare("UPDATE crm_contacts SET phone_number='+37120000002' WHERE external_person_id='p0'").run();
   }
   return original(sql);
  };
  const result=await f.phone();assert.equal(raced,true);
  for(const retained of [result,f.attempt()]){assert.equal(retained.contact.phone_number,'+37120000002');assert.equal(retained.contactData.phone.number,'+37120000002');}
  assert.equal(f.load().contacts[0].phone_number,'+37120000002');assert.equal(f.load().intelligence.research_snapshot.buyerResearch.buyers[0].contactData.phone.number,'+37120000002');
 }finally{f.raw.close();}
});
test('a held stale nonempty CRM row cannot replace a newer phone in a late email response',async()=>{
 const f=await concurrentTregFixture({blockPhase:'none'});let release;try{
  const {upsertCrmContacts}=await import('../src/crm.js');await upsertCrmContacts(f.env.DB,f.context,'c',[{external_person_id:'p0',name:'Anna BuyerZero',title:'Head of Procurement',source:'treg'}]);f.raw.prepare("UPDATE crm_contacts SET phone_number='+37120000000',phone_status='provider_listed'").run();
  const original=f.env.DB.prepare;let held=false,ready;const started=new Promise(r=>ready=r),wait=new Promise(r=>release=r);
  f.env.DB.prepare=sql=>{const statement=original(sql);if(sql==='SELECT * FROM crm_contacts WHERE workspace_id=? AND company_id=? AND archived_at IS NULL ORDER BY updated_at DESC'){
   const all=statement.all.bind(statement);statement.all=async()=>{const result=await all();if(!held&&f.load().intelligence.research_snapshot.buyerResearch.buyers[0].contactData?.profile?.status==='provider_reported'){held=true;ready();await wait;}return result;};
  }return statement;};
  const email=f.email();await started;const phone=await f.phone();release();const result=await email;
  assert.equal(phone.contact.phone_number,'+37120000001');assert.equal(result.contact.phone_number,'+37120000001');assert.equal(f.attempt().contact.phone_number,'+37120000001');assert.equal(result.contactData.phone.number,'+37120000001');
 }finally{release?.();f.release();f.raw.close();}
});
test('a billed failed phase remains in the ledger without CRM projection after authorization is revoked',async()=>{
 const f=await concurrentTregFixture({failedEmail:true});try{
  const email=f.email();await f.started;await f.phone();
  const snapshot=f.raw.prepare("SELECT research_snapshot_json FROM crm_intelligence WHERE company_id='c'").get().research_snapshot_json,activities=f.raw.prepare('SELECT COUNT(*) n FROM crm_activities').get().n;
  f.revoke();f.release();await assert.rejects(email,/saved lookup/);
  assert.equal(f.attempt().research.costMicro,11000);assert.equal(f.attempt().provider_started,true);assert.equal(f.raw.prepare('SELECT SUM(cost_micro) n FROM treg_contact_calls').get().n,11000);
  assert.equal(f.raw.prepare("SELECT research_snapshot_json FROM crm_intelligence WHERE company_id='c'").get().research_snapshot_json,snapshot);assert.equal(f.raw.prepare('SELECT COUNT(*) n FROM crm_activities').get().n,activities);
 }finally{f.release();f.raw.close();}
});
